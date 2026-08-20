const state={data:null};
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0}).format(Number(n||0));
const money2=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2}).format(Number(n||0));
const dateHe=s=>{if(!s)return '—';const d=new Date(s+'T12:00:00');return new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(d)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tag(t){const m={'בפועל':'actual','התחייבות קיימת':'commit','תחזית':'forecast','אפשרות בלבד':'option'};return `<span class="tag ${m[t]||''}">${esc(t||'—')}</span>`}
function kpi(t,v,s=''){return `<div class="kpi"><div class="t">${esc(t)}</div><div class="v">${v}</div>${s?`<div class="s">${esc(s)}</div>`:''}</div>`}
function table(headers,rows){if(!rows.length)return '<div class="empty">אין נתונים להצגה.</div>';return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function list(items){if(!items.length)return '<div class="empty">אין פריטים.</div>';return `<div class="list">${items.join('')}</div>`}
function item(main,sub,amt,cls=''){return `<div class="item"><div><div class="main">${esc(main)}</div><div class="sub">${esc(sub)}</div></div><div class="amt ${cls}">${amt}</div></div>`}
function showToast(t){const x=$('#toast');x.textContent=t;x.style.display='block';setTimeout(()=>x.style.display='none',2200)}

async function load(){
  const btn=$('#refreshBtn');btn.disabled=true;btn.textContent='מרענן…';
  try{
    const res=await fetch('/api/dashboard',{cache:'no-store'});const d=await res.json();
    if(!res.ok||!d.connected)throw new Error(d.message||'החיבור ל-Airtable אינו פעיל');
    state.data=d;render();$('#connectionBadge').className='badge good';$('#connectionBadge').textContent='Airtable מחובר';
    $('#lastUpdated').textContent='עודכן '+new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(d.fetchedAt));
  }catch(e){$('#connectionBadge').className='badge bad';$('#connectionBadge').textContent='לא מחובר';showToast(e.message||String(e));renderDisconnected(e.message||String(e));}
  finally{btn.disabled=false;btn.textContent='רענן עכשיו'}
}

function renderDisconnected(msg){
  $('#forecastGap').textContent='—';$('#traffic').textContent='חסר חיבור';$('#traffic').className='traffic red';
  $('#situationKpis').innerHTML=kpi('סטטוס','לא מחובר','נדרש AIRTABLE_TOKEN בצד השרת')+kpi('אבטחה','תקינה','המפתח אינו נשמר בדפדפן')+kpi('האתר','חי','Netlify')+kpi('השלב הבא','חיבור הרשאה','לאחר מכן הנתונים יתעדכנו אוטומטית');
  $('#liquidityTable').innerHTML=`<div class="policy-note">${esc(msg)}<br><br>הדשבורד מוכן לחיבור מאובטח ל-Airtable דרך פונקציית שרת. אין להכניס Personal Access Token לקוד ה-HTML או לדפדפן.</div>`;
}

function render(){
  const d=state.data,m=d.metrics;
  $('#targetDateLabel').textContent=dateHe(d.targetDate);
  $('#forecastGap').textContent=money(Math.max(0,m.forecastGapWithinFacilities));
  const t=$('#traffic'); if(m.forecastGapWithoutFacilities<=0){t.textContent='ירוק';t.className='traffic green'}else if(m.forecastGapWithinFacilities<=0){t.textContent='צהוב';t.className='traffic yellow'}else{t.textContent='אדום';t.className='traffic red'}
  $('#situationKpis').innerHTML=[
    kpi('נזילות חופשית בפועל',money2(m.actualFreeLiquidity),'ללא מסגרות אשראי'),
    kpi('נזילות בתוך מסגרות מאושרות',money2(m.operationalLiquidityWithinFacilities),'כלי גישור, לא הכנסה'),
    kpi('זיכויי אשראי עד היעד',money2(m.cardNetByTarget),'נגבה — טרם זוכה'),
    kpi('הו״ק שטרם נגבו',money2(m.hokPendingAmount),`${money2(m.hokCashByTarget)} עשויים להפוך לנזילות עד היעד`)
  ].join('');

  $('#liquidityTable').innerHTML=table(['מקור','יתרה בפועל','חופשי','מסגרת','מרווח','סטטוס'],d.liquidity.map(x=>`<tr><td>${esc(x.name)}</td><td class="money ${x.balance<0?'neg':'pos'}">${money2(x.balance)}</td><td class="money">${money2(x.free)}</td><td>${money2(x.facility)}</td><td class="money ${x.headroom<0?'neg':'pos'}">${money2(x.headroom)}</td><td>${esc(x.status)}</td></tr>`));
  $('#syncStatus').innerHTML=list(d.sync.map(x=>item(x.process,`${x.status||'—'} · חריגות: ${x.anomalies||0}`,x.lastSuccess?new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(x.lastSuccess)):'—')));
  $('#nearCashflow').innerHTML=list(d.cashflow.slice(0,8).map(x=>item(`${dateHe(x.date)} · ${x.description}`,`${x.category||''} · ${x.dataType||''}`,`${x.direction==='הוצאה'?'-':'+'}${money(x.amount)}`,x.direction==='הוצאה'?'neg':'pos')));
  const red=[];
  d.liquidity.filter(x=>x.headroom<0).forEach(x=>red.push(item(`חריגה במסגרת — ${x.name}`,x.status,money2(Math.abs(x.headroom)),'neg')));
  d.debts.filter(x=>x.risk.startsWith('A')).slice(0,5).forEach(x=>red.push(item(x.creditor,`${x.risk} · ${x.status}`,money(x.balance),'neg')));
  d.decisions.filter(x=>!['סגור','בוצע','הושלם'].includes(x.status)).slice(0,4).forEach(x=>red.push(item(x.subject,`${x.policy||''} · ${x.status||''}`,'החלטה')));
  $('#redItems').innerHTML=list(red);

  renderGoals(d);renderIncome(d);renderCashflow(d);renderDebts(d);renderBudget(d);renderDecisions(d);
}

