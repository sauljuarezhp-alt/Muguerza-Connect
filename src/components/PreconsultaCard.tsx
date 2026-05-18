import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import type { PreconsultaData } from '../api/preconsulta';

interface Props {
  data: PreconsultaData;
  brand: string;
  onOpenPatient: (id: string) => void;
  onDismiss: () => void;
}

function InitialsAvatar({ name, brand, size = 34 }: { name: string; brand: string; size?: number }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: brand + '22', color: brand,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Franklin Gothic', fontWeight: 600, fontSize: size * 0.37,
      flexShrink: 0, letterSpacing: 0.5,
    }}>
      {initials}
    </div>
  );
}

export function PreconsultaCard({ data, brand, onOpenPatient, onDismiss }: Props) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const urgent = data.minutesUntil <= 5;

  const minLabel = data.minutesUntil === 0
    ? '¡Ahora!'
    : data.minutesUntil === 1
    ? 'en 1 min'
    : `en ${data.minutesUntil} min`;

  const lastVisitLabel = data.lastVisit
    ? new Date(data.lastVisit).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Sin visita previa';

  const daysSinceLabel = data.daysSinceLast !== null
    ? `hace ${data.daysSinceLast} día${data.daysSinceLast !== 1 ? 's' : ''}`
    : '';

  return (
    <div style={{
      background: tokens.surface,
      border: `1.5px solid ${urgent ? brand : tokens.border}`,
      borderRadius: 12,
      marginBottom: 14,
      overflow: 'hidden',
      boxShadow: urgent ? `0 0 0 3px ${brand}18` : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      {/* ── Barra compacta (siempre visible) ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', cursor: 'pointer',
          userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = tokens.surfaceAlt)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Indicador urgente */}
        {urgent && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: brand, display: 'inline-block',
            animation: 'mc-pulse 1.4s ease-in-out infinite',
          }} />
        )}

        <InitialsAvatar name={data.patientName} brand={brand} size={28} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 1 }}>
            Siguiente en agenda
          </div>
          <span style={{
            fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13,
            color: tokens.text,
          }}>
            {data.patientName}
          </span>
          <span style={{ fontSize: 12, color: tokens.textSecondary, marginLeft: 8 }}>
            · {data.dx}
          </span>
        </div>

        {/* Hora + tiempo */}
        <span style={{
          fontFamily: 'Roboto Mono, monospace', fontSize: 11.5,
          color: urgent ? brand : tokens.textSecondary,
          fontWeight: urgent ? 600 : 400, flexShrink: 0,
        }}>
          {data.tm} · {minLabel}
        </span>

        {/* Label sección */}
        <span style={{
          fontSize: 11, fontFamily: 'Franklin Gothic', fontWeight: 500,
          color: tokens.textSecondary, flexShrink: 0,
        }}>
          {expanded ? 'Ocultar resumen' : 'Ver resumen del paciente'}
        </span>

        {/* Chevron */}
        <span style={{
          color: tokens.textSecondary, fontSize: 12, flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>
          ▾
        </span>

        {/* Dismiss */}
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tokens.textSecondary, fontSize: 15, padding: '0 2px',
            lineHeight: 1, flexShrink: 0,
          }}
          title="Ocultar"
        >
          ×
        </button>
      </div>

      {/* ── Panel expandido ── */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${tokens.borderLight}`,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              onClick={() => onOpenPatient(data.patientId)}
              style={{
                background: brand, color: '#fff', border: 'none', borderRadius: 8,
                padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.3,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Abrir expediente ›
            </button>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <InfoCell tokens={tokens}
              icon="📅" label="Última visita"
              primary={lastVisitLabel} secondary={daysSinceLabel}
            />
            <InfoCell tokens={tokens}
              icon="🧪" label="Labs"
              primary={
                data.labsAbnormal.length > 0
                  ? `${data.labsAbnormal.length} fuera de rango`
                  : data.labsTotal > 0
                  ? `${data.labsTotal} normal${data.labsTotal !== 1 ? 'es' : ''}`
                  : 'Sin resultados'
              }
              secondary={data.labsAbnormal.slice(0, 2).map(l =>
                `${l.name} ${l.st === 'hi' ? '▲' : '▼'} ${l.val} ${l.unit}`
              ).join(' · ') || undefined}
              alert={data.labsAbnormal.length > 0} alertColor="#E08900"
            />
            <InfoCell tokens={tokens}
              icon="💊" label="Medicamentos"
              primary={
                data.activeMeds.length > 0
                  ? `${data.activeMeds.length} activo${data.activeMeds.length !== 1 ? 's' : ''}`
                  : 'Sin medicamentos'
              }
              secondary={data.activeMeds.slice(0, 2).join(', ') || undefined}
            />
            <InfoCell tokens={tokens}
              icon="⚠️" label="Alertas abiertas"
              primary={
                data.openAlertsCount > 0
                  ? `${data.openAlertsCount} alerta${data.openAlertsCount !== 1 ? 's' : ''}`
                  : 'Sin alertas'
              }
              secondary={
                data.allergies.length > 0
                  ? `Alergias: ${data.allergies.slice(0, 2).join(', ')}`
                  : data.missedAppointments > 0
                  ? `${data.missedAppointments} cita${data.missedAppointments !== 1 ? 's' : ''} cancelada${data.missedAppointments !== 1 ? 's' : ''}`
                  : undefined
              }
              alert={data.openAlertsCount > 0 || data.allergies.length > 0} alertColor="#D93A3A"
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes mc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

function InfoCell({
  tokens, icon, label, primary, secondary, alert, alertColor,
}: {
  tokens: any; icon: string; label: string;
  primary: string; secondary?: string;
  alert?: boolean; alertColor?: string;
}) {
  return (
    <div style={{
      background: tokens.surfaceAlt, borderRadius: 9, padding: '9px 11px',
      borderLeft: alert ? `3px solid ${alertColor}` : '3px solid transparent',
    }}>
      <div style={{
        fontSize: 10, color: tokens.textSecondary, fontFamily: 'Franklin Gothic',
        fontWeight: 500, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 12.5,
        color: alert && alertColor ? alertColor : tokens.text, lineHeight: 1.3,
      }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontSize: 10.5, color: tokens.textTertiary, marginTop: 3, lineHeight: 1.4 }}>
          {secondary}
        </div>
      )}
    </div>
  );
}
