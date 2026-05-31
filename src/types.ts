export type Sev = 'red' | 'amber' | 'green';
export type AuthStatus = 'approved' | 'pending';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  location: string;
  consultorio: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: 'F' | 'M';
  expediente: string;
  dx: string;
  insurer: string;
  policy: string;
  status: Sev;
  statusLabel: string;
  lastVisit: string;
  nextVisit: string;
  hospitalized?: boolean;
  meds?: string[];
  allergies?: string[];
  vitals?: { hr: number; bp: string; temp: number; spo2: number };
  vitalsRecordedAt?: string;
  authStatus?: AuthStatus;
  authStep?: number;
  authNote?: string;
  deducible?: string;
  coaseguro?: string;
  vigenciaPoliza?: string;
}

export interface AgendaSlot {
  tm: string;
  day: string;
  name: string;
  why: string;
  status: 'checked' | 'waiting' | 'upcoming';
}

export interface Alert {
  sev: Sev;
  time: string;
  patient: string;
  patientId: string;
  event: string;
  nurse?: string;
  tag?: string;
  body?: React.ReactNode;
}

export interface Lab {
  n: string;
  unit: string;
  val: string;
  prev: string;
  range: string;
  delta: string;
  st: 'hi' | 'lo' | 'ok';
  dir: 'up' | 'down' | 'flat';
}

export interface ChatMessage {
  t: 'in' | 'out';
  tm: string;
  body: string;
}

export interface InboxItem {
  src: 'enfermería' | 'paciente' | 'aseguradora' | 'resultados';
  id?: string; 
  sev: Sev;
  time: string;
  subject: string;
  preview: string;
  patient: string | null;
  patientId: string | null;
}

export interface PendingItem {
  id?: string;
  ico: React.ReactNode;
  label: string;
  sub: string;
  badge: string;
  to?: string;
  patientId?: string;
}

export interface Tweaks {
  showRedAlert: boolean;
  startScreen: string;
  patientDefaultTab: string;
  darkModeCritical: boolean;
  brandColor: string;
}

// ── Clinic Ambulatorio Module ──────────────────────────────────────────────

export interface Clinic {
  id: string;
  name: string;
  location: string;
  type: 'organic' | 'spoke';
  hub_clinic_id?: string;
}

export interface ClinicStaff {
  id: string;
  user_id: string;
  clinic_id: string;
  name: string;
  role: 'admin' | 'receptionist' | 'coordinator';
  clinic: Clinic;
}

export type AppointmentStatus = 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'escalated' | 'no_show';
export type PreAuthStatus = 'not_required' | 'pending' | 'in_review' | 'approved' | 'rejected';
export type ClinicPaymentModel = 'out_of_pocket' | 'insurer';
export type ClinicPaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'cortesia';
export type ClinicPaymentStatus = 'pendiente' | 'preauth_pendiente' | 'preauth_aprobada' | 'preauth_rechazada' | 'pagado' | 'cancelado' | 'cortesia' | 'reembolsado';

export interface ClinicService {
  id: string;
  clinic_id: string;
  service_type: string;
  name: string;
  duration_min: number;
  active: boolean;
  list_price: number;
  insurer_price?: number;
  cost_basis?: number;
  payment_required: boolean;
  created_at: string;
}

export interface ServiceAppointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  service_id: string;
  doctor_id?: string;
  scheduled_at: string;
  status: AppointmentStatus;
  insurer: string;
  pre_auth_status: PreAuthStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  payment_model: ClinicPaymentModel;
  payment_method: ClinicPaymentMethod;
  payment_status: ClinicPaymentStatus;
  quoted_price: number;
  patient_responsibility_amount: number;
  insurer_expected_amount: number;
  amount_collected: number;
  payment_confirmed_at?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  // joined
  patient_name?: string;
  service_name?: string;
  service_type?: string;
}

export interface ClinicFinancialMonthly {
  clinic_id: string;
  month: string;
  booked_services: number;
  completed_services: number;
  cancelled_services: number;
  preauth_rejected_cancelled: number;
  unique_patients: number;
  booked_gross_amount: number;
  collected_amount: number;
  out_of_pocket_collected: number;
  insurer_collected: number;
  insurer_pipeline_amount: number;
  estimated_margin: number;
}

export interface ClinicRevenueByPaymentMethod {
  clinic_id: string;
  month: string;
  payment_model: ClinicPaymentModel;
  payment_method: ClinicPaymentMethod | null;
  payment_status: ClinicPaymentStatus;
  services: number;
  collected_amount: number;
  booked_amount: number;
}

export interface ClinicServiceFinancialMonthly {
  clinic_id: string;
  month: string;
  service_type: string;
  service_name: string;
  booked_services: number;
  completed_services: number;
  collected_amount: number;
  avg_ticket: number;
  estimated_margin: number;
}