function renderGoals(d){
  const g=d.activeTarget,m=d.metrics;
  if(!g){$('#goalName').textContent='אין יעד פתוח';$('#goalRemaining').textContent='—';$('#goalMeta').textContent='יש לפתוח יעד מתועד ב-Airtable';$('#goalPct').textContent='0%';$('#goalProgress').style.width='0%';$('#goalKpis').innerHTML='';$('#successList').innerHTML='<div class="empty">אין יעד פעיל.</div>';return}
  const opening=Math.max(0,g.impact||0),wins=Math.max(0,m.successImpact||0),remaining=Math.max(0,opening-wins);const pct=opening?Math.min(100,Math.round(wins/opening*100)):0;
  $('#goalName').textContent=g.name;$('#goalRemaining').textContent=`נשאר ${money(remaining)}`;$('#goalMeta').textContent=`יעד: ${dateHe(g.targetDate)} · קו בסיס ${money(opening)}`;$('#goalPct').textContent=pct+'%';$('#goalProgress').style.width=pct+'%';
  const days=Math.max(1,Math.ceil((new Date(g.targetDate+'T12:00:00')-new Date(d.localDate+'T12:00:00'))/86400000));
  $('#goalKpis').innerHTML=[kpi('יעד פתיחה',money(opening)),kpi('הישגים',money(wins)),kpi('נשאר',money(remaining)),kpi('קצב ליום קלנדרי',money(remaining/days),`${days} ימים עד היעד`),kpi('שיפור מבני חודשי',money(m.structuralMonthlyWins),'הו״ק/הכנסה קבועה חדשה')].join('');
  $('#successList').innerHTML=list(d.successes.map(x=>item(x.name,`${dateHe(x.date)} · ${x.status||''}`,x.impact?money(x.impact):`+${money(x.monthlyAddition)}/חודש`,'pos')));
}
function renderIncome(d){const m=d.metrics;$('#incomeKpis').innerHTML=[kpi('נגבה — טרם זוכה',money2(m.cardNetByTarget),'נטו צפוי עד היעד'),kpi('הו״ק — טרם נגבו',money2(m.hokPendingAmount),`${money2(m.hokCashByTarget)} נספרים בתחזית המזומן עד היעד`),kpi('הכנסה ודאית אחרת',money2(m.targetInCommitted),'לפי תזרים'),kpi('תחזית נוספת',money2(m.targetInForecast),'לא ודאית כמו התחייבות קיימת')].join('');
$('#batchTable').innerHTML=table(['אצווה','מועד צפוי','ברוטו','קיזוזים','נטו','בנק','סטטוס'],d.cardBatches.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.expectedDate?dateHe(x.expectedDate):esc(x.expectedMonth)}</td><td>${money2(x.gross)}</td><td>${money2(x.deductions)}</td><td class="money pos">${money2(x.net||x.gross-x.deductions)}</td><td>${esc(x.bank)}</td><td>${esc(x.status)}${x.countsByTarget?' · נספר עד היעד':''}</td></tr>`));
$('#hokTable').innerHTML=table(['תורם','מועד חיוב','סכום','מסלול','סטטוס'],d.pendingHok.filter(x=>!['חויב בפועל'].includes(x.status)).map(x=>`<tr><td>${esc(x.donor)}</td><td>${dateHe(x.expectedChargeDate)}</td><td class="money">${money2(x.amount)}</td><td>${esc(x.route||x.method)}</td><td>${esc(x.status)}${x.cashByTarget?' · צפוי לנזילות עד היעד':''}</td></tr>`));}
function renderCashflow(d){$('#cashflowTable').innerHTML=table(['תאריך','תיאור','כיוון','סכום','סוג נתון','קטגוריה','סטטוס'],d.cashflow.map(x=>`<tr><td>${dateHe(x.date)}</td><td>${esc(x.description)}</td><td>${esc(x.direction)}</td><td class="money ${x.direction==='הוצאה'?'neg':'pos'}">${x.direction==='הוצאה'?'-':'+'}${money2(x.amount)}</td><td>${tag(x.dataType)}</td><td>${esc(x.category)}</td><td>${esc(x.status)}</td></tr>`));}
function renderDebts(d){const m=d.metrics;$('#debtKpis').innerHTML=[kpi('סה״כ חובות נספרים',money(m.debtTotal)),kpi('A — קריטי',money(m.criticalDebtTotal)),kpi('מספר חובות פתוחים',String(d.debts.length)),kpi('כלל', 'סיכון קודם ללחץ','לפי מדיניות 02')].join('');$('#debtTable').innerHTML=table(['נושה','יתרה','מועד','סיכון','סוג','סטטוס'],d.debts.sort((a,b)=>a.risk.localeCompare(b.risk)).map(x=>`<tr><td>${esc(x.creditor)}</td><td class="money">${money2(x.balance)}</td><td>${dateHe(x.dueDate)}</td><td>${esc(x.risk)}</td><td>${esc(x.type)}</td><td>${esc(x.status)}</td></tr>`));}
function renderBudget(d){$('#budgetTable').innerHTML=table(['חודש','הכנסות מבניות','הוצאות כולל שירות חוב','פער מבני','לפני שירות חוב','שלמות'],d.budget.map(x=>`<tr><td>${esc(x.month)}</td><td class="money pos">${money2(x.structuralIncome)}</td><td class="money neg">${money2(x.structuralExpenses)}</td><td class="money ${x.structuralGap<0?'neg':'pos'}">${money2(x.structuralGap)}</td><td>${money2(x.operatingGapBeforeDebt)}</td><td>${esc(x.status)}</td></tr>`));}
function renderDecisions(d){$('#decisionList').innerHTML=list(d.decisions.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>item(x.subject,`${dateHe(x.date)} · ${x.policy||'ללא כלל'} · ${x.status||''}${x.deviation?' · חריגה מהמדיניות':''}`,x.approver||'—')));}

document.addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#refreshBtn').addEventListener('click',()=>{load();showToast('מרענן מה-Airtable')});
load();setInterval(load,300000);
