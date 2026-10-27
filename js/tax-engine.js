(function(){
'use strict';
const {Utils,Templates}=BillFlow;

function getTaxConfig(){
  const settings=BillFlow.Store.get('settings');
  return Templates.getTemplate(settings.industry||'retail').taxRules;
}

function calculateItemTax(amount,taxRate,inclusive=false){
  taxRate=Number(taxRate)||0;
  if(inclusive){
    const taxAmount=amount-(amount*100/(100+taxRate));
    return{taxableAmount:amount-taxAmount,taxAmount:Math.round(taxAmount*100)/100,rate:taxRate};
  }
  const taxAmount=amount*taxRate/100;
  return{taxableAmount:amount,taxAmount:Math.round(taxAmount*100)/100,rate:taxRate};
}

function calculateGST(amount,rate,isInterState=false){
  const total=Math.round(amount*rate/100*100)/100;
  if(isInterState){return{igst:total,cgst:0,sgst:0,total};}
  const half=Math.round(total/2*100)/100;
  return{igst:0,cgst:half,sgst:total-half,total};
}

function calculateLineItem(item){
  const qty=Number(item.quantity)||0;
  const price=Number(item.price)||0;
  const discountPct=Number(item.discountPercent)||0;
  const discountAmt=Number(item.discountAmount)||0;
  const taxRate=Number(item.taxRate)||0;
  
  let subtotal=qty*price;
  let discount=discountAmt||(subtotal*discountPct/100);
  discount=Math.min(discount,subtotal);
  const taxableAmount=subtotal-discount;
  const taxInfo=calculateItemTax(taxableAmount,taxRate,item.taxInclusive);
  
  return{
    subtotal:Math.round(subtotal*100)/100,
    discount:Math.round(discount*100)/100,
    taxableAmount:Math.round(taxInfo.taxableAmount*100)/100,
    taxAmount:taxInfo.taxAmount,
    taxRate,
    total:Math.round((taxInfo.taxableAmount+taxInfo.taxAmount)*100)/100
  };
}

function calculateInvoiceTotals(items,invoiceDiscount={},roundOff=true){
  let subtotal=0,totalDiscount=0,totalTaxable=0,totalTax=0;
  const taxBreakdown={};
  
  const calculated=items.map(item=>{
    const calc=calculateLineItem(item);
    subtotal+=calc.subtotal;
    totalDiscount+=calc.discount;
    totalTaxable+=calc.taxableAmount;
    totalTax+=calc.taxAmount;
    
    const rate=calc.taxRate;
    if(!taxBreakdown[rate])taxBreakdown[rate]={rate,taxable:0,tax:0,items:0};
    taxBreakdown[rate].taxable+=calc.taxableAmount;
    taxBreakdown[rate].tax+=calc.taxAmount;
    taxBreakdown[rate].items++;
    
    return{...item,...calc};
  });
  
  // Apply invoice-level discount
  let invoiceDiscountAmt=0;
  if(invoiceDiscount.percent){invoiceDiscountAmt=totalTaxable*invoiceDiscount.percent/100;}
  if(invoiceDiscount.amount){invoiceDiscountAmt=invoiceDiscount.amount;}
  invoiceDiscountAmt=Math.min(invoiceDiscountAmt,totalTaxable);
  
  const adjustedTaxable=totalTaxable-invoiceDiscountAmt;
  const adjustedTax=totalTaxable>0?totalTax*(adjustedTaxable/totalTaxable):0;
  
  let grandTotal=adjustedTaxable+adjustedTax;
  let roundOffAmt=0;
  if(roundOff){
    roundOffAmt=Math.round(grandTotal)-grandTotal;
    grandTotal=Math.round(grandTotal);
  }
  
  return{
    items:calculated,
    subtotal:Math.round(subtotal*100)/100,
    itemDiscount:Math.round(totalDiscount*100)/100,
    invoiceDiscount:Math.round(invoiceDiscountAmt*100)/100,
    totalDiscount:Math.round((totalDiscount+invoiceDiscountAmt)*100)/100,
    taxableAmount:Math.round(adjustedTaxable*100)/100,
    taxAmount:Math.round(adjustedTax*100)/100,
    taxBreakdown:Object.values(taxBreakdown),
    roundOff:Math.round(roundOffAmt*100)/100,
    grandTotal,
    totalItems:items.length,
    totalQty:items.reduce((s,i)=>s+(Number(i.quantity)||0),0)
  };
}

function getPaymentStatus(invoice){
  const paid=Number(invoice.amountPaid)||0;
  const total=Number(invoice.grandTotal)||0;
  if(paid>=total)return'paid';
  if(paid>0)return'partial';
  if(invoice.dueDate&&new Date(invoice.dueDate)<new Date())return'overdue';
  if(invoice.status==='draft')return'draft';
  return'unpaid';
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.TaxEngine={calculateItemTax,calculateGST,calculateLineItem,calculateInvoiceTotals,getTaxConfig,getPaymentStatus};
})();
