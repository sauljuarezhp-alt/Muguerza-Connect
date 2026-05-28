import { useEffect, useMemo, useState } from 'react';
import { listInbox, listMessages, listPatients, sendMessage } from '../api';
import type { ChatChannel } from '../api/chats';
import { supabase } from '../lib/supabase';
import { Ico } from '../data/icons';
import type { ChatMessage, InboxItem, Patient } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props { goPatient: (id: string) => void; brand: string; }

type ChannelOption = {
  id: ChatChannel;
  label: string;
  icon: React.ReactNode;
  empty: string;
  placeholder: string;
};

const CHANNELS: ChannelOption[] = [
  {
    id: 'patient',
    label: 'Paciente',
    icon: Ico.whatsapp,
    empty: 'Sin mensajes con el paciente.',
    placeholder: 'Mensaje al paciente...',
  },
  {
    id: 'nurse',
    label: 'Asistente',
    icon: Ico.nurse,
    empty: 'Sin mensajes con asistentes.',
    placeholder: 'Mensaje al equipo...',
  },
];

export function DesktopInbox({ goPatient, brand }: Props) {
  const { tokens } = useTheme();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inboxData, setInboxData] = useState<InboxItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [channel, setChannel] = useState<ChatChannel>('patient');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    async function loadInboxShell() {
      setLoading(true);
      try {
        const [patientRows, inboxRows] = await Promise.all([listPatients(), listInbox()]);
        setPatients(patientRows);
        setInboxData(inboxRows);
        setSelectedPatientId(current => current || patientRows[0]?.id || '');
      } catch (error) {
        console.error('Error cargando inbox:', error);
      } finally {
        setLoading(false);
      }
    }
    loadInboxShell();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setMessages([]);
      return;
    }

    async function loadConversation() {
      setLoadingMessages(true);
      try {
        setMessages(await listMessages(selectedPatientId, channel));
      } catch (error) {
        console.error('Error cargando conversacion:', error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadConversation();
  }, [selectedPatientId, channel]);

  useEffect(() => {
    if (!selectedPatientId) return;

    const reloadConversation = () => listMessages(selectedPatientId, channel).then(setMessages).catch(console.error);
    const reloadInbox = () => listInbox().then(setInboxData).catch(console.error);

    const subscription = supabase
      .channel(`inbox-crm-${selectedPatientId}-${channel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `patient_id=eq.${selectedPatientId}` }, reloadConversation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_items', filter: `patient_id=eq.${selectedPatientId}` }, reloadInbox)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [selectedPatientId, channel]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;
  const selectedChannel = CHANNELS.find(c => c.id === channel) || CHANNELS[0];

  const inboxByPatient = useMemo(() => {
    return inboxData.reduce<Record<string, InboxItem[]>>((acc, item) => {
      if (!item.patientId) return acc;
      acc[item.patientId] = [...(acc[item.patientId] || []), item];
      return acc;
    }, {});
  }, [inboxData]);

  const filteredPatients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.dx.toLowerCase().includes(term) ||
      p.expediente.toLowerCase().includes(term) ||
      p.insurer.toLowerCase().includes(term)
    );
  }, [patients, query]);

  const patientInboxItems = selectedPatientId ? inboxByPatient[selectedPatientId] || [] : [];
  const unreadCount = inboxData.filter(i => i.sev !== 'green').length;
  const criticalCount = inboxData.filter(i => i.sev === 'red').length;

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedPatientId) return;

    const now = new Date();
    const tm = `hoy ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const optimistic: ChatMessage = { t: 'out', tm, body: text };

    setMessages(current => [...current, optimistic]);
    setDraft('');

    try {
      await sendMessage(selectedPatientId, channel, text, tm);
    } catch (error) {
      console.error('Error guardando mensaje:', error);
    }
  }

  return (
    <>
      <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:14}}>
        <div>
          <h1 style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:24, margin:'0 0 4px'}}>Inbox CRM</h1>
          <div style={{fontSize:12.5, color:tokens.textTertiary, opacity:0.9}}>
            {unreadCount} sin leer · {criticalCount} criticos · {patients.length} pacientes
          </div>
        </div>
        {selectedPatient && (
          <button
            onClick={() => goPatient(selectedPatient.id)}
            style={{background:tokens.surface, color:brand, border:`1px solid ${brand}55`, padding:'8px 12px', borderRadius:8, fontFamily:'Franklin Gothic', fontWeight:500, fontSize:12.5, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}
          >
            {Ico.user} Abrir expediente
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '20px 0', color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontSize: 14 }}>
          Cargando conversaciones...
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'320px minmax(0, 1fr)', gap:14, minHeight:620}}>
          <aside style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column'}}>
            <div style={{padding:12, borderBottom:`1px solid ${tokens.borderLight}`}}>
              <div style={{display:'flex', alignItems:'center', gap:8, background:tokens.surfaceAlt, border:`1px solid ${tokens.border}`, borderRadius:8, padding:'7px 10px'}}>
                <span style={{color:tokens.textSecondary, display:'flex'}}>{Ico.search}</span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar paciente..."
                  style={{border:0, outline:0, background:'transparent', flex:1, minWidth:0, fontSize:12.5, fontFamily:'inherit', color:tokens.text}}
                />
              </div>
            </div>

            <div style={{overflowY:'auto', flex:1}}>
              {filteredPatients.length === 0 ? (
                <div style={{padding:18, textAlign:'center', color:tokens.textSecondary, fontSize:12.5}}>Sin pacientes encontrados.</div>
              ) : filteredPatients.map((p, i) => {
                const items = inboxByPatient[p.id] || [];
                const hasCritical = items.some(item => item.sev === 'red');
                const hasUnread = items.some(item => item.sev !== 'green');
                const active = p.id === selectedPatientId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    style={{display:'grid', gridTemplateColumns:'10px 1fr auto', gap:10, padding:'11px 12px', borderBottom:i<filteredPatients.length-1?`1px solid ${tokens.borderLight}`:'none', cursor:'pointer', background:active?brand+'12':tokens.surface, alignItems:'center'}}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surface; }}
                  >
                    <span style={{width:8, height:8, borderRadius:99, background:hasCritical?'#D93A3A':hasUnread?'#E08900':'#10897B', display:'block'}}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:13.5, color:active?brand:tokens.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.name}</div>
                      <div style={{fontSize:11, color:tokens.textSecondary, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.dx} · {p.expediente}</div>
                    </div>
                    {items.length > 0 && (
                      <span style={{fontSize:10.5, minWidth:20, padding:'2px 6px', borderRadius:999, background:hasCritical?'#D93A3A':brand, color:'#fff', textAlign:'center', fontFamily:'Franklin Gothic', fontWeight:500}}>
                        {items.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <section style={{background:tokens.surface, border:`1px solid ${tokens.border}`, borderRadius:12, overflow:'hidden', display:'grid', gridTemplateRows:'auto auto minmax(0, 1fr) auto'}}>
            {selectedPatient ? (
              <>
                <div style={{padding:'14px 16px', borderBottom:`1px solid ${tokens.borderLight}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:14}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:'Franklin Gothic', fontWeight:500, fontSize:18, color:tokens.text}}>{selectedPatient.name}</div>
                    <div style={{fontSize:12, color:tokens.textSecondary, marginTop:2}}>
                      {selectedPatient.dx} · {selectedPatient.insurer} · {selectedPatient.expediente}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:6}}>
                    {CHANNELS.map(option => (
                      <button
                        key={option.id}
                        onClick={() => setChannel(option.id)}
                        style={{border:`1px solid ${channel===option.id?brand:tokens.border}`, background:channel===option.id?brand:tokens.surfaceAlt, color:channel===option.id?'#fff':tokens.textSecondary, padding:'7px 11px', borderRadius:8, fontSize:12.5, fontFamily:'Franklin Gothic', fontWeight:500, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}
                      >
                        {option.icon} {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{borderBottom:`1px solid ${tokens.borderLight}`, background:tokens.surfaceAlt}}>
                  {patientInboxItems.length === 0 ? (
                    <div style={{padding:'10px 16px', fontSize:12.5, color:tokens.textSecondary}}>Sin pendientes recientes para este paciente.</div>
                  ) : patientInboxItems.slice(0, 3).map((item, i, arr) => (
                    <div key={`${item.subject}-${i}`} style={{display:'grid', gridTemplateColumns:'8px 110px 1fr auto', gap:12, padding:'9px 16px', borderBottom:i<arr.length-1?`1px solid ${tokens.borderLight}`:'none', alignItems:'center'}}>
                      <span style={{width:8, height:8, borderRadius:99, background:item.sev==='red'?'#D93A3A':item.sev==='amber'?'#E08900':'#10897B'}}/>
                      <div style={{fontSize:10.5, color:tokens.textSecondary, textTransform:'uppercase', fontFamily:'Franklin Gothic', fontWeight:500}}>{item.src}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12.5, color:tokens.text, fontFamily:'Franklin Gothic', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.subject}</div>
                        <div style={{fontSize:11.5, color:tokens.textSecondary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.preview}</div>
                      </div>
                      <div style={{fontSize:10.5, color:tokens.textSecondary, fontFamily:'Roboto Mono, monospace'}}>{item.time}</div>
                    </div>
                  ))}
                </div>

                <div style={{overflowY:'auto', padding:16, background:tokens.surfaceAlt, display:'flex', flexDirection:'column', gap:8}}>
                  {loadingMessages ? (
                    <div style={{textAlign:'center', color:tokens.textSecondary, fontSize:12.5, marginTop:24}}>Cargando conversacion...</div>
                  ) : messages.length === 0 ? (
                    <div style={{textAlign:'center', color:tokens.textSecondary, fontSize:12.5, marginTop:24}}>{selectedChannel.empty}</div>
                  ) : messages.map((message, i) => (
                    <div key={`${message.tm}-${i}`} style={{alignSelf:message.t==='out'?'flex-end':'flex-start', maxWidth:'72%'}}>
                      <div style={{padding:'9px 12px', borderRadius:12, background:message.t==='out'?brand:tokens.surface, color:message.t==='out'?'#fff':tokens.text, fontSize:12.8, lineHeight:1.45, boxShadow:message.t==='out'?'none':'0 1px 0 rgba(0,0,0,0.04)'}}>
                        {message.body}
                      </div>
                      <div style={{fontSize:10.5, color:tokens.textSecondary, marginTop:3, textAlign:message.t==='out'?'right':'left', padding:'0 4px'}}>{message.tm}</div>
                    </div>
                  ))}
                </div>

                <div style={{padding:12, background:tokens.surface, borderTop:`1px solid ${tokens.border}`, display:'flex', gap:10, alignItems:'flex-end'}}>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={selectedChannel.placeholder}
                    rows={1}
                    style={{flex:1, resize:'none', border:`1px solid ${tokens.border}`, borderRadius:18, padding:'9px 14px', fontSize:12.8, fontFamily:'inherit', background:tokens.surfaceAlt, color:tokens.text, outline:'none', maxHeight:86, lineHeight:1.45, boxSizing:'border-box'}}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    style={{width:38, height:38, borderRadius:999, border:0, background:draft.trim()?brand:tokens.border, color:'#fff', cursor:draft.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}
                  >
                    {Ico.send}
                  </button>
                </div>
              </>
            ) : (
              <div style={{padding:32, textAlign:'center', color:tokens.textSecondary, fontSize:13}}>No hay pacientes disponibles para abrir conversaciones.</div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
