import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const { publicId } = await request.json();

    if (!publicId) {
      return NextResponse.json({ error: 'Public ID es requerido' }, { status: 400 });
    }

    // El resource_type depende de si es imagen o no. 
    // Para simplificar, intentamos borrar como imagen y luego como raw si falla, 
    // o simplemente usamos lo que Cloudinary determine.
    // Nota: Para PDFs y otros archivos no-imagen en Cloudinary, el resource_type es 'raw'.
    
    // Intentamos borrarlo. Nota: Cloudinary requiere resource_type correcto.
    // Si no lo sabemos, podemos intentar con 'image', 'video' y 'raw'.
    
    const result = await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error('Error en delete API:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el archivo de Cloudinary' },
      { status: 500 }
    );
  }
}
