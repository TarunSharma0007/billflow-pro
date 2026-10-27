(function(){
'use strict';
const {Utils,Store,Analytics,Templates,Notifications,DB}=BillFlow;

let activeFilter = 'all';
let selectedCategory = 'all';
let searchQuery = '';
let viewMode = 'table'; // 'table' or 'grid'

function render(){
  const settings = Store.get('settings')||{};
  const industry = settings.industry || 'retail';
  const template = Templates.getTemplate(industry);
  const currency = settings.currency || 'INR';
  const termItem = Templates.getTerminology('item');
  let items = Store.get('items') || [];

  // Filter by category
  if(selectedCategory !== 'all'){
    items = items.filter(i => (i.category || '').toLowerCase() === selectedCategory.toLowerCase());
  }

  // Filter tabs
  const now = new Date();
  const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);

  if(activeFilter === 'low-stock'){
    items = items.filter(i => i.currentStock <= i.minStock && i.currentStock > 0);
  } else if(activeFilter === 'out-of-stock'){
    items = items.filter(i => (i.currentStock || 0) <= 0);
  } else if(activeFilter === 'expiring'){
    items = items.filter(i => {
      const exp = i.industryMeta?.expiryDate;
      return exp && new Date(exp) <= thirtyDays && new Date(exp) >= now;
    });
  }

  // Search filter
  if(searchQuery){
    items = Utils.searchFilter(items, searchQuery, ['name', 'sku', 'barcode', 'category']);
  }

  // Compute inventory KPIs
  const allItems = Store.get('items') || [];
  const valuation = Analytics.getInventoryValuation();
  const lowStockCount = allItems.filter(i => i.currentStock <= i.minStock && i.currentStock > 0).length;
  const outOfStockCount = allItems.filter(i => (i.currentStock || 0) <= 0).length;
  const categories = Array.from(new Set(allItems.map(i => i.category).filter(Boolean)));

  return `
    <div class="inventory-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${termItem}s & Inventory</h1>
          <div class="page-subtitle">Track stock levels, valuation, batches, pricing tiers, and barcodes for ${template.name}</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="BillFlow.Pages.Inventory.exportCSV()">
            <span>📥</span> Export CSV
          </button>
          <button class="btn btn-primary" onclick="BillFlow.Pages.Inventory.openItemModal()">
            <span>➕</span> Add ${termItem}
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.5rem">
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total Inventory Value</div>
          <div class="stat-value" style="color:var(--primary-400)">${Utils.formatCurrency(valuation.totalRetailValue, currency)}</div>
          <div class="stat-change positive"><span>Cost: ${Utils.formatCurrency(valuation.totalCostValue, currency)}</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Total Catalog ${termItem}s</div>
          <div class="stat-value">${allItems.length}</div>
          <div class="stat-change positive"><span>${categories.length} categories</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Low Stock Warnings</div>
          <div class="stat-value" style="color:var(--warning)">${lowStockCount}</div>
          <div class="stat-change ${lowStockCount>0?'negative':'positive'}"><span>Needs reorder</span></div>
        </div>
        <div class="stat-card" style="padding:1rem 1.25rem">
          <div class="stat-label">Out of Stock</div>
          <div class="stat-value" style="color:var(--danger)">${outOfStockCount}</div>
          <div class="stat-change ${outOfStockCount>0?'negative':'positive'}"><span>Immediate replenishment</span></div>
        </div>
      </div>

      <!-- Filters, Categories & View Toggle -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body" style="padding:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn ${activeFilter==='all'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Inventory.setFilter('all')">All Items (${allItems.length})</button>
            <button class="btn ${activeFilter==='low-stock'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Inventory.setFilter('low-stock')">⚠️ Low Stock (${lowStockCount})</button>
            <button class="btn ${activeFilter==='out-of-stock'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Inventory.setFilter('out-of-stock')">🚫 Out of Stock (${outOfStockCount})</button>
            ${industry === 'pharmacy' ? `
              <button class="btn ${activeFilter==='expiring'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Inventory.setFilter('expiring')">⏳ Expiring Soon</button>
            ` : ''}

            <!-- Category Select Filter -->
            <select class="form-select" style="width:auto;padding:4px 24px 4px 8px;font-size:12px" onchange="BillFlow.Pages.Inventory.setCategory(this.value)">
              <option value="all">All Categories</option>
              ${categories.map(c => `
                <option value="${c}" ${selectedCategory === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="header-search" style="width:240px;display:block">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search by name, SKU, barcode..." value="${Utils.escapeHtml(searchQuery)}" oninput="BillFlow.Pages.Inventory.handleSearch(this.value)">
            </div>
            <div style="display:flex;background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-primary);padding:2px">
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;${viewMode==='table'?'background:var(--bg-hover)':''}" onclick="BillFlow.Pages.Inventory.setViewMode('table')">☰</button>
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;${viewMode==='grid'?'background:var(--bg-hover)':''}" onclick="BillFlow.Pages.Inventory.setViewMode('grid')">⊞</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Content: Table or Grid -->
      ${items.length === 0 ? `
        <div class="card">
          <div class="card-body" style="padding:3.5rem 1rem">
            <div class="empty-state">
              <div class="empty-state-icon">📦</div>
              <div class="empty-state-title">No ${termItem.toLowerCase()}s found</div>
              <div class="empty-state-text">Add your products, medicines or services to start tracking stock and billing</div>
              <button class="btn btn-primary" style="margin-top:1rem" onclick="BillFlow.Pages.Inventory.openItemModal()">
                <span>➕</span> Add New ${termItem}
              </button>
            </div>
          </div>
        </div>
      ` : viewMode === 'table' ? `
        <div class="card">
          <div class="card-body" style="padding:0;overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${termItem} Name</th>
                  <th>Category</th>
                  <th>Stock Status</th>
                  <th style="text-align:right">Cost</th>
                  <th style="text-align:right">Selling Price</th>
                  <th>Tax</th>
                  <th>SKU / Barcode</th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => {
                  const isOutOfStock = (item.currentStock || 0) <= 0;
                  const isLowStock = !isOutOfStock && item.currentStock <= item.minStock;
                  const statusClass = isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock';
                  const statusText = isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock';

                  return `
                    <tr onclick="BillFlow.Pages.Inventory.openItemModal('${item.id}')">
                      <td>
                        <div style="font-weight:600">${Utils.escapeHtml(item.name)}</div>
                        ${item.industryMeta && Object.keys(item.industryMeta).length > 0 ? `
                          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">
                            ${Object.entries(item.industryMeta).slice(0, 2).map(([k,v]) => `${k}: ${v}`).join(' • ')}
                          </div>
                        ` : ''}
                      </td>
                      <td>
                        <span class="badge badge-neutral">${item.category || 'General'}</span>
                      </td>
                      <td>
                        <div class="stock-indicator">
                          <span class="stock-dot ${statusClass}"></span>
                          <span style="font-weight:600;font-size:var(--text-sm)">${item.currentStock || 0} ${item.unit || 'pcs'}</span>
                          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:10px" onclick="event.stopPropagation();BillFlow.Pages.Inventory.openAdjustStockModal('${item.id}')">±</button>
                        </div>
                      </td>
                      <td class="col-amount" style="color:var(--text-secondary)">
                        ${Utils.formatCurrency(item.costPrice || 0, currency)}
                      </td>
                      <td class="col-amount" style="color:var(--primary-400)">
                        ${Utils.formatCurrency(item.sellingPrice || 0, currency)}
                      </td>
                      <td>${item.taxRate || 0}%</td>
                      <td>
                        <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-tertiary)">
                          ${item.barcode || item.sku || '—'}
                        </span>
                      </td>
                      <td class="col-actions" onclick="event.stopPropagation()">
                        <div style="display:flex;justify-content:flex-end;gap:.25rem">
                          <button class="btn btn-ghost btn-icon sm" title="Generate Barcode" onclick="BillFlow.Pages.Inventory.openBarcodeModal('${item.id}')">🏷️</button>
                          <button class="btn btn-ghost btn-icon sm" title="Adjust Stock" onclick="BillFlow.Pages.Inventory.openAdjustStockModal('${item.id}')">📦</button>
                          <button class="btn btn-ghost btn-icon sm" title="Edit" onclick="BillFlow.Pages.Inventory.openItemModal('${item.id}')">✏️</button>
                          <button class="btn btn-ghost btn-icon sm" title="Delete" style="color:var(--danger)" onclick="BillFlow.Pages.Inventory.deleteItem('${item.id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <!-- Grid View -->
        <div class="inventory-grid">
          ${items.map(item => {
            const isOutOfStock = (item.currentStock || 0) <= 0;
            const isLowStock = !isOutOfStock && item.currentStock <= item.minStock;
            const statusClass = isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock';
            const statusText = isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock';

            return `
              <div class="inventory-card" onclick="BillFlow.Pages.Inventory.openItemModal('${item.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <span class="badge badge-neutral">${item.category || 'General'}</span>
                  <div class="stock-indicator">
                    <span class="stock-dot ${statusClass}"></span>
                    <span style="font-size:var(--text-xs);font-weight:600">${statusText}</span>
                  </div>
                </div>
                <div class="item-name" style="margin-top:.75rem">${Utils.escapeHtml(item.name)}</div>
                <div class="item-sku">${item.sku || item.barcode || 'NO-SKU'}</div>
                <div class="item-price">${Utils.formatCurrency(item.sellingPrice, currency)}</div>
                <div class="item-meta">
                  <span>Stock: <strong>${item.currentStock || 0} ${item.unit || 'pcs'}</strong></span>
                  <span>Tax: ${item.taxRate || 0}%</span>
                </div>
                <div style="display:flex;gap:.5rem;margin-top:1rem;border-top:1px solid var(--border-secondary);padding-top:.75rem">
                  <button class="btn btn-secondary btn-sm" style="flex:1" onclick="event.stopPropagation();BillFlow.Pages.Inventory.openAdjustStockModal('${item.id}')">Adjust Stock</button>
                  <button class="btn btn-ghost btn-icon sm" onclick="event.stopPropagation();BillFlow.Pages.Inventory.openBarcodeModal('${item.id}')">🏷️</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function setFilter(f){
  activeFilter = f;
  BillFlow.App.renderPage();
}

function setCategory(cat){
  selectedCategory = cat;
  BillFlow.App.renderPage();
}

function handleSearch(q){
  searchQuery = q;
  BillFlow.App.renderPage();
}

function setViewMode(mode){
  viewMode = mode;
  BillFlow.App.renderPage();
}

/* ====================================================================
   ADD / EDIT ITEM MODAL
   ==================================================================== */
function openItemModal(id = null){
  const item = id ? Store.getItem(id) : null;
  const settings = Store.get('settings')||{};
  const industry = settings.industry || 'retail';
  const template = Templates.getTemplate(industry);
  const termItem = Templates.getTerminology('item');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:680px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <h3 class="modal-title">${item ? `Edit ${termItem}` : `Add New ${termItem}`}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <form id="itemForm" onsubmit="event.preventDefault()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${termItem} Name <span class="required">*</span></label>
              <input type="text" id="itName" class="form-input" required value="${Utils.escapeHtml(item?.name || '')}" placeholder="e.g. Paracetamol 500mg, Deluxe Room, Cotton Shirt">
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <input type="text" list="categoryDatalist" id="itCategory" class="form-input" value="${Utils.escapeHtml(item?.category || template.defaultCategories?.[0] || 'General')}" placeholder="Select or type category">
              <datalist id="categoryDatalist">
                ${(template.defaultCategories || []).map(c => `<option value="${c}">`).join('')}
              </datalist>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Selling Price (${settings.currency||'INR'}) <span class="required">*</span></label>
              <input type="number" id="itPrice" class="form-input" required step="any" min="0" value="${item?.sellingPrice || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Cost / Buy Price</label>
              <input type="number" id="itCostPrice" class="form-input" step="any" min="0" value="${item?.costPrice || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Unit of Measure</label>
              <select id="itUnit" class="form-select">
                ${(template.defaultUnits || ['pcs', 'kg', 'box']).map(u => `
                  <option value="${u}" ${item?.unit === u ? 'selected' : ''}>${u}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Initial Stock</label>
              <input type="number" id="itStock" class="form-input" step="any" value="${item?.currentStock || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Min Alert Stock</label>
              <input type="number" id="itMinStock" class="form-input" step="any" value="${item?.minStock || 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Tax Rate</label>
              <select id="itTaxRate" class="form-select">
                ${(template.taxRules?.categories || [{name:'Standard',rate:18},{name:'Exempt',rate:0}]).map(c => `
                  <option value="${c.rate}" ${Number(item?.taxRate) === c.rate ? 'selected' : ''}>${c.rate}% (${c.name})</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">SKU / Item Code</label>
              <input type="text" id="itSku" class="form-input" value="${Utils.escapeHtml(item?.sku || '')}" placeholder="AUTO-GENERATED IF BLANK">
            </div>
            <div class="form-group">
              <label class="form-label">Barcode Number</label>
              <div style="display:flex;gap:4px">
                <input type="text" id="itBarcode" class="form-input" value="${Utils.escapeHtml(item?.barcode || '')}" placeholder="890123456789">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('itBarcode').value=Math.floor(100000000000+Math.random()*900000000000)">Gen</button>
              </div>
            </div>
          </div>

          <!-- Industry Specific Custom Fields -->
          ${template.itemFields && template.itemFields.length > 0 ? `
            <div style="background:var(--bg-tertiary);border-radius:var(--radius-md);padding:1rem;margin-top:.5rem;border:1px solid var(--border-secondary)">
              <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;color:var(--primary-400);margin-bottom:.75rem">
                ${template.icon} ${template.name} Specific Fields
              </div>
              <div class="form-row">
                ${template.itemFields.map(f => `
                  <div class="form-group" style="margin-bottom:.5rem">
                    <label class="form-label" style="font-size:12px">${f.label}</label>
                    ${f.type === 'select' ? `
                      <select class="form-select" data-meta-key="${f.key}">
                        ${(f.options || []).map(o => `
                          <option value="${o}" ${item?.industryMeta?.[f.key] === o ? 'selected' : ''}>${o}</option>
                        `).join('')}
                      </select>
                    ` : `
                      <input type="${f.type === 'date' ? 'date' : 'text'}" 
                        class="form-input" 
                        data-meta-key="${f.key}" 
                        value="${Utils.escapeHtml(item?.industryMeta?.[f.key] || '')}">
                    `}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="btnSaveItem">Save ${termItem}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btnSaveItem').onclick = async () => {
    const name = overlay.querySelector('#itName').value.trim();
    if(!name){
      Notifications.warning('Required', 'Item name is mandatory');
      return;
    }

    const industryMeta = {};
    overlay.querySelectorAll('[data-meta-key]').forEach(el => {
      industryMeta[el.dataset.metaKey] = el.value;
    });

    const sku = overlay.querySelector('#itSku').value.trim() || 'SKU-' + Utils.shortId();
    const barcode = overlay.querySelector('#itBarcode').value.trim() || sku;

    const data = {
      id: item ? item.id : Utils.uuid(),
      name,
      category: overlay.querySelector('#itCategory').value.trim() || 'General',
      sellingPrice: Number(overlay.querySelector('#itPrice').value) || 0,
      costPrice: Number(overlay.querySelector('#itCostPrice').value) || 0,
      unit: overlay.querySelector('#itUnit').value,
      currentStock: Number(overlay.querySelector('#itStock').value) || 0,
      minStock: Number(overlay.querySelector('#itMinStock').value) || 0,
      taxRate: Number(overlay.querySelector('#itTaxRate').value) || 0,
      sku,
      barcode,
      industryMeta,
      createdAt: item ? item.createdAt : Utils.now(),
      updatedAt: Utils.now()
    };

    overlay.remove();
    await Store.saveItem(data);
    await Store.addActivity('inventory', `${item ? 'Updated' : 'Added'} ${termItem.toLowerCase()} ${data.name}`, { itemId: data.id });
    Notifications.success('Success', `${data.name} saved successfully`);
    BillFlow.App.renderPage();
  };
}

/* ====================================================================
   STOCK ADJUSTMENT MODAL
   ==================================================================== */
function openAdjustStockModal(id){
  const item = Store.getItem(id);
  if(!item) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <h3 class="modal-title">Adjust Stock Level</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:1rem">
          Item: <strong>${Utils.escapeHtml(item.name)}</strong> • Current: <strong>${item.currentStock || 0} ${item.unit || 'pcs'}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Adjustment Type</label>
          <select id="adjType" class="form-select">
            <option value="add">➕ Add Stock (Restock / Received)</option>
            <option value="reduce">➖ Reduce Stock (Damage / Loss / Return)</option>
            <option value="set">🔄 Set Exact Count (Physical Audit)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <input type="number" id="adjQty" class="form-input" min="0" step="any" value="10">
        </div>
        <div class="form-group">
          <label class="form-label">Reason / Notes</label>
          <input type="text" id="adjReason" class="form-input" placeholder="e.g. Supplier PO receipt, physical audit">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="btnConfirmAdj">Update Stock</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btnConfirmAdj').onclick = async () => {
    const type = overlay.querySelector('#adjType').value;
    const qty = Number(overlay.querySelector('#adjQty').value) || 0;
    const reason = overlay.querySelector('#adjReason').value.trim() || 'Manual adjustment';

    let newStock = item.currentStock || 0;
    if(type === 'add') newStock += qty;
    else if(type === 'reduce') newStock = Math.max(0, newStock - qty);
    else if(type === 'set') newStock = qty;

    overlay.remove();
    await Store.saveItem({ ...item, currentStock: newStock, updatedAt: Utils.now() });
    await Store.addActivity('inventory', `Adjusted stock for ${item.name} to ${newStock} (${reason})`, { itemId: item.id });
    Notifications.success('Stock Updated', `${item.name}: ${newStock} ${item.unit || 'pcs'}`);
    BillFlow.App.renderPage();
  };
}

/* ====================================================================
   BARCODE GENERATOR MODAL
   ==================================================================== */
function openBarcodeModal(id){
  const item = Store.getItem(id);
  if(!item) return;
  const barcodeValue = item.barcode || item.sku || '123456789012';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px;text-align:center">
      <div class="modal-header">
        <h3 class="modal-title">Barcode Label</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="background:#ffffff;color:#111;padding:2rem;border-radius:var(--radius-lg);margin:1rem">
        <div style="font-weight:700;font-size:1.125rem;margin-bottom:2px">${Utils.escapeHtml(item.name)}</div>
        <div style="font-size:12px;color:#666;margin-bottom:12px">${item.category || 'Retail'}</div>
        
        <!-- Visual Barcode Lines Pattern -->
        <div style="background:#fff;padding:12px;display:inline-block;border:1px solid #ddd;border-radius:4px">
          <div style="display:flex;height:60px;align-items:flex-end;justify-content:center;gap:2px">
            ${barcodeValue.split('').map((char, i) => {
              const code = char.charCodeAt(0);
              const width = (code % 3) + 2;
              const isSpace = (i % 5 === 0);
              return `<span style="background:${isSpace ? '#fff' : '#000'};width:${width}px;height:${isSpace ? 0 : 55}px;display:inline-block"></span>`;
            }).join('')}
          </div>
          <div style="font-family:monospace;font-size:14px;letter-spacing:4px;margin-top:6px;font-weight:700">${barcodeValue}</div>
        </div>

        <div style="font-size:1.25rem;font-weight:800;color:#2563eb;margin-top:12px">
          MRP: ${Utils.formatCurrency(item.sellingPrice)}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:center;gap:1rem">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Label</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function deleteItem(id){
  const ok = await Utils.confirm('Are you sure you want to delete this catalog item?');
  if(ok){
    await Store.deleteItem(id);
    Notifications.info('Deleted', 'Item removed from inventory');
    BillFlow.App.renderPage();
  }
}

function exportCSV(){
  const items = Store.get('items') || [];
  if(items.length === 0){
    Notifications.warning('No Items', 'No inventory items to export');
    return;
  }
  const data = items.map(i => ({
    'Name': i.name,
    'Category': i.category,
    'Selling Price': i.sellingPrice,
    'Cost Price': i.costPrice,
    'Stock': i.currentStock,
    'Min Stock': i.minStock,
    'Unit': i.unit,
    'Tax Rate': i.taxRate,
    'SKU': i.sku,
    'Barcode': i.barcode
  }));
  Utils.exportCSV(data, `BillFlow_Inventory_${Utils.today()}.csv`);
  Notifications.success('Exported', 'Inventory catalog exported to CSV');
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Inventory = {
  render, setFilter, setCategory, handleSearch, setViewMode, openItemModal,
  openAdjustStockModal, openBarcodeModal, deleteItem, exportCSV
};
})();
