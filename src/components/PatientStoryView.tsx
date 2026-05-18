import { useTheme } from '../context/ThemeContext';
import { ANALITOS } from '../data/analitos';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { Patient } from '../types';

interface Props {
  patient: Patient;
  labs: any[];
  history: any[];
  brand: string;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Genera texto de storytelling basado en delta de un analito
function storyText(analiteName: string, first: number, last: number, unit: string, max: number): string {
  const mejoro = last < first && first > max;
  const empeoro = last > first;
  const pct = Math.abs(((last - first) / first) * 100).toFixed(0);
  if (mejoro) return `Tu ${analiteName} bajó de ${first} a ${last} ${unit} (${pct}% de mejora). ¡Sigue así! 🎉`;
  if (empeoro) return `Tu ${analiteName} subió de ${first} a ${last} ${unit} (${pct}%). Hablemos del plan. 📋`;
  return `Tu ${analiteName} se mantiene estable en ${last} ${unit}. ✅`;
}

export function PatientStoryView({ patient, labs, history, brand }: Props) {
  const { tokens } = useTheme();

  // Agrupar labs por analito (todas las muestras, orden cronológico)
  const labsByAnalyte = new Map<string, { taken_at: string; val: string }[]>();
  for (const lab of [...labs].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''))) {
    if (!labsByAnalyte.has(lab.n)) labsByAnalyte.set(lab.n, []);
    labsByAnalyte.get(lab.n)!.push({ taken_at: lab.taken_at, val: lab.val });
  }

  // Solo analitos con ≥2 muestras tienen gráfica
  const chartsData = Array.from(labsByAnalyte.entries())
    .filter(([, samples]) => samples.length >= 2)
    .map(([name, samples]) => {
      const analito = ANALITOS.find(a => a.name === name || a.abbr === name);
      return {
        name,
        unit: analito?.unit ?? '',
        min: analito?.low ?? null,
        max: analito?.max ?? null,
        samples: samples.map(s => ({
          fecha: fmtDate(s.taken_at),
          valor: parseFloat(s.val),
        })),
        story: analito
          ? storyText(name, parseFloat(samples[0].val), parseFloat(samples[samples.length - 1].val), analito.unit, analito.max)
          : null,
      };
    });

  // Línea de tiempo de visitas desde historial
  const visitas = [...history]
    .filter(h => h.type === 'cita')
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  return (
    <div>
      {/* Header de modo paciente */}
      <div style={{
        background: `linear-gradient(135deg, ${brand}18 0%, ${brand}05 100%)`,
        border: `1px solid ${brand}30`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 28 }}>👤</div>
        <div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 15, color: tokens.text }}>
            Modo paciente — {patient.name}
          </div>
          <div style={{ fontSize: 12.5, color: tokens.textSecondary, marginTop: 2 }}>
            Esta vista está diseñada para mostrarle al paciente su evolución durante la consulta.
          </div>
        </div>
      </div>

      {/* Línea de tiempo */}
      {visitas.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
            Tu historial de visitas
          </div>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: `${brand}30`, borderRadius: 2 }} />
            {visitas.map((v, i) => (
              <div key={v.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12, position: 'relative' }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: brand,
                  flexShrink: 0, marginTop: 2, position: 'relative', zIndex: 1,
                  boxShadow: `0 0 0 3px ${brand}22`,
                }} />
                <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 9, padding: '8px 12px', flex: 1 }}>
                  <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{v.title}</div>
                  <div style={{ fontSize: 11.5, color: tokens.textSecondary, marginTop: 2 }}>{v.description}</div>
                  {v.created_at && (
                    <div style={{ fontSize: 10.5, color: tokens.textTertiary, marginTop: 4, fontFamily: 'Roboto Mono, monospace' }}>
                      {fmtDate(v.created_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficas de evolución */}
      {chartsData.length > 0 ? (
        <div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
            Evolución de tus resultados
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {chartsData.map(chart => {
              const vals = chart.samples.map(s => s.valor);
              const minVal = Math.min(...vals);
              const maxVal = Math.max(...vals);
              const padding = (maxVal - minVal) * 0.3 || 1;

              return (
                <div key={chart.name} style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 14, color: tokens.text, marginBottom: 2 }}>
                    {chart.name}
                    <span style={{ fontSize: 11, color: tokens.textSecondary, marginLeft: 8 }}>{chart.unit}</span>
                  </div>

                  {chart.story && (
                    <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
                      {chart.story}
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chart.samples} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderLight} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: tokens.textSecondary }} />
                      <YAxis domain={[minVal - padding, maxVal + padding]} tick={{ fontSize: 10, fill: tokens.textSecondary }} />
                      <Tooltip
                        formatter={(v: any) => [`${v} ${chart.unit}`, chart.name]}
                        contentStyle={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 11 }}
                      />
                      {/* Zona normal: líneas de referencia */}
                      {chart.min !== null && (
                        <ReferenceLine y={chart.min} stroke="#10897B" strokeDasharray="4 2" strokeWidth={1}
                          label={{ value: 'mín', position: 'right', fontSize: 9, fill: '#10897B' }} />
                      )}
                      {chart.max !== null && (
                        <ReferenceLine y={chart.max} stroke="#E08900" strokeDasharray="4 2" strokeWidth={1}
                          label={{ value: 'máx', position: 'right', fontSize: 9, fill: '#E08900' }} />
                      )}
                      <Line type="monotone" dataKey="valor" stroke={brand} strokeWidth={2.5}
                        dot={{ r: 4, fill: brand, stroke: tokens.surface, strokeWidth: 2 }}
                        activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: tokens.surfaceAlt, borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 14, color: tokens.text, marginBottom: 4 }}>
            Sin suficientes datos para graficar
          </div>
          <div style={{ fontSize: 12.5, color: tokens.textSecondary }}>
            Se necesitan al menos 2 resultados del mismo analito para mostrar la evolución.
          </div>
        </div>
      )}
    </div>
  );
}
