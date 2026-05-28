import { useState, useEffect } from 'react';
import { Ico } from '../data/icons';
import { useTheme } from '../context/ThemeContext';
import { listPatients, createPendingItem } from '../api';
import type { Patient } from '../types';

interface Props { brand: string; onClose: () => void; initialPatientId?: string; }

export function NewOrderModal({ brand, onClose, initialPatientId }: Props) {
  const { tokens } = useTheme();
  const [type, setType] = useState('lab');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await listPatients();
        setPatients(data);
        const initialPatientExists = initialPatientId && data.some(p => p.id === initialPatientId);
        if (initialPatientExists) {
          setPatientId(initialPatientId);
        } else if (data.length > 0) {
          setPatientId(data[0].id);
        }
      } catch (e) {
        console.error("Error en modal de orden:", e);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, [initialPatientId]);

  const types = [
    {id:'lab', label:'Laboratorio', ico: Ico.flask},
    {id:'imagen', label:'Imagen', ico: Ico.image},
    {id:'receta', label:'Receta', ico: Ico.pill},
    {id:'interconsulta', label:'Interconsulta', ico: Ico.stethoscope},
  ];

  // Función asíncrona que guarda la orden en Supabase
  const handleSendOrder = async () => {
    if (!patientId) return;
    setSending(true);
    
    try {
      // Mapeamos el tipo de orden al icono correspondiente en la DB
      const typeMap: Record<string, string> = {
        lab: 'flask',
        imagen: 'image',
        receta: 'pill',
        interconsulta: 'signature'
      };
      
      const selectedType = types.find(t => t.id === type)?.label || 'Orden';

      await createPendingItem({
        ico: typeMap[type] || 'flask',
        label: `Orden de ${selectedType}`,
        sub: notes.trim() ? notes : 'Pendiente de firma médica',
        badge: '1',
        patient_id: patientId
      });
      
      setSent(true);
    } catch (error) {
      console.error("Error guardando orden en DB:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div onClick={e => e.stopPropagation()} style={{background:tokens.surface, borderRadius:16, padding:'24px 26px', width:460, boxShadow:'0 24px 64px rgba(0,0,0,0.4)', border:`1px solid ${tokens.border}`}}>
        {sent ? (
          <div style={{textAlign:'center', padding:'16px 0 8px'}}>
            <div style={{width:56, height:56, borderRadius:99, background:'#E4F3F1', color:'#10897B', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px'}}>{Ico.check}</div>
            <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:19, marginBottom:6, color:tokens.text}}>Orden enviada</div>
            <div style={{fontSize:13, color:tokens.textSecondary, marginBottom:22}}>La orden ha sido registrada exitosamente en Supabase.</div>
            {/* Recargamos la página al cerrar para refrescar el dashboard */}
            <button onClick={() => { onClose(); window.location.reload(); }} style={{background:brand, color:'#fff', border:0, padding:'9px 28px', borderRadius:8, fontSize:13, fontFamily:'Franklin Gothic', fontWeight:500, cursor:'pointer'}}>Cerrar</button>
          </div>
        ) : loading ? (
          <div style={{padding:20, textAlign:'center', fontFamily:'Franklin Gothic', color:'#8E8E93'}}>Cargando pacientes...</div>
        ) : (
          <>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:19, color:tokens.text}}>Nueva Orden</div>
              <span onClick={onClose} style={{cursor:'pointer', color:tokens.textSecondary, display:'flex'}}>{Ico.x}</span>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Franklin Gothic', fontWeight:500, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8}}>Tipo de orden</div>
              <div style={{display:'flex', gap:8}}>
                {types.map(t => (
                  <div key={t.id} onClick={() => setType(t.id)} style={{flex:1, padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:11.5, fontFamily:'Franklin Gothic', fontWeight:500, background: type===t.id ? brand+'14' : tokens.surfaceAlt, color: type===t.id ? brand : tokens.textTertiary, border:`1.5px solid ${type===t.id ? brand : 'transparent'}`, display:'flex', flexDirection:'column', alignItems:'center', gap:5, transition:'all 0.12s'}}>
                    <span style={{color: type===t.id ? brand : tokens.textSecondary, display:'flex'}}>{t.ico}</span>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Franklin Gothic', fontWeight:500, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8}}>Paciente</div>
              <select value={patientId} onChange={e => setPatientId(e.target.value)} style={{width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${tokens.border}`, fontSize:13, fontFamily:'inherit', background:tokens.surfaceAlt, color:tokens.text, outline:'none', cursor:'pointer'}}>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{marginBottom:22}}>
              <div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Franklin Gothic', fontWeight:500, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8}}>Indicaciones</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Indicaciones para la orden…" rows={3} style={{width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${tokens.border}`, fontSize:13, fontFamily:'inherit', background:tokens.surfaceAlt, color:tokens.text, outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.5}}/>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={onClose} disabled={sending} style={{padding:'9px 18px', borderRadius:8, border:`1px solid ${tokens.border}`, background:tokens.surface, fontSize:13, fontFamily:'Franklin Gothic', fontWeight:500, cursor: sending ? 'not-allowed' : 'pointer', color:tokens.textTertiary}}>Cancelar</button>
              <button onClick={handleSendOrder} disabled={sending} style={{padding:'9px 18px', borderRadius:8, border:0, background: sending ? tokens.border : brand, color:'#fff', fontSize:13, fontFamily:'Franklin Gothic', fontWeight:500, cursor: sending ? 'not-allowed' : 'pointer', display:'inline-flex', alignItems:'center', gap:6}}>
                {sending ? 'Procesando...' : <>{Ico.send} Enviar orden</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
