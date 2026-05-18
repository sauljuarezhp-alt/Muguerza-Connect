import { supabase } from '../lib/supabase';
import type { Alert } from '../types';

const fromRow = (r: any): Alert => ({
  sev: r.sev,
  time: r.time,
  patient: r.patient,
  patientId: r.patient_id,
  event: r.event,
  nurse: r.nurse || undefined,
  tag: r.tag || undefined,
});

export async function listAlerts(): Promise<Alert[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!doctor) return [];

  const { data, error } = await supabase
    .from('alerts')
    .select('*, patients!inner(doctor_id)')
    .eq('patients.doctor_id', doctor.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}
