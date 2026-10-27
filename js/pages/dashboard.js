(function(){
'use strict';
const {Utils,Store,Analytics,Templates}=BillFlow;

function render(){
  const settings=Store.get('settings')||{};
  const industry=settings.industry||'retail';
  const template=Templates.getTemplate(industry);
  const stats=Analytics.getTodayStats();
  const anomalies=Analytics.detectAnomalies();
  const topItems=Analytics.getTopItems(5);
  const activities=Store.get('activities')||[];
  const currency=settings.currency||'INR';
  const termCustomer=Templates.getTerminology('customer');
  const termItem=Templates.getTerminology('item');
  const termInvoice=Templates.getTerminology('invoice');

  return `
    <div class="dashboard-page">
      <!-- Welcome Header -->
      <div class="dashboard-welcome">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
          <div>
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
              <h2>${settings.businessName || 'My Business'}</h2>
              <span class="badge badge-primary">${template.icon} ${template.name}</span>
            </div>
            <p>Here's what is happening with your ${termInvoice.toLowerCase()}s and sales today • ${Utils.formatDate(new Date(), 'full')}</p>
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-primary" onclick="window.location.hash='#invoices/new'">
              <span>➕</span> New ${termInvoice}
            </button>
            <button class="btn btn-secondary" onclick="BillFlow.App.openQuickSaleModal()">
              <span>⚡</span> Quick Sale
            </button>
          </div>
        </div>
      </div>

      <!-- AI Alerts / Anomalies if any -->
      ${anomalies.length > 0 ? `
        <div class="card" style="margin-bottom:1.5rem;border-left:4px solid var(--warning);background:hsla(38,95%,55%,.06)">
          <div class="card-body" style="padding:.875rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
            <div style="display:flex;align-items:center;gap:.75rem">
              <span style="font-size:1.5rem">🧠</span>
              <div>
                <div style="font-size:var(--text-sm);font-weight:700;color:var(--warning)">BillFlow AI Anomaly Detected</div>
                <div style="font-size:var(--text-xs);color:var(--text-secondary)">${anomalies[0].message}</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#reports'">View Analysis</button>
          </div>
        </div>
      ` : ''}

      <!-- Stat Cards Grid -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon revenue">💰</div>
          <div class="stat-label">Today's Revenue</div>
          <div class="stat-value" id="statTodayRevenue">${Utils.formatCurrency(stats.revenue, currency)}</div>
          <div class="stat-change positive">
            <span>▲</span> <span>${stats.invoices} bills today</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon invoices">📋</div>
          <div class="stat-label">Total ${termInvoice}s</div>
          <div class="stat-value">${stats.invoices}</div>
          <div class="stat-change ${stats.invoices > 0 ? 'positive' : 'neutral'}">
            <span>•</span> <span>Avg ${Utils.formatCurrency(stats.invoices ? stats.revenue / stats.invoices : 0, currency)}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon customers">👥</div>
          <div class="stat-label">Active ${termCustomer}s</div>
          <div class="stat-value">${(Store.get('customers')||[]).length}</div>
          <div class="stat-change positive">
            <span>★</span> <span>Loyalty enabled</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon pending">⏳</div>
          <div class="stat-label">Pending Receivables</div>
          <div class="stat-value">${Utils.formatCurrency(stats.unpaidAmount, currency)}</div>
          <div class="stat-change ${stats.unpaidAmount > 0 ? 'negative' : 'positive'}">
            <span>${stats.unpaidCount} unpaid</span>
          </div>
        </div>
      </div>

      <!-- Quick Action Shortcuts -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">
          <h3 class="card-title">⚡ Quick Operations</h3>
          <span style="font-size:var(--text-xs);color:var(--text-tertiary)">Industry workflow shortcuts</span>
        </div>
        <div class="card-body">
          <div class="quick-actions">
            <div class="quick-action-btn" onclick="window.location.hash='#invoices/new'">
              <span class="icon">📝</span>
              <span class="label">Create ${termInvoice}</span>
            </div>
            <div class="quick-action-btn" onclick="BillFlow.Pages.Invoices.openCustomerModal()">
              <span class="icon">👤</span>
              <span class="label">Add ${termCustomer}</span>
            </div>
            <div class="quick-action-btn" onclick="BillFlow.Pages.Inventory.openItemModal()">
              <span class="icon">📦</span>
              <span class="label">Add ${termItem}</span>
            </div>
            <div class="quick-action-btn" onclick="BillFlow.App.openBarcodeScanner()">
              <span class="icon">📷</span>
              <span class="label">Scan Barcode / QR</span>
            </div>
            <div class="quick-action-btn" onclick="BillFlow.App.triggerVoiceBilling()">
              <span class="icon">🎙️</span>
              <span class="label">Voice Invoicing</span>
            </div>
            <div class="quick-action-btn" onclick="window.location.hash='#reports'">
              <span class="icon">📊</span>
              <span class="label">Tax / P&L Report</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="chart-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📈 Revenue Analytics</h3>
            <div style="display:flex;gap:.375rem">
              <button class="btn btn-secondary btn-sm" id="btnChartWeek" onclick="BillFlow.Pages.Dashboard.switchPeriod('week')">7 Days</button>
              <button class="btn btn-ghost btn-sm" id="btnChartMonth" onclick="BillFlow.Pages.Dashboard.switchPeriod('month')">30 Days</button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="dashboardRevenueChart"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">💳 Payment Modes</h3>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="dashboardPaymentChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Dual Grid: Top Items & Recent Activity -->
      <div class="dual-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🏆 Top Selling ${termItem}s</h3>
            <a href="#inventory" style="font-size:var(--text-xs);color:var(--primary-400);text-decoration:none">View All</a>
          </div>
          <div class="card-body">
            ${topItems.length === 0 ? `
              <div class="empty-state" style="padding:2rem 1rem">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-title">No sales recorded yet</div>
                <div class="empty-state-text">Start billing to see best-selling items here</div>
              </div>
            ` : `
              <ul class="top-items-list">
                ${topItems.map((item, index) => {
                  const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                  return `
                    <li class="top-item">
                      <div class="top-item-rank ${rankClass}">${index + 1}</div>
                      <div class="top-item-info">
                        <div class="top-item-name">${Utils.escapeHtml(item.name)}</div>
                        <div class="top-item-sub">${item.qty} units sold</div>
                      </div>
                      <div class="top-item-value">${Utils.formatCurrency(item.revenue, currency)}</div>
                    </li>
                  `;
                }).join('')}
              </ul>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">⚡ Real-Time Activity Log</h3>
            <span class="badge badge-neutral">Audit Trail</span>
          </div>
          <div class="card-body">
            <div class="activity-feed">
              ${activities.length === 0 ? `
                <div class="empty-state" style="padding:2rem 1rem">
                  <div class="empty-state-icon">🕒</div>
                  <div class="empty-state-title">No activity yet</div>
                  <div class="empty-state-text">Transactions and updates will appear here live</div>
                </div>
              ` : activities.slice(0, 10).map(act => {
                const icon = act.type === 'invoice' ? '📝' : act.type === 'payment' ? '💰' : act.type === 'credit-note' ? '↩️' : act.type === 'customer' ? '👤' : '⚙️';
                return `
                  <div class="activity-item">
                    <div class="activity-icon" style="background:var(--bg-hover)">${icon}</div>
                    <div style="flex:1">
                      <div class="activity-text">${Utils.escapeHtml(act.message)}</div>
                      <div class="activity-time">${Utils.timeAgo(act.date)}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

let currentPeriod = 'week';

function init(){
  initCharts();
}

function initCharts(){
  setTimeout(() => {
    renderRevenueChart(currentPeriod);
    renderPaymentChart();
  }, 50);
}

function switchPeriod(period){
  currentPeriod = period;
  const btnW = document.getElementById('btnChartWeek');
  const btnM = document.getElementById('btnChartMonth');
  if (btnW && btnM) {
    if (period === 'week') {
      btnW.className = 'btn btn-secondary btn-sm';
      btnM.className = 'btn btn-ghost btn-sm';
    } else {
      btnW.className = 'btn btn-ghost btn-sm';
      btnM.className = 'btn btn-secondary btn-sm';
    }
  }
  renderRevenueChart(period);
}

function renderRevenueChart(period){
  const rev = Analytics.getRevenueData(period);
  const isDark = (Store.get('settings')?.theme || 'dark') !== 'light';
  const textColor = isDark ? 'hsl(225, 15%, 65%)' : 'hsl(225, 15%, 40%)';
  const gridColor = isDark ? 'hsla(225, 30%, 40%, 0.15)' : 'hsla(225, 20%, 70%, 0.2)';

  Analytics.renderChart('dashboardRevenueChart', {
    type: 'line',
    data: {
      labels: rev.labels,
      datasets: [{
        label: 'Revenue',
        data: rev.data,
        borderColor: 'hsl(230, 94%, 64%)',
        backgroundColor: 'hsla(230, 94%, 64%, 0.12)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: 'hsl(230, 94%, 64%)',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'hsl(225, 22%, 11%)' : 'hsl(0, 0%, 100%)',
          titleColor: isDark ? '#fff' : '#111',
          bodyColor: isDark ? '#ddd' : '#333',
          borderColor: 'hsla(230, 94%, 64%, 0.4)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => ' ' + Utils.formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 10 },
            callback: (v) => Utils.formatCurrency(v)
          }
        }
      }
    }
  });
}

function renderPaymentChart(){
  const split = Analytics.getPaymentSplit();
  const isDark = (Store.get('settings')?.theme || 'dark') !== 'light';
  const total = split.data.reduce((a, b) => a + b, 0);

  if (total === 0) {
    // Show placeholder chart
    Analytics.renderChart('dashboardPaymentChart', {
      type: 'doughnut',
      data: {
        labels: ['No Payments Yet'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? 'hsl(225, 20%, 20%)' : 'hsl(225, 18%, 90%)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: { enabled: false }
        },
        cutout: '72%'
      }
    });
    return;
  }

  Analytics.renderChart('dashboardPaymentChart', {
    type: 'doughnut',
    data: {
      labels: split.labels,
      datasets: [{
        data: split.data,
        backgroundColor: [
          'hsl(145, 65%, 45%)', // Cash
          'hsl(210, 90%, 55%)', // Card
          'hsl(280, 80%, 60%)', // UPI
          'hsl(38, 95%, 55%)',  // Credit
          'hsl(200, 70%, 50%)'  // Bank
        ],
        borderWidth: 2,
        borderColor: isDark ? 'hsl(225, 22%, 11%)' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            color: isDark ? 'hsl(225, 15%, 65%)' : 'hsl(225, 15%, 40%)',
            font: { family: 'Inter', size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${Utils.formatCurrency(ctx.parsed)}`
          }
        }
      },
      cutout: '70%'
    }
  });
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Pages = window.BillFlow.Pages || {};
window.BillFlow.Pages.Dashboard = { render, init, switchPeriod, initCharts };
})();
