import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Ico } from '../data/icons';
import { BRAND_PRESETS } from './ProfilePanel';
import {
  getCurrentClinicStaff,
  listTodayAppointments,
  listAllAppointments,
  listPreAuthRequests,
  listServiceResults,
  listActiveEscalations,
  updateAppointmentStatus,
  updatePreAuthStatus,
  listConversations,
  listConversationMessages,
  sendConversationMessage,
  updateConversationStatus,
  markConversationRead,
  listResources,
  listActiveAssignments,
  manualAssignResource,
  freeResource,
  listClinicServices,
  createClinicAppointment,
  getClinicFinancialMetrics,
  getClinicRevenueByPaymentMethod,
  getClinicServiceFinancials,
  listClinicPatients,
  getClinicPatientSummary,
  listClinicPatientAppointments,
  listClinicPatientPreAuthRequests,
  listClinicPatientResults,
  listClinicPatientConversations,
  listClinicPatientTimeline,
} from '../api/clinic';
import type {
  ClinicStaff,
  ServiceAppointment,
  PreAuthRequest,
  ServiceResult,
  ClinicalEscalation,
  AppointmentStatus,
  ClinicConversation,
  ClinicChatMessage,
  ClinicConversationStatus,
  ClinicResource,
  ClinicResourceAssignment,
  ClinicResourceType,
  ClinicService,
  ClinicPaymentStatus,
  ClinicFinancialMonthly,
  ClinicRevenueByPaymentMethod,
  ClinicServiceFinancialMonthly,
  ClinicPatientListItem,
  ClinicPatientSummary,
  ClinicPatientTreatmentStatus,
  ClinicPatientTimelineEvent,
} from '../types';

const BRAND = '#671E75';
const BRAND_DARK = '#C47DD0';

function brandFor(isDark: boolean) { return isDark ? BRAND_DARK : BRAND; }
function brandSoft(isDark: boolean, alpha = '18') { return brandFor(isDark) + alpha; }

// ── Status helpers ──────────────────────────────────────────────────────────

const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  checked_in: 'Check-in',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  escalated: 'Escalada',
  no_show: 'No se presentó',
};

const APPT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#8E8E93',
  checked_in: '#2D6BE4',
  in_progress: '#E08900',
  completed: '#10897B',
  cancelled: '#8E8E93',
  escalated: '#D93A3A',
  no_show: '#8E8E93',
};

const PREAUTH_LABEL: Record<string, string> = {
  not_required: 'No requerida',
  pending: 'Pendiente',
  in_review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
};

const PREAUTH_COLOR: Record<string, string> = {
  not_required: '#8E8E93',
  pending: '#E08900',
  in_review: '#2D6BE4',
  approved: '#10897B',
  rejected: '#D93A3A',
  expired: '#8E8E93',
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  infusion: 'Infusión',
  lab: 'Laboratorio',
  imaging: 'Imagen',
  surgery: 'Cirugía',
  consult: 'Consulta',
};

const TREATMENT_STATUS_LABEL: Record<ClinicPatientTreatmentStatus, string> = {
  no_activity: 'Sin actividad',
  scheduled: 'Programado',
  checked_in: 'Check-in',
  in_progress: 'En progreso',
  completed: 'Completado',
  follow_up_required: 'Seguimiento requerido',
  escalated: 'Escalado',
  cancelled: 'Cancelado',
};

const TREATMENT_STATUS_COLOR: Record<ClinicPatientTreatmentStatus, string> = {
  no_activity: '#8E8E93',
  scheduled: '#2D6BE4',
  checked_in: '#2D6BE4',
  in_progress: '#E08900',
  completed: '#10897B',
  follow_up_required: '#D93A3A',
  escalated: '#D93A3A',
  cancelled: '#8E8E93',
};

const PAYMENT_STATUS_LABEL: Record<ClinicPaymentStatus, string> = {
  pendiente: 'Pendiente',
  preauth_pendiente: 'Pre-auth pend.',
  preauth_aprobada: 'Pre-auth aprobada',
  preauth_rechazada: 'Pre-auth rechazada',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
  cortesia: 'Cortesía',
  reembolsado: 'Reembolsado',
};

const PAYMENT_STATUS_COLOR: Record<ClinicPaymentStatus, string> = {
  pendiente: '#E08900',
  preauth_pendiente: '#2D6BE4',
  preauth_aprobada: '#10897B',
  preauth_rechazada: '#D93A3A',
  pagado: '#10897B',
  cancelado: '#8E8E93',
  cortesia: '#671E75',
  reembolsado: '#8E8E93',
};

function fmt$(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

function paymentModelLabel(model: ClinicRevenueByPaymentMethod['payment_model']) {
  return model === 'out_of_pocket' ? 'Out-of-pocket' : 'Aseguradora';
}

function paymentMethodLabel(method: ClinicRevenueByPaymentMethod['payment_method']) {
  const labels: Record<NonNullable<ClinicRevenueByPaymentMethod['payment_method']>, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    aseguradora: 'Aseguradora',
    cortesia: 'Cortesia',
    pendiente: 'Pendiente',
  };
  return method ? labels[method] : '-';
}

// ── Shared card style helper ────────────────────────────────────────────────

function card(tokens: ReturnType<typeof useTheme>['tokens']): React.CSSProperties {
  return {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: '16px 18px',
  };
}

function statCard(tokens: ReturnType<typeof useTheme>['tokens'], brand: string): React.CSSProperties {
  return {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  };
}

function badge(color: string, bg?: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif',
    fontWeight: 500,
    background: bg ?? (color + '18'),
    color,
    whiteSpace: 'nowrap' as const,
  };
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ── Panel del día ───────────────────────────────────────────────────────────

