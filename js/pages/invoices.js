(function(){
'use strict';
const {Utils,Store,TaxEngine,BillingEngine,Loyalty,PDFGenerator,Templates,Notifications,DB}=BillFlow;

let activeTab = 'all';
let searchQuery = '';
let currentInvoiceData = null; // for form state

function render(subRoute, param){
  if(subRoute === 'new'){
    return renderEditor();
  } else if(subRoute === 'edit' && param){
    const invoice = Store.getInvoice(param);
    if(!invoice){
      Notifications.error('Error', 'Invoice not found');
      window.location.hash = '#invoices';
      return '';
    }
    return renderEditor(invoice);
  }
  return renderList();
}

function renderList(){
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';
  const termInvoice = Templates.getTerminology('invoice');
  const termCustomer = Templates.getTerminology('customer');
  let invoices = Store.get('invoices') || [];

  // Filter by tab
  if(activeTab === 'paid') invoices = invoices.filter(i => i.status === 'paid');
  else if(activeTab === 'unpaid') invoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partial');
  else if(activeTab === 'draft') invoices = invoices.filter(i => i.status === 'draft');
  else if(activeTab === 'credit-notes') invoices = invoices.filter(i => i.status === 'credit-note');

  // Search filter
  if(searchQuery){
    invoices = Utils.searchFilter(invoices, searchQuery, ['invoiceNo', 'customerName', 'invoiceDate', 'paymentMode']);
  }

  // Sort newest first
  invoices = Utils.sortBy(invoices, 'createdAt', 'desc');

  // Compute summary stats
  const allInvoices = Store.get('invoices') || [];
  const totalBilled = allInvoices.filter(i => i.status !== 'draft' && i.status !== 'credit-note').reduce((s, i) => s + (Number(i.grandTotal)||0), 0);
  const totalCollected = allInvoices.reduce((s, i) => s + (Number(i.amountPaid)||0), 0);
  const totalPending = Math.max(0, totalBilled - totalCollected);

  return `
    <div class="invoices-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${termInvoice}s & Billing</h1>
          <div class="page-subtitle">Create, monitor, collect payments, and manage invoices</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="BillFlow.Pages.Invoices.exportInvoicesCSV()">
            <span>📥</span> Export CSV
          </button>
          <button class="btn btn-primary" onclick="window.location.hash='#invoices/new'">
            <span>➕</span> Create ${termInvoice}
          </button>
        </div>
      </div>

      <!-- Quick KPI Cards -->
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.5rem">
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total Invoiced</div>
          <div class="stat-value" style="font-size:var(--text-xl)">${Utils.formatCurrency(totalBilled, currency)}</div>
          <div class="stat-change positive"><span>${allInvoices.length} total records</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total Collected</div>
          <div class="stat-value" style="font-size:var(--text-xl);color:var(--success)">${Utils.formatCurrency(totalCollected, currency)}</div>
          <div class="stat-change positive"><span>Received in cash, UPI & card</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Outstanding Receivables</div>
          <div class="stat-value" style="font-size:var(--text-xl);color:${totalPending>0?'var(--warning)':'var(--success)'}">${Utils.formatCurrency(totalPending, currency)}</div>
          <div class="stat-change ${totalPending>0?'negative':'positive'}"><span>Unpaid balance</span></div>
        </div>
      </div>

      <!-- Controls & Tabs -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body" style="padding:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn ${activeTab==='all'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Invoices.setTab('all')">All Invoices (${allInvoices.length})</button>
            <button class="btn ${activeTab==='paid'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Invoices.setTab('paid')">Paid</button>
            <button class="btn ${activeTab==='unpaid'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Invoices.setTab('unpaid')">Unpaid / Due</button>
            <button class="btn ${activeTab==='draft'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Invoices.setTab('draft')">Drafts</button>
            <button class="btn ${activeTab==='credit-notes'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Invoices.setTab('credit-notes')">Credit Notes</button>
          </div>

          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="header-search" style="width:240px;display:block">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search invoices..." value="${Utils.escapeHtml(searchQuery)}" oninput="BillFlow.Pages.Invoices.handleSearch(this.value)">
            </div>
          </div>
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="card">
        <div class="card-body" style="padding:0;overflow-x:auto">
          ${invoices.length === 0 ? `
            <div class="empty-state" style="padding:3.5rem 1rem">
              <div class="empty-state-icon">📋</div>
              <div class="empty-state-title">No ${termInvoice.toLowerCase()}s found</div>
              <div class="empty-state-text">Create your first invoice or try another filter</div>
              <button class="btn btn-primary" style="margin-top:1rem" onclick="window.location.hash='#invoices/new'">
                <span>➕</span> Create New ${termInvoice}
              </button>
            </div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>${termInvoice} #</th>
                  <th>Date</th>
                  <th>${termCustomer}</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th style="text-align:right">Total Amount</th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => {
                  const statusBadge = Utils.getStatusBadge(inv.status);
                  const isCreditNote = inv.status === 'credit-note';
                  return `
                    <tr onclick="BillFlow.Pages.Invoices.viewInvoiceModal('${inv.id}')">
                      <td>
                        <strong style="color:var(--primary-400)">${inv.invoiceNo}</strong>
                      </td>
                      <td>${Utils.formatDate(inv.invoiceDate, 'short')}</td>
                      <td>
                        <div style="font-weight:600">${Utils.escapeHtml(inv.customerName || 'Walk-in')}</div>
                        ${inv.customerId ? `<span style="font-size:var(--text-xs);color:var(--text-tertiary)">ID: ${inv.customerId.substring(0,8)}</span>` : ''}
                      </td>
                      <td>${(inv.items||[]).length} items</td>
                      <td>
                        <span style="text-transform:uppercase;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary)">
                          ${inv.paymentMode || 'CASH'}
                        </span>
                      </td>
                      <td class="col-status">
                        <span class="badge ${statusBadge}">${inv.status}</span>
                      </td>
                      <td class="col-amount" style="color:${isCreditNote ? 'var(--danger)' : 'var(--text-primary)'}">
                        ${Utils.formatCurrency(inv.grandTotal, currency)}
                      </td>
                      <td class="col-actions" onclick="event.stopPropagation()">
                        <div style="display:flex;justify-content:flex-end;gap:.25rem">
                          <button class="btn btn-ghost btn-icon sm" title="Quick View" onclick="BillFlow.Pages.Invoices.viewInvoiceModal('${inv.id}')">👁️</button>
                          <button class="btn btn-ghost btn-icon sm" title="Download PDF" onclick="BillFlow.Pages.Invoices.downloadPDF('${inv.id}')">📄</button>
                          <button class="btn btn-ghost btn-icon sm" title="Print" onclick="BillFlow.Pages.Invoices.printInvoice('${inv.id}')">🖨️</button>
                          ${inv.status !== 'paid' && inv.status !== 'credit-note' ? `
                            <button class="btn btn-ghost btn-icon sm" title="Record Payment" onclick="BillFlow.Pages.Invoices.openPaymentModal('${inv.id}')">💰</button>
                          ` : ''}
                          ${inv.status === 'paid' ? `
                            <button class="btn btn-ghost btn-icon sm" title="Issue Credit Note" onclick="BillFlow.Pages.Invoices.openCreditNoteModal('${inv.id}')">↩️</button>
                          ` : ''}
                          <button class="btn btn-ghost btn-icon sm" title="Delete" style="color:var(--danger)" onclick="BillFlow.Pages.Invoices.deleteInvoice('${inv.id}')">🗑️</button>
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

/* ====================================================================
   INVOICE EDITOR / CREATOR FORM
   ==================================================================== */
function renderEditor(existingInvoice = null){
  const settings = Store.get('settings')||{};
  const industry = settings.industry || 'retail';
  const template = Templates.getTemplate(industry);
  const currency = settings.currency || 'INR';
  const customers = Store.get('customers') || [];
  const inventoryItems = Store.get('items') || [];
  const termCustomer = Templates.getTerminology('customer');
  const termItem = Templates.getTerminology('item');
  const termInvoice = Templates.getTerminology('invoice');

  // Initialize or restore state
  if(!currentInvoiceData || (existingInvoice && currentInvoiceData.id !== existingInvoice.id)){
    currentInvoiceData = existingInvoice ? Utils.deepClone(existingInvoice) : {
      id: null,
      customerId: '',
      customerName: '',
      invoiceDate: Utils.today(),
      dueDate: Utils.today(),
      paymentMode: 'cash',
      amountPaid: 0,
      notes: 'Thank you for your business!',
      terms: 'Payment due within 15 days of invoice date.',
      invoiceDiscount: { percent: 0, amount: 0 },
      items: [
        {
          id: Utils.uuid(),
          itemId: '',
          name: '',
          quantity: 1,
          price: 0,
          unit: template.defaultUnits?.[0] || 'pcs',
          taxRate: template.taxRules?.categories?.[0]?.rate || 0,
          discountPercent: 0,
          meta: {}
        }
      ]
    };
  }

  const totals = TaxEngine.calculateInvoiceTotals(currentInvoiceData.items, currentInvoiceData.invoiceDiscount);
  const suggestions = currentInvoiceData.customerId ? BillingEngine.suggestItems(currentInvoiceData.customerId) : [];
  const duplicate = BillingEngine.detectDuplicate(currentInvoiceData);

  return `
    <div class="invoice-editor-page">
      <div class="page-header">
        <div class="page-header-left">
          <div style="display:flex;align-items:center;gap:.75rem">
            <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#invoices'">← Back to Invoices</button>
            <h1 class="page-title">${existingInvoice ? `Edit ${termInvoice} ${existingInvoice.invoiceNo}` : `New ${termInvoice}`}</h1>
          </div>
          <div class="page-subtitle">Configure items, taxes, discounts, and payment for ${template.name}</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="BillFlow.Pages.Invoices.saveDraft()">Save Draft</button>
          <button class="btn btn-primary" onclick="BillFlow.Pages.Invoices.submitInvoice()">
            <span>💾</span> Finalize & Generate ${termInvoice}
          </button>
        </div>
      </div>

      <!-- Duplicate Invoice Warning -->
      ${duplicate ? `
        <div class="card" style="margin-bottom:1.5rem;border-left:4px solid var(--warning);background:hsla(38,95%,55%,.08)">
          <div class="card-body" style="padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span>⚠️</span>
              <span style="font-size:var(--text-sm);font-weight:600">Possible Duplicate: A similar invoice (${duplicate.invoiceNo} for ${Utils.formatCurrency(duplicate.grandTotal)}) was created recently for this ${termCustomer.toLowerCase()}.</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">Dismiss</button>
          </div>
        </div>
      ` : ''}

      <div class="invoice-form">
        <!-- Main Form Column -->
        <div class="invoice-form-main">
          <!-- Customer Selection Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">👤 ${termCustomer} Information</h3>
              <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.openCustomerModal()">+ New ${termCustomer}</button>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Select ${termCustomer}</label>
                  <select class="form-select" id="invoiceCustomerSelect" onchange="BillFlow.Pages.Invoices.onCustomerChange(this.value)">
                    <option value="">Walk-in ${termCustomer}</option>
                    ${customers.map(c => `
                      <option value="${c.id}" ${currentInvoiceData.customerId === c.id ? 'selected' : ''}>
                        ${Utils.escapeHtml(c.name)} (${c.phone || 'No phone'}) - ${c.loyaltyTier || 'bronze'}
                      </option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">${termCustomer} Display Name</label>
                  <input type="text" class="form-input" id="invoiceCustomerName" value="${Utils.escapeHtml(currentInvoiceData.customerName || 'Walk-in Customer')}" oninput="BillFlow.Pages.Invoices.onCustomerNameInput(this.value)">
                </div>
              </div>

              <!-- Customer Loyalty Banner if selected -->
              ${(() => {
                if(!currentInvoiceData.customerId) return '';
                const cust = Store.getCustomer(currentInvoiceData.customerId);
                if(!cust) return '';
                const tier = Loyalty.getTierInfo(cust.loyaltyTier || 'bronze');
                return `
                  <div style="background:var(--bg-tertiary);border-radius:var(--radius-md);padding:.75rem 1rem;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-secondary)">
                    <div style="display:flex;align-items:center;gap:.75rem">
                      <span class="loyalty-badge ${cust.loyaltyTier || 'bronze'}">${tier.icon} ${tier.name}</span>
                      <span style="font-size:var(--text-sm)">Available Points: <strong>${cust.loyaltyPoints || 0}</strong> (Value: ${Utils.formatCurrency(Loyalty.getPointsValue(cust.loyaltyPoints || 0))})</span>
                    </div>
                    ${(cust.loyaltyPoints || 0) > 50 ? `
                      <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.redeemPoints(${cust.loyaltyPoints})">Redeem Points</button>
                    ` : ''}
                  </div>
                `;
              })()}
            </div>
          </div>

          <!-- AI Suggestions Banner if customer selected -->
          ${suggestions.length > 0 ? `
            <div class="card" style="border:1px solid hsla(var(--hue-primary),80%,50%,.3);background:hsla(var(--hue-primary),80%,50%,.04)">
              <div class="card-body" style="padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
                <div style="display:flex;align-items:center;gap:.5rem">
                  <span>🧠</span>
                  <span style="font-size:var(--text-xs);font-weight:600">AI Recommends for ${currentInvoiceData.customerName}:</span>
                </div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  ${suggestions.map(s => `
                    <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.addSuggestedItem('${s.itemId||s.name}', '${Utils.escapeHtml(s.name)}', ${s.price}, ${s.taxRate||0})">
                      + ${Utils.escapeHtml(s.name)} (${Utils.formatCurrency(s.price)})
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Line Items Section -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📦 ${termItem}s & Charges</h3>
              <div style="display:flex;gap:.5rem">
                <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.openBarcodeScanner()">📷 Scan Barcode</button>
                <button class="btn btn-primary btn-sm" onclick="BillFlow.Pages.Invoices.addLineItem()">+ Add Line</button>
              </div>
            </div>
            <div class="card-body" style="padding:0">
              <div class="invoice-items-header">
                <div>${termItem} Description</div>
                <div>Qty / Unit</div>
                <div>Price (${currency})</div>
                <div>Tax %</div>
                <div style="text-align:right">Total</div>
                <div></div>
              </div>

              <div id="invoiceItemsContainer">
                ${currentInvoiceData.items.map((item, idx) => {
                  const lineCalc = TaxEngine.calculateLineItem(item);
                  return `
                    <div class="invoice-item-row" data-index="${idx}">
                      <!-- Item Name & autocomplete select -->
                      <div>
                        <input type="text" list="inventoryDatalist" class="form-input" placeholder="Select or type ${termItem.toLowerCase()}..." value="${Utils.escapeHtml(item.name)}" oninput="BillFlow.Pages.Invoices.onItemNameInput(${idx}, this.value)">
                        <!-- Dynamic Industry Fields -->
                        ${template.itemFields && template.itemFields.length > 0 ? `
                          <div style="display:flex;gap:.35rem;margin-top:4px;flex-wrap:wrap">
                            ${template.itemFields.map(f => `
                              <input type="${f.type === 'date' ? 'date' : 'text'}" 
                                class="form-input" 
                                style="font-size:11px;padding:2px 6px;width:auto;flex:1;min-width:90px" 
                                placeholder="${f.label}" 
                                value="${Utils.escapeHtml(item.meta?.[f.key] || '')}"
                                onchange="BillFlow.Pages.Invoices.onItemMetaInput(${idx}, '${f.key}', this.value)">
                            `).join('')}
                          </div>
                        ` : ''}
                      </div>

                      <!-- Qty & Unit -->
                      <div style="display:flex;gap:2px">
                        <input type="number" min="0.01" step="any" class="form-input" value="${item.quantity}" oninput="BillFlow.Pages.Invoices.onItemChange(${idx}, 'quantity', this.value)">
                      </div>

                      <!-- Price -->
                      <div>
                        <input type="number" min="0" step="any" class="form-input" value="${item.price}" oninput="BillFlow.Pages.Invoices.onItemChange(${idx}, 'price', this.value)">
                      </div>

                      <!-- Tax % -->
                      <div>
                        <select class="form-select" style="padding:4px 6px;font-size:12px" onchange="BillFlow.Pages.Invoices.onItemChange(${idx}, 'taxRate', this.value)">
                          ${(template.taxRules?.categories || [{name:'Standard',rate:18},{name:'Zero',rate:0}]).map(c => `
                            <option value="${c.rate}" ${Number(item.taxRate) === c.rate ? 'selected' : ''}>${c.rate}% (${c.name})</option>
                          `).join('')}
                        </select>
                      </div>

                      <!-- Calculated Line Total -->
                      <div style="text-align:right;font-family:var(--font-mono);font-weight:700">
                        ${Utils.formatCurrency(lineCalc.total, currency)}
                      </div>

                      <!-- Remove Action -->
                      <div>
                        <button class="remove-item" onclick="BillFlow.Pages.Invoices.removeLineItem(${idx})" title="Remove">✕</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Datalist for inventory instant lookup -->
              <datalist id="inventoryDatalist">
                ${inventoryItems.map(i => `
                  <option value="${Utils.escapeHtml(i.name)}">${Utils.formatCurrency(i.sellingPrice)} (Stock: ${i.currentStock})</option>
                `).join('')}
              </datalist>

              <div style="padding:1rem">
                <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.addLineItem()">+ Add Another Line Item</button>
              </div>
            </div>
          </div>

          <!-- Notes & Terms -->
          <div class="card">
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Notes for ${termCustomer}</label>
                  <textarea class="form-textarea" rows="2" oninput="BillFlow.Pages.Invoices.onFieldChange('notes', this.value)">${Utils.escapeHtml(currentInvoiceData.notes || '')}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Terms & Conditions</label>
                  <textarea class="form-textarea" rows="2" oninput="BillFlow.Pages.Invoices.onFieldChange('terms', this.value)">${Utils.escapeHtml(currentInvoiceData.terms || '')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Calculation Column -->
        <div class="invoice-form-sidebar">
          <!-- Dates Card -->
          <div class="card">
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">${termInvoice} Date</label>
                <input type="date" class="form-input" value="${currentInvoiceData.invoiceDate}" onchange="BillFlow.Pages.Invoices.onFieldChange('invoiceDate', this.value)">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Payment Due Date</label>
                <input type="date" class="form-input" value="${currentInvoiceData.dueDate || currentInvoiceData.invoiceDate}" onchange="BillFlow.Pages.Invoices.onFieldChange('dueDate', this.value)">
              </div>
            </div>
          </div>

          <!-- Payment Mode -->
          <div class="card">
            <div class="card-header"><h3 class="card-title">💳 Payment Method</h3></div>
            <div class="card-body">
              <div class="payment-mode-grid" style="margin-bottom:1rem">
                ${['cash', 'upi', 'card', 'credit'].map(m => `
                  <button type="button" class="payment-mode-btn ${currentInvoiceData.paymentMode === m ? 'active' : ''}" onclick="BillFlow.Pages.Invoices.setPaymentMode('${m}')">
                    ${m === 'cash' ? '💵 Cash' : m === 'upi' ? '📱 UPI / QR' : m === 'card' ? '💳 Card' : '⏳ Credit'}
                  </button>
                `).join('')}
              </div>

              <!-- UPI QR Code Simulator -->
              ${currentInvoiceData.paymentMode === 'upi' ? `
                <div style="background:var(--bg-tertiary);padding:.75rem;border-radius:var(--radius-md);text-align:center;border:1px dashed var(--border-primary);margin-bottom:1rem">
                  <div style="font-size:2rem;margin-bottom:.25rem">📱🏁</div>
                  <div style="font-size:var(--text-xs);font-weight:600">Scan UPI QR to Pay</div>
                  <div style="font-size:var(--text-xs);color:var(--text-tertiary)">UPI ID: ${settings.upiId || 'merchant@upi'}</div>
                </div>
              ` : ''}

              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Amount Paid</label>
                <input type="number" step="any" class="form-input" value="${currentInvoiceData.amountPaid !== undefined ? currentInvoiceData.amountPaid : totals.grandTotal}" oninput="BillFlow.Pages.Invoices.onFieldChange('amountPaid', Number(this.value))">
                <span class="form-hint">Leave full to mark as Paid, 0 for Unpaid/Credit</span>
              </div>
            </div>
          </div>

          <!-- Invoice Summary -->
          <div class="invoice-summary">
            <div class="summary-row">
              <span class="label">Subtotal</span>
              <span class="value">${Utils.formatCurrency(totals.subtotal, currency)}</span>
            </div>

            <!-- Invoice Level Discount -->
            <div class="summary-row" style="align-items:center">
              <span class="label">Discount</span>
              <div style="display:flex;gap:4px;width:120px">
                <input type="number" min="0" max="100" class="form-input" style="padding:2px 6px;font-size:12px;text-align:right" placeholder="%" value="${currentInvoiceData.invoiceDiscount?.percent || ''}" oninput="BillFlow.Pages.Invoices.onDiscountChange('percent', this.value)">
                <span style="font-size:12px;display:flex;align-items:center">%</span>
              </div>
            </div>

            ${totals.invoiceDiscount > 0 ? `
              <div class="summary-row" style="color:var(--success)">
                <span class="label">Discount Applied</span>
                <span class="value">- ${Utils.formatCurrency(totals.invoiceDiscount, currency)}</span>
              </div>
            ` : ''}

            <!-- Tax Breakdown -->
            <div class="summary-row">
              <span class="label">Tax (${template.taxRules?.type || 'GST'})</span>
              <span class="value">${Utils.formatCurrency(totals.taxAmount, currency)}</span>
            </div>

            ${totals.taxBreakdown.map(t => `
              <div class="summary-row" style="font-size:var(--text-xs);color:var(--text-tertiary);padding:1px 0">
                <span class="label" style="padding-left:.5rem">Tax @ ${t.rate}%</span>
                <span class="value">${Utils.formatCurrency(t.tax, currency)}</span>
              </div>
            `).join('')}

            ${totals.roundOff !== 0 ? `
              <div class="summary-row" style="font-size:var(--text-xs);color:var(--text-tertiary)">
                <span class="label">Round Off</span>
                <span class="value">${totals.roundOff > 0 ? '+' : ''}${Utils.formatCurrency(totals.roundOff, currency)}</span>
              </div>
            ` : ''}

            <div class="summary-row total">
              <span class="label">Grand Total</span>
              <span class="value" style="color:var(--primary-400)">${Utils.formatCurrency(totals.grandTotal, currency)}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <button class="btn btn-primary btn-lg" style="width:100%" onclick="BillFlow.Pages.Invoices.submitInvoice()">
            <span>💾</span> Finalize & Generate ${termInvoice}
          </button>
          <button class="btn btn-secondary" style="width:100%" onclick="BillFlow.Pages.Invoices.saveDraft()">
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ====================================================================
   ACTIONS & EVENT HANDLERS
   ==================================================================== */
function setTab(tab){
  activeTab = tab;
  BillFlow.App.renderPage();
}

function handleSearch(q){
  searchQuery = q;
  BillFlow.App.renderPage();
}

function addLineItem(){
  if(!currentInvoiceData) return;
  const settings = Store.get('settings')||{};
  const template = Templates.getTemplate(settings.industry || 'retail');
  currentInvoiceData.items.push({
    id: Utils.uuid(),
    itemId: '',
    name: '',
    quantity: 1,
    price: 0,
    unit: template.defaultUnits?.[0] || 'pcs',
    taxRate: template.taxRules?.categories?.[0]?.rate || 0,
    discountPercent: 0,
    meta: {}
  });
  BillFlow.App.renderPage();
}

function removeLineItem(idx){
  if(!currentInvoiceData || currentInvoiceData.items.length <= 1) {
    Notifications.warning('Item Required', 'An invoice must have at least one line item');
    return;
  }
  currentInvoiceData.items.splice(idx, 1);
  BillFlow.App.renderPage();
}

function onItemNameInput(idx, name){
  if(!currentInvoiceData || !currentInvoiceData.items[idx]) return;
  const item = currentInvoiceData.items[idx];
  item.name = name;

  // Check if matched with existing inventory item
  const inventoryItems = Store.get('items') || [];
  const matched = inventoryItems.find(i => i.name.toLowerCase() === name.toLowerCase());
  if(matched){
    item.itemId = matched.id;
    item.price = matched.sellingPrice || 0;
    item.taxRate = matched.taxRate || 0;
    item.unit = matched.unit || item.unit;
    if(matched.industryMeta){
      item.meta = { ...matched.industryMeta };
    }
    BillFlow.App.renderPage();
  }
}

function onItemMetaInput(idx, key, value){
  if(!currentInvoiceData || !currentInvoiceData.items[idx]) return;
  currentInvoiceData.items[idx].meta = currentInvoiceData.items[idx].meta || {};
  currentInvoiceData.items[idx].meta[key] = value;
}

function onItemChange(idx, field, value){
  if(!currentInvoiceData || !currentInvoiceData.items[idx]) return;
  currentInvoiceData.items[idx][field] = Number(value) || value;
  // Update totals without full re-render for smooth typing
  const totals = TaxEngine.calculateInvoiceTotals(currentInvoiceData.items, currentInvoiceData.invoiceDiscount);
  const row = document.querySelector(`.invoice-item-row[data-index="${idx}"]`);
  if(row){
    const lineCalc = TaxEngine.calculateLineItem(currentInvoiceData.items[idx]);
    const totalCell = row.children[4];
    if(totalCell) totalCell.textContent = Utils.formatCurrency(lineCalc.total);
  }
}

function addSuggestedItem(id, name, price, taxRate){
  if(!currentInvoiceData) return;
  currentInvoiceData.items.push({
    id: Utils.uuid(),
    itemId: id,
    name,
    quantity: 1,
    price,
    taxRate,
    meta: {}
  });
  Notifications.success('Item Added', `${name} added to invoice`);
  BillFlow.App.renderPage();
}

function onCustomerChange(id){
  if(!currentInvoiceData) return;
  currentInvoiceData.customerId = id;
  const cust = Store.getCustomer(id);
  currentInvoiceData.customerName = cust ? cust.name : 'Walk-in Customer';
  BillFlow.App.renderPage();
}

function onCustomerNameInput(name){
  if(!currentInvoiceData) return;
  currentInvoiceData.customerName = name;
}

function setPaymentMode(mode){
  if(!currentInvoiceData) return;
  currentInvoiceData.paymentMode = mode;
  BillFlow.App.renderPage();
}

function onFieldChange(field, value){
  if(!currentInvoiceData) return;
  currentInvoiceData[field] = value;
}

function onDiscountChange(type, value){
  if(!currentInvoiceData) return;
  currentInvoiceData.invoiceDiscount = currentInvoiceData.invoiceDiscount || {};
  currentInvoiceData.invoiceDiscount[type] = Number(value) || 0;
  BillFlow.App.renderPage();
}

function redeemPoints(points){
  const value = Loyalty.getPointsValue(points);
  onDiscountChange('amount', value);
  Notifications.info('Points Applied', `${points} points redeemed for ${Utils.formatCurrency(value)} discount`);
}

async function submitInvoice(){
  if(!currentInvoiceData) return;

  // Validation
  const validItems = currentInvoiceData.items.filter(i => (i.name || '').trim() && Number(i.quantity) > 0);
  if(validItems.length === 0){
    Notifications.error('Validation Error', 'Please enter at least one valid item name and quantity');
    return;
  }
  currentInvoiceData.items = validItems;

  try {
    let invoice;
    if(currentInvoiceData.id){
      invoice = await BillingEngine.updateInvoice(currentInvoiceData.id, currentInvoiceData);
      Notifications.success('Updated', `Invoice ${invoice.invoiceNo} updated`);
    } else {
      invoice = await BillingEngine.createInvoice(currentInvoiceData);
    }
    currentInvoiceData = null;
    window.location.hash = '#invoices';
    // Open preview modal for immediate print/PDF
    setTimeout(() => viewInvoiceModal(invoice.id), 200);
  } catch(e) {
    Notifications.error('Save Failed', e.message);
  }
}

async function saveDraft(){
  if(!currentInvoiceData) return;
  try {
    currentInvoiceData.status = 'draft';
    const invoice = await BillingEngine.createInvoice(currentInvoiceData);
    currentInvoiceData = null;
    Notifications.info('Draft Saved', `Invoice saved as draft`);
    window.location.hash = '#invoices';
  } catch(e) {
    Notifications.error('Error', e.message);
  }
}

/* ====================================================================
   MODALS: VIEW INVOICE, PAYMENT, CREDIT NOTE, NEW CUSTOMER
   ==================================================================== */
function viewInvoiceModal(id){
  const invoice = Store.getInvoice(id);
  if(!invoice) return;
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:850px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:.75rem">
          <h3 class="modal-title">${invoice.invoiceNo}</h3>
          <span class="badge ${Utils.getStatusBadge(invoice.status)}">${invoice.status}</span>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-secondary btn-sm" onclick="BillFlow.Pages.Invoices.downloadPDF('${invoice.id}')">📄 PDF</button>
          <button class="btn btn-primary btn-sm" onclick="BillFlow.Pages.Invoices.printInvoice('${invoice.id}')">🖨️ Print</button>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body" style="background:#ffffff;color:#1e293b;border-radius:var(--radius-lg);padding:2rem">
        <!-- Render Printable Invoice preview inside -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:1.5rem;margin-bottom:1.5rem">
          <div>
            <h2 style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0 0 .25rem 0">${Utils.escapeHtml(settings.businessName || 'BillFlow Merchant')}</h2>
            <div style="font-size:.875rem;color:#64748b">${Utils.escapeHtml(settings.address || 'Business Address')}</div>
            ${settings.gstin ? `<div style="font-size:.8125rem;color:#475569;font-weight:600">GSTIN: ${settings.gstin}</div>` : ''}
            ${settings.phone ? `<div style="font-size:.8125rem;color:#64748b">Phone: ${settings.phone}</div>` : ''}
          </div>
          <div style="text-align:right">
            <h3 style="font-size:1.25rem;font-weight:800;color:#2563eb;margin:0 0 .25rem 0">INVOICE</h3>
            <div style="font-size:.875rem;font-weight:700"># ${invoice.invoiceNo}</div>
            <div style="font-size:.8125rem;color:#64748b">Date: ${Utils.formatDate(invoice.invoiceDate, 'short')}</div>
            ${invoice.dueDate ? `<div style="font-size:.8125rem;color:#dc2626">Due: ${Utils.formatDate(invoice.dueDate, 'short')}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:.25rem">BILLED TO</div>
          <div style="font-size:1rem;font-weight:700;color:#0f172a">${Utils.escapeHtml(invoice.customerName || 'Walk-in Customer')}</div>
          ${invoice.customerId ? `<div style="font-size:.8125rem;color:#64748b">Customer ID: ${invoice.customerId.substring(0,8)}</div>` : ''}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
          <thead>
            <tr style="border-bottom:2px solid #cbd5e1;background:#f8fafc">
              <th style="padding:.75rem;text-align:left;font-size:.75rem;text-transform:uppercase;color:#475569">Item</th>
              <th style="padding:.75rem;text-align:center;font-size:.75rem;text-transform:uppercase;color:#475569">Qty</th>
              <th style="padding:.75rem;text-align:right;font-size:.75rem;text-transform:uppercase;color:#475569">Rate</th>
              <th style="padding:.75rem;text-align:center;font-size:.75rem;text-transform:uppercase;color:#475569">Tax %</th>
              <th style="padding:.75rem;text-align:right;font-size:.75rem;text-transform:uppercase;color:#475569">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items||[]).map(item => `
              <tr style="border-bottom:1px solid #f1f5f9;font-size:.875rem">
                <td style="padding:.75rem">
                  <strong>${Utils.escapeHtml(item.name)}</strong>
                  ${item.meta && Object.keys(item.meta).length > 0 ? `
                    <div style="font-size:.75rem;color:#64748b">
                      ${Object.entries(item.meta).map(([k,v]) => `${k}: ${v}`).join(' | ')}
                    </div>
                  ` : ''}
                </td>
                <td style="padding:.75rem;text-align:center">${item.quantity} ${item.unit || ''}</td>
                <td style="padding:.75rem;text-align:right;font-family:monospace">${Utils.formatCurrency(item.price, currency)}</td>
                <td style="padding:.75rem;text-align:center">${item.taxRate || 0}%</td>
                <td style="padding:.75rem;text-align:right;font-family:monospace;font-weight:700">${Utils.formatCurrency(item.total || (item.quantity * item.price), currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Summary Totals -->
        <div style="display:flex;justify-content:flex-end">
          <div style="width:280px">
            <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.875rem;color:#475569">
              <span>Subtotal:</span>
              <span style="font-family:monospace;font-weight:600">${Utils.formatCurrency(invoice.subtotal, currency)}</span>
            </div>
            ${invoice.totalDiscount > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.875rem;color:#16a34a">
                <span>Discount:</span>
                <span style="font-family:monospace;font-weight:600">- ${Utils.formatCurrency(invoice.totalDiscount, currency)}</span>
              </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.875rem;color:#475569">
              <span>Tax Amount:</span>
              <span style="font-family:monospace;font-weight:600">${Utils.formatCurrency(invoice.taxAmount, currency)}</span>
            </div>
            ${invoice.roundOff !== 0 ? `
              <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.875rem;color:#475569">
                <span>Round Off:</span>
                <span style="font-family:monospace">${Utils.formatCurrency(invoice.roundOff, currency)}</span>
              </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;padding:.75rem 0;font-size:1.125rem;font-weight:800;border-top:2px solid #0f172a;color:#0f172a">
              <span>Grand Total:</span>
              <span style="font-family:monospace;color:#2563eb">${Utils.formatCurrency(invoice.grandTotal, currency)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:.25rem 0;font-size:.8125rem;color:#16a34a;font-weight:600">
              <span>Amount Paid:</span>
              <span style="font-family:monospace">${Utils.formatCurrency(invoice.amountPaid, currency)}</span>
            </div>
          </div>
        </div>

        ${invoice.notes ? `
          <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px dashed #cbd5e1;font-size:.8125rem;color:#64748b">
            <strong>Notes:</strong> ${Utils.escapeHtml(invoice.notes)}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function openPaymentModal(invoiceId){
  const invoice = Store.getInvoice(invoiceId);
  if(!invoice) return;
  const remaining = Math.max(0, (invoice.grandTotal || 0) - (invoice.amountPaid || 0));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <h3 class="modal-title">Record Payment</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:1rem">
          Invoice <strong>${invoice.invoiceNo}</strong> • Remaining Balance: <strong>${Utils.formatCurrency(remaining)}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Payment Amount</label>
          <input type="number" id="payAmountInput" class="form-input" value="${remaining}" step="any" max="${remaining}">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select id="payModeSelect" class="form-select">
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="card">💳 Card</option>
            <option value="bank">🏦 Bank Transfer</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="btnConfirmPay">Confirm Payment</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btnConfirmPay').onclick = async () => {
    const amount = Number(overlay.querySelector('#payAmountInput').value);
    const mode = overlay.querySelector('#payModeSelect').value;
    if(!amount || amount <= 0){
      Notifications.warning('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    overlay.remove();
    await BillingEngine.recordPayment(invoiceId, amount, mode);
    BillFlow.App.renderPage();
  };
}

function openCreditNoteModal(invoiceId){
  const invoice = Store.getInvoice(invoiceId);
  if(!invoice) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h3 class="modal-title">Issue Credit Note</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:1rem">
          Create a return credit note for <strong>${invoice.invoiceNo}</strong>. Stock will automatically be restored.
        </p>
        <div class="form-group">
          <label class="form-label">Return Reason</label>
          <input type="text" id="cnReason" class="form-input" placeholder="e.g. Defective item, customer return">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-danger" id="btnConfirmCN">Issue Credit Note</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btnConfirmCN').onclick = async () => {
    const reason = overlay.querySelector('#cnReason').value || 'Customer return';
    overlay.remove();
    await BillingEngine.createCreditNote(invoiceId, invoice.items, reason);
    BillFlow.App.renderPage();
  };
}

async function deleteInvoice(id){
  const ok = await Utils.confirm('Are you sure you want to delete this invoice? This action cannot be undone.');
  if(ok){
    await Store.deleteInvoice(id);
    Notifications.info('Deleted', 'Invoice removed successfully');
    BillFlow.App.renderPage();
  }
}

function downloadPDF(id){
  const inv = Store.getInvoice(id);
  if(inv) PDFGenerator.downloadPDF(inv);
}

function printInvoice(id){
  const inv = Store.getInvoice(id);
  if(inv) PDFGenerator.printInvoice(inv);
}

function openCustomerModal(){
  BillFlow.Pages.Customers?.openCustomerModal?.();
}

function exportInvoicesCSV(){
  const invoices = Store.get('invoices') || [];
  if(invoices.length === 0){
    Notifications.warning('No Invoices', 'No invoices to export');
    return;
  }
  const data = invoices.map(i => ({
    'Invoice No': i.invoiceNo,
    'Date': i.invoiceDate,
    'Customer': i.customerName,
    'Subtotal': i.subtotal,
    'Discount': i.totalDiscount,
    'Tax': i.taxAmount,
    'Grand Total': i.grandTotal,
    'Amount Paid': i.amountPaid,
    'Payment Mode': i.paymentMode,
    'Status': i.status
  }));
  Utils.exportCSV(data, `BillFlow_Invoices_${Utils.today()}.csv`);
  Notifications.success('Exported', 'Invoices exported to CSV');
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Invoices = {
  render, setTab, handleSearch, addLineItem, removeLineItem, onItemNameInput,
  onItemMetaInput, onItemChange, addSuggestedItem, onCustomerChange,
  onCustomerNameInput, setPaymentMode, onFieldChange, onDiscountChange,
  redeemPoints, submitInvoice, saveDraft, viewInvoiceModal, openPaymentModal,
  openCreditNoteModal, deleteInvoice, downloadPDF, printInvoice,
  openCustomerModal, exportInvoicesCSV
};
})();
