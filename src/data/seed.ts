// Seed data — placeholder hasta que esté conectado a Supabase.
// Estructuras tipadas listas para reemplazarse por respuestas de API.
import { Ico } from './icons';
import type { Doctor, Patient, AgendaSlot, Alert, Lab, ChatMessage, InboxItem, PendingItem } from '../types';

export const DOCTOR: Doctor = {
  id: '',
  name: 'Dr. R. Villarreal',
  specialty: 'Oncología Médica',
  initials: 'RV',
  location: 'CHRISTUS Muguerza Alta Especialidad',
  consultorio: 'Torre A · 803',
};

export const PATIENTS: Patient[] = [
  {
    id: 'p1', name: 'María de los Ángeles González',
    age: 58, sex: 'F', expediente: 'MGZ-082341',
    dx: 'Ca mama estadio IIB · post-QT ciclo 3',
    insurer: 'GNP Seguros', policy: 'SGMM-GNP 4471-29',
    status: 'red', statusLabel: 'Evento agudo',
    lastVisit: '19 Abr 2026', nextVisit: '28 Abr 2026',
    hospitalized: false,
    meds: ['Paclitaxel 175 mg/m² — ciclo 3/6', 'Ondansetrón 8 mg c/8h', 'Dexametasona 4 mg BID'],
    allergies: ['Sulfas'],
    vitals: { hr: 128, bp: '88/54', temp: 39.4, spo2: 91 },
    authStatus: 'approved', authStep: 4,
  },
  {
    id: 'p2', name: 'Jorge Alfonso Treviño',
    age: 64, sex: 'M', expediente: 'MGZ-051729',
    dx: 'Adenocarcinoma pulmonar · pre-Qx',
    insurer: 'AXA', policy: 'SGMM-AXA 882-11',
    status: 'amber', statusLabel: 'Autorización pendiente',
    lastVisit: '21 Abr 2026', nextVisit: '24 Abr 2026',
    meds: ['Enoxaparina 40 mg SC', 'Omeprazol 20 mg'],
    authStatus: 'pending', authStep: 2,
  },
  {
    id: 'p3', name: 'Patricia Villarreal Salinas',
    age: 47, sex: 'F', expediente: 'MGZ-093220',
    dx: 'Linfoma No-Hodgkin · remisión',
    insurer: 'MetLife', policy: 'SGMM-MET 6631-08',
    status: 'green', statusLabel: 'Estable',
    lastVisit: '14 Abr 2026', nextVisit: '12 May 2026',
    authStatus: 'approved', authStep: 4,
  },
  {
    id: 'p4', name: 'Ernesto Cavazos López',
    age: 71, sex: 'M', expediente: 'MGZ-112004',
    dx: 'Ca próstata · terapia hormonal',
    insurer: 'GNP Seguros', policy: 'SGMM-GNP 7712-03',
    status: 'green', statusLabel: 'Control',
    lastVisit: '10 Abr 2026', nextVisit: '10 May 2026',
  },
  {
    id: 'p5', name: 'Lucía Fernández Ayala',
    age: 52, sex: 'F', expediente: 'MGZ-067812',
    dx: 'Ca colon estadio III · post-Qx día 14',
    insurer: 'AXA', policy: 'SGMM-AXA 445-72',
    status: 'amber', statusLabel: 'Resultado anormal',
    lastVisit: '22 Abr 2026', nextVisit: '25 Abr 2026',
    hospitalized: true,
  },
  {
    id: 'p6', name: 'Rafael Montemayor Escobedo',
    age: 68, sex: 'M', expediente: 'MGZ-044091',
    dx: 'Mieloma múltiple · ciclo 2',
    insurer: 'Plan MAYO', policy: 'SGMM-MAY 2208-14',
    status: 'green', statusLabel: 'Estable',
    lastVisit: '17 Abr 2026', nextVisit: '01 May 2026',
  },
];

export const AGENDA: AgendaSlot[] = [
  { tm: '08:30', day: 'Hoy', name: 'Jorge A. Treviño', why: 'Consulta pre-quirúrgica', status: 'checked' },
  { tm: '09:15', day: 'Hoy', name: 'Patricia Villarreal', why: 'Control post-QT · ciclo 6', status: 'checked' },
  { tm: '10:00', day: 'Hoy', name: 'Ernesto Cavazos', why: 'Revisión hormonal', status: 'waiting' },
  { tm: '11:30', day: 'Hoy', name: 'Rafael Montemayor', why: 'Infusión ciclo 2', status: 'upcoming' },
  { tm: '13:00', day: 'Hoy', name: 'Lucía Fernández', why: 'Interconsulta · Dr. Salinas', status: 'upcoming' },
];

export const ALERTS: Alert[] = [
  {
    sev: 'red', time: '03:12',
    patient: 'María de los Ángeles González', patientId: 'p1',
    event: 'Fiebre 39.4°C · HR 128 · dolor 8/10',
    nurse: 'Enf. Karla Muñoz', tag: 'Guardia · Torre A',
  },
  {
    sev: 'amber', time: '07:05',
    patient: 'Jorge Alfonso Treviño', patientId: 'p2',
    event: 'SGMM AXA — autorización detenida por documentación',
  },
  {
    sev: 'amber', time: '07:22',
    patient: 'Lucía Fernández Ayala', patientId: 'p5',
    event: 'Hemoglobina 8.4 g/dL — fuera de rango',
  },
];

