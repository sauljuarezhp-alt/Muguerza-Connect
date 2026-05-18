import { supabase } from '../lib/supabase';

export type Bucket = 'estudios' | 'polizas';

export async function getSignedUrl(bucket: Bucket, path: string, expiresIn = 60 * 5): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadDocument(bucket: Bucket, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;
}
