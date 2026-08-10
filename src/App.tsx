import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Business = { id: string; name: string; address: string | null; kashrut_status: string | null };
type ChecklistItem = { id: string; title: string; status: 'unchecked' | 'ok' | 'issue' | 'not_applicable'; note: string | null; sort_order: number };
type VisitMode = 'mashgiach' | 'inspector';

type Position = { lat: number; lng: number; accuracy: number | null };

function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('שירותי המיקום אינם זמינים במכשיר זה'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy ?? null }),
      () => reject(new Error('לא ניתן לקבל מיקום. יש לאשר הרשאת מיקום ולנסות שוב.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    );
  });
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Business | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [mode, setMode] = useState<VisitMode>('mashgiach');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const remaining = useMemo(() => items.filter((x) => x.status === 'unchecked').length, [items]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void initialize();
  }, [session]);

  async function initialize() {
    setBusy(true);
    setMessage('מסנכרן נתונים...');
    try {
      const { error: syncError } = await supabase.functions.invoke('sync-airtable-core', { body: { force: false } });
      if (syncError) throw syncError;
      await loadBusinesses();
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'אירעה שגיאה בסנכרון');
    } finally {
      setBusy(false);
    }
  }

  async function loadBusinesses() {
    const { data, error } = await supabase.from('businesses').select('id,name,address,kashrut_status').eq('active', true).order('name');
    if (error) throw error;
    setBusinesses((data ?? []) as Business[]);
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setMessage(error ? error.message : 'שלחנו אליך קישור כניסה למייל.');
  }

  async function startVisit() {
    if (!selected) return;
    setBusy(true);
    setMessage('מקבל מיקום ופותח ביקור...');
    try {
      const p = await getPosition();
      const { data, error } = await supabase.rpc('start_visit', {
        p_business_id: selected.id,
        p_visit_mode: mode,
        p_lat: p.lat,
        p_lng: p.lng,
        p_accuracy: p.accuracy,
      });
      if (error) throw error;
      const id = typeof data === 'string' ? data : Array.isArray(data) ? data[0]?.id ?? data[0] : (data as { id?: string } | null)?.id;
      if (!id) throw new Error('הביקור נפתח אך לא התקבל מזהה ביקור');
      setVisitId(String(id));
      await loadChecklist(String(id));
      setMessage('הביקור נפתח בהצלחה.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'לא ניתן לפתוח ביקור');
    } finally {
      setBusy(false);
    }
  }

  async function loadChecklist(id: string) {
    const { data, error } = await supabase
      .from('visit_checklist_items')
      .select('id,title,status,note,sort_order')
      .eq('visit_id', id)
      .order('sort_order');
    if (error) throw error;
    setItems((data ?? []) as ChecklistItem[]);
  }

  async function updateItem(item: ChecklistItem, status: ChecklistItem['status'], note?: string) {
    if (status === 'issue' && !(note ?? item.note ?? '').trim()) {
      const entered = window.prompt('סומן ליקוי. נא לתאר בקצרה מה נמצא:');
      if (!entered?.trim()) return;
      note = entered.trim();
    }
    setBusy(true);
    const payload = {
      status,
      note: status === 'issue' ? (note ?? item.note) : item.note,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('visit_checklist_items').update(payload).eq('id', item.id);
    if (error) setMessage(error.message);
    else setItems((current) => current.map((x) => (x.id === item.id ? { ...x, ...payload } : x)) as ChecklistItem[]);
    setBusy(false);
  }

  async function completeVisit() {
    if (!visitId) return;
    setBusy(true);
    setMessage('מסיים ביקור...');
    try {
      const p = await getPosition();
      const { error } = await supabase.rpc('complete_visit', {
        p_visit_id: visitId,
        p_lat: p.lat,
        p_lng: p.lng,
        p_accuracy: p.accuracy,
        p_summary: summary.trim() || null,
      });
      if (error) throw error;
      setMessage('הביקור הסתיים ונשמר בהצלחה.');
      setVisitId(null);
      setItems([]);
      setSummary('');
      setSelected(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'לא ניתן לסיים את הביקור');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <div className="brand-mark">כ</div>
          <h1>מערכת הכשרות</h1>
          <p>כניסה מאובטחת למערכת המשגיחים והפיקוח</p>
          <form onSubmit={signIn} className="stack">
            <label>דוא״ל</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <button className="primary" disabled={busy}>שלח קישור כניסה</button>
          </form>
          {message && <div className="notice">{message}</div>}
        </section>
      </main>
    );
  }

  if (visitId && selected) {
    return (
      <main className="page">
        <header className="topbar">
          <div><strong>{selected.name}</strong><small>ביקור {mode === 'inspector' ? 'מפקח' : 'משגיח'}</small></div>
          <span className="counter">{remaining} נותרו</span>
        </header>
        <section className="stack checklist">
          {items.map((item) => (
            <article className={`card checklist-item status-${item.status}`} key={item.id}>
              <h3>{item.title}</h3>
              {item.note && <p className="item-note">{item.note}</p>}
              <div className="actions three">
                <button onClick={() => updateItem(item, 'ok')} disabled={busy} className={item.status === 'ok' ? 'selected-action' : ''}>תקין</button>
                <button onClick={() => updateItem(item, 'issue')} disabled={busy} className={item.status === 'issue' ? 'selected-action issue' : ''}>ליקוי</button>
                <button onClick={() => updateItem(item, 'not_applicable')} disabled={busy} className={item.status === 'not_applicable' ? 'selected-action' : ''}>לא רלוונטי</button>
              </div>
            </article>
          ))}
          {!items.length && <div className="card">לא נמצאו סעיפי צ׳ק־ליסט לביקור זה.</div>}
          <label className="card stack">סיכום ביקור
            <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="הערה כללית, אם יש" />
          </label>
          <button className="primary finish" disabled={busy || remaining > 0} onClick={completeVisit}>סיום ביקור</button>
          {remaining > 0 && <small className="center">יש להשלים את כל סעיפי החובה לפני סיום.</small>}
          {message && <div className="notice">{message}</div>}
        </section>
      </main>
    );
  }

  if (selected) {
    return (
      <main className="page">
        <button className="link-button" onClick={() => setSelected(null)}>→ חזרה לעסקים</button>
        <section className="card business-detail">
          <h1>{selected.name}</h1>
          {selected.address && <p>{selected.address}</p>}
          {selected.kashrut_status && <span className="pill">{selected.kashrut_status}</span>}
          <div className="segmented">
            <button className={mode === 'mashgiach' ? 'active' : ''} onClick={() => setMode('mashgiach')}>ביקור משגיח</button>
            <button className={mode === 'inspector' ? 'active' : ''} onClick={() => setMode('inspector')}>ביקור מפקח</button>
          </div>
          <button className="primary" disabled={busy} onClick={startVisit}>התחל ביקור</button>
          <small>בעת הפתיחה יישמר מיקום הכניסה וייטען הצ׳ק־ליסט הפרטני של העסק.</small>
        </section>
        {message && <div className="notice">{message}</div>}
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div><strong>מערכת הכשרות</strong><small>העסקים שלי</small></div>
        <button className="link-button" onClick={() => supabase.auth.signOut()}>יציאה</button>
      </header>
      {message && <div className="notice">{message}</div>}
      <section className="stack">
        {businesses.map((business) => (
          <button className="card business-card" key={business.id} onClick={() => setSelected(business)}>
            <div><strong>{business.name}</strong>{business.address && <small>{business.address}</small>}</div>
            <span>←</span>
          </button>
        ))}
        {!busy && businesses.length === 0 && <div className="card">לא נמצאו עסקים זמינים לחשבון זה.</div>}
      </section>
    </main>
  );
}
