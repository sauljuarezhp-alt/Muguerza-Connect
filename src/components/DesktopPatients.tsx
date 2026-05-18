import { useState, useEffect } from 'react';
import { listPatients } from '../api/patients';
import type { Patient } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props { 
  goPatient: (id: string) => void; 
  brand: string; 
}

export function DesktopPatients({ goPatient }: Props) {
  const { tokens } = useTheme();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Ejecuta la consulta a Supabase mediante tu capa de API
        const data = await listPatients();
        setPatients(data); 
      } catch (error) {
        console.error('Error al conectar con Supabase:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  return (
    <>
      <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, margin:'0 0 14px'}}>Pacientes</h1>
      
      {loading ? (
        <div style={{ padding: '20px', color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontSize: 14 }}>
          Conectando con base de datos Muguerza...
        </div>
      ) : (
        <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
          <div style={{display:'grid', gridTemplateColumns:'14px 2fr 1.2fr 1.2fr 0.8fr 0.8fr 30px', gap:12, padding:'10px 16px', borderBottom:`1px solid ${tokens.borderLight}`, background:tokens.surfaceAlt, fontSize:10.5, color:tokens.textSecondary, textTransform:'uppercase', letterSpacing:0.7, fontFamily:'Franklin Gothic', fontWeight:500}}>
            <div/><div>Paciente</div><div>Diagnóstico</div><div>Aseguradora</div><div>Estatus</div><div>Próx. cita</div><div/>
          </div>

          {patients.map((p, i) => (
            <div key={p.id} onClick={() => goPatient(p.id)}
              style={{display:'grid', gridTemplateColumns:'14px 2fr 1.2fr 1.2fr 0.8fr 0.8fr 30px', gap:12, padding:'12px 16px', borderBottom: i < patients.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', alignItems:'center', cursor:'pointer', fontSize:13, background:tokens.surface, color:tokens.text}}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
            >
              <span style={{width:10, height:10, borderRadius:99, background: p.status==='red'?'#D93A3A':p.status==='amber'?'#E08900':'#10897B', boxShadow:`0 0 0 3px ${p.status==='red'?'rgba(217,58,58,0.2)':p.status==='amber'?'rgba(224,137,0,0.2)':'rgba(16,137,123,0.2)'}`}}/>
              <div>
                <div style={{fontFamily:'Franklin Gothic', fontWeight:500}}>{p.name}</div>
                <div style={{fontSize:11, color:tokens.textSecondary, marginTop:1}}>{p.age} {p.sex} · {p.expediente}</div>
              </div>
              <div style={{fontSize:12}}>{p.dx}</div>
              <div style={{fontSize:12}}>{p.insurer}<div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace'}}>{p.policy}</div></div>
              <div style={{fontSize:11.5, color: p.status==='red'?'#D93A3A':p.status==='amber'?'#E08900':'#10897B', fontFamily:'Franklin Gothic', fontWeight:500}}>{p.statusLabel}</div>
              <div style={{fontSize:12, fontFamily:'Roboto Mono, monospace'}}>{p.nextVisit}</div>
              <div style={{color:tokens.textSecondary}}>›</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}