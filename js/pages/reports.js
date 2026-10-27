(function(){
'use strict';
const {Utils,Store,Analytics,Templates,TaxEngine,Notifications}=BillFlow;

let activeReport = 'revenue'; // 'revenue', 'tax', 'profit', 'aging', 'customers'
let reportPeriod = 'month'; // 'week', 'month', 'quarter'

function render(){
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';

  return `
    <div class="reports-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Financial Reports & Intelligence</h1>
          <div class="page-subtitle">P&L, tax summaries, accounts aging, and revenue performance</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="BillFlow.Pages.Reports.exportCurrentReport()">
            <span>📥</span> Export Report
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            <span>🖨️</span> Print Report
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body" style="padding:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn ${activeReport==='revenue'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setReport('revenue')">📈 Sales & Revenue</button>
            <button class="btn ${activeReport==='tax'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setReport('tax')">🏛️ Tax Summary (GSTR)</button>
            <button class="btn ${activeReport==='profit'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setReport('profit')">💵 Profit & Loss</button>
            <button class="btn ${activeReport==='aging'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setReport('aging')">⏳ Payment Aging</button>
            <button class="btn ${activeReport==='customers'?'btn-primary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setReport('customers')">👥 Customer Spend</button>
          </div>

          ${activeReport === 'revenue' ? `
            <div style="display:flex;gap:.35rem">
              <button class="btn ${reportPeriod==='week'?'btn-secondary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setPeriod('week')">7 Days</button>
              <button class="btn ${reportPeriod==='month'?'btn-secondary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setPeriod('month')">30 Days</button>
              <button class="btn ${reportPeriod==='quarter'?'btn-secondary':'btn-ghost'} btn-sm" onclick="BillFlow.Pages.Reports.setPeriod('quarter')">90 Days</button>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Report Content Section -->
      ${renderReportContent()}
    </div>
  `;
}

function renderReportContent(){
  const settings = Store.get('settings')||{};
  const currency = settings.currency || 'INR';

  if(activeReport === 'revenue'){
    const rev = Analytics.getRevenueData(reportPeriod);
    const totalRev = rev.data.reduce((a, b) => a + b, 0);
    const invoices = Store.get('invoices') || [];
    const validInvoices = invoices.filter(i => i.status !== 'draft' && i.status !== 'credit-note');

    return `
      <div>
        <div class="report-summary-cards">
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--primary-400)">${Utils.formatCurrency(totalRev, currency)}</div>
            <div class="kpi-label">Total Period Revenue</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value">${validInvoices.length}</div>
            <div class="kpi-label">Completed Transactions</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value">${Utils.formatCurrency(validInvoices.length ? totalRev / validInvoices.length : 0, currency)}</div>
            <div class="kpi-label">Average Order Value</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.5rem">
          <div class="card-header"><h3 class="card-title">Revenue Trajectory Trend</h3></div>
          <div class="card-body">
            <div class="chart-container" style="height:320px">
              <canvas id="reportRevenueChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if(activeReport === 'tax'){
    const summary = Analytics.getTaxSummary();
    const slabs = Object.values(summary.slabs || {});

    return `
      <div>
        <div class="report-summary-cards">
          <div class="report-kpi">
            <div class="kpi-value">${Utils.formatCurrency(summary.taxableAmount, currency)}</div>
            <div class="kpi-label">Total Taxable Turnover</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--primary-400)">${Utils.formatCurrency(summary.taxAmount, currency)}</div>
            <div class="kpi-label">Total Tax Liability (GST)</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--success)">${Utils.formatCurrency(summary.grandTotal, currency)}</div>
            <div class="kpi-label">Gross Value Invoiced</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🏛️ GST / Tax Slab Breakdown (GSTR-1 Ready)</h3>
          </div>
          <div class="card-body" style="padding:0">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tax Slab Rate</th>
                  <th style="text-align:right">Taxable Amount</th>
                  <th style="text-align:right">CGST (50%)</th>
                  <th style="text-align:right">SGST (50%)</th>
                  <th style="text-align:right">Total Tax Amount</th>
                </tr>
              </thead>
              <tbody>
                ${slabs.length === 0 ? `
                  <tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-tertiary)">No tax transactions recorded</td></tr>
                ` : slabs.map(s => {
                  const half = Math.round(s.tax / 2 * 100) / 100;
                  return `
                    <tr>
                      <td><strong>${s.rate}% Slab</strong></td>
                      <td style="text-align:right;font-family:monospace">${Utils.formatCurrency(s.taxable, currency)}</td>
                      <td style="text-align:right;font-family:monospace;color:var(--text-secondary)">${Utils.formatCurrency(half, currency)}</td>
                      <td style="text-align:right;font-family:monospace;color:var(--text-secondary)">${Utils.formatCurrency(s.tax - half, currency)}</td>
                      <td style="text-align:right;font-family:monospace;font-weight:700;color:var(--primary-400)">${Utils.formatCurrency(s.tax, currency)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  if(activeReport === 'profit'){
    const invoices = Store.get('invoices') || [];
    const valid = invoices.filter(i => i.status !== 'draft' && i.status !== 'credit-note');
    let totalSales = 0;
    let totalCOGS = 0;

    valid.forEach(inv => {
      totalSales += (inv.subtotal || 0);
      (inv.items || []).forEach(item => {
        const invItem = Store.getItem(item.itemId);
        const cost = invItem?.costPrice || (item.price * 0.6); // fallback estimated 60%
        totalCOGS += (cost * (Number(item.quantity) || 1));
      });
    });

    const grossProfit = totalSales - totalCOGS;
    const margin = totalSales > 0 ? (grossProfit / totalSales * 100).toFixed(1) : 0;

    return `
      <div>
        <div class="report-summary-cards">
          <div class="report-kpi">
            <div class="kpi-value">${Utils.formatCurrency(totalSales, currency)}</div>
            <div class="kpi-label">Net Sales Revenue</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--danger)">${Utils.formatCurrency(totalCOGS, currency)}</div>
            <div class="kpi-label">Cost of Goods Sold (COGS)</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--success)">${Utils.formatCurrency(grossProfit, currency)}</div>
            <div class="kpi-label">Gross Margin: ${margin}%</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Profit & Loss Summary Breakdown</h3></div>
          <div class="card-body">
            <div style="max-width:600px;margin:0 auto">
              <div class="summary-row" style="font-size:var(--text-base);padding:1rem 0;border-bottom:1px solid var(--border-secondary)">
                <span>(+) Gross Invoiced Sales</span>
                <span class="value">${Utils.formatCurrency(totalSales, currency)}</span>
              </div>
              <div class="summary-row" style="font-size:var(--text-base);padding:1rem 0;border-bottom:1px solid var(--border-secondary);color:var(--danger)">
                <span>(-) Direct Procurement & Inventory Costs</span>
                <span class="value">- ${Utils.formatCurrency(totalCOGS, currency)}</span>
              </div>
              <div class="summary-row total" style="font-size:var(--text-xl);color:var(--success)">
                <span>(=) Estimated Gross Profit</span>
                <span class="value">${Utils.formatCurrency(grossProfit, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if(activeReport === 'aging'){
    const aging = Analytics.getPaymentAging();

    return `
      <div>
        <div class="report-summary-cards" style="grid-template-columns:repeat(4,1fr)">
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--success)">${Utils.formatCurrency(aging.current, currency)}</div>
            <div class="kpi-label">Current (0-30 days)</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--info)">${Utils.formatCurrency(aging['30days'], currency)}</div>
            <div class="kpi-label">31 - 60 Days Due</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--warning)">${Utils.formatCurrency(aging['60days'], currency)}</div>
            <div class="kpi-label">61 - 90 Days Due</div>
          </div>
          <div class="report-kpi">
            <div class="kpi-value" style="color:var(--danger)">${Utils.formatCurrency(aging['90days'], currency)}</div>
            <div class="kpi-label">90+ Days Overdue</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">⏳ Receivables Aging Breakdown</h3></div>
          <div class="card-body">
            <div class="chart-container" style="height:280px">
              <canvas id="reportAgingChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if(activeReport === 'customers'){
    const topCustomers = Analytics.getTopCustomers(10);

    return `
      <div class="card">
        <div class="card-header"><h3 class="card-title">👥 Top Customer Spend Leaderboard</h3></div>
        <div class="card-body" style="padding:0">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Customer Name</th>
                <th>Invoices Count</th>
                <th style="text-align:right">Total Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              ${topCustomers.length === 0 ? `
                <tr><td colspan="4" style="text-align:center;padding:2rem">No customer purchases yet</td></tr>
              ` : topCustomers.map((c, idx) => `
                <tr>
                  <td><span class="badge ${idx===0?'badge-primary':'badge-neutral'}">#${idx+1}</span></td>
                  <td><strong>${Utils.escapeHtml(c.name)}</strong></td>
                  <td>${c.count} orders</td>
                  <td style="text-align:right;font-family:monospace;font-weight:700;color:var(--primary-400)">
                    ${Utils.formatCurrency(c.spent, currency)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return '';
}

