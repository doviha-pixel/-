import {TABLES,fetchTable,localDate} from './lib/airtable.mjs';
import {transform} from './lib/transform.mjs';

function env(name){const n=globalThis.Netlify;return n?.env?.get?n.env.get(name):undefined}

export default async ()=>{
  const token=env('AIRTABLE_TOKEN')||env('airtable_token');
  if(!token)return Response.json({connected:false,reason:'AIRTABLE_TOKEN_MISSING',message:'האתר הועלה, אך חיבור Airtable טרם הופעל בצד השרת.'},{status:503,headers:{'Cache-Control':'no-store'}});
  try{
    const [liquidityRaw,cashflowRaw,batchesRaw,hokRaw,debtsRaw,budgetRaw,goalsRaw,decisionsRaw,syncRaw]=await Promise.all([
      fetchTable(token,TABLES.liquidity),fetchTable(token,TABLES.cashflow),fetchTable(token,TABLES.cardBatches),fetchTable(token,TABLES.pendingHok),fetchTable(token,TABLES.debts),fetchTable(token,TABLES.budget),fetchTable(token,TABLES.goals),fetchTable(token,TABLES.decisions),fetchTable(token,TABLES.sync)
    ]);
    return Response.json(transform({liquidityRaw,cashflowRaw,batchesRaw,hokRaw,debtsRaw,budgetRaw,goalsRaw,decisionsRaw,syncRaw},localDate()),{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(err){console.error(err);return Response.json({connected:false,reason:'AIRTABLE_FETCH_FAILED',message:err instanceof Error?err.message:String(err)},{status:500,headers:{'Cache-Control':'no-store'}})}
};

export const config={path:'/api/dashboard'};
