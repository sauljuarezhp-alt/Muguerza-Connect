import { useState, useEffect } from 'react';
import { getPrecita, submitPrecita, type PrecitaContext, type PrecitaPayload } from '../api/precita';

const BRAND = '#671E75';

const emptyPayload = (): PrecitaPayload => ({
  version: 1,
  chief_complaint: '',
  symptoms: '',
  symptom_started_at: '',
  severity: '',
  current_medications: '',
  allergies: '',
  relevant_history: '',
  additional_notes: '',
});

const SEVERITY_OPTIONS = [
  { value: '1 - Leve',          label: '1 — Leve' },
  { value: '2 - Moderado',      label: '2 — Moderado' },
  { value: '3 - Intenso',       label: '3 — Intenso' },
  { value: '4 - Muy intenso',   label: '4 — Muy intenso' },
  { value: '5 - Insoportable',  label: '5 — Insoportable' },
];

function formatDate(d: string | null) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(day)} de ${months[parseInt(m) - 1]} de ${y}`;
}

interface Props { token: string; }

export function PrecitaForm({ token }: Props) {
  const [context, setContext] = useState<PrecitaContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PrecitaPayload>(emptyPayload());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    getPrecita(token)
      .then(ctx => { setContext(ctx); setLoading(false); })
      .catch(() => { setContext({ status: 'invalid', doctorName: null, doctorSpecialty: null, appointmentDate: null, appointmentTime: null, patientName: null, appointmentReason: null, submittedAt: null, expiresAt: null }); setLoading(false); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload.chief_complaint.trim()) { setError('El motivo principal es obligatorio.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPrecita(token, payload);
      if (result.success) {
        setDone(true);
      } else if (result.status === 'expired') {
        setError('Este enlace ha expirado. Pide a tu clínica que te envíe uno nuevo.');
      } else if (result.status === 'submitted') {
        setDone(true);
      } else {
        setError('No se pudo enviar el cuestionario. Intenta de nuevo.');
      }
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#F6F5F2',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px 48px',
    fontFamily: "'Franklin Gothic Book','Libre Franklin',-apple-system,system-ui,sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 13px',
    fontSize: 15, fontFamily: 'inherit', outline: 'none',
    background: '#FAFAFA', color: '#1C1C1E', resize: 'vertical' as const,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  };

  // ── Header
  const header = (
    <div style={{ background: BRAND, padding: '20px 22px' }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
        Muguerza Connect
      </div>
      <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 20, color: '#fff', lineHeight: 1.2 }}>
        Cuestionario pre-consulta
      </div>
    </div>
  );

  // ── Loading
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {header}
          <div style={{ padding: '40px 22px', textAlign: 'center', color: '#8E8E93', fontSize: 14 }}>
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid
  if (!context || context.status === 'invalid') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {header}
          <div style={{ padding: '32px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 17, color: '#1C1C1E', marginBottom: 8 }}>
              Enlace no válido
            </div>
            <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5 }}>
              Este enlace no existe o ya fue utilizado. Si crees que es un error, contacta a tu clínica.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Expired
  if (context.status === 'expired') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {header}
          <div style={{ padding: '32px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏰</div>
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 17, color: '#1C1C1E', marginBottom: 8 }}>
              Enlace expirado
            </div>
            <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5 }}>
              Este cuestionario ya no está disponible. Solicita a tu clínica que te envíe un nuevo enlace.
            </div>
            {context.appointmentDate && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#F6F5F2', borderRadius: 10, fontSize: 13, color: '#636366' }}>
                Tu cita: {formatDate(context.appointmentDate)} a las {context.appointmentTime}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Already submitted
  if (context.status === 'submitted' || done) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {header}
          <div style={{ padding: '32px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 17, color: '#1C1C1E', marginBottom: 8 }}>
              Cuestionario enviado
            </div>
            <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5 }}>
              Gracias{context.patientName ? `, ${context.patientName}` : ''}. Tu médico recibirá la información antes de tu consulta.
            </div>
            {context.appointmentDate && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#F6F5F2', borderRadius: 10, fontSize: 13, color: '#636366' }}>
                {context.doctorName && <div style={{ fontWeight: 600, marginBottom: 2 }}>{context.doctorName}</div>}
                {formatDate(context.appointmentDate)} a las {context.appointmentTime}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Open: show form
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {header}

        {/* Context info */}
        <div style={{ padding: '16px 22px', background: '#F9F4FA', borderBottom: '1px solid #F0E8F2' }}>
          {context.patientName && (
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 15, color: '#1C1C1E', marginBottom: 4 }}>
              {context.patientName}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#636366' }}>
            {context.doctorName && <span>{context.doctorName}</span>}
            {context.doctorSpecialty && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {context.doctorSpecialty}</span>}
          </div>
          {context.appointmentDate && (
            <div style={{ fontSize: 13, color: '#636366', marginTop: 2 }}>
              {formatDate(context.appointmentDate)} · {context.appointmentTime}
            </div>
          )}
          {context.appointmentReason && (
            <div style={{ fontSize: 13, color: '#636366', marginTop: 2 }}>
              Motivo: {context.appointmentReason}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
          <div style={{ fontSize: 13, color: '#636366', marginBottom: 20, lineHeight: 1.5 }}>
            Por favor completa este breve cuestionario antes de tu consulta. Tu médico lo revisará para atenderte mejor.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={labelStyle}>Motivo principal de consulta *</label>
              <textarea rows={2} style={inputStyle} value={payload.chief_complaint}
                onChange={e => setPayload(p => ({ ...p, chief_complaint: e.target.value }))}
                placeholder="¿Cuál es la razón principal de tu visita?" />
            </div>

            <div>
              <label style={labelStyle}>Síntomas actuales</label>
              <textarea rows={3} style={inputStyle} value={payload.symptoms}
                onChange={e => setPayload(p => ({ ...p, symptoms: e.target.value }))}
                placeholder="Describe tus síntomas (dolor, inflamación, fiebre, etc.)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>¿Desde cuándo?</label>
                <input type="date" style={inputStyle} value={payload.symptom_started_at}
                  onChange={e => setPayload(p => ({ ...p, symptom_started_at: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Intensidad</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={payload.severity}
                  onChange={e => setPayload(p => ({ ...p, severity: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Medicamentos actuales</label>
              <textarea rows={2} style={inputStyle} value={payload.current_medications}
                onChange={e => setPayload(p => ({ ...p, current_medications: e.target.value }))}
                placeholder="Medicamentos o suplementos que estés tomando" />
            </div>

            <div>
              <label style={labelStyle}>Alergias conocidas</label>
              <input style={inputStyle} value={payload.allergies}
                onChange={e => setPayload(p => ({ ...p, allergies: e.target.value }))}
                placeholder="Alergias a medicamentos, alimentos, etc." />
            </div>

            <div>
              <label style={labelStyle}>Antecedentes relevantes</label>
              <textarea rows={2} style={inputStyle} value={payload.relevant_history}
                onChange={e => setPayload(p => ({ ...p, relevant_history: e.target.value }))}
                placeholder="Cirugías, hospitalizaciones, enfermedades crónicas" />
            </div>

            <div>
              <label style={labelStyle}>Notas adicionales</label>
              <textarea rows={2} style={inputStyle} value={payload.additional_notes}
                onChange={e => setPayload(p => ({ ...p, additional_notes: e.target.value }))}
                placeholder="Cualquier otra información que consideres importante" />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEECEC', borderRadius: 10, fontSize: 13, color: '#D93A3A', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{
              width: '100%', marginTop: 22, padding: '14px',
              background: submitting ? '#B07ABB' : BRAND,
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 16, fontFamily: 'Franklin Gothic', fontWeight: 500,
              cursor: submitting ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}>
            {submitting ? 'Enviando...' : 'Enviar cuestionario'}
          </button>

          <div style={{ marginTop: 14, fontSize: 11.5, color: '#AEAEB2', textAlign: 'center', lineHeight: 1.5 }}>
            Tus respuestas son confidenciales y solo las verá tu médico y el equipo de Muguerza Connect.
          </div>
        </form>
      </div>
    </div>
  );
}
