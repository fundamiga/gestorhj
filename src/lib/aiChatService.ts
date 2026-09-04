import { supabase } from '@/lib/supabase';
import { DOCUMENTOS_ESENCIALES } from '@/types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export async function processAIChatMessage(message: string): Promise<string> {
  const cleanMsg = message.trim();
  if (!cleanMsg) return 'Por favor escribe una consulta válida.';

  // 1. Intentar conectar con el Asistente Fundamiga Local (Ollama en puerto 3500)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos max timeout para respuesta local

    const res = await fetch('http://localhost:3500/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: cleanMsg }),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.response) {
        return data.response;
      }
    }
  } catch (e) {
    // Si el servidor local no está disponible, continuar con el motor inteligente en Supabase
  }

  // 2. Motor Inteligente Directo con Supabase
  return await processSupabaseQuery(cleanMsg);
}

async function processSupabaseQuery(query: string): Promise<string> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ── INTENTO 1: RESUMEN / ESTADÍSTICAS GENERALES ────────────────────────────
  if (q.includes('resumen') || q.includes('cuantos') || q.includes('total') || q.includes('estadistica')) {
    const { count, error } = await supabase.from('expedientes').select('*', { count: 'exact', head: true });
    const { data: remesasData } = await supabase.from('expedientes').select('id').eq('es_remesa', true);
    
    if (error) return `Hubo un error al consultar Supabase: ${error.message}`;

    const totalExp = count || 0;
    const totalRemesas = remesasData ? remesasData.length : 0;
    const activos = totalExp - totalRemesas;

    return `📊 **Resumen General de Expedientes Fundamiga**:\n\n` +
      `• **Total Expedientes**: ${totalExp}\n` +
      `• **Expedientes Regulares**: ${activos}\n` +
      `• **Sección de Remesas**: ${totalRemesas}\n\n` +
      `Puedes pedirme información sobre cualquier persona por nombre o cédula.`;
  }

  // ── INTENTO 2: DOCUMENTOS FALTANTES / INCOMPLETOS ──────────────────────────
  if (q.includes('incompleto') || q.includes('faltan') || q.includes('falta') || q.includes('documentos pendientes')) {
    const { data: expedientes } = await supabase.from('expedientes').select('id, nombre, cedula').limit(50);
    const { data: docs } = await supabase.from('documentos_expediente').select('expediente_id, tipo_documento');

    if (!expedientes || expedientes.length === 0) return 'No se encontraron expedientes en el sistema.';

    const docsByExp: Record<string, string[]> = {};
    (docs || []).forEach(d => {
      if (!docsByExp[d.expediente_id]) docsByExp[d.expediente_id] = [];
      docsByExp[d.expediente_id].push(d.tipo_documento);
    });

    const incompletos: { nombre: string; cedula: string; faltantesCount: number }[] = [];

    expedientes.forEach(exp => {
      const subidos = docsByExp[exp.id] || [];
      const faltantes = DOCUMENTOS_ESENCIALES.filter(d => !subidos.includes(d));
      if (faltantes.length > 0) {
        incompletos.push({ nombre: exp.nombre, cedula: exp.cedula, faltantesCount: faltantes.length });
      }
    });

    if (incompletos.length === 0) {
      return '🎉 ¡Excelente noticia! Todos los expedientes registrados tienen su documentación esencial completa.';
    }

    const lista = incompletos.slice(0, 5).map(i => `• **${i.nombre}** (CC: ${i.cedula}): le faltan ${i.faltantesCount} doc(s)`).join('\n');
    return `⚠️ **Expedientes con Documentación Pendiente** (mostrando ${Math.min(5, incompletos.length)} de ${incompletos.length}):\n\n${lista}\n\n*Consejo: Escribe el nombre de cualquiera para ver exactamente qué documento le falta.*`;
  }

  // ── INTENTO 3: SECCIÓN REMESAS ─────────────────────────────────────────────
  if (q.includes('remesa') || q.includes('remesas')) {
    const { data: remesas } = await supabase.from('expedientes').select('nombre, cedula, cargo').eq('es_remesa', true).limit(10);
    
    if (!remesas || remesas.length === 0) {
      return 'No hay expedientes asignados actualmente a la sección de Remesas.';
    }

    const lista = remesas.map(r => `• **${r.nombre}** (CC: ${r.cedula}) - ${r.cargo || 'Sin cargo'}`).join('\n');
    return `🚚 **Expedientes en Sección Remesas** (Total: ${remesas.length}):\n\n${lista}`;
  }

  // ── INTENTO 4: BÚSQUEDA DE PERSONA ESPECÍFICA POR NOMBRE O CÉDULA ─────────
  // Extraer posibles términos de búsqueda
  const terminos = q.replace(/(busca|buscar|dame|info|informacion|telefono|correo|cedula|de|el|la|los|un|una)/g, '').trim();

  if (terminos.length >= 2) {
    const { data: resultados } = await supabase
      .from('expedientes')
      .select('*')
      .or(`nombre.ilike.%${terminos}%,cedula.ilike.%${terminos}%`)
      .limit(3);

    if (resultados && resultados.length > 0) {
      let respuesta = `🔎 **Resultados encontrados (${resultados.length})**:\n\n`;

      for (const p of resultados) {
        // Consultar sus documentos
        const { data: docs } = await supabase
          .from('documentos_expediente')
          .select('tipo_documento')
          .eq('expediente_id', p.id);

        const tiposSubidos = (docs || []).map(d => d.tipo_documento);
        const faltantes = DOCUMENTOS_ESENCIALES.filter(d => !tiposSubidos.includes(d));

        respuesta += `👤 **${p.nombre}**\n`;
        respuesta += `   • **Cédula**: ${p.cedula}\n`;
        respuesta += `   • **Cargo**: ${p.cargo || 'No especificado'}\n`;
        respuesta += `   • **Fecha Ingreso**: ${p.fecha_ingreso || 'No registrada'}\n`;
        respuesta += `   • **Teléfono**: ${p.telefono || 'No registrado'}\n`;
        respuesta += `   • **Correo**: ${p.correo || 'No registrado'}\n`;
        respuesta += `   • **Estado Docs**: ${tiposSubidos.length}/${DOCUMENTOS_ESENCIALES.length} subidos\n`;
        if (faltantes.length > 0) {
          respuesta += `   • ⚠️ **Faltan**: ${faltantes.join(', ')}\n`;
        } else {
          respuesta += `   • ✅ **Documentación al 100%**\n`;
        }
        respuesta += `\n`;
      }
      return respuesta;
    }
  }

  // Respuesta por defecto si no entendió la intención específica
  return `🤖 Hola, soy el **Asistente Fundamiga**. Puedo ayudarte con:\n\n` +
    `1. Buscar cualquier trabajador por **Nombre** o **Cédula**.\n` +
    `2. Ver el **Resumen general** de expedientes.\n` +
    `3. Consultar **Documentos pendientes o incompletos**.\n` +
    `4. Ver la lista de expedientes en **Remesas**.\n\n` +
    `¿Qué información deseas consultar?`;
}
