import { calculateLedger, validateTransaction, parseCSV } from '../server/engine.mjs';
import { demoHoldings, demoProvider } from './providers/demo.ts';

const KEY='folio.website.v1';
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const defaults=()=>({version:1,mode:'private',accounts:[{id:'manual',name:'Manual portfolio',currency:'USD'}],transactions:[],quotes:{},metadata:{},watchlist:[],alerts:[],notifications:[],events:[],research:[],briefings:[],snapshots:[],settings:{currency:'USD',timezone:'Australia/Sydney',theme:'dark',refreshMinutes:15,notifications:true,dailyBriefing:true,briefingHour:8}});
function read(){const text=localStorage.getItem(KEY);return text?JSON.parse(text):defaults();}
function save(db){localStorage.setItem(KEY,JSON.stringify(db));}
function security(db,ticker){return {...(demoHoldings.find(h=>h.ticker===ticker)||{ticker,name:ticker,sector:'Unknown',industry:'Unknown',geography:'Unknown',color:'#64d8b0'}),...db.metadata[ticker]};}
function ledger(db){return calculateLedger(db.transactions);}
function state(db){
  const demo=db.mode==='demo';
  const l=ledger(db);
  const holdings=demo?demoHoldings.map(h=>({...h,priced:true,dayChangeAvailable:true,quoteMode:'DEMO',quoteTimestamp:now(),basis:h.shares*h.averageCost,realised:0})):l.positions.filter(p=>p.quantity_micros>0).map(p=>{
    const q=db.quotes[p.ticker],shares=p.quantity_micros/1e6,basis=p.basis_cents/100;
    return {...security(db,p.ticker),shares,averageCost:basis/shares,price:q?.price||0,dayChange:q?.previousClose>0?(q.price/q.previousClose-1)*100:0,dayChangeAvailable:q?.previousClose>0,priced:!!q,quoteMode:q?'MANUAL':'UNAVAILABLE',quoteTimestamp:q?.timestamp||null,basis,realised:p.realised_cents/100};
  });
  const cash=demo?12480:l.cash/100;
  const invested=holdings.reduce((s,h)=>s+h.basis,0),total=cash+holdings.reduce((s,h)=>s+h.shares*h.price,0);
  const complete=holdings.every(h=>h.priced),dailyComplete=holdings.every(h=>h.dayChangeAvailable);
  const daily=holdings.reduce((s,h)=>s+(h.dayChangeAvailable?h.shares*(h.price-h.price/(1+h.dayChange/100)):0),0);
  const sectors={};for(const h of holdings)sectors[h.sector]=(sectors[h.sector]||0)+(total?h.shares*h.price/total*100:0);
  const largest=[...holdings].sort((a,b)=>b.shares*b.price-a.shares*a.price)[0];
  const dates=Object.values(db.quotes).map(q=>q.timestamp).sort();
  return {user:{id:demo?'browser-demo':'browser-local',kind:demo?'demo':'private',email:'This browser only'},accounts:db.accounts,holdings,cash,total,invested,profit:holdings.reduce((s,h)=>s+h.shares*h.price-h.basis,0),daily,complete,dailyComplete,realised:demo?0:l.realised/100,income:l.income/100,fees:l.fees/100,netFlow:l.netFlow/100,watchlist:db.watchlist.map(t=>{const q=db.quotes[t];return {...security(db,t),price:q?.price??null,dayChange:q?.previousClose>0?(q.price/q.previousClose-1)*100:null,quoteMode:q?'MANUAL':'UNAVAILABLE',quoteTimestamp:q?.timestamp||null};}),alerts:db.alerts,notifications:db.notifications,transactions:db.transactions.map(t=>({...t,account:db.accounts.find(a=>a.id===t.account_id)?.name||'Manual'})),settings:db.settings,market:{configured:false,provider:null,mode:demo?'DEMO':'MANUAL',lastUpdated:demo?now():dates.at(-1)||null},broker:{configured:false,connection:null},jobs:[],aiConfigured:false,risk:{sectors,largest:largest?{ticker:largest.ticker,weight:total?largest.shares*largest.price/total*100:0}:null,technology:sectors.Technology||0,cashWeight:total?cash/total*100:0},contributions:holdings.map(h=>({ticker:h.ticker,unrealised:h.priced?h.shares*h.price-h.basis:null,day:h.dayChangeAvailable?h.shares*(h.price-h.price/(1+h.dayChange/100)):null,contribution:h.priced&&l.netFlow?h.shares*h.price/l.netFlow*10000-h.basis/l.netFlow*10000:null}))};
}
function snapshot(db){const s=state(db);if(s.complete&&db.mode!=='demo')db.snapshots.push({date:now(),value:s.total,netFlow:s.netFlow});}
function evaluate(db){const s=state(db);for(const a of db.alerts){const h=s.holdings.find(h=>h.ticker===a.ticker);const fresh=h?.quoteTimestamp&&Date.now()-Date.parse(h.quoteTimestamp)<4*86400000;const hit=a.kind==='PRICE_ABOVE'?fresh&&h.price>a.threshold:a.kind==='PRICE_BELOW'?fresh&&h.price<a.threshold:a.kind==='WEIGHT_ABOVE'?s.complete&&h&&s.total>0&&h.shares*h.price/s.total*100>a.threshold:a.kind==='PORTFOLIO_DROP'?s.complete&&s.dailyComplete&&s.total-s.daily>0&&s.daily/(s.total-s.daily)*100<=-a.threshold:false;if(hit&&!a.state)db.notifications.unshift({id:id(),message:`${a.kind} ${a.ticker||'Portfolio'} threshold ${a.threshold} reached`,created_at:now(),read:0});a.state=hit?1:0;}}
function briefing(db){const s=state(db);const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:db.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const b={localDate,generatedAt:now(),mode:'CALCULATED',total:s.complete?s.total:null,cash:s.cash,daily:s.dailyComplete?s.daily:null,realised:s.realised,unrealised:s.complete?s.profit:null,issues:['Browser-only briefing. Quotes are manual; open source links for latest news. No AI provider or background server is connected.'],news:[],ai:null};db.briefings=db.briefings.filter(x=>x.localDate!==localDate);db.briefings.unshift(b);snapshot(db);return b;}
function tickerOf(value){const ticker=String(value||'').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9.:-]{0,24}$/.test(ticker))throw Error('Enter a valid ticker');return ticker;}
function accountOf(db,value){if(!db.accounts.some(a=>a.id===value))throw Error('Select an account');return value;}
function writable(db){if(db.mode==='demo')throw Error('Switch to your browser portfolio in Settings before recording real data.');}
export async function browserApi(path,method='GET',body={}){
  const db=read(),url=new URL(path,'https://folio.local'),p=url.pathname;
  let result={ok:true};
  if(p==='/auth/session')return {user:state(db).user};
  if(p==='/state'){
    evaluate(db);
    if(db.mode!=='demo'&&db.settings.dailyBriefing){const date=new Intl.DateTimeFormat('en-CA',{timeZone:db.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:db.settings.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date()));if(hour>=db.settings.briefingHour&&!db.briefings.some(b=>b.localDate===date))briefing(db);}
    save(db);return state(db);
  }
  if(p==='/auth/demo'){db.mode='demo';}
  else if(p==='/browser/portfolio'){db.mode='private';}
  else if(p==='/browser/restore'){
    const restored=body.archive;
    if(restored?.version!==1||!Array.isArray(restored.transactions)||!Array.isArray(restored.accounts)||!restored.quotes||!restored.settings)throw Error('Select a Folio website export.');
    for(const t of restored.transactions){const valid=validateTransaction({type:t.type,timestamp:t.timestamp,ticker:t.ticker,quantity:t.quantity_micros/1e6,price:t.price_micros/1e6,amount:t.amount_cents/100,fees:t.fees_cents/100});if(!restored.accounts.some(a=>a.id===t.account_id)||Object.entries(valid).some(([k,v])=>t[k]!==v))throw Error('Invalid archived transaction');}
    calculateLedger(restored.transactions);save({...defaults(),...restored,mode:'private'});return result;
  }
  else if(p==='/accounts'){if(!body.name?.trim())throw Error('Enter an account name');db.accounts.push({id:id(),name:body.name.trim(),currency:'USD'});}
  else if(p==='/transactions'){
    writable(db);const t={...validateTransaction(body),id:id(),account_id:accountOf(db,body.accountId),sequence:db.transactions.length};calculateLedger([...db.transactions,t]);db.transactions.push(t);snapshot(db);evaluate(db);
  }
  else if(p==='/import'){
    writable(db);const account_id=accountOf(db,body.accountId),rows=parseCSV(body.csv),candidate=[...db.transactions];let added=0,skipped=0;
    for(const [i,row] of rows.entries()){
      const external_id=row.external_id||`csv:${await digest(body.csv)}:${i}`;
      const valid=validateTransaction(row),existing=candidate.find(t=>t.account_id===account_id&&t.external_id===external_id);
      if(existing){if(Object.entries(valid).some(([k,v])=>existing[k]!==v))throw Error('Conflicting external ID');skipped++;continue;}
      candidate.push({...valid,id:id(),account_id,external_id,sequence:candidate.length});added++;
    }
    const l=calculateLedger(candidate);if(body.commit){db.transactions=candidate;snapshot(db);evaluate(db);}result={added,skipped,cash:l.cash/100};
  }
  else if(p==='/quotes'){
    writable(db);const ticker=tickerOf(body.ticker),price=Number(body.price),previousClose=body.previousClose==null?null:Number(body.previousClose);if(!Number.isFinite(price)||price<=0||price>1e7||(previousClose!==null&&(!Number.isFinite(previousClose)||previousClose<=0)))throw Error('Enter positive finite prices');db.quotes[ticker]={price,previousClose,timestamp:now()};snapshot(db);evaluate(db);
  }
  else if(p==='/watchlist'){const ticker=tickerOf(body.ticker);db.watchlist=db.watchlist.filter(t=>t!==ticker);if(method!=='DELETE')db.watchlist.push(ticker);}
  else if(p==='/settings'){if(body.timezone)new Intl.DateTimeFormat('en',{timeZone:body.timezone});if(body.briefingHour!==undefined&&(!Number.isInteger(body.briefingHour)||body.briefingHour<0||body.briefingHour>23))throw Error('Briefing hour must be 0–23');db.settings={...db.settings,...body};}
  else if(p==='/snapshots'){snapshot(db);}
  else if(p==='/history'||/^\/security\/.+\/history$/.test(p)){
    const period=url.searchParams.get('period')||'1Y';
    if(db.mode==='demo')return {mode:'DEMO',synthetic:true,points:demoProvider.getHistory(period)};
    const spans={'1D':1,'1W':7,'1M':30,'3M':90,'6M':180,'1Y':365,'3Y':1095,'5Y':1825};const cutoff=period==='YTD'?new Date(new Date().getFullYear(),0,1).getTime():Date.now()-(spans[period]||100000)*86400000;
    return {mode:'MANUAL',synthetic:false,note:p==='/history'?'Recorded browser valuations; manual prices.':'Stock price history needs a market-data service.',points:p==='/history'?db.snapshots.filter(s=>Date.parse(s.date)>=cutoff):[]};
  }
  else if(/^\/security\/.+\/metadata$/.test(p)){writable(db);const ticker=tickerOf(p.split('/')[2]);for(const k of ['name','sector','industry','geography'])if(typeof body[k]!=='string'||!body[k].trim())throw Error('Complete all company details');db.metadata[ticker]={...body};}
  else if(p==='/events'&&method==='GET')return db.events;
  else if(p==='/events'){if(!body.title?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(body.date))throw Error('Enter a title and date');if(body.sourceUrl&&!/^https:\/\//.test(body.sourceUrl))throw Error('Source links must use HTTPS');db.events.push({id:id(),title:body.title,date:body.date,ticker:body.ticker?tickerOf(body.ticker):null,source_url:body.sourceUrl||null,origin:'MANUAL'});}
  else if(p.startsWith('/events/'))db.events=db.events.filter(e=>e.id!==p.split('/')[2]);
  else if(p==='/alerts/evaluate')evaluate(db);
  else if(p==='/alerts'){if(!['PRICE_ABOVE','PRICE_BELOW','WEIGHT_ABOVE','PORTFOLIO_DROP'].includes(body.kind)||!Number.isFinite(body.threshold)||body.threshold<=0)throw Error('Enter a valid rule and positive threshold');db.alerts.push({id:id(),kind:body.kind,ticker:body.ticker?tickerOf(body.ticker):null,threshold:body.threshold,enabled:1,state:0});evaluate(db);}
  else if(p.startsWith('/alerts/'))db.alerts=db.alerts.filter(a=>a.id!==p.split('/')[2]);
  else if(p==='/notifications/read')db.notifications.forEach(n=>n.read=1);
  else if(p==='/research'&&method==='GET')return db.research;
  else if(p==='/assistant'){
    const s=state(db);const answer=/news|headline/i.test(body.question)?'Open the current news source links on the News page. This free website does not fetch or summarize live headlines.':`Cash: $${s.cash.toFixed(2)}. Realised P/L: $${s.realised.toFixed(2)}. ${s.complete?`Unrealised P/L: $${s.profit.toFixed(2)}.`:'Current prices are missing; total valuation is incomplete.'} ${s.risk.largest?`Largest holding: ${s.risk.largest.ticker} (${s.risk.largest.weight.toFixed(1)}%).`:''} ${s.dailyComplete?`Arithmetic daily movement: $${s.daily.toFixed(2)}.`:'Previous closing prices are missing; daily movement is unavailable.'}`;
    result={generatedBy:'CALCULATED',timestamp:now(),question:String(body.question||'Portfolio overview'),model:'Browser portfolio calculator',facts:{mode:s.market.mode,complete:s.complete,cash:s.cash},interpretation:{'CALCULATED OBSERVATIONS':answer,UNCERTAINTIES:'Manual prices may be stale. No live AI or sourced headline interpretation is connected.'},sources:[]};db.research.unshift(result);
  }
  else if(p==='/briefings'&&method==='GET')return db.briefings;
  else if(p==='/briefings'){result=briefing(db);}
  else if(p==='/news')return [];
  else if(p==='/analytics'){const s=state(db);return {periodRealised:Object.fromEntries([['Today',0],['7 days',7],['30 days',30],['365 days',365]].map(([label,days])=>[label,ledger(db).events.filter(e=>days?Date.parse(e.timestamp)>=Date.now()-days*86400000:new Intl.DateTimeFormat('en-CA',{timeZone:db.settings.timezone}).format(new Date(e.timestamp))===new Intl.DateTimeFormat('en-CA',{timeZone:db.settings.timezone}).format(new Date())).reduce((sum,e)=>sum+e.realised/100,0)])),risk:{beta:null,volatility:null,observations:0,reason:'Adjusted market history is not connected in the free website.',correlations:[]},realised:s.realised,unrealised:s.complete?s.profit:null,income:s.income,fees:s.fees,contributions:s.contributions,maxDrawdown:null,timeWeighted:null,volatility:null,method:'Manual ledger; statistical returns unavailable.',snapshotCount:db.snapshots.length};}
  else if(p==='/export')return {...db,exportedAt:now()};
  else throw Error('This feature needs a server/provider. Use manual entries and current news source links in this free website.');
  save(db);return result;
}
async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
