import { supabase } from '../lib/supabase';
import type { InboxItem } from '../types';

const fromRow = (r: any): InboxItem => ({
  src: r.src,
  sev: r.sev,
  time: r.time,
  subject: r.subject,
  preview: r.preview,
  patient: r.patient,
  patientId: r.patient_id,
});

export async function listInbox(): Promise<InboxItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!doctor) return [];

  // Traer solo inbox items de pacientes de este doctor
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*, patients!inner(doctor_id)')
    .eq('patients.doctor_id', doctor.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}
