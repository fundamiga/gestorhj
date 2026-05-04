import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const expedienteId = formData.get('expedienteId') as string;
    const folder = formData.get('folder') as string || 'expedientes';

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    // Convertir File a Buffer para subir a Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Subir a Cloudinary
    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${folder}/${expedienteId}`,
          resource_type: 'auto', // Detecta automáticamente si es imagen, pdf, etc.
          public_id: `${Date.now()}_${file.name.split('.')[0].replace(/\s+/g, '_')}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes
    });

  } catch (error: any) {
    console.error('Error en upload API:', error);
    return NextResponse.json(
      { error: error.message || 'Error al subir el archivo a Cloudinary' },
      { status: 500 }
    );
  }
}
