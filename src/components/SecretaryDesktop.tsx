import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../context/ThemeContext';
import { Ico } from '../data/icons';
import type { Secretary, DoctorOption, PatientFormData, AgendaSlotFormData } from '../api/secretary';
import {
  getCurrentSecretary,
  getAssignedDoctors,
  listAllPatients,
  createPatient,
  updatePatient,
  listAgendaByDoctor,
  createAgendaSlot,
  deleteAgendaSlot,
  listDocuments,
  uploadPatientDocument,
  deleteDocument,
  listDoctors,
  updateSlotStatus,
  AGENDA_MIN_HOUR,
  AGENDA_MAX_HOUR,
} from '../api/secretary';
import { listPending, resolvePendingItem } from '../api/pending';
import { createLab, listLabsForPatient } from '../api/labs';
import { ANALITOS, calcStatus } from '../data/analitos';
import { CloseConsultationModal } from './CloseConsultationModal';
import { localDateString } from '../lib/dates';
import { generatePrecitaToken, getPrecitaStatusesForSlots, getPrecitaForSlot, type PrecitaRecord } from '../api/precita';

const BRAND = '#671E75';
const BRAND_DARK = '#C47DD0';

function brandFor(tokens: ThemeTokens) {
  return tokens.isDark ? BRAND_DARK : BRAND;
}

function brandSoft(tokens: ThemeTokens, alpha = '1F') {
  return brandFor(tokens) + alpha;
}

// ─── helpers de estilo ───────────────────────────────────────────────────────

function card(tokens: ThemeTokens, extra?: React.CSSProperties): React.CSSProperties {
  return { background: tokens.surface, borderRadius: 14, border: `1px solid ${tokens.border}`, ...extra };
}

function mkInputStyle(tokens: ThemeTokens): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${tokens.border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit',
    outline: 'none', background: tokens.inputBg, color: tokens.text,
  };
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  const [hov, setHov] = useState(false);
  const brand = brandFor(tokens);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? (tokens.isDark ? '#6D4D74' : '#B07ABB') : hov ? (tokens.isDark ? '#D58BE0' : '#520060') : brand,
        color: '#fff', border: 'none', borderRadius: 8,
        padding: '8px 16px', fontSize: 13,
        fontFamily: 'Franklin Gothic, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500,
        transition: 'background 0.15s',
      }}
    >{children}</button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const { tokens } = useTheme();
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? tokens.surfaceAlt : tokens.surface,
        color: tokens.text, border: `1px solid ${tokens.border}`,
        borderRadius: 8, padding: '8px 16px', fontSize: 13,
        fontFamily: 'Franklin Gothic, sans-serif',
        cursor: 'pointer', fontWeight: 500,
        transition: 'background 0.15s',
      }}
    >{children}</button>
  );
}

function mkLabel(tokens: ThemeTokens) {
  return function label(text: string) {
    return (
      <div style={{ fontSize: 12, color: tokens.textTertiary, fontFamily: 'Franklin Gothic', fontWeight: 500, marginBottom: 5 }}>
        {text}
      </div>
    );
  };
}

