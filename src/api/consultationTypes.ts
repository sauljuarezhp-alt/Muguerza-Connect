import { supabase } from '../lib/supabase';
import { localDateString } from '../lib/dates';

export interface ConsultationType {
  id: string;
  doctorId: string;
  name: string;
  category: 'primera_vez' | 'subsecuente' | 'urgencia';
  baseFee: number;
  minFee: number | null;
  maxFee: number | null;
  active: boolean;
  isCustom: boolean;
  specialtyTemplate: string | null;
}

export interface CloseConsultationPayload {
  doctorId: string;
  patientId: string;       // text
  agendaSlotId: string;    // uuid
  consultationTypeId: string;
  fee: number;
  paymentMethod: 'efectivo' | 'tarjeta' | 'aseguradora' | 'cortesia';
  insurer?: string;
}

function fromRow(r: any): ConsultationType {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    name: r.name,
    category: r.category,
    baseFee: Number(r.base_fee ?? 0),
    minFee: r.min_fee != null ? Number(r.min_fee) : null,
    maxFee: r.max_fee != null ? Number(r.max_fee) : null,
    active: r.active ?? true,
    isCustom: r.is_custom ?? false,
    specialtyTemplate: r.specialty_template ?? null,
  };
}

export async function getConsultationTypes(doctorId: string): Promise<ConsultationType[]> {
  const { data, error } = await supabase
    .from('doctor_consultation_types')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function getAllConsultationTypes(doctorId: string): Promise<ConsultationType[]> {
  const { data, error } = await supabase
    .from('doctor_consultation_types')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('active', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createConsultationType(payload: {
  doctorId: string;
  name: string;
  category: 'primera_vez' | 'subsecuente' | 'urgencia';
  baseFee: number;
  minFee?: number;
  maxFee?: number;
  isCustom?: boolean;
  specialtyTemplate?: string;
}): Promise<ConsultationType> {
  const { data, error } = await supabase
    .from('doctor_consultation_types')
    .insert({
      doctor_id: payload.doctorId,
      name: payload.name,
      category: payload.category,
      base_fee: payload.baseFee,
      min_fee: payload.minFee ?? null,
      max_fee: payload.maxFee ?? null,
      active: true,
      is_custom: payload.isCustom ?? true,
      specialty_template: payload.specialtyTemplate ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateConsultationType(
  id: string,
  patch: Partial<{
    name: string;
    category: 'primera_vez' | 'subsecuente' | 'urgencia';
    baseFee: number;
    minFee: number | null;
    maxFee: number | null;
    active: boolean;
  }>
): Promise<void> {
  const update: Record<string, any> = {};
  if (patch.name !== undefined)     update.name = patch.name;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.baseFee !== undefined)  update.base_fee = patch.baseFee;
  if ('minFee' in patch)            update.min_fee = patch.minFee;
  if ('maxFee' in patch)            update.max_fee = patch.maxFee;
  if (patch.active !== undefined)   update.active = patch.active;

  const { error } = await supabase
    .from('doctor_consultation_types')
    .update(update)
    .eq('id', id);
  if (error) throw error;
}

export async function deactivateConsultationType(id: string): Promise<void> {
  await updateConsultationType(id, { active: false });
}

// Cierra una consulta de forma atómica:
// 1. Marca el slot como 'checked'
// 2. Inserta en consultations (Supabase trigger llena type/consultation_type_name/fee_overridden)
// 3. Inserta en patient_history
// Maneja duplicado por agenda_slot_id silenciosamente.
export async function closeConsultationFromSlot(
  payload: CloseConsultationPayload,
  slotMeta: { tm: string; why?: string }
): Promise<void> {
  // 1. Marcar slot como atendido
  const { error: slotErr } = await supabase
    .from('agenda_slots')
    .update({ status: 'checked' })
    .eq('id', payload.agendaSlotId);
  if (slotErr) throw slotErr;

  // 2. Insertar consulta — unique index en agenda_slot_id previene duplicados
  const { data: consultation, error: consErr } = await supabase
    .from('consultations')
    .insert({
      doctor_id: payload.doctorId,
      patient_id: payload.patientId,
      agenda_slot_id: payload.agendaSlotId,
      consultation_type_id: payload.consultationTypeId,
      fee: payload.fee,
      payment_method: payload.paymentMethod,
      insurer: payload.insurer ?? null,
      date: localDateString(),
    })
    .select('id, consultation_type_name, fee, payment_method, created_at')
    .single();

  // Ignorar error de duplicado (23505 = unique_violation)
  if (consErr && consErr.code !== '23505') throw consErr;

  // 3. Historial del paciente
  if (!consErr) {
    await supabase.from('patient_history').insert({
      patient_id: payload.patientId,
      type: 'cita',
      title: `Consulta — ${slotMeta.why || 'Sin motivo'}`,
      description: `Atendido a las ${slotMeta.tm}`,
      icon: 'clock',
      doctor_id: payload.doctorId,
      agenda_slot_id: payload.agendaSlotId,
      consultation_id: consultation?.id,
      source_table: 'consultations',
      source_id: consultation?.id,
      event_type: 'consultation_closed',
      occurred_at: consultation?.created_at,
      metadata: {
        consultation_type_name: consultation?.consultation_type_name,
        fee: consultation?.fee,
        payment_method: consultation?.payment_method,
      },
    }).then(() => {});
  }
}
