(function(){
'use strict';
const listeners={};
const state={
  settings:{industry:'retail',businessName:'',currency:'INR',taxType:'GST',theme:'dark',invoicePrefix:'INV'},
  currentPage:'dashboard',
  invoices:[],customers:[],items:[],notifications:[],activities:[],
  isSetupDone:false,
  sidebarCollapsed:false,
  notificationPanelOpen:false
};

function get(key){ return key?key.split('.').reduce((o,k)=>o?.[k],state):state; }
function set(key,value){
  const keys=key.split('.'); let obj=state;
  for(let i=0;i<keys.length-1;i++){obj=obj[keys[i]]=obj[keys[i]]||{};}
  obj[keys[keys.length-1]]=value;
  emit(key,value);emit('*',{key,value});
}

function on(event,fn){(listeners[event]=listeners[event]||[]).push(fn);return()=>off(event,fn);}
function off(event,fn){if(listeners[event])listeners[event]=listeners[event].filter(f=>f!==fn);}
function emit(event,data){(listeners[event]||[]).forEach(fn=>{try{fn(data);}catch(e){console.error('Store listener error:',e);}});}

async function loadFromDB(){
  try{
    const [invoices,customers,items,notifications,activities,settings]=await Promise.all([
      BillFlow.DB.getAll('invoices'),BillFlow.DB.getAll('customers'),BillFlow.DB.getAll('items'),
      BillFlow.DB.getAll('notifications'),BillFlow.DB.getAll('activities'),BillFlow.DB.getAllSettings()
    ]);
    state.invoices=invoices||[];state.customers=customers||[];state.items=items||[];
    state.notifications=notifications||[];state.activities=(activities||[]).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100);
    if(settings&&Object.keys(settings).length>0){
      Object.assign(state.settings,settings);
      state.isSetupDone=!!settings.businessName;
    }
    emit('dataLoaded',state);
  }catch(e){console.error('Failed to load from DB:',e);}
}

async function saveInvoice(invoice){
  await BillFlow.DB.put('invoices',invoice);
  const idx=state.invoices.findIndex(i=>i.id===invoice.id);
  if(idx>=0)state.invoices[idx]=invoice;else state.invoices.push(invoice);
  emit('invoices',state.invoices);
}

async function saveCustomer(customer){
  await BillFlow.DB.put('customers',customer);
  const idx=state.customers.findIndex(c=>c.id===customer.id);
  if(idx>=0)state.customers[idx]=customer;else state.customers.push(customer);
  emit('customers',state.customers);
}

async function saveItem(item){
  await BillFlow.DB.put('items',item);
  const idx=state.items.findIndex(i=>i.id===item.id);
  if(idx>=0)state.items[idx]=item;else state.items.push(item);
  emit('items',state.items);
}

async function deleteInvoice(id){
  await BillFlow.DB.remove('invoices',id);
  state.invoices=state.invoices.filter(i=>i.id!==id);
  emit('invoices',state.invoices);
}

async function deleteCustomer(id){
  await BillFlow.DB.remove('customers',id);
  state.customers=state.customers.filter(c=>c.id!==id);
  emit('customers',state.customers);
}

async function deleteItem(id){
  await BillFlow.DB.remove('items',id);
  state.items=state.items.filter(i=>i.id!==id);
  emit('items',state.items);
}

async function addNotification(notification){
  const n={id:BillFlow.Utils.uuid(),read:false,date:new Date().toISOString(),...notification};
  await BillFlow.DB.put('notifications',n);
  state.notifications.unshift(n);
  emit('notifications',state.notifications);
  return n;
}

async function addActivity(type,message,meta={}){
  const a={id:BillFlow.Utils.uuid(),type,message,meta,date:new Date().toISOString()};
  await BillFlow.DB.put('activities',a);
  state.activities.unshift(a);
  if(state.activities.length>100)state.activities=state.activities.slice(0,100);
  emit('activities',state.activities);
}

async function saveSetting(key,value){
  state.settings[key]=value;
  await BillFlow.DB.putSetting(key,value);
  emit('settings',state.settings);
  emit('settings.'+key,value);
}

function getCustomer(id){ return state.customers.find(c=>c.id===id); }
function getItem(id){ return state.items.find(i=>i.id===id); }
function getInvoice(id){ return state.invoices.find(i=>i.id===id); }

window.BillFlow=window.BillFlow||{};
window.BillFlow.Store={get,set,on,off,emit,loadFromDB,saveInvoice,saveCustomer,saveItem,deleteInvoice,deleteCustomer,deleteItem,addNotification,addActivity,saveSetting,getCustomer,getItem,getInvoice};
})();
