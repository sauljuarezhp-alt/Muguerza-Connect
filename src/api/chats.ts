import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../types';

export type ChatChannel = 'nurse' | 'patient';

const fromRow = (r: any): ChatMessage => ({
  t: r.t,
  tm: r.tm,
  body: r.body,
});

export async function listMessages(patientId: string, channel: ChatChannel): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('patient_id', patientId)
    .eq('channel', channel)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function sendMessage(
  patientId: string,
  channel: ChatChannel,
  body: string,
  tm: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ patient_id: patientId, channel, t: 'out', tm, body })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}
