import { supabase } from '../lib/supabase';
import type {
  ClinicStaff,
  ServiceAppointment,
  PreAuthRequest,
  ServiceResult,
  ClinicalEscalation,
  AppointmentStatus,
  ClinicConversation,
  ClinicChatMessage,
  ClinicConversationStatus,
  ClinicResource,
  ClinicResourceAssignment,
} from '../types';

export async function getCurrentClinicStaff(): Promise<ClinicStaff | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('clinic_staff')
    .select('*, clinic:clinics(*)')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as ClinicStaff;
}

export async function listTodayAppointments(clinicId: string): Promise<ServiceAppointment[]> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data, error } = await supabase
    .from('service_appointments')
    .select('*, clinic_services(name, service_type)')
    .eq('clinic_id', clinicId)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at');

  if (error || !data) return [];

  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      ...(r as unknown as ServiceAppointment),
      service_name: (r['clinic_services'] as Record<string, string> | null)?.name,
      service_type: (r['clinic_services'] as Record<string, string> | null)?.service_type,
    };
  });
}

export async function listAllAppointments(clinicId: string): Promise<ServiceAppointment[]> {
  const { data, error } = await supabase
    .from('service_appointments')
    .select('*, clinic_services(name, service_type)')
    .eq('clinic_id', clinicId)
    .order('scheduled_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      ...(r as unknown as ServiceAppointment),
      service_name: (r['clinic_services'] as Record<string, string> | null)?.name,
      service_type: (r['clinic_services'] as Record<string, string> | null)?.service_type,
    };
  });
}

export async function listPreAuthRequests(clinicId: string): Promise<PreAuthRequest[]> {
  const { data, error } = await supabase
    .from('pre_auth_requests')
    .select('*, service_appointments(clinic_services(name))')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      ...(r as unknown as PreAuthRequest),
      service_name: (
        (r['service_appointments'] as Record<string, unknown> | null)
          ?.['clinic_services'] as Record<string, string> | null
      )?.name,
    };
  });
}

export async function listServiceResults(clinicId: string): Promise<ServiceResult[]> {
  const { data, error } = await supabase
    .from('service_results')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as ServiceResult[];
}

export async function listActiveEscalations(clinicId: string): Promise<ClinicalEscalation[]> {
  const { data, error } = await supabase
    .from('clinical_escalations')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', 'active')
    .order('triggered_at', { ascending: false });

  if (error || !data) return [];
  return data as ClinicalEscalation[];
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<boolean> {
  const { error } = await supabase
    .from('service_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId);
  return !error;
}

// ── Capacity / Resources ──────────────────────────────────────────────────

export async function listResources(clinicId: string): Promise<ClinicResource[]> {
  const { data, error } = await supabase
    .from('clinic_resources')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('resource_type')
    .order('position');
  if (error || !data) return [];
  return data as ClinicResource[];
}

export async function listActiveAssignments(clinicId: string): Promise<ClinicResourceAssignment[]> {
  const { data, error } = await supabase
    .from('clinic_resource_assignments')
    .select('*, clinic_resources(name, short_code, resource_type), service_appointments(clinic_services(name))')
    .eq('clinic_id', clinicId)
    .eq('status', 'active');
  if (error || !data) return [];
  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const res = r['clinic_resources'] as Record<string, string> | null;
    const appt = r['service_appointments'] as Record<string, unknown> | null;
    const svc = appt?.['clinic_services'] as Record<string, string> | null;
    return {
      ...(r as unknown as ClinicResourceAssignment),
      resource_name: res?.name,
      resource_short_code: res?.short_code,
      resource_type: res?.resource_type as ClinicResource['resource_type'],
      service_name: svc?.name,
    };
  });
}

export async function manualAssignResource(
  resourceId: string,
  appointmentId: string,
  clinicId: string,
  patientId: string,
  expectedEndMinutes = 60,
): Promise<boolean> {
  // Free any existing active assignment on the same resource first
  await supabase
    .from('clinic_resource_assignments')
    .update({ status: 'freed', ended_at: new Date().toISOString() })
    .eq('resource_id', resourceId)
    .eq('status', 'active');

  const { error } = await supabase
    .from('clinic_resource_assignments')
    .insert({
      resource_id: resourceId,
      appointment_id: appointmentId,
      clinic_id: clinicId,
      patient_id: patientId,
      expected_end_at: new Date(Date.now() + expectedEndMinutes * 60 * 1000).toISOString(),
      manual: true,
    });
  return !error;
}

export async function freeResource(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('clinic_resource_assignments')
    .update({ status: 'freed', ended_at: new Date().toISOString() })
    .eq('id', assignmentId);
  return !error;
}

// ── Conversations / CRM ──────────────────────────────────────────────────

export async function listConversations(clinicId: string): Promise<ClinicConversation[]> {
  const { data, error } = await supabase
    .from('clinic_conversations')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('last_message_at', { ascending: false });

  if (error || !data) return [];
  return data as ClinicConversation[];
}

export async function listConversationMessages(conversationId: string): Promise<ClinicChatMessage[]> {
  const { data, error } = await supabase
    .from('clinic_chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at');

  if (error || !data) return [];
  return data as ClinicChatMessage[];
}

export async function sendConversationMessage(
  conversationId: string,
  clinicId: string,
  body: string,
): Promise<boolean> {
  const now = new Date();
  const tm = `hoy ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const { error } = await supabase
    .from('clinic_chat_messages')
    .insert({ conversation_id: conversationId, clinic_id: clinicId, t: 'out', body, tm });
  return !error;
}

export async function updateConversationStatus(
  conversationId: string,
  status: ClinicConversationStatus,
  assignedTo?: string,
): Promise<boolean> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (assignedTo !== undefined) update.assigned_to = assignedTo;
  const { error } = await supabase
    .from('clinic_conversations')
    .update(update)
    .eq('id', conversationId);
  return !error;
}

export async function markConversationRead(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('clinic_conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  return !error;
}

export async function updatePreAuthStatus(
  preAuthId: string,
  status: PreAuthRequest['status'],
  folio?: string,
): Promise<boolean> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'approved' || status === 'rejected') {
    update.resolved_at = new Date().toISOString();
  }
  if (folio) update.folio_aseguradora = folio;

  const { error } = await supabase
    .from('pre_auth_requests')
    .update(update)
    .eq('id', preAuthId);
  return !error;
}
