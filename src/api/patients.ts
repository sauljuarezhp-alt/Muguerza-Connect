import { supabase } from '../lib/supabase';
import type { Patient } from '../types';

const fromRow = (r: any): Patient => ({
  id: r.id,
  name: r.name,
  age: r.age,
  sex: r.sex,
  expediente: r.expediente,
  dx: r.dx,
  insurer: r.insurer,
  policy: r.policy,
  status: r.status,
  statusLabel: r.status_label,
  lastVisit: r.last_visit,
  nextVisit: r.next_visit,
  hospitalized: r.hospitalized,
  meds: r.meds || [],
  allergies: r.allergies || [],
  vitals: r.vitals || undefined,
  vitalsRecordedAt: r.vitals_recorded_at || undefined,
  authStatus: r.auth_status || undefined,
  authStep: r.auth_step || undefined,
  authNote: r.auth_note || undefined,
  deducible: r.deducible || undefined,
  coaseguro: r.coaseguro || undefined,
  vigenciaPoliza: r.vigencia_poliza || undefined,
});

export async function listPatients(): Promise<Patient[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!doctor) return [];
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('doctor_id', doctor.id)
    .order('id');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? fromRow(data) : null;
}
