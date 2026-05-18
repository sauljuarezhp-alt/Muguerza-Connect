import { supabase } from '../lib/supabase';
import { localDateString } from '../lib/dates';

export interface LabFlag {
  name: string;
  val: string;
  unit: string;
  st: 'hi' | 'lo';
  dir: 'up' | 'down' | 'flat';
  delta: string;
}

export interface PreconsultaData {
  slotId: string;
  tm: string;
  minutesUntil: number;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  dx: string;
  why: string;
  lastVisit: string | null;
  daysSinceLast: number | null;
  activeMeds: string[];
  allergies: string[];
  labsAbnormal: LabFlag[];
  labsTotal: number;
  openAlertsCount: number;
  missedAppointments: number;
  insurer: string;
}

function tmToMinutes(tm: string): number {
  const [h, m] = tm.split(':').map(Number);
  return h * 60 + m;
}

function minutesNow(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export async function buildPreconsulta(doctorId: string): Promise<PreconsultaData | null> {
  const today = localDateString();
  const nowMin = minutesNow();

  const { data: slots } = await supabase
    .from('agenda_slots')
    .select('id, tm, patient_id, why, status')
    .eq('doctor_id', doctorId)
    .eq('day', today)
    .in('status', ['upcoming', 'waiting'])
    .order('tm');

  const next = (slots || []).find(r => tmToMinutes(r.tm) > nowMin);
  if (!next || !next.patient_id) return null;

  const { patientId, slotId, tm, why, minutesUntil } = {
    patientId: next.patient_id as string,
    slotId: next.id as string,
    tm: next.tm as string,
    why: (next.why as string) || '',
    minutesUntil: tmToMinutes(next.tm) - nowMin,
  };

  const [patientRes, labsRes, alertsRes, cancelledRes] = await Promise.all([
    supabase.from('patients').select('*').eq('id', patientId).single(),
    supabase
      .from('labs')
      .select('n, val, unit, st, dir, delta, taken_at')
      .eq('patient_id', patientId)
      .order('taken_at', { ascending: false }),
    supabase.from('alerts').select('sev').eq('patient_id', patientId),
    supabase
      .from('agenda_slots')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', 'cancelled'),
  ]);

  const p = patientRes.data;
  if (!p) return null;

  let daysSinceLast: number | null = null;
  if (p.last_visit) {
    const diff = Date.now() - new Date(p.last_visit).getTime();
    daysSinceLast = Math.floor(diff / 86_400_000);
  }

  // Most recent value per analyte; flag abnormal ones
  const seen = new Set<string>();
  const labsAbnormal: LabFlag[] = [];
  let labsTotal = 0;

  for (const lab of labsRes.data || []) {
    if (!seen.has(lab.n)) {
      seen.add(lab.n);
      labsTotal++;
      if (lab.st === 'hi' || lab.st === 'lo') {
        labsAbnormal.push({
          name: lab.n,
          val: lab.val,
          unit: lab.unit,
          st: lab.st,
          dir: lab.dir,
          delta: lab.delta,
        });
      }
    }
  }

  return {
    slotId,
    tm,
    minutesUntil,
    patientId,
    patientName: p.name,
    patientAge: p.age,
    patientSex: p.sex,
    dx: p.dx || '—',
    why,
    lastVisit: p.last_visit || null,
    daysSinceLast,
    activeMeds: p.meds || [],
    allergies: p.allergies || [],
    labsAbnormal,
    labsTotal,
    openAlertsCount: (alertsRes.data || []).length,
    missedAppointments: (cancelledRes.data || []).length,
    insurer: p.insurer || '',
  };
}
