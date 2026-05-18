import { useState, useEffect } from 'react';
import { listInbox } from '../api/inbox';
import type { InboxItem } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props { goPatient: (id: string) => void; brand: string; }

export function DesktopInbox({ goPatient, brand }: Props) {
  const { tokens } = useTheme();
  const [inboxData, setInboxData] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seg, setSeg] = useState('all');

  useEffect(() => {
    async function loadInbox() {
      try {
        const data = await listInbox();
        setInboxData(data);
      } catch (error) {
        console.error('Error cargando inbox:', error);
      } finally {
        setLoading(false);
      }
    }
    loadInbox();
  }, []);

  // Lógica de segmentación sobre los datos reales
  const segs = [
    {id:'all', label:'Todos', n: inboxData.length},
    {id:'paciente', label:'Paciente', n: inboxData.filter(i=>i.src==='paciente').length},
    {id:'enfermería', label:'Enfermería', n: inboxData.filter(i=>i.src==='enfermería').length},
    {id:'aseguradora', label:'Aseguradora', n: inboxData.filter(i=>i.src==='aseguradora').length},
    {id:'resultados', label:'Resultados', n: inboxData.filter(i=>i.src==='resultados').length},
  ];
  
  const list = seg==='all' ? inboxData : inboxData.filter(i => i.src === seg);

  return (
    <>
      <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, margin:'0 0 4px'}}>Inbox</h1>
      
      {loading ? (
        <div style={{ padding: '20px 0', color: '#8E8E93', fontFamily: 'Franklin Gothic', fontSize: 14 }}>
          Cargando mensajes...
        </div>
      ) : (
        <>
          <div style={{fontSize:12.5, color:tokens.textTertiary, opacity:0.9, marginBottom:14}}>
            {inboxData.filter(i=>i.sev!=='green').length} sin leer · {inboxData.filter(i=>i.sev==='red').length} críticos
          </div>
          <div style={{display:'flex', gap:6, marginBottom:12}}>
            {segs.map(s => (
              <div key={s.id} onClick={() => setSeg(s.id)} style={{padding:'6px 12px', borderRadius:999, cursor:'pointer', fontSize:12, fontFamily:'Franklin Gothic', fontWeight:500, background: seg===s.id?brand:tokens.surface, color: seg===s.id?'#fff':tokens.textTertiary, border: seg===s.id?`1px solid ${brand}`:`1px solid ${tokens.border}`}}>
                {s.label} <span style={{opacity:0.7, marginLeft:4}}>{s.n}</span>
              </div>
            ))}
          </div>
          <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
            {list.map((m, i) => (
              <div key={i} onClick={() => m.patientId && goPatient(m.patientId)}
                style={{display:'grid', gridTemplateColumns:'8px 130px 1fr auto', gap:14, padding:'12px 16px', borderBottom: i<list.length-1?`1px solid ${tokens.borderLight}`:'none', alignItems:'start', cursor:'pointer', background:tokens.surface}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
              >
                <span style={{display:'inline-block', width:8, height:8, borderRadius:99, marginTop:6, background: m.sev==='red'?'#D93A3A':m.sev==='amber'?'#E08900':'#10897B'}}/>
                <div>
                  <div style={{fontSize:10.5, color:tokens.textSecondary, textTransform:'uppercase', letterSpacing:0.7, fontFamily:'Franklin Gothic', fontWeight:500}}>{m.src}</div>
                  <div style={{fontSize:11, color:tokens.textSecondary, marginTop:1, fontFamily:'Roboto Mono, monospace'}}>{m.time}</div>
                </div>
                <div>
                  <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color:tokens.text}}>{m.subject}</div>
                  <div style={{fontSize:12, color:tokens.textTertiary, opacity:0.9, marginTop:2}}>{m.preview}</div>
                  {m.patient && <div style={{fontSize:11, color:brand, fontFamily:'Franklin Gothic', fontWeight:500, marginTop:4}}>↳ {m.patient}</div>}
                </div>
                <div style={{color:tokens.textSecondary, fontSize:18}}>›</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}