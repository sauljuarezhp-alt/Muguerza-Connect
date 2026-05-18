import { useState, useEffect } from 'react';
import { listAgendaToday } from '../api/agenda';
import type { AgendaSlot } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props { brand: string; }

export function DesktopAgenda({ brand }: Props) {
  const { tokens } = useTheme();
  const [agenda, setAgenda] = useState<AgendaSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAgenda() {
      try {
        const data = await listAgendaToday();
        setAgenda(data);
      } catch (error) {
        console.error('Error cargando agenda:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAgenda();
  }, []);

  const hours = (() => {
    if (agenda.length === 0) return [];
    const getHour = (tm: string) => parseInt(tm.slice(0, 2), 10);
    const minHour = Math.min(...agenda.map(a => getHour(a.tm)));
    const maxHour = Math.max(...agenda.map(a => getHour(a.tm)));
    return Array.from({ length: maxHour - minHour + 1 }, (_, i) =>
      `${String(minHour + i).padStart(2, '0')}:00`
    );
  })();

  return (
    <>
      <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, margin:'0 0 14px'}}>Agenda · Hoy</h1>
      
      {loading ? (
        <div style={{ padding: '20px', color: '#8E8E93', fontFamily: 'Franklin Gothic', fontSize: 14 }}>
          Cargando agenda...
        </div>
      ) : agenda.length === 0 ? (
        <div style={{ padding: '20px', color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontSize: 14 }}>
          Sin citas para hoy.
        </div>
      ) : (
        <div style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden'}}>
          {hours.map((h, i) => {
            const slot = agenda.find(a => a.tm.startsWith(h.slice(0,2)));
            return (
              <div key={i} style={{display:'grid', gridTemplateColumns:'70px 1fr', minHeight:56, borderBottom: i<hours.length-1?`1px solid ${tokens.borderLight}`:'none'}}>
                <div style={{padding:'10px 14px', fontFamily:'Roboto Mono, monospace', fontSize:12, color:tokens.textSecondary, borderRight:`1px solid ${tokens.borderLight}`}}>{h}</div>
                <div style={{padding:10}}>
                  {slot && (
                    <div style={{background: slot.status==='checked'?'rgba(16,137,123,0.15)':slot.status==='waiting'?'rgba(224,137,0,0.15)':brand+'18', borderLeft:`3px solid ${slot.status==='checked'?'#10897B':slot.status==='waiting'?'#E08900':brand}`, borderRadius:8, padding:'8px 12px'}}>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13, color:tokens.text}}>{slot.name}</div>
                      <div style={{fontSize:11.5, color:tokens.textSecondary, marginTop:1}}>{slot.why} · {slot.tm}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}