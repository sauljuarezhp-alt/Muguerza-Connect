import { supabase } from '../lib/supabase';
import { localDateString } from '../lib/dates';
import type { AgendaSlot } from '../types';

const fromRow = (r: any): AgendaSlot => ({
  tm: r.tm,
  day: r.day,
  name: r.name,
  why: r.why,
  status: r.status,
});

export async function listAgendaToday(): Promise<AgendaSlot[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!doctor) return [];

  const today = localDateString();

  const { data, error } = await supabase
    .from('agenda_slots')
    .select('*')
    .eq('doctor_id', doctor.id)
    .eq('day', today)
    .neq('status', 'cancelled')  // canceladas no aparecen, todo lo demás sí
    .order('tm');
  if (error) throw error;
  return (data || []).map(fromRow);
}
