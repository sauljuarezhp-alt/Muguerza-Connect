import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Doctor, Tweaks } from '../types';
import { Ico } from '../data/icons';
import { getAssignedSecretaries, assignSecretaryByEmail, removeSecretaryAssignment } from '../api/secretary';
import { useTheme } from '../context/ThemeContext';

interface Props {
  doctor: Doctor | null;
  prefs: Tweaks;
  brand: string;
  onClose: () => void;
  onPrefsChange: (p: Partial<Tweaks>) => void;
}

type TabId = 'perfil' | 'apariencia' | 'configuracion' | 'seguridad' | 'cuenta' | 'equipo';

export const BRAND_PRESETS = [
  { label: 'Morado',  color: '#671E75', dark: '#C47DD0' },
  { label: 'Teal',    color: '#10897B', dark: '#1DBDAC' },
  { label: 'Azul',    color: '#274B96', dark: '#6090E0' },
  { label: 'Índigo',  color: '#5B5BD6', dark: '#8F8FF0' },
  { label: 'Rojo',    color: '#D93A3A', dark: '#F06868' },
  { label: 'Ámbar',   color: '#E08900', dark: '#F5AC30' },
  { label: 'Pizarra', color: '#3C3C43', dark: '#A0A0AC' },
  { label: 'Coral',   color: '#C94F3A', dark: '#E07860' },
];

const START_SCREENS = [
  { value: 'dashboard',     label: 'Dashboard' },
  { value: 'patients',      label: 'Pacientes' },
  { value: 'inbox',         label: 'Inbox' },
  { value: 'agenda',        label: 'Agenda' },
  { value: 'aseguradoras',  label: 'Aseguradoras' },
];

const PATIENT_TABS = [
  { value: 'summary', label: 'Resumen' },
  { value: 'labs',    label: 'Estudios' },
  { value: 'insurer', label: 'Aseguradora' },
  { value: 'comms',   label: 'Comunicación' },
  { value: 'history', label: 'Historial' },
];

function Row({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'start', padding: '8px 0', borderBottom: `1px solid ${tokens.borderLight}` }}>
      <span style={{ fontSize: 12, color: tokens.textSecondary, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: tokens.text, fontFamily: 'Franklin Gothic', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 10, marginTop: 20 }}>{children}</div>;
}

function Toggle({ checked, onChange, brand }: { checked: boolean; onChange: (v: boolean) => void; brand: string }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 99, background: checked ? brand : '#D1D1D6', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }}/>
    </div>
  );
}

