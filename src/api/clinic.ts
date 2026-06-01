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
  ClinicService,
  ClinicPaymentModel,
  ClinicPaymentMethod,
  ClinicFinancialMonthly,
  ClinicRevenueByPaymentMethod,
  ClinicServiceFinancialMonthly,
  ClinicPatient,
  ClinicPatientListItem,
  ClinicPatientSummary,
  ClinicPatientTreatmentStatus,
  ClinicPatientTimelineEvent,
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
  const { data, error } = await supabase.rpc('update_clinic_appointment_status', {
    p_appointment_id: appointmentId,
    p_status: status,
  });
  return !error && data === true;
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
  const { data, error } = await supabase.rpc('update_clinic_preauth_status', {
    p_pre_auth_id: preAuthId,
    p_status: status,
    p_folio: folio ?? null,
  });
  return !error && data === true;
}

// ── Clinic Services ───────────────────────────────────────────────────────

export async function listClinicServices(clinicId: string): Promise<ClinicService[]> {
  const { data, error } = await supabase
    .from('clinic_services')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('service_type')
    .order('name');
  if (error || !data) return [];
  return data as ClinicService[];
}

// ── Appointment creation ───────────────────────────────────────────────────

export interface CreateClinicAppointmentPayload {
  clinicId: string;
  patientId: string;
  serviceId: string;
  scheduledAt: string;
  paymentModel: ClinicPaymentModel;
  paymentMethod?: ClinicPaymentMethod;
  insurer?: string;
  doctorId?: string;
  notes?: string;
  quotedPrice?: number;
}

export async function createClinicAppointment(payload: CreateClinicAppointmentPayload): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_clinic_appointment', {
    p_clinic_id: payload.clinicId,
    p_patient_id: payload.patientId,
    p_service_id: payload.serviceId,
    p_scheduled_at: payload.scheduledAt,
    p_payment_model: payload.paymentModel,
    p_payment_method: payload.paymentMethod ?? null,
    p_insurer: payload.insurer ?? null,
    p_doctor_id: payload.doctorId ?? null,
    p_notes: payload.notes ?? null,
    p_quoted_price: payload.quotedPrice ?? null,
  });
  if (error || !data) return null;
  return data as string;
}

// ── Financial metrics ─────────────────────────────────────────────────────

export async function getClinicFinancialMetrics(clinicId: string, months = 12): Promise<ClinicFinancialMonthly[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months + 1);
  from.setDate(1);
  const fromStr = from.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('clinic_financial_metrics_monthly')
    .select('*')
    .eq('clinic_id', clinicId)
    .gte('month', fromStr)
    .order('month');

  if (error || !data) return [];
  return data.map(row => ({
    clinic_id: row.clinic_id,
    month: row.month,
    booked_services: Number(row.booked_services ?? 0),
    completed_services: Number(row.completed_services ?? 0),
    cancelled_services: Number(row.cancelled_services ?? 0),
    preauth_rejected_cancelled: Number(row.preauth_rejected_cancelled ?? 0),
    unique_patients: Number(row.unique_patients ?? 0),
    booked_gross_amount: Number(row.booked_gross_amount ?? 0),
    collected_amount: Number(row.collected_amount ?? 0),
    out_of_pocket_collected: Number(row.out_of_pocket_collected ?? 0),
    insurer_collected: Number(row.insurer_collected ?? 0),
    insurer_pipeline_amount: Number(row.insurer_pipeline_amount ?? 0),
    estimated_margin: Number(row.estimated_margin ?? 0),
  }));
}

export async function getClinicRevenueByPaymentMethod(
  clinicId: string,
  month: string,
): Promise<ClinicRevenueByPaymentMethod[]> {
  const { data, error } = await supabase
    .from('clinic_revenue_by_payment_method_monthly')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('month', month)
    .order('collected_amount', { ascending: false });

  if (error || !data) return [];
  return data.map(row => ({
    clinic_id: row.clinic_id,
    month: row.month,
    payment_model: row.payment_model,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    services: Number(row.services ?? 0),
    collected_amount: Number(row.collected_amount ?? 0),
    booked_amount: Number(row.booked_amount ?? 0),
  }));
}

