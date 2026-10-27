(function(){
'use strict';
const container=document.createElement('div');
container.className='toast-container';container.id='toastContainer';
if(document.body){document.body.appendChild(container);}else{window.addEventListener('DOMContentLoaded',()=>document.body.appendChild(container));}

function showToast(type,title,message,duration=4000){
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const toast=document.createElement('div');
  toast.className=`toast toast-${type}`;
  toast.innerHTML=`
    <span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message?`<div class="toast-message">${message}</div>`:''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  if(duration>0)setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateX(100%)';toast.style.transition='all 300ms ease';setTimeout(()=>toast.remove(),300);},duration);
  return toast;
}

function success(title,message){ return showToast('success',title,message); }
function error(title,message){ return showToast('error',title,message); }
function warning(title,message){ return showToast('warning',title,message); }
function info(title,message){ return showToast('info',title,message); }

function checkOverdueInvoices(){
  const invoices=BillFlow.Store.get('invoices')||[];
  const today=new Date();
  invoices.forEach(inv=>{
    if(inv.status!=='paid'&&inv.dueDate&&new Date(inv.dueDate)<today){
      const days=BillFlow.Utils.daysBetween(inv.dueDate);
      if(days>0&&days%7===0){
        BillFlow.Store.addNotification({type:'overdue',title:'Payment Overdue',message:`Invoice ${inv.invoiceNo} is ${days} days overdue (${BillFlow.Utils.formatCurrency(inv.grandTotal)})`,icon:'⏰'});
      }
    }
  });
}

function checkLowStock(){
  const items=BillFlow.Store.get('items')||[];
  items.forEach(item=>{
    if(item.currentStock<=item.minStock&&item.currentStock>0){
      BillFlow.Store.addNotification({type:'lowStock',title:'Low Stock Alert',message:`${item.name} has only ${item.currentStock} ${item.unit||'pcs'} left`,icon:'📦'});
    }
    if(item.currentStock===0){
      BillFlow.Store.addNotification({type:'outOfStock',title:'Out of Stock!',message:`${item.name} is out of stock`,icon:'🚫'});
    }
  });
}

function checkExpiry(){
  const items=BillFlow.Store.get('items')||[];
  const thirtyDays=new Date();thirtyDays.setDate(thirtyDays.getDate()+30);
  items.forEach(item=>{
    if(item.industryMeta?.expiryDate){
      const exp=new Date(item.industryMeta.expiryDate);
      if(exp<=thirtyDays&&exp>new Date()){
        const days=BillFlow.Utils.daysBetween(new Date(),exp);
        BillFlow.Store.addNotification({type:'expiry',title:'Expiry Warning',message:`${item.name} expires in ${days} days`,icon:'⏳'});
      }
    }
  });
}

function renderNotificationPanel(){
  const notifications=BillFlow.Store.get('notifications')||[];
  const unread=notifications.filter(n=>!n.read).length;
  return`
    <div class="notification-panel-header">
      <h3 style="font-size:var(--text-lg);font-weight:700">Notifications ${unread?`<span class="badge badge-danger" style="margin-left:.5rem">${unread}</span>`:''}</h3>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-ghost btn-sm" onclick="BillFlow.Notifications.markAllRead()">Mark all read</button>
        <button class="modal-close" onclick="BillFlow.Store.set('notificationPanelOpen',false);document.getElementById('notifPanel')?.remove()">✕</button>
      </div>
    </div>
    <div class="notification-panel-body">
      ${notifications.length===0?'<div class="empty-state"><div class="empty-state-icon">🔔</div><div class="empty-state-title">All caught up!</div><div class="empty-state-text">No notifications yet</div></div>':''}
      ${notifications.slice(0,50).map(n=>`
        <div class="notification-item ${n.read?'':'unread'}" onclick="BillFlow.Notifications.markRead('${n.id}')">
          <div class="notification-dot" style="background:${n.read?'var(--bg-hover)':'var(--primary-400)'}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-sm);font-weight:${n.read?'400':'600'}">${n.icon||'🔔'} ${n.title||''}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${n.message||''}</div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:4px">${BillFlow.Utils.timeAgo(n.date)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function markRead(id){
  const notifications=BillFlow.Store.get('notifications');
  const n=notifications.find(x=>x.id===id);
  if(n){n.read=true;await BillFlow.DB.put('notifications',n);BillFlow.Store.emit('notifications',notifications);}
}

async function markAllRead(){
  const notifications=BillFlow.Store.get('notifications');
  for(const n of notifications){if(!n.read){n.read=true;await BillFlow.DB.put('notifications',n);}}
  BillFlow.Store.emit('notifications',notifications);
}

function getUnreadCount(){
  return(BillFlow.Store.get('notifications')||[]).filter(n=>!n.read).length;
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.Notifications={showToast,success,error,warning,info,checkOverdueInvoices,checkLowStock,checkExpiry,renderNotificationPanel,markRead,markAllRead,getUnreadCount};
})();