export interface PreAuthRequest {
  id: string;
  service_appointment_id: string;
  patient_id: string;
  clinic_id: string;
  insurer: string;
  folio_aseguradora?: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  submitted_at?: string;
  resolved_at?: string;
  documents: Record<string, unknown>[];
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  patient_name?: string;
  service_name?: string;
}

export interface ServiceResult {
  id: string;
  service_appointment_id: string;
  patient_id: string;
  clinic_id: string;
  result_type: 'lab' | 'imaging' | 'procedure_note';
  storage_path?: string;
  bucket?: string;
  critical: boolean;
  notified_at?: string;
  reviewed_by?: string;
  notes?: string;
  created_at: string;
  // joined
  patient_name?: string;
}

export type ClinicResourceType = 'infusion_chair' | 'lab_station' | 'imaging_room' | 'surgery_room' | 'consult_room';

export interface ClinicResource {
  id: string;
  clinic_id: string;
  resource_type: ClinicResourceType;
  name: string;
  short_code?: string;
  position: number;
  capacity: number;
  active: boolean;
  notes?: string;
  created_at: string;
}

export interface ClinicResourceAssignment {
  id: string;
  resource_id: string;
  appointment_id: string;
  clinic_id: string;
  patient_id: string;
  started_at: string;
  expected_end_at?: string;
  ended_at?: string;
  status: 'active' | 'freed';
  assigned_by?: string;
  manual: boolean;
  // joined
  resource_name?: string;
  resource_short_code?: string;
  resource_type?: ClinicResourceType;
  service_name?: string;
}

export type ClinicConversationStatus = 'bot' | 'waiting_human' | 'in_progress' | 'resolved' | 'escalated';
export type ClinicConversationIntent = 'appointment' | 'preauth' | 'result' | 'follow_up' | 'escalation' | 'general';
export type ClinicChatMessageType = 'in' | 'out' | 'bot' | 'system';

export interface ClinicConversation {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone?: string;
  channel: 'whatsapp' | 'sms' | 'web' | 'phone';
  status: ClinicConversationStatus;
  intent?: ClinicConversationIntent;
  assigned_to?: string;
  related_appointment_id?: string;
  last_message_at: string;
  last_message_preview?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClinicChatMessage {
  id: string;
  conversation_id: string;
  clinic_id: string;
  t: ClinicChatMessageType;
  body: string;
  tm: string;
  author_staff_id?: string;
  read_at?: string;
  created_at: string;
}

export interface ClinicalEscalation {
  id: string;
  service_appointment_id: string;
  clinic_id: string;
  trigger_reason: string;
  destination: 'hub_hospital' | '911' | 'other';
  patient_stability: 'stable' | 'unstable';
  status: 'active' | 'transferred' | 'resolved';
  triggered_at: string;
  resolved_at?: string;
  notes?: string;
  // joined
  patient_name?: string;
}

// ── Pacientes Ambulatorio ───────────────────────────────────────────────────

export interface ClinicPatient {
  id: string;
  clinic_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  sex?: 'F' | 'M' | 'O' | 'unknown';
  date_of_birth?: string;
  external_patient_ref?: string;
  insurer?: string;
  policy_number?: string;
  emergency_contact: Record<string, unknown>;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ClinicPatientTreatmentStatus =
  | 'no_activity'
  | 'scheduled'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'follow_up_required'
  | 'escalated'
  | 'cancelled';

export interface ClinicPatientListItem extends ClinicPatient {
  is_recurrent: boolean;
  visits_total: number;
  completed_visits: number;
  last_visit_at?: string;
  next_visit_at?: string;
  current_status: ClinicPatientTreatmentStatus;
  current_service_name?: string;
  current_service_type?: string;
  pending_preauth_count: number;
  critical_results_count: number;
  open_conversation_count: number;
  active_assignment_count: number;
}

export interface ClinicPatientSummary {
  patient: ClinicPatient;
  is_recurrent: boolean;
  visits_total: number;
  completed_visits: number;
  cancelled_or_no_show_count: number;
  last_visit?: ServiceAppointment;
  next_visit?: ServiceAppointment;
  current_appointment?: ServiceAppointment;
  current_status: ClinicPatientTreatmentStatus;
  pending_preauth: PreAuthRequest[];
  latest_preauth?: PreAuthRequest;
  critical_results: ServiceResult[];
  latest_result?: ServiceResult;
  open_conversations: ClinicConversation[];
  active_assignments: ClinicResourceAssignment[];
}

export type ClinicPatientTimelineEventType =
  | 'appointment'
  | 'preauth'
  | 'result'
  | 'conversation'
  | 'resource'
  | 'audit';

export interface ClinicPatientTimelineEvent {
  id: string;
  type: ClinicPatientTimelineEventType;
  occurred_at: string;
  title: string;
  description?: string;
  severity?: 'neutral' | 'info' | 'warning' | 'critical' | 'success';
  source_table: string;
  source_id: string;
  metadata?: Record<string, unknown>;
}