function NavItem({ label, ico, active, onClick }: { label: string; ico: React.ReactNode; active: boolean; onClick: () => void }) {
  const { tokens } = useTheme();
  const [hov, setHov] = useState(false);
  const brand = brandFor(tokens);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        margin: '2px 10px', padding: '9px 12px', borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        background: active ? brandSoft(tokens, tokens.isDark ? '24' : '15') : hov ? brandSoft(tokens, tokens.isDark ? '18' : '0D') : 'transparent',
        color: active || hov ? brand : tokens.textTertiary,
        fontFamily: active ? 'Franklin Gothic' : 'Franklin Gothic Book',
        fontWeight: 500, fontSize: 13.5,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span style={{ display: 'inline-flex', width: 18, height: 18 }}>{ico}</span>
      {label}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function SecretaryDesktop() {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const [secretary, setSecretary]       = useState<Secretary | null>(null);
  const [doctors, setDoctors]           = useState<DoctorOption[]>([]);
  const [activeDoctorId, setActiveDoctorId] = useState<string>('');
  const [tab, setTab] = useState<'pacientes' | 'agenda' | 'documentos' | 'pendientes'>('pacientes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSecretary().then(async s => {
      setSecretary(s);
      if (s) {
        const docs = await getAssignedDoctors(s.id);
        setDoctors(docs);
        if (docs.length) setActiveDoctorId(docs[0].id);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.bg, fontSize: 14, color: tokens.textSecondary, fontFamily: 'Franklin Gothic' }}>
        Cargando portal de secretaria…
      </div>
    );
  }

  const TABS: { key: typeof tab; label: string; ico: React.ReactNode }[] = [
    { key: 'pacientes',  label: 'Pacientes',  ico: Ico.users },
    { key: 'agenda',     label: 'Agenda',     ico: Ico.clock },
    { key: 'documentos', label: 'Documentos', ico: Ico.file  },
    { key: 'pendientes', label: 'Pendientes', ico: Ico.check },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: tokens.bg, fontFamily: "'Franklin Gothic Book','Libre Franklin',-apple-system,system-ui,sans-serif", color: tokens.text }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: tokens.surface, borderRight: `1px solid ${tokens.border}`, display: 'flex', flexDirection: 'column', padding: '16px 0', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px 14px', borderBottom: `1px solid ${tokens.borderLight}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: tokens.surface, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 1px ${tokens.border}` }}>
            <img src="/reach2030-logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 15, lineHeight: 1, color: tokens.text }}>
              Muguerza <span style={{ color: brand }}>Connect</span>
            </div>
            <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' }}>Secretaria</div>
          </div>
        </div>

        {/* Selector de doctor */}
        {doctors.length > 0 && (
          <div style={{ padding: '10px 18px 6px', borderBottom: `1px solid ${tokens.borderLight}` }}>
            <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>Doctor activo</div>
            <select
              value={activeDoctorId}
              onChange={e => setActiveDoctorId(e.target.value)}
              style={{ width: '100%', border: `1px solid ${tokens.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 12.5, fontFamily: 'Franklin Gothic, sans-serif', background: tokens.inputBg, color: tokens.text, outline: 'none', cursor: 'pointer' }}
            >
              {doctors.map(d => <option key={d.id} value={d.id} style={{ background: tokens.surface, color: tokens.text }}>{d.name}</option>)}
            </select>
          </div>
        )}
        {doctors.length === 0 && (
          <div style={{ padding: '10px 18px', fontSize: 11.5, color: '#E08900', lineHeight: 1.5, borderBottom: `1px solid ${tokens.borderLight}` }}>
            Sin doctores asignados. Pide al doctor que te agregue desde Perfil → Equipo.
          </div>
        )}

        {/* Nav */}
        <div style={{ padding: '8px 0' }}>
          {TABS.map(t => (
            <NavItem
              key={t.key}
              label={t.label}
              ico={t.ico}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Perfil / cerrar sesión */}
        <div
          style={{ padding: '12px 16px', borderTop: `1px solid ${tokens.borderLight}` }}
          onMouseEnter={e => (e.currentTarget.style.background = brandSoft(tokens, tokens.isDark ? '18' : '0D'))}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg,${brand} 0%, #6090E0 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, flexShrink: 0 }}>
              {secretary?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 12.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: tokens.text }}>{secretary?.name || 'Secretaria'}</div>
              <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2 }}>Portal de secretaria</div>
            </div>
            <span
              onClick={() => supabase.auth.signOut()}
              title="Cerrar sesión"
              style={{ color: tokens.textSecondary, cursor: 'pointer', display: 'flex' }}
            >{Ico.x}</span>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'pacientes'  && <PacientesPanel  doctorId={activeDoctorId} />}
        {tab === 'agenda'     && <AgendaPanel     doctorId={activeDoctorId} />}
        {tab === 'documentos' && <DocumentosPanel doctorId={activeDoctorId} />}
        {tab === 'pendientes' && <PendientesPanel />}
      </div>
    </div>
  );
}

// ─── Panel: Pacientes ────────────────────────────────────────────────────────

function PacientesPanel({ doctorId }: { doctorId: string }) {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const inputStyle = mkInputStyle(tokens);
  const label = mkLabel(tokens);
  const [patients, setPatients]     = useState<any[]>([]);
  const [doctors, setDoctors]       = useState<DoctorOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editPatient, setEditPatient] = useState<any | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const empty: PatientFormData = {
    name: '', age: 0, sex: 'F', expediente: '', dx: '', insurer: '', policy: '', doctor_id: '',
    status: 'green', status_label: 'Estable', meds: [], allergies: [], next_visit: '',
    deducible: '', coaseguro: '', vigencia_poliza: '', auth_note: '',
  };
  const [form, setForm] = useState<PatientFormData>(empty);

  useEffect(() => {
    setLoading(true);
    Promise.all([listAllPatients(doctorId || undefined), listDoctors()]).then(([pts, docs]) => {
      setPatients(pts); setDoctors(docs); setLoading(false);
    });
  }, [doctorId]);

  function openNew() {
    setForm({ ...empty, doctor_id: doctors[0]?.id || '' });
    setEditPatient(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(p: any) {
    setForm({
      name: p.name, age: p.age, sex: p.sex, expediente: p.expediente,
      dx: p.dx, insurer: p.insurer, policy: p.policy,
      doctor_id: p.doctor_id, status: p.status, status_label: p.status_label,
      next_visit: p.next_visit || '',
      deducible: p.deducible || '', coaseguro: p.coaseguro || '',
      vigencia_poliza: p.vigencia_poliza || '', auth_note: p.auth_note || '',
    });
    setEditPatient(p);
    setShowForm(true);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim() || !form.doctor_id) { setError('Nombre y doctor son obligatorios.'); return; }
    setSaving(true);
    try {
      if (editPatient) {
        await updatePatient(editPatient.id, form);
      } else {
        await createPatient(form);
      }
      const pts = await listAllPatients(doctorId || undefined);
      setPatients(pts);
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || 'Error al guardar.');
    }
    setSaving(false);
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.expediente?.toLowerCase().includes(search.toLowerCase())
  );

  const SEV_COLOR: Record<string, string> = { red: '#D93A3A', amber: '#FF9500', green: '#34C759' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${tokens.border}`, background: tokens.surface }}>
        <div style={{ fontWeight: 600, fontSize: 17, flex: 1, color: tokens.text }}>Pacientes</div>
        <input
          placeholder="Buscar por nombre o expediente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 260, padding: '7px 12px' }}
        />
        <PrimaryBtn onClick={openNew}>+ Nuevo paciente</PrimaryBtn>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Cargando pacientes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Sin pacientes registrados</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, color: tokens.text }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${tokens.border}`, color: tokens.textSecondary, fontSize: 12 }}>
                {['Nombre', 'Expediente', 'Edad', 'Dx', 'Aseguradora', 'Doctor', 'Estado', 'Próx. cita', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontFamily: 'Franklin Gothic' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const doc = doctors.find(d => d.id === p.doctor_id);
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${tokens.border}`, background: i % 2 === 0 ? tokens.surface : tokens.surfaceAlt }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>{p.expediente}</td>
                    <td style={{ padding: '10px 12px' }}>{p.age}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.dx}</td>
                    <td style={{ padding: '10px 12px' }}>{p.insurer}</td>
                    <td style={{ padding: '10px 12px', color: brand, fontSize: 12.5, fontWeight: 500 }}>{doc?.name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: SEV_COLOR[p.status] || tokens.textSecondary, marginRight: 6 }} />
                      {p.status_label}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.next_visit
                        ? <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>{p.next_visit}</span>
                        : <span style={{ fontSize: 12, color: '#FF9500', fontStyle: 'italic' }}>Sin cita agendada</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <SecondaryBtn onClick={() => openEdit(p)}>Editar</SecondaryBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <Modal title={editPatient ? 'Editar paciente' : 'Nuevo paciente'} onClose={() => setShowForm(false)}>
          <FormGrid>
            <FormField label="Nombre completo *">
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Expediente">
              <input style={inputStyle} value={form.expediente} onChange={e => setForm(f => ({ ...f, expediente: e.target.value }))} />
            </FormField>
            <FormField label="Edad">
              <input style={inputStyle} type="number" min={0} max={130} value={form.age || ''} onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) || 0 }))} />
            </FormField>
            <FormField label="Sexo">
              <select style={inputStyle} value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value as 'F' | 'M' }))}>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </FormField>
            <FormField label="Diagnóstico">
              <input style={inputStyle} value={form.dx} onChange={e => setForm(f => ({ ...f, dx: e.target.value }))} />
            </FormField>
            <FormField label="Aseguradora">
              <input style={inputStyle} value={form.insurer} onChange={e => setForm(f => ({ ...f, insurer: e.target.value }))} />
            </FormField>
            <FormField label="Póliza">
              <input style={inputStyle} value={form.policy} onChange={e => setForm(f => ({ ...f, policy: e.target.value }))} />
            </FormField>
            <FormField label="Doctor asignado *">
              <select style={inputStyle} value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {doctors.map(d => <option key={d.id} value={d.id} style={{ background: tokens.surface, color: tokens.text }}>{d.name} · {d.specialty}</option>)}
              </select>
            </FormField>
            <FormField label="Estado clínico">
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="green">Estable</option>
                <option value="amber">En observación</option>
                <option value="red">Crítico</option>
              </select>
            </FormField>
            <FormField label="Etiqueta de estado">
              <input style={inputStyle} value={form.status_label} onChange={e => setForm(f => ({ ...f, status_label: e.target.value }))} placeholder="Ej. Postoperatorio" />
            </FormField>
            <FormField label="Próxima cita">
              <input style={inputStyle} type="date" value={form.next_visit || ''} onChange={e => setForm(f => ({ ...f, next_visit: e.target.value }))} />
            </FormField>
            <FormField label="Deducible">
              <input style={inputStyle} placeholder="Ej. $45,000 MXN · cubierto" value={form.deducible || ''} onChange={e => setForm(f => ({ ...f, deducible: e.target.value }))} />
            </FormField>
            <FormField label="Coaseguro">
              <input style={inputStyle} placeholder="Ej. 10% · tope $150,000" value={form.coaseguro || ''} onChange={e => setForm(f => ({ ...f, coaseguro: e.target.value }))} />
            </FormField>
            <FormField label="Vigencia póliza">
              <input style={inputStyle} placeholder="Ej. 31 Dic 2026" value={form.vigencia_poliza || ''} onChange={e => setForm(f => ({ ...f, vigencia_poliza: e.target.value }))} />
            </FormField>
            <FormField label="Nota de autorización">
              <input style={inputStyle} placeholder="Ej. Aseguradora solicita reporte…" value={form.auth_note || ''} onChange={e => setForm(f => ({ ...f, auth_note: e.target.value }))} />
            </FormField>
          </FormGrid>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <ModalFooter>
            <SecondaryBtn onClick={() => setShowForm(false)}>Cancelar</SecondaryBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</PrimaryBtn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ─── Panel: Agenda ───────────────────────────────────────────────────────────

