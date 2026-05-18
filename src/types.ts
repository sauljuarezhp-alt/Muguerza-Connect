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
