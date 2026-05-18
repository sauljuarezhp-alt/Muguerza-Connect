import { useState, useEffect, useRef } from 'react';
import { SectionHeader } from './SectionHeader';
import { useTheme } from '../context/ThemeContext';
import { Ico } from '../data/icons'; // <--- ¡Fix 1: Importación de íconos agregada!
import {
  getCurrentDoctor,
  listPatients,
  listAgendaToday,
  listAlerts,
  listInbox,
  listPending,
  resolvePendingItem,
  buildPreconsulta,
} from '../api';
import type { Doctor, Patient, AgendaSlot, Alert, InboxItem, PendingItem } from '../types';
import type { PreconsultaData } from '../api/preconsulta';
import { PreconsultaCard } from './PreconsultaCard';

interface Props {
  goPatient: (id: string) => void;
  brand: string;
  setScreen: (s: string) => void;
  setShowNewOrder: (b: boolean) => void;
}

export function DesktopDashboard({ goPatient, brand, setScreen, setShowNewOrder }: Props) {
  const { tokens } = useTheme();
  const [data, setData] = useState<{
    doctor: Doctor | null;
    patients: Patient[];
    agenda: AgendaSlot[];
    alerts: Alert[];
    inbox: InboxItem[];
    pending: PendingItem[];
  }>({
    doctor: null,
    patients: [],
    agenda: [],
    alerts: [],
    inbox: [],
    pending: []
  });

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string[]>([]);
  const [preconsulta, setPreconsulta] = useState<PreconsultaData | null>(null);
  const [preconsultaDismissed, setPreconsultaDismissed] = useState(false);
  const notifiedSlotRef = useRef<string | null>(null);
  const currentSlotRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [doc, pts, agd, alr, ibx, pnd] = await Promise.all([
          getCurrentDoctor(),
          listPatients(),
          listAgendaToday(),
          listAlerts(),
          listInbox(),
          listPending()
        ]);
        setData({ doctor: doc, patients: pts, agenda: agd, alerts: alr, inbox: ibx, pending: pnd });

        if (doc?.id) {
          const pre = await buildPreconsulta(doc.id);
          setPreconsulta(pre);
        }

        // Pedir permiso de notificaciones al cargar, no dentro del interval
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (e) {
        console.error("Error en Dashboard:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Poll pre-consulta cada 60s y dispara notificación browser a 5 min
  useEffect(() => {
    if (!data.doctor?.id) return;
    const doctorId = data.doctor.id;

    const interval = setInterval(async () => {
      try {
        const pre = await buildPreconsulta(doctorId);
        setPreconsulta(pre);

        // Solo resetear dismiss cuando llega una cita diferente
        if (pre && pre.slotId !== currentSlotRef.current) {
          currentSlotRef.current = pre.slotId;
          setPreconsultaDismissed(false);
        }

        // Notificación automática: exactamente en la ventana de ≤5 min, una sola vez por slot
        if (
          pre &&
          pre.minutesUntil <= 5 &&
          pre.minutesUntil > 0 &&
          notifiedSlotRef.current !== pre.slotId
        ) {
          notifiedSlotRef.current = pre.slotId;
          if (Notification.permission === 'granted') {
            new Notification('Muguerza Connect', {
              body: `${pre.patientName} en ${pre.minutesUntil} min — ${pre.dx}`,
              icon: '/favicon.ico',
            });
          }
        }
      } catch (e) {
        console.error('Error actualizando pre-consulta:', e);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [data.doctor?.id]);

  if (loading) return <div style={{padding:20, fontFamily:'Franklin Gothic', color:tokens.textSecondary}}>Cargando dashboard...</div>;

  const kpis = [
    {n: data.patients.length, l:'Pacientes activos', sub:'Base de datos real', c: brand, to:'patients'},
    {n: data.agenda.length,   l:'Consultas hoy',     sub:`${data.agenda.filter(a => a.status==='checked').length} completadas`,  c: '#10897B', to:'agenda'},
    {n: data.alerts.filter(a => a.sev==='red').length, l:'Alertas críticas', sub: data.alerts.find(a => a.sev==='red')?.event || 'Sin incidencias', c: '#D93A3A', action: () => { const reds = data.alerts.filter(a => a.sev==='red'); reds.length === 1 ? goPatient(reds[0].patientId) : setScreen('inbox'); }},
    {n: data.pending.length, l:'Órdenes por firmar', sub:'Lab · Imagen · Receta', c: '#E08900', action: () => setShowNewOrder(true)},
  ];

const handleResolvePending = async (e: React.MouseEvent, id?: string) => {
  e.stopPropagation(); 
  if (!id || completing.includes(id)) return;
  
  // Inicia animación visual
  setCompleting(prev => [...prev, id]);

  // Delay de 350ms para feedback del usuario antes de borrar
  setTimeout(async () => {
    setData(prev => ({
      ...prev,
      pending: prev.pending.filter(p => p.id !== id)
    }));
    setCompleting(prev => prev.filter(c => c !== id));

    try { await resolvePendingItem(id); } 
    catch (error) { console.error("Error al borrar:", error); 
    }
  }, 350);
};
  
  const now = new Date();
  const fechaLabel = now.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }).replace(/^\w/, c => c.toUpperCase());
  const horaLabel = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const saludo = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11.5, color:brand, fontFamily:'Franklin Gothic', fontWeight:500, letterSpacing:1.5, textTransform:'uppercase'}}>{fechaLabel} · {horaLabel}</div>
        <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:26, margin:'4px 0 0', letterSpacing:-0.3}}>{saludo}, {data.doctor?.name}</h1>
        <div style={{fontSize:13, color:tokens.textTertiary, opacity:0.9, marginTop:2}}>{data.agenda.length} consultas · {data.alerts.filter(a => a.sev==='red').length} alerta crítica · {data.inbox.filter(i=>i.sev!=='green').length} pendientes en inbox</div>
      </div>

      {preconsulta && !preconsultaDismissed && (
        <PreconsultaCard
          data={preconsulta}
          brand={brand}
          onOpenPatient={goPatient}
          onDismiss={() => setPreconsultaDismissed(true)}
        />
      )}

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:16}}>
        {kpis.map((k, i) => (
          <div key={i} onClick={() => (k as any).action ? (k as any).action() : setScreen((k as any).to)}
            style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, padding:14, cursor:'pointer', transition:'box-shadow 0.15s'}}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow='0 0 0 2px '+k.c+'55'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow='none'}
          >
            <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:30, color:k.c, lineHeight:1}}>{k.n}</div>
            <div style={{fontSize:12, color:tokens.textTertiary, marginTop:6, fontFamily:'Franklin Gothic', fontWeight:500, letterSpacing:0.2}}>{k.l}</div>
            <div style={{fontSize:11, color:tokens.textSecondary, marginTop:2}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12}}>
        {/* COLUMNA 1 */}
        <div>
          <SectionHeader title="Alertas activas" right="Ver todas" onRight={() => setScreen('inbox')}/>
          <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden', marginBottom:14}}>
            {data.alerts.length === 0 ? (
              <div style={{padding:'20px', textAlign:'center', color:tokens.textSecondary, fontSize:13, fontFamily:'Franklin Gothic'}}>Sin alertas activas.</div>
            ) : data.alerts.map((a, i) => (
              <div key={i} onClick={() => goPatient(a.patientId)}
                style={{padding:'12px 14px', cursor:'pointer', display:'grid', gridTemplateColumns:'8px 1fr auto', gap:12, alignItems:'center', borderLeft:`3px solid ${a.sev==='red'?'#D93A3A':a.sev==='amber'?'#E08900':'#10897B'}`, borderBottom: i<data.alerts.length-1?`1px solid ${tokens.borderLight}`:'none', background: a.sev==='red'?'rgba(217,58,58,0.08)':a.sev==='amber'?'rgba(224,137,0,0.08)':'rgba(16,137,123,0.08)'}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.85'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}
              >
                <div/>
                <div>
                  <div style={{display:'inline-flex', alignItems:'center', gap:8, marginBottom:3}}>
                    <span style={{background: a.sev==='red'?'#D93A3A':a.sev==='amber'?'#E08900':'#10897B', color:'#fff', padding:'2px 8px', borderRadius:999, fontSize:9.5, fontFamily:'Franklin Gothic', fontWeight:500, letterSpacing:0.6, textTransform:'uppercase'}}>
                      {a.sev==='red'?'Crítico':a.sev==='amber'?'Atención':'Info'}
                    </span>
                    <span style={{fontFamily:'Roboto Mono, monospace', fontSize:11, color:tokens.textTertiary}}>{a.time}</span>
                  </div>
                  <div style={{fontSize:13.5, color:tokens.text}}><b style={{fontFamily:'Franklin Gothic', fontWeight:500}}>{a.patient}</b> · {a.event}</div>
                </div>
                <div style={{color:tokens.textSecondary, fontSize:18}}>›</div>
              </div>
            ))}
          </div>

          {(() => {
            const inboxPreview = data.inbox.slice(0, 4);
            const inboxCount = inboxPreview.length;
            const label = inboxCount === 0 ? 'Inbox' : `Inbox · últimos ${inboxCount}`;
            return (
              <>
                <SectionHeader title={label} right="Abrir inbox" onRight={() => setScreen('inbox')}/>
                <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
                  {inboxCount === 0 ? (
                    <div style={{padding:'20px', textAlign:'center', color:tokens.textSecondary, fontSize:13, fontFamily:'Franklin Gothic'}}>Sin mensajes recientes.</div>
                  ) : inboxPreview.map((m, i) => (
                    <div key={i} onClick={() => m.patientId && goPatient(m.patientId)}
                      style={{padding:'10px 14px', display:'grid', gridTemplateColumns:'8px 1fr auto', gap:12, borderBottom: i<inboxCount-1?`1px solid ${tokens.borderLight}`:'none', cursor:'pointer', background:tokens.surface}}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
                    >
                      <div><span style={{display:'inline-block', width:8, height:8, borderRadius:99, background: m.sev==='red'?'#D93A3A':m.sev==='amber'?'#E08900':'#10897B', marginTop:6}}/></div>
                      <div>
                        <div style={{fontSize:10.5, color:tokens.textSecondary, textTransform:'uppercase', letterSpacing:0.6, fontFamily:'Franklin Gothic', fontWeight:500}}>{m.src}</div>
                        <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color:tokens.text}}>{m.subject}</div>
                        <div style={{fontSize:11.5, color:tokens.textTertiary, opacity:0.9, marginTop:1}}>{m.preview}</div>
                      </div>
                      <div style={{fontFamily:'Roboto Mono, monospace', fontSize:10.5, color:tokens.textSecondary}}>{m.time}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* COLUMNA 2 */}
        <div>
          <SectionHeader title="Agenda · Hoy" right="Semana" onRight={() => setScreen('agenda')}/>
          <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
            {data.agenda.length === 0 ? (
              <div style={{padding:'20px', textAlign:'center', color:tokens.textSecondary, fontSize:13, fontFamily:'Franklin Gothic'}}>Sin citas para hoy.</div>
            ) : data.agenda.map((r, i) => (
              <div key={i} style={{padding:'11px 14px', borderBottom: i<data.agenda.length-1?`1px solid ${tokens.borderLight}`:'none', display:'grid', gridTemplateColumns:'52px 1fr auto', gap:10, alignItems:'center'}}>
                <div style={{fontFamily:'Roboto Mono, monospace', fontSize:12.5, fontWeight:500, color:tokens.text}}>{r.tm}</div>
                <div>
                  <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color:tokens.text}}>{r.name}</div>
                  <div style={{fontSize:11.5, color:tokens.textTertiary, opacity:0.9, marginTop:1}}>{r.why}</div>
                </div>
                <div style={{fontSize:10, padding:'2px 7px', borderRadius:999, fontFamily:'Franklin Gothic', fontWeight:500, letterSpacing:0.4, background: r.status==='checked'?'rgba(16,137,123,0.15)':r.status==='waiting'?'rgba(224,137,0,0.15)':tokens.surfaceAlt, color: r.status==='checked'?'#10897B':r.status==='waiting'?'#E08900':tokens.textSecondary}}>
                  {r.status==='checked'?'Check':r.status==='waiting'?'En sala':'Pendiente'}
                </div>
              </div>
            ))}
          </div>

          <div style={{height:14}}/>
          <SectionHeader title="Pendientes"/>
          <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, maxHeight: 190, overflowY: 'auto', overflowX: 'hidden'}}>
            {data.pending.length === 0 ? (
              <div style={{padding:'20px', textAlign:'center', color:tokens.textSecondary, fontSize:13, fontFamily:'Franklin Gothic'}}>No hay tareas pendientes.</div>
            ) : data.pending.map((p, i) => (
              <div key={i} onClick={() => p.patientId ? goPatient(p.patientId) : p.to && setScreen(p.to)}
                style={{padding:'10px 14px', borderBottom: i<data.pending.length-1?`1px solid ${tokens.borderLight}`:'none', display:'flex', gap:12, alignItems:'center', cursor:'pointer', background:tokens.surface}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
              >
                <div style={{width:32, height:32, borderRadius:8, background: brand+'18', color:brand, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0}}>{p.ico}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color:tokens.text}}>{p.label}</div>
                  <div style={{fontSize:11.5, color:tokens.textTertiary, opacity:0.9}}>{p.sub}</div>
                </div>
                
                <div style={{display:'flex', alignItems:'center', gap:10, flexShrink: 0}}>
                  <div style={{background:'#D93A3A', color:'#fff', borderRadius:999, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10.5, fontFamily:'Franklin Gothic', fontWeight:500}}>{p.badge}</div>
      
                  {/* Casilla interactiva: vacía por default, verde al completar */}
                  <div
                    onClick={(e) => handleResolvePending(e, p.id)}
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: completing.includes(p.id!) ? '1.5px solid #10897B' : `1.5px solid ${tokens.border}`,
                      background: completing.includes(p.id!) ? '#10897B' : tokens.surface,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    {completing.includes(p.id!) && <span style={{transform: 'scale(0.8)', display:'flex'}}>{Ico.check}</span>}
                  </div>
                </div>
              </div>
            ))} {}
          </div>
        </div>
      </div>
    </>
  );
}