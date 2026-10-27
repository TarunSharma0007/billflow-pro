(function(){
'use strict';
const Utils = {
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);
    });
  },
  shortId() { return Math.random().toString(36).substring(2,9).toUpperCase(); },
  
  formatDate(date, format='short') {
    const d=new Date(date); if(isNaN(d.getTime())) return '—';
    const opts = {
      full:{weekday:'long',year:'numeric',month:'long',day:'numeric'},
      long:{year:'numeric',month:'long',day:'numeric'},
      short:{year:'numeric',month:'short',day:'numeric'},
      numeric:{year:'numeric',month:'2-digit',day:'2-digit'},
      time:{hour:'2-digit',minute:'2-digit'},
      datetime:{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}
    };
    if(format==='iso') return d.toISOString().split('T')[0];
    return d.toLocaleString('en-IN', opts[format]||opts.short);
  },
  
  formatCurrency(amount, currency) {
    currency = currency || (window.BillFlow?.Store?.get('settings')?.currency) || 'INR';
    const n=Number(amount)||0;
    const symbols={INR:'₹',USD:'$',EUR:'€',GBP:'£',AED:'د.إ',JPY:'¥',AUD:'A$',CAD:'C$',SGD:'S$',MYR:'RM'};
    return (symbols[currency]||currency+' ')+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  },
  
  formatNumber(n,d=0) { return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  formatPercent(v,d=1) { return Number(v||0).toFixed(d)+'%'; },
  
  debounce(fn,delay=300) { let t; return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),delay);}; },
  throttle(fn,limit=100) { let f; return function(...a){if(!f){fn.apply(this,a);f=true;setTimeout(()=>f=false,limit);}}; },
  deepClone(o) { return JSON.parse(JSON.stringify(o)); },
  
  timeAgo(date) {
    const s=Math.floor((Date.now()-new Date(date))/1000);
    const intervals=[{l:'year',s:31536000},{l:'month',s:2592000},{l:'week',s:604800},{l:'day',s:86400},{l:'hour',s:3600},{l:'minute',s:60},{l:'second',s:1}];
    for(const i of intervals){const c=Math.floor(s/i.s);if(c>=1)return`${c} ${i.l}${c!==1?'s':''} ago`;}
    return 'just now';
  },
  
  searchFilter(items,query,fields) {
    if(!query) return items;
    const q=query.toLowerCase().trim();
    return items.filter(item=>fields.some(f=>{
      const v=f.split('.').reduce((o,k)=>o?.[k],item);
      return String(v||'').toLowerCase().includes(q);
    }));
  },
  
  sortBy(items,key,dir='asc') {
    return [...items].sort((a,b)=>{
      let va=key.split('.').reduce((o,k)=>o?.[k],a), vb=key.split('.').reduce((o,k)=>o?.[k],b);
      if(typeof va==='string')va=va.toLowerCase(); if(typeof vb==='string')vb=vb.toLowerCase();
      if(va<vb)return dir==='asc'?-1:1; if(va>vb)return dir==='asc'?1:-1; return 0;
    });
  },
  
  groupBy(items,key) {
    return items.reduce((g,item)=>{
      const v=key.split('.').reduce((o,k)=>o?.[k],item)||'Other';
      (g[v]=g[v]||[]).push(item); return g;
    },{});
  },
  
  generateInvoiceNo(prefix='INV',counter=1) {
    const y=new Date().getFullYear();
    return `${prefix}-${y}-${String(counter).padStart(4,'0')}`;
  },
  
  daysBetween(d1,d2) { return Math.floor((new Date(d2||Date.now())-new Date(d1))/(864e5)); },
  today() { return new Date().toISOString().split('T')[0]; },
  now() { return new Date().toISOString(); },
  
  startOf(unit) {
    const d=new Date();
    if(unit==='day'){d.setHours(0,0,0,0);}
    else if(unit==='week'){d.setDate(d.getDate()-d.getDay());d.setHours(0,0,0,0);}
    else if(unit==='month'){d.setDate(1);d.setHours(0,0,0,0);}
    else if(unit==='year'){d.setMonth(0,1);d.setHours(0,0,0,0);}
    return d;
  },
  
  escapeHtml(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; },
  
  createElement(html) {
    const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild;
  },
  
  animateCounter(el,target,duration=1000,prefix='',suffix='') {
    const start=parseFloat(el.textContent.replace(/[^0-9.-]/g,''))||0;
    const diff=target-start; const startTime=performance.now();
    function update(currentTime) {
      const elapsed=currentTime-startTime;
      const progress=Math.min(elapsed/duration,1);
      const eased=1-Math.pow(1-progress,3);
      const current=start+diff*eased;
      el.textContent=prefix+Math.round(current).toLocaleString('en-IN')+suffix;
      if(progress<1)requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  },
  
  getStatusColor(s) {
    return{paid:'var(--success)',unpaid:'var(--warning)',overdue:'var(--danger)',draft:'var(--text-tertiary)',partial:'var(--info)',cancelled:'var(--danger)',active:'var(--success)',inactive:'var(--text-tertiary)'}[s]||'var(--text-secondary)';
  },
  getStatusBadge(s) {
    return{paid:'badge-success',unpaid:'badge-warning',overdue:'badge-danger',draft:'badge-neutral',partial:'badge-info',cancelled:'badge-danger',active:'badge-success',inactive:'badge-neutral'}[s]||'badge-neutral';
  },
  
  exportCSV(data,filename) {
    if(!data.length)return; const h=Object.keys(data[0]);
    const csv=[h.join(','),...data.map(r=>h.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const b=new Blob([csv],{type:'text/csv'}); const u=URL.createObjectURL(b);
    const a=document.createElement('a');a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u);
  },
  
  exportJSON(data,filename) {
    const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(b); const a=document.createElement('a');a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u);
  },
  
  async importJSON() {
    return new Promise((resolve,reject)=>{
      const i=document.createElement('input');i.type='file';i.accept='.json';
      i.onchange=async e=>{try{resolve(JSON.parse(await e.target.files[0].text()));}catch(err){reject(err);}};
      i.click();
    });
  },
  
  getInitials(name) {
    return (name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  },
  
  generateColor(str) {
    let hash=0; for(let i=0;i<(str||'').length;i++){hash=str.charCodeAt(i)+((hash<<5)-hash);}
    const h=hash%360; return `hsl(${Math.abs(h)}, 65%, 55%)`;
  },
  
  paginate(items,page=1,perPage=20) {
    const total=items.length; const totalPages=Math.ceil(total/perPage);
    const start=(page-1)*perPage;
    return { items:items.slice(start,start+perPage), page, perPage, total, totalPages };
  },

  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-header"><h3 class="modal-title">Confirm</h3></div>
          <div class="modal-body"><p style="font-size:var(--text-sm)">${message}</p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirmNo">Cancel</button>
            <button class="btn btn-danger" id="confirmYes">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmYes').onclick=()=>{overlay.remove();resolve(true);};
      overlay.querySelector('#confirmNo').onclick=()=>{overlay.remove();resolve(false);};
    });
  }
};

window.BillFlow = window.BillFlow || {};
window.BillFlow.Utils = Utils;
})();