export const LABS: Lab[] = [
  { n: 'Hemoglobina', unit: 'g/dL', val: '8.4', prev: '10.1', range: '12.0–16.0', delta: '−1.7', st: 'lo', dir: 'down' },
  { n: 'Leucocitos', unit: '×10³/µL', val: '2.1', prev: '3.8', range: '4.0–11.0', delta: '−1.7', st: 'lo', dir: 'down' },
  { n: 'Neutrófilos absolutos', unit: '×10³/µL', val: '0.9', prev: '1.6', range: '1.8–7.7', delta: '−0.7', st: 'lo', dir: 'down' },
  { n: 'Plaquetas', unit: '×10³/µL', val: '128', prev: '151', range: '150–450', delta: '−23', st: 'lo', dir: 'down' },
  { n: 'Creatinina', unit: 'mg/dL', val: '1.1', prev: '1.0', range: '0.5–1.1', delta: '+0.1', st: 'ok', dir: 'flat' },
  { n: 'PCR', unit: 'mg/L', val: '48', prev: '12', range: '0–5', delta: '+36', st: 'hi', dir: 'up' },
];

export const CHAT_PATIENT: ChatMessage[] = [
  { t: 'in', tm: 'ayer 18:42', body: 'Dr. buenas tardes. La infusión me dejó con mucha náusea otra vez, incluso con el medicamento.' },
  { t: 'out', tm: 'ayer 19:10', body: 'Hola María. Aumenta el ondansetrón a c/6h por 48h. ¿Cómo va el apetito?' },
  { t: 'in', tm: 'ayer 19:14', body: 'Muy bajo. Pude desayunar algo ligero apenas.' },
  { t: 'out', tm: 'ayer 19:16', body: 'OK. Intenta hidratación por vía oral cada hora. Si la fiebre sube de 38° escríbeme.' },
  { t: 'in', tm: 'hoy 03:08', body: 'Dr. tengo fiebre. 39.4. Me siento muy mal.' },
  { t: 'in', tm: 'hoy 03:09', body: 'Llamé al número de guardia. Ya me contactó la enfermera Karla.' },
];

export const CHAT_NURSE: ChatMessage[] = [
  { t: 'in', tm: 'hoy 03:11', body: 'Dr. Villarreal, la Sra. González reporta fiebre 39.4, HR 128, TA 88/54 y dolor abdominal difuso 8/10. Evalué por teléfono.' },
  { t: 'in', tm: 'hoy 03:12', body: 'Criterios de sepsis + neutropenia probable post-QT ciclo 3. ¿Autoriza traslado a urgencias Torre A?' },
  { t: 'out', tm: 'hoy 03:13', body: 'Sí. Autorizado traslado. Inicia protocolo de neutropenia febril. Voy en camino.' },
  { t: 'out', tm: 'hoy 03:13', body: 'Ordena hemocultivos × 2, BH con diferencial, PCR, lactato. Cefepime 2g IV stat.' },
  { t: 'in', tm: 'hoy 03:14', body: 'Recibido. Órdenes firmando en Connect, iniciando protocolo ya. Cubículo 3 asignado.' },
];

export const INBOX: InboxItem[] = [
  { src: 'enfermería', sev: 'red', time: '03:12', subject: 'Alerta roja · Fiebre neutropénica', preview: 'Sra. González 39.4°C, HR 128, TA 88/54. Requiere decisión urgente.', patient: 'María G. González', patientId: 'p1' },
  { src: 'paciente', sev: 'red', time: '03:08', subject: 'Mensaje de urgencia', preview: 'Dr. tengo fiebre 39.4, me siento muy mal…', patient: 'María G. González', patientId: 'p1' },
  { src: 'aseguradora', sev: 'amber', time: '07:05', subject: 'SGMM AXA · Documentación requerida', preview: 'Solicitan reporte TAC actualizado para autorizar cirugía pulmonar.', patient: 'Jorge A. Treviño', patientId: 'p2' },
  { src: 'resultados', sev: 'amber', time: '07:22', subject: 'Lab · Hemoglobina 8.4 g/dL', preview: 'Resultado fuera de rango. Tendencia descendente respecto a control previo.', patient: 'Lucía Fernández', patientId: 'p5' },
  { src: 'aseguradora', sev: 'green', time: '06:48', subject: 'SGMM GNP · Autorización aprobada', preview: 'Procedimiento #4471-29 aprobado. Paciente puede agendar.', patient: 'María G. González', patientId: 'p1' },
  { src: 'resultados', sev: 'green', time: '06:30', subject: 'Imagen · TAC toracoabdominal', preview: 'Estudio disponible en Connect para revisión y firma.', patient: 'Jorge A. Treviño', patientId: 'p2' },
  { src: 'paciente', sev: 'green', time: '06:15', subject: 'Confirma cita 28 Abr', preview: 'Hola Dr, confirmo la cita del próximo martes a las 10:00.', patient: 'Ernesto Cavazos', patientId: 'p4' },
  { src: 'enfermería', sev: 'green', time: '05:58', subject: 'Turno entregado · Torre A 803', preview: 'Enf. Muñoz → Enf. Rivera. Sin pendientes clínicos adicionales.', patient: null, patientId: null },
];

export const PENDING: PendingItem[] = [
  { ico: Ico.signature, label: 'Firmar 3 órdenes de lab',  sub: 'Jorge A. Treviño · Lucía F. · Rafael M.', badge: '3', to: 'patients' },
  { ico: Ico.shield,    label: 'Adjuntar documento SGMM',  sub: 'Jorge A. Treviño · TAC toracoabdominal',    badge: '1', patientId: 'p2' },
  { ico: Ico.pill,      label: 'Receta post-QT para envío', sub: 'María G. González · WhatsApp al paciente',  badge: '1', patientId: 'p1' },
];
