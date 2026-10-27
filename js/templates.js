(function(){
'use strict';

const TEMPLATES = {
  hotel: {
    id:'hotel', name:'Hotel / Lodge', icon:'🏨',
    terminology:{invoice:'Hotel Bill',customer:'Guest',item:'Service',quantity:'Qty',price:'Rate'},
    itemFields:[
      {key:'roomNo',label:'Room No.',type:'text'},
      {key:'checkIn',label:'Check-In',type:'date'},
      {key:'checkOut',label:'Check-Out',type:'date'},
      {key:'roomType',label:'Room Type',type:'select',options:['Standard','Deluxe','Suite','Presidential']},
      {key:'guestCount',label:'Guests',type:'number'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Room Tariff (≤₹1000)',rate:12},{name:'Room Tariff (₹1001-₹7500)',rate:12},
      {name:'Room Tariff (>₹7500)',rate:18},{name:'Restaurant',rate:5},{name:'Banquet',rate:18}
    ]},
    defaultCategories:['Room Charges','Restaurant','Laundry','Minibar','Spa','Transport','Banquet','Miscellaneous'],
    defaultUnits:['Night','Person','Trip','Piece','Kg'],
    features:['roomManagement','checkInOut','guestHistory'],
    color:'hsl(220, 80%, 55%)',
    description:'Room billing, check-in/out, minibar, laundry & restaurant charges'
  },
  pharmacy: {
    id:'pharmacy', name:'Pharmacy / Medical Store', icon:'💊',
    terminology:{invoice:'Sales Bill',customer:'Patient',item:'Medicine',quantity:'Qty',price:'MRP'},
    itemFields:[
      {key:'batchNo',label:'Batch No.',type:'text',required:true},
      {key:'expiryDate',label:'Expiry Date',type:'date',required:true},
      {key:'manufacturer',label:'Manufacturer',type:'text'},
      {key:'schedule',label:'Drug Schedule',type:'select',options:['H','H1','X','OTC']},
      {key:'prescriptionRef',label:'Rx Ref.',type:'text'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Essential Medicines (5%)',rate:5},{name:'General Medicines (12%)',rate:12},{name:'Premium/Imported (18%)',rate:18},{name:'Exempt',rate:0}
    ]},
    defaultCategories:['Tablets','Capsules','Syrups','Injections','Ointments','Surgical','OTC','Ayurvedic','Equipment'],
    defaultUnits:['Strip','Tablet','Bottle','Tube','Vial','Box','Piece'],
    features:['expiryAlerts','batchTracking','prescriptionLog'],
    color:'hsl(145, 70%, 45%)',
    description:'Drug schedules, expiry tracking, batch numbers, prescription linking'
  },
  retail: {
    id:'retail', name:'General Store / Retail', icon:'🏪',
    terminology:{invoice:'Sales Invoice',customer:'Customer',item:'Product',quantity:'Qty',price:'Price'},
    itemFields:[
      {key:'barcode',label:'Barcode',type:'text'},
      {key:'brand',label:'Brand',type:'text'},
      {key:'size',label:'Size/Variant',type:'text'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Essential Goods (0%)',rate:0},{name:'Basic Goods (5%)',rate:5},{name:'Standard (12%)',rate:12},{name:'Premium (18%)',rate:18},{name:'Luxury (28%)',rate:28}
    ]},
    defaultCategories:['Groceries','Dairy','Beverages','Snacks','Personal Care','Cleaning','Stationery','Electronics','Clothing'],
    defaultUnits:['Pcs','Kg','Ltr','Gm','Ml','Dozen','Pack','Box','Pair'],
    features:['barcodeScanning','stockAlerts','wholesaleRetailPricing'],
    color:'hsl(35, 85%, 55%)',
    description:'Barcode scanning, stock alerts, wholesale/retail pricing'
  },
  restaurant: {
    id:'restaurant', name:'Restaurant / Café', icon:'🍽️',
    terminology:{invoice:'Food Bill',customer:'Customer',item:'Dish',quantity:'Qty',price:'Price'},
    itemFields:[
      {key:'tableNo',label:'Table No.',type:'text'},
      {key:'orderType',label:'Order Type',type:'select',options:['Dine-in','Takeaway','Delivery']},
      {key:'isVeg',label:'Veg/Non-Veg',type:'select',options:['Veg','Non-Veg','Egg']}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Non-AC Restaurant (5%)',rate:5},{name:'AC Restaurant (5%)',rate:5},{name:'Restaurant in Hotel (18%)',rate:18}
    ]},
    defaultCategories:['Starters','Main Course','Breads','Rice','Desserts','Beverages','Combos','Add-ons'],
    defaultUnits:['Plate','Half','Full','Glass','Bottle','Pcs'],
    features:['tableManagement','kot','tipCalculation'],
    color:'hsl(0, 75%, 55%)',
    description:'Table management, KOT (Kitchen Order Token), tip calculation'
  },
  clinic: {
    id:'clinic', name:'Clinic / Hospital', icon:'🏥',
    terminology:{invoice:'Patient Bill',customer:'Patient',item:'Service',quantity:'Qty',price:'Fee'},
    itemFields:[
      {key:'doctorName',label:'Doctor',type:'text'},
      {key:'diagnosis',label:'Diagnosis',type:'text'},
      {key:'patientId',label:'Patient ID',type:'text'},
      {key:'insuranceClaim',label:'Insurance Claim',type:'select',options:['Yes','No','Pending']}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Healthcare (Exempt)',rate:0},{name:'Medicines (5%)',rate:5},{name:'Equipment/Prosthetics (12%)',rate:12}
    ]},
    defaultCategories:['Consultation','Lab Tests','Radiology','Procedures','Medicines','Room Charges','Surgical','Physiotherapy'],
    defaultUnits:['Visit','Test','Session','Night','Dose','Piece'],
    features:['patientRecords','insuranceBilling','appointmentTracking'],
    color:'hsl(190, 80%, 45%)',
    description:'Patient billing, consultation fees, lab tests, insurance claims'
  },
  salon: {
    id:'salon', name:'Salon / Spa', icon:'💇',
    terminology:{invoice:'Service Bill',customer:'Client',item:'Service',quantity:'Qty',price:'Price'},
    itemFields:[
      {key:'stylist',label:'Stylist/Therapist',type:'text'},
      {key:'duration',label:'Duration (min)',type:'number'},
      {key:'packageName',label:'Package',type:'text'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Beauty Services (18%)',rate:18},{name:'Products (18%)',rate:18},{name:'Wellness/Spa (18%)',rate:18}
    ]},
    defaultCategories:['Haircut','Coloring','Spa','Facial','Manicure','Pedicure','Makeup','Products','Packages'],
    defaultUnits:['Service','Session','Piece','Ml','Gm','Package'],
    features:['stylistTracking','packageBilling','appointmentBooking'],
    color:'hsl(310, 70%, 55%)',
    description:'Service + product billing, stylist tracking, packages'
  },
  workshop: {
    id:'workshop', name:'Auto Workshop', icon:'🔧',
    terminology:{invoice:'Job Card Bill',customer:'Vehicle Owner',item:'Part/Service',quantity:'Qty',price:'Rate'},
    itemFields:[
      {key:'vehicleNo',label:'Vehicle No.',type:'text',required:true},
      {key:'vehicleModel',label:'Vehicle Model',type:'text'},
      {key:'mileage',label:'Odometer (km)',type:'number'},
      {key:'jobType',label:'Job Type',type:'select',options:['Service','Repair','Accident','Modification']}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Labour (18%)',rate:18},{name:'Spare Parts (18%)',rate:18},{name:'Consumables (18%)',rate:18}
    ]},
    defaultCategories:['Labour','Engine Parts','Body Parts','Electrical','Tyres','Oils & Fluids','Accessories','Consumables'],
    defaultUnits:['Pcs','Ltr','Set','Pair','Hour','Job'],
    features:['vehicleTracking','jobCardManagement','warrantyTracking'],
    color:'hsl(25, 80%, 50%)',
    description:'Labor + parts billing, vehicle tracking, job cards'
  },
  freelancer: {
    id:'freelancer', name:'Freelancer / Agency', icon:'💻',
    terminology:{invoice:'Invoice',customer:'Client',item:'Service',quantity:'Hours',price:'Rate'},
    itemFields:[
      {key:'projectName',label:'Project',type:'text'},
      {key:'milestone',label:'Milestone',type:'text'},
      {key:'startDate',label:'Period Start',type:'date'},
      {key:'endDate',label:'Period End',type:'date'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'IT Services (18%)',rate:18},{name:'Consulting (18%)',rate:18},{name:'Export (0%)',rate:0}
    ]},
    defaultCategories:['Development','Design','Consulting','Content Writing','Marketing','SEO','Support','Training'],
    defaultUnits:['Hours','Days','Project','Milestone','Words','Pages'],
    features:['timeTracking','projectBilling','milestoneInvoicing'],
    color:'hsl(260, 70%, 60%)',
    description:'Hourly billing, project tracking, milestone invoicing'
  },
  electronics: {
    id:'electronics', name:'Electronics Store', icon:'📱',
    terminology:{invoice:'Sales Invoice',customer:'Customer',item:'Product',quantity:'Qty',price:'Price'},
    itemFields:[
      {key:'serialNo',label:'Serial Number',type:'text'},
      {key:'warrantyMonths',label:'Warranty (months)',type:'number'},
      {key:'brand',label:'Brand',type:'text'},
      {key:'model',label:'Model',type:'text'}
    ],
    taxRules:{type:'GST',categories:[
      {name:'Mobile & Accessories (12%)',rate:12},{name:'Electronics (18%)',rate:18},{name:'Premium Electronics (28%)',rate:28}
    ]},
    defaultCategories:['Mobiles','Laptops','TVs','Accessories','Cables','Storage','Audio','Cameras','Appliances'],
    defaultUnits:['Pcs','Set','Pair','Box','Bundle'],
    features:['serialTracking','warrantyManagement','amcContracts'],
    color:'hsl(200, 80%, 50%)',
    description:'Serial numbers, warranty tracking, AMC contracts'
  },
  custom: {
    id:'custom', name:'Custom Business', icon:'⚙️',
    terminology:{invoice:'Invoice',customer:'Customer',item:'Item',quantity:'Qty',price:'Price'},
    itemFields:[],
    taxRules:{type:'GST',categories:[
      {name:'Exempt (0%)',rate:0},{name:'Low (5%)',rate:5},{name:'Standard (12%)',rate:12},{name:'High (18%)',rate:18},{name:'Premium (28%)',rate:28}
    ]},
    defaultCategories:['Category 1','Category 2','Category 3'],
    defaultUnits:['Pcs','Kg','Ltr','Box','Pack','Hour','Day','Set'],
    features:[],
    color:'hsl(225, 60%, 55%)',
    description:'Fully configurable — define your own fields, categories, and rules'
  }
};

function getTemplate(id) { return TEMPLATES[id] || TEMPLATES.custom; }
function getAllTemplates() { return Object.values(TEMPLATES); }
function getTerminology(key) {
  const settings = window.BillFlow?.Store?.get('settings') || {};
  const t = getTemplate(settings.industry || 'retail');
  return t.terminology[key] || key;
}

window.BillFlow = window.BillFlow || {};
window.BillFlow.Templates = { TEMPLATES, getTemplate, getAllTemplates, getTerminology };
})();
