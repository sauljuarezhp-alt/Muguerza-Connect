import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SectionHeader } from './SectionHeader';
import { getCurrentDoctor } from '../api';
import { ConsultationTypesPanel } from './ConsultationTypesPanel';
import {
  getDoctorMetrics,
  getSpecialtyBenchmark,
  getTopPatients,
  getRevenueByMethod,
  type MonthlyMetrics,
  type SpecialtyBenchmark,
  type TopPatient,
  type RevenueByMethod,
} from '../api/metrics';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface Props { brand: string; goPatient: (id: string) => void; }

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmt$(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

function delta(curr: number, prev: number): { label: string; up: boolean; neutral: boolean } {
  if (prev === 0) return { label: '—', up: true, neutral: true };
  const pct = ((curr - prev) / prev) * 100;
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, up: pct >= 0, neutral: false };
}

function KpiCard({ label, value, sub, deltaInfo, color, tokens }: any) {
  return (
    <div style={{
      background: tokens.surface, border: `1px solid ${tokens.border}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 28, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 11, color: tokens.textTertiary }}>{sub}</span>
        {deltaInfo && !deltaInfo.neutral && (
          <span style={{ fontSize: 11, fontFamily: 'Franklin Gothic', fontWeight: 500, color: deltaInfo.up ? '#10897B' : '#D93A3A' }}>
            {deltaInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', aseguradora: 'Aseguradora', cortesia: 'Cortesía',
};
const METHOD_COLORS = ['#671E75', '#10897B', '#274B96', '#E08900'];

function DonutLegend({ items, tokens }: { items: Array<{ name: string }>; tokens: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 12px', minHeight: 16, marginTop: 2 }}>
      {items.map((item, i) => (
        <div key={item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: METHOD_COLORS[i % METHOD_COLORS.length], flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export function DesktopPracticeDashboard({ brand, goPatient }: Props) {
  const { tokens } = useTheme();
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<MonthlyMetrics[]>([]);
  const [benchmark, setBenchmark] = useState<SpecialtyBenchmark | null>(null);
  const [topPatients, setTopPatients] = useState<TopPatient[]>([]);
  const [revenueByMethod, setRevenueByMethod] = useState<RevenueByMethod[]>([]);
  const [range, setRange] = useState<6 | 12>(12);
  const [doctorId, setDoctorId] = useState('');
  const [specialty, setSpecialty] = useState('Medicina General');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const doc = await getCurrentDoctor();
        if (!doc) return;

        setDoctorId(doc.id);
        setSpecialty(doc.specialty || 'Medicina General');

        const thisMonth = currentMonthStr();
        const [trendData, benchData, topData, revData] = await Promise.all([
          getDoctorMetrics(doc.id, range),
          getSpecialtyBenchmark(doc.specialty, thisMonth),
          getTopPatients(doc.id),
          getRevenueByMethod(doc.id, thisMonth),
        ]);

        setTrend(trendData);
        setBenchmark(benchData);
        setTopPatients(topData);
        setRevenueByMethod(revData);
      } catch (e) {
        console.error('Error cargando métricas:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [range]);

  if (loading) return (
    <div style={{ padding: 20, fontFamily: 'Franklin Gothic', color: tokens.textSecondary }}>
      Cargando métricas...
    </div>
  );

  const thisMonth = trend[trend.length - 1];
  const prevMonth = trend[trend.length - 2];

  const consultasDelta = delta(thisMonth?.consultas ?? 0, prevMonth?.consultas ?? 0);
  const ingresosDelta = delta(thisMonth?.ingresos ?? 0, prevMonth?.ingresos ?? 0);
  const pacientesDelta = delta(thisMonth?.pacientesUnicos ?? 0, prevMonth?.pacientesUnicos ?? 0);
  const npsDelta = delta(thisMonth?.npsPromedio ?? 0, prevMonth?.npsPromedio ?? 0);

  const chartData = trend.map(m => ({
    mes: MONTHS_ES[new Date(m.month).getUTCMonth()],
    Consultas: m.consultas,
    'Ingresos (k)': Math.round(m.ingresos / 1000),
  }));

  const tipoData = thisMonth ? [
    { name: 'Primera vez', value: thisMonth.primerasVez },
    { name: 'Subsecuente', value: thisMonth.subsecuentes },
    { name: 'Urgencia', value: thisMonth.urgencias },
  ].filter(d => d.value > 0) : [];

  const noData = !thisMonth || thisMonth.consultas === 0;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: brand, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Mi práctica
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 24, margin: 0, letterSpacing: -0.3 }}>
            Rendimiento y estadísticas
          </h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {([6, 12] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                background: range === r ? brand : tokens.surfaceAlt,
                color: range === r ? '#fff' : tokens.textSecondary,
                border: 'none', borderRadius: 7, padding: '5px 12px',
                fontSize: 12, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: 'pointer',
              }}>
                {r} meses
              </button>
            ))}
          </div>
        </div>
      </div>

      {noData && (
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 15, color: tokens.text, marginBottom: 4 }}>
            Sin datos de consultas aún
          </div>
          <div style={{ fontSize: 12.5, color: tokens.textSecondary }}>
            Las métricas se generan automáticamente cuando la secretaria marca citas como "Atendida".
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard tokens={tokens} label="Consultas este mes" value={thisMonth?.consultas ?? 0} sub="vs mes anterior" deltaInfo={consultasDelta} color={brand} />
        <KpiCard tokens={tokens} label="Ingresos este mes" value={fmt$(thisMonth?.ingresos ?? 0)} sub="vs mes anterior" deltaInfo={ingresosDelta} color="#10897B" />
        <KpiCard tokens={tokens} label="Pacientes únicos" value={thisMonth?.pacientesUnicos ?? 0} sub="vs mes anterior" deltaInfo={pacientesDelta} color="#274B96" />
        <KpiCard tokens={tokens} label="NPS promedio" value={thisMonth?.npsPromedio?.toFixed(1) ?? '—'} sub="escala 1–10" deltaInfo={npsDelta} color="#E08900" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Gráfica de tendencia */}
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <SectionHeader title={`Evolución ${range} meses`} />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderLight} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fontFamily: 'Franklin Gothic', fill: tokens.textSecondary }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: tokens.textSecondary }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: tokens.textSecondary }} />
              <Tooltip contentStyle={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, fontFamily: 'Franklin Gothic', fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="Consultas" stroke={brand} strokeWidth={2} dot={{ r: 3, fill: brand }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="Ingresos (k)" stroke="#10897B" strokeWidth={2} dot={{ r: 3, fill: '#10897B' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Por tipo */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '12px 14px', flex: 1 }}>
            <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Tipo de consulta
            </div>
            {tipoData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={82}>
                  <PieChart margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={tipoData} cx="50%" cy="52%" innerRadius={24} outerRadius={38} dataKey="value" paddingAngle={3}>
                      {tipoData.map((_, i) => <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} stroke={tokens.surface} strokeWidth={2} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <DonutLegend items={tipoData} tokens={tokens} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: tokens.textSecondary, textAlign: 'center', paddingTop: 20 }}>Sin datos</div>
            )}
          </div>

          {/* Por método de pago */}
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '12px 14px', flex: 1 }}>
            <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Método de pago
            </div>
            {revenueByMethod.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={82}>
                  <PieChart margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={revenueByMethod.map(r => ({ name: METHOD_LABELS[r.method] ?? r.method, value: r.total }))} cx="50%" cy="52%" innerRadius={24} outerRadius={38} dataKey="value" paddingAngle={3}>
                      {revenueByMethod.map((_, i) => <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} stroke={tokens.surface} strokeWidth={2} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt$(v)} contentStyle={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <DonutLegend items={revenueByMethod.map(r => ({ name: METHOD_LABELS[r.method] ?? r.method }))} tokens={tokens} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: tokens.textSecondary, textAlign: 'center', paddingTop: 20 }}>Sin datos</div>
            )}
          </div>
        </div>
      </div>

      {/* Comparativo vs especialidad */}
      {benchmark && thisMonth && thisMonth.consultas > 0 && (
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <SectionHeader title="Tú vs promedio Muguerza — tu especialidad" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
            {[
              { label: 'Consultas', mine: thisMonth.consultas, avg: benchmark.avgConsultas, fmt: (n: number) => String(Math.round(n)) },
              { label: 'Ingresos', mine: thisMonth.ingresos, avg: benchmark.avgIngresos, fmt: fmt$ },
              { label: 'NPS', mine: thisMonth.npsPromedio ?? 0, avg: benchmark.avgNps ?? 0, fmt: (n: number) => n > 0 ? n.toFixed(1) : '—' },
            ].map(item => {
              const diff = item.avg > 0 ? ((item.mine - item.avg) / item.avg) * 100 : 0;
              const above = diff >= 0;
              return (
                <div key={item.label} style={{ background: tokens.surfaceAlt, borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: tokens.textSecondary, marginBottom: 2 }}>Tú</div>
                      <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 18, color: tokens.text }}>{item.fmt(item.mine)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: tokens.textSecondary, marginBottom: 2 }}>Promedio</div>
                      <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 18, color: tokens.textTertiary }}>{item.fmt(item.avg)}</div>
                    </div>
                    {item.avg > 0 && (
                      <div style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'Franklin Gothic', fontWeight: 500, color: above ? '#10897B' : '#D93A3A', alignSelf: 'center' }}>
                        {above ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top pacientes */}
      {topPatients.length > 0 && (
        <>
          <SectionHeader title="Top pacientes" />
          <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            {topPatients.map((pt, i) => (
              <div key={pt.patientId} onClick={() => goPatient(pt.patientId)}
                style={{ padding: '10px 14px', borderBottom: i < topPatients.length - 1 ? `1px solid ${tokens.borderLight}` : 'none', display: 'grid', gridTemplateColumns: '24px 1fr auto auto', gap: 12, alignItems: 'center', cursor: 'pointer', background: tokens.surface }}
                onMouseEnter={e => (e.currentTarget.style.background = tokens.surfaceAlt)}
                onMouseLeave={e => (e.currentTarget.style.background = tokens.surface)}
              >
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11, color: tokens.textSecondary, textAlign: 'right' }}>#{i + 1}</div>
                <div>
                  <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{pt.name}</div>
                  <div style={{ fontSize: 11.5, color: tokens.textTertiary }}>{pt.dx}</div>
                </div>
                <div style={{ fontSize: 12, color: tokens.textSecondary, textAlign: 'right' }}>
                  {pt.visitas} visita{pt.visitas !== 1 ? 's' : ''}
                </div>
                <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 12.5, color: '#10897B', minWidth: 80, textAlign: 'right' }}>
                  {fmt$(pt.ingresoTotal)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tipos de consulta y precios */}
      {doctorId && (
        <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <ConsultationTypesPanel doctorId={doctorId} specialty={specialty} brand={brand} />
        </div>
      )}
    </>
  );
}
