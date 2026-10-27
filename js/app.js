(function(){
'use strict';
const {Utils,Store,DB,Templates,TaxEngine,BillingEngine,Notifications}=BillFlow;

let isVoiceActive = false;
let recognition = null;

async function init(){
  try {
    // 1. Open Database & Load Records
    await DB.open();
    await Store.loadFromDB();

    // 2. Apply theme
    const settings = Store.get('settings') || {};
    const theme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    // 3. Initialize Top Bar and Navigation
    bindHeaderAndSidebar();
    updateBrandHeader();
    updateNotificationBadge();

    // 4. Setup Listeners
    Store.on('notifications', updateNotificationBadge);
    Store.on('settings', updateBrandHeader);

    // 5. Periodic alerts check
    Notifications.checkOverdueInvoices();
    Notifications.checkLowStock();
    Notifications.checkExpiry();

    // 6. Router listener
    window.addEventListener('hashchange', handleRoute);

    // 7. Check if first time setup is needed
    if(!Store.get('isSetupDone') && (Store.get('invoices')||[]).length === 0){
      showSetupWizard();
    } else {
      handleRoute();
    }

    console.log('BillFlow Pro initialized successfully.');
  } catch(err) {
    console.error('BillFlow Pro initialization failed:', err);
  }
}

/* ====================================================================
   ROUTER
   ==================================================================== */
function handleRoute(){
  const hash = window.location.hash.slice(1) || 'dashboard';
  const parts = hash.split('/');
  const route = parts[0];
  const subRoute = parts[1];
  const param = parts[2];

  Store.set('currentPage', route);

  // Update navigation items
  document.querySelectorAll('.nav-item').forEach(el => {
    const target = el.getAttribute('href')?.replace('#', '').split('/')[0];
    if(target === route){
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  renderPage(subRoute, param);
}

function renderPage(subRoute, param){
  const route = Store.get('currentPage') || 'dashboard';
  const mainContent = document.getElementById('mainContent');
  if(!mainContent) return;

  // Clean existing charts if switching away
  if(BillFlow.Analytics?.destroyAllCharts){
    BillFlow.Analytics.destroyAllCharts();
  }

  const {Dashboard, Invoices, Customers, Inventory, Reports, Settings} = BillFlow.Pages;

  if(route === 'dashboard' && Dashboard){
    mainContent.innerHTML = Dashboard.render();
    Dashboard.init();
  } else if(route === 'invoices' && Invoices){
    mainContent.innerHTML = Invoices.render(subRoute, param);
  } else if(route === 'customers' && Customers){
    mainContent.innerHTML = Customers.render();
  } else if(route === 'inventory' && Inventory){
    mainContent.innerHTML = Inventory.render();
  } else if(route === 'reports' && Reports){
    mainContent.innerHTML = Reports.render();
    Reports.init();
  } else if(route === 'settings' && Settings){
    mainContent.innerHTML = Settings.render();
  } else {
    // Default to dashboard
    if(Dashboard){
      mainContent.innerHTML = Dashboard.render();
      Dashboard.init();
    }
  }

  // Scroll to top on route change
  mainContent.scrollTop = 0;
}

/* ====================================================================
   HEADER & SIDEBAR BINDINGS
   ==================================================================== */
function bindHeaderAndSidebar(){
  // Sidebar toggle
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('sidebar');
  if(toggleBtn && sidebar){
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('collapsed');
      Store.set('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    };
  }

  // Mobile menu button
  const mobileBtn = document.getElementById('mobileMenuBtn');
  if(mobileBtn && sidebar){
    mobileBtn.onclick = () => {
      sidebar.classList.toggle('mobile-open');
    };
  }

  // Theme toggle button
  const themeBtn = document.getElementById('themeToggleBtn');
  if(themeBtn){
    themeBtn.onclick = async () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      await Store.saveSetting('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
      Notifications.info('Theme', `Switched to ${next} mode`);
      renderPage();
    };
  }

  // Notification bell button
  const notifBtn = document.getElementById('notifBtn');
  if(notifBtn){
    notifBtn.onclick = toggleNotificationPanel;
  }

  // Voice Assistant button
  const voiceBtn = document.getElementById('voiceBtn');
  if(voiceBtn){
    voiceBtn.onclick = triggerVoiceBilling;
  }

  // Global search input
  const globalSearch = document.getElementById('globalSearchInput');
  if(globalSearch){
    globalSearch.addEventListener('input', Utils.debounce((e) => {
      performGlobalSearch(e.target.value);
    }, 250));
    globalSearch.addEventListener('focus', () => {
      if(globalSearch.value.trim()) performGlobalSearch(globalSearch.value);
    });
  }
}

function updateBrandHeader(){
  const settings = Store.get('settings') || {};
  const template = Templates.getTemplate(settings.industry || 'retail');
  const brandName = settings.businessName || 'BillFlow Pro';

  const brandEl = document.getElementById('brandNameDisplay');
  if(brandEl) brandEl.innerHTML = `${Utils.escapeHtml(brandName)} <span>${template.icon}</span>`;

  const headerTitle = document.getElementById('headerTitleDisplay');
  if(headerTitle) headerTitle.textContent = brandName;

  const headerSub = document.getElementById('headerSubtitleDisplay');
  if(headerSub) headerSub.textContent = `${template.name} Edition • Powered by BillFlow Engine`;

  // Update terminology on sidebar labels if any
  const navCust = document.getElementById('navCustText');
  if(navCust) navCust.textContent = Templates.getTerminology('customer') + 's';

  const navItem = document.getElementById('navItemText');
  if(navItem) navItem.textContent = Templates.getTerminology('item') + 's';

  const navInv = document.getElementById('navInvText');
  if(navInv) navInv.textContent = Templates.getTerminology('invoice') + 's';
}

function updateNotificationBadge(){
  const count = Notifications.getUnreadCount();
  const dot = document.getElementById('notifBadgeDot');
  if(dot){
    dot.style.display = count > 0 ? 'block' : 'none';
  }
}

function toggleNotificationPanel(){
  let panel = document.getElementById('notifPanel');
  if(panel){
    panel.remove();
    return;
  }

  panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notification-panel';
  panel.innerHTML = Notifications.renderNotificationPanel();
  document.body.appendChild(panel);
}

/* ====================================================================
   GLOBAL OMNI-SEARCH
   ==================================================================== */
function performGlobalSearch(q){
  const query = (q || '').trim().toLowerCase();
  const oldDrop = document.getElementById('globalSearchDropdown');
  if(oldDrop) oldDrop.remove();
  if(!query) return;

  const invoices = Store.get('invoices') || [];
  const customers = Store.get('customers') || [];
  const items = Store.get('items') || [];

  const matchedInv = invoices.filter(i => (i.invoiceNo||'').toLowerCase().includes(query) || (i.customerName||'').toLowerCase().includes(query)).slice(0, 4);
  const matchedCust = customers.filter(c => (c.name||'').toLowerCase().includes(query) || (c.phone||'').includes(query)).slice(0, 4);
  const matchedItems = items.filter(it => (it.name||'').toLowerCase().includes(query) || (it.sku||'').toLowerCase().includes(query)).slice(0, 4);

  const container = document.querySelector('.header-search');
  if(!container) return;

  const drop = document.createElement('div');
  drop.id = 'globalSearchDropdown';
  drop.className = 'card';
  drop.style.cssText = 'position:absolute;top:100%;left:0;right:0;margin-top:6px;max-height:360px;overflow-y:auto;z-index:var(--z-dropdown);box-shadow:var(--shadow-xl);padding:.5rem;';

  if(matchedInv.length === 0 && matchedCust.length === 0 && matchedItems.length === 0){
    drop.innerHTML = '<div style="padding:1rem;text-align:center;font-size:var(--text-xs);color:var(--text-tertiary)">No records match your search</div>';
  } else {
    drop.innerHTML = `
      ${matchedInv.length > 0 ? `
        <div style="font-size:10px;font-weight:700;color:var(--primary-400);text-transform:uppercase;padding:4px 8px">Invoices</div>
        ${matchedInv.map(i => `
          <div style="padding:6px 8px;border-radius:var(--radius-sm);cursor:pointer;font-size:var(--text-sm);display:flex;justify-content:space-between" class="hover-bg" onclick="document.getElementById('globalSearchDropdown')?.remove();BillFlow.Pages.Invoices.viewInvoiceModal('${i.id}')">
            <span><strong>${i.invoiceNo}</strong> • ${Utils.escapeHtml(i.customerName)}</span>
            <span style="font-family:monospace">${Utils.formatCurrency(i.grandTotal)}</span>
          </div>
        `).join('')}
      ` : ''}

      ${matchedCust.length > 0 ? `
        <div style="font-size:10px;font-weight:700;color:var(--info);text-transform:uppercase;padding:4px 8px;margin-top:6px">Customers</div>
        ${matchedCust.map(c => `
          <div style="padding:6px 8px;border-radius:var(--radius-sm);cursor:pointer;font-size:var(--text-sm);display:flex;justify-content:space-between" class="hover-bg" onclick="document.getElementById('globalSearchDropdown')?.remove();BillFlow.Pages.Customers.viewCustomer360('${c.id}')">
            <span>👤 <strong>${Utils.escapeHtml(c.name)}</strong></span>
            <span style="font-size:11px;color:var(--text-secondary)">${c.phone || c.group}</span>
          </div>
        `).join('')}
      ` : ''}

      ${matchedItems.length > 0 ? `
        <div style="font-size:10px;font-weight:700;color:var(--success);text-transform:uppercase;padding:4px 8px;margin-top:6px">Inventory Items</div>
        ${matchedItems.map(it => `
          <div style="padding:6px 8px;border-radius:var(--radius-sm);cursor:pointer;font-size:var(--text-sm);display:flex;justify-content:space-between" class="hover-bg" onclick="document.getElementById('globalSearchDropdown')?.remove();BillFlow.Pages.Inventory.openItemModal('${it.id}')">
            <span>📦 <strong>${Utils.escapeHtml(it.name)}</strong></span>
            <span style="font-family:monospace">${Utils.formatCurrency(it.sellingPrice)}</span>
          </div>
        `).join('')}
      ` : ''}
    `;
  }

  container.appendChild(drop);

  // Close when clicking outside
  document.addEventListener('click', function closeSearch(ev){
    if(!container.contains(ev.target)){
      drop.remove();
      document.removeEventListener('click', closeSearch);
    }
  });
}

/* ====================================================================
   VOICE ASSISTANT (WEB SPEECH API)
   ==================================================================== */
function triggerVoiceBilling(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;text-align:center">
      <div class="modal-header">
        <h3 class="modal-title">🎙️ AI Voice Command Assistant</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding:2rem">
        <div id="voiceWaveAnimation" style="width:72px;height:72px;border-radius:50%;background:hsla(var(--hue-primary),80%,50%,.15);border:2px solid var(--primary-400);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2rem;animation:pulse 1.5s infinite">
          🎙️
        </div>
        <h4 style="font-size:var(--text-lg);font-weight:700;margin-bottom:.5rem" id="voiceStatusText">Listening for commands...</h4>
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:1.5rem" id="voiceTranscript">
          Try saying: <em>"New invoice"</em>, <em>"Add customer"</em>, <em>"Open reports"</em>, or <em>"Switch to light theme"</em>
        </p>

        <!-- Voice Quick Prompts -->
        <div style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center">
          <button class="btn btn-secondary btn-sm" onclick="BillFlow.App.executeVoiceCommand('new invoice');this.closest('.modal-overlay').remove()">📝 "New Invoice"</button>
          <button class="btn btn-secondary btn-sm" onclick="BillFlow.App.executeVoiceCommand('quick sale');this.closest('.modal-overlay').remove()">⚡ "Quick Sale"</button>
          <button class="btn btn-secondary btn-sm" onclick="BillFlow.App.executeVoiceCommand('open reports');this.closest('.modal-overlay').remove()">📊 "Open Reports"</button>
          <button class="btn btn-secondary btn-sm" onclick="BillFlow.App.executeVoiceCommand('seed demo data');this.closest('.modal-overlay').remove()">⚡ "Seed Demo Data"</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  if(!SpeechRecognition){
    const status = overlay.querySelector('#voiceStatusText');
    if(status) status.textContent = 'Voice recognition simulated';
    const sub = overlay.querySelector('#voiceTranscript');
    if(sub) sub.textContent = 'Web Speech API is not supported in this browser environment. Click any command button below:';
    return;
  }

  try {
    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.continuous = false;
    recognizer.interimResults = false;

    recognizer.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const sub = overlay.querySelector('#voiceTranscript');
      if(sub) sub.textContent = `You said: "${text}"`;
      setTimeout(() => {
        overlay.remove();
        executeVoiceCommand(text);
      }, 700);
    };

    recognizer.onerror = () => {
      const status = overlay.querySelector('#voiceStatusText');
      if(status) status.textContent = 'Could not catch voice. Click a command below.';
    };

    recognizer.start();
  } catch(e) {
    console.warn('SpeechRecognition failed to start:', e);
  }
}

function executeVoiceCommand(cmd){
  const c = cmd.toLowerCase();
  Notifications.info('Voice Command', `Executing: "${cmd}"`);

  if(c.includes('invoice') || c.includes('bill')){
    window.location.hash = '#invoices/new';
  } else if(c.includes('customer') || c.includes('patient') || c.includes('guest')){
    window.location.hash = '#customers';
  } else if(c.includes('inventory') || c.includes('item') || c.includes('medicine') || c.includes('product')){
    window.location.hash = '#inventory';
  } else if(c.includes('report') || c.includes('tax') || c.includes('analytics')){
    window.location.hash = '#reports';
  } else if(c.includes('setting')){
    window.location.hash = '#settings';
  } else if(c.includes('quick sale') || c.includes('pos')){
    openQuickSaleModal();
  } else if(c.includes('demo') || c.includes('sample')){
    seedDemoData();
  } else if(c.includes('light')){
    BillFlow.Pages.Settings.setTheme('light');
  } else if(c.includes('dark')){
    BillFlow.Pages.Settings.setTheme('dark');
  } else {
    window.location.hash = '#dashboard';
  }
}

/* ====================================================================
   QUICK SALE / POS MODAL (RAPID BILLING)
   ==================================================================== */
function openQuickSaleModal(){
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';
  const items = Store.get('items') || [];
  const termCustomer = Templates.getTerminology('customer');

  let cart = [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:850px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h3 class="modal-title">⚡ Quick Sale / POS Terminal</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:grid;grid-template-columns:1fr 320px;gap:1.5rem;padding:1.5rem;flex:1;overflow:hidden">
        <!-- Left: Quick Item Buttons -->
        <div style="overflow-y:auto;padding-right:.5rem">
          <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:.75rem">
            Tap items to add to quick ticket
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:.75rem">
            ${items.map(it => `
              <div class="card" style="padding:.75rem;cursor:pointer;text-align:center;transition:transform 100ms" onclick="BillFlow.App.posAddItem('${it.id}')">
                <div style="font-weight:600;font-size:var(--text-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(it.name)}</div>
                <div style="font-family:monospace;font-weight:700;color:var(--primary-400);margin-top:4px">${Utils.formatCurrency(it.sellingPrice, currency)}</div>
                <div style="font-size:10px;color:var(--text-tertiary)">Stock: ${it.currentStock}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: Current Cart Ticket -->
        <div style="background:var(--bg-tertiary);border-radius:var(--radius-lg);padding:1.25rem;display:flex;flex-direction:column;border:1px solid var(--border-secondary)">
          <div style="font-weight:700;font-size:var(--text-sm);border-bottom:1px solid var(--border-secondary);padding-bottom:.5rem;margin-bottom:.75rem">
            Current Ticket
          </div>
          <div id="posCartList" style="flex:1;overflow-y:auto;min-height:160px">
            <div style="color:var(--text-tertiary);font-size:var(--text-xs);text-align:center;padding:2rem 0">Ticket is empty</div>
          </div>
          <div style="border-top:1px solid var(--border-secondary);padding-top:.75rem;margin-top:.75rem">
            <div style="display:flex;justify-content:space-between;font-size:var(--text-base);font-weight:800;margin-bottom:1rem">
              <span>Total:</span>
              <span id="posCartTotal" style="color:var(--primary-400)">${Utils.formatCurrency(0, currency)}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
              <button class="btn btn-success" onclick="BillFlow.App.posCheckout('cash')">💵 Cash Paid</button>
              <button class="btn btn-primary" onclick="BillFlow.App.posCheckout('upi')">📱 UPI Paid</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  window._posCart = [];
}

function posAddItem(id){
  const item = Store.getItem(id);
  if(!item) return;
  const existing = window._posCart.find(x => x.itemId === id);
  if(existing){
    existing.quantity += 1;
  } else {
    window._posCart.push({
      itemId: id,
      name: item.name,
      price: item.sellingPrice || 0,
      quantity: 1,
      taxRate: item.taxRate || 0,
      unit: item.unit || 'pcs'
    });
  }
  updatePosUI();
}

function posRemoveItem(idx){
  window._posCart.splice(idx, 1);
  updatePosUI();
}

function updatePosUI(){
  const container = document.getElementById('posCartList');
  const totalEl = document.getElementById('posCartTotal');
  if(!container || !totalEl) return;

  if(!window._posCart || window._posCart.length === 0){
    container.innerHTML = '<div style="color:var(--text-tertiary);font-size:var(--text-xs);text-align:center;padding:2rem 0">Ticket is empty</div>';
    totalEl.textContent = Utils.formatCurrency(0);
    return;
  }

  let total = 0;
  container.innerHTML = window._posCart.map((it, idx) => {
    const lineTotal = it.price * it.quantity;
    total += lineTotal;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-xs)">
        <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          <strong>${it.quantity}x</strong> ${Utils.escapeHtml(it.name)}
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-family:monospace">${Utils.formatCurrency(lineTotal)}</span>
          <button style="background:none;border:none;color:var(--danger);cursor:pointer" onclick="BillFlow.App.posRemoveItem(${idx})">✕</button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.textContent = Utils.formatCurrency(total);
}

async function posCheckout(mode){
  if(!window._posCart || window._posCart.length === 0){
    Notifications.warning('Empty Ticket', 'Please add items to ticket first');
    return;
  }

  const totals = TaxEngine.calculateInvoiceTotals(window._posCart);
  const invoice = await BillingEngine.createInvoice({
    customerName: 'Quick POS Customer',
    items: window._posCart,
    paymentMode: mode,
    amountPaid: totals.grandTotal,
    notes: 'Quick Counter Sale'
  });

  document.querySelector('.modal-overlay')?.remove();
  Notifications.success('Sale Completed', `Billed ${Utils.formatCurrency(totals.grandTotal)} via ${mode.toUpperCase()}`);
  renderPage();
  BillFlow.Pages.Invoices.printInvoice(invoice.id);
}

/* ====================================================================
   BARCODE CAMERA / SIMULATOR SCANNER
   ==================================================================== */
function openBarcodeScanner(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px;text-align:center">
      <div class="modal-header">
        <h3 class="modal-title">📷 Barcode / QR Scanner</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding:1.5rem">
        <div style="background:#000;border-radius:var(--radius-lg);height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;margin-bottom:1rem;position:relative;overflow:hidden">
          <div style="width:80%;height:2px;background:var(--danger);position:absolute;animation:pulse 1s infinite"></div>
          <div style="font-size:2rem;margin-bottom:.5rem">📷</div>
          <div style="font-size:var(--text-xs);color:#aaa">Point scanner or type barcode below</div>
        </div>

        <div class="form-group">
          <label class="form-label" style="text-align:left">Enter or Scan Barcode</label>
          <div style="display:flex;gap:4px">
            <input type="text" id="scanInput" class="form-input" placeholder="Scan or enter code..." autofocus>
            <button class="btn btn-primary" id="btnLookupScan">Lookup</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const lookup = () => {
    const code = overlay.querySelector('#scanInput').value.trim();
    if(!code) return;
    const items = Store.get('items') || [];
    const matched = items.find(i => (i.barcode||'').toLowerCase() === code.toLowerCase() || (i.sku||'').toLowerCase() === code.toLowerCase());

    overlay.remove();
    if(matched){
      Notifications.success('Found Item', `${matched.name} — ${Utils.formatCurrency(matched.sellingPrice)}`);
      BillFlow.Pages.Inventory.openItemModal(matched.id);
    } else {
      Notifications.warning('Not Found', `No item matching barcode "${code}"`);
    }
  };

  overlay.querySelector('#btnLookupScan').onclick = lookup;
  overlay.querySelector('#scanInput').onkeydown = (e) => { if(e.key === 'Enter') lookup(); };
}

/* ====================================================================
   SETUP WIZARD
   ==================================================================== */
function showSetupWizard(){
  const allTemplates = Templates.getAllTemplates();
  let selectedIndustry = 'retail';

  const overlay = document.createElement('div');
  overlay.className = 'setup-wizard';
  overlay.id = 'setupWizardModal';
  overlay.innerHTML = `
    <div class="setup-wizard-inner">
      <div class="setup-step" id="setupStep1">
        <div style="font-size:3rem;text-align:center;margin-bottom:1rem">⚡</div>
        <h1>Welcome to BillFlow Pro</h1>
        <p>The universal, offline-first billing CRM engine that adapts to any industry.</p>

        <div class="form-group" style="max-width:420px;margin:0 auto 1.5rem">
          <label class="form-label">Business / Enterprise Name</label>
          <input type="text" id="wizBizName" class="form-input" placeholder="e.g. Apollo Healthcare, Grand Vista Hotel, City Mart" value="BillFlow Retail Store">
        </div>

        <div style="font-size:var(--text-sm);font-weight:700;margin-bottom:.75rem;text-align:center">
          Choose Your Industry Profile:
        </div>

        <div class="industry-grid" style="grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));max-height:260px;overflow-y:auto;padding:4px">
          ${allTemplates.map(t => `
            <div class="industry-card ${t.id === selectedIndustry ? 'selected' : ''}" data-id="${t.id}" onclick="BillFlow.App.wizardSelectIndustry('${t.id}')">
              <div class="industry-icon" style="font-size:1.5rem">${t.icon}</div>
              <div class="industry-name" style="font-size:12px">${t.name}</div>
            </div>
          `).join('')}
        </div>

        <div class="setup-actions">
          <button class="btn btn-secondary" onclick="BillFlow.App.completeWizard(false)">Start Blank</button>
          <button class="btn btn-primary btn-lg" onclick="BillFlow.App.completeWizard(true)">
            <span>⚡</span> Launch with Demo Data (Recommended)
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  window._wizardIndustry = selectedIndustry;
}

function wizardSelectIndustry(id){
  window._wizardIndustry = id;
  document.querySelectorAll('#setupWizardModal .industry-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });
}

async function completeWizard(withDemoData = true){
  const nameInput = document.getElementById('wizBizName')?.value.trim() || 'My Business';
  const industry = window._wizardIndustry || 'retail';

  await Store.saveSetting('businessName', nameInput);
  await Store.saveSetting('industry', industry);
  await Store.saveSetting('currency', 'INR');
  await Store.saveSetting('isSetupDone', true);

  document.getElementById('setupWizardModal')?.remove();

  if(withDemoData){
    await seedDemoData(industry, nameInput);
  }

  updateBrandHeader();
  window.location.hash = '#dashboard';
  handleRoute();
  Notifications.success('Setup Complete', `Welcome to BillFlow Pro!`);
}

/* ====================================================================
   RICH DEMO SEED DATA GENERATOR (ALL 10 INDUSTRIES)
   ==================================================================== */
async function seedDemoData(targetIndustry = null, bizName = null){
  const settings = Store.get('settings') || {};
  const industry = targetIndustry || settings.industry || 'retail';
  const template = Templates.getTemplate(industry);

  Notifications.info('Seeding Database', `Generating sample data for ${template.name}...`);

  // Clear existing items/customers/invoices for clean experience
  await DB.clear('items');
  await DB.clear('customers');
  await DB.clear('invoices');
  await DB.clear('payments');
  await DB.clear('activities');

  const demoItemsMap = {
    hotel: [
      { name: 'Deluxe Ocean View Room', category: 'Room Charges', price: 4500, cost: 1200, unit: 'Night', tax: 12, meta: { roomType: 'Deluxe', roomNo: '304', guestCount: 2 } },
      { name: 'Standard Executive Room', category: 'Room Charges', price: 2800, cost: 800, unit: 'Night', tax: 12, meta: { roomType: 'Standard', roomNo: '201', guestCount: 2 } },
      { name: 'Presidential Suite', category: 'Room Charges', price: 12000, cost: 3500, unit: 'Night', tax: 18, meta: { roomType: 'Suite', roomNo: 'PH-1', guestCount: 4 } },
      { name: 'Buffet Breakfast & Dining', category: 'Restaurant', price: 650, cost: 220, unit: 'Person', tax: 5, meta: {} },
      { name: 'Express Laundry Service', category: 'Laundry', price: 450, cost: 80, unit: 'Kg', tax: 18, meta: {} }
    ],
    pharmacy: [
      { name: 'Paracetamol 650mg (Dolo)', category: 'Tablets', price: 32, cost: 18, unit: 'Strip', tax: 12, meta: { batchNo: 'DL-9082', expiryDate: '2027-08-31', schedule: 'OTC', manufacturer: 'Micro Labs' } },
      { name: 'Augmentin 625 Duo', category: 'Tablets', price: 210, cost: 145, unit: 'Strip', tax: 12, meta: { batchNo: 'AG-4412', expiryDate: '2026-12-31', schedule: 'H', manufacturer: 'GSK' } },
      { name: 'Azithromycin 500mg', category: 'Tablets', price: 135, cost: 85, unit: 'Strip', tax: 12, meta: { batchNo: 'AZ-1029', expiryDate: '2027-03-31', schedule: 'H', manufacturer: 'Cipla' } },
      { name: 'Ascoril D Plus Cough Syrup', category: 'Syrups', price: 140, cost: 95, unit: 'Bottle', tax: 12, meta: { batchNo: 'AS-8821', expiryDate: '2026-11-30', schedule: 'OTC', manufacturer: 'Glenmark' } },
      { name: 'Digital Infrared Thermometer', category: 'Equipment', price: 950, cost: 580, unit: 'Piece', tax: 18, meta: { batchNo: 'TH-004', expiryDate: '2030-01-01', schedule: 'OTC', manufacturer: 'Omron' } }
    ],
    retail: [
      { name: 'Organic Almond Milk 1L', category: 'Dairy', price: 280, cost: 190, unit: 'Ltr', tax: 5, meta: { barcode: '890123450001', brand: 'Raw Naturals' } },
      { name: 'Roasted Cashews 500g', category: 'Snacks', price: 480, cost: 350, unit: 'Pack', tax: 12, meta: { barcode: '890123450002', brand: 'Royal Dryfruits' } },
      { name: 'Basmati Rice Premium 5Kg', category: 'Groceries', price: 650, cost: 480, unit: 'Pack', tax: 0, meta: { barcode: '890123450003', brand: 'India Gate' } },
      { name: 'Aromatic Filter Coffee 200g', category: 'Beverages', price: 195, cost: 130, unit: 'Pack', tax: 5, meta: { barcode: '890123450004', brand: 'Narasu' } },
      { name: 'Extra Virgin Olive Oil 500ml', category: 'Groceries', price: 540, cost: 390, unit: 'Bottle', tax: 12, meta: { barcode: '890123450005', brand: 'Borges' } }
    ]
  };

  const defaultItems = demoItemsMap[industry] || demoItemsMap.retail;

  // 1. Seed Items
  const createdItems = [];
  for(const it of defaultItems){
    const itemObj = {
      id: Utils.uuid(),
      name: it.name,
      category: it.category,
      sellingPrice: it.price,
      costPrice: it.cost,
      unit: it.unit,
      currentStock: Math.floor(25 + Math.random() * 80),
      minStock: 10,
      taxRate: it.tax,
      sku: 'SKU-' + Utils.shortId(),
      barcode: it.meta?.barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      industryMeta: it.meta || {},
      createdAt: Utils.now(),
      updatedAt: Utils.now()
    };
    await DB.put('items', itemObj);
    createdItems.push(itemObj);
  }

  // 2. Seed Customers
  const customerList = [
    { name: 'Rajesh Sharma', phone: '+91 98201 23456', email: 'rajesh.sharma@example.com', group: 'VIP', gstin: '27AABCS1429B1Z1', loyaltyTier: 'gold', loyaltyPoints: 340, balance: 0 },
    { name: 'Priya Iyer', phone: '+91 98402 34567', email: 'priya.iyer@example.com', group: 'Regular', gstin: '', loyaltyTier: 'silver', loyaltyPoints: 120, balance: 1400 },
    { name: 'Vikram Patel', phone: '+91 98791 45678', email: 'vikram.p@example.com', group: 'Wholesale', gstin: '24AAACP4589D1Z4', loyaltyTier: 'platinum', loyaltyPoints: 890, balance: 0 },
    { name: 'Ananya Mukherjee', phone: '+91 98310 56789', email: 'ananya.m@example.com', group: 'Regular', gstin: '', loyaltyTier: 'bronze', loyaltyPoints: 45, balance: 0 }
  ];

  const createdCustomers = [];
  for(const c of customerList){
    const custObj = {
      id: Utils.uuid(),
      ...c,
      creditLimit: 50000,
      address: 'Plot 42, Civil Lines, Sector 5',
      createdAt: Utils.now(),
      updatedAt: Utils.now()
    };
    await DB.put('customers', custObj);
    createdCustomers.push(custObj);
  }

  // 3. Seed Invoices across the last 14 days
  const paymentModes = ['cash', 'upi', 'card'];
  for(let i = 0; i < 8; i++){
    const cust = createdCustomers[i % createdCustomers.length];
    const item1 = createdItems[i % createdItems.length];
    const item2 = createdItems[(i + 1) % createdItems.length];

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - (7 - i));
    const invDateStr = pastDate.toISOString().split('T')[0];

    const invoiceItems = [
      {
        id: Utils.uuid(),
        itemId: item1.id,
        name: item1.name,
        quantity: (i % 3) + 1,
        price: item1.sellingPrice,
        taxRate: item1.taxRate,
        unit: item1.unit,
        meta: item1.industryMeta || {}
      },
      {
        id: Utils.uuid(),
        itemId: item2.id,
        name: item2.name,
        quantity: 1,
        price: item2.sellingPrice,
        taxRate: item2.taxRate,
        unit: item2.unit,
        meta: item2.industryMeta || {}
      }
    ];

    const totals = TaxEngine.calculateInvoiceTotals(invoiceItems);
    const mode = paymentModes[i % paymentModes.length];
    const isUnpaid = (i === 6);

    const invObj = {
      id: Utils.uuid(),
      invoiceNo: `INV-2026-${String(1001 + i).padStart(4, '0')}`,
      customerId: cust.id,
      customerName: cust.name,
      items: invoiceItems,
      invoiceDate: invDateStr,
      dueDate: invDateStr,
      paymentMode: mode,
      status: isUnpaid ? 'unpaid' : 'paid',
      amountPaid: isUnpaid ? 0 : totals.grandTotal,
      notes: 'Thank you for your business!',
      terms: 'Payment due on receipt.',
      ...totals,
      createdAt: pastDate.toISOString(),
      updatedAt: pastDate.toISOString()
    };
    await DB.put('invoices', invObj);
  }

  // Reload store from newly written IndexedDB
  await Store.loadFromDB();
  Notifications.success('Ready', `Loaded demo data for ${template.name}`);
  renderPage();
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.App = {
  init, handleRoute, renderPage, bindHeaderAndSidebar,
  updateBrandHeader, updateNotificationBadge, triggerVoiceBilling,
  executeVoiceCommand, openQuickSaleModal, posAddItem, posRemoveItem,
  posCheckout, openBarcodeScanner, showSetupWizard, wizardSelectIndustry,
  completeWizard, seedDemoData
};

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', init);
})();
