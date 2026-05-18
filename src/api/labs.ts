import { supabase } from '../lib/supabase';
import type { Lab } from '../types';

interface LabRow {
  id: string;
  patient_id: string;
  pdf_path: string | null;
}

export type LabWithMeta = Lab & { id: string; patientId: string; pdfPath: string | null };

const fromRow = (r: any): LabWithMeta => ({
  id: r.id,
  patientId: r.patient_id,
  pdfPath: r.pdf_path,
  n: r.n,
  unit: r.unit,
  val: r.val,
  prev: r.prev,
  range: r.range_,
  delta: r.delta,
  st: r.st,
  dir: r.dir,
});

export async function createLab(entry: {
  patient_id: string;
  n: string;
  val: number;
  unit: string;
  range_: string;
  st: 'ok' | 'hi' | 'lo';
  dir: 'up' | 'down' | 'flat';
  taken_at: string;
}) {
  // Buscar el lab anterior del mismo analito para calcular prev y delta
  const { data: prev } = await supabase
    .from('labs')
    .select('val')
    .eq('patient_id', entry.patient_id)
    .eq('n', entry.n)
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevVal = prev?.val ?? null;
  const delta = prevVal !== null ? +(entry.val - prevVal).toFixed(2) : null;

  // Buscar si ya existe un registro del mismo analito para este paciente
  const { data: existing } = await supabase
    .from('labs')
    .select('id')
    .eq('patient_id', entry.patient_id)
    .eq('n', entry.n)
    .maybeSingle();

  const payload = {
    ...entry,
    prev: prevVal,
    delta: delta !== null ? (delta > 0 ? `+${delta}` : `${delta}`) : null,
  };

  if (existing?.id) {
    const { error } = await supabase.from('labs').update(payload).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('labs').insert(payload);
    if (error) throw error;
  }
}

export async function listLabsForPatient(patientId: string): Promise<LabWithMeta[]> {
  const { data, error } = await supabase
    .from('labs')
    .select('*')
    .eq('patient_id', patientId)
    .order('taken_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}
