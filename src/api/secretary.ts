import { supabase } from '../lib/supabase';
import { localDateString } from '../lib/dates';

export interface Secretary {
  id: string;
  name: string;
  email: string;
  user_id: string;
}

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

export interface PatientFormData {
  name: string;
  age: number;
  sex: 'F' | 'M';
  expediente: string;
  dx: string;
  insurer: string;
  policy: string;
  doctor_id: string;
  status?: string;
  status_label?: string;
  meds?: string[];
  allergies?: string[];
  next_visit?: string;
  deducible?: string;
  coaseguro?: string;
  vigencia_poliza?: string;
  auth_note?: string;
}

export interface AgendaSlotFormData {
  tm: string;
  day: string;
  name: string;
  why: string;
  status: 'checked' | 'waiting' | 'upcoming';
  doctor_id?: string;
  patient_id?: string;
}

export async function getCurrentSecretary(): Promise<Secretary | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('secretaries')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  // Sincronizar email de auth → tabla para que el doctor pueda buscar por correo
  if (user.email && data.email !== user.email) {
    await supabase.from('secretaries').update({ email: user.email }).eq('id', data.id);
  }
  return { ...data, email: user.email ?? data.email };
}

export async function listDoctors(): Promise<DoctorOption[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, name, specialty')
    .order('name');
  if (error) throw error;
  return (data || []) as DoctorOption[];
}

