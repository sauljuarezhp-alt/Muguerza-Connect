-- ============================================================================
-- Muguerza Connect — Seed inicial (datos demo)
-- Pegar en SQL Editor DESPUÉS de schema.sql
-- ============================================================================

-- DOCTOR
insert into public.doctors (id, name, specialty, initials, location, consultorio)
values ('00000000-0000-0000-0000-000000000001',
        'Dr. R. Villarreal',
        'Oncología Médica',
        'RV',
        'CHRISTUS Muguerza Alta Especialidad',
        'Torre A · 803')
on conflict (id) do nothing;

-- PATIENTS
insert into public.patients (id,name,age,sex,expediente,dx,insurer,policy,status,status_label,last_visit,next_visit,hospitalized,meds,allergies,vitals,auth_status,auth_step,doctor_id) values
('p1','María de los Ángeles González',58,'F','MGZ-082341','Ca mama estadio IIB · post-QT ciclo 3','GNP Seguros','SGMM-GNP 4471-29','red','Evento agudo','19 Abr 2026','28 Abr 2026',false,
  array['Paclitaxel 175 mg/m² — ciclo 3/6','Ondansetrón 8 mg c/8h','Dexametasona 4 mg BID'],
  array['Sulfas'],
  '{"hr":128,"bp":"88/54","temp":39.4,"spo2":91}'::jsonb,'approved',4,'00000000-0000-0000-0000-000000000001'),
('p2','Jorge Alfonso Treviño',64,'M','MGZ-051729','Adenocarcinoma pulmonar · pre-Qx','AXA','SGMM-AXA 882-11','amber','Autorización pendiente','21 Abr 2026','24 Abr 2026',false,
  array['Enoxaparina 40 mg SC','Omeprazol 20 mg'],
  array[]::text[], null,'pending',2,'00000000-0000-0000-0000-000000000001'),
('p3','Patricia Villarreal Salinas',47,'F','MGZ-093220','Linfoma No-Hodgkin · remisión','MetLife','SGMM-MET 6631-08','green','Estable','14 Abr 2026','12 May 2026',false,
  array[]::text[],array[]::text[],null,'approved',4,'00000000-0000-0000-0000-000000000001'),
('p4','Ernesto Cavazos López',71,'M','MGZ-112004','Ca próstata · terapia hormonal','GNP Seguros','SGMM-GNP 7712-03','green','Control','10 Abr 2026','10 May 2026',false,
  array[]::text[],array[]::text[],null,null,null,'00000000-0000-0000-0000-000000000001'),
('p5','Lucía Fernández Ayala',52,'F','MGZ-067812','Ca colon estadio III · post-Qx día 14','AXA','SGMM-AXA 445-72','amber','Resultado anormal','22 Abr 2026','25 Abr 2026',true,
  array[]::text[],array[]::text[],null,null,null,'00000000-0000-0000-0000-000000000001'),
