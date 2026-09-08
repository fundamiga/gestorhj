import { supabase } from '@/lib/supabase';
import { sanitizeFilename, uploadToCorrectBucket } from '@/lib/supabaseStorage';

export interface UploadResult {
  ok: boolean;
  doc?: {
    id: string;
    expediente_id: string;
    nombre_archivo: string;
    tipo_documento: string;
    url: string;
    storage_path: string;
    subido_at: string;
  };
  error?: string;
}

export async function subirArchivoAExpediente(
  file: File,
  expedienteId: string,
  tipoDocumento: string
): Promise<UploadResult> {
  try {
    let url = '';
    let storagePath = '';

    // 1. Intentar subir primero a Supabase Storage
    try {
      const sanitizedName = sanitizeFilename(file.name);
      const path = `${expedienteId}/${Date.now()}_${sanitizedName}`;
      const uploadRes = await uploadToCorrectBucket(path, file);
      url = uploadRes.url;
      storagePath = uploadRes.path;
    } catch (storageErr) {
      console.warn('Fallo Supabase Storage, intentando vía /api/upload (Cloudinary)...', storageErr);
      
      // 2. Fallback a /api/upload (Cloudinary)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expedienteId', expedienteId);

      const apiRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await apiRes.json();
      if (!apiRes.ok || json.error) {
        throw new Error(json.error || 'Error al subir archivo a la nube');
      }

      url = json.url;
      storagePath = json.public_id || file.name;
    }

    if (!url) {
      throw new Error('No se obtuvo una URL válida del archivo subido');
    }

    // 3. Registrar el documento en la tabla documentos_expediente de Supabase
    const docId = Date.now().toString();
    const subidoAt = new Date().toISOString();

    const newDoc = {
      id: docId,
      expediente_id: expedienteId,
      nombre_archivo: file.name,
      tipo_documento: tipoDocumento,
      url: url,
      storage_path: storagePath,
      subido_at: subidoAt,
      notas: 'Subido automáticamente desde el Asistente Fundamiga IA'
    };

    const { error: dbError } = await supabase.from('documentos_expediente').insert(newDoc);
    if (dbError) {
      throw new Error(`Error en base de datos: ${dbError.message}`);
    }

    return {
      ok: true,
      doc: newDoc
    };
  } catch (err: any) {
    console.error('Error al subir archivo a expediente:', err);
    return {
      ok: false,
      error: err.message || 'Error desconocido durante la subida'
    };
  }
}
