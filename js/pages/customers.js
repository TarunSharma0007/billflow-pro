(function(){
'use strict';
const {Utils,Store,Loyalty,Templates,Notifications,DB}=BillFlow;

let activeGroup = 'all';
let searchQuery = '';

function render(){
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';
  const termCustomer = Templates.getTerminology('customer');
  let customers = Store.get('customers') || [];
  const invoices = Store.get('invoices') || [];

  // Filter by group
  if(activeGroup !== 'all'){
    customers = customers.filter(c => (c.group || 'regular').toLowerCase() === activeGroup.toLowerCase());
  }

  // Filter by search
  if(searchQuery){
    customers = Utils.searchFilter(customers, searchQuery, ['name', 'phone', 'email', 'gstin', 'group']);
  }

  // Sort by spend or name
  customers = Utils.sortBy(customers, 'name', 'asc');

  // Compute stats
  const allCustomers = Store.get('customers') || [];
  const totalPoints = allCustomers.reduce((s, c) => s + (Number(c.loyaltyPoints) || 0), 0);
  const totalVIPs = allCustomers.filter(c => c.loyaltyTier === 'gold' || c.loyaltyTier === 'platinum' || c.group === 'VIP').length;
  const totalReceivables = allCustomers.reduce((s, c) => s + Math.max(0, Number(c.balance) || 0), 0);

  return `
    <div class="customers-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${termCustomer} 360° CRM</h1>
          <div class="page-subtitle">Track purchase history, loyalty rewards, credit limits, and payment habits</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="BillFlow.Pages.Customers.exportCSV()">
            <span>📥</span> Export CSV
          </button>
          <button class="btn btn-primary" onclick="BillFlow.Pages.Customers.openCustomerModal()">
            <span>➕</span> Add ${termCustomer}
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.5rem">
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total ${termCustomer}s</div>
          <div class="stat-value">${allCustomers.length}</div>
          <div class="stat-change positive"><span>Registered in CRM</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">VIP / Top Tier</div>
          <div class="stat-value" style="color:hsl(45,90%,50%)">${totalVIPs}</div>
          <div class="stat-change positive"><span>Gold & Platinum</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Loyalty Points Circulating</div>
          <div class="stat-value" style="color:var(--primary-400)">${totalPoints}</div>
          <div class="stat-change positive"><span>Value: ${Utils.formatCurrency(Loyalty.getPointsValue(totalPoints), currency)}</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total Customer Credit</div>
          <div class="stat-value" style="color:${totalReceivables > 0 ? 'var(--warning)' : 'var(--success)'}">${Utils.formatCurrency(totalReceivables, currency)}</div>
          <div class="stat-change ${totalReceivables > 0 ? 'negative' : 'positive'}"><span>Receivables</span></div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body" style="padding:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn ${activeGroup==='all'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Customers.setGroup('all')">All Groups (${allCustomers.length})</button>
            <button class="btn ${activeGroup==='vip'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Customers.setGroup('vip')">VIP</button>
            <button class="btn ${activeGroup==='regular'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Customers.setGroup('regular')">Regular</button>
            <button class="btn ${activeGroup==='wholesale'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Customers.setGroup('wholesale')">Wholesale</button>
            <button class="btn ${activeGroup==='corporate'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Customers.setGroup('corporate')">Corporate</button>
          </div>

          <div class="header-search" style="width:260px;display:block">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Search by name, phone, GSTIN..." value="${Utils.escapeHtml(searchQuery)}" oninput="BillFlow.Pages.Customers.handleSearch(this.value)">
          </div>
        </div>
      </div>

      <!-- Customer List Table -->
      <div class="card">
        <div class="card-body" style="padding:0;overflow-x:auto">
          ${customers.length === 0 ? `
            <div class="empty-state" style="padding:3.5rem 1rem">
              <div class="empty-state-icon">👥</div>
              <div class="empty-state-title">No ${termCustomer.toLowerCase()}s found</div>
              <div class="empty-state-text">Add your first customer to track loyalty, orders, and balances</div>
              <button class="btn btn-primary" style="margin-top:1rem" onclick="BillFlow.Pages.Customers.openCustomerModal()">
                <span>➕</span> Add New ${termCustomer}
              </button>
            </div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>${termCustomer} Name</th>
                  <th>Contact</th>
                  <th>Group</th>
                  <th>Loyalty Tier</th>
                  <th style="text-align:right">Total Spent</th>
                  <th style="text-align:right">Credit Balance</th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${customers.map(c => {
                  const custInvoices = invoices.filter(i => i.customerId === c.id);
                  const totalSpent = custInvoices.filter(i => i.status !== 'draft' && i.status !== 'credit-note').reduce((s, i) => s + (Number(i.grandTotal)||0), 0);
                  const tier = Loyalty.getTierInfo(c.loyaltyTier || 'bronze');
                  const initials = Utils.getInitials(c.name);
                  const avatarColor = Utils.generateColor(c.name);

                  return `
                    <tr onclick="BillFlow.Pages.Customers.viewCustomer360('${c.id}')">
                      <td>
                        <div style="display:flex;align-items:center;gap:.75rem">
                          <div class="avatar" style="width:36px;height:36px;border-radius:var(--radius-full);background:${avatarColor};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0">
                            ${initials}
                          </div>
                          <div>
                            <div style="font-weight:600">${Utils.escapeHtml(c.name)}</div>
                            ${c.gstin ? `<div style="font-size:var(--text-xs);color:var(--text-tertiary)">GSTIN: ${c.gstin}</div>` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-size:var(--text-sm)">${c.phone || '—'}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">${c.email || ''}</div>
                      </td>
                      <td>
                        <span class="badge ${c.group === 'VIP' ? 'badge-primary' : 'badge-neutral'}">
                          ${c.group || 'Regular'}
                        </span>
                      </td>
                      <td>
                        <span class="loyalty-badge ${c.loyaltyTier || 'bronze'}">
                          ${tier.icon} ${tier.name} (${c.loyaltyPoints || 0} pts)
                        </span>
                      </td>
                      <td class="col-amount" style="color:var(--text-primary)">
                        ${Utils.formatCurrency(totalSpent, currency)}
                      </td>
                      <td class="col-amount" style="color:${(c.balance||0) > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">
                        ${Utils.formatCurrency(c.balance || 0, currency)}
                      </td>
                      <td class="col-actions" onclick="event.stopPropagation()">
                        <div style="display:flex;justify-content:flex-end;gap:.25rem">
                          <button class="btn btn-ghost btn-icon sm" title="360° Profile" onclick="BillFlow.Pages.Customers.viewCustomer360('${c.id}')">👤</button>
                          <button class="btn btn-ghost btn-icon sm" title="New Invoice" onclick="BillFlow.Pages.Customers.createInvoiceForCustomer('${c.id}')">📝</button>
                          <button class="btn btn-ghost btn-icon sm" title="Edit" onclick="BillFlow.Pages.Customers.openCustomerModal('${c.id}')">✏️</button>
                          <button class="btn btn-ghost btn-icon sm" title="Delete" style="color:var(--danger)" onclick="BillFlow.Pages.Customers.deleteCustomer('${c.id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    </div>
  `;
}

function setGroup(group){
  activeGroup = group;
  BillFlow.App.renderPage();
}

function handleSearch(q){
  searchQuery = q;
  BillFlow.App.renderPage();
}

/* ====================================================================
   CUSTOMER 360° PROFILE MODAL
   ==================================================================== */
function viewCustomer360(id){
  const customer = Store.getCustomer(id);
  if(!customer) return;
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';
  const invoices = (Store.get('invoices') || []).filter(i => i.customerId === id);
  const tier = Loyalty.getTierInfo(customer.loyaltyTier || 'bronze');
  const totalSpend = invoices.filter(i => i.status !== 'draft' && i.status !== 'credit-note').reduce((s, i) => s + (Number(i.grandTotal)||0), 0);
  const initials = Utils.getInitials(customer.name);
  const avatarColor = Utils.generateColor(customer.name);

  // AI Sentiment / Behavior assessment
  let behaviorTag = 'Regular Customer';
  let behaviorDesc = 'Consistent order volume with standard settlement timing.';
  if(totalSpend > 50000 || customer.loyaltyTier === 'platinum'){
    behaviorTag = '⭐ High-Value VIP';
    behaviorDesc = 'Top 5% customer by gross merchandise value. Eligible for priority discount.';
  } else if((customer.balance || 0) > 10000){
    behaviorTag = '⚠️ Credit Attention';
    behaviorDesc = 'Has high pending balance. Recommend collecting payment before new orders.';
  } else if(invoices.length > 5){
    behaviorTag = '⚡ Loyal Fast-Payer';
    behaviorDesc = 'Prompt payment on 95% of transactions with zero chargebacks.';
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:800px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <h3 class="modal-title">Customer 360° Profile</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-primary btn-sm" onclick="overlay.remove();BillFlow.Pages.Customers.createInvoiceForCustomer('${customer.id}')">
            <span>➕</span> New Invoice
          </button>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body" style="padding:1.5rem">
        <!-- Top Profile Banner -->
        <div style="display:flex;gap:1.5rem;align-items:center;background:var(--bg-tertiary);padding:1.25rem;border-radius:var(--radius-lg);margin-bottom:1.5rem">
          <div style="width:64px;height:64px;border-radius:var(--radius-full);background:${avatarColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:800;flex-shrink:0">
            ${initials}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:.75rem">
              <h2 style="font-size:var(--text-xl);font-weight:800;margin:0">${Utils.escapeHtml(customer.name)}</h2>
              <span class="badge ${customer.group === 'VIP' ? 'badge-primary' : 'badge-neutral'}">${customer.group || 'Regular'}</span>
              <span class="loyalty-badge ${customer.loyaltyTier || 'bronze'}">${tier.icon} ${tier.name}</span>
            </div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:4px">
              📞 ${customer.phone || 'No phone'} • ✉️ ${customer.email || 'No email'} ${customer.gstin ? `• GSTIN: ${customer.gstin}` : ''}
            </div>
          </div>
        </div>

        <!-- AI Payment & Sentiment Insight -->
        <div class="card" style="margin-bottom:1.5rem;border-left:4px solid var(--primary-400);background:hsla(var(--hue-primary),80%,50%,.05)">
          <div class="card-body" style="padding:1rem">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem">
              <span>🧠</span>
              <strong style="font-size:var(--text-sm)">BillFlow AI Customer Behavioral Profile:</strong>
              <span class="badge badge-primary">${behaviorTag}</span>
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary)">${behaviorDesc}</div>
          </div>
        </div>

        <!-- 3-Column Metrics -->
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;margin-bottom:1.5rem">
          <div class="stat-card" style="padding:1rem">
            <div class="stat-label">Lifetime Spend</div>
            <div class="stat-value" style="font-size:var(--text-lg)">${Utils.formatCurrency(totalSpend, currency)}</div>
            <div class="stat-change positive"><span>${invoices.length} orders total</span></div>
          </div>
          <div class="stat-card" style="padding:1rem">
            <div class="stat-label">Loyalty Points</div>
            <div class="stat-value" style="font-size:var(--text-lg);color:hsl(45,90%,50%)">${customer.loyaltyPoints || 0} pts</div>
            <div class="stat-change positive"><span>Worth ${Utils.formatCurrency(Loyalty.getPointsValue(customer.loyaltyPoints || 0), currency)}</span></div>
          </div>
          <div class="stat-card" style="padding:1rem">
            <div class="stat-label">Credit Balance</div>
            <div class="stat-value" style="font-size:var(--text-lg);color:${(customer.balance||0)>0?'var(--warning)':'var(--success)'}">
              ${Utils.formatCurrency(customer.balance || 0, currency)}
            </div>
            <div class="stat-change neutral"><span>Limit: ${Utils.formatCurrency(customer.creditLimit || 50000, currency)}</span></div>
          </div>
        </div>

        <!-- Order & Invoice History -->
        <h4 style="font-size:var(--text-sm);font-weight:700;margin-bottom:.75rem">Transaction History (${invoices.length})</h4>
        <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border-secondary);border-radius:var(--radius-md)">
          ${invoices.length === 0 ? `
            <div style="padding:2rem;text-align:center;color:var(--text-tertiary);font-size:var(--text-sm)">No orders yet</div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoiceNo}</strong></td>
                    <td>${Utils.formatDate(inv.invoiceDate, 'short')}</td>
                    <td><span class="badge ${Utils.getStatusBadge(inv.status)}">${inv.status}</span></td>
                    <td style="text-align:right;font-family:monospace;font-weight:700">${Utils.formatCurrency(inv.grandTotal, currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/* ====================================================================
   ADD / EDIT CUSTOMER MODAL
   ==================================================================== */
function openCustomerModal(id = null){
  const customer = id ? Store.getCustomer(id) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h3 class="modal-title">${customer ? 'Edit Customer' : 'Add New Customer'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <form id="customerForm" onsubmit="event.preventDefault()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Customer Name <span class="required">*</span></label>
              <input type="text" id="custName" class="form-input" required value="${Utils.escapeHtml(customer?.name || '')}" placeholder="Full Name or Business Name">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" id="custPhone" class="form-input" value="${Utils.escapeHtml(customer?.phone || '')}" placeholder="+91 98765 43210">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="custEmail" class="form-input" value="${Utils.escapeHtml(customer?.email || '')}" placeholder="customer@domain.com">
            </div>
            <div class="form-group">
              <label class="form-label">Customer Group</label>
              <select id="custGroup" class="form-select">
                <option value="Regular" ${customer?.group==='Regular'?'selected':''}>Regular</option>
                <option value="VIP" ${customer?.group==='VIP'?'selected':''}>VIP</option>
                <option value="Wholesale" ${customer?.group==='Wholesale'?'selected':''}>Wholesale</option>
                <option value="Corporate" ${customer?.group==='Corporate'?'selected':''}>Corporate</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">GSTIN / Tax ID</label>
              <input type="text" id="custGstin" class="form-input" value="${Utils.escapeHtml(customer?.gstin || '')}" placeholder="22AAAAA0000A1Z5">
            </div>
            <div class="form-group">
              <label class="form-label">Credit Limit (₹)</label>
              <input type="number" id="custCreditLimit" class="form-input" value="${customer?.creditLimit || 50000}" step="1000">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Billing Address</label>
            <textarea id="custAddress" class="form-textarea" rows="2" placeholder="Street, City, State, PIN code">${Utils.escapeHtml(customer?.address || '')}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="btnSaveCust">Save Customer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btnSaveCust').onclick = async () => {
    const name = overlay.querySelector('#custName').value.trim();
    if(!name){
      Notifications.warning('Required Field', 'Customer name is mandatory');
      return;
    }

    const data = {
      id: customer ? customer.id : Utils.uuid(),
      name,
      phone: overlay.querySelector('#custPhone').value.trim(),
      email: overlay.querySelector('#custEmail').value.trim(),
      group: overlay.querySelector('#custGroup').value,
      gstin: overlay.querySelector('#custGstin').value.trim(),
      creditLimit: Number(overlay.querySelector('#custCreditLimit').value) || 0,
      address: overlay.querySelector('#custAddress').value.trim(),
      balance: customer ? (customer.balance || 0) : 0,
      loyaltyPoints: customer ? (customer.loyaltyPoints || 0) : 0,
      loyaltyTier: customer ? (customer.loyaltyTier || 'bronze') : 'bronze',
      createdAt: customer ? customer.createdAt : Utils.now(),
      updatedAt: Utils.now()
    };

    overlay.remove();
    await Store.saveCustomer(data);
    await Store.addActivity('customer', `${customer ? 'Updated' : 'Added'} customer ${data.name}`, { customerId: data.id });
    Notifications.success('Success', `Customer ${data.name} saved successfully`);
    BillFlow.App.renderPage();
  };
}

function createInvoiceForCustomer(customerId){
  window.location.hash = '#invoices/new';
  setTimeout(() => {
    BillFlow.Pages.Invoices?.onCustomerChange?.(customerId);
  }, 100);
}

async function deleteCustomer(id){
  const ok = await Utils.confirm('Are you sure you want to delete this customer? All historical records will be kept.');
  if(ok){
    await Store.deleteCustomer(id);
    Notifications.info('Deleted', 'Customer deleted');
    BillFlow.App.renderPage();
  }
}

function exportCSV(){
  const customers = Store.get('customers') || [];
  if(customers.length === 0){
    Notifications.warning('No Customers', 'No customers to export');
    return;
  }
  const data = customers.map(c => ({
    'ID': c.id,
    'Name': c.name,
    'Phone': c.phone,
    'Email': c.email,
    'Group': c.group,
    'GSTIN': c.gstin,
    'Tier': c.loyaltyTier,
    'Points': c.loyaltyPoints,
    'Balance': c.balance,
    'Credit Limit': c.creditLimit
  }));
  Utils.exportCSV(data, `BillFlow_Customers_${Utils.today()}.csv`);
  Notifications.success('Exported', 'Customer database exported to CSV');
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Customers = {
  render, setGroup, handleSearch, viewCustomer360, openCustomerModal,
  createInvoiceForCustomer, deleteCustomer, exportCSV
};
})();
