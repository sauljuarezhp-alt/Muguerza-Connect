import { supabase } from '../lib/supabase';

export interface PrecitaContext {
  status: 'invalid' | 'expired' | 'submitted' | 'open';
  doctorName: string | null;
  doctorSpecialty: string | null;
  appointmentDate: string | null;   // 'YYYY-MM-DD'
  appointmentTime: string | null;
  patientName: string | null;
  appointmentReason: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
}

export interface PrecitaPayload {
  version: 1;
  chief_complaint: string;
  symptoms: string;
  symptom_started_at: string;
  severity: string;
  current_medications: string;
  allergies: string;
  relevant_history: string;
  additional_notes: string;
}

export interface PrecitaRecord {
  agendaSlotId: string;
  submittedAt: string;
  expiresAt: string;
  payload: PrecitaPayload & { submitted_from?: string };
}

export async function generatePrecitaToken(
  agendaSlotId: string,
  expiresInHours = 24,
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase.rpc('generate_precita_token', {
    p_agenda_slot_id: agendaSlotId,
    p_expires_in_hours: expiresInHours,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) throw new Error('generate_precita_token no devolvió token');
  return { token: row.token, expiresAt: row.expires_at };
}

export async function getPrecita(token: string): Promise<PrecitaContext> {
  const { data, error } = await supabase.rpc('get_precita_by_token', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { status: 'invalid', doctorName: null, doctorSpecialty: null, appointmentDate: null, appointmentTime: null, patientName: null, appointmentReason: null, submittedAt: null, expiresAt: null };
  }
  return {
    status: row.status as PrecitaContext['status'],
    doctorName: row.doctor_name ?? null,
    doctorSpecialty: row.doctor_specialty ?? null,
    appointmentDate: row.appointment_date ?? null,
    appointmentTime: row.appointment_time ?? null,
    patientName: row.patient_name ?? null,
    appointmentReason: row.appointment_reason ?? null,
    submittedAt: row.submitted_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

export async function submitPrecita(
  token: string,
  payload: PrecitaPayload,
): Promise<{ success: boolean; status: string }> {
  const { data, error } = await supabase.rpc('submit_precita', {
    p_token: token,
    p_payload: payload as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { success: Boolean(row?.success), status: row?.status ?? 'error' };
}

// Portal autenticado: precita más reciente enviada para un paciente
export async function getLatestPrecitaForPatient(patientId: string): Promise<PrecitaRecord | null> {
  const { data, error } = await supabase
    .from('precita_tokens')
    .select('agenda_slot_id, submitted_at, expires_at, payload')
    .eq('patient_id', patientId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    agendaSlotId: data.agenda_slot_id,
    submittedAt: data.submitted_at,
    expiresAt: data.expires_at,
    payload: data.payload,
  };
}

// Portal autenticado: pre-cita enviada para un slot específico
export async function getPrecitaForSlot(agendaSlotId: string): Promise<PrecitaRecord | null> {
  const { data, error } = await supabase
    .from('precita_tokens')
    .select('agenda_slot_id, submitted_at, expires_at, payload')
    .eq('agenda_slot_id', agendaSlotId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    agendaSlotId: data.agenda_slot_id,
    submittedAt: data.submitted_at,
    expiresAt: data.expires_at,
    payload: data.payload,
  };
}

// Portal autenticado: mapa agenda_slot_id → status para la agenda del día
export async function getPrecitaStatusesForSlots(
  slotIds: string[],
): Promise<Record<string, 'submitted' | 'expired' | 'open'>> {
  if (!slotIds.length) return {};
  const { data, error } = await supabase
    .from('precita_tokens')
    .select('agenda_slot_id, submitted_at, expires_at')
    .in('agenda_slot_id', slotIds);
  if (error) return {};
  const now = new Date();
  const map: Record<string, 'submitted' | 'expired' | 'open'> = {};
  for (const row of data ?? []) {
    if (row.submitted_at) {
      map[row.agenda_slot_id] = 'submitted';
    } else if (new Date(row.expires_at) <= now) {
      map[row.agenda_slot_id] = 'expired';
    } else {
      map[row.agenda_slot_id] = 'open';
    }
  }
  return map;
}