export async function getClinicServiceFinancials(
  clinicId: string,
  month: string,
): Promise<ClinicServiceFinancialMonthly[]> {
  const { data, error } = await supabase
    .from('clinic_service_financials_monthly')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('month', month)
    .order('collected_amount', { ascending: false });

  if (error || !data) return [];
  return data.map(row => ({
    clinic_id: row.clinic_id,
    month: row.month,
    service_type: row.service_type,
    service_name: row.service_name,
    booked_services: Number(row.booked_services ?? 0),
    completed_services: Number(row.completed_services ?? 0),
    collected_amount: Number(row.collected_amount ?? 0),
    avg_ticket: Number(row.avg_ticket ?? 0),
    estimated_margin: Number(row.estimated_margin ?? 0),
  }));
}

// ── Pacientes Ambulatorio ───────────────────────────────────────────────────

export async function listClinicPatients(clinicId: string): Promise<ClinicPatientListItem[]> {
  const { data, error } = await supabase
    .from('clinic_patient_operational_summary')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('active', { ascending: false })
    .order('full_name');

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(row => ({
    ...(row as unknown as ClinicPatient),
    is_recurrent: Boolean(row.is_recurrent),
    visits_total: Number(row.visits_total ?? 0),
    completed_visits: Number(row.completed_visits ?? 0),
    last_visit_at: row.last_visit_at as string | undefined,
    next_visit_at: row.next_visit_at as string | undefined,
    current_status: (row.current_status as ClinicPatientTreatmentStatus | undefined) ?? 'no_activity',
    current_service_name: row.current_service_name as string | undefined,
    current_service_type: row.current_service_type as string | undefined,
    pending_preauth_count: Number(row.pending_preauth_count ?? 0),
    critical_results_count: Number(row.critical_results_count ?? 0),
    open_conversation_count: Number(row.open_conversation_count ?? 0),
    active_assignment_count: Number(row.active_assignment_count ?? 0),
  }));
}

export async function getClinicPatient(patientId: string): Promise<ClinicPatient | null> {
  const { data, error } = await supabase
    .from('clinic_patients')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ClinicPatient;
}

export async function listClinicPatientAppointments(patientId: string): Promise<ServiceAppointment[]> {
  const { data, error } = await supabase
    .from('service_appointments')
    .select('*, clinic_services(name, service_type)')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map(row => {
    const r = row as Record<string, unknown>;
    return {
      ...(r as unknown as ServiceAppointment),
      service_name: (r['clinic_services'] as Record<string, string> | null)?.name,
      service_type: (r['clinic_services'] as Record<string, string> | null)?.service_type,
    };
  });
}

export async function listClinicPatientPreAuthRequests(patientId: string): Promise<PreAuthRequest[]> {
  const { data, error } = await supabase
    .from('pre_auth_requests')
    .select('*, service_appointments(clinic_services(name))')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map(row => {
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

export async function listClinicPatientResults(patientId: string): Promise<ServiceResult[]> {
  const { data, error } = await supabase
    .from('service_results')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as ServiceResult[];
}

export async function listClinicPatientConversations(patientId: string): Promise<ClinicConversation[]> {
  const { data, error } = await supabase
    .from('clinic_conversations')
    .select('*')
    .eq('patient_id', patientId)
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as ClinicConversation[];
}

export async function listClinicPatientResourceAssignments(patientId: string): Promise<ClinicResourceAssignment[]> {
  const { data, error } = await supabase
    .from('clinic_resource_assignments')
    .select('*, clinic_resources(name, short_code, resource_type), service_appointments(clinic_services(name))')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map(row => {
    const r = row as Record<string, unknown>;
    const res = r['clinic_resources'] as Record<string, string> | null;
    const appt = r['service_appointments'] as Record<string, unknown> | null;
    const svc = appt?.['clinic_services'] as Record<string, string> | null;
    return {
      ...(r as unknown as ClinicResourceAssignment),
      resource_name: res?.name,
      resource_short_code: res?.short_code,
      resource_type: res?.resource_type as ClinicResourceAssignment['resource_type'],
      service_name: svc?.name,
    };
  });
}

function byDateDesc<T>(rows: T[], datePicker: (row: T) => string | undefined) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(datePicker(a) ?? '') || 0;
    const bTime = Date.parse(datePicker(b) ?? '') || 0;
    return bTime - aTime;
  });
}

