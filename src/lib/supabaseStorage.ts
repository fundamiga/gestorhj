import { createClient } from '@supabase/supabase-js';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || '';
const SUPABASE_STORAGE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_ANON_KEY || '';

// Solo crear el cliente si las variables existen para evitar el error de "supabaseUrl is required"
export const supabaseStorage = (SUPABASE_STORAGE_URL && SUPABASE_STORAGE_ANON_KEY) 
  ? createClient(SUPABASE_STORAGE_URL, SUPABASE_STORAGE_ANON_KEY)
  : null as any;

// Helper para subir al bucket correcto probando ambas variantes
export async function uploadToCorrectBucket(path: string, file: File): Promise<{url: string, path: string}> {
  if (!supabaseStorage) throw new Error('Configuración de almacenamiento de respaldo incompleta (faltan variables de entorno)');
  
  // Intentar con Mayúsculas primero (según captura)
  let bucket = 'EXPEDIENTES';
  let { error } = await supabaseStorage.storage.from(bucket).upload(path, file);
  
  if (error && error.message.includes('Bucket not found')) {
    // Si falla, intentar con Minúsculas
    bucket = 'expedientes';
    const retry = await supabaseStorage.storage.from(bucket).upload(path, file);
    if (retry.error) throw retry.error;
  } else if (error) {
    throw error;
  }
  
  const { data } = supabaseStorage.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteFromCorrectBucket(path: string) {
  if (!supabaseStorage) return;
  // Intentar borrar de ambos por si acaso
  await supabaseStorage.storage.from('EXPEDIENTES').remove([path]);
  await supabaseStorage.storage.from('expedientes').remove([path]);
}
