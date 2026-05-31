-- Keep recognized revenue separate from insurer pipeline.

update public.service_appointments
set payment_status = case
    when payment_method = 'cortesia' then 'cortesia'
    else 'pagado'
  end,
  payment_confirmed_at = coalesce(payment_confirmed_at, updated_at, now())
where status = 'completed'
  and payment_status in ('preauth_aprobada', 'preauth_pendiente', 'pendiente');

create or replace view public.clinic_financial_metrics_monthly
with (security_invoker = true)
as
select
  sa.clinic_id,
  date_trunc('month', sa.scheduled_at)::date as month,
  count(*)::int as booked_services,
  count(*) filter (where sa.status = 'completed')::int as completed_services,
  count(*) filter (where sa.status in ('cancelled', 'no_show'))::int as cancelled_services,
  count(*) filter (where sa.cancellation_reason ilike '%pre-autorizacion%' or sa.payment_status = 'preauth_rechazada')::int as preauth_rejected_cancelled,
  count(distinct sa.patient_id)::int as unique_patients,
  coalesce(sum(sa.quoted_price), 0)::numeric(12,2) as booked_gross_amount,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed'), 0)::numeric(12,2) as collected_amount,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed' and sa.payment_model = 'out_of_pocket'), 0)::numeric(12,2) as out_of_pocket_collected,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed' and sa.payment_model = 'aseguradora'), 0)::numeric(12,2) as insurer_collected,
  coalesce(sum(sa.insurer_expected_amount) filter (
    where sa.status <> 'completed'
      and sa.payment_model = 'aseguradora'
      and sa.payment_status in ('preauth_pendiente', 'preauth_aprobada')
  ), 0)::numeric(12,2) as insurer_pipeline_amount,
  coalesce(sum(greatest(sa.amount_collected - coalesce(cs.cost_basis, 0), 0)) filter (where sa.status = 'completed'), 0)::numeric(12,2) as estimated_margin
from public.service_appointments sa
left join public.clinic_services cs on cs.id = sa.service_id
group by sa.clinic_id, date_trunc('month', sa.scheduled_at)::date;

create or replace view public.clinic_revenue_by_payment_method_monthly
with (security_invoker = true)
as
select
  clinic_id,
  date_trunc('month', scheduled_at)::date as month,
  payment_model,
  payment_method,
  payment_status,
  count(*)::int as services,
  coalesce(sum(amount_collected) filter (where status = 'completed'), 0)::numeric(12,2) as collected_amount,
  coalesce(sum(quoted_price), 0)::numeric(12,2) as booked_amount
from public.service_appointments
group by clinic_id, date_trunc('month', scheduled_at)::date, payment_model, payment_method, payment_status;

revoke all on table public.clinic_financial_metrics_monthly from anon;
revoke all on table public.clinic_revenue_by_payment_method_monthly from anon;
grant select on table public.clinic_financial_metrics_monthly to authenticated;
grant select on table public.clinic_revenue_by_payment_method_monthly to authenticated;