function byDateAsc<T>(rows: T[], datePicker: (row: T) => string | undefined) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(datePicker(a) ?? '') || 0;
    const bTime = Date.parse(datePicker(b) ?? '') || 0;
    return aTime - bTime;
  });
}

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ['checked_in', 'in_progress', 'escalated'];

function deriveTreatmentStatus(
  appointments: ServiceAppointment[],
  pendingPreauth: PreAuthRequest[],
  criticalResults: ServiceResult[],
): ClinicPatientTreatmentStatus {
  if (appointments.some(a => a.status === 'escalated')) return 'escalated';
  if (appointments.some(a => a.status === 'in_progress')) return 'in_progress';
  if (appointments.some(a => a.status === 'checked_in')) return 'checked_in';
  if (criticalResults.some(r => !r.notified_at)) return 'follow_up_required';
  if (pendingPreauth.length > 0) return 'follow_up_required';
  const now = Date.now();
  if (appointments.some(a => a.status === 'scheduled' && Date.parse(a.scheduled_at) >= now)) return 'scheduled';
  if (appointments.some(a => a.status === 'completed')) return 'completed';
  if (appointments.some(a => a.status === 'cancelled' || a.status === 'no_show')) return 'cancelled';
  return 'no_activity';
}

export async function getClinicPatientSummary(patientId: string): Promise<ClinicPatientSummary | null> {
  const patient = await getClinicPatient(patientId);
  if (!patient) return null;

  const [appointments, preauth, results, conversations, assignments] = await Promise.all([
    listClinicPatientAppointments(patientId),
    listClinicPatientPreAuthRequests(patientId),
    listClinicPatientResults(patientId),
    listClinicPatientConversations(patientId),
    listClinicPatientResourceAssignments(patientId),
  ]);

  const now = Date.now();
  const completed = appointments.filter(a => a.status === 'completed');
  const pastAppointments = appointments.filter(a => Date.parse(a.scheduled_at) <= now);
  const futureAppointments = appointments.filter(a => Date.parse(a.scheduled_at) >= now && a.status === 'scheduled');
  const currentAppointment = byDateAsc(
    appointments.filter(a => ACTIVE_APPOINTMENT_STATUSES.includes(a.status)),
    a => a.scheduled_at,
  )[0];
  const pendingPreauth = preauth.filter(p => p.status === 'pending' || p.status === 'in_review');
  const criticalResults = results.filter(r => r.critical);
  const OPEN_CONV: ClinicConversationStatus[] = ['bot', 'waiting_human', 'in_progress', 'escalated'];
  const openConversations = conversations.filter(c => OPEN_CONV.includes(c.status));
  const activeAssignments = assignments.filter(a => a.status === 'active');

  return {
    patient,
    is_recurrent: completed.length > 1 || appointments.length > 1,
    visits_total: appointments.length,
    completed_visits: completed.length,
    cancelled_or_no_show_count: appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length,
    last_visit: byDateDesc(pastAppointments, a => a.scheduled_at)[0],
    next_visit: byDateAsc(futureAppointments, a => a.scheduled_at)[0],
    current_appointment: currentAppointment,
    current_status: deriveTreatmentStatus(appointments, pendingPreauth, criticalResults),
    pending_preauth: pendingPreauth,
    latest_preauth: byDateDesc(preauth, p => p.updated_at ?? p.created_at)[0],
    critical_results: criticalResults,
    latest_result: byDateDesc(results, r => r.created_at)[0],
    open_conversations: openConversations,
    active_assignments: activeAssignments,
  };
}

export async function listClinicPatientTimeline(patientId: string): Promise<ClinicPatientTimelineEvent[]> {
  const { data, error } = await supabase
    .from('clinic_patient_timeline')
    .select('*')
    .eq('patient_id', patientId)
    .order('occurred_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    type: row.event_type as ClinicPatientTimelineEvent['type'],
    occurred_at: row.occurred_at as string,
    title: row.title as string,
    description: row.description as string | undefined,
    severity: row.severity as ClinicPatientTimelineEvent['severity'],
    source_table: row.source_table as string,
    source_id: row.source_id as string,
    metadata: row.metadata as Record<string, unknown> | undefined,
  }));
}
