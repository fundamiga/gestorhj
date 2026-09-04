import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extraer IP del cliente de headers de Next.js
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfIp = req.headers.get('cf-connecting-ip');
    
    let ipAddress = '127.0.0.1';
    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ipAddress = realIp.trim();
    } else if (cfIp) {
      ipAddress = cfIp.trim();
    }

    const userAgent = req.headers.get('user-agent') || body.userAgent || 'Desconocido';

    const registro = {
      ip_address: ipAddress,
      dispositivo_nombre: body.dispositivoNombre || 'Desconocido',
      sistema_operativo: body.sistemaOperativo || 'Desconocido',
      navegador: body.navegador || 'Desconocido',
      resolucion_pantalla: body.resolucionPantalla || 'No especificada',
      user_agent: userAgent,
      accion_realizada: body.accionRealizada || 'APERTURA_APP',
      detalles: body.detalles || null,
      fecha_registro: new Date().toISOString()
    };

    // Guardar en Supabase silenciosamente
    const { error } = await supabase.from('auditoria_dispositivos').insert([registro]);

    if (error) {
      console.warn('Rastreador silencioso - La tabla auditoria_dispositivos aún no existe o falló la inserción:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Retornar 200 OK silencioso para que la app cliente nunca falle ni muestre errores
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('auditoria_dispositivos')
      .select('*')
      .order('fecha_registro', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, data: [] }, { status: 200 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, data: [] }, { status: 200 });
  }
}
