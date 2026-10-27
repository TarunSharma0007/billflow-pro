(function(){
'use strict';
const {Utils,Store,TaxEngine,Loyalty,DB,Notifications}=BillFlow;

async function createInvoice(data){
  const invoiceNo=await DB.getNextInvoiceNumber();
  const invoice={
    id:Utils.uuid(),invoiceNo,
    customerId:data.customerId||null,
    customerName:data.customerName||'Walk-in Customer',
    items:data.items||[],
    invoiceDate:data.invoiceDate||Utils.today(),
    dueDate:data.dueDate||null,
    status:'unpaid',
    paymentMode:data.paymentMode||'cash',
    amountPaid:Number(data.amountPaid)||0,
    notes:data.notes||'',
    terms:data.terms||'',
    invoiceDiscount:data.invoiceDiscount||{},
    ...TaxEngine.calculateInvoiceTotals(data.items||[],data.invoiceDiscount),
    createdAt:Utils.now(),updatedAt:Utils.now(),
    industryMeta:data.industryMeta||{}
  };
  
  invoice.status=TaxEngine.getPaymentStatus(invoice);
  
  // Update inventory
  for(const item of invoice.items){
    if(item.itemId){
      const invItem=Store.getItem(item.itemId);
      if(invItem){
        const newStock=Math.max(0,(invItem.currentStock||0)-(Number(item.quantity)||0));
        await Store.saveItem({...invItem,currentStock:newStock,updatedAt:Utils.now()});
        if(newStock<=invItem.minStock){
          Notifications.warning('Low Stock',`${invItem.name}: ${newStock} ${invItem.unit||'pcs'} remaining`);
        }
      }
    }
  }
  
  // Award loyalty points
  if(invoice.customerId&&invoice.status==='paid'){
    await Loyalty.awardPoints(invoice.customerId,invoice.grandTotal);
  }
  
  await Store.saveInvoice(invoice);
  await Store.addActivity('invoice',`Invoice ${invoiceNo} created for ${invoice.customerName}`,{invoiceId:invoice.id,amount:invoice.grandTotal});
  Notifications.success('Invoice Created',`${invoiceNo} — ${Utils.formatCurrency(invoice.grandTotal)}`);
  return invoice;
}

async function updateInvoice(id,data){
  const existing=Store.getInvoice(id);
  if(!existing)throw new Error('Invoice not found');
  
  const totals=TaxEngine.calculateInvoiceTotals(data.items||existing.items,data.invoiceDiscount||existing.invoiceDiscount);
  const updated={...existing,...data,...totals,updatedAt:Utils.now()};
  updated.status=TaxEngine.getPaymentStatus(updated);
  
  await Store.saveInvoice(updated);
  return updated;
}

async function recordPayment(invoiceId,amount,mode='cash'){
  const invoice=Store.getInvoice(invoiceId);
  if(!invoice)throw new Error('Invoice not found');
  
  const payment={id:Utils.uuid(),invoiceId,amount:Number(amount),mode,date:Utils.now()};
  await DB.put('payments',payment);
  
  const newPaid=(invoice.amountPaid||0)+Number(amount);
  const updated={...invoice,amountPaid:Math.min(newPaid,invoice.grandTotal),paymentMode:mode,updatedAt:Utils.now()};
  updated.status=TaxEngine.getPaymentStatus(updated);
  
  if(updated.status==='paid'&&invoice.customerId){
    await Loyalty.awardPoints(invoice.customerId,invoice.grandTotal);
  }
  
  await Store.saveInvoice(updated);
  await Store.addActivity('payment',`Payment of ${Utils.formatCurrency(amount)} received for ${invoice.invoiceNo}`,{invoiceId,amount});
  Notifications.success('Payment Recorded',`${Utils.formatCurrency(amount)} for ${invoice.invoiceNo}`);
  return updated;
}

async function createCreditNote(invoiceId,items,reason=''){
  const invoice=Store.getInvoice(invoiceId);
  if(!invoice)throw new Error('Invoice not found');
  
  const creditNote={
    id:Utils.uuid(),
    invoiceNo:'CN-'+invoice.invoiceNo,
    customerId:invoice.customerId,
    customerName:invoice.customerName,
    items:items.map(i=>({...i,quantity:-Math.abs(i.quantity)})),
    invoiceDate:Utils.today(),
    status:'credit-note',
    notes:`Credit Note for ${invoice.invoiceNo}. Reason: ${reason}`,
    originalInvoiceId:invoiceId,
    ...TaxEngine.calculateInvoiceTotals(items.map(i=>({...i,quantity:Math.abs(i.quantity)}))),
    createdAt:Utils.now(),updatedAt:Utils.now()
  };
  creditNote.grandTotal=-Math.abs(creditNote.grandTotal);
  
  // Return stock
  for(const item of items){
    if(item.itemId){
      const invItem=Store.getItem(item.itemId);
      if(invItem){
        await Store.saveItem({...invItem,currentStock:(invItem.currentStock||0)+Math.abs(item.quantity),updatedAt:Utils.now()});
      }
    }
  }
  
  await Store.saveInvoice(creditNote);
  await Store.addActivity('credit-note',`Credit note ${creditNote.invoiceNo} created`,{invoiceId:creditNote.id});
  return creditNote;
}

function suggestItems(customerId){
  if(!customerId)return[];
  const invoices=Store.get('invoices').filter(i=>i.customerId===customerId);
  const itemCounts={};
  invoices.forEach(inv=>{
    (inv.items||[]).forEach(item=>{
      const key=item.itemId||item.name;
      if(!itemCounts[key])itemCounts[key]={...item,count:0};
      itemCounts[key].count++;
    });
  });
  return Object.values(itemCounts).sort((a,b)=>b.count-a.count).slice(0,5);
}

function detectDuplicate(data){
  const invoices=Store.get('invoices');
  const recent=invoices.filter(i=>{
    const diff=Utils.daysBetween(i.invoiceDate);
    return Math.abs(diff)<1&&i.customerId===data.customerId&&i.status!=='draft';
  });
  if(recent.length>0){
    const similar=recent.find(i=>Math.abs(i.grandTotal-(data.grandTotal||0))<10);
    if(similar)return similar;
  }
  return null;
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.BillingEngine={createInvoice,updateInvoice,recordPayment,createCreditNote,suggestItems,detectDuplicate};
})();
