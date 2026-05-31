-- created_by on service_appointments/pre_auth_requests references auth.users,
-- not clinic_staff. Keep actor_staff_id in clinic_audit_log.

create or replace function public.create_clinic_appointment(
  p_clinic_id uuid,
  p_patient_id text,
  p_service_id uuid,
  p_scheduled_at timestamptz,
  p_payment_model text,
  p_payment_method text default null,
  p_insurer text default null,
  p_doctor_id uuid default null,
  p_notes text default null,
  p_quoted_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_service public.clinic_services%rowtype;
  v_patient public.clinic_patients%rowtype;
  v_staff_id uuid;
  v_actor_user_id uuid := (select auth.uid());
  v_appointment public.service_appointments%rowtype;
  v_preauth public.pre_auth_requests%rowtype;
  v_payment_method text;
  v_quoted_price numeric(12,2);
begin
  if v_actor_user_id is null then
    return null;
  end if;

  if p_payment_model not in ('out_of_pocket', 'aseguradora') then
    return null;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = v_actor_user_id
    and clinic_id = p_clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null or not private.is_clinic_staff_for(p_clinic_id) then
    return null;
  end if;

  select * into v_service
  from public.clinic_services
  where id = p_service_id
    and clinic_id = p_clinic_id
    and active = true;

  select * into v_patient
  from public.clinic_patients
  where id = p_patient_id
    and clinic_id = p_clinic_id
    and active = true;

  if v_service.id is null or v_patient.id is null then
    return null;
  end if;

  v_payment_method := coalesce(
    nullif(btrim(p_payment_method), ''),
    case when p_payment_model = 'aseguradora' then 'aseguradora' else 'efectivo' end
  );

  if v_payment_method not in ('efectivo', 'tarjeta', 'transferencia', 'aseguradora', 'cortesia', 'pendiente') then
    return null;
  end if;

  if p_payment_model = 'aseguradora' and coalesce(nullif(btrim(coalesce(p_insurer, '')), ''), v_patient.insurer) is null then
    return null;
  end if;

  v_quoted_price := coalesce(p_quoted_price, v_service.list_price, 0);

  insert into public.service_appointments (
    clinic_id,
    patient_id,
    service_id,
    doctor_id,
    scheduled_at,
    status,
    insurer,
    pre_auth_status,
    notes,
    created_by,
    payment_model,
    payment_method,
    payment_status,
    quoted_price,
    patient_responsibility_amount,
    insurer_expected_amount,
    amount_collected
  )
  values (
    p_clinic_id,
    p_patient_id,
    p_service_id,
    p_doctor_id,
    p_scheduled_at,
    'scheduled',
    case when p_payment_model = 'aseguradora' then coalesce(nullif(btrim(p_insurer), ''), v_patient.insurer) else null end,
    case when p_payment_model = 'aseguradora' then 'pending' else 'not_required' end,
    p_notes,
    v_actor_user_id,
    p_payment_model,
    v_payment_method,
    case when p_payment_model = 'aseguradora' then 'preauth_pendiente' else 'pendiente' end,
    v_quoted_price,
    case when p_payment_model = 'aseguradora' then 0 else v_quoted_price end,
    case when p_payment_model = 'aseguradora' then coalesce(v_service.insurer_price, v_quoted_price) else 0 end,
    0
  )
  returning * into v_appointment;

  perform private.write_clinic_audit_log(
    v_appointment.clinic_id,
    v_staff_id,
    'appointment.created',
    'service_appointments',
    v_appointment.id::text,
    v_appointment.patient_id,
    v_appointment.id,
    null,
    null,
    null,
    to_jsonb(v_appointment),
    jsonb_build_object('rpc', 'create_clinic_appointment', 'payment_model', v_appointment.payment_model, 'payment_method', v_appointment.payment_method)
  );

  if p_payment_model = 'aseguradora' then
    insert into public.pre_auth_requests (
      service_appointment_id,
      patient_id,
      clinic_id,
      insurer,
      status,
      submitted_at,
      documents,
      notes,
      created_by
    )
    values (
      v_appointment.id,
      v_appointment.patient_id,
      v_appointment.clinic_id,
      coalesce(v_appointment.insurer, v_patient.insurer, 'Aseguradora pendiente'),
      'pending',
      now(),
      '[]'::jsonb,
      'Generada automaticamente al agendar con pago por aseguradora.',
      v_actor_user_id
    )
    returning * into v_preauth;

    perform private.write_clinic_audit_log(
      v_appointment.clinic_id,
      v_staff_id,
      'preauth.created_from_appointment',
      'pre_auth_requests',
      v_preauth.id::text,
      v_preauth.patient_id,
      v_appointment.id,
      null,
      null,
      null,
      to_jsonb(v_preauth),
      jsonb_build_object('rpc', 'create_clinic_appointment')
    );
  end if;

  return v_appointment.id;
end;
$$;

revoke execute on function public.create_clinic_appointment(uuid, text, uuid, timestamptz, text, text, text, uuid, text, numeric) from public, anon;
grant execute on function public.create_clinic_appointment(uuid, text, uuid, timestamptz, text, text, text, uuid, text, numeric) to authenticated;
