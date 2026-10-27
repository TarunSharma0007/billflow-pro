(function(){
'use strict';
const {Utils,Store,Templates}=BillFlow;

function generateInvoicePDF(invoice){
  const settings=Store.get('settings');
  const template=Templates.getTemplate(settings.industry||'retail');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF('p','mm','a4');
  const w=doc.internal.pageSize.getWidth();
  const margin=15;let y=20;

  // Header gradient bar
  doc.setFillColor(67,56,202);
  doc.rect(0,0,w,35,'F');
  doc.setFillColor(99,102,241);
  doc.rect(0,30,w,8,'F');

  // Company name
  doc.setTextColor(255,255,255);
  doc.setFontSize(20);doc.setFont('helvetica','bold');
  doc.text(settings.businessName||'BillFlow Pro',margin,18);
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(settings.address||'',margin,26);
  
  // Invoice title
  doc.setFontSize(14);
  doc.text(template.terminology.invoice||'INVOICE',w-margin,18,{align:'right'});
  doc.setFontSize(10);
  doc.text(invoice.invoiceNo||'',w-margin,26,{align:'right'});

  y=48;
  doc.setTextColor(60,60,60);

  // Info section
  doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(120,120,120);
  doc.text('BILL TO',margin,y);
  doc.text('DETAILS',w/2+10,y);
  y+=6;
  
  doc.setFont('helvetica','bold');doc.setTextColor(30,30,30);doc.setFontSize(11);
  doc.text(invoice.customerName||'Walk-in Customer',margin,y);
  
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  const customer=invoice.customerId?Store.getCustomer(invoice.customerId):null;
  if(customer){
    y+=5;
    if(customer.phone)doc.text('📞 '+customer.phone,margin,y);
    y+=4;
    if(customer.email)doc.text('✉ '+customer.email,margin,y);
    if(customer.address){y+=4;doc.text(customer.address,margin,y);}
    if(customer.gstin){y+=4;doc.text('GSTIN: '+customer.gstin,margin,y);}
  }
  
  // Details right side
  let dy=48+6;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(60,60,60);
  const details=[
    ['Date',Utils.formatDate(invoice.invoiceDate)],
    ['Due Date',invoice.dueDate?Utils.formatDate(invoice.dueDate):'On Receipt'],
    ['Status',invoice.status?.toUpperCase()||'UNPAID'],
    ['Payment',invoice.paymentMode?.toUpperCase()||'CASH']
  ];
  if(settings.gstin)details.push(['GSTIN',settings.gstin]);
  
  details.forEach(([label,value])=>{
    doc.setFont('helvetica','normal');doc.setTextColor(120,120,120);
    doc.text(label+':',w/2+10,dy);
    doc.setFont('helvetica','bold');doc.setTextColor(30,30,30);
    doc.text(value,w/2+45,dy);
    dy+=5;
  });
  
  y=Math.max(y,dy)+12;

  // Items Table Header
  doc.setFillColor(245,245,250);
  doc.rect(margin,y-4,w-2*margin,8,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(100,100,100);
  const cols=[margin,margin+8,margin+80,margin+100,margin+120,margin+140,w-margin];
  doc.text('#',cols[0],y);
  doc.text('ITEM',cols[1],y);
  doc.text('QTY',cols[2],y);
  doc.text('RATE',cols[3],y);
  doc.text('TAX',cols[4],y);
  doc.text('AMOUNT',cols[5],y,{align:'right'});
  
  y+=8;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(40,40,40);
  
  (invoice.items||[]).forEach((item,idx)=>{
    if(y>260){doc.addPage();y=20;}
    doc.text(String(idx+1),cols[0],y);
    doc.text(String(item.name||'').substring(0,40),cols[1],y);
    doc.text(String(item.quantity||0),cols[2],y);
    doc.text(Utils.formatCurrency(item.price||0).replace(/[₹$€£]/,''),cols[3],y);
    doc.text((item.taxRate||0)+'%',cols[4],y);
    doc.setFont('helvetica','bold');
    doc.text(Utils.formatCurrency(item.total||0).replace(/[₹$€£]/,''),cols[5],y,{align:'right'});
    doc.setFont('helvetica','normal');
    y+=6;
    // Divider
    doc.setDrawColor(230,230,230);doc.line(margin,y-2,w-margin,y-2);
  });
  
  y+=6;
  // Summary
  const summaryX=w/2+20;
  const summaryRows=[
    ['Subtotal',Utils.formatCurrency(invoice.subtotal||0)],
    ['Discount','-'+Utils.formatCurrency(invoice.totalDiscount||0)],
    ['Taxable Amount',Utils.formatCurrency(invoice.taxableAmount||0)],
    ['Tax',Utils.formatCurrency(invoice.taxAmount||0)],
  ];
  if(invoice.roundOff)summaryRows.push(['Round Off',Utils.formatCurrency(invoice.roundOff)]);
  
  doc.setFontSize(9);
  summaryRows.forEach(([label,value])=>{
    doc.setFont('helvetica','normal');doc.setTextColor(100,100,100);
    doc.text(label,summaryX,y);
    doc.setFont('helvetica','bold');doc.setTextColor(40,40,40);
    doc.text(value,w-margin,y,{align:'right'});
    y+=6;
  });
  
  // Grand Total
  y+=2;
  doc.setFillColor(67,56,202);
  doc.rect(summaryX-5,y-5,w-margin-summaryX+10,10,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text('GRAND TOTAL',summaryX,y+1);
  doc.text(Utils.formatCurrency(invoice.grandTotal||0),w-margin,y+1,{align:'right'});
  
  y+=16;
  // Amount in words
  doc.setTextColor(100,100,100);doc.setFontSize(8);doc.setFont('helvetica','italic');
  doc.text('Amount in words: '+numberToWords(invoice.grandTotal||0)+' only',margin,y);
  
  // Notes
  if(invoice.notes){
    y+=10;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,100,100);
    doc.text('Notes: '+invoice.notes,margin,y,{maxWidth:w-2*margin});
  }
  
  // Footer
  y=doc.internal.pageSize.getHeight()-15;
  doc.setDrawColor(200,200,200);doc.line(margin,y-5,w-margin,y-5);
  doc.setFontSize(7);doc.setTextColor(150,150,150);doc.setFont('helvetica','normal');
  doc.text('Generated by BillFlow Pro — Thank you for your business!',w/2,y,{align:'center'});
  
  return doc;
}

function downloadPDF(invoice){
  const doc=generateInvoicePDF(invoice);
  doc.save(`${invoice.invoiceNo||'invoice'}.pdf`);
}

function printInvoice(invoice){
  const doc=generateInvoicePDF(invoice);
  doc.autoPrint();
  window.open(doc.output('bloburl'),'_blank');
}

function numberToWords(num){
  if(num===0)return'Zero';
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const scales=['','Thousand','Lakh','Crore'];
  
  num=Math.round(Math.abs(num));
  if(num<20)return ones[num];
  
  let words='';
  // Indian numbering system
  const parts=[];
  parts.push(num%1000);num=Math.floor(num/1000);
  while(num>0){parts.push(num%100);num=Math.floor(num/100);}
  
  for(let i=parts.length-1;i>=0;i--){
    const n=parts[i];if(n===0)continue;
    if(n<20)words+=ones[n]+' ';
    else words+=tens[Math.floor(n/10)]+' '+(n%10?ones[n%10]+' ':'');
    if(i>0)words+=scales[i]+' ';
  }
  return words.trim()+' Rupees';
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.PDFGenerator={generateInvoicePDF,downloadPDF,printInvoice,numberToWords};
})();
