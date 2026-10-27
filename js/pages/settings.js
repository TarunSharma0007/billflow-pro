(function(){
'use strict';
const {Utils,Store,Templates,Notifications,DB}=BillFlow;

let activeSection = 'business'; // 'business', 'industry', 'invoice', 'backup', 'theme'

function render(){
  const settings = Store.get('settings')||{};
  const currentIndustry = settings.industry || 'retail';
  const allTemplates = Templates.getAllTemplates();

  return `
    <div class="settings-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Settings & Configuration</h1>
          <div class="page-subtitle">Configure business profile, industry engine, invoice designs, and data backups</div>
        </div>
      </div>

      <div class="settings-layout">
        <!-- Sidebar Navigation -->
        <div class="settings-nav">
          <button class="settings-nav-item ${activeSection==='business'?'active':''}" onclick="BillFlow.Pages.Settings.setSection('business')">
            <span>🏢</span> Business Profile
          </button>
          <button class="settings-nav-item ${activeSection==='industry'?'active':''}" onclick="BillFlow.Pages.Settings.setSection('industry')">
            <span>🧩</span> Industry Template
          </button>
          <button class="settings-nav-item ${activeSection==='invoice'?'active':''}" onclick="BillFlow.Pages.Settings.setSection('invoice')">
            <span>📝</span> Invoice & Tax Setup
          </button>
          <button class="settings-nav-item ${activeSection==='theme'?'active':''}" onclick="BillFlow.Pages.Settings.setSection('theme')">
            <span>🎨</span> Theme & Display
          </button>
          <button class="settings-nav-item ${activeSection==='backup'?'active':''}" onclick="BillFlow.Pages.Settings.setSection('backup')">
            <span>💾</span> Backup & Demo Data
          </button>
        </div>

        <!-- Settings Body -->
        <div class="card">
          <div class="card-body">
            ${renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSectionContent(){
  const settings = Store.get('settings')||{};
  const currentIndustry = settings.industry || 'retail';
  const allTemplates = Templates.getAllTemplates();

  if(activeSection === 'business'){
    return `
      <div class="settings-section">
        <h3>🏢 Business Identity</h3>
        <p>Details displayed on your printed invoices, receipts, and client portals.</p>

        <form id="businessProfileForm" onsubmit="event.preventDefault()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Business Name <span class="required">*</span></label>
              <input type="text" id="setBusinessName" class="form-input" value="${Utils.escapeHtml(settings.businessName || '')}" placeholder="e.g. Apex Health Pharmacy, Grand Vista Hotel">
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN / Tax Registration Number</label>
              <input type="text" id="setGstin" class="form-input" value="${Utils.escapeHtml(settings.gstin || '')}" placeholder="e.g. 27AAAAA0000A1Z5">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Official Phone</label>
              <input type="tel" id="setPhone" class="form-input" value="${Utils.escapeHtml(settings.phone || '')}" placeholder="+91 98765 43210">
            </div>
            <div class="form-group">
              <label class="form-label">Official Email</label>
              <input type="email" id="setEmail" class="form-input" value="${Utils.escapeHtml(settings.email || '')}" placeholder="contact@mybusiness.com">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">UPI ID (for QR Code Payments)</label>
              <input type="text" id="setUpiId" class="form-input" value="${Utils.escapeHtml(settings.upiId || '')}" placeholder="merchant@okhdfcbank">
            </div>
            <div class="form-group">
              <label class="form-label">Website</label>
              <input type="text" id="setWebsite" class="form-input" value="${Utils.escapeHtml(settings.website || '')}" placeholder="https://mybusiness.com">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Registered Business Address</label>
            <textarea id="setAddress" class="form-textarea" rows="3" placeholder="Full address including city, state, postal code">${Utils.escapeHtml(settings.address || '')}</textarea>
          </div>

          <button class="btn btn-primary" onclick="BillFlow.Pages.Settings.saveBusinessProfile()">
            <span>💾</span> Save Business Profile
          </button>
        </form>
      </div>
    `;
  }

  if(activeSection === 'industry'){
    return `
      <div class="settings-section" style="max-width:100%">
        <h3>🧩 Universal Industry Template Selector</h3>
        <p>Switch your entire billing CRM engine. Changes terminology, line item fields, tax slabs, units, and workflows seamlessly without data loss.</p>

        <div class="industry-grid">
          ${allTemplates.map(t => {
            const isSelected = t.id === currentIndustry;
            return `
              <div class="industry-card ${isSelected ? 'selected' : ''}" onclick="BillFlow.Pages.Settings.switchIndustry('${t.id}')">
                <div class="industry-icon">${t.icon}</div>
                <div class="industry-name">${t.name}</div>
                <div class="industry-desc">${t.description}</div>
                ${isSelected ? '<span class="badge badge-primary" style="margin-top:.5rem">Active Engine</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if(activeSection === 'invoice'){
    return `
      <div class="settings-section">
        <h3>📝 Invoice Numbering & Tax Rules</h3>
        <p>Configure automated sequential invoice numbering, terms, and tax calculation mode.</p>

        <form id="invoiceConfigForm" onsubmit="event.preventDefault()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Invoice Number Prefix</label>
              <input type="text" id="setInvPrefix" class="form-input" value="${Utils.escapeHtml(settings.invoicePrefix || 'INV')}" placeholder="e.g. INV, BILL, RX">
            </div>
            <div class="form-group">
              <label class="form-label">Base Currency</label>
              <select id="setCurrency" class="form-select">
                <option value="INR" ${settings.currency==='INR'?'selected':''}>INR (₹) — Indian Rupee</option>
                <option value="USD" ${settings.currency==='USD'?'selected':''}>USD ($) — US Dollar</option>
                <option value="EUR" ${settings.currency==='EUR'?'selected':''}>EUR (€) — Euro</option>
                <option value="GBP" ${settings.currency==='GBP'?'selected':''}>GBP (£) — British Pound</option>
                <option value="AED" ${settings.currency==='AED'?'selected':''}>AED (د.إ) — UAE Dirham</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Default Invoice Notes / Greeting</label>
            <input type="text" id="setDefaultNotes" class="form-input" value="${Utils.escapeHtml(settings.defaultNotes || 'Thank you for your business!')}">
          </div>

          <div class="form-group">
            <label class="form-label">Default Terms & Conditions</label>
            <textarea id="setDefaultTerms" class="form-textarea" rows="3">${Utils.escapeHtml(settings.defaultTerms || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged after due date.\n3. Subject to local jurisdiction.')}</textarea>
          </div>

          <button class="btn btn-primary" onclick="BillFlow.Pages.Settings.saveInvoiceSettings()">
            <span>💾</span> Save Invoice Setup
          </button>
        </form>
      </div>
    `;
  }

  if(activeSection === 'theme'){
    const isDark = (settings.theme || 'dark') !== 'light';
    return `
      <div class="settings-section">
        <h3>🎨 Theme & Display Settings</h3>
        <p>Customize the visual interface appearance according to your environment.</p>

        <div style="display:flex;gap:1.5rem;margin-bottom:2rem">
          <div class="card" style="flex:1;cursor:pointer;padding:1.5rem;text-align:center;border:${isDark?'2px solid var(--primary-400)':'1px solid var(--border-primary)'}" onclick="BillFlow.Pages.Settings.setTheme('dark')">
            <div style="font-size:2rem;margin-bottom:.5rem">🌙</div>
            <div style="font-weight:700">Dark Mode (Default)</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Ultra-modern neon glassmorphic contrast</div>
          </div>

          <div class="card" style="flex:1;cursor:pointer;padding:1.5rem;text-align:center;border:${!isDark?'2px solid var(--primary-400)':'1px solid var(--border-primary)'}" onclick="BillFlow.Pages.Settings.setTheme('light')">
            <div style="font-size:2rem;margin-bottom:.5rem">☀️</div>
            <div style="font-weight:700">Light Mode</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Clean, crisp paper-white aesthetic</div>
          </div>
        </div>
      </div>
    `;
  }

  if(activeSection === 'backup'){
    return `
      <div class="settings-section">
        <h3>💾 Data Backup, Restore & Demo Seed</h3>
        <p>BillFlow Pro runs 100% offline-first inside your browser IndexedDB. Export your database anytime for safe offline storage or migration.</p>

        <div style="display:flex;flex-direction:column;gap:1.5rem">
          <div class="card" style="background:var(--bg-tertiary)">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <strong style="font-size:var(--text-base)">Backup Complete Database</strong>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">Download all customers, invoices, inventory, and settings as JSON</div>
              </div>
              <button class="btn btn-secondary" onclick="BillFlow.Pages.Settings.backupData()">
                <span>📤</span> Download Backup
              </button>
            </div>
          </div>

          <div class="card" style="background:var(--bg-tertiary)">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <strong style="font-size:var(--text-base)">Restore from JSON Backup</strong>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">Upload a previously exported BillFlow JSON backup file</div>
              </div>
              <button class="btn btn-secondary" onclick="BillFlow.Pages.Settings.restoreData()">
                <span>📥</span> Restore Backup
              </button>
            </div>
          </div>

          <div class="card" style="border:1px solid hsla(var(--hue-primary),80%,50%,.3);background:hsla(var(--hue-primary),80%,50%,.05)">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <strong style="font-size:var(--text-base);color:var(--primary-400)">Load Sample Demo Dataset</strong>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">Instantly populate realistic invoices, catalog items, and customers for ${Templates.getTemplate(currentIndustry).name}</div>
              </div>
              <button class="btn btn-primary" onclick="BillFlow.App.seedDemoData()">
                <span>⚡</span> Load Demo Data
              </button>
            </div>
          </div>

          <div class="card" style="border:1px solid hsla(0,75%,55%,.3);background:hsla(0,75%,55%,.05)">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <strong style="font-size:var(--text-base);color:var(--danger)">Reset All System Data</strong>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">Permanently wipe all records from local IndexedDB storage</div>
              </div>
              <button class="btn btn-danger" onclick="BillFlow.Pages.Settings.resetAllData()">
                <span>⚠️</span> Reset All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function setSection(sec){
  activeSection = sec;
  BillFlow.App.renderPage();
}

async function saveBusinessProfile(){
  const name = document.getElementById('setBusinessName')?.value.trim();
  if(!name){
    Notifications.warning('Validation', 'Business name is required');
    return;
  }
  await Store.saveSetting('businessName', name);
  await Store.saveSetting('gstin', document.getElementById('setGstin')?.value.trim() || '');
  await Store.saveSetting('phone', document.getElementById('setPhone')?.value.trim() || '');
  await Store.saveSetting('email', document.getElementById('setEmail')?.value.trim() || '');
  await Store.saveSetting('upiId', document.getElementById('setUpiId')?.value.trim() || '');
  await Store.saveSetting('website', document.getElementById('setWebsite')?.value.trim() || '');
  await Store.saveSetting('address', document.getElementById('setAddress')?.value.trim() || '');

  Notifications.success('Settings Saved', 'Business profile updated');
  BillFlow.App.updateBrandHeader();
}

async function switchIndustry(industryId){
  const template = Templates.getTemplate(industryId);
  await Store.saveSetting('industry', industryId);
  Notifications.success('Industry Switched', `Switched to ${template.name}`);
  BillFlow.App.renderPage();
  BillFlow.App.updateBrandHeader();
}

async function saveInvoiceSettings(){
  await Store.saveSetting('invoicePrefix', document.getElementById('setInvPrefix')?.value.trim() || 'INV');
  await Store.saveSetting('currency', document.getElementById('setCurrency')?.value || 'INR');
  await Store.saveSetting('defaultNotes', document.getElementById('setDefaultNotes')?.value || '');
  await Store.saveSetting('defaultTerms', document.getElementById('setDefaultTerms')?.value || '');
  Notifications.success('Settings Saved', 'Invoice configuration updated');
}

async function setTheme(theme){
  await Store.saveSetting('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  Notifications.info('Theme Updated', `Switched to ${theme} mode`);
  BillFlow.App.renderPage();
}

async function backupData(){
  const data = await DB.exportAll();
  Utils.exportJSON(data, `BillFlow_Backup_${Utils.today()}.json`);
  Notifications.success('Backup Created', 'All data exported to JSON file');
}

async function restoreData(){
  try {
    const data = await Utils.importJSON();
    if(!data || !data.invoices){
      Notifications.error('Invalid File', 'This file does not appear to be a valid BillFlow backup');
      return;
    }
    await DB.importAll(data);
    await Store.loadFromDB();
    Notifications.success('Restored', 'Database restored successfully');
    window.location.hash = '#dashboard';
  } catch(e) {
    Notifications.error('Restore Failed', e.message);
  }
}

async function resetAllData(){
  const ok = await Utils.confirm('DANGER: This will delete ALL invoices, customers, and items permanently. Are you absolutely certain?');
  if(!ok) return;
  await DB.clear('invoices');
  await DB.clear('customers');
  await DB.clear('items');
  await DB.clear('payments');
  await DB.clear('activities');
  await DB.clear('notifications');
  await Store.loadFromDB();
  Notifications.warning('Reset Complete', 'All local data has been cleared');
  BillFlow.App.renderPage();
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Settings = {
  render, setSection, saveBusinessProfile, switchIndustry,
  saveInvoiceSettings, setTheme, backupData, restoreData, resetAllData
};
})();
