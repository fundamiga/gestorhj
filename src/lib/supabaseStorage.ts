import { createClient } from '@supabase/supabase-js';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 'https://gimldpldmkqvgizkczrs.supabase.co';
const SUPABASE_STORAGE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpbWxkcGxkbWtxdmdpemtjenJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTU2ODMsImV4cCI6MjA5MzQ3MTY4M30.mbglIzc7rGPS37A5AgBr1soYNdOK7bXr-vfJUdQBx4s';

export const supabaseStorage = (SUPABASE_STORAGE_URL && SUPABASE_STORAGE_ANON_KEY) 
  ? createClient(SUPABASE_STORAGE_URL, SUPABASE_STORAGE_ANON_KEY)
  : null as any;

// Función para limpiar nombres de archivos (quitar acentos y caracteres especiales)
export function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD') // Descomponer caracteres con acento
    .replace(/[\u0300-\u036f]/g, '') // Quitar los acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Reemplazar cualquier cosa que no sea alfanumérico, punto, guion o guion bajo por _
    .replace(/_{2,}/g, '_'); // Evitar múltiples guiones bajos seguidos
}

// Helper para subir al bucket correcto probando ambas variantes
export async function uploadToCorrectBucket(path: string, file: File): Promise<{url: string, path: string}> {
  if (!supabaseStorage) throw new Error('Configuración de almacenamiento de respaldo incompleta (faltan variables de entorno)');
  
  // Intentar con Mayúsculas primero (según captura)
  let bucket = 'EXPEDIENTES';
  let { error } = await supabaseStorage.storage.from(bucket).upload(path, file);
  
  if (error) {
    if (error.message.includes('Bucket not found')) {
      // Si falla, intentar con Minúsculas
      bucket = 'expedientes';
      const retry = await supabaseStorage.storage.from(bucket).upload(path, file);
      if (retry.error) throw retry.error;
    } else {
      throw error;
    }
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