('p6','Rafael Montemayor Escobedo',68,'M','MGZ-044091','Mieloma múltiple · ciclo 2','Plan MAYO','SGMM-MAY 2208-14','green','Estable','17 Abr 2026','01 May 2026',false,
  array[]::text[],array[]::text[],null,null,null,'00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- AGENDA HOY
insert into public.agenda_slots (patient_id, tm, day, name, why, status) values
('p2','08:30','Hoy','Jorge A. Treviño','Consulta pre-quirúrgica','checked'),
('p3','09:15','Hoy','Patricia Villarreal','Control post-QT · ciclo 6','checked'),
('p4','10:00','Hoy','Ernesto Cavazos','Revisión hormonal','waiting'),
('p6','11:30','Hoy','Rafael Montemayor','Infusión ciclo 2','upcoming'),
('p5','13:00','Hoy','Lucía Fernández','Interconsulta · Dr. Salinas','upcoming');

-- ALERTS
insert into public.alerts (patient_id, sev, time, patient, event, nurse, tag) values
('p1','red',  '03:12','María de los Ángeles González','Fiebre 39.4°C · HR 128 · dolor 8/10','Enf. Karla Muñoz','Guardia · Torre A'),
('p2','amber','07:05','Jorge Alfonso Treviño','SGMM AXA — autorización detenida por documentación', null, null),
('p5','amber','07:22','Lucía Fernández Ayala','Hemoglobina 8.4 g/dL — fuera de rango', null, null);

-- LABS (todos pertenecen a p1 para el caso clínico activo)
insert into public.labs (patient_id, n, unit, val, prev, range_, delta, st, dir) values
('p1','Hemoglobina','g/dL','8.4','10.1','12.0–16.0','−1.7','lo','down'),
('p1','Leucocitos','×10³/µL','2.1','3.8','4.0–11.0','−1.7','lo','down'),
('p1','Neutrófilos absolutos','×10³/µL','0.9','1.6','1.8–7.7','−0.7','lo','down'),
('p1','Plaquetas','×10³/µL','128','151','150–450','−23','lo','down'),
('p1','Creatinina','mg/dL','1.1','1.0','0.5–1.1','+0.1','ok','flat'),
('p1','PCR','mg/L','48','12','0–5','+36','hi','up');

-- INBOX
insert into public.inbox_items (patient_id, src, sev, time, subject, preview, patient) values
('p1','enfermería','red','03:12','Alerta roja · Fiebre neutropénica','Sra. González 39.4°C, HR 128, TA 88/54. Requiere decisión urgente.','María G. González'),
('p1','paciente','red','03:08','Mensaje de urgencia','Dr. tengo fiebre 39.4, me siento muy mal…','María G. González'),
('p2','aseguradora','amber','07:05','SGMM AXA · Documentación requerida','Solicitan reporte TAC actualizado para autorizar cirugía pulmonar.','Jorge A. Treviño'),
('p5','resultados','amber','07:22','Lab · Hemoglobina 8.4 g/dL','Resultado fuera de rango. Tendencia descendente respecto a control previo.','Lucía Fernández'),
('p1','aseguradora','green','06:48','SGMM GNP · Autorización aprobada','Procedimiento #4471-29 aprobado. Paciente puede agendar.','María G. González'),
('p2','resultados','green','06:30','Imagen · TAC toracoabdominal','Estudio disponible en Connect para revisión y firma.','Jorge A. Treviño'),
('p4','paciente','green','06:15','Confirma cita 28 Abr','Hola Dr, confirmo la cita del próximo martes a las 10:00.','Ernesto Cavazos'),
(null,'enfermería','green','05:58','Turno entregado · Torre A 803','Enf. Muñoz → Enf. Rivera. Sin pendientes clínicos adicionales.', null);

-- CHAT — paciente (WhatsApp)
insert into public.chat_messages (patient_id, channel, t, tm, body) values
('p1','patient','in', 'ayer 18:42','Dr. buenas tardes. La infusión me dejó con mucha náusea otra vez, incluso con el medicamento.'),
('p1','patient','out','ayer 19:10','Hola María. Aumenta el ondansetrón a c/6h por 48h. ¿Cómo va el apetito?'),
('p1','patient','in', 'ayer 19:14','Muy bajo. Pude desayunar algo ligero apenas.'),
('p1','patient','out','ayer 19:16','OK. Intenta hidratación por vía oral cada hora. Si la fiebre sube de 38° escríbeme.'),
('p1','patient','in', 'hoy 03:08','Dr. tengo fiebre. 39.4. Me siento muy mal.'),
('p1','patient','in', 'hoy 03:09','Llamé al número de guardia. Ya me contactó la enfermera Karla.');

-- CHAT — enfermería
insert into public.chat_messages (patient_id, channel, t, tm, body) values
('p1','nurse','in', 'hoy 03:11','Dr. Villarreal, la Sra. González reporta fiebre 39.4, HR 128, TA 88/54 y dolor abdominal difuso 8/10. Evalué por teléfono.'),
('p1','nurse','in', 'hoy 03:12','Criterios de sepsis + neutropenia probable post-QT ciclo 3. ¿Autoriza traslado a urgencias Torre A?'),
('p1','nurse','out','hoy 03:13','Sí. Autorizado traslado. Inicia protocolo de neutropenia febril. Voy en camino.'),
('p1','nurse','out','hoy 03:13','Ordena hemocultivos × 2, BH con diferencial, PCR, lactato. Cefepime 2g IV stat.'),
('p1','nurse','in', 'hoy 03:14','Recibido. Órdenes firmando en Connect, iniciando protocolo ya. Cubículo 3 asignado.');

-- PENDING
insert into public.pending_items (ico, label, sub, badge, to_screen, patient_id) values
('signature','Firmar 3 órdenes de lab','Jorge A. Treviño · Lucía F. · Rafael M.','3','patients', null),
('shield','Adjuntar documento SGMM','Jorge A. Treviño · TAC toracoabdominal','1', null,'p2'),
('pill','Receta post-QT para envío','María G. González · WhatsApp al paciente','1', null,'p1');