export async function listAllPatients(doctorId?: string) {
  // Sin doctor activo no mostramos pacientes
  if (!doctorId) return [];
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, age, sex, expediente, dx, insurer, policy, status, status_label, doctor_id, last_visit, next_visit')
    .eq('doctor_id', doctorId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createPatient(form: PatientFormData) {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      name: form.name,
      age: form.age,
      sex: form.sex,
      expediente: form.expediente,
      dx: form.dx,
      insurer: form.insurer,
      policy: form.policy,
      doctor_id: form.doctor_id,
      status: form.status || 'green',
      status_label: form.status_label || 'Estable',
      meds: form.meds || [],
      allergies: form.allergies || [],
      last_visit: localDateString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePatient(id: string, fields: Partial<PatientFormData>) {
  const { error } = await supabase
    .from('patients')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
}

export async function listAgendaByDoctor(doctorId: string, day?: string) {
  let q = supabase.from('agenda_slots').select('*').order('tm');
  if (doctorId) q = q.eq('doctor_id', doctorId);
  if (day) q = q.eq('day', day);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export const AGENDA_MIN_HOUR = 6;   // 06:00
export const AGENDA_MAX_HOUR = 22;  // 22:00

export async function createAgendaSlot(slot: AgendaSlotFormData) {
  const { data, error } = await supabase
    .from('agenda_slots')
    .insert(slot)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAgendaSlot(id: string) {
  const { error } = await supabase
    .from('agenda_slots')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateSlotStatus(id: string, status: 'checked' | 'cancelled' | 'waiting' | 'upcoming', cancelReason?: string) {
  const { error } = await supabase
    .from('agenda_slots')
    .update({ status, ...(cancelReason ? { cancel_reason: cancelReason } : {}) })
    .eq('id', id);
  if (error) throw error;
}

// ─── Historial ───────────────────────────────────────────────────────────────

export async function addHistory(entry: Record<string, any>) {
  const { error } = await supabase.from('patient_history').insert(entry);
  if (error) throw error;
}

export async function listHistory(patientId: string) {
  const { data, error } = await supabase
    .from('patient_history')
    .select('*')
    .eq('patient_id', patientId)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listDocuments(patientId?: string) {
  let q = supabase
    .from('patient_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (patientId) q = q.eq('patient_id', patientId);
  const { data, error } = await q;
  if (error && error.code !== 'PGRST116') throw error;

  return Promise.all((data || []).map(async (doc: any) => {
    if (!doc.bucket || !doc.storage_path) return doc;
    const { data: signed } = await supabase.storage
      .from(doc.bucket)
      .createSignedUrl(doc.storage_path, 60 * 10);
    return { ...doc, url: signed?.signedUrl || doc.url };
  }));
}

export interface LabExtractionResult {
  inserted: number;
  analitos: string[];
}

export async function uploadPatientDocument(
  patientId: string,
  file: File,
  docType: string,
  onLabsExtracted?: (result: LabExtractionResult) => void,
) {
  const bucket = docType === 'Póliza' ? 'polizas' : 'estudios';
  const path = `${patientId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file);
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('patient_documents')
    .insert({
      patient_id: patientId,
      name: file.name,
      type: docType,
      bucket,
      storage_path: path,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([path]).catch(() => {});
    throw error;
  }

  await addHistory({
    patient_id: patientId,
    type: 'documento',
    title: `Documento cargado: ${docType}`,
    description: file.name,
    icon: docType === 'Resultado de lab' ? 'flask' : docType === 'Estudio' ? 'image' : 'file',
    document_id: data.id,
    source_table: 'patient_documents',
    source_id: data.id,
    event_type: 'document_uploaded',
    occurred_at: data.uploaded_at,
    metadata: {
      document_type: docType,
      document_name: file.name,
      bucket,
      storage_path: path,
    },
  }).catch(() => {});

  // Si es resultado de lab, invocar Edge Function para extraccion automatica con IA.
  // Usamos signed URL para que funcione aunque el bucket este privado.
  if (docType === 'Resultado de lab') {
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10);
    if (signErr || !signed?.signedUrl) {
      throw new Error('El archivo se guardo, pero no se pudo generar una URL firmada para analizar el PDF.');
    }

    const { data: labData, error: labErr } = await supabase.functions.invoke('extract-labs', {
      body: {
        patient_id: patientId,
        document_url: signed.signedUrl,
        file_name: file.name,
        pdf_path: path,
        bucket,
      },
    });

    if (labErr) {
      throw new Error(`El archivo se guardo, pero la extraccion de labs fallo: ${labErr.message}`);
    }
    if (labData?.error) {
      throw new Error(`El archivo se guardo, pero la extraccion de labs fallo: ${labData.error}`);
    }
    if (labData && onLabsExtracted) onLabsExtracted(labData as LabExtractionResult);
  }

  return data;
}

export async function deleteDocument(id: string) {
  const { data: doc, error: findErr } = await supabase
    .from('patient_documents')
    .select('bucket, storage_path')
    .eq('id', id)
    .single();
  if (findErr) throw findErr;

  if (doc?.bucket && doc?.storage_path) {
    const { error: removeErr } = await supabase.storage
      .from(doc.bucket)
      .remove([doc.storage_path]);
    if (removeErr) throw removeErr;
  }

  const { error } = await supabase
    .from('patient_documents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Asignaciones doctor ↔ secretaria ────────────────────────────────────────

export async function getAssignedSecretaries(doctorId: string) {
  const { data, error } = await supabase
    .from('secretary_doctors')
    .select('secretary_id, secretaries(id, name, user_id)')
    .eq('doctor_id', doctorId);
  if (error) throw error;
  return (data || []).map((r: any) => r.secretaries).filter(Boolean);
}

export async function getAssignedDoctors(secretaryId: string): Promise<DoctorOption[]> {
  const { data, error } = await supabase
    .from('secretary_doctors')
    .select('doctor_id, doctors(id, name, specialty)')
    .eq('secretary_id', secretaryId);
  if (error) throw error;
  return (data || []).map((r: any) => r.doctors).filter(Boolean) as DoctorOption[];
}

export async function assignSecretaryByEmail(doctorId: string, email: string) {
  // Buscar el usuario en auth por email (via secretaries)
  const { data: sec, error: secErr } = await supabase
    .from('secretaries')
    .select('id, name')
    .eq('email', email)
    .maybeSingle();

  if (secErr) throw secErr;

  if (!sec) {
    // Intentar buscar por email en auth (la secretaria puede no tener email guardado en tabla)
    // Buscamos en secretaries usando join con auth.users via RPC o simplemente informamos
    throw new Error('No se encontró ninguna secretaria con ese correo. Asegúrate de que esté registrada en el sistema.');
  }

  const { error } = await supabase
    .from('secretary_doctors')
    .insert({ doctor_id: doctorId, secretary_id: sec.id });

  if (error) {
    if (error.code === '23505') throw new Error('Esta secretaria ya está asignada a tu cuenta.');
    throw error;
  }
  return sec;
}

export async function removeSecretaryAssignment(doctorId: string, secretaryId: string) {
  const { error } = await supabase
    .from('secretary_doctors')
    .delete()
    .eq('doctor_id', doctorId)
    .eq('secretary_id', secretaryId);
  if (error) throw error;
}
