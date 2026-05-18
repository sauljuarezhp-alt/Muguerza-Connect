import { supabase } from '../lib/supabase';

export interface MonthlyMetrics {
  month: string;           // 'YYYY-MM-DD'
  consultas: number;
  ingresos: number;
  pacientesUnicos: number;
  npsPromedio: number | null;
  primerasVez: number;
  subsecuentes: number;
  urgencias: number;
}

export interface SpecialtyBenchmark {
  avgConsultas: number;
  avgIngresos: number;
  avgNps: number | null;
}

export interface TopPatient {
  patientId: string;
  name: string;
  visitas: number;
  ingresoTotal: number;
  dx: string;
}

export interface RevenueByMethod {
  method: string;
  total: number;
}

export async function getDoctorMetrics(doctorId: string, months = 12): Promise<MonthlyMetrics[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months + 1);
  from.setDate(1);
  const fromStr = from.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('doctor_metrics_monthly')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('month', fromStr)
    .order('month');

  if (error) throw error;
  return (data || []).map(r => ({
    month: r.month,
    consultas: r.consultas ?? 0,
    ingresos: Number(r.ingresos ?? 0),
    pacientesUnicos: r.pacientes_unicos ?? 0,
    npsPromedio: r.nps_promedio ? Number(r.nps_promedio) : null,
    primerasVez: r.primeras_vez ?? 0,
    subsecuentes: r.subsecuentes ?? 0,
    urgencias: r.urgencias ?? 0,
  }));
}

export async function getSpecialtyBenchmark(
  specialty: string,
  month: string   // 'YYYY-MM-DD'
): Promise<SpecialtyBenchmark | null> {
  const { data, error } = await supabase
    .from('specialty_benchmarks_monthly')
    .select('*')
    .eq('specialty', specialty)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    avgConsultas: Number(data.avg_consultas ?? 0),
    avgIngresos: Number(data.avg_ingresos ?? 0),
    avgNps: data.avg_nps ? Number(data.avg_nps) : null,
  };
}

export async function getTopPatients(doctorId: string, limit = 10): Promise<TopPatient[]> {
  const { data, error } = await supabase
    .from('consultations')
    .select('patient_id, fee, patients(name, dx)')
    .eq('doctor_id', doctorId);

  if (error) throw error;

  const map = new Map<string, { name: string; dx: string; visitas: number; ingresoTotal: number }>();
  for (const r of data || []) {
    const pid = r.patient_id as string;
    const existing = map.get(pid);
    const pat = r.patients as any;
    if (existing) {
      existing.visitas++;
      existing.ingresoTotal += Number(r.fee ?? 0);
    } else {
      map.set(pid, {
        name: pat?.name ?? '—',
        dx: pat?.dx ?? '—',
        visitas: 1,
        ingresoTotal: Number(r.fee ?? 0),
      });
    }
  }

  return Array.from(map.entries())
    .map(([patientId, v]) => ({ patientId, ...v }))
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, limit);
}

export async function getRevenueByMethod(doctorId: string, month: string): Promise<RevenueByMethod[]> {
  const nextMonth = new Date(month);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextStr = nextMonth.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('consultations')
    .select('payment_method, fee')
    .eq('doctor_id', doctorId)
    .gte('date', month)
    .lt('date', nextStr);

  if (error) throw error;

  const map = new Map<string, number>();
  for (const r of data || []) {
    const m = r.payment_method ?? 'efectivo';
    map.set(m, (map.get(m) ?? 0) + Number(r.fee ?? 0));
  }

  return Array.from(map.entries()).map(([method, total]) => ({ method, total }));
}
