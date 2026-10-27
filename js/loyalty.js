(function(){
'use strict';
const {Utils,Store,DB,TaxEngine}=BillFlow;

const TIER_THRESHOLDS={bronze:0,silver:10000,gold:50000,platinum:200000};
const TIER_MULTIPLIERS={bronze:1,silver:1.5,gold:2,platinum:3};
const POINTS_PER_CURRENCY=1; // 1 point per unit of currency spent

function getTier(totalSpend){
  if(totalSpend>=TIER_THRESHOLDS.platinum)return'platinum';
  if(totalSpend>=TIER_THRESHOLDS.gold)return'gold';
  if(totalSpend>=TIER_THRESHOLDS.silver)return'silver';
  return'bronze';
}

function calculatePoints(amount,tier='bronze'){
  const base=Math.floor(amount*POINTS_PER_CURRENCY);
  const multiplier=TIER_MULTIPLIERS[tier]||1;
  return Math.floor(base*multiplier);
}

function getPointsValue(points){ return Math.floor(points/10); }

async function awardPoints(customerId,invoiceAmount){
  const customer=Store.getCustomer(customerId);
  if(!customer)return;
  
  const totalSpend=(customer.totalSpend||0)+invoiceAmount;
  const tier=getTier(totalSpend);
  const points=calculatePoints(invoiceAmount,tier);
  const newBalance=(customer.loyaltyPoints||0)+points;
  
  const updated={...customer,loyaltyPoints:newBalance,loyaltyTier:tier,totalSpend,lastPurchaseDate:Utils.now()};
  await Store.saveCustomer(updated);
  
  if(tier!==customer.loyaltyTier&&customer.loyaltyTier){
    await Store.addNotification({type:'loyalty',title:'Tier Upgrade! 🎉',message:`${customer.name} upgraded to ${tier.charAt(0).toUpperCase()+tier.slice(1)} tier!`,icon:'⭐'});
  }
  return{points,newBalance,tier};
}

async function redeemPoints(customerId,points){
  const customer=Store.getCustomer(customerId);
  if(!customer||customer.loyaltyPoints<points)return null;
  
  const value=getPointsValue(points);
  const updated={...customer,loyaltyPoints:customer.loyaltyPoints-points};
  await Store.saveCustomer(updated);
  return{pointsRedeemed:points,discountValue:value};
}

function getTierInfo(tier){
  const info={
    bronze:{name:'Bronze',color:'hsl(25,70%,50%)',icon:'🥉',discount:0,nextTier:'silver',nextThreshold:TIER_THRESHOLDS.silver},
    silver:{name:'Silver',color:'hsl(0,0%,75%)',icon:'🥈',discount:5,nextTier:'gold',nextThreshold:TIER_THRESHOLDS.gold},
    gold:{name:'Gold',color:'hsl(45,90%,50%)',icon:'🥇',discount:10,nextTier:'platinum',nextThreshold:TIER_THRESHOLDS.platinum},
    platinum:{name:'Platinum',color:'hsl(260,60%,70%)',icon:'💎',discount:15,nextTier:null,nextThreshold:null}
  };
  return info[tier]||info.bronze;
}

window.BillFlow=window.BillFlow||{};
window.BillFlow.Loyalty={getTier,calculatePoints,getPointsValue,awardPoints,redeemPoints,getTierInfo,TIER_THRESHOLDS,TIER_MULTIPLIERS};
})();
