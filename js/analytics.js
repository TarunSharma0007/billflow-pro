(function(){
'use strict';
const {Utils,Store}=BillFlow;

function getRevenueData(period='week'){
  const invoices=Store.get('invoices').filter(i=>i.status!=='draft'&&i.status!=='cancelled');
  const now=new Date();
  let labels=[],data=[],start;
  
  if(period==='week'){
    for(let i=6;i>=0;i--){
      const d=new Date(now);d.setDate(d.getDate()-i);
      const key=d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-IN',{weekday:'short'}));
      data.push(invoices.filter(inv=>inv.invoiceDate===key).reduce((s,inv)=>s+(inv.grandTotal||0),0));
    }
  } else if(period==='month'){
    for(let i=29;i>=0;i--){
      const d=new Date(now);d.setDate(d.getDate()-i);
      const key=d.toISOString().split('T')[0];
      labels.push(d.getDate().toString());
      data.push(invoices.filter(inv=>inv.invoiceDate===key).reduce((s,inv)=>s+(inv.grandTotal||0),0));
    }
  } else if(period==='year'){
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for(let i=0;i<12;i++){
      labels.push(months[i]);
      data.push(invoices.filter(inv=>{const d=new Date(inv.invoiceDate);return d.getMonth()===i&&d.getFullYear()===now.getFullYear();}).reduce((s,inv)=>s+(inv.grandTotal||0),0));
    }
  }
  return{labels,data};
}

function getPaymentSplit(){
  const invoices=Store.get('invoices').filter(i=>i.status==='paid');
  const modes={cash:0,card:0,upi:0,credit:0,other:0};
  invoices.forEach(inv=>{
    const mode=inv.paymentMode||'cash';
    modes[mode]=(modes[mode]||0)+(inv.grandTotal||0);
  });
  return modes;
}

function getTodayStats(){
  const today=Utils.today();
  const invoices=Store.get('invoices');
  const todayInvoices=invoices.filter(i=>i.invoiceDate===today&&i.status!=='draft'&&i.status!=='cancelled');
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr=yesterday.toISOString().split('T')[0];
  const yesterdayInvoices=invoices.filter(i=>i.invoiceDate===yesterdayStr&&i.status!=='draft');
  
  const todayRevenue=todayInvoices.reduce((s,i)=>s+(i.grandTotal||0),0);
  const yesterdayRevenue=yesterdayInvoices.reduce((s,i)=>s+(i.grandTotal||0),0);
  const revenueChange=yesterdayRevenue?((todayRevenue-yesterdayRevenue)/yesterdayRevenue*100):0;
  
  const thisMonth=Utils.startOf('month');
  const monthInvoices=invoices.filter(i=>new Date(i.invoiceDate)>=thisMonth&&i.status!=='draft');
  const monthRevenue=monthInvoices.reduce((s,i)=>s+(i.grandTotal||0),0);
  
  const unpaidAmount=invoices.filter(i=>i.status==='unpaid'||i.status==='overdue'||i.status==='partial').reduce((s,i)=>s+((i.grandTotal||0)-(i.amountPaid||0)),0);
  
  return{
    todayRevenue,todayInvoiceCount:todayInvoices.length,
    yesterdayRevenue,revenueChange:Math.round(revenueChange*10)/10,
    monthRevenue,monthInvoiceCount:monthInvoices.length,
    totalCustomers:Store.get('customers').length,
    unpaidAmount,
    totalInvoices:invoices.length
  };
}

function getTopItems(limit=5){
  const invoices=Store.get('invoices').filter(i=>i.status!=='draft'&&i.status!=='cancelled');
  const itemMap={};
  invoices.forEach(inv=>{
    (inv.items||[]).forEach(item=>{
      const key=item.itemId||item.name;
      if(!itemMap[key])itemMap[key]={name:item.name,qty:0,revenue:0,count:0};
      itemMap[key].qty+=(Number(item.quantity)||0);
      itemMap[key].revenue+=(item.total||0);
      itemMap[key].count++;
    });
  });
  return Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,limit);
}

function getTopCustomers(limit=5){
  const invoices=Store.get('invoices').filter(i=>i.status!=='draft');
  const custMap={};
  invoices.forEach(inv=>{
    if(!inv.customerId)return;
    if(!custMap[inv.customerId])custMap[inv.customerId]={id:inv.customerId,name:inv.customerName,total:0,count:0};
    custMap[inv.customerId].total+=(inv.grandTotal||0);
    custMap[inv.customerId].count++;
  });
  return Object.values(custMap).sort((a,b)=>b.total-a.total).slice(0,limit);
}

function getTaxSummary(startDate,endDate){
  const invoices=Store.get('invoices').filter(i=>{
    if(i.status==='draft'||i.status==='cancelled')return false;
    const d=new Date(i.invoiceDate);
    return(!startDate||d>=new Date(startDate))&&(!endDate||d<=new Date(endDate));
  });
  
  const summary={totalTaxable:0,totalTax:0,byRate:{}};
  invoices.forEach(inv=>{
    summary.totalTaxable+=(inv.taxableAmount||0);
    summary.totalTax+=(inv.taxAmount||0);
    (inv.taxBreakdown||[]).forEach(tb=>{
      if(!summary.byRate[tb.rate])summary.byRate[tb.rate]={rate:tb.rate,taxable:0,tax:0,invoices:0};
      summary.byRate[tb.rate].taxable+=tb.taxable;
      summary.byRate[tb.rate].tax+=tb.tax;
      summary.byRate[tb.rate].invoices++;
    });
  });
  return{...summary,byRate:Object.values(summary.byRate).sort((a,b)=>a.rate-b.rate),invoiceCount:invoices.length};
}

function getPaymentAging(){
  const invoices=Store.get('invoices').filter(i=>i.status==='unpaid'||i.status==='overdue'||i.status==='partial');
  const buckets={'0-30':0,'31-60':0,'61-90':0,'90+':0};
  invoices.forEach(inv=>{
    const days=Utils.daysBetween(inv.invoiceDate);
    const outstanding=(inv.grandTotal||0)-(inv.amountPaid||0);
    if(days<=30)buckets['0-30']+=outstanding;
    else if(days<=60)buckets['31-60']+=outstanding;
    else if(days<=90)buckets['61-90']+=outstanding;
    else buckets['90+']+=outstanding;
  });
  return buckets;
}

function getInventoryValuation(){
  const items=Store.get('items');
  let totalCost=0,totalRetail=0;
  items.forEach(item=>{
    totalCost+=(item.costPrice||0)*(item.currentStock||0);
    totalRetail+=(item.sellingPrice||0)*(item.currentStock||0);
  });
  return{totalCost,totalRetail,margin:totalRetail-totalCost,itemCount:items.length,totalUnits:items.reduce((s,i)=>s+(i.currentStock||0),0)};
}

function detectAnomalies(){
  const invoices=Store.get('invoices').filter(i=>i.status!=='draft');
  if(invoices.length<5)return[];
  
  const amounts=invoices.map(i=>i.grandTotal||0);
  const mean=amounts.reduce((s,a)=>s+a,0)/amounts.length;
  const stdDev=Math.sqrt(amounts.reduce((s,a)=>s+Math.pow(a-mean,2),0)/amounts.length);
  const threshold=mean+2*stdDev;
  
  const anomalies=[];
  invoices.slice(-20).forEach(inv=>{
    if(inv.grandTotal>threshold){
      anomalies.push({type:'highValue',invoice:inv,message:`Invoice ${inv.invoiceNo} (${Utils.formatCurrency(inv.grandTotal)}) is unusually high`,severity:'warning'});
    }
  });
  return anomalies;
}

let chartInstances={};
function renderChart(canvasId,config){
  if(chartInstances[canvasId]){chartInstances[canvasId].destroy();}
  const ctx=document.getElementById(canvasId);
  if(!ctx)return null;
  chartInstances[canvasId]=new Chart(ctx,config);
  return chartInstances[canvasId];
}

function destroyChart(canvasId){
  if(chartInstances[canvasId]){chartInstances[canvasId].destroy();delete chartInstances[canvasId];}
}

function destroyAllCharts(){
  Object.keys(chartInstances).forEach(destroyChart);
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.Analytics={getRevenueData,getPaymentSplit,getTodayStats,getTopItems,getTopCustomers,getTaxSummary,getPaymentAging,getInventoryValuation,detectAnomalies,renderChart,destroyChart,destroyAllCharts};
})();