function AgendaPanel({ doctorId: initialDoctorId }: { doctorId: string }) {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const inputStyle = mkInputStyle(tokens);
  const [doctors, setDoctors]           = useState<DoctorOption[]>([]);
  const [patients, setPatients]         = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorId, setDoctorId]         = useState(initialDoctorId);
  const [day, setDay]                   = useState(() => localDateString());
  const [slots, setSlots]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [toast, setToast]               = useState('');
  const [cancelTarget, setCancelTarget]   = useState<any | null>(null);
  const [closingSlot, setClosingSlot]     = useState<any | null>(null);
  const [precitaStatuses, setPrecitaStatuses] = useState<Record<string, 'submitted' | 'expired' | 'open'>>({});
  const [sendingPrecita, setSendingPrecita]   = useState<string | null>(null);
  const [viewingPrecitaSlot, setViewingPrecitaSlot] = useState<string | null>(null);
  const [viewingPrecitaData, setViewingPrecitaData] = useState<Record<string, PrecitaRecord | null>>({});

  const emptySlot: AgendaSlotFormData = { tm: '09:00', day, name: '', why: '', status: 'upcoming', doctor_id: doctorId, patient_id: '' };
  const [form, setForm] = useState<AgendaSlotFormData>(emptySlot);

  useEffect(() => {
    listDoctors().then(d => { setDoctors(d); });
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    listAllPatients(doctorId).then(setPatients);
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    listAgendaByDoctor(doctorId, day).then(s => { setSlots(s); setLoading(false); });
  }, [doctorId, day]);

  useEffect(() => {
    const ids = slots.filter(s => s.patient_id).map(s => s.id);
    if (!ids.length) { setPrecitaStatuses({}); return; }
    getPrecitaStatusesForSlots(ids).then(setPrecitaStatuses).catch(() => {});
  }, [slots]);

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre del paciente es obligatorio.'); return; }
    const hour = parseInt(form.tm.split(':')[0], 10);
    if (hour < AGENDA_MIN_HOUR || hour >= AGENDA_MAX_HOUR) {
      setError(`El horario debe estar entre ${AGENDA_MIN_HOUR}:00 y ${AGENDA_MAX_HOUR}:00.`);
      return;
    }
    // Verificar overlap: no permitir dos citas a la misma hora el mismo día
    const conflict = slots.find(s => s.tm === form.tm && s.status !== 'cancelled');
    if (conflict) {
      setError(`Ya hay una cita a las ${form.tm} con ${conflict.name}. Elige otro horario.`);
      return;
    }
    setSaving(true);
    try {
      await createAgendaSlot({ ...form, day, doctor_id: doctorId });
      // Si la cita es futura y tiene paciente, actualizar next_visit
      const today = localDateString();
      if (form.patient_id && day >= today) {
        await updatePatient(form.patient_id, { next_visit: day });
      }
      setSlots(await listAgendaByDoctor(doctorId, day));
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || 'Error al guardar.');
    }
    setSaving(false);
  }

  // Notificaciones: revisar citas en los próximos 5 minutos cada 60s
  useEffect(() => {
    if (!doctorId) return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const todayStr = localDateString(now);
      if (day !== todayStr) return;
      slots.forEach(s => {
        if (s.status !== 'upcoming' && s.status !== 'waiting') return;
        const [h, m] = s.tm.split(':').map(Number);
        const slotMin = h * 60 + m;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const diff = slotMin - nowMin;
        if (diff >= 0 && diff <= 5) {
          if (Notification.permission === 'granted') {
            new Notification(`Cita ahora: ${s.name}`, { body: s.why || 'Sin motivo especificado', icon: '/reach2030-logo.png' });
          }
          setToast(`🔔 Cita en ${diff <= 0 ? 'este momento' : `${diff} min`}: ${s.name}${s.why ? ` — ${s.why}` : ''}`);
          setTimeout(() => setToast(''), 8000);
        }
      });
    };
    if (Notification.permission === 'default') Notification.requestPermission();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [slots, day, doctorId]);

  function handleMarkChecked(s: any) {
    setClosingSlot(s);
  }

  async function handleSendPrecita(s: any) {
    if (!s.patient_id) return;
    setSendingPrecita(s.id);
    try {
      const { token } = await generatePrecitaToken(s.id);
      const link = `${window.location.origin}/precita/${token}`;
      const doctor = doctors.find(d => d.id === doctorId);
      const doctorName = doctor?.name ?? 'el médico';
      const message = `Hola ${s.name}, le recordamos su cita con ${doctorName} el ${day} a las ${s.tm}.\n\nPara agilizar su atención, le pedimos completar este breve cuestionario antes de llegar:\n${link}`;
      await navigator.clipboard.writeText(message);
      setToast('📋 Mensaje copiado — pégalo en WhatsApp del paciente');
      setTimeout(() => setToast(''), 6000);
      // Refrescar badges
      const ids = slots.filter(sl => sl.patient_id).map(sl => sl.id);
      getPrecitaStatusesForSlots(ids).then(setPrecitaStatuses).catch(() => {});
    } catch (e: any) {
      setToast(`Error al generar pre-cita: ${e.message ?? 'Intenta de nuevo'}`);
      setTimeout(() => setToast(''), 6000);
    } finally {
      setSendingPrecita(null);
    }
  }

  async function handleViewPrecita(slotId: string) {
    if (viewingPrecitaSlot === slotId) { setViewingPrecitaSlot(null); return; }
    setViewingPrecitaSlot(slotId);
    if (viewingPrecitaData[slotId] !== undefined) return;
    try {
      const record = await getPrecitaForSlot(slotId);
      setViewingPrecitaData(prev => ({ ...prev, [slotId]: record }));
    } catch {
      setViewingPrecitaData(prev => ({ ...prev, [slotId]: null }));
    }
  }

  async function handleMarkCancelled(s: any, reason: string) {
    await updateSlotStatus(s.id, 'cancelled', reason);
    setSlots(prev => prev.map(x => x.id === s.id ? { ...x, status: 'cancelled' } : x));
    setCancelTarget(null);
  }

  async function handleDelete(id: string) {
    await deleteAgendaSlot(id);
    setSlots(s => s.filter(x => x.id !== id));
  }

  const STATUS_LABEL: Record<string, string> = { checked: 'Atendido', waiting: 'Esperando', upcoming: 'Próximo', cancelled: 'Cancelado' };
  const STATUS_COLOR: Record<string, string> = { checked: '#34C759', waiting: '#FF9500', upcoming: brand, cancelled: tokens.textSecondary };

  const isPast = (s: any) => {
    const today = localDateString();
    if (day < today) return true;
    if (day === today) {
      const [h, m] = s.tm.split(':').map(Number);
      const slotMin = h * 60 + m;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      return slotMin < nowMin;
    }
    return false;
  };

  const pending = slots.filter(s => s.status !== 'checked' && s.status !== 'cancelled' && isPast(s));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toast de notificación */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: brand, color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 13.5, fontFamily: 'Franklin Gothic', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: 340 }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${tokens.border}`, background: tokens.surface, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 17, flex: 1, color: tokens.text }}>
          Agenda
          {pending.length > 0 && (
            <span style={{ marginLeft: 10, background: '#FF9500', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>
              {pending.length} sin resolver
            </span>
          )}
        </div>
        <select style={{ ...inputStyle, width: 240 }} value={doctorId} onChange={e => setDoctorId(e.target.value)}>
          {doctors.map(d => <option key={d.id} value={d.id} style={{ background: tokens.surface, color: tokens.text }}>{d.name}</option>)}
        </select>
        <input type="date" value={day} onChange={e => setDay(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        <PrimaryBtn onClick={() => { setForm({ ...emptySlot, day, doctor_id: doctorId }); setError(''); setShowForm(true); }}>
          + Agregar cita
        </PrimaryBtn>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Cargando agenda…</div>
        ) : slots.length === 0 ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Sin citas para este día</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map(s => {
              const past = isPast(s);
              const unresolved = past && s.status !== 'checked' && s.status !== 'cancelled';
              const precitaStatus = precitaStatuses[s.id];
              const isViewingPrecita = viewingPrecitaSlot === s.id;
              return (
                <div key={s.id} style={{ ...card(tokens, { borderColor: unresolved ? '#FF9500' : tokens.border, overflow: 'hidden' }) }}>
                  {/* Fila principal del slot */}
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 52, fontFamily: 'Roboto Mono, monospace', fontSize: 13, color: unresolved ? '#FF9500' : brand, fontWeight: 600, flexShrink: 0 }}>{s.tm}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: tokens.text }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>{s.why}</div>
                      {s.cancel_reason && <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2, fontStyle: 'italic' }}>Motivo: {s.cancel_reason}</div>}
                      {precitaStatus && (
                        <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                          background: precitaStatus === 'submitted' ? 'rgba(16,137,123,0.12)' : precitaStatus === 'open' ? 'rgba(103,30,117,0.1)' : tokens.surfaceAlt,
                          color: precitaStatus === 'submitted' ? '#10897B' : precitaStatus === 'open' ? brand : tokens.textSecondary,
                        }}>
                          {precitaStatus === 'submitted' ? '✓ Pre-cita recibida' : precitaStatus === 'open' ? '📋 Pre-cita enviada' : 'Pre-cita vencida'}
                        </div>
                      )}
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: STATUS_COLOR[s.status] + '22', color: STATUS_COLOR[s.status], fontSize: 12, fontWeight: 500 }}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    {/* Botón Ver respuesta — visible cuando pre-cita fue enviada */}
                    {precitaStatus === 'submitted' && (
                      <button
                        onClick={() => handleViewPrecita(s.id)}
                        title="Ver respuestas del cuestionario"
                        style={{ background: isViewingPrecita ? '#10897B' : 'rgba(16,137,123,0.12)', color: isViewingPrecita ? '#fff' : '#10897B', border: `1px solid rgba(16,137,123,0.25)`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Franklin Gothic', fontWeight: 500, flexShrink: 0, transition: 'background 0.15s' }}>
                        {isViewingPrecita ? '▲ Cerrar' : '▼ Ver respuesta'}
                      </button>
                    )}
                    {s.patient_id && (s.status === 'upcoming' || s.status === 'waiting') && (
                      <button
                        onClick={() => handleSendPrecita(s)}
                        disabled={sendingPrecita === s.id}
                        title="Generar y copiar enlace de pre-cita"
                        style={{ background: brand + '14', color: brand, border: `1px solid ${brand}30`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: sendingPrecita === s.id ? 'default' : 'pointer', fontFamily: 'Franklin Gothic', fontWeight: 500, flexShrink: 0 }}>
                        {sendingPrecita === s.id ? '...' : '📋 Pre-cita'}
                      </button>
                    )}
                    {unresolved && (
                      <>
                        <button onClick={() => handleMarkChecked(s)} title="Marcar como atendida"
                          style={{ background: 'rgba(16,137,123,0.15)', color: '#10897B', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Franklin Gothic', fontWeight: 500, flexShrink: 0 }}>
                          ✓ Atendida
                        </button>
                        <button onClick={() => setCancelTarget(s)} title="Marcar como cancelada"
                          style={{ background: 'rgba(217,58,58,0.15)', color: '#D93A3A', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Franklin Gothic', fontWeight: 500, flexShrink: 0 }}>
                          ✗ Cancelar
                        </button>
                      </>
                    )}
                    {s.status === 'upcoming' && !past && (
                      <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.textSecondary, fontSize: 18, lineHeight: 1, padding: '0 4px' }} title="Eliminar">×</button>
                    )}
                  </div>
                  {/* Panel inline de respuestas de pre-cita */}
                  {isViewingPrecita && (() => {
                    const rec = viewingPrecitaData[s.id];
                    const LABELS: Record<string, string> = { chief_complaint: 'Motivo', symptoms: 'Síntomas', symptom_started_at: 'Desde', severity: 'Intensidad', current_medications: 'Medicamentos', allergies: 'Alergias', relevant_history: 'Antecedentes', additional_notes: 'Notas' };
                    const ORDER = ['chief_complaint', 'symptoms', 'symptom_started_at', 'severity', 'current_medications', 'allergies', 'relevant_history', 'additional_notes'];
                    return (
                      <div style={{ borderTop: `1px solid ${tokens.borderLight}`, padding: '12px 16px 14px', background: tokens.surfaceAlt }}>
                        {rec === undefined && <div style={{ fontSize: 12.5, color: tokens.textSecondary }}>Cargando…</div>}
                        {rec === null && <div style={{ fontSize: 12.5, color: tokens.textSecondary }}>No se encontró la pre-cita.</div>}
                        {rec && (
                          <>
                            <div style={{ fontSize: 11, color: tokens.textSecondary, marginBottom: 10, fontFamily: 'Franklin Gothic', fontWeight: 500 }}>
                              Enviado: {new Date(rec.submittedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                              {ORDER.map(key => {
                                const val = (rec.payload as any)[key];
                                if (!val || String(val).trim() === '') return null;
                                return (
                                  <div key={key} style={{ fontSize: 12.5, color: tokens.text }}>
                                    <span style={{ fontSize: 10.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 6 }}>{LABELS[key] ?? key}:</span>
                                    {String(val)}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva cita */}
      {showForm && (
        <Modal title="Nueva cita" onClose={() => setShowForm(false)}>
          <FormGrid>
            <FormField label="Horario">
              <select style={inputStyle} value={form.tm} onChange={e => setForm(f => ({ ...f, tm: e.target.value }))}>
                {Array.from({ length: (AGENDA_MAX_HOUR - AGENDA_MIN_HOUR) * 2 }, (_, i) => {
                  const totalMin = AGENDA_MIN_HOUR * 60 + i * 30;
                  const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
                  const m = String(totalMin % 60).padStart(2, '0');
                  const tm = `${h}:${m}`;
                  const taken = slots.some(s => s.tm === tm && s.status !== 'cancelled');
                  if (taken) return null;
                  return <option key={tm} value={tm}>{tm}</option>;
                })}
              </select>
            </FormField>
            <FormField label="Nombre del paciente *">
              <PatientCombobox
                patients={patients}
                value={form.name}
                patientId={form.patient_id || ''}
                search={patientSearch}
                onSearchChange={setPatientSearch}
                onSelect={p => {
                  setForm(f => ({ ...f, name: p.name, patient_id: p.id }));
                  setPatientSearch('');
                }}
              />
            </FormField>
            <FormField label="Motivo de consulta">
              <input style={inputStyle} value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))} />
            </FormField>
            <FormField label="Estado">
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AgendaSlotFormData['status'] }))}>
                <option value="upcoming">Próximo</option>
                <option value="waiting">Esperando</option>
              </select>
            </FormField>
          </FormGrid>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <ModalFooter>
            <SecondaryBtn onClick={() => setShowForm(false)}>Cancelar</SecondaryBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</PrimaryBtn>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal cancelar cita */}
      {cancelTarget && (
        <CancelModal
          slot={cancelTarget}
          onConfirm={(reason) => handleMarkCancelled(cancelTarget, reason)}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Modal cerrar consulta con cobro */}
      {closingSlot && (
        <CloseConsultationModal
          slot={closingSlot}
          doctorId={doctorId}
          brand={brand}
          onClose={() => setClosingSlot(null)}
          onDone={() => {
            setSlots(prev => prev.map(x => x.id === closingSlot.id ? { ...x, status: 'checked' } : x));
            setClosingSlot(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Panel: Documentos ───────────────────────────────────────────────────────

function DocumentosPanel({ doctorId }: { doctorId: string }) {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const inputStyle = mkInputStyle(tokens);
  const [patients, setPatients]   = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [docs, setDocs]           = useState<any[]>([]);
  const [labs, setLabs]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [labToast, setLabToast] = useState('');
  const [error, setError]           = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [labForm, setLabForm] = useState({ n: '', val: '', unit: '', range_: '', st: 'ok' as const, dir: 'flat' as const, taken_at: localDateString() });
  const [savingLab, setSavingLab] = useState(false);
  const [labError, setLabError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    listAllPatients(doctorId || undefined).then(p => { setPatients(p); if (p.length) setPatientId(p[0].id); });
  }, [doctorId]);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    Promise.all([listDocuments(patientId), listLabsForPatient(patientId)]).then(([d, l]) => {
      setDocs(d); setLabs(l); setLoading(false);
    });
  }, [patientId]);

  async function handleSaveLab() {
    if (!labForm.n.trim() || !labForm.val || !labForm.unit.trim()) {
      setLabError('Analito, valor y unidad son obligatorios.'); return;
    }
    setSavingLab(true);
    setLabError('');
    try {
      await createLab({
        patient_id: patientId,
        n: labForm.n.trim(),
        val: parseFloat(labForm.val),
        unit: labForm.unit.trim(),
        range_: labForm.range_.trim(),
        st: labForm.st,
        dir: labForm.dir,
        taken_at: labForm.taken_at,
      });
      setLabs(await listLabsForPatient(patientId));
      setLabForm({ n: '', val: '', unit: '', range_: '', st: 'ok', dir: 'flat', taken_at: localDateString() });
      setShowLabForm(false);
    } catch (e: any) {
      setLabError(e.message || 'Error al guardar.');
    }
    setSavingLab(false);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;
    pendingFileRef.current = file;
    setShowTypeModal(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleUploadWithType(docType: string) {
    const file = pendingFileRef.current;
    if (!file || !patientId) return;
    setShowTypeModal(false);
    setUploading(true);
    setError('');
    try {
      if (docType === 'Resultado de lab') setAnalysing(true);
      await uploadPatientDocument(patientId, file, docType, (result) => {
        setAnalysing(false);
        setLabs(prev => prev); // trigger re-fetch
        listLabsForPatient(patientId).then(setLabs);
        const nombres = result.analitos.slice(0, 4).join(', ');
        const extra = result.analitos.length > 4 ? ` y ${result.analitos.length - 4} más` : '';
        setLabToast(`🧬 IA extrajo ${result.inserted} analito${result.inserted !== 1 ? 's' : ''}: ${nombres}${extra}`);
        setTimeout(() => setLabToast(''), 8000);
      });
      setDocs(await listDocuments(patientId));
    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo.');
      setAnalysing(false);
    }
    setUploading(false);
    pendingFileRef.current = null;
  }

  async function handleDelete(id: string) {
    await deleteDocument(id);
    setDocs(d => d.filter(x => x.id !== id));
  }

  const TYPE_ICON: Record<string, React.ReactNode> = {
    'Póliza': Ico.shield,
    'Estudio': Ico.image,
    'Resultado de lab': Ico.flask,
    'Receta': Ico.pill,
    'Consentimiento': Ico.signature,
    'Otro': Ico.file,
  };

  const DOCUMENT_TYPE_OPTIONS = [
    { type: 'Póliza', icon: Ico.shield, desc: 'Documento de aseguradora', color: '#E08900', rgba: 'rgba(224,137,0,0.12)' },
    { type: 'Estudio', icon: Ico.image, desc: 'Imagen médica o estudio', color: '#274B96', rgba: 'rgba(39,75,150,0.12)' },
    { type: 'Resultado de lab', icon: Ico.flask, desc: 'Resultados de laboratorio', color: '#10897B', rgba: 'rgba(16,137,123,0.12)' },
    { type: 'Receta', icon: Ico.pill, desc: 'Prescripción médica', color: brand, rgba: brandSoft(tokens) },
    { type: 'Consentimiento', icon: Ico.signature, desc: 'Firma de consentimiento', color: tokens.textSecondary, rgba: tokens.surfaceAlt },
    { type: 'Otro', icon: Ico.file, desc: 'Otro tipo de documento', color: tokens.textSecondary, rgba: tokens.surfaceAlt },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${tokens.border}`, background: tokens.surface, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 17, flex: 1, color: tokens.text }}>Documentos</div>
        <select style={{ ...inputStyle, width: 280 }} value={patientId} onChange={e => setPatientId(e.target.value)}>
              {patients.map(p => <option key={p.id} value={p.id} style={{ background: tokens.surface, color: tokens.text }}>{p.name}</option>)}
        </select>
        <label
          onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = tokens.isDark ? '#D58BE0' : '#520060'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = uploading ? (tokens.isDark ? '#6D4D74' : '#B07ABB') : brand; }}
          style={{ background: uploading ? (tokens.isDark ? '#6D4D74' : '#B07ABB') : brand, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Franklin Gothic, sans-serif', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 500, transition: 'background 0.15s', display: 'inline-block' }}
        >
          {uploading ? 'Subiendo…' : '⬆ Subir archivo'}
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileSelected} disabled={uploading} />
        </label>
      </div>

      {/* Toast de extracción de labs */}
      {labToast && (
        <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#E4F3F1', border: '1px solid #10897B40', borderRadius: 8, fontSize: 13, color: '#10897B', fontWeight: 500 }}>
          {labToast}
        </div>
      )}

      {/* Indicador de análisis IA */}
      {analysing && (
        <div style={{ margin: '12px 24px', padding: '10px 14px', background: brandSoft(tokens), border: `1px solid ${brand}40`, borderRadius: 8, fontSize: 13, color: brand, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${brand}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          Analizando documento con IA…
        </div>
      )}

      {error && <div style={{ margin: '12px 24px', padding: '9px 12px', background: 'rgba(217,58,58,0.12)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 8, fontSize: 12.5, color: '#D93A3A' }}>{error}</div>}

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Archivos adjuntos */}
        <div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Archivos adjuntos</div>
          {loading ? (
            <div style={{ color: tokens.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>Cargando…</div>
          ) : docs.length === 0 ? (
            <div style={{ color: tokens.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>Sin documentos para este paciente</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map(d => (
                <div key={d.id} style={{ ...card(tokens, { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }) }}>
                  <div style={{ width: 24, height: 24, color: tokens.textSecondary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{TYPE_ICON[d.type] || Ico.file}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: tokens.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>{d.type} · {new Date(d.uploaded_at).toLocaleDateString('es-MX')}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: d.type === 'Póliza' ? 'rgba(224,137,0,0.15)' : 'rgba(16,137,123,0.15)', color: d.type === 'Póliza' ? '#E08900' : '#10897B', fontSize: 12, fontWeight: 500 }}>{d.type}</span>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ background: tokens.surface, color: tokens.text, border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontFamily: 'Franklin Gothic, sans-serif', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>Ver</a>
                  <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D93A3A', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resultados de laboratorio */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>Resultados de laboratorio</div>
            <SecondaryBtn onClick={() => { setShowLabForm(v => !v); setLabError(''); }}>
              {showLabForm ? 'Cancelar' : '+ Agregar resultado'}
            </SecondaryBtn>
          </div>

          {showLabForm && (
            <LabForm
              labForm={labForm}
              setLabForm={setLabForm}
              labError={labError}
              savingLab={savingLab}
              onSave={handleSaveLab}
            />
          )}

          {labs.length === 0 ? (
            <div style={{ color: tokens.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>Sin resultados numéricos registrados</div>
          ) : (
            <div style={{ ...card(tokens, { overflow: 'hidden' }) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 0.8fr', gap: 10, padding: '8px 14px', background: tokens.surfaceAlt, borderBottom: `1px solid ${tokens.border}`, fontSize: 11, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Franklin Gothic' }}>
                <div>Analito</div><div>Valor</div><div>Unidad</div><div>Rango</div><div>Estado</div>
              </div>
              {labs.map((l, i) => {
                const stColor: Record<string, string> = { ok: '#34C759', hi: '#D93A3A', lo: '#FF9500' };
                const stLabel: Record<string, string> = { ok: 'Normal', hi: 'Alto', lo: 'Bajo' };
                return (
                  <div key={l.id || i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 0.8fr', gap: 10, padding: '10px 14px', borderBottom: i < labs.length - 1 ? `1px solid ${tokens.border}` : 'none', alignItems: 'center', fontSize: 13, color: tokens.text }}>
                    <div style={{ fontWeight: 500 }}>{l.n}</div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, color: stColor[l.st] || tokens.text }}>{l.val}</div>
                    <div style={{ color: tokens.textSecondary }}>{l.unit}</div>
                    <div style={{ color: tokens.textSecondary, fontSize: 12 }}>{l.range || '—'}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: stColor[l.st] || tokens.textSecondary }}>{stLabel[l.st] || l.st}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Popup selector de tipo de documento */}
      {showTypeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: tokens.surface, borderRadius: 16, padding: '28px 24px', width: 480, boxShadow: '0 12px 48px rgba(0,0,0,0.4)', border: `1px solid ${tokens.border}` }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: tokens.text }}>¿Qué tipo de documento es?</div>
            <div style={{ fontSize: 13, color: tokens.textSecondary, marginBottom: 20 }}>{pendingFileRef.current?.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {DOCUMENT_TYPE_OPTIONS.map(opt => (
                <div
                  key={opt.type}
                  onClick={() => handleUploadWithType(opt.type)}
                  style={{ padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${tokens.border}`, background: opt.rgba, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = opt.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = tokens.border)}
                >
                  <span style={{ width: 24, height: 24, color: opt.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: opt.color, fontFamily: 'Franklin Gothic' }}>{opt.type}</div>
                    <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <SecondaryBtn onClick={() => { setShowTypeModal(false); pendingFileRef.current = null; }}>Cancelar</SecondaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Pendientes ───────────────────────────────────────────────────────

function PendientesPanel() {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPending()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function markDone(id: string) {
    await resolvePendingItem(id);
    setItems(s => s.filter(x => x.id !== id));
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 12px', borderBottom: `1px solid ${tokens.border}`, background: tokens.surface }}>
        <div style={{ fontWeight: 600, fontSize: 17, color: tokens.text }}>Órdenes y pendientes</div>
        <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 3 }}>Tareas asignadas por el equipo médico</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Cargando pendientes…</div>
        ) : items.length === 0 ? (
          <div style={{ color: tokens.textSecondary, fontSize: 14, marginTop: 40, textAlign: 'center' }}>Sin pendientes ✓</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{ ...card(tokens, { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }) }}>
                <div style={{ fontSize: 22 }}>{item.ico || '📋'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: tokens.text }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>{item.sub}</div>
                </div>
                {item.badge && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: brandSoft(tokens), color: brand, fontSize: 12, fontWeight: 500 }}>
                    {item.badge}
                  </span>
                )}
                <button
                  onClick={() => markDone(item.id)}
                  style={{ background: brand, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontFamily: 'Franklin Gothic, sans-serif', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hecho ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componentes utilitarios ─────────────────────────────────────────────────

// ─── LabForm — formulario inteligente de resultados ──────────────────────────

function LabForm({ labForm, setLabForm, labError, savingLab, onSave }: {
  labForm: any;
  setLabForm: React.Dispatch<React.SetStateAction<any>>;
  labError: string;
  savingLab: boolean;
  onSave: () => void;
}) {
  const { tokens } = useTheme();
  const brand = brandFor(tokens);
  const inputStyle = mkInputStyle(tokens);
  const label = mkLabel(tokens);
  const [analitoSearch, setAnalitoSearch] = useState('');
  const [analitoOpen, setAnalitoOpen] = useState(false);
  const analitoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (analitoRef.current && !analitoRef.current.contains(e.target as Node)) setAnalitoOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = ANALITOS.filter(a =>
    a.name.toLowerCase().includes(analitoSearch.toLowerCase()) ||
    a.abbr.toLowerCase().includes(analitoSearch.toLowerCase())
  );

  function selectAnalito(a: typeof ANALITOS[0]) {
    setLabForm((f: any) => ({
      ...f,
      n: a.name,
      unit: a.unit,
      range_: a.range,
      _analito: a,
      st: f.val ? calcStatus(a, parseFloat(f.val)) : 'normal',
    }));
    setAnalitoSearch('');
    setAnalitoOpen(false);
  }

  function handleValChange(val: string) {
    const analito = labForm._analito;
    const newSt = analito && val ? calcStatus(analito, parseFloat(val)) : labForm.st;
    setLabForm((f: any) => ({ ...f, val, st: newSt }));
  }

  const ST_COLOR: Record<string, string> = { ok: '#34C759', hi: '#D93A3A', lo: '#FF9500' };
  const ST_LABEL: Record<string, string> = { ok: 'Normal', hi: 'Alto', lo: 'Bajo' };

  return (
    <div style={{ ...card(tokens, { padding: '16px', marginBottom: 12 }) }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 10, marginBottom: 10 }}>

        {/* Analito con autocomplete */}
        <div ref={analitoRef} style={{ position: 'relative' }}>
          {label('Analito *')}
          <input
            style={inputStyle}
            placeholder="Buscar analito o abreviatura…"
            value={analitoOpen ? analitoSearch : labForm.n}
            onFocus={() => { setAnalitoOpen(true); setAnalitoSearch(''); }}
            onChange={e => { setAnalitoSearch(e.target.value); setAnalitoOpen(true); }}
          />
          {analitoOpen && filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
              {filtered.map(a => (
                <div
                  key={a.abbr}
                  onMouseDown={() => selectAnalito(a)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', gap: 10, color: tokens.text }}
                  onMouseEnter={e => (e.currentTarget.style.background = tokens.surfaceAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = tokens.surface)}
                >
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11, color: brand, background: brandSoft(tokens), padding: '2px 6px', borderRadius: 4, minWidth: 40, textAlign: 'center' }}>{a.abbr}</span>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  <span style={{ color: tokens.textSecondary, fontSize: 11.5, marginLeft: 'auto' }}>{a.unit} · {a.range}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Valor — calcula estado en tiempo real */}
        <div>
          {label('Valor *')}
          <input
            style={inputStyle}
            type="number"
            placeholder="0"
            value={labForm.val}
            onChange={e => handleValChange(e.target.value)}
          />
        </div>

        {/* Unidad — autollenada */}
        <div>
          {label('Unidad *')}
          <input style={{ ...inputStyle, background: labForm.unit ? tokens.surfaceAlt : tokens.inputBg, color: tokens.textSecondary }} placeholder="mg/dL" value={labForm.unit} onChange={e => setLabForm((f: any) => ({ ...f, unit: e.target.value }))} />
        </div>

        {/* Rango — autollenado */}
        <div>
          {label('Rango normal')}
          <input style={{ ...inputStyle, background: labForm.range_ ? tokens.surfaceAlt : tokens.inputBg, color: tokens.textSecondary }} placeholder="70–99" value={labForm.range_} onChange={e => setLabForm((f: any) => ({ ...f, range_: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>

        {/* Estado — calculado automáticamente */}
        <div>
          {label('Estado')}
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: ST_COLOR[labForm.st] || tokens.textSecondary, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, color: ST_COLOR[labForm.st] || tokens.textSecondary }}>{ST_LABEL[labForm.st] || 'Normal'}</span>
            {!labForm._analito && <span style={{ fontSize: 11, color: tokens.textSecondary, marginLeft: 'auto' }}>selecciona un analito</span>}
          </div>
        </div>

        <div>
          {label('Tendencia')}
          <select style={inputStyle} value={labForm.dir} onChange={e => setLabForm((f: any) => ({ ...f, dir: e.target.value }))}>
            <option value="flat">Estable</option>
            <option value="up">Subiendo ↑</option>
            <option value="down">Bajando ↓</option>
          </select>
        </div>

        <div>
          {label('Fecha de toma')}
          <input style={inputStyle} type="date" value={labForm.taken_at} onChange={e => setLabForm((f: any) => ({ ...f, taken_at: e.target.value }))} />
        </div>
      </div>

      {labError && <div style={{ padding: '7px 10px', background: 'rgba(217,58,58,0.12)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 7, fontSize: 12, color: '#D93A3A', marginBottom: 10 }}>{labError}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryBtn onClick={onSave} disabled={savingLab}>{savingLab ? 'Guardando…' : 'Guardar resultado'}</PrimaryBtn>
      </div>
    </div>
  );
}

function PatientCombobox({
  patients, value, patientId, search, onSearchChange, onSelect,
}: {
  patients: any[];
  value: string;
  patientId: string;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (p: any) => void;
}) {
  const { tokens } = useTheme();
  const inputStyle = mkInputStyle(tokens);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.expediente || '').toLowerCase().includes(search.toLowerCase())
  );

  const displayValue = patientId
    ? (patients.find(p => p.id === patientId)?.name || value)
    : value;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder="Buscar paciente…"
        value={open ? search : displayValue}
        onFocus={() => { setOpen(true); onSearchChange(''); }}
        onChange={e => { onSearchChange(e.target.value); setOpen(true); }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxHeight: 200, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.map(p => (
            <div
              key={p.id}
              onMouseDown={() => { onSelect(p); setOpen(false); }}
              style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13.5, borderBottom: `1px solid ${tokens.borderLight}`, color: tokens.text }}
              onMouseEnter={e => (e.currentTarget.style.background = tokens.surfaceAlt)}
              onMouseLeave={e => (e.currentTarget.style.background = tokens.surface)}
            >
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              {p.expediente && <span style={{ color: tokens.textSecondary, fontSize: 12, marginLeft: 8, fontFamily: 'Roboto Mono, monospace' }}>{p.expediente}</span>}
            </div>
          ))}
        </div>
      )}
      {open && search.length > 0 && filtered.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: '10px 12px', marginTop: 2,
          fontSize: 13, color: tokens.textSecondary,
        }}>
          Sin resultados para "{search}"
        </div>
      )}
    </div>
  );
}

function CancelModal({ slot, onConfirm, onClose }: { slot: any; onConfirm: (reason: string) => void; onClose: () => void }) {
  const { tokens } = useTheme();
  const inputStyle = mkInputStyle(tokens);
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: tokens.surface, borderRadius: 14, padding: '24px', width: 400, boxShadow: '0 12px 48px rgba(0,0,0,0.4)', border: `1px solid ${tokens.border}` }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: tokens.text }}>Cancelar cita</div>
        <div style={{ fontSize: 13, color: tokens.textSecondary, marginBottom: 16 }}>
          {slot.name} — {slot.tm}{slot.why ? ` · ${slot.why}` : ''}
        </div>
        <div style={{ fontSize: 12, color: tokens.textTertiary, fontWeight: 500, marginBottom: 6 }}>Motivo de cancelación (opcional)</div>
        <input
          style={{ ...inputStyle, marginBottom: 20 }}
          placeholder="Ej. Paciente no se presentó"
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm(reason)}
          autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <SecondaryBtn onClick={onClose}>Volver</SecondaryBtn>
          <button
            onClick={() => onConfirm(reason)}
            style={{ background: '#D93A3A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: 'pointer' }}
          >
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...card(tokens, { padding: '24px', width: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }) }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 16, flex: 1, color: tokens.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: tokens.textSecondary, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
      {children}
    </div>
  );
}

function FormField({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  const label = mkLabel(tokens);
  return (
    <div>
      {label(lbl)}
      {children}
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14, padding: '9px 12px', background: 'rgba(217,58,58,0.12)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 8, fontSize: 12.5, color: '#D93A3A' }}>
      {children}
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.border}` }}>
      {children}
    </div>
  );
}
