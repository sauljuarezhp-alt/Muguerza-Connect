import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Ico } from '../data/icons';
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
  freeResource,
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
  todayAppts, escalations, preauth, resources, assignments, brand, tokens, goAppt, goInfra,
}: {
  todayAppts: ServiceAppointment[];
  escalations: ClinicalEscalation[];
  preauth: PreAuthRequest[];
  resources: ClinicResource[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  goAppt: (id: string) => void;
  goInfra: () => void;
}) {
  const completed = todayAppts.filter(a => a.status === 'completed').length;
  const inProgress = todayAppts.filter(a => a.status === 'in_progress').length;
  const checkedIn = todayAppts.filter(a => a.status === 'checked_in').length;
  const pendingAuth = preauth.filter(p => p.status === 'pending' || p.status === 'in_review').length;
  const occupancy = resources.length > 0 ? Math.round((assignments.length / resources.length) * 100) : 0;

  const stats = [
    { label: 'Citas hoy', value: todayAppts.length, color: brand },
    { label: 'En progreso', value: inProgress, color: '#E08900' },
    { label: 'Check-in', value: checkedIn, color: '#2D6BE4' },
    { label: 'Ocupación', value: `${occupancy}%`, color: occupancy >= 80 ? '#D93A3A' : occupancy >= 50 ? '#E08900' : '#10897B' },
    { label: 'Pre-auth pendiente', value: pendingAuth, color: '#D93A3A' },
    { label: 'Escalamientos activos', value: escalations.length, color: '#D93A3A' },
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
          <div key={s.label} style={statCard(tokens, brand)}>
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

// ── Agenda completa ─────────────────────────────────────────────────────────

function Agenda({
  appointments, assignments, brand, tokens, onStatusChange,
}: {
  appointments: ServiceAppointment[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}) {
  const assignmentByAppt = new Map(assignments.map(a => [a.appointment_id, a]));
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<string>('all');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterStatus === s ? brand : tokens.border}`, background: filterStatus === s ? brand + '15' : tokens.surface, color: filterStatus === s ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              {s === 'all' ? 'Todas' : APPT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${filterType === t ? brand : tokens.border}`, background: filterType === t ? brand + '15' : tokens.surface, color: filterType === t ? brand : tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              {t === 'all' ? 'Todos los servicios' : SERVICE_TYPE_LABEL[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      <div style={card(tokens)}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: tokens.textSecondary }}>Sin citas con los filtros seleccionados</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                {['Fecha / Hora', 'Paciente', 'Servicio', 'Recurso', 'Aseguradora', 'Pre-auth', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.textSecondary, letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const nextStatus = NEXT_STATUS[a.status];
                const assignment = assignmentByAppt.get(a.id);
                return (
                  <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}>
                    <td style={{ padding: '10px 10px', fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: tokens.textSecondary, whiteSpace: 'nowrap' as const }}>
                      {fmtDate(a.scheduled_at)}<br />{fmtTime(a.scheduled_at)}
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, color: tokens.text }}>{a.patient_id}</td>
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
                      <span style={badge(APPT_STATUS_COLOR[a.status])}>{APPT_STATUS_LABEL[a.status]}</span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {nextStatus && (
                        <button onClick={() => onStatusChange(a.id, nextStatus)}
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
  requests, brand, tokens, onStatusChange,
}: {
  requests: PreAuthRequest[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onStatusChange: (id: string, status: PreAuthRequest['status']) => void;
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
              {''}
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
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 160px auto', gap: 12, alignItems: 'center', padding: '12px 10px', borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none' }}>
                <div>
                  <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{r.patient_id}</div>
                  <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 2 }}>{r.service_name ?? '—'} · {r.insurer}</div>
                  {r.folio_aseguradora && <div style={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', color: tokens.textSecondary, marginTop: 1 }}>Folio: {r.folio_aseguradora}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: tokens.textSecondary }}>
                  {r.submitted_at ? fmtDate(r.submitted_at) : '—'}
                </div>
                <span style={badge(PREAUTH_COLOR[r.status] ?? '#8E8E93')}>{PREAUTH_LABEL[r.status] ?? r.status}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(r.status === 'pending' || r.status === 'in_review') && (
                    <>
                      <button onClick={() => onStatusChange(r.id, 'approved')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #10897B', background: 'transparent', color: '#10897B', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Aprobar
                      </button>
                      <button onClick={() => onStatusChange(r.id, 'rejected')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D93A3A', background: 'transparent', color: '#D93A3A', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                        Rechazar
                      </button>
                    </>
                  )}
                  {r.status === 'pending' && (
                    <button onClick={() => onStatusChange(r.id, 'in_review')}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid #2D6BE4`, background: 'transparent', color: '#2D6BE4', fontSize: 11.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                      En revisión
                    </button>
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
  results, brand, tokens,
}: {
  results: ServiceResult[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
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
                  <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{r.patient_id}</div>
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

// ── Rendimiento ──────────────────────────────────────────────────────────────

function Rendimiento({
  appointments, brand, tokens,
}: {
  appointments: ServiceAppointment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
}) {
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

  const kpis = [
    { label: 'Citas totales', value: total, color: brand },
    { label: 'Completadas', value: completed, color: '#10897B' },
    { label: 'Canceladas', value: cancelled, color: '#8E8E93' },
    { label: 'No se presentaron', value: noShow, color: '#8E8E93' },
    { label: 'Escalamientos', value: escalated, color: '#D93A3A' },
    { label: 'Tasa de completación', value: `${completionRate}%`, color: completionRate >= 80 ? '#10897B' : completionRate >= 60 ? '#E08900' : '#D93A3A' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={statCard(tokens, brand)}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 600, fontSize: 28, color: k.color, lineHeight: 1 }}>{k.value}</div>
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
                <div style={{ fontSize: 13, color: tokens.text }}>{SERVICE_TYPE_LABEL[type] ?? type}</div>
                <div style={{ background: tokens.borderLight, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: brand, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 12, color: tokens.textSecondary, fontFamily: 'Roboto Mono, monospace', textAlign: 'right' }}>{count}</div>
              </div>
            );
          })}
          {Object.keys(byType).length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: tokens.textSecondary }}>Sin datos de rendimiento</div>
          )}
        </div>
      </div>
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
  clinicId, staffId, brand, tokens,
}: {
  clinicId: string;
  staffId: string;
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
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
                  style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 10, padding: '11px 12px', borderBottom: i < filtered.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', cursor: 'pointer', background: active ? brand + '12' : tokens.surface, alignItems: 'center' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surfaceAlt; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = tokens.surface; }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: CONV_STATUS_COLOR[c.status], display: 'block' }} />
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
                  <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 16, color: tokens.text }}>{selected.patient_name}</div>
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
  resources, assignments, brand, tokens, onFree,
}: {
  resources: ClinicResource[];
  assignments: ClinicResourceAssignment[];
  brand: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onFree: (assignmentId: string) => void;
}) {
  const byType: Record<ClinicResourceType, ClinicResource[]> = {
    infusion_chair: [], lab_station: [], imaging_room: [], surgery_room: [], consult_room: [],
  };
  for (const r of resources) byType[r.resource_type].push(r);
  const assignmentByResource = new Map(assignments.map(a => [a.resource_id, a]));

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {list.map(r => {
                const a = assignmentByResource.get(r.id);
                const occupied = !!a;
                const remaining = occupied ? minutesUntil(a.expected_end_at) : null;
                const overdue = remaining !== null && remaining < 0;
                const bg = occupied ? (overdue ? 'rgba(217,58,58,0.08)' : brand + '0F') : tokens.surfaceAlt;
                const borderColor = occupied ? (overdue ? '#D93A3A' : brand) : tokens.border;

                return (
                  <div key={r.id}
                    style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 13, color: tokens.text }}>{r.name}</div>
                      <span style={{ ...badge(occupied ? (overdue ? '#D93A3A' : brand) : '#10897B'), fontSize: 10 }}>
                        {occupied ? (overdue ? 'Sobretiempo' : 'Ocupada') : 'Libre'}
                      </span>
                    </div>
                    {occupied ? (
                      <>
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
                          <button onClick={() => onFree(a.id)}
                            style={{ padding: '3px 9px', borderRadius: 6, border: `1px solid ${tokens.border}`, background: tokens.surface, color: tokens.textSecondary, fontSize: 10.5, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
                            Liberar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.textTertiary, fontSize: 12 }}>Disponible</div>
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

// ── Shell principal ──────────────────────────────────────────────────────────

type ClinicScreen = 'panel' | 'agenda' | 'preauth' | 'bandeja' | 'infraestructura' | 'resultados' | 'aseguradoras' | 'rendimiento';

export function ClinicDesktop() {
  const { tokens, isDark } = useTheme();
  const brand = brandFor(isDark);

  const [screen, setScreen] = useState<ClinicScreen>('panel');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const [staff, setStaff] = useState<ClinicStaff | null>(null);
  const [todayAppts, setTodayAppts] = useState<ServiceAppointment[]>([]);
  const [allAppts, setAllAppts] = useState<ServiceAppointment[]>([]);
  const [preauth, setPreauth] = useState<PreAuthRequest[]>([]);
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [escalations, setEscalations] = useState<ClinicalEscalation[]>([]);
  const [conversations, setConversations] = useState<ClinicConversation[]>([]);
  const [resources, setResources] = useState<ClinicResource[]>([]);
  const [assignments, setAssignments] = useState<ClinicResourceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const s = await getCurrentClinicStaff();
      setStaff(s);
      if (!s) { setLoading(false); return; }

      const clinicId = s.clinic_id;
      const [today, all, pa, res, esc, conv, rsc, asg] = await Promise.all([
        listTodayAppointments(clinicId),
        listAllAppointments(clinicId),
        listPreAuthRequests(clinicId),
        listServiceResults(clinicId),
        listActiveEscalations(clinicId),
        listConversations(clinicId),
        listResources(clinicId),
        listActiveAssignments(clinicId),
      ]);
      setTodayAppts(today);
      setAllAppts(all);
      setPreauth(pa);
      setResults(res);
      setEscalations(esc);
      setConversations(conv);
      setResources(rsc);
      setAssignments(asg);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel('clinic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_appointments' }, () => {
        if (staff?.clinic_id) {
          listTodayAppointments(staff.clinic_id).then(setTodayAppts);
          listAllAppointments(staff.clinic_id).then(setAllAppts);
          listActiveAssignments(staff.clinic_id).then(setAssignments);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_resource_assignments' }, () => {
        if (staff?.clinic_id) listActiveAssignments(staff.clinic_id).then(setAssignments);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_auth_requests' }, () => {
        if (staff?.clinic_id) listPreAuthRequests(staff.clinic_id).then(setPreauth);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_results' }, () => {
        if (staff?.clinic_id) listServiceResults(staff.clinic_id).then(setResults);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinical_escalations' }, () => {
        if (staff?.clinic_id) listActiveEscalations(staff.clinic_id).then(setEscalations);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_conversations' }, () => {
        if (staff?.clinic_id) listConversations(staff.clinic_id).then(setConversations);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleAppointmentStatusChange(id: string, status: AppointmentStatus) {
    const ok = await updateAppointmentStatus(id, status);
    if (ok && staff?.clinic_id) {
      listTodayAppointments(staff.clinic_id).then(setTodayAppts);
      listAllAppointments(staff.clinic_id).then(setAllAppts);
    }
  }

  async function handleFreeResource(assignmentId: string) {
    const ok = await freeResource(assignmentId);
    if (ok && staff?.clinic_id) listActiveAssignments(staff.clinic_id).then(setAssignments);
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
            <div key={item.id} onClick={() => setScreen(item.id)}
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

        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: `1px solid ${tokens.borderLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: `linear-gradient(135deg,${brand} 0%, #274B96 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12 }}>
            {staff.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 12.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: tokens.text }}>{staff.name}</div>
            <div style={{ fontSize: 10.5, color: tokens.textSecondary, marginTop: 2, textTransform: 'capitalize' }}>{staff.role}</div>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.textSecondary, fontSize: 11, fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', padding: 0 }}>Salir</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ background: tokens.surface, borderBottom: `1px solid ${tokens.border}`, padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 14, color: tokens.text }}>
              {navItems.find(n => n.id === screen)?.label}
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
              goInfra={() => setScreen('infraestructura')}
            />
          )}
          {screen === 'agenda' && (
            <Agenda
              appointments={allAppts}
              assignments={assignments}
              brand={brand}
              tokens={tokens}
              onStatusChange={handleAppointmentStatusChange}
            />
          )}
          {screen === 'preauth' && (
            <PreAuth
              requests={preauth}
              brand={brand}
              tokens={tokens}
              onStatusChange={handlePreAuthStatusChange}
            />
          )}
          {screen === 'bandeja' && <Bandeja clinicId={staff.clinic_id} staffId={staff.id} brand={brand} tokens={tokens} />}
          {screen === 'infraestructura' && (
            <Infraestructura
              resources={resources}
              assignments={assignments}
              brand={brand}
              tokens={tokens}
              onFree={handleFreeResource}
            />
          )}
          {screen === 'resultados' && (
            <Resultados results={results} brand={brand} tokens={tokens} />
          )}
          {screen === 'aseguradoras' && (
            <Aseguradoras appointments={allAppts} preauth={preauth} brand={brand} tokens={tokens} />
          )}
          {screen === 'rendimiento' && (
            <Rendimiento appointments={allAppts} brand={brand} tokens={tokens} />
          )}
        </div>
      </main>
    </div>
  );
}