function init(){
  setTimeout(() => {
    if(activeReport === 'revenue') renderRevenueChart();
    if(activeReport === 'aging') renderAgingChart();
  }, 60);
}

function setReport(rep){
  activeReport = rep;
  BillFlow.App.renderPage();
  init();
}

function setPeriod(p){
  reportPeriod = p;
  BillFlow.App.renderPage();
  init();
}

function renderRevenueChart(){
  const rev = Analytics.getRevenueData(reportPeriod);
  const isDark = (Store.get('settings')?.theme || 'dark') !== 'light';
  const textColor = isDark ? 'hsl(225, 15%, 65%)' : 'hsl(225, 15%, 40%)';
  const gridColor = isDark ? 'hsla(225, 30%, 40%, 0.15)' : 'hsla(225, 20%, 70%, 0.2)';

  Analytics.renderChart('reportRevenueChart', {
    type: 'bar',
    data: {
      labels: rev.labels,
      datasets: [{
        label: 'Gross Revenue',
        data: rev.data,
        backgroundColor: 'hsla(230, 94%, 64%, 0.75)',
        hoverBackgroundColor: 'hsl(230, 94%, 64%)',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + Utils.formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, callback: (v) => Utils.formatCurrency(v) }
        }
      }
    }
  });
}

function renderAgingChart(){
  const aging = Analytics.getPaymentAging();
  const isDark = (Store.get('settings')?.theme || 'dark') !== 'light';

  Analytics.renderChart('reportAgingChart', {
    type: 'bar',
    data: {
      labels: ['Current (0-30d)', '31-60 Days', '61-90 Days', '90+ Days Overdue'],
      datasets: [{
        data: [aging.current, aging['30days'], aging['60days'], aging['90days']],
        backgroundColor: [
          'hsl(145, 65%, 45%)',
          'hsl(210, 90%, 55%)',
          'hsl(38, 95%, 55%)',
          'hsl(0, 75%, 55%)'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => Utils.formatCurrency(v) } }
      }
    }
  });
}

function exportCurrentReport(){
  if(activeReport === 'tax'){
    const summary = Analytics.getTaxSummary();
    const slabs = Object.values(summary.slabs || {});
    Utils.exportCSV(slabs, `BillFlow_Tax_GSTR1_${Utils.today()}.csv`);
  } else if(activeReport === 'customers'){
    const top = Analytics.getTopCustomers(50);
    Utils.exportCSV(top, `BillFlow_TopCustomers_${Utils.today()}.csv`);
  } else {
    const invoices = Store.get('invoices') || [];
    Utils.exportCSV(invoices, `BillFlow_Report_${activeReport}_${Utils.today()}.csv`);
  }
  Notifications.success('Exported', 'Report downloaded successfully');
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Reports = {
  render, init, setReport, setPeriod, exportCurrentReport
};
})();
