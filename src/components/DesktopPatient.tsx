import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ico } from '../data/icons';
import { getPatient, listLabsForPatient } from '../api';
import { listDocuments, listHistory } from '../api/secretary';
import type { Patient } from '../types';
import { SectionHeader } from './SectionHeader';
import { DocumentViewer, type DocRef } from './DocumentViewer';
import { useTheme } from '../context/ThemeContext';
import { PatientStoryView } from './PatientStoryView';
import { PrecitaSummaryCard } from './PrecitaSummaryCard';
import { getPrecitaForSlot, type PrecitaRecord } from '../api/precita';

interface Props { patientId: string; onBack: () => void; brand: string; onNewOrder: (patientId: string) => void; }

export function DesktopPatient({ patientId, onBack, brand, onNewOrder }: Props) {
  const { tokens } = useTheme();
  const [p, setP] = useState<Patient | null>(null);
  const [labs, setLabs] = useState<any[]>([]);
  const [patientDocs, setPatientDocs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState('resumen');
  const [viewingDoc, setViewingDoc] = useState<DocRef | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyPrecitas, setHistoryPrecitas] = useState<Record<string, PrecitaRecord | null>>({});

  useEffect(() => {
    async function loadPatientData() {
      setLoading(true);
      try {
        const [patData, labsData, docs, hist] = await Promise.all([
          getPatient(patientId),
          listLabsForPatient(patientId),
          listDocuments(patientId),
          listHistory(patientId),
        ]);

        setP(patData);
        setLabs(labsData);
        setPatientDocs(docs);
        setHistory(hist);
      } catch (e) {
        console.error("Error cargando expediente:", e);
      } finally {
        setLoading(false);
      }
    }
    loadPatientData();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    const reloadLabs = () => listLabsForPatient(patientId).then(setLabs).catch(console.error);
    const reloadDocs = () => listDocuments(patientId).then(setPatientDocs).catch(console.error);
    const reloadHistory = () => listHistory(patientId).then(setHistory).catch(console.error);

    const channel = supabase
      .channel(`patient-${patientId}-documents`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labs', filter: `patient_id=eq.${patientId}` }, reloadLabs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_documents', filter: `patient_id=eq.${patientId}` }, reloadDocs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_history', filter: `patient_id=eq.${patientId}` }, reloadHistory)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  const toggleHistoryEvent = async (event: any) => {
    const nextId = expandedHistoryId === event.id ? null : event.id;
    setExpandedHistoryId(nextId);
    if (!nextId) return;
    if (event.event_type !== 'precita_submitted' || !event.agenda_slot_id || historyPrecitas[event.id] !== undefined) return;
    try {
      const record = await getPrecitaForSlot(event.agenda_slot_id);
      setHistoryPrecitas(prev => ({ ...prev, [event.id]: record }));
    } catch {
      setHistoryPrecitas(prev => ({ ...prev, [event.id]: null }));
    }
  };

  const tabs = [
    {id:'resumen', label:'Resumen'},
    {id:'estudios', label:'Estudios', n: labs.length > 0 ? labs.length : undefined},
    {id:'aseguradora', label:'Aseguradora'},
    {id:'historial', label:'Historial'},
    {id:'story', label:'👤 Modo paciente'},
  ];

  if (loading || !p) {
    return (
      <div style={{padding: '40px 20px', fontFamily:'Franklin Gothic', color:tokens.textSecondary}}>
        Abriendo expediente clínico...
      </div>
    );
  }

  return (
    <>
      <div onClick={onBack} style={{fontSize:12, color:brand, cursor:'pointer', marginBottom:10, fontFamily:'Franklin Gothic', fontWeight:500}}>‹ Pacientes</div>

      <div style={{background:brand, color:'#fff', borderRadius:14, padding:'20px 22px', marginBottom:12, display:'grid', gridTemplateColumns:'1fr auto', gap:18}}>
        <div>
          <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, letterSpacing:-0.2}}>{p.name}</div>
          <div style={{fontSize:13, opacity:0.8, marginTop:3}}>{p.age} {p.sex} · <span style={{fontFamily:'Roboto Mono, monospace'}}>{p.expediente}</span> · {p.insurer}</div>
          <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap'}}>
            <span style={{background:'#fff', color:brand, padding:'3px 10px', borderRadius:999, fontSize:11, fontFamily:'Franklin Gothic', fontWeight:500}}>{p.dx}</span>
            <span style={{background: p.status==='red'?'#D93A3A':p.status==='amber'?'#E08900':'rgba(255,255,255,0.2)', color:'#fff', padding:'3px 10px', borderRadius:999, fontSize:11, fontFamily:'Franklin Gothic', fontWeight:500}}>{p.statusLabel}</span>
          </div>
        </div>
        <div style={{display:'flex', gap:8, alignSelf:'end'}}>
          <button onClick={() => onNewOrder(patientId)} style={{background:'#fff', color:brand, border:0, padding:'8px 14px', borderRadius:8, fontSize:12, fontFamily:'Franklin Gothic', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer'}}>{Ico.pill} Nueva orden</button>
        </div>
      </div>

      <div style={{display:'flex', gap:4, borderBottom:`1px solid ${tokens.border}`, marginBottom:14}}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{padding:'8px 14px', cursor:'pointer', fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color: tab===t.id?brand:tokens.textSecondary, borderBottom: tab===t.id?`2px solid ${brand}`:'2px solid transparent', marginBottom:-1}}>
            {t.label} {t.n && <span style={{background:'#D93A3A', color:'#fff', fontSize:10, padding:'1px 5px', borderRadius:999, marginLeft:4}}>{t.n}</span>}
          </div>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:14}}>
          <div>
            <SectionHeader title="Datos clínicos"/>
            <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
              {[
                {k:'Diagnóstico', v: p.dx},
                {k:'Medicación activa', v: (p.meds?.length ? p.meds : ['—']).join(' · ')},
                {k:'Alergias', v: (p.allergies?.length ? p.allergies : ['Ninguna']).join(', ')},
                {k:'Última visita', v: p.lastVisit},
                {k:'Próxima cita', v: p.nextVisit},
              ].map((r, i, arr) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'160px 1fr', gap:10, padding:'11px 14px', borderBottom: i<arr.length-1?`1px solid ${tokens.borderLight}`:'none', fontSize:13, color:tokens.text}}>
                  <div style={{color:tokens.textSecondary, fontSize:11, fontFamily:'Franklin Gothic', fontWeight:500, textTransform:'uppercase', letterSpacing:0.5}}>{r.k}</div>
                  <div>{r.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            {p.vitals && (
              <>
                <SectionHeader title={`Signos vitales${p.vitalsRecordedAt ? ' · ' + new Date(p.vitalsRecordedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}`}/>
                <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, padding:14, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
                  {[
                    {l:'HR', v: p.vitals.hr, u:'bpm', c:'#D93A3A'},
                    {l:'TA', v: p.vitals.bp, u:'mmHg', c:'#0899D2'},
                    {l:'Temp', v: p.vitals.temp, u:'°C', c:'#D93A3A'},
                    {l:'SpO₂', v: p.vitals.spo2, u:'%', c:'#0899D2'},
                  ].map((v, i) => (
                    <div key={i} style={{textAlign:'center'}}>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:22, color:v.c, fontVariantNumeric:'tabular-nums'}}>{v.v}</div>
                      <div style={{fontSize:10, color:tokens.textSecondary, marginTop:2, letterSpacing:0.5, textTransform:'uppercase'}}>{v.l} {v.u}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <PrecitaSummaryCard patientId={patientId} brand={brand} />
        </>
      )}

      {tab === 'estudios' && (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>

          {patientDocs.filter(d => d.type === 'Estudio' || d.type === 'Resultado de lab').length > 0 && (
            <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
              <div style={{padding:'10px 16px', borderBottom:`1px solid ${tokens.borderLight}`, fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, color:tokens.text}}>
                Archivos adjuntos
              </div>
              {patientDocs.filter(d => d.type === 'Estudio' || d.type === 'Resultado de lab').map((d, i, arr) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                  style={{display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: i<arr.length-1?`1px solid ${tokens.borderLight}`:'none', textDecoration:'none', color:tokens.text}}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <span style={{fontSize:20}}>{d.type === 'Resultado de lab' ? '🧪' : '🔬'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13}}>{d.name}</div>
                    <div style={{fontSize:11, color:tokens.textSecondary, marginTop:1}}>{d.type} · {new Date(d.uploaded_at).toLocaleDateString('es-MX')}</div>
                  </div>
                  <span style={{fontSize:12, color:brand, fontFamily:'Franklin Gothic', fontWeight:500}}>Ver ›</span>
                </a>
              ))}
            </div>
          )}

        <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
          <div style={{padding:'10px 16px', borderBottom:`1px solid ${tokens.borderLight}`, fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, display:'flex', justifyContent:'space-between', color:tokens.text}}>
            <span>Laboratorio · Resultados Históricos</span>
          </div>
          {labs.length === 0 ? (
            <div style={{padding: '20px', color: tokens.textSecondary, fontSize: 13, textAlign: 'center'}}>No hay resultados numéricos registrados.</div>
          ) : labs.map((l, i) => (
            <div key={i}
              onClick={() => setViewingDoc({ kind:'estudio', title:l.n, subtitle:`Laboratorio · ${p.name} · ${p.expediente}`, meta:`Resultado: ${l.val} ${l.unit} · Rango ${l.range}` })}
              style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 0.8fr 0.8fr', gap:10, padding:'10px 16px', borderBottom: i<labs.length-1?`1px solid ${tokens.borderLight}`:'none', alignItems:'center', fontSize:13, cursor:'pointer', background:tokens.surface}}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
            >
              <div><div style={{fontFamily:'Franklin Gothic', fontWeight:500, color:tokens.text}}>{l.n}</div><div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace'}}>Rango {l.range}</div></div>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:15, fontVariantNumeric:'tabular-nums', color: l.st==='hi'?'#D93A3A':l.st==='lo'?'#FF9500':'#34C759'}}>{l.val} <span style={{fontSize:10, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace', fontWeight:400}}>{l.unit}</span></div>
              <div style={{color:tokens.textSecondary, fontSize:12, fontFamily:'Roboto Mono, monospace'}}>{l.prev != null ? `prev ${l.prev}` : '—'}</div>
              <div style={{padding:'2px 8px', borderRadius:6, fontSize:11, fontFamily:'Roboto Mono, monospace', textAlign:'center', background: l.dir==='up'?'rgba(217,58,58,0.15)':l.dir==='down'?'rgba(16,137,123,0.15)':tokens.surfaceAlt, color: l.dir==='up'?'#D93A3A':l.dir==='down'?'#10897B':tokens.textSecondary}}>{l.delta ?? '—'}</div>
              <div style={{color:tokens.textSecondary, textAlign:'right', fontSize:16}}>›</div>
            </div>
          ))}
        </div>
        </div>
      )}

      {tab === 'aseguradora' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr', gap:12}}>
          <div style={{background: tokens.isDark ? 'rgba(224,137,0,0.12)' : 'linear-gradient(135deg, #FFF4DB 0%, #FFF8E8 100%)', borderRadius:12, padding:16, borderLeft:'4px solid #E08900'}}>
            <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:11, letterSpacing:1.2, textTransform:'uppercase', color:'#E08900'}}>Autorización SGMM · {p.insurer}</div>
            <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:20, marginTop:3, color:tokens.text}}>{p.authStatus==='approved' ? '✓ Aprobada' : 'Pendiente · documentación'}</div>
            {p.authNote && <div style={{fontSize:13, color:tokens.textSecondary, marginTop:6}}>{p.authNote}</div>}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, padding:14}}>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:11, letterSpacing:1.2, textTransform:'uppercase', color:tokens.textSecondary, marginBottom:10}}>Cobertura</div>
              {[{k:'Póliza', v: p.policy},{k:'Deducible', v: p.deducible || '—'},{k:'Coaseguro', v: p.coaseguro || '—'},{k:'Vigencia', v: p.vigenciaPoliza || '—'}].map((r, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:12.5, borderBottom: i<3?`1px solid ${tokens.borderLight}`:'none', color:tokens.text}}>
                  <span style={{color:tokens.textSecondary}}>{r.k}</span><span style={{fontFamily:'Franklin Gothic', fontWeight:500}}>{r.v}</span>
                </div>
              ))}
              <div onClick={() => setViewingDoc({ kind:'poliza', title:`Póliza ${p.policy}`, subtitle:`${p.insurer} · ${p.name}`, meta:'Documento de cobertura SGMM' })}
                style={{marginTop:12, padding:'10px 12px', background:brand+'10', border:`1px solid ${brand}30`, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:10}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=brand+'18'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=brand+'10'}
              >
                <span style={{color:brand, display:'flex'}}>{Ico.file}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5, fontFamily:'Franklin Gothic', fontWeight:500, color:brand}}>Ver póliza completa (PDF)</div>
                  <div style={{fontSize:10.5, color:tokens.textSecondary, marginTop:1}}>{p.insurer} · {p.policy}</div>
                </div>
                <span style={{color:brand, fontSize:16}}>›</span>
              </div>
            </div>
            <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, padding:14}}>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:11, letterSpacing:1.2, textTransform:'uppercase', color:tokens.textSecondary, marginBottom:10}}>
                Documentos
              </div>
              {patientDocs.length === 0 ? (
                <div style={{fontSize:12.5, color:tokens.textSecondary, padding:'8px 0'}}>Sin documentos adjuntos.</div>
              ) : patientDocs.map((d, i) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                  style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 8px', fontSize:12.5, borderBottom: i<patientDocs.length-1?`1px solid ${tokens.borderLight}`:'none', borderRadius:6, textDecoration:'none', color:tokens.text}}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <span>{d.name}</span>
                  <span style={{fontSize:10.5, padding:'1px 8px', borderRadius:999, background: d.type==='Póliza'?'rgba(224,137,0,0.15)':'rgba(16,137,123,0.15)', color: d.type==='Póliza'?'#E08900':'#10897B', fontFamily:'Franklin Gothic', fontWeight:500}}>{d.type}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
          {history.length === 0 ? (
            <div style={{padding:'32px 20px', textAlign:'center', color:tokens.textSecondary, fontSize:13}}>Sin eventos registrados en el historial.</div>
          ) : history.map((e, i) => {
            const icoMap: Record<string, React.ReactNode> = { clock: Ico.clock, flask: Ico.flask, pill: Ico.pill, file: Ico.file, image: Ico.image, stethoscope: Ico.stethoscope, shield: Ico.shield };
            const legacyColorMap: Record<string, string> = { cita: brand, orden: '#10897B', documento: '#274B96' };
            const eventTypeIcoMap: Record<string, React.ReactNode> = {
              precita_submitted: <span style={{fontSize:15}}>📋</span>,
              consultation_closed: Ico.stethoscope,
              document_uploaded: Ico.file,
              lab_result_recorded: Ico.flask,
              lab_extraction_summary: Ico.flask,
              legacy_consultation_note: Ico.clock,
              legacy_order_note: Ico.file,
              legacy_history_note: Ico.file,
            };
            const eventTypeColorMap: Record<string, string> = {
              precita_submitted: brand,
              consultation_closed: brand,
              document_uploaded: '#274B96',
              lab_result_recorded: '#10897B',
              lab_extraction_summary: '#10897B',
              legacy_consultation_note: '#8A5A9E',
              legacy_order_note: '#8C6A10',
              legacy_history_note: tokens.textSecondary,
            };
            const eventTypeLabelMap: Record<string, string> = {
              precita_submitted: 'Pre-cita',
              consultation_closed: 'Consulta',
              document_uploaded: 'Documento',
              lab_result_recorded: 'Lab',
              lab_extraction_summary: 'Labs IA',
              legacy_consultation_note: 'Consulta legacy',
              legacy_order_note: 'Orden legacy',
              legacy_history_note: 'Legacy',
            };
            const ico = (e.event_type && eventTypeIcoMap[e.event_type]) || icoMap[e.icon] || Ico.clock;
            const color = (e.event_type && eventTypeColorMap[e.event_type]) || legacyColorMap[e.type] || brand;
            const label = e.event_type ? eventTypeLabelMap[e.event_type] : null;
            const displayDate = e.occurred_at ?? e.created_at;
            const fecha = new Date(displayDate).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' });
            const isExpanded = expandedHistoryId === e.id;
            const metadata = e.metadata || {};
            const doc = e.document_id ? patientDocs.find(d => d.id === e.document_id) : null;
            const lab = e.lab_id ? labs.find(l => l.id === e.lab_id) : null;
            const precita = e.event_type === 'precita_submitted' ? historyPrecitas[e.id] : undefined;
            const detailRows: { label: string; value: React.ReactNode }[] = [
              { label: 'Fecha del evento', value: new Date(displayDate).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' }) },
            ];
            if (e.event_type === 'consultation_closed') {
              detailRows.push(
                { label: 'Tipo de consulta', value: metadata.consultation_type_name || 'No registrado' },
                { label: 'Método de pago', value: metadata.payment_method || 'No registrado' },
                { label: 'Monto', value: metadata.fee != null ? `$${Number(metadata.fee).toLocaleString('es-MX')}` : 'No registrado' },
                { label: 'Cita ligada', value: e.agenda_slot_id ? `agenda_slots · ${e.agenda_slot_id}` : 'Sin liga estructurada' },
                { label: 'Consulta ligada', value: e.consultation_id ? `consultations · ${e.consultation_id}` : 'Sin liga estructurada' },
              );
            } else if (e.event_type === 'document_uploaded') {
              detailRows.push(
                { label: 'Tipo de documento', value: doc?.type || metadata.document_type || 'No registrado' },
                { label: 'Archivo', value: doc?.name || metadata.document_name || e.description || 'No registrado' },
                { label: 'Documento ligado', value: e.document_id ? `patient_documents · ${e.document_id}` : 'Sin liga estructurada' },
              );
              if (doc?.url) detailRows.push({ label: 'Acción', value: <a href={doc.url} target="_blank" rel="noreferrer" style={{color:brand, textDecoration:'none', fontFamily:'Franklin Gothic', fontWeight:500}}>Abrir documento</a> });
            } else if (e.event_type === 'lab_result_recorded') {
              detailRows.push(
                { label: 'Analito', value: lab?.n || metadata.analyte || 'No registrado' },
                { label: 'Resultado', value: `${lab?.val ?? metadata.value ?? '—'} ${lab?.unit ?? metadata.unit ?? ''}`.trim() },
                { label: 'Estado', value: lab?.st || metadata.status || 'No registrado' },
                { label: 'Lab ligado', value: e.lab_id ? `labs · ${e.lab_id}` : 'Sin liga estructurada' },
              );
            } else if (e.event_type === 'precita_submitted') {
              detailRows.push(
                { label: 'Cita de la pre-cita', value: `${metadata.agenda_date || 'fecha no registrada'}${metadata.agenda_time ? ` · ${metadata.agenda_time}` : ''}` },
                { label: 'Cita ligada', value: e.agenda_slot_id ? `agenda_slots · ${e.agenda_slot_id}` : 'Sin liga estructurada' },
                { label: 'Pre-cita ligada', value: e.precita_token_id ? `precita_tokens · ${e.precita_token_id}` : 'Sin liga estructurada' },
              );
            } else {
              detailRows.push(
                { label: 'Tipo legacy', value: e.type || 'No registrado' },
                { label: 'Origen', value: e.source_table && e.source_id ? `${e.source_table} · ${e.source_id}` : 'Evento antiguo sin fuente estructurada' },
              );
            }
            return (
              <div key={e.id} style={{borderBottom: i<history.length-1?`1px solid ${tokens.borderLight}`:'none'}}>
                <div
                  onClick={() => toggleHistoryEvent(e)}
                  style={{display:'grid', gridTemplateColumns:'36px 1fr 110px 18px', gap:14, padding:'12px 16px', alignItems:'center', cursor:'pointer', background:isExpanded?tokens.surfaceAlt:tokens.surface}}
                >
                  <div style={{width:36, height:36, borderRadius:99, background:color+'22', color, display:'flex', alignItems:'center', justifyContent:'center'}}>{ico}</div>
                  <div>
                    <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13.5, color:tokens.text}}>{e.title}</div>
                      {label && <span style={{fontSize:10, padding:'1px 6px', borderRadius:999, background:color+'18', color, fontFamily:'Franklin Gothic', fontWeight:500, flexShrink:0}}>{label}</span>}
                    </div>
                    {e.description && <div style={{fontSize:12, color:tokens.textSecondary, marginTop:1}}>{e.description}</div>}
                  </div>
                  <div style={{fontSize:11, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace', textAlign:'right'}}>{fecha}</div>
                  <div style={{color:tokens.textSecondary, display:'flex', justifyContent:'center'}}>{isExpanded ? Ico.chevDown : Ico.chev}</div>
                </div>
                {isExpanded && (
                  <div style={{padding:'0 16px 14px 66px', background:tokens.surfaceAlt}}>
                    <div style={{border:`1px solid ${tokens.borderLight}`, borderRadius:10, background:tokens.surface, overflow:'hidden'}}>
                      {detailRows.map((r, idx) => (
                        <div key={r.label} style={{display:'grid', gridTemplateColumns:'150px 1fr', gap:12, padding:'9px 12px', borderBottom:idx<detailRows.length-1?`1px solid ${tokens.borderLight}`:'none', fontSize:12.5}}>
                          <div style={{fontFamily:'Franklin Gothic', fontWeight:500, color:tokens.textSecondary, textTransform:'uppercase', letterSpacing:0.4, fontSize:10.5}}>{r.label}</div>
                          <div style={{color:tokens.text, overflowWrap:'anywhere'}}>{r.value}</div>
                        </div>
                      ))}

                      {e.event_type === 'precita_submitted' && (
                        <div style={{padding:'10px 12px', borderTop:`1px solid ${tokens.borderLight}`}}>
                          {precita === undefined ? (
                            <div style={{fontSize:12.5, color:tokens.textSecondary}}>Cargando respuestas de pre-cita...</div>
                          ) : precita === null ? (
                            <div style={{fontSize:12.5, color:'#D93A3A'}}>No se pudo cargar la respuesta ligada a esta cita.</div>
                          ) : (
                            <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8}}>
                              {[
                                ['Motivo principal', precita.payload.chief_complaint],
                                ['Síntomas', precita.payload.symptoms],
                                ['Desde', precita.payload.symptom_started_at],
                                ['Intensidad', precita.payload.severity],
                                ['Medicamentos', precita.payload.current_medications],
                                ['Alergias', precita.payload.allergies],
                                ['Antecedentes', precita.payload.relevant_history],
                                ['Notas', precita.payload.additional_notes],
                              ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => (
                                <div key={k} style={{padding:'8px 10px', background:tokens.surfaceAlt, borderRadius:8}}>
                                  <div style={{fontSize:10, color:tokens.textSecondary, fontFamily:'Franklin Gothic', fontWeight:500, textTransform:'uppercase', letterSpacing:0.4, marginBottom:3}}>{k}</div>
                                  <div style={{fontSize:12.5, color:tokens.text, lineHeight:1.45, whiteSpace:'pre-wrap'}}>{String(v)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'story' && p && (
        <PatientStoryView patient={p} labs={labs} history={history} brand={brand} />
      )}

      {viewingDoc && <DocumentViewer doc={viewingDoc} brand={brand} onClose={() => setViewingDoc(null)}/>}
    </>
  );
}