function PerfilTab({ doctor, brand }: { doctor: Doctor | null; brand: string }) {
  const { tokens } = useTheme();
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20, borderBottom: `1px solid ${tokens.borderLight}` }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: `linear-gradient(135deg,${brand} 0%, #274B96 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 26, marginBottom: 12 }}>
          {doctor?.initials || 'RV'}
        </div>
        <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 18, lineHeight: 1.2, color: tokens.text }}>{doctor?.name || '—'}</div>
        <div style={{ display: 'inline-block', marginTop: 6, background: brand + '18', color: brand, fontSize: 11.5, fontFamily: 'Franklin Gothic', fontWeight: 500, padding: '3px 10px', borderRadius: 99 }}>
          {doctor?.specialty || '—'}
        </div>
      </div>

      <SectionTitle>Datos personales</SectionTitle>
      <Row label="Nombre completo" value={doctor?.name || '—'} />
      <Row label="Correo"          value={email || '—'} />
      <Row label="Especialidad"    value={doctor?.specialty || '—'} />
      <Row label="Ubicación"       value={doctor?.location || '—'} />
      <Row label="Consultorio"     value={doctor?.consultorio || '—'} />
      <Row label="Iniciales"       value={doctor?.initials || '—'} />
    </>
  );
}

function AparienciaTab({ prefs, brand, onPrefsChange }: { prefs: Tweaks; brand: string; onPrefsChange: (p: Partial<Tweaks>) => void }) {
  const { tokens, isDark, toggleDark } = useTheme();

  return (
    <>
      <SectionTitle>Color de acento</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 6 }}>
        {BRAND_PRESETS.map(p => {
          const swatch = isDark ? p.dark : p.color;
          const selected = prefs.brandColor === p.color;
          return (
            <div key={p.color} onClick={() => onPrefsChange({ brandColor: p.color })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: swatch, boxShadow: selected ? `0 0 0 2px ${tokens.surface}, 0 0 0 4px ${swatch}` : '0 1px 3px rgba(0,0,0,0.2)', transition: 'box-shadow 0.15s' }}/>
              <span style={{ fontSize: 10.5, color: tokens.textTertiary }}>{p.label}</span>
            </div>
          );
        })}
      </div>

      <SectionTitle>Modo oscuro</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
        <div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>Modo oscuro</div>
          <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>
            {isDark ? 'Activo — paleta oscura completa' : 'Inactivo — usando tema claro'}
          </div>
        </div>
        <Toggle
          checked={isDark}
          onChange={v => { toggleDark(v); onPrefsChange({ darkModeCritical: v }); }}
          brand={brand}
        />
      </div>
    </>
  );
}

function ConfigTab({ prefs, brand, onPrefsChange }: { prefs: Tweaks; brand: string; onPrefsChange: (p: Partial<Tweaks>) => void }) {
  const { tokens } = useTheme();
  const selectStyle: React.CSSProperties = { border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: tokens.surfaceAlt, color: tokens.text, outline: 'none', width: '100%', cursor: 'pointer' };

  return (
    <>
      <SectionTitle>Pantalla de inicio</SectionTitle>
      <select value={prefs.startScreen || 'dashboard'} onChange={e => onPrefsChange({ startScreen: e.target.value })} style={selectStyle}>
        {START_SCREENS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 6 }}>La pantalla que aparece al abrir la aplicación.</div>

      <SectionTitle>Pestaña por defecto en paciente</SectionTitle>
      <select value={prefs.patientDefaultTab || 'summary'} onChange={e => onPrefsChange({ patientDefaultTab: e.target.value })} style={selectStyle}>
        {PATIENT_TABS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 6 }}>Pestaña activa al abrir el perfil de un paciente.</div>

      <SectionTitle>Alertas</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
        <div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>Mostrar alertas críticas</div>
          <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>Banner rojo en encabezado cuando hay alertas activas</div>
        </div>
        <Toggle checked={!!prefs.showRedAlert} onChange={v => onPrefsChange({ showRedAlert: v })} brand={brand} />
      </div>
    </>
  );
}

function SeguridadTab({ brand }: { brand: string }) {
  const { tokens } = useTheme();
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setMsg('');
    if (pwNew.length < 6) { setMsg('La contraseña debe tener mínimo 6 caracteres.'); return; }
    if (pwNew !== pwConfirm) { setMsg('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setLoading(false);
    if (error) {
      setMsg('Error: ' + error.message);
    } else {
      setSuccess(true);
      setMsg('¡Contraseña actualizada correctamente!');
      setPwNew('');
      setPwConfirm('');
    }
  }

  const inputStyle: React.CSSProperties = { border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box', background: tokens.inputBg, color: tokens.text };

  return (
    <>
      <SectionTitle>Cambiar contraseña</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 5 }}>Nueva contraseña</div>
          <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 5 }}>Confirmar contraseña</div>
          <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Repite la contraseña" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: success ? '#E4F3F1' : '#FDECEC', color: success ? '#10897B' : '#D93A3A', fontSize: 12.5 }}>
            {msg}
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading}
          style={{ background: loading ? '#ccc' : brand, color: '#fff', border: 0, padding: '9px 0', borderRadius: 8, fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13.5, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
          {loading ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </div>
    </>
  );
}

function CuentaTab({ doctor, brand }: { doctor: Doctor | null; brand: string }) {
  const { tokens } = useTheme();
  const services = [
    { name: 'Base de datos', detail: 'Supabase PostgreSQL', active: true },
    { name: 'Almacenamiento', detail: 'Supabase Storage', active: true },
    { name: 'WhatsApp API', detail: 'Canal de pacientes', active: false },
    { name: 'Email SMTP', detail: 'Notificaciones clínicas', active: false },
  ];

  return (
    <>
      <SectionTitle>Cuenta</SectionTitle>
      <Row label="Titular"     value={doctor?.name || '—'} />
      <Row label="Especialidad" value={doctor?.specialty || '—'} />
      <Row label="Hospital"    value={doctor?.location || '—'} />

      <SectionTitle>Servicios conectados</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {services.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
            <div>
              <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>{s.detail}</div>
            </div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: s.active ? '#E4F3F1' : tokens.surfaceAlt, color: s.active ? '#10897B' : tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, border: s.active ? 'none' : `1px solid ${tokens.border}` }}>
              {s.active ? 'Activo' : 'Pendiente'}
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>Información de la app</SectionTitle>
      <Row label="Versión"     value="1.0.0-beta" />
      <Row label="Entorno"     value="Producción" />
      <Row label="Última sync" value={new Date().toLocaleDateString('es-MX', { dateStyle: 'medium' })} />

      <button
        onClick={() => supabase.auth.signOut()}
        style={{ marginTop: 24, width: '100%', background: 'transparent', color: '#D93A3A', border: '1px solid #D93A3A', padding: '8px 0', borderRadius: 8, fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
        Cerrar sesión
      </button>
    </>
  );
}

function EquipoTab({ doctor, brand }: { doctor: Doctor | null; brand: string }) {
  const { tokens } = useTheme();
  const [secretaries, setSecretaries] = useState<any[]>([]);
  const [email, setEmail]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [isError, setIsError]         = useState(false);

  const inputStyle: React.CSSProperties = { border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', flex: 1, background: tokens.inputBg, color: tokens.text };

  useEffect(() => {
    if (!doctor?.id) return;
    getAssignedSecretaries(doctor.id).then(s => { setSecretaries(s); setLoading(false); });
  }, [doctor?.id]);

  async function handleAdd() {
    if (!email.trim() || !doctor?.id) return;
    setSaving(true); setMsg(''); setIsError(false);
    try {
      const sec = await assignSecretaryByEmail(doctor.id, email.trim());
      setSecretaries(s => [...s, sec]);
      setEmail('');
      setMsg(`${sec.name} agregada correctamente.`);
    } catch (e: any) {
      setIsError(true);
      setMsg(e.message || 'Error al agregar.');
    }
    setSaving(false);
  }

  async function handleRemove(secretaryId: string) {
    if (!doctor?.id) return;
    await removeSecretaryAssignment(doctor.id, secretaryId);
    setSecretaries(s => s.filter(x => x.id !== secretaryId));
  }

  return (
    <>
      <SectionTitle>Secretarias / Enfermeras asignadas</SectionTitle>

      {loading ? (
        <div style={{ fontSize: 13, color: tokens.textSecondary }}>Cargando…</div>
      ) : secretaries.length === 0 ? (
        <div style={{ fontSize: 13, color: tokens.textSecondary, padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 8 }}>
          Aún no tienes personal asignado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
          {secretaries.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 99, background: brand + '22', color: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                {s.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{s.name}</div>
              </div>
              <button
                onClick={() => handleRemove(s.id)}
                style={{ background: 'none', border: '1px solid #D93A3A', color: '#D93A3A', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Franklin Gothic' }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Agregar por correo</SectionTitle>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={inputStyle}
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !email.trim()}
          style={{ background: saving ? '#ccc' : brand, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
        >
          {saving ? '…' : 'Agregar'}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: isError ? '#FDECEC' : '#E4F3F1', color: isError ? '#D93A3A' : '#10897B', fontSize: 12.5 }}>
          {msg}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12, color: tokens.textSecondary, lineHeight: 1.6 }}>
        La persona debe estar registrada previamente en el sistema con ese correo.
      </div>
    </>
  );
}

export function ProfilePanel({ doctor, prefs, brand, onClose, onPrefsChange }: Props) {
  const { tokens } = useTheme();
  const [tab, setTab] = useState<TabId>('perfil');

  const tabs: { id: TabId; label: string; ico: React.ReactNode }[] = [
    { id: 'perfil',         label: 'Mi perfil',     ico: Ico.user },
    { id: 'equipo',         label: 'Equipo',        ico: Ico.users ?? Ico.user },
    { id: 'apariencia',     label: 'Apariencia',    ico: Ico.image },
    { id: 'configuracion',  label: 'Configuración', ico: Ico.settings },
    { id: 'seguridad',      label: 'Seguridad',     ico: Ico.shield },
    { id: 'cuenta',         label: 'Cuenta',        ico: Ico.file },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 620, maxHeight: '88vh', background: tokens.surface, borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${tokens.border}` }}>

        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 16, color: tokens.text }}>Perfil y ajustes</div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: tokens.surfaceAlt, color: tokens.textTertiary }}>
            {Ico.x}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 148, borderRight: `1px solid ${tokens.borderLight}`, padding: '10px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, background: tokens.surface }}>
            {tabs.map(t => (
              <div key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: tab === t.id ? brand + '15' : 'transparent', color: tab === t.id ? brand : tokens.textTertiary, fontFamily: 'Franklin Gothic', fontSize: 13, fontWeight: 500, transition: 'background 0.12s, color 0.12s' }}>
                <span style={{ display: 'inline-flex', width: 15, height: 15, flexShrink: 0 }}>{t.ico}</span>
                {t.label}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '6px 22px 22px', background: tokens.surface }}>
            {tab === 'perfil'        && <PerfilTab        doctor={doctor} brand={brand} />}
            {tab === 'equipo'        && <EquipoTab        doctor={doctor} brand={brand} />}
            {tab === 'apariencia'    && <AparienciaTab    prefs={prefs} brand={brand} onPrefsChange={onPrefsChange} />}
            {tab === 'configuracion' && <ConfigTab        prefs={prefs} brand={brand} onPrefsChange={onPrefsChange} />}
            {tab === 'seguridad'     && <SeguridadTab     brand={brand} />}
            {tab === 'cuenta'        && <CuentaTab        doctor={doctor} brand={brand} />}
          </div>
        </div>
      </div>
    </>
  );
}
