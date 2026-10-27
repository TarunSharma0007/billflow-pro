(function(){
'use strict';
const DB_NAME='BillFlowPro';const DB_VERSION=1;
const STORES=['invoices','customers','items','payments','activities','notifications','settings'];
let dbInstance=null;

function open(){
  return new Promise((resolve,reject)=>{
    if(dbInstance){resolve(dbInstance);return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('invoices')){
        const s=db.createObjectStore('invoices',{keyPath:'id'});
        s.createIndex('invoiceNo','invoiceNo',{unique:true});
        s.createIndex('customerId','customerId');
        s.createIndex('status','status');
        s.createIndex('date','invoiceDate');
      }
      if(!db.objectStoreNames.contains('customers')){
        const s=db.createObjectStore('customers',{keyPath:'id'});
        s.createIndex('name','name');
        s.createIndex('phone','phone');
        s.createIndex('group','group');
      }
      if(!db.objectStoreNames.contains('items')){
        const s=db.createObjectStore('items',{keyPath:'id'});
        s.createIndex('name','name');
        s.createIndex('sku','sku');
        s.createIndex('category','category');
        s.createIndex('barcode','barcode');
      }
      if(!db.objectStoreNames.contains('payments')){
        const s=db.createObjectStore('payments',{keyPath:'id'});
        s.createIndex('invoiceId','invoiceId');
        s.createIndex('date','date');
      }
      if(!db.objectStoreNames.contains('activities')){
        const s=db.createObjectStore('activities',{keyPath:'id'});
        s.createIndex('date','date');
        s.createIndex('type','type');
      }
      if(!db.objectStoreNames.contains('notifications')){
        const s=db.createObjectStore('notifications',{keyPath:'id'});
        s.createIndex('date','date');
        s.createIndex('read','read');
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings',{keyPath:'key'});
      }
    };
    req.onsuccess=e=>{dbInstance=e.target.result;resolve(dbInstance);};
    req.onerror=e=>reject(e.target.error);
  });
}

async function getStore(name,mode='readonly'){
  const db=await open();
  return db.transaction(name,mode).objectStore(name);
}

async function put(storeName,data){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete=()=>resolve(data);
    tx.onerror=e=>reject(e.target.error);
  });
}

async function get(storeName,id){
  const store=await getStore(storeName);
  return new Promise((resolve,reject)=>{
    const req=store.get(id);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=e=>reject(e.target.error);
  });
}

async function getAll(storeName){
  const store=await getStore(storeName);
  return new Promise((resolve,reject)=>{
    const req=store.getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=e=>reject(e.target.error);
  });
}

async function remove(storeName,id){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=e=>reject(e.target.error);
  });
}

async function clear(storeName){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=e=>reject(e.target.error);
  });
}

async function count(storeName){
  const store=await getStore(storeName);
  return new Promise((resolve,reject)=>{
    const req=store.count();
    req.onsuccess=()=>resolve(req.result);
    req.onerror=e=>reject(e.target.error);
  });
}

async function getByIndex(storeName,indexName,value){
  const store=await getStore(storeName);
  return new Promise((resolve,reject)=>{
    const idx=store.index(indexName);
    const req=idx.getAll(value);
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=e=>reject(e.target.error);
  });
}

async function putSetting(key,value){
  return put('settings',{key,value,updatedAt:new Date().toISOString()});
}

async function getSetting(key,defaultValue=null){
  const result=await get('settings',key);
  return result?result.value:defaultValue;
}

async function getAllSettings(){
  const all=await getAll('settings');
  const map={};
  all.forEach(s=>{map[s.key]=s.value;});
  return map;
}

async function addActivity(type,message,meta={}){
  return put('activities',{
    id:BillFlow.Utils.uuid(),
    type,message,meta,
    date:new Date().toISOString()
  });
}

async function exportAll(){
  const data={};
  for(const store of STORES){
    data[store]=await getAll(store);
  }
  data._exportDate=new Date().toISOString();
  data._version=DB_VERSION;
  return data;
}

async function importAll(data){
  for(const store of STORES){
    if(data[store]&&Array.isArray(data[store])){
      await clear(store);
      for(const item of data[store]){
        await put(store,item);
      }
    }
  }
}

async function getNextInvoiceNumber(){
  const invoices=await getAll('invoices');
  const settings=await getAllSettings();
  const prefix=settings.invoicePrefix||'INV';
  const maxNum=invoices.reduce((max,inv)=>{
    const match=inv.invoiceNo?.match(/(\d+)$/);
    return match?Math.max(max,parseInt(match[1])):max;
  },0);
  return BillFlow.Utils.generateInvoiceNo(prefix,maxNum+1);
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.DB={open,put,get,getAll,remove,clear,count,getByIndex,putSetting,getSetting,getAllSettings,addActivity,exportAll,importAll,getNextInvoiceNumber};
})();
