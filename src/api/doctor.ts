import { supabase } from '../lib/supabase';
import type { Doctor } from '../types';

const fromRow = (r: any): Doctor => ({
  id: r.id,
  name: r.name,
  specialty: r.specialty,
  initials: r.initials || '',
  location: r.location || '',
  consultorio: r.consultorio || '',
});

export async function getCurrentDoctor(): Promise<Doctor | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? fromRow(data) : null;
}