function PanelHoy({
  todayAppts, escalations, preauth, resources, assignments, brand, tokens, goAppt, goAgenda, goPreauth, goInfra,
}: {
  todayAppts: ServiceAppointment[];
  escalations: ClinicalEscalation[];
  preauth: PreAuthRequest[];
  resources: ClinicResource[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  goAppt: (id: string) => void;
  goAgenda: (status?: AppointmentStatus) => void;
  goPreauth: () => void;
  goInfra: () => void;
}) {
  const completed = todayAppts.filter(a => a.status === 'completed').length;
  const inProgress = todayAppts.filter(a => a.status === 'in_progress').length;
  const checkedIn = todayAppts.filter(a => a.status === 'checked_in').length;
  const pendingAuth = preauth.filter(p => p.status === 'pending' || p.status === 'in_review').length;
  const occupancy = resources.length > 0 ? Math.round((assignments.length / resources.length) * 100) : 0;

  const stats = [
    { label: 'Citas hoy', value: todayAppts.length, color: brand, onClick: () => goAgenda() },
    { label: 'En progreso', value: inProgress, color: '#E08900', onClick: () => goAgenda('in_progress') },
    { label: 'Check-in', value: checkedIn, color: '#2D6BE4', onClick: () => goAgenda('checked_in') },
    { label: 'Ocupación', value: `${occupancy}%`, color: occupancy >= 80 ? '#D93A3A' : occupancy >= 50 ? '#E08900' : '#10897B', onClick: goInfra },
    { label: 'Pre-auth pendiente', value: pendingAuth, color: '#D93A3A', onClick: goPreauth },
    { label: 'Escalamientos activos', value: escalations.length, color: '#D93A3A', onClick: undefined },
  ];

  const upcoming = todayAppts.filter(a => a.status === 'scheduled' || a.status === 'checked_in' || a.status === 'in_progress');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {escalations.length > 0 && (
        <div style={{ background: 'rgba(217,58,58,0.08)', border: '1px solid rgba(217,58,58,0.35)', borderRadius: 10, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#D93A3A', display: 'flex' }}>{Ico.alertTriangle ?? Ico.alert}</span>
            <span style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: '#D93A3A' }}>Escalamientos activos ({escalations.length})</span>
          </div>
          {escalations.map(e => (
            <div key={e.id} style={{ fontSize: 12.5, color: tokens.text }}>
              {e.trigger_reason} — {e.destination === 'hub_hospital' ? 'Hospital hub' : e.destination === '911' ? 'Servicios de emergencia' : 'Otro destino'} · {fmtTime(e.triggered_at)}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <div
            key={s.label}
            onClick={s.onClick}
            style={{ ...statCard(tokens, brand), cursor: s.onClick ? 'pointer' : 'default' }}
          >
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: tokens.textSecondary, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {resources.length > 0 && (() => {
        const types: ClinicResourceType[] = ['infusion_chair', 'lab_station', 'imaging_room', 'surgery_room', 'consult_room'];
        const assignedIds = new Set(assignments.map(a => a.resource_id));
        return (
          <div style={card(tokens)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text }}>Mapa de capacidad operativa</div>
              <button onClick={goInfra}
                style={{ background: 'none', border: 'none', color: brand, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                Ver detalle →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {types.map(type => {
                const list = resources.filter(r => r.resource_type === type);
                if (list.length === 0) return null;
                return (
                  <div key={type} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tokens.text }}>
                      <span style={{ color: brand, display: 'inline-flex', width: 14, height: 14 }}>{RESOURCE_TYPE_ICON[type]}</span>
                      {RESOURCE_TYPE_LABEL[type]}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                      {list.map(r => {
                        const occ = assignedIds.has(r.id);
                        return (
                          <div key={r.id}
                            title={`${r.name} — ${occ ? 'ocupada' : 'libre'}`}
                            style={{
                              minWidth: 38, padding: '4px 7px', borderRadius: 6,
                              background: occ ? brand : tokens.surfaceAlt,
                              color: occ ? '#fff' : tokens.textSecondary,
                              border: `1px solid ${occ ? brand : tokens.border}`,
                              fontFamily: 'Roboto Mono, monospace', fontSize: 10.5, fontWeight: 500,
                              textAlign: 'center' as const,
                            }}>
                            {r.short_code ?? r.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={card(tokens)}>
        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 12 }}>Agenda del día</div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.textSecondary, textAlign: 'center', padding: '24px 0' }}>Sin citas pendientes para hoy</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {upcoming.map((a, i) => (
              <div key={a.id}
                style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: 'transparent', borderBottom: i < upcoming.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                onClick={() => goAppt(a.id)}
              >
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12.5, color: tokens.textSecondary }}>{fmtTime(a.scheduled_at)}</div>
                <div>
                  <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{a.patient_id}</div>
                  <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 1 }}>{a.service_name ?? a.service_id} {a.service_type ? `· ${SERVICE_TYPE_LABEL[a.service_type] ?? a.service_type}` : ''}</div>
                </div>
                <span style={badge(PREAUTH_COLOR[a.pre_auth_status] ?? '#8E8E93')}>{PREAUTH_LABEL[a.pre_auth_status]}</span>
                <span style={badge(APPT_STATUS_COLOR[a.status])}>{APPT_STATUS_LABEL[a.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nueva cita modal ─────────────────────────────────────────────────────────

function NewClinicAppointmentModal({
  clinicId, services, brand, tokens, onClose, onCreated,
}: {
  clinicId: string;
  services: ClinicService[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [patientId, setPatientId] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [paymentModel, setPaymentModel] = useState<'out_of_pocket' | 'aseguradora'>('out_of_pocket');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'cortesia'>('efectivo');
  const [insurer, setInsurer] = useState('');
  const [quotedPrice, setQuotedPrice] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = services.find(s => s.id === serviceId);

  useEffect(() => {
    if (!selectedService) return;
    setQuotedPrice(paymentModel === 'aseguradora' ? (selectedService.insurer_price ?? selectedService.list_price) : selectedService.list_price);
  }, [serviceId, paymentModel]);

  const inputSt: React.CSSProperties = {
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: tokens.surfaceAlt,
    color: tokens.text,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId.trim() || !serviceId || !scheduledAt) { setError('Completa los campos requeridos.'); return; }
    setLoading(true);
    setError(null);
    const result = await createClinicAppointment({
      clinicId,
      patientId: patientId.trim(),
      serviceId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      paymentModel,
      paymentMethod: paymentModel === 'out_of_pocket' ? paymentMethod : undefined,
      insurer: paymentModel === 'aseguradora' ? insurer : undefined,
      notes: notes.trim() || undefined,
      quotedPrice,
    });
    setLoading(false);
    if (!result) { setError('No se pudo crear la cita. Verifica el ID del paciente y vuelve a intentar.'); return; }
    await onCreated();
  }

  const labelSt: React.CSSProperties = { fontSize: 12, color: tokens.textSecondary, marginBottom: 4 };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxHeight: '90vh', background: tokens.surface, borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${tokens.border}` }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 15, color: tokens.text }}>Nueva cita ambulatoria</div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: tokens.surfaceAlt, color: tokens.textTertiary }}>{Ico.x}</div>
        </div>
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={labelSt}>ID Paciente *</div>
            <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="p.ej. PAC-0001" style={inputSt} required />
          </div>
          <div>
            <div style={labelSt}>Servicio *</div>
            <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inputSt} required>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {fmt$(s.list_price)}</option>
              ))}
              {services.length === 0 && <option value="">Sin servicios disponibles</option>}
            </select>
          </div>
          <div>
            <div style={labelSt}>Fecha y hora *</div>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inputSt} required />
          </div>
          <div>
            <div style={labelSt}>Modelo de pago</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['out_of_pocket', 'aseguradora'] as const).map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: tokens.text }}>
                  <input type="radio" checked={paymentModel === m} onChange={() => setPaymentModel(m)} style={{ accentColor: brand }} />
                  {m === 'out_of_pocket' ? 'Out-of-pocket' : 'Aseguradora'}
                </label>
              ))}
            </div>
          </div>
          {paymentModel === 'out_of_pocket' && (
            <div>
              <div style={labelSt}>Método de pago</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                {(['efectivo', 'tarjeta', 'transferencia', 'cortesia'] as const).map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: tokens.text }}>
                    <input type="radio" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} style={{ accentColor: brand }} />
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          )}
          {paymentModel === 'aseguradora' && (
            <div>
              <div style={labelSt}>Aseguradora *</div>
              <input value={insurer} onChange={e => setInsurer(e.target.value)} placeholder="Nombre de la aseguradora" style={inputSt} />
            </div>
          )}
          <div>
            <div style={labelSt}>Precio cotizado (MXN)</div>
            <input type="number" min={0} step={0.01} value={quotedPrice} onChange={e => setQuotedPrice(Number(e.target.value))} style={inputSt} />
          </div>
          <div>
            <div style={labelSt}>Notas (opcional)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' as const }} />
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: paymentModel === 'aseguradora' ? '#2D6BE418' : '#10897B12', border: `1px solid ${paymentModel === 'aseguradora' ? '#2D6BE4' : '#10897B'}40`, fontSize: 12, color: paymentModel === 'aseguradora' ? '#2D6BE4' : '#10897B' }}>
            {paymentModel === 'aseguradora'
              ? 'Se creará solicitud de pre-autorización. La cita no podrá iniciar hasta que sea aprobada.'
              : 'No requiere pre-autorización.'}
          </div>
          {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FDECEC', color: '#D93A3A', fontSize: 12.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${tokens.border}`, background: tokens.surface, color: tokens.text, fontSize: 13, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 0, background: loading ? '#ccc' : brand, color: '#fff', fontSize: 13, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creando…' : 'Crear cita'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Agenda completa ─────────────────────────────────────────────────────────

function Agenda({
  appointments, assignments, brand, tokens, onStatusChange, onNewAppt, goPatient, initialStatusFilter,
}: {
  appointments: ServiceAppointment[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<boolean>;
  onNewAppt: () => void;
  goPatient?: (patientId: string) => void;
  initialStatusFilter?: AppointmentStatus | 'all';
}) {
  const assignmentByAppt = new Map(assignments.map(a => [a.appointment_id, a]));
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  useEffect(() => {
    setFilterStatus(initialStatusFilter ?? 'all');
  }, [initialStatusFilter]);

  const filtered = appointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterType !== 'all' && a.service_type !== filterType) return false;
    return true;
  });

  const statuses: Array<AppointmentStatus | 'all'> = ['all', 'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
  const types = ['all', 'infusion', 'lab', 'imaging', 'surgery', 'consult'];

  const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
    scheduled: 'checked_in',
    checked_in: 'in_progress',
    in_progress: 'completed',
  };

  async function handleStatusBtn(id: string, nextStatus: AppointmentStatus) {
    const ok = await onStatusChange(id, nextStatus);
    if (!ok) {
      setBlockedMsg('Acción bloqueada: la pre-autorización de esta cita aún no ha sido aprobada.');
      setTimeout(() => setBlockedMsg(null), 4000);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterStatus === s ? brand : tokens.border}`, background: filterStatus === s ? brand + '15' : tokens.surface, color: filterStatus === s ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              {s === 'all' ? 'Todas' : APPT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterType === t ? brand : tokens.border}`, background: filterType === t ? brand + '15' : tokens.surface, color: filterType === t ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              {t === 'all' ? 'Todos los servicios' : SERVICE_TYPE_LABEL[t] ?? t}
            </button>
          ))}
          <button onClick={onNewAppt}
            style={{ padding: '5px 14px', borderRadius: 6, border: 0, background: brand, color: '#fff', fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer', marginLeft: 8 }}>
            ＋ Nueva cita
          </button>
        </div>
      </div>

      {blockedMsg && (
        <div style={{ background: 'rgba(217,58,58,0.09)', border: '1px solid rgba(217,58,58,0.35)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#D93A3A', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif' }}>
          {blockedMsg}
        </div>
      )}

      <div style={card(tokens)}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin citas con los filtros seleccionados</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {['Fecha / Hora', 'Paciente', 'Servicio', 'Recurso', 'Aseguradora', 'Pre-auth', 'Pago', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary, letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const isRejected = a.payment_status === 'preauth_rechazada';
                const nextStatus = isRejected ? undefined : NEXT_STATUS[a.status];
                const assignment = assignmentByAppt.get(a.id);
                const rowBg = isRejected ? 'rgba(217,58,58,0.04)' : 'transparent';
                return (
                  <tr key={a.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', background: rowBg, transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (!isRejected) (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt; }}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}>
                    <td style={{ padding: '10px 10px', fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: tokens.textSecondary, whiteSpace: 'nowrap' as const }}>
                      {fmtDate(a.scheduled_at)}<br />{fmtTime(a.scheduled_at)}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <div
                        onClick={goPatient ? e => { e.stopPropagation(); goPatient(a.patient_id); } : undefined}
                        style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: goPatient ? brand : tokens.text, cursor: goPatient ? 'pointer' : 'default' }}>
                        {a.patient_name || a.patient_id}
                      </div>
                      <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{a.patient_id}</div>
                      {a.cancellation_reason && (
                        <div style={{ fontSize: 10.5, color: '#D93A3A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 160 }} title={a.cancellation_reason}>{a.cancellation_reason}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', color: tokens.text }}>
                      <div style={{ fontWeight: 500 }}>{a.service_name ?? '—'}</div>
                      {a.service_type && <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{SERVICE_TYPE_LABEL[a.service_type] ?? a.service_type}</div>}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {assignment ? (
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: brand + '15', color: brand, fontSize: 11.5, fontFamily: 'Roboto Mono, monospace', fontWeight: 500 }}>
                          {assignment.resource_short_code ?? assignment.resource_name ?? '—'}
                        </span>
                      ) : (
                        <span style={{ color: tokens.textTertiary, fontSize: 11.5 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', color: tokens.textSecondary, fontSize: 12.5 }}>{a.insurer || '—'}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={badge(PREAUTH_COLOR[a.pre_auth_status] ?? '#8E8E93')}>{PREAUTH_LABEL[a.pre_auth_status]}</span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {a.payment_status && (
                        <span style={badge(PAYMENT_STATUS_COLOR[a.payment_status] ?? '#8E8E93')}>{PAYMENT_STATUS_LABEL[a.payment_status] ?? a.payment_status}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={badge(APPT_STATUS_COLOR[a.status])}>{APPT_STATUS_LABEL[a.status]}</span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {nextStatus && (
                        <button onClick={() => handleStatusBtn(a.id, nextStatus)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${brand}`, background: 'transparent', color: brand, fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                          → {APPT_STATUS_LABEL[nextStatus]}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Pre-autorización ─────────────────────────────────────────────────────────

function PreAuth({
  requests, brand, tokens, onStatusChange, goPatient,
}: {
  requests: PreAuthRequest[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onStatusChange: (id: string, status: PreAuthRequest['status']) => void;
  goPatient?: (patientId: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const pending = requests.filter(r => r.status === 'pending' || r.status === 'in_review').length;
  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus);
  const statuses = ['all', 'pending', 'in_review', 'approved', 'rejected', 'expired'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterStatus === s ? brand : tokens.border}`, background: filterStatus === s ? brand + '15' : tokens.surface, color: filterStatus === s ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              {s === 'all' ? `Todas (${requests.length})` : `${PREAUTH_LABEL[s] ?? s}`}
            </button>
          ))}
        </div>
        {pending > 0 && (
          <span style={{ ...badge('#D93A3A'), fontSize: 12 }}>{pending} requieren atención</span>
        )}
      </div>

      <div style={card(tokens)}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin solicitudes de pre-autorización</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map((r, i) => (
              <div key={r.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 180px auto', gap: 12, alignItems: 'center', padding: '12px 10px', borderRadius: 8, borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div>
                  <div
                    onClick={goPatient ? e => { e.stopPropagation(); goPatient(r.patient_id); } : undefined}
                    style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: goPatient ? brand : tokens.text, cursor: goPatient ? 'pointer' : 'default', display: 'inline' }}>
                    {r.patient_name || r.patient_id}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{r.patient_id} · {r.service_name ?? '—'} · {r.insurer}</div>
                  {r.folio_aseguradora && <div style={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', color: tokens.textSecondary, marginTop: 1 }}>Folio: {r.folio_aseguradora}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: tokens.textSecondary }}>
                  {r.submitted_at ? fmtDate(r.submitted_at) : '—'}
                </div>
                <div>
                  <span style={badge(PREAUTH_COLOR[r.status] ?? '#8E8E93')}>{PREAUTH_LABEL[r.status] ?? r.status}</span>
                  {r.status === 'rejected' && (
                    <div style={{ fontSize: 11, color: '#D93A3A', marginTop: 4 }}>Cita cancelada automáticamente</div>
                  )}
                  {r.status === 'rejected' && r.notes && (
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{r.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => onStatusChange(r.id, 'in_review')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid #2D6BE4`, background: 'transparent', color: '#2D6BE4', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Iniciar revisión
                      </button>
                      <button onClick={() => onStatusChange(r.id, 'approved')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #10897B', background: 'transparent', color: '#10897B', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Aprobar
                      </button>
                    </>
                  )}
                  {r.status === 'in_review' && (
                    <>
                      <button onClick={() => onStatusChange(r.id, 'approved')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #10897B', background: '#10897B', color: '#fff', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Aprobar
                      </button>
                      <button onClick={() => onStatusChange(r.id, 'rejected')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D93A3A', background: 'transparent', color: '#D93A3A', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmtDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Resultados ──────────────────────────────────────────────────────────────

function Resultados({
  results, brand, tokens, goPatient,
}: {
  results: ServiceResult[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  goPatient?: (patientId: string) => void;
}) {
  const critical = results.filter(r => r.critical);
  const RESULT_LABEL: Record<string, string> = { lab: 'Laboratorio', imaging: 'Imagen', procedure_note: 'Nota de procedimiento' };
  const RESULT_ICO: Record<string, React.ReactNode> = { lab: Ico.flask, imaging: Ico.image, procedure_note: Ico.file };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {critical.length > 0 && (
        <div style={{ background: 'rgba(217,58,58,0.07)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: '#D93A3A', marginBottom: 8 }}>
            Resultados críticos sin revisar ({critical.length})
          </div>
          {critical.map(r => (
            <div key={r.id} style={{ fontSize: 12.5, color: tokens.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#D93A3A', display: 'inline-flex', width: 14, height: 14 }}>{RESULT_ICO[r.result_type] ?? Ico.file}</span>
              {r.patient_id} · {RESULT_LABEL[r.result_type] ?? r.result_type} · {fmtDate(r.created_at)}
            </div>
          ))}
        </div>
      )}

      <div style={card(tokens)}>
        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 12 }}>Resultados recientes</div>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin resultados registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {results.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 10px', borderBottom: i < results.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}>
                <span style={{ color: brand, display: 'inline-flex', width: 18, height: 18 }}>{RESULT_ICO[r.result_type] ?? Ico.file}</span>
                <div>
                  <div
                    onClick={goPatient ? e => { e.stopPropagation(); goPatient(r.patient_id); } : undefined}
                    style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: goPatient ? brand : tokens.text, cursor: goPatient ? 'pointer' : 'default', display: 'inline' }}>
                    {r.patient_name || r.patient_id}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 1 }}>{RESULT_LABEL[r.result_type] ?? r.result_type} · {fmtDate(r.created_at)}</div>
                </div>
                {r.critical && <span style={badge('#D93A3A')}>Crítico</span>}
                {r.notified_at
                  ? <span style={badge('#10897B')}>Notificado</span>
                  : <span style={badge('#E08900')}>Sin notificar</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aseguradoras ─────────────────────────────────────────────────────────────

function Aseguradoras({
  appointments, preauth, brand, tokens,
}: {
  appointments: ServiceAppointment[];
  preauth: PreAuthRequest[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  const insurerMap: Record<string, { total: number; completed: number; preauth_pending: number; preauth_approved: number }> = {};

  for (const a of appointments) {
    const k = a.insurer || 'Sin aseguradora';
    if (!insurerMap[k]) insurerMap[k] = { total: 0, completed: 0, preauth_pending: 0, preauth_approved: 0 };
    insurerMap[k].total++;
    if (a.status === 'completed') insurerMap[k].completed++;
    if (a.pre_auth_status === 'pending' || a.pre_auth_status === 'in_review') insurerMap[k].preauth_pending++;
    if (a.pre_auth_status === 'approved') insurerMap[k].preauth_approved++;
  }

  const insurers = Object.entries(insurerMap).sort((a, b) => b[1].total - a[1].total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card(tokens)}>
        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 12 }}>Resumen por aseguradora</div>
        {insurers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin datos de aseguradoras</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {['Aseguradora', 'Citas totales', 'Completadas', 'Pre-auth pendiente', 'Pre-auth aprobada'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary, letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insurers.map(([name, stats], i) => (
                <tr key={name} style={{ borderBottom: i < insurers.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}>
                  <td style={{ padding: '10px 10px', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.text }}>{name}</td>
                  <td style={{ padding: '10px 10px', color: tokens.text }}>{stats.total}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={badge('#10897B')}>{stats.completed}</span>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    {stats.preauth_pending > 0
                      ? <span style={badge('#D93A3A')}>{stats.preauth_pending}</span>
                      : <span style={{ color: tokens.textSecondary, fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    {stats.preauth_approved > 0
                      ? <span style={badge('#10897B')}>{stats.preauth_approved}</span>
                      : <span style={{ color: tokens.textSecondary, fontSize: 12 }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Rendimiento financiero ────────────────────────────────────────────────────

function Rendimiento({
  clinicId, appointments, brand, tokens, goAgenda, goPreauth,
}: {
  clinicId: string;
  appointments: ServiceAppointment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  goAgenda: (status?: AppointmentStatus) => void;
  goPreauth: () => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  const [metrics, setMetrics] = useState<ClinicFinancialMonthly[]>([]);
  const [revenueByMethod, setRevenueByMethod] = useState<ClinicRevenueByPaymentMethod[]>([]);
  const [serviceFinancials, setServiceFinancials] = useState<ClinicServiceFinancialMonthly[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMonths, setPeriodMonths] = useState<6 | 12>(6);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getClinicFinancialMetrics(clinicId, 12),
      getClinicRevenueByPaymentMethod(clinicId, currentMonth),
      getClinicServiceFinancials(clinicId, currentMonth),
    ]).then(([m, r, s]) => {
      setMetrics(m);
      setRevenueByMethod(r);
      setServiceFinancials(s);
      setLoading(false);
    });
  }, [clinicId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: tokens.textSecondary }}>Cargando métricas financieras…</div>;
  }

  const currentMetrics = metrics[metrics.length - 1] ?? {
    collected_amount: 0, completed_services: 0, unique_patients: 0,
    estimated_margin: 0, insurer_pipeline_amount: 0, preauth_rejected_cancelled: 0,
  };

  const total = appointments.length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const noShow = appointments.filter(a => a.status === 'no_show').length;
  const escalated = appointments.filter(a => a.status === 'escalated').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byType: Record<string, number> = {};
  for (const a of appointments) {
    const t = a.service_type ?? 'unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }

  const financialKpis = [
    { label: 'Ingresos cobrados', value: fmt$(currentMetrics.collected_amount), color: brand, onClick: () => goAgenda('completed') },
    { label: 'Completados', value: currentMetrics.completed_services, color: '#10897B', onClick: () => goAgenda('completed') },
    { label: 'Pacientes únicos', value: currentMetrics.unique_patients, color: '#2D6BE4', onClick: () => goAgenda() },
    { label: 'Margen estimado', value: fmt$(currentMetrics.estimated_margin), color: '#10897B', onClick: () => goAgenda('completed') },
    { label: 'Pipeline aseguradoras', value: fmt$(currentMetrics.insurer_pipeline_amount), color: '#E08900', onClick: goPreauth },
    { label: 'Canceladas por pre-auth', value: currentMetrics.preauth_rejected_cancelled, color: '#D93A3A', onClick: () => goAgenda('cancelled') },
  ];

  const operationalKpis = [
    { label: 'Citas totales', value: total, color: brand, onClick: () => goAgenda() },
    { label: 'Completadas', value: completed, color: '#10897B', onClick: () => goAgenda('completed') },
    { label: 'Canceladas', value: cancelled, color: '#8E8E93', onClick: () => goAgenda('cancelled') },
    { label: 'No se presentaron', value: noShow, color: '#8E8E93', onClick: () => goAgenda('no_show') },
    { label: 'Escalamientos', value: escalated, color: '#D93A3A', onClick: () => goAgenda('escalated') },
    { label: 'Tasa de completación', value: `${completionRate}%`, color: completionRate >= 80 ? '#10897B' : completionRate >= 60 ? '#E08900' : '#D93A3A', onClick: () => goAgenda('completed') },
  ];

  const chartData = metrics.slice(-periodMonths).map(m => {
    const d = new Date(m.month);
    const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    return { month: label, cobrado: m.collected_amount, margen: m.estimated_margin };
  });

  const revenueByModelMethodMap = revenueByMethod.reduce((acc, row) => {
    const key = `${row.payment_model}:${row.payment_method ?? 'sin_metodo'}`;
    const current = acc.get(key) ?? {
      payment_model: row.payment_model,
      payment_method: row.payment_method,
      services: 0,
      collected_amount: 0,
      booked_amount: 0,
      statuses: new Map<ClinicPaymentStatus, number>(),
    };

    current.services += row.services;
    current.collected_amount += row.collected_amount;
    current.booked_amount += row.booked_amount;
    current.statuses.set(row.payment_status, (current.statuses.get(row.payment_status) ?? 0) + row.services);
    acc.set(key, current);
    return acc;
  }, new Map<string, {
    payment_model: ClinicRevenueByPaymentMethod['payment_model'];
    payment_method: ClinicRevenueByPaymentMethod['payment_method'];
    services: number;
    collected_amount: number;
    booked_amount: number;
    statuses: Map<ClinicPaymentStatus, number>;
  }>());

  const revenueByModelMethod = Array.from(revenueByModelMethodMap.values())
    .map(row => ({
      ...row,
      statuses: Array.from(row.statuses.entries())
        .map(([status, services]) => ({ status, services }))
        .sort((a, b) => b.services - a.services),
    }))
    .sort((a, b) => b.collected_amount - a.collected_amount || b.booked_amount - a.booked_amount || b.services - a.services);

  const noFinancialData = serviceFinancials.length === 0 && revenueByMethod.length === 0 && metrics.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text }}>Finanzas del mes</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {financialKpis.map(k => (
          <div key={k.label} onClick={k.onClick} style={{ ...statCard(tokens, brand), cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 22, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: tokens.textSecondary, lineHeight: 1.3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text }}>Operación de agenda</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {operationalKpis.map(k => (
          <div key={k.label} onClick={k.onClick} style={{ ...statCard(tokens, brand), cursor: 'pointer' }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 22, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: tokens.textSecondary, lineHeight: 1.3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={card(tokens)}>
        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 14 }}>Citas por tipo de servicio</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={type} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 48px', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12.5, color: tokens.text, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500 }}>{SERVICE_TYPE_LABEL[type] ?? type}</div>
                <div style={{ height: 8, borderRadius: 999, background: tokens.borderLight, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: brand }} />
                </div>
                <div style={{ fontSize: 12, color: tokens.textSecondary, textAlign: 'right', fontFamily: 'Roboto Mono, monospace' }}>{count}</div>
              </div>
            );
          })}
          {Object.keys(byType).length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: tokens.textSecondary }}>Sin datos de rendimiento operativo</div>
          )}
        </div>
      </div>

      {noFinancialData ? (
        <div style={{ ...card(tokens), textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>
          Sin datos financieros para este período. Las vistas se actualizan al completar servicios.
        </div>
      ) : (
        <>
          {/* Tendencia mensual */}
          <div style={card(tokens)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text }}>Tendencia mensual</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([6, 12] as const).map(p => (
                  <button key={p} onClick={() => setPeriodMonths(p)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${periodMonths === p ? brand : tokens.border}`, background: periodMonths === p ? brand + '15' : tokens.surface, color: periodMonths === p ? brand : tokens.textSecondary, fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                    {p}M
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderLight} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: tokens.textSecondary }} />
                  <YAxis tickFormatter={v => fmt$(v as number)} tick={{ fontSize: 11, fill: tokens.textSecondary }} width={60} />
                  <Tooltip formatter={(v: number) => fmt$(v)} labelStyle={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontSize: 12 }} />
                  <Line type="monotone" dataKey="cobrado" stroke={brand} strokeWidth={2} dot={false} name="Cobrado" />
                  <Line type="monotone" dataKey="margen" stroke="#10897B" strokeWidth={2} dot={false} name="Margen est." />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: tokens.textSecondary }}>Sin datos históricos</div>
            )}
          </div>

          {/* Desglose por modelo/método */}
          {revenueByModelMethod.length > 0 && (
            <div style={card(tokens)}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 14 }}>Desglose por modelo y método de pago</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    {['Modelo', 'Metodo', 'Servicios', 'Cobrado', 'Cotizado', 'Estados'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenueByModelMethod.map((r, i) => (
                    <tr key={`${r.payment_model}-${r.payment_method ?? 'sin-metodo'}`} style={{ borderBottom: i < revenueByModelMethod.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}>
                      <td style={{ padding: '9px 10px', color: tokens.text, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500 }}>
                        {paymentModelLabel(r.payment_model)}
                      </td>
                      <td style={{ padding: '9px 10px', color: tokens.textSecondary }}>{paymentMethodLabel(r.payment_method)}</td>
                      <td style={{ padding: '9px 10px', color: tokens.text }}>{r.services}</td>
                      <td style={{ padding: '9px 10px', color: tokens.text, fontFamily: 'Roboto Mono, monospace' }}>{fmt$(r.collected_amount)}</td>
                      <td style={{ padding: '9px 10px', color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmt$(r.booked_amount)}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {r.statuses.map(s => (
                            <span key={s.status} style={badge(PAYMENT_STATUS_COLOR[s.status] ?? '#8E8E93')}>
                              {PAYMENT_STATUS_LABEL[s.status] ?? s.status} - {s.services}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tabla por servicio */}
          {serviceFinancials.length > 0 && (
            <div style={card(tokens)}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 14 }}>Rendimiento por servicio</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    {['Servicio', 'Completados', 'Cobrado', 'Ticket promedio', 'Margen est.'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceFinancials.map((s, i) => (
                    <tr key={i}
                      style={{ borderBottom: i < serviceFinancials.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.text }}>{s.service_name}</div>
                        <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 1 }}>{SERVICE_TYPE_LABEL[s.service_type] ?? s.service_type}</div>
                      </td>
                      <td style={{ padding: '9px 10px', color: tokens.text }}>{s.completed_services}</td>
                      <td style={{ padding: '9px 10px', color: tokens.text, fontFamily: 'Roboto Mono, monospace' }}>{fmt$(s.collected_amount)}</td>
                      <td style={{ padding: '9px 10px', color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmt$(s.avg_ticket)}</td>
                      <td style={{ padding: '9px 10px', color: '#10897B', fontFamily: 'Roboto Mono, monospace' }}>{fmt$(s.estimated_margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Bandeja CRM ──────────────────────────────────────────────────────────────

const CONV_STATUS_LABEL: Record<ClinicConversationStatus, string> = {
  bot: 'Bot Concierge',
  waiting_human: 'Espera humano',
  in_progress: 'En atención',
  resolved: 'Resuelta',
  escalated: 'Escalada',
};

const CONV_STATUS_COLOR: Record<ClinicConversationStatus, string> = {
  bot: '#8E8E93',
  waiting_human: '#D93A3A',
  in_progress: '#E08900',
  resolved: '#10897B',
  escalated: '#D93A3A',
};

const INTENT_LABEL: Record<string, string> = {
  appointment: 'Cita',
  preauth: 'Pre-autorización',
  result: 'Resultado',
  follow_up: 'Seguimiento',
  escalation: 'Escalamiento',
  general: 'General',
};

function Bandeja({
  clinicId, staffId, brand, tokens, goPatient,
}: {
  clinicId: string;
  staffId: string;
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  goPatient?: (patientId: string) => void;
}) {
  const [conversations, setConversations] = useState<ClinicConversation[]>([]);
  const [messages, setMessages] = useState<ClinicChatMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'waiting_human' | 'in_progress' | 'bot' | 'resolved'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    setLoading(true);
    listConversations(clinicId).then(c => {
      setConversations(c);
      setSelectedId(prev => prev || c[0]?.id || '');
      setLoading(false);
    });

    const ch = supabase
      .channel(`clinic-conv-${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_conversations', filter: `clinic_id=eq.${clinicId}` }, () => {
        listConversations(clinicId).then(setConversations);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [clinicId]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingMessages(true);
    listConversationMessages(selectedId).then(m => {
      setMessages(m);
      setLoadingMessages(false);
    });
    markConversationRead(selectedId);

    const ch = supabase
      .channel(`clinic-msg-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_chat_messages', filter: `conversation_id=eq.${selectedId}` }, () => {
        listConversationMessages(selectedId).then(setMessages);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  const selected = conversations.find(c => c.id === selectedId) || null;

  const filtered = conversations.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!c.patient_name.toLowerCase().includes(q) && !c.patient_id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    waiting_human: conversations.filter(c => c.status === 'waiting_human').length,
    in_progress: conversations.filter(c => c.status === 'in_progress').length,
    bot: conversations.filter(c => c.status === 'bot').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId || !selected) return;
    const now = new Date();
    const tm = `hoy ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const optimistic: ClinicChatMessage = {
      id: 'optimistic-' + now.getTime(),
      conversation_id: selectedId,
      clinic_id: selected.clinic_id,
      t: 'out',
      body: text,
      tm,
      created_at: now.toISOString(),
    };
    setMessages(curr => [...curr, optimistic]);
    setDraft('');
    await sendConversationMessage(selectedId, selected.clinic_id, text);
    // If waiting_human / bot, auto-promote to in_progress and assign
    if (selected.status === 'waiting_human' || selected.status === 'bot') {
      await updateConversationStatus(selectedId, 'in_progress', staffId);
      listConversations(clinicId).then(setConversations);
    }
  }

  async function handleTakeOver() {
    if (!selectedId) return;
    await updateConversationStatus(selectedId, 'in_progress', staffId);
    listConversations(clinicId).then(setConversations);
  }

  async function handleResolve() {
    if (!selectedId) return;
    await updateConversationStatus(selectedId, 'resolved');
    listConversations(clinicId).then(setConversations);
  }

  const filterChips: Array<{ id: typeof filter; label: string; n?: number; sev?: string }> = [
    { id: 'all', label: 'Todas', n: conversations.length },
    { id: 'waiting_human', label: 'Espera humano', n: counts.waiting_human || undefined, sev: 'red' },
    { id: 'in_progress', label: 'En atención', n: counts.in_progress || undefined, sev: 'amber' },
    { id: 'bot', label: 'Bot', n: counts.bot || undefined },
    { id: 'resolved', label: 'Resueltas', n: counts.resolved || undefined },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: tokens.textSecondary }}>Cargando bandeja…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 18, color: tokens.text }}>Bandeja WhatsApp · Muguerza Concierge</div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>
            {counts.waiting_human} esperando atención · {counts.in_progress} en proceso · {counts.bot} en bot
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
        {filterChips.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filter === f.id ? brand : tokens.border}`, background: filter === f.id ? brand + '15' : tokens.surface, color: filter === f.id ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {f.label}
            {f.n != null && (
              <span style={{ background: f.sev === 'red' ? '#D93A3A' : f.sev === 'amber' ? '#E08900' : tokens.surfaceAlt, color: f.sev ? '#fff' : tokens.textSecondary, fontSize: 10, padding: '0 6px', borderRadius: 999, minWidth: 16, textAlign: 'center', fontWeight: 500 }}>{f.n}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 12, minHeight: 600 }}>
        {/* Lista de conversaciones */}
        <aside style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${tokens.borderLight}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: tokens.surfaceAlt, border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '7px 10px' }}>
              <span style={{ color: tokens.textSecondary, display: 'flex' }}>{Ico.search}</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar paciente…"
                style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: 'inherit', color: tokens.text }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: tokens.textSecondary, fontSize: 12.5 }}>Sin conversaciones</div>
            ) : filtered.map((c, i) => {
              const active = c.id === selectedId;
              return (
                <div key={c.id} onClick={() => setSelectedId(c.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '11px 12px', borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', cursor: 'pointer', background: active ? brand + '12' : tokens.surface, alignItems: 'center' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surface; }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: active ? brand : tokens.text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.patient_name}</div>
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.intent ? `${INTENT_LABEL[c.intent] ?? c.intent} · ` : ''}{c.last_message_preview ?? '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 10.5, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmtTime(c.last_message_at)}</div>
                    {c.unread_count > 0 && (
                      <span style={{ fontSize: 10.5, minWidth: 18, padding: '1px 6px', borderRadius: 999, background: '#D93A3A', color: '#fff', textAlign: 'center', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500 }}>{c.unread_count}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Detalle de conversación */}
        <section style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 10, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto' }}>
          {selected ? (
            <>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    onClick={goPatient ? () => goPatient(selected.patient_id) : undefined}
                    style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 16, color: goPatient ? brand : tokens.text, cursor: goPatient ? 'pointer' : 'default', display: 'inline' }}>
                    {selected.patient_name}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>
                    {selected.patient_phone ?? '—'} · {selected.patient_id} · {selected.channel}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={badge(CONV_STATUS_COLOR[selected.status])}>{CONV_STATUS_LABEL[selected.status]}</span>
                  {(selected.status === 'bot' || selected.status === 'waiting_human') && (
                    <button onClick={handleTakeOver}
                      style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${brand}`, background: brand, color: '#fff', fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                      Tomar caso
                    </button>
                  )}
                  {selected.status === 'in_progress' && (
                    <button onClick={handleResolve}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #10897B', background: 'transparent', color: '#10897B', fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                      Marcar resuelta
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: 16, background: tokens.surfaceAlt, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', color: tokens.textSecondary, fontSize: 12.5, marginTop: 24 }}>Cargando…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: tokens.textSecondary, fontSize: 12.5, marginTop: 24 }}>Sin mensajes</div>
                ) : messages.map(m => {
                  const isOut = m.t === 'out';
                  const isBot = m.t === 'bot';
                  const isSys = m.t === 'system';
                  return (
                    <div key={m.id} style={{ alignSelf: isOut ? 'flex-end' : isSys ? 'center' : 'flex-start', maxWidth: '72%' }}>
                      {isBot && (
                        <div style={{ fontSize: 10, color: tokens.textSecondary, marginBottom: 2, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ display: 'inline-flex', width: 12, height: 12 }}>{Ico.bot}</span>
                          Bot Concierge
                        </div>
                      )}
                      <div style={{
                        padding: '9px 12px',
                        borderRadius: 12,
                        background: isOut ? brand : isBot ? tokens.surfaceAlt : isSys ? 'transparent' : tokens.surface,
                        color: isOut ? '#fff' : tokens.text,
                        fontSize: 12.8,
                        lineHeight: 1.45,
                        border: isBot ? `1px dashed ${tokens.border}` : 'none',
                        fontStyle: isSys ? 'italic' : 'normal',
                      }}>
                        {m.body}
                      </div>
                      <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 3, textAlign: isOut ? 'right' : 'left', padding: '0 4px' }}>{m.tm}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 12, background: tokens.surface, borderTop: `1px solid ${tokens.border}`, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={selected.status === 'resolved' ? 'Conversación resuelta — escribe para reabrir' : 'Mensaje al paciente…'}
                  rows={1}
                  style={{ flex: 1, resize: 'none', border: `1px solid ${tokens.border}`, borderRadius: 18, padding: '9px 14px', fontSize: 12.8, fontFamily: 'inherit', background: tokens.surfaceAlt, color: tokens.text, outline: 'none', maxHeight: 86, lineHeight: 1.45, boxSizing: 'border-box' }} />
                <button onClick={handleSend} disabled={!draft.trim()}
                  style={{ width: 38, height: 38, borderRadius: 999, border: 0, background: draft.trim() ? brand : tokens.border, color: '#fff', cursor: draft.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {Ico.send}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: tokens.textSecondary, fontSize: 13 }}>Selecciona una conversación</div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Infraestructura / Capacidad Operativa ──────────────────────────────────

const RESOURCE_TYPE_LABEL: Record<ClinicResourceType, string> = {
  infusion_chair: 'Infusiones',
  lab_station: 'Laboratorio',
  imaging_room: 'Imagen',
  surgery_room: 'Cirugía ambulatoria',
  consult_room: 'Consulta',
};

const RESOURCE_TYPE_ICON: Record<ClinicResourceType, React.ReactNode> = {
  infusion_chair: Ico.heart,
  lab_station: Ico.flask,
  imaging_room: Ico.image,
  surgery_room: Ico.activity,
  consult_room: Ico.stethoscope,
};

function minutesUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / 60000);
}

function fmtRemaining(min: number | null): string {
  if (min === null) return '—';
  if (min < 0) return `+${Math.abs(min)} min`;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function Infraestructura({
  resources, assignments, brand, tokens, onMove, onComplete,
}: {
  resources: ClinicResource[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onMove: (assignment: ClinicResourceAssignment, resource: ClinicResource) => void;
  onComplete: (assignment: ClinicResourceAssignment) => void;
}) {
  const [dragging, setDragging] = useState<ClinicResourceAssignment | null>(null);
  const [movingAssignment, setMovingAssignment] = useState<ClinicResourceAssignment | null>(null);
  const byType: Record<ClinicResourceType, ClinicResource[]> = {
    infusion_chair: [], lab_station: [], imaging_room: [], surgery_room: [], consult_room: [],
  };
  for (const r of resources) byType[r.resource_type].push(r);
  const assignmentByResource = new Map(assignments.map(a => [a.resource_id, a]));
  const activeMove = dragging ?? movingAssignment;

  const types: ClinicResourceType[] = ['infusion_chair', 'lab_station', 'imaging_room', 'surgery_room', 'consult_room'];

  const totals = types.map(t => {
    const total = byType[t].length;
    const occupied = byType[t].filter(r => assignmentByResource.has(r.id)).length;
    return { type: t, total, occupied };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Resumen de utilización */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {totals.map(({ type, total, occupied }) => {
          const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
          const color = pct >= 80 ? '#D93A3A' : pct >= 50 ? '#E08900' : '#10897B';
          return (
            <div key={type} style={statCard(tokens, brand)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: brand, display: 'inline-flex', width: 18, height: 18 }}>{RESOURCE_TYPE_ICON[type]}</span>
                <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 22, color, lineHeight: 1 }}>
                  {occupied}/{total}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: tokens.textSecondary, lineHeight: 1.3, marginTop: 2 }}>{RESOURCE_TYPE_LABEL[type]}</div>
              <div style={{ background: tokens.borderLight, borderRadius: 999, height: 4, overflow: 'hidden', marginTop: 6 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mapa de cada tipo */}
      {types.map(type => {
        const list = byType[type];
        if (list.length === 0) return null;
        const canDropInType = activeMove?.resource_type === type;
        return (
          <div key={type} style={card(tokens)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ color: brand, display: 'inline-flex', width: 20, height: 20 }}>{RESOURCE_TYPE_ICON[type]}</span>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 14, color: tokens.text }}>
                {RESOURCE_TYPE_LABEL[type]}
              </div>
              <span style={{ fontSize: 11.5, color: tokens.textSecondary, marginLeft: 4 }}>
                {list.filter(r => assignmentByResource.has(r.id)).length} de {list.length} ocupadas
              </span>
            </div>
            {canDropInType && (
              <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: '#10897B12', border: '1px solid #10897B40', color: '#10897B', fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>Mueve al paciente a un recurso libre de {RESOURCE_TYPE_LABEL[type].toLowerCase()}.</span>
                {movingAssignment && (
                  <button onClick={() => setMovingAssignment(null)}
                    style={{ border: '1px solid #10897B40', background: tokens.surface, color: '#10897B', borderRadius: 6, padding: '3px 8px', fontSize: 10.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {list.map(r => {
                const a = assignmentByResource.get(r.id);
                const occupied = !!a;
                const remaining = occupied ? minutesUntil(a.expected_end_at) : null;
                const overdue = remaining !== null && remaining < 0;
                const canMoveHere = !!activeMove && !occupied && activeMove.resource_type === r.resource_type;
                const bg = canMoveHere ? '#10897B12' : occupied ? (overdue ? 'rgba(217,58,58,0.08)' : brand + '0F') : tokens.surfaceAlt;
                const borderColor = canMoveHere ? '#10897B' : occupied ? (overdue ? '#D93A3A' : brand) : tokens.border;

                return (
                  <div key={r.id}
                    onDragOver={e => {
                      if (canMoveHere) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDragEnter={e => {
                      if (canMoveHere) e.preventDefault();
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      if (activeMove && canMoveHere) onMove(activeMove, r);
                      setDragging(null);
                      setMovingAssignment(null);
                    }}
                    style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 110, transition: 'border-color 0.12s, background 0.12s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{r.name}</div>
                      <span style={{ ...badge(occupied ? (overdue ? '#D93A3A' : brand) : '#10897B'), fontSize: 10 }}>
                        {canMoveHere ? 'Mover aquí' : occupied ? (overdue ? 'Sobretiempo' : 'Ocupada') : 'Libre'}
                      </span>
                    </div>
                    {occupied ? (
                      <div
                        draggable
                        onDragStart={e => {
                          setDragging(a);
                          setMovingAssignment(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', a.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, opacity: dragging?.id === a.id ? 0.5 : 1, cursor: 'grab' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 999, background: brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, flexShrink: 0 }}>
                            {a.patient_id.slice(-2)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12.5, color: tokens.text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.patient_id}</div>
                            <div style={{ fontSize: 10.5, color: tokens.textSecondary, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.service_name ?? ''}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                          <div style={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', color: overdue ? '#D93A3A' : tokens.textSecondary }}>
                            {overdue ? 'Excede ' : 'Termina en '}{fmtRemaining(remaining)}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); setMovingAssignment(movingAssignment?.id === a.id ? null : a); }}
                              style={{ padding: '3px 9px', borderRadius: 6, border: `1px solid ${movingAssignment?.id === a.id ? brand : tokens.border}`, background: movingAssignment?.id === a.id ? brand : tokens.surface, color: movingAssignment?.id === a.id ? '#fff' : brand, fontSize: 10.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                              Mover
                            </button>
                            <button onClick={() => onComplete(a)}
                              style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #10897B', background: '#10897B', color: '#fff', fontSize: 10.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                              Terminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: canMoveHere ? '#10897B' : tokens.textTertiary, fontSize: 12, fontFamily: canMoveHere ? 'Franklin Gothic, Libre Franklin, sans-serif' : undefined, fontWeight: canMoveHere ? 500 : undefined }}>
                        {canMoveHere ? (
                          <button onClick={() => { if (activeMove) onMove(activeMove, r); setMovingAssignment(null); }}
                            style={{ border: '1px solid #10897B', background: '#10897B', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                            Mover aquí
                          </button>
                        ) : 'Disponible'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {resources.length === 0 && (
        <div style={card(tokens)}>
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: tokens.textSecondary }}>
            Sin recursos configurados para esta clínica. Pide al administrador que registre las sillas, salas y consultorios.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pacientes Ambulatorio ───────────────────────────────────────────────────

function ClinicPatientList({
  clinicId, brand, tokens, onOpenPatient,
}: {
  clinicId: string;
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onOpenPatient: (patientId: string) => void;
}) {
  const [patients, setPatients] = useState<ClinicPatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRecurrent, setFilterRecurrent] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ClinicPatientTreatmentStatus | 'all'>('all');

  useEffect(() => {
    setLoading(true);
    listClinicPatients(clinicId).then(p => { setPatients(p); setLoading(false); });
  }, [clinicId]);

  const filtered = patients.filter(p => {
    if (filterActive === 'active' && !p.active) return false;
    if (filterActive === 'inactive' && p.active) return false;
    if (filterRecurrent && !p.is_recurrent) return false;
    if (filterStatus !== 'all' && p.current_status !== filterStatus) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !p.full_name.toLowerCase().includes(q) &&
        !(p.phone ?? '').includes(q) &&
        !(p.insurer ?? '').toLowerCase().includes(q) &&
        !(p.policy_number ?? '').toLowerCase().includes(q) &&
        !p.id.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const statusOptions: Array<ClinicPatientTreatmentStatus | 'all'> = [
    'all', 'in_progress', 'scheduled', 'follow_up_required', 'escalated',
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: tokens.textSecondary }}>Cargando pacientes…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '7px 12px', flex: '1 1 240px', maxWidth: 380 }}>
          <span style={{ color: tokens.textSecondary, display: 'flex', flexShrink: 0 }}>{Ico.search}</span>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Nombre, teléfono, aseguradora, póliza, ID…"
            style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: 'inherit', color: tokens.text }} />
        </div>
        {(['all', 'active', 'inactive'] as const).map(v => (
          <button key={v} onClick={() => setFilterActive(v)}
            style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterActive === v ? brand : tokens.border}`, background: filterActive === v ? brand + '15' : tokens.surface, color: filterActive === v ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
            {v === 'all' ? 'Todos' : v === 'active' ? 'Activos' : 'Inactivos'}
          </button>
        ))}
        <button onClick={() => setFilterRecurrent(r => !r)}
          style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterRecurrent ? brand : tokens.border}`, background: filterRecurrent ? brand + '15' : tokens.surface, color: filterRecurrent ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
          Recurrentes
        </button>
        {statusOptions.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterStatus === s ? (s === 'all' ? brand : TREATMENT_STATUS_COLOR[s as ClinicPatientTreatmentStatus]) : tokens.border}`, background: filterStatus === s ? (s === 'all' ? brand + '15' : TREATMENT_STATUS_COLOR[s as ClinicPatientTreatmentStatus] + '15') : tokens.surface, color: filterStatus === s ? (s === 'all' ? brand : TREATMENT_STATUS_COLOR[s as ClinicPatientTreatmentStatus]) : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
            {s === 'all' ? 'Todos los estados' : TREATMENT_STATUS_LABEL[s as ClinicPatientTreatmentStatus]}
          </button>
        ))}
      </div>

      <div style={{ ...card(tokens), padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>
            {patients.length === 0 ? 'Sin pacientes registrados en esta clínica' : 'Sin pacientes con los filtros seleccionados'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {['Paciente', 'Aseguradora / Póliza', 'Estado operativo', 'Última visita', 'Próxima cita', 'Visitas', 'Alertas'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary, letterSpacing: 0.3, whiteSpace: 'nowrap' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id}
                  onClick={() => onOpenPatient(p.id)}
                  style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {p.phone && <span>{p.phone}</span>}
                      {!p.active && <span style={badge('#8E8E93', '#8E8E9318')}>Inactivo</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 12.5, color: tokens.text }}>{p.insurer ?? '—'}</div>
                    {p.policy_number && <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace', marginTop: 2 }}>{p.policy_number}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={badge(TREATMENT_STATUS_COLOR[p.current_status])}>{TREATMENT_STATUS_LABEL[p.current_status]}</span>
                    {p.current_service_name && <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 3 }}>{p.current_service_name}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' as const, fontFamily: 'Roboto Mono, monospace' }}>
                    {p.last_visit_at ? fmtDate(p.last_visit_at) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' as const, fontFamily: 'Roboto Mono, monospace' }}>
                    {p.next_visit_at ? fmtDate(p.next_visit_at) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text }}>{p.visits_total}</div>
                    {p.is_recurrent && <div style={{ marginTop: 2 }}><span style={badge(brand, brand + '18')}>Recurrente</span></div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                      {p.critical_results_count > 0 && <span style={badge('#D93A3A')}>Resultado crítico</span>}
                      {p.pending_preauth_count > 0 && <span style={badge('#E08900')}>{p.pending_preauth_count} pre-auth</span>}
                      {p.open_conversation_count > 0 && <span style={badge('#2D6BE4')}>{p.open_conversation_count} msg</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 12, color: tokens.textSecondary }}>{filtered.length} de {patients.length} pacientes</div>
    </div>
  );
}

// ── Expediente ambulatorio ───────────────────────────────────────────────────

type PatientDetailTab = 'resumen' | 'citas' | 'preauth' | 'resultados' | 'conversaciones' | 'historial';

function ClinicPatientDetail({
  patientId, brand, tokens, onBack,
}: {
  patientId: string;
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onBack: () => void;
}) {
  const [summary, setSummary] = useState<ClinicPatientSummary | null>(null);
  const [appointments, setAppointments] = useState<ServiceAppointment[]>([]);
  const [prauths, setPreauths] = useState<PreAuthRequest[]>([]);
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [conversations, setConversations] = useState<ClinicConversation[]>([]);
  const [timeline, setTimeline] = useState<ClinicPatientTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PatientDetailTab>('resumen');

  useEffect(() => {
    setLoading(true);
    setSummary(null);
    setTimeline([]);
    setTab('resumen');
    Promise.all([
      getClinicPatientSummary(patientId),
      listClinicPatientAppointments(patientId),
      listClinicPatientPreAuthRequests(patientId),
      listClinicPatientResults(patientId),
      listClinicPatientConversations(patientId),
    ]).then(([s, appts, pa, res, convs]) => {
      setSummary(s);
      setAppointments(appts);
      setPreauths(pa);
      setResults(res);
      setConversations(convs);
      setLoading(false);
    });
  }, [patientId]);

  useEffect(() => {
    if (tab !== 'historial') return;
    setLoadingTimeline(true);
    listClinicPatientTimeline(patientId).then(t => {
      setTimeline(t);
      setLoadingTimeline(false);
    });
  }, [tab, patientId]);

  if (loading || !summary) {
    return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: tokens.textSecondary }}>Cargando expediente ambulatorio…</div>;
  }

  const { patient: p } = summary;

  const PREAUTH_LABEL_LOCAL: Record<string, string> = { not_required: 'No requerida', pending: 'Pendiente', in_review: 'En revisión', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida' };
  const PREAUTH_COLOR_LOCAL: Record<string, string> = { not_required: '#8E8E93', pending: '#E08900', in_review: '#2D6BE4', approved: '#10897B', rejected: '#D93A3A', expired: '#8E8E93' };
  const APPT_STATUS_LABEL_LOCAL: Record<string, string> = { scheduled: 'Programada', checked_in: 'Check-in', in_progress: 'En progreso', completed: 'Completada', cancelled: 'Cancelada', escalated: 'Escalada', no_show: 'No se presentó' };
  const APPT_STATUS_COLOR_LOCAL: Record<string, string> = { scheduled: '#8E8E93', checked_in: '#2D6BE4', in_progress: '#E08900', completed: '#10897B', cancelled: '#8E8E93', escalated: '#D93A3A', no_show: '#8E8E93' };
  const CONV_STATUS_LABEL_LOCAL: Record<string, string> = { bot: 'Bot Concierge', waiting_human: 'Espera humano', in_progress: 'En atención', resolved: 'Resuelta', escalated: 'Escalada' };
  const CONV_STATUS_COLOR_LOCAL: Record<string, string> = { bot: '#8E8E93', waiting_human: '#D93A3A', in_progress: '#E08900', resolved: '#10897B', escalated: '#D93A3A' };
  const INTENT_LABEL_LOCAL: Record<string, string> = { appointment: 'Cita', preauth: 'Pre-autorización', result: 'Resultado', follow_up: 'Seguimiento', escalation: 'Escalamiento', general: 'General' };

  const summaryCards = [
    { label: summary.is_recurrent ? 'Paciente recurrente' : 'Primera visita', value: `${summary.visits_total} cita${summary.visits_total !== 1 ? 's' : ''}`, color: summary.is_recurrent ? brand : '#8E8E93' as string },
    { label: 'Última visita', value: summary.last_visit ? fmtDate(summary.last_visit.scheduled_at) : '—', color: summary.last_visit ? tokens.text : '#8E8E93' as string },
    { label: 'Próxima cita', value: summary.next_visit ? fmtDate(summary.next_visit.scheduled_at) : '—', color: summary.next_visit ? '#2D6BE4' : '#8E8E93' as string },
    { label: 'Estado de tratamiento', value: TREATMENT_STATUS_LABEL[summary.current_status], color: TREATMENT_STATUS_COLOR[summary.current_status] },
    { label: 'Pre-auth pendiente', value: summary.pending_preauth.length > 0 ? `${summary.pending_preauth.length} solicitud${summary.pending_preauth.length !== 1 ? 'es' : ''}` : 'Al día', color: summary.pending_preauth.length > 0 ? '#D93A3A' : '#10897B' as string },
    { label: 'Resultado crítico', value: summary.critical_results.length > 0 ? `${summary.critical_results.length} sin revisar` : 'Ninguno', color: summary.critical_results.length > 0 ? '#D93A3A' : '#8E8E93' as string },
  ];

  const tabs: Array<{ id: PatientDetailTab; label: string; n?: number }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'citas', label: 'Citas', n: appointments.length || undefined },
    { id: 'preauth', label: 'Pre-autorización', n: summary.pending_preauth.length || undefined },
    { id: 'resultados', label: 'Resultados', n: summary.critical_results.length || undefined },
    { id: 'conversaciones', label: 'Conversaciones', n: summary.open_conversations.length || undefined },
    { id: 'historial', label: 'Historial' },
  ];

  const TIMELINE_SEV_COLOR: Record<string, string> = { critical: '#D93A3A', warning: '#E08900', success: '#10897B', info: '#2D6BE4', neutral: '#8E8E93' };
  const TIMELINE_TYPE_ICO: Record<string, React.ReactNode> = { appointment: Ico.clock, preauth: Ico.signature, result: Ico.file, conversation: Ico.msg, resource: Ico.grid, audit: Ico.history };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div onClick={onBack} style={{ fontSize: 12, color: brand, cursor: 'pointer', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', width: 14, height: 14 }}>{Ico.chevL}</span>Pacientes
      </div>

      {/* Header */}
      <div style={{ background: brand, color: '#fff', borderRadius: 12, padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 22, lineHeight: 1.1 }}>{p.full_name}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 5, display: 'flex', gap: 14, flexWrap: 'wrap' as const }}>
            {p.phone && <span>{p.phone}</span>}
            {p.email && <span>{p.email}</span>}
            {p.date_of_birth && <span>Nac: {fmtDate(p.date_of_birth)}</span>}
            {p.sex && p.sex !== 'unknown' && <span>Sexo: {p.sex}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {p.insurer && <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500 }}>{p.insurer}</span>}
            {p.policy_number && <span style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontFamily: 'Roboto Mono, monospace' }}>Póliza: {p.policy_number}</span>}
            {!p.active && <span style={{ background: 'rgba(217,58,58,0.5)', color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 11.5 }}>Inactivo</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', opacity: 0.75 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>ID Paciente</div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11.5 }}>{p.id}</div>
          {p.external_patient_ref && <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10.5, marginTop: 2, opacity: 0.7 }}>Ref: {p.external_patient_ref}</div>}
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {summaryCards.map(sc => (
          <div key={sc.label} style={statCard(tokens, brand)}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 15, color: sc.color, lineHeight: 1.2 }}>{sc.value}</div>
            <div style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.3, marginTop: 2 }}>{sc.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${tokens.border}` }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 16px', cursor: 'pointer', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tab === t.id ? brand : tokens.textSecondary, borderBottom: tab === t.id ? `2px solid ${brand}` : '2px solid transparent', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const }}>
            {t.label}
            {t.n != null && t.n > 0 && <span style={{ background: '#D93A3A', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 999, fontWeight: 500 }}>{t.n}</span>}
          </div>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {summary.current_appointment && (
            <div style={{ background: brand + '0F', border: `1px solid ${brand}30`, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: brand, marginBottom: 8 }}>Cita en curso</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 11, color: tokens.textSecondary }}>Servicio</div><div style={{ fontSize: 13, color: tokens.text, marginTop: 2 }}>{summary.current_appointment.service_name ?? '—'}</div></div>
                <div><div style={{ fontSize: 11, color: tokens.textSecondary }}>Estado</div><div style={{ marginTop: 2 }}><span style={badge(APPT_STATUS_COLOR_LOCAL[summary.current_appointment.status] ?? '#8E8E93')}>{APPT_STATUS_LABEL_LOCAL[summary.current_appointment.status]}</span></div></div>
                <div><div style={{ fontSize: 11, color: tokens.textSecondary }}>Horario</div><div style={{ fontSize: 12.5, color: tokens.text, marginTop: 2, fontFamily: 'Roboto Mono, monospace' }}>{fmtDate(summary.current_appointment.scheduled_at)} {fmtTime(summary.current_appointment.scheduled_at)}</div></div>
              </div>
            </div>
          )}
          {summary.critical_results.length > 0 && (
            <div style={{ background: 'rgba(217,58,58,0.07)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: '#D93A3A', marginBottom: 6 }}>Resultados críticos sin revisar ({summary.critical_results.length})</div>
              {summary.critical_results.map(r => (
                <div key={r.id} style={{ fontSize: 12.5, color: tokens.text, marginBottom: 4 }}>
                  {r.result_type === 'lab' ? 'Laboratorio' : r.result_type === 'imaging' ? 'Imagen' : 'Nota de procedimiento'} · {fmtDate(r.created_at)}
                  {!r.notified_at && <span style={{ ...badge('#D93A3A'), marginLeft: 8 }}>Sin notificar</span>}
                </div>
              ))}
            </div>
          )}
          {summary.pending_preauth.length > 0 && (
            <div style={{ background: 'rgba(224,137,0,0.07)', border: '1px solid rgba(224,137,0,0.3)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: '#E08900', marginBottom: 6 }}>Pre-autorización pendiente ({summary.pending_preauth.length})</div>
              {summary.pending_preauth.map(pa => (
                <div key={pa.id} style={{ fontSize: 12.5, color: tokens.text, marginBottom: 4 }}>
                  {pa.insurer} · {pa.service_name ?? '—'} · <span style={badge(PREAUTH_COLOR_LOCAL[pa.status] ?? '#8E8E93')}>{PREAUTH_LABEL_LOCAL[pa.status]}</span>
                </div>
              ))}
            </div>
          )}
          {summary.active_assignments.length > 0 && (
            <div style={card(tokens)}>
              <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text, marginBottom: 8 }}>Recursos activos asignados</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {summary.active_assignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: brand + '0F', border: `1px solid ${brand}30`, borderRadius: 8, padding: '8px 12px' }}>
                    <div>
                      <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12.5, color: tokens.text }}>{a.resource_name ?? a.resource_short_code ?? '—'}</div>
                      <div style={{ fontSize: 11, color: tokens.textSecondary }}>{a.service_name ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.notes && (
            <div style={card(tokens)}>
              <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginBottom: 6 }}>Notas del paciente</div>
              <div style={{ fontSize: 13, color: tokens.text, lineHeight: 1.5 }}>{p.notes}</div>
            </div>
          )}
          {!summary.current_appointment && summary.critical_results.length === 0 && summary.pending_preauth.length === 0 && summary.active_assignments.length === 0 && !p.notes && (
            <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: tokens.textSecondary }}>Sin alertas activas</div>
          )}
        </div>
      )}

      {/* CITAS */}
      {tab === 'citas' && (
        <div style={card(tokens)}>
          {appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin citas registradas</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                  {['Fecha / Hora', 'Servicio', 'Aseguradora', 'Pre-auth', 'Estado'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((a, i) => (
                  <tr key={a.id}
                    style={{ borderBottom: i < appointments.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={{ padding: '10px 10px', fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: tokens.textSecondary, whiteSpace: 'nowrap' as const }}>{fmtDate(a.scheduled_at)}<br />{fmtTime(a.scheduled_at)}</td>
                    <td style={{ padding: '10px 10px', color: tokens.text }}>{a.service_name ?? '—'}</td>
                    <td style={{ padding: '10px 10px', color: tokens.textSecondary, fontSize: 12.5 }}>{a.insurer || '—'}</td>
                    <td style={{ padding: '10px 10px' }}><span style={badge(PREAUTH_COLOR_LOCAL[a.pre_auth_status] ?? '#8E8E93')}>{PREAUTH_LABEL_LOCAL[a.pre_auth_status]}</span></td>
                    <td style={{ padding: '10px 10px' }}><span style={badge(APPT_STATUS_COLOR_LOCAL[a.status] ?? '#8E8E93')}>{APPT_STATUS_LABEL_LOCAL[a.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PRE-AUTH */}
      {tab === 'preauth' && (
        <div style={card(tokens)}>
          {prauths.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin solicitudes de pre-autorización</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {prauths.map((r, i) => (
                <div key={r.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 150px', gap: 12, alignItems: 'center', padding: '12px 10px', borderRadius: 8, borderBottom: i < prauths.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div>
                    <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{r.insurer}</div>
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{r.service_name ?? '—'}</div>
                    {r.folio_aseguradora && <div style={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', color: tokens.textSecondary, marginTop: 1 }}>Folio: {r.folio_aseguradora}</div>}
                  </div>
                  <div style={{ fontSize: 11.5, color: tokens.textSecondary }}>{r.submitted_at ? fmtDate(r.submitted_at) : '—'}</div>
                  <span style={badge(PREAUTH_COLOR_LOCAL[r.status] ?? '#8E8E93')}>{PREAUTH_LABEL_LOCAL[r.status] ?? r.status}</span>
                  <div style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmtDate(r.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RESULTADOS */}
      {tab === 'resultados' && (
        <div style={card(tokens)}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin resultados registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {results.map((r, i) => (
                <div key={r.id}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 10px', borderRadius: 8, borderBottom: i < results.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <span style={{ color: r.critical ? '#D93A3A' : brand, display: 'inline-flex', width: 18, height: 18 }}>{Ico.file}</span>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.text }}>
                      {r.result_type === 'lab' ? 'Laboratorio' : r.result_type === 'imaging' ? 'Imagen' : 'Nota de procedimiento'}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 1 }}>{fmtDate(r.created_at)}</div>
                  </div>
                  {r.critical && <span style={badge('#D93A3A')}>Crítico</span>}
                  {r.notified_at ? <span style={badge('#10897B')}>Notificado</span> : <span style={badge('#E08900')}>Sin notificar</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONVERSACIONES */}
      {tab === 'conversaciones' && (
        <div style={card(tokens)}>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin conversaciones registradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {conversations.map((c, i) => (
                <div key={c.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '11px 10px', borderRadius: 8, borderBottom: i < conversations.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div>
                    <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{INTENT_LABEL_LOCAL[c.intent ?? ''] ?? 'General'}</div>
                    <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{c.channel} · {c.last_message_preview ?? '—'}</div>
                  </div>
                  <span style={badge(CONV_STATUS_COLOR_LOCAL[c.status] ?? '#8E8E93')}>{CONV_STATUS_LABEL_LOCAL[c.status]}</span>
                  {c.unread_count > 0 && <span style={badge('#D93A3A')}>{c.unread_count} sin leer</span>}
                  <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace' }}>{fmtTime(c.last_message_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL / TIMELINE */}
      {tab === 'historial' && (
        <div>
          {loadingTimeline && <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Cargando historial…</div>}
          {!loadingTimeline && timeline.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin eventos en el historial</div>}
          {!loadingTimeline && timeline.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {timeline.map((event, i) => {
                const sevColor = TIMELINE_SEV_COLOR[event.severity ?? 'neutral'] ?? '#8E8E93';
                const ico = TIMELINE_TYPE_ICO[event.type] ?? Ico.history;
                return (
                  <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, paddingBottom: i < timeline.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 999, background: sevColor + '18', border: `1.5px solid ${sevColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: sevColor, display: 'inline-flex', width: 13, height: 13 }}>{ico}</span>
                      </div>
                      {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: tokens.borderLight, marginTop: 4 }} />}
                    </div>
                    <div style={{ paddingTop: 4, paddingBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const }}>
                        <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{event.title}</div>
                        {event.severity && event.severity !== 'neutral' && <span style={badge(sevColor)}>{event.severity === 'critical' ? 'Crítico' : event.severity === 'warning' ? 'Alerta' : event.severity === 'success' ? 'OK' : 'Info'}</span>}
                      </div>
                      {event.description && <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 2 }}>{event.description}</div>}
                      <div style={{ fontSize: 11, color: tokens.textTertiary, fontFamily: 'Roboto Mono, monospace', marginTop: 4 }}>{fmtDate(event.occurred_at)} {fmtTime(event.occurred_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Clinic Profile Modal ─────────────────────────────────────────────────────

type ClinicProfileTab = 'perfil' | 'apariencia' | 'seguridad' | 'cuenta';

function Toggle({ checked, onChange, brand }: { checked: boolean; onChange: (v: boolean) => void; brand: string }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 99, background: checked ? brand : '#D1D1D6', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
    </div>
  );
}

function ClinicProfileModal({ staff, brand, brandColor, onClose, onBrandChange }: {
  staff: ClinicStaff;
  brand: string;
  brandColor: string;
  onClose: () => void;
  onBrandChange: (color: string) => void;
}) {
  const { tokens, isDark, toggleDark } = useTheme();
  const [tab, setTab] = useState<ClinicProfileTab>('perfil');
  const [email, setEmail] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);

  async function handlePwSubmit() {
    setPwMsg('');
    if (pwNew.length < 6) { setPwMsg('Mínimo 6 caracteres.'); return; }
    if (pwNew !== pwConfirm) { setPwMsg('Las contraseñas no coinciden.'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwLoading(false);
    if (error) { setPwMsg('Error: ' + error.message); }
    else { setPwSuccess(true); setPwMsg('¡Contraseña actualizada!'); setPwNew(''); setPwConfirm(''); }
  }

  const TABS: { id: ClinicProfileTab; label: string; ico: React.ReactNode }[] = [
    { id: 'perfil',     label: 'Mi perfil',  ico: Ico.user },
    { id: 'apariencia', label: 'Apariencia', ico: Ico.image },
    { id: 'seguridad',  label: 'Seguridad',  ico: Ico.shield },
    { id: 'cuenta',     label: 'Cuenta',     ico: Ico.file },
  ];

  const inputSt: React.CSSProperties = {
    border: `1px solid ${tokens.border}`, borderRadius: 8, padding: '8px 12px',
    fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none',
    boxSizing: 'border-box', background: tokens.surfaceAlt, color: tokens.text,
  };

  function ST({ c }: { c: string }) {
    return <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, color: tokens.text, marginBottom: 10, marginTop: 20 }}>{c}</div>;
  }
  function PR({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'start', padding: '8px 0', borderBottom: `1px solid ${tokens.borderLight}` }}>
        <span style={{ fontSize: 12, color: tokens.textSecondary, paddingTop: 1 }}>{label}</span>
        <span style={{ fontSize: 13, color: tokens.text, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500 }}>{value}</span>
      </div>
    );
  }

  const initials = staff.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, maxHeight: '88vh', background: tokens.surface, borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${tokens.border}` }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 16, color: tokens.text }}>Perfil y ajustes</div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: tokens.surfaceAlt, color: tokens.textTertiary }}>{Ico.x}</div>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 140, borderRight: `1px solid ${tokens.borderLight}`, padding: '10px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(t => (
              <div key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: tab === t.id ? brand + '15' : 'transparent', color: tab === t.id ? brand : tokens.textTertiary, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontSize: 13, fontWeight: 500, transition: 'background 0.12s, color 0.12s' }}>
                <span style={{ display: 'inline-flex', width: 15, height: 15, flexShrink: 0 }}>{t.ico}</span>{t.label}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 22px 22px' }}>

            {tab === 'perfil' && (<>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20, borderBottom: `1px solid ${tokens.borderLight}` }}>
                <div style={{ width: 72, height: 72, borderRadius: 999, background: `linear-gradient(135deg,${brand} 0%,#274B96 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 26, marginBottom: 12 }}>{initials}</div>
                <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 18, lineHeight: 1.2, color: tokens.text }}>{staff.name}</div>
                <div style={{ display: 'inline-block', marginTop: 6, background: brand + '18', color: brand, fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, padding: '3px 10px', borderRadius: 99, textTransform: 'capitalize' }}>{staff.role}</div>
              </div>
              <ST c="Datos del staff" />
              <PR label="Nombre" value={staff.name} />
              <PR label="Correo" value={email || '—'} />
              <PR label="Rol" value={staff.role} />
              <PR label="Clínica" value={staff.clinic.name} />
              <PR label="Ubicación" value={staff.clinic.location || '—'} />
              <PR label="Tipo" value={staff.clinic.type === 'organic' ? 'Orgánica (hub)' : 'Spoke'} />
            </>)}

            {tab === 'apariencia' && (<>
              <ST c="Color de acento" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 6 }}>
                {BRAND_PRESETS.map(p => {
                  const sw = isDark ? p.dark : p.color;
                  return (
                    <div key={p.color} onClick={() => onBrandChange(p.color)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 99, background: sw, boxShadow: brandColor === p.color ? `0 0 0 2px ${tokens.surface},0 0 0 4px ${sw}` : '0 1px 3px rgba(0,0,0,0.2)', transition: 'box-shadow 0.15s' }} />
                      <span style={{ fontSize: 10.5, color: tokens.textTertiary }}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
              <ST c="Modo oscuro" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>Modo oscuro</div>
                  <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>{isDark ? 'Activo — paleta oscura' : 'Inactivo — tema claro'}</div>
                </div>
                <Toggle checked={isDark} onChange={v => toggleDark(v)} brand={brand} />
              </div>
            </>)}

            {tab === 'seguridad' && (<>
              <ST c="Cambiar contraseña" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 5 }}>Nueva contraseña</div><input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputSt} /></div>
                <div><div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 5 }}>Confirmar contraseña</div><input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Repite la contraseña" style={inputSt} onKeyDown={e => e.key === 'Enter' && handlePwSubmit()} /></div>
                {pwMsg && <div style={{ padding: '8px 12px', borderRadius: 8, background: pwSuccess ? '#E4F3F1' : '#FDECEC', color: pwSuccess ? '#10897B' : '#D93A3A', fontSize: 12.5 }}>{pwMsg}</div>}
                <button onClick={handlePwSubmit} disabled={pwLoading}
                  style={{ background: pwLoading ? '#ccc' : brand, color: '#fff', border: 0, padding: '9px 0', borderRadius: 8, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13.5, cursor: pwLoading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                  {pwLoading ? 'Actualizando…' : 'Actualizar contraseña'}
                </button>
              </div>
            </>)}

            {tab === 'cuenta' && (<>
              <ST c="Cuenta" />
              {([['Titular', staff.name], ['Rol', staff.role], ['Clínica', staff.clinic.name]] as [string,string][]).map(([l, v]) => <PR key={l} label={l} value={v} />)}
              <ST c="Servicios conectados" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: 'Base de datos', detail: 'Supabase PostgreSQL', active: true },
                  { name: 'Almacenamiento', detail: 'Supabase Storage', active: true },
                  { name: 'WhatsApp Business API', detail: 'Canal de pacientes', active: false },
                  { name: 'Bot Concierge', detail: 'Agendamiento automático', active: false },
                ].map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: tokens.surfaceAlt, borderRadius: 10 }}>
                    <div><div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{s.name}</div><div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>{s.detail}</div></div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: s.active ? '#E4F3F1' : tokens.surfaceAlt, color: s.active ? '#10897B' : tokens.textSecondary, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, border: s.active ? 'none' : `1px solid ${tokens.border}` }}>{s.active ? 'Activo' : 'Pendiente'}</span>
                  </div>
                ))}
              </div>
              <ST c="Información" />
              <PR label="Versión" value="1.0.0-beta" />
              <PR label="Entorno" value="Producción" />
              <button onClick={() => supabase.auth.signOut()}
                style={{ marginTop: 24, width: '100%', background: 'transparent', color: '#D93A3A', border: '1px solid #D93A3A', padding: '8px 0', borderRadius: 8, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                Cerrar sesión
              </button>
            </>)}

          </div>
        </div>
      </div>
    </>
  );
}

// ── Shell principal ──────────────────────────────────────────────────────────

type ClinicScreen = 'panel' | 'agenda' | 'preauth' | 'bandeja' | 'infraestructura' | 'resultados' | 'aseguradoras' | 'rendimiento' | 'pacientes';

export function ClinicDesktop() {
  const { tokens, isDark } = useTheme();

  const [prefs, setPrefs] = useState<{ brandColor: string }>(() => {
    try { const s = localStorage.getItem('clinic_prefs'); return s ? JSON.parse(s) : { brandColor: '#671E75' }; }
    catch { return { brandColor: '#671E75' }; }
  });
  const baseColor = prefs.brandColor || '#671E75';
  const brand = isDark ? (BRAND_PRESETS.find(p => p.color === baseColor)?.dark ?? baseColor) : baseColor;

  function handleBrandChange(color: string) {
    const next = { ...prefs, brandColor: color };
    setPrefs(next);
    localStorage.setItem('clinic_prefs', JSON.stringify(next));
  }

  const [showProfile, setShowProfile] = useState(false);
  const [screen, setScreen] = useState<ClinicScreen>('panel');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  function goPatient(patientId: string) {
    setSelectedPatientId(patientId);
    setScreen('pacientes');
  }

  const [staff, setStaff] = useState<ClinicStaff | null>(null);
  const [todayAppts, setTodayAppts] = useState<ServiceAppointment[]>([]);
  const [allAppts, setAllAppts] = useState<ServiceAppointment[]>([]);
  const [preauth, setPreauth] = useState<PreAuthRequest[]>([]);
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [escalations, setEscalations] = useState<ClinicalEscalation[]>([]);
  const [conversations, setConversations] = useState<ClinicConversation[]>([]);
  const [resources, setResources] = useState<ClinicResource[]>([]);
  const [assignments, setAssignments] = useState<ClinicResourceAssignment[]>([]);
  const [allServices, setAllServices] = useState<ClinicService[]>([]);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  function goAgenda(status: AppointmentStatus | 'all' = 'all') {
    setAgendaStatusFilter(status);
    setSelectedPatientId(null);
    setScreen('agenda');
  }

  useEffect(() => {
    let activeClinicId: string | null = null;

    async function load() {
      const s = await getCurrentClinicStaff();
      setStaff(s);
      if (!s) { setLoading(false); return; }

      const clinicId = s.clinic_id;
      activeClinicId = clinicId;
      const [today, all, pa, res, esc, conv, rsc, asg, svcs] = await Promise.all([
        listTodayAppointments(clinicId),
        listAllAppointments(clinicId),
        listPreAuthRequests(clinicId),
        listServiceResults(clinicId),
        listActiveEscalations(clinicId),
        listConversations(clinicId),
        listResources(clinicId),
        listActiveAssignments(clinicId),
        listClinicServices(clinicId),
      ]);
      setTodayAppts(today);
      setAllAppts(all);
      setPreauth(pa);
      setResults(res);
      setEscalations(esc);
      setConversations(conv);
      setResources(rsc);
      setAssignments(asg);
      setAllServices(svcs);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel('clinic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_appointments' }, () => {
        if (activeClinicId) {
          listTodayAppointments(activeClinicId).then(setTodayAppts);
          listAllAppointments(activeClinicId).then(setAllAppts);
          listActiveAssignments(activeClinicId).then(setAssignments);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_resource_assignments' }, () => {
        if (activeClinicId) listActiveAssignments(activeClinicId).then(setAssignments);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_auth_requests' }, () => {
        if (activeClinicId) listPreAuthRequests(activeClinicId).then(setPreauth);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_results' }, () => {
        if (activeClinicId) listServiceResults(activeClinicId).then(setResults);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinical_escalations' }, () => {
        if (activeClinicId) listActiveEscalations(activeClinicId).then(setEscalations);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_conversations' }, () => {
        if (activeClinicId) listConversations(activeClinicId).then(setConversations);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!staff?.clinic_id) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const refreshDailyAgenda = async () => {
      const clinicId = staff.clinic_id;
      const [today, all, pa, asg] = await Promise.all([
        listTodayAppointments(clinicId),
        listAllAppointments(clinicId),
        listPreAuthRequests(clinicId),
        listActiveAssignments(clinicId),
      ]);
      if (cancelled) return;
      setTodayAppts(today);
      setAllAppts(all);
      setPreauth(pa);
      setAssignments(asg);
    };

    const scheduleNextLocalDayRefresh = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      const delay = Math.max(nextDay.getTime() - now.getTime(), 1000);
      timeoutId = setTimeout(async () => {
        await refreshDailyAgenda();
        if (!cancelled) scheduleNextLocalDayRefresh();
      }, delay);
    };

    scheduleNextLocalDayRefresh();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [staff?.clinic_id]);

  async function handleAppointmentStatusChange(id: string, status: AppointmentStatus): Promise<boolean> {
    const ok = await updateAppointmentStatus(id, status);
    if (staff?.clinic_id) {
      listTodayAppointments(staff.clinic_id).then(setTodayAppts);
      listAllAppointments(staff.clinic_id).then(setAllAppts);
    }
    return ok;
  }

  async function handleNewAppointmentCreated() {
    if (!staff?.clinic_id) return;
    const clinicId = staff.clinic_id;
    await Promise.all([
      listTodayAppointments(clinicId).then(setTodayAppts),
      listAllAppointments(clinicId).then(setAllAppts),
      listPreAuthRequests(clinicId).then(setPreauth),
    ]);
  }

  async function handleFreeResource(assignmentId: string) {
    const ok = await freeResource(assignmentId);
    if (ok && staff?.clinic_id) listActiveAssignments(staff.clinic_id).then(setAssignments);
  }

  async function handleMoveResource(assignment: ClinicResourceAssignment, resource: ClinicResource) {
    if (!staff?.clinic_id || assignment.resource_type !== resource.resource_type) return;
    const freed = await freeResource(assignment.id);
    if (!freed) return;
    const assigned = await manualAssignResource(
      resource.id,
      assignment.appointment_id,
      assignment.clinic_id,
      assignment.patient_id,
      90,
    );
    if (assigned) {
      await Promise.all([
        listActiveAssignments(staff.clinic_id).then(setAssignments),
        listTodayAppointments(staff.clinic_id).then(setTodayAppts),
        listAllAppointments(staff.clinic_id).then(setAllAppts),
      ]);
    }
  }

  async function handleCompleteResource(assignment: ClinicResourceAssignment) {
    if (!staff?.clinic_id) return;
    const freed = await freeResource(assignment.id);
    if (!freed) return;
    await updateAppointmentStatus(assignment.appointment_id, 'completed');
    await Promise.all([
      listActiveAssignments(staff.clinic_id).then(setAssignments),
      listTodayAppointments(staff.clinic_id).then(setTodayAppts),
      listAllAppointments(staff.clinic_id).then(setAllAppts),
    ]);
  }

  async function handlePreAuthStatusChange(id: string, status: PreAuthRequest['status']) {
    const ok = await updatePreAuthStatus(id, status);
    if (ok && staff?.clinic_id) listPreAuthRequests(staff.clinic_id).then(setPreauth);
  }

  const pendingPreauth = preauth.filter(p => p.status === 'pending' || p.status === 'in_review').length;
  const criticalResults = results.filter(r => r.critical && !r.notified_at).length;
  const waitingHuman = conversations.filter(c => c.status === 'waiting_human').length;

  const occupiedResources = assignments.length;
  const totalResources = resources.length;

  const navItems: Array<{ id: ClinicScreen; label: string; ico: React.ReactNode; n?: number; sev?: string }> = [
    { id: 'panel', label: 'Panel del día', ico: Ico.home },
    { id: 'pacientes', label: 'Pacientes', ico: Ico.users },
    { id: 'agenda', label: 'Agenda', ico: Ico.clock, n: todayAppts.filter(a => a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'no_show').length || undefined },
    { id: 'preauth', label: 'Pre-autorización', ico: Ico.signature, n: pendingPreauth || undefined, sev: 'amber' },
    { id: 'bandeja', label: 'Bandeja', ico: Ico.whatsapp, n: waitingHuman || undefined, sev: 'red' },
    { id: 'infraestructura', label: 'Infraestructura', ico: Ico.grid, n: totalResources > 0 ? occupiedResources : undefined },
    { id: 'resultados', label: 'Resultados', ico: Ico.file, n: criticalResults || undefined, sev: 'red' },
    { id: 'aseguradoras', label: 'Aseguradoras', ico: Ico.shield },
    { id: 'rendimiento', label: 'Rendimiento', ico: Ico.chart },
  ];

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.bg, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', color: tokens.textSecondary, fontSize: 14 }}>
        Sincronizando clínica ambulatoria…
      </div>
    );
  }

  if (!staff) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.bg, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', color: tokens.textSecondary, fontSize: 14 }}>
        Usuario sin clínica asignada. Contacta al administrador.
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '220px 1fr',
      background: tokens.bg, color: tokens.text,
      fontFamily: "'Franklin Gothic Book','Libre Franklin',-apple-system,system-ui,sans-serif",
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <aside style={{ background: tokens.surface, borderRight: `1px solid ${tokens.border}`, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px 14px', borderBottom: `1px solid ${tokens.borderLight}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: tokens.surface, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 1px ${tokens.border}` }}>
            <img src="/reach2030-logo.png" alt="REACH 2030" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 15, lineHeight: 1, color: tokens.text }}>Muguerza <span style={{ color: brand }}>Connect</span></div>
            <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' }}>Clínica Ambulatoria</div>
          </div>
        </div>

        {/* Clinic name chip */}
        <div style={{ margin: '10px 12px', padding: '8px 12px', background: brandSoft(isDark), borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: brand, lineHeight: 1.1 }}>{staff.clinic.name}</div>
          <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2 }}>{staff.clinic.location} · {staff.clinic.type === 'organic' ? 'Orgánica' : 'Spoke'}</div>
        </div>

        {navItems.map(item => {
          const active = screen === item.id;
          return (
            <div key={item.id} onClick={() => { setScreen(item.id); if (item.id !== 'pacientes') setSelectedPatientId(null); }}
              onMouseEnter={() => setHoveredNav(item.id)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
                margin: '2px 10px', padding: '9px 12px', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                background: active ? brand + '15' : hoveredNav === item.id ? brand + '0D' : 'transparent',
                color: active ? brand : hoveredNav === item.id ? brand : tokens.textTertiary,
                fontFamily: active ? "'Franklin Gothic','Libre Franklin'" : "'Franklin Gothic Book'",
                fontWeight: 500, fontSize: 13.5,
                transition: 'background 0.15s, color 0.15s',
              }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18 }}>{item.ico}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.n != null && (
                <span style={{ background: item.sev === 'red' ? '#D93A3A' : item.sev === 'amber' ? '#E08900' : tokens.surfaceAlt, color: item.sev ? '#fff' : tokens.textSecondary, fontSize: 10, padding: '1px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center', fontWeight: 500 }}>{item.n}</span>
              )}
            </div>
          );
        })}

        <div onClick={() => setShowProfile(true)}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = brand + '0D'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          style={{ marginTop: 'auto', padding: '12px 16px', borderTop: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg,${brand} 0%, #274B96 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12 }}>
            {staff.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: tokens.text }}>{staff.name}</div>
            <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2, textTransform: 'capitalize' }}>{staff.role}</div>
          </div>
          <span style={{ display: 'inline-flex', width: 14, height: 14, color: tokens.textTertiary, flexShrink: 0 }}>{Ico.settings}</span>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ background: tokens.surface, borderBottom: `1px solid ${tokens.border}`, padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 14, color: tokens.text }}>
              {screen === 'pacientes' && selectedPatientId
                ? <><span onClick={() => setSelectedPatientId(null)} style={{ cursor: 'pointer', color: brand }}>Pacientes</span><span style={{ color: tokens.textSecondary }}> / Expediente</span></>
                : navItems.find(n => n.id === screen)?.label}
            </div>
            <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 1 }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          {escalations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(217,58,58,0.1)', border: '1px solid rgba(217,58,58,0.3)', borderRadius: 8, cursor: 'pointer' }}
              onClick={() => setScreen('panel')}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#D93A3A', display: 'block', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12.5, color: '#D93A3A' }}>
                {escalations.length} escalamiento{escalations.length !== 1 ? 's' : ''} activo{escalations.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {screen === 'panel' && (
            <PanelHoy
              todayAppts={todayAppts}
              escalations={escalations}
              preauth={preauth}
              resources={resources}
              assignments={assignments}
              brand={brand}
              tokens={tokens}
              goAppt={(id) => { setSelectedApptId(id); setScreen('agenda'); }}
              goAgenda={goAgenda}
              goPreauth={() => setScreen('preauth')}
              goInfra={() => setScreen('infraestructura')}
            />
          )}
          {screen === 'pacientes' && (
            selectedPatientId
              ? <ClinicPatientDetail patientId={selectedPatientId} brand={brand} tokens={tokens} onBack={() => setSelectedPatientId(null)} />
              : <ClinicPatientList clinicId={staff.clinic_id} brand={brand} tokens={tokens} onOpenPatient={pid => setSelectedPatientId(pid)} />
          )}
          {screen === 'agenda' && (
            <Agenda
              appointments={todayAppts}
              assignments={assignments}
              brand={brand}
              tokens={tokens}
              onStatusChange={handleAppointmentStatusChange}
              onNewAppt={() => setShowNewAppt(true)}
              goPatient={goPatient}
              initialStatusFilter={agendaStatusFilter}
            />
          )}
          {screen === 'preauth' && (
            <PreAuth
              requests={preauth}
              brand={brand}
              tokens={tokens}
              onStatusChange={handlePreAuthStatusChange}
              goPatient={goPatient}
            />
          )}
          {screen === 'bandeja' && <Bandeja clinicId={staff.clinic_id} staffId={staff.id} brand={brand} tokens={tokens} goPatient={goPatient} />}
          {screen === 'infraestructura' && (
            <Infraestructura
              resources={resources}
              assignments={assignments}
              brand={brand}
              tokens={tokens}
              onMove={handleMoveResource}
              onComplete={handleCompleteResource}
            />
          )}
          {screen === 'resultados' && (
            <Resultados results={results} brand={brand} tokens={tokens} goPatient={goPatient} />
          )}
          {screen === 'aseguradoras' && (
            <Aseguradoras appointments={allAppts} preauth={preauth} brand={brand} tokens={tokens} />
          )}
          {screen === 'rendimiento' && (
            <Rendimiento clinicId={staff.clinic_id} appointments={allAppts} brand={brand} tokens={tokens} goAgenda={goAgenda} goPreauth={() => setScreen('preauth')} />
          )}
        </div>
      </main>

      {showNewAppt && staff && (
        <NewClinicAppointmentModal
          clinicId={staff.clinic_id}
          services={allServices}
          brand={brand}
          tokens={tokens}
          onClose={() => setShowNewAppt(false)}
          onCreated={async () => { setShowNewAppt(false); await handleNewAppointmentCreated(); }}
        />
      )}

      {showProfile && staff && (
        <ClinicProfileModal
          staff={staff}
          brand={brand}
          brandColor={baseColor}
          onClose={() => setShowProfile(false)}
          onBrandChange={handleBrandChange}
        />
      )}
    </div>
  );
}
