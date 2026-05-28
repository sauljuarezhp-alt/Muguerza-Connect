import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Ico } from '../data/icons';
// Conexión dinámica a la capa de API
import { 
  getCurrentDoctor, 
  listPatients, 
  listInbox, 
  listAlerts 
} from '../api';
import type { Tweaks, Patient, InboxItem, Alert, Doctor } from '../types';
import { DesktopDashboard } from './DesktopDashboard';
import { DesktopPatients } from './DesktopPatients';
import { DesktopPatient } from './DesktopPatient';
import { DesktopInbox } from './DesktopInbox';
import { DesktopAgenda } from './DesktopAgenda';
import { DesktopAseguradoras } from './DesktopAseguradoras';
import { DesktopPracticeDashboard } from './DesktopPracticeDashboard';
import { NewOrderModal } from './NewOrderModal';
import { ProfilePanel, BRAND_PRESETS } from './ProfilePanel';

interface Props { tweaks: Tweaks; }

export function MCDesktop({ tweaks }: Props) {
  const { tokens, isDark, toggleDark } = useTheme();
  const [prefs, setPrefs] = useState<Tweaks>(() => {
    try {
      const saved = localStorage.getItem('mc_prefs');
      return saved ? { ...tweaks, ...JSON.parse(saved) } : tweaks;
    } catch { return tweaks; }
  });
  const [screen, setScreen] = useState(() => prefs.startScreen || 'dashboard');
  const [patientId, setPatientId] = useState('');
  const [query, setQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderPatientId, setNewOrderPatientId] = useState<string | undefined>(undefined);
  const [showProfile, setShowProfile] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string|null>(null);
  const [hoverOrder, setHoverOrder] = useState(false);
  const [hoverBell, setHoverBell] = useState(false);

  function handlePrefsChange(update: Partial<Tweaks>) {
    const next = { ...prefs, ...update };
    setPrefs(next);
    localStorage.setItem('mc_prefs', JSON.stringify(next));
    if (update.darkModeCritical !== undefined) toggleDark(update.darkModeCritical);
  }
  
  // Estados para datos sincronizados de Supabase
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  const baseColor = prefs.brandColor || '#671E75';
  const brand = isDark
    ? (BRAND_PRESETS.find(p => p.color === baseColor)?.dark ?? baseColor)
    : baseColor;

  useEffect(() => {
    async function loadGlobalData() {
      try {
        const [doc, pts, ibx, alr] = await Promise.all([
          getCurrentDoctor(),
          listPatients(),
          listInbox(),
          listAlerts()
        ]);
        setDoctor(doc);
        setPatients(pts);
        setInbox(ibx);
        setAlerts(alr);
        if (pts.length > 0) setPatientId(pts[0].id);
      } catch (e) {
        console.error("Error en Shell:", e);
      } finally {
        setLoading(false);
      }
    }
    loadGlobalData();

    // Realtime — recarga datos cuando la secretaria hace cambios
    const channel = supabase
      .channel('mc-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        listPatients().then(setPatients);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_items' }, () => {
        listInbox().then(setInbox);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        listAlerts().then(setAlerts);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_slots' }, () => {
        // agenda se recarga localmente en DesktopAgenda, aquí solo notificamos
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const goPatient = (id: string) => { setPatientId(id); setScreen('patient'); };
  const openNewOrder = (id?: string) => {
    setNewOrderPatientId(id);
    setShowNewOrder(true);
  };

  // El buscador ahora filtra sobre los pacientes reales de la DB
  const searchResults = query.trim().length > 1
    ? patients.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.dx.toLowerCase().includes(query.toLowerCase()) ||
        p.expediente.toLowerCase().includes(query.toLowerCase()) ||
        p.insurer.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const criticalNotifs = [
    ...alerts.map(a => ({ sev: a.sev, time: a.time, title: a.event, sub: a.patient, patientId: a.patientId })),
    ...inbox.filter(i => i.sev !== 'green').map(i => ({ sev: i.sev, time: i.time, title: i.subject, sub: i.preview, patientId: i.patientId })),
  ];

  if (loading) return <div style={{width:'100vw', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:tokens.bg, fontFamily:'Franklin Gothic', color:tokens.textSecondary}}>Sincronizando Muguerza Connect...</div>;

  return (
    <div style={{
      width:'100%', height:'100%',
      display:'grid', gridTemplateColumns:'220px 1fr',
      background:tokens.bg, color:tokens.text,
      fontFamily:"'Franklin Gothic Book','Libre Franklin',-apple-system,system-ui,sans-serif",
      overflow:'hidden',
    }}>
      <aside style={{background:tokens.surface, borderRight:`1px solid ${tokens.border}`, display:'flex', flexDirection:'column', padding:'16px 0'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'0 18px 14px', borderBottom:`1px solid ${tokens.borderLight}`}}>
          <div style={{width:34, height:34, borderRadius:8, background:tokens.surface, padding:3, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 0 1px ${tokens.border}`}}>
            <img src="/reach2030-logo.png" alt="REACH 2030" style={{width:'100%', height:'100%', objectFit:'contain'}}/>
          </div>
          <div>
            <div style={{fontFamily:'Franklin Gothic, Libre Franklin, sans-serif', fontWeight:500, fontSize:15, lineHeight:1, color:tokens.text}}>Muguerza <span style={{color:brand}}>Connect</span></div>
            <div style={{fontSize:10.5, color:tokens.textSecondary, marginTop:2, letterSpacing:0.3, textTransform:'uppercase'}}>Web · Consultorio</div>
          </div>
        </div>

        {[
          {id:'dashboard', label:'Dashboard', ico: Ico.home},
          {id:'patients',  label:'Pacientes', ico: Ico.users, n: patients.length},
          {id:'inbox',     label:'Inbox', ico: Ico.mail, n: inbox.filter(i=>i.sev!=='green').length || undefined, sev:'red'},
          {id:'agenda',    label:'Agenda', ico: Ico.clock},
          {id:'aseguradoras', label:'Aseguradoras', ico: Ico.shield, n: patients.filter(p=>p.authStatus==='pending').length || undefined, sev:'amber'},
          {id:'practica', label:'Mi práctica', ico: Ico.chart},
        ].map(item => {
          const active = screen === item.id;
          return (
            <div key={item.id} onClick={() => setScreen(item.id)}
              onMouseEnter={() => setHoveredNav(item.id)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
              margin:'2px 10px', padding:'9px 12px', borderRadius:8,
              display:'flex', alignItems:'center', gap:10, cursor:'pointer',
              background: active ? brand+'15' : hoveredNav === item.id ? brand+'0D' : 'transparent',
              color: active ? brand : hoveredNav === item.id ? brand : tokens.textTertiary,
              fontFamily: active ? "'Franklin Gothic','Libre Franklin'" : "'Franklin Gothic Book'",
              fontWeight:500, fontSize:13.5,
              transition:'background 0.15s, color 0.15s',
            }}>
              <span style={{display:'inline-flex', width:18, height:18}}>{item.ico}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.n != null && (
                <span style={{background: item.sev==='red' ? '#D93A3A' : item.sev==='amber' ? '#E08900' : tokens.surfaceAlt, color: item.sev ? '#fff' : tokens.textSecondary, fontSize:10, padding:'1px 6px', borderRadius:999, minWidth:18, textAlign:'center', fontWeight:500}}>{item.n}</span>
              )}
            </div>
          );
        })}

        <div onClick={() => setShowProfile(true)} style={{marginTop:'auto', padding:'12px 16px', borderTop:`1px solid ${tokens.borderLight}`, display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderRadius:8, transition:'background 0.15s'}}
          onMouseEnter={e => (e.currentTarget.style.background = brand + '0D')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{width:30, height:30, borderRadius:999, background:'linear-gradient(135deg,'+brand+' 0%, #274B96 100%)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12}}>{doctor?.initials || 'RV'}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:tokens.text}}>{doctor?.name}</div>
            <div style={{fontSize:10.5, color:tokens.textSecondary, marginTop:2}}>{doctor?.specialty}</div>
          </div>
          <span style={{color:tokens.textSecondary}}>{Ico.settings}</span>
        </div>
      </aside>

      <main style={{display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{background:tokens.surface, borderBottom:`1px solid ${tokens.border}`, padding:'10px 22px', display:'flex', alignItems:'center', gap:14, flexShrink:0, position:'relative', zIndex:40}}>
          <div style={{flex:1, position:'relative', maxWidth:460}}>
            <div style={{display:'flex', alignItems:'center', gap:8, background:tokens.surfaceAlt, border:`1px solid ${tokens.border}`, borderRadius:8, padding:'6px 12px'}}>
              <span style={{color:tokens.textSecondary, display:'flex'}}>{Ico.search}</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar paciente, expediente, SGMM…" style={{border:0, outline:0, background:'transparent', flex:1, fontSize:13, fontFamily:'inherit', color:tokens.text}}/>
              {query
                ? <span onClick={() => setQuery('')} style={{cursor:'pointer', color:tokens.textSecondary, display:'flex'}}>{Ico.x}</span>
                : <span style={{fontSize:10.5, color:tokens.textSecondary, letterSpacing:0.3}}>⌘K</span>
              }
            </div>
            {query.trim().length > 1 && (
              <div style={{position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.28)', zIndex:200, overflow:'hidden'}}>
                {searchResults.length > 0 ? searchResults.map((p, i) => (
                  <div key={p.id} onClick={() => { goPatient(p.id); setQuery(''); }}
                    style={{display:'grid', gridTemplateColumns:'10px 1fr auto', gap:12, padding:'10px 14px', alignItems:'center', cursor:'pointer', borderBottom: i<searchResults.length-1 ? `1px solid ${tokens.borderLight}` : 'none', background:tokens.surface, color:tokens.text}}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
                  >
                    <span style={{width:8, height:8, borderRadius:99, background: p.status==='red'?'#D93A3A':p.status==='amber'?'#E08900':'#10897B', display:'block'}}/>
                    <div>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13}}>{p.name}</div>
                      <div style={{fontSize:11, color:tokens.textSecondary, marginTop:1}}>{p.dx} · <span style={{fontFamily:'Roboto Mono, monospace'}}>{p.expediente}</span></div>
                    </div>
                    <span style={{fontSize:11, padding:'2px 9px', borderRadius:999, background: p.status==='red'?'rgba(217,58,58,0.15)':p.status==='amber'?'rgba(224,137,0,0.15)':'rgba(16,137,123,0.15)', color: p.status==='red'?'#D93A3A':p.status==='amber'?'#E08900':'#10897B', fontFamily:'Franklin Gothic', fontWeight:500, whiteSpace:'nowrap'}}>{p.statusLabel}</span>
                  </div>
                )) : (
                  <div style={{padding:'14px 16px', textAlign:'center', fontSize:13, color:tokens.textSecondary}}>Sin resultados para «{query}»</div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => openNewOrder()}
            onMouseEnter={() => setHoverOrder(true)}
            onMouseLeave={() => setHoverOrder(false)}
            style={{background: hoverOrder ? brand+'CC' : brand, color:'#fff', border:0, padding:'8px 14px', borderRadius:8, fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', flexShrink:0, transition:'background 0.15s'}}>
            {Ico.plus} Nueva orden
          </button>

          <div style={{position:'relative', flexShrink:0}}>
            <div onClick={() => setShowNotifications(!showNotifications)}
              onMouseEnter={() => setHoverBell(true)}
              onMouseLeave={() => setHoverBell(false)}
              style={{width:34, height:34, borderRadius:999, background: showNotifications ? brand+'18' : hoverBell ? brand+'12' : tokens.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', cursor:'pointer', color: showNotifications || hoverBell ? brand : tokens.text, transition:'background 0.15s, color 0.15s'}}>
              {Ico.bell}
              {criticalNotifs.length > 0 && <div style={{position:'absolute', top:6, right:6, width:8, height:8, borderRadius:999, background:'#D93A3A', border:`2px solid ${tokens.surface}`}}/>}
            </div>
            {showNotifications && (
              <div style={{position:'absolute', top:'calc(100% + 8px)', right:0, width:360, background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, boxShadow:'0 12px 40px rgba(0,0,0,0.35)', zIndex:200, overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:`1px solid ${tokens.borderLight}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:14, color:tokens.text}}>Notificaciones</div>
                  <span style={{fontSize:11, color:brand, cursor:'pointer', fontFamily:'Franklin Gothic', fontWeight:500}}>{criticalNotifs.length} pendientes</span>
                </div>
                {criticalNotifs.map((n, i) => (
                  <div key={i} onClick={() => { if (n.patientId) { goPatient(n.patientId); setShowNotifications(false); } }}
                    style={{padding:'10px 16px', borderBottom: i<criticalNotifs.length-1 ? `1px solid ${tokens.borderLight}` : 'none', display:'grid', gridTemplateColumns:'8px 1fr 52px', gap:12, alignItems:'start', cursor: n.patientId ? 'pointer' : 'default', background:tokens.surface}}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
                  >
                    <span style={{width:8, height:8, borderRadius:99, marginTop:5, background: n.sev==='red'?'#D93A3A':'#E08900', display:'block', flexShrink:0}}/>
                    <div>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, lineHeight:1.3, color:tokens.text}}>{n.title}</div>
                      <div style={{fontSize:11, color:tokens.textTertiary, opacity:0.9, marginTop:2}}>{n.sub}</div>
                    </div>
                    <div style={{fontFamily:'Roboto Mono, monospace', fontSize:10.5, color:tokens.textSecondary, textAlign:'right'}}>{n.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'20px 24px'}} onClick={() => setShowNotifications(false)}>
          {screen === 'dashboard'    && <DesktopDashboard goPatient={goPatient} brand={brand} setScreen={setScreen} setShowNewOrder={setShowNewOrder}/>}
          {screen === 'patients'     && <DesktopPatients goPatient={goPatient} brand={brand}/>}
          {screen === 'patient'      && <DesktopPatient patientId={patientId} onBack={() => setScreen('patients')} brand={brand} onNewOrder={openNewOrder}/>}
          {screen === 'inbox'        && <DesktopInbox goPatient={goPatient} brand={brand}/>}
          {screen === 'agenda'       && <DesktopAgenda brand={brand}/>}
          {screen === 'aseguradoras' && <DesktopAseguradoras brand={brand} goPatient={goPatient}/>}
          {screen === 'practica'     && <DesktopPracticeDashboard brand={brand} goPatient={goPatient}/>}
        </div>
      </main>

      {showNewOrder && <NewOrderModal brand={brand} initialPatientId={newOrderPatientId} onClose={() => setShowNewOrder(false)}/>}
      {showProfile  && <ProfilePanel doctor={doctor} prefs={prefs} brand={brand} onClose={() => setShowProfile(false)} onPrefsChange={handlePrefsChange}/>}
    </div>
  );
}
