import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL no válida' }, { status: 400 });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Error al descargar archivo: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error en proxy-file:', error);
    return NextResponse.json({ error: error.message || 'Error en proxy' }, { status: 500 });
  }
}
