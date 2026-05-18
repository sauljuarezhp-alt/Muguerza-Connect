import { supabase } from '../lib/supabase';
import { Ico } from '../data/icons';
import type { PendingItem } from '../types';

const iconByKey: Record<string, any> = {
  signature: Ico.signature,
  shield: Ico.shield,
  pill: Ico.pill,
  flask: Ico.flask,
  image: Ico.image,
};

const fromRow = (r: any): PendingItem => ({
  id: r.id,
  ico: iconByKey[r.ico] || Ico.file,
  label: r.label,
  sub: r.sub,
  badge: r.badge,
  to: r.to_screen || undefined,
  patientId: r.patient_id || undefined,
});

export async function listPending(): Promise<PendingItem[]> {
  const { data, error } = await supabase
    .from('pending_items')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createPendingItem(item: {
  ico: string;
  label: string;
  sub: string;
  badge: string;
  patient_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from('pending_items')
    .insert([item]);
    
  if (error) throw error;
}

// Completa la orden: inserta en historial y elimina el pendiente
export async function resolvePendingItem(id: string): Promise<void> {
  const { data: item } = await supabase
    .from('pending_items')
    .select('*')
    .eq('id', id)
    .single();

  if (item?.patient_id) {
    await supabase.from('patient_history').insert({
      patient_id: item.patient_id,
      type: 'orden',
      title: item.label,
      description: item.sub,
      icon: item.ico || 'flask',
      source_table: 'pending_items',
      source_id: item.id,
      event_type: 'legacy_order_note',
      occurred_at: new Date().toISOString(),
      metadata: {
        pending_item_id: item.id,
        pending_label: item.label,
        pending_badge: item.badge,
        resolved_from_pending_item: true,
      },
    });
  }

  const { error } = await supabase
    .from('pending_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
