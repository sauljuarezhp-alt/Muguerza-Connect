import { useState, useEffect } from 'react';
import { listPatients } from '../api/patients';
import type { Patient } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props { brand: string; goPatient: (id: string) => void; }

export function DesktopAseguradoras({ brand, goPatient }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await listPatients();
        setPatients(data);
      } catch (e) {
        console.error("Error cargando aseguradoras:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { tokens } = useTheme();

  if (loading) return <div style={{padding:20, fontFamily:'Franklin Gothic', color:tokens.textSecondary}}>Analizando carteras de aseguradoras...</div>;

  const byInsurer = patients.reduce<Record<string, Patient[]>>((acc, p) => {
    acc[p.insurer] = acc[p.insurer] || [];
    acc[p.insurer].push(p);
    return acc;
  }, {});

  return (
    <>
      <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, margin:'0 0 14px', color:tokens.text}}>Aseguradoras · SGMM</h1>
      <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
        {Object.entries(byInsurer).map(([ins, pts]) => (
          <div key={ins} style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
            <div style={{padding:'12px 16px', borderBottom:`1px solid ${tokens.borderLight}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:15, color:tokens.text}}>{ins}</div>
              <span style={{background:brand+'18', color:brand, padding:'2px 9px', borderRadius:999, fontSize:11, fontFamily:'Franklin Gothic', fontWeight:500}}>{pts.length} paciente{pts.length>1?'s':''}</span>
            </div>
            {pts.map((p, i) => (
              <div key={p.id} onClick={() => goPatient(p.id)}
                style={{padding:'10px 16px', display:'grid', gridTemplateColumns:'10px 1fr auto', gap:12, alignItems:'center', borderBottom: i<pts.length-1?`1px solid ${tokens.borderLight}`:'none', cursor:'pointer', background:tokens.surface}}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=tokens.surfaceAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=tokens.surface}
              >
                <span style={{width:9, height:9, borderRadius:99, background: p.authStatus==='approved'?'#10897B':'#E08900'}}/>
                <div>
                  <div style={{fontSize:13, fontFamily:'Franklin Gothic', fontWeight:500, color:tokens.text}}>{p.name}</div>
                  <div style={{fontSize:11, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace'}}>{p.policy}</div>
                </div>
                <span style={{fontSize:11, padding:'2px 8px', borderRadius:999, background: p.authStatus==='approved'?'rgba(16,137,123,0.15)':'rgba(224,137,0,0.15)', color: p.authStatus==='approved'?'#10897B':'#E08900', fontFamily:'Franklin Gothic', fontWeight:500}}>
                  {p.authStatus==='approved'?'Aprobada':'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}