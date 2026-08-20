export const BASE_ID = 'app7KS4MAU4bCV3il';
export const TABLES = {
  liquidity:'tblMtD6pBvB7YIUQa', cashflow:'tblkydS0CZZ99XTaj', cardBatches:'tbl9lZasZl4H7UJgo',
  pendingHok:'tbltyI1Bw1h5oqgSk', debts:'tblwxTjXQcnnJsZlG', budget:'tblg0ewfqannmqlLE',
  goals:'tblsvoR7oWpL2a32U', decisions:'tbluQ7QelagnebCQF', sync:'tbl1K8gDfuNDJTTRq'
};
export async function fetchTable(token, tableId){
  const out=[]; let offset='';
  do{
    const p=new URLSearchParams({pageSize:'100'}); if(offset)p.set('offset',offset);
    const res=await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}?${p}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!res.ok){const b=await res.text();throw new Error(`Airtable ${tableId}: ${res.status} ${b.slice(0,250)}`)}
    const d=await res.json();out.push(...(d.records||[]));offset=d.offset||'';
  }while(offset); return out;
}
export const selectName=v=>v==null?'':typeof v==='string'?v:(typeof v==='object'&&typeof v.name==='string'?v.name:String(v));
export const num=v=>Number.isFinite(Number(v))?Number(v):0;
export const sum=(a,fn)=>a.reduce((s,x)=>s+fn(x),0);
export function isOpen(status){return !['בוצע','שולם','סגור','בוטל','חויב בפועל','זוכה בפועל'].includes(String(status||'').trim())}
export function localDate(){const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()))p[x.type]=x.value;return `${p.year}-${p.month}-${p.day}`}
export function addDays(s,n){const d=new Date(`${s}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function nextTenth(s){const [y,m,d]=s.split('-').map(Number);if(d<=10)return `${y}-${String(m).padStart(2,'0')}-10`;const nm=m===12?1:m+1,ny=m===12?y+1:y;return `${ny}-${String(nm).padStart(2,'0')}-10`}
const H={'ינואר':'01','פברואר':'02','מרץ':'03','אפריל':'04','מאי':'05','יוני':'06','יולי':'07','אוגוסט':'08','ספטמבר':'09','אוקטובר':'10','נובמבר':'11','דצמבר':'12'};
export function monthKey(s=''){const iso=s.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])\b/);if(iso)return `${iso[1]}-${String(Number(iso[2])).padStart(2,'0')}`;const y=s.match(/\b(20\d{2})\b/)?.[1];if(!y)return '';for(const [n,m] of Object.entries(H))if(s.includes(n))return `${y}-${m}`;return ''}
export function deadline(notes='',fallbackYear=''){const m=notes.match(/(?:עד|לפני)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/);if(!m)return '';let y=m[3]||fallbackYear;if(y.length===2)y=`20${y}`;return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`}
export const isCardLike=(method='',route='')=>/אשראי|אייקאונט|משולם|סליקה|gpay/i.test(`${method} ${route}`);
