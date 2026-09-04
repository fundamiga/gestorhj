import { supabase } from '@/lib/supabase';
import { DOCUMENTOS_ESENCIALES, Expediente } from '@/types';

export interface ChatAction {
  label: string;
  tipo: 'NAVEGAR' | 'GENERAR_CERTIFICADO' | 'GENERAR_DOCX' | 'MOVER_REMESA' | 'MARCAR_RETIRADO';
  expediente: Expediente;
  payload?: any;
}

export interface ChatResponse {
  text: string;
  expedientesEncontrados?: Expediente[];
  acciones?: ChatAction[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  expedientesEncontrados?: Expediente[];
  acciones?: ChatAction[];
}

export async function processAIChatMessage(message: string): Promise<ChatResponse> {
  const cleanMsg = message.trim();
  if (!cleanMsg) return { text: 'Por favor escribe una consulta válida.' };

  // 1. Intentar conectar con el Asistente Fundamiga Local (Ollama en puerto 3500)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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
        return { text: data.response };
      }
    }
  } catch (e) {
    // Continuar con el motor directo en Supabase
  }

  // 2. Motor Inteligente Directo con Supabase
  return await processSupabaseQuery(cleanMsg);
}

async function processSupabaseQuery(query: string): Promise<ChatResponse> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // ── INTENTO 0: SALUDOS Y CONVERSACIÓN BÁSICA ──────────────────────────────
  const esSaludo = /^(hola|buenos\s*dias|buenas\s*tardes|buenas\s*noches|saludos|que\s*tal|buenas|hi|hello)\b/i.test(q);
  if (esSaludo || q === 'hola') {
    return {
      text: `👋 **¡Hola! Soy tu Asistente Fundamiga.**\n\n` +
        `Puedo buscar trabajadores, abrir sus expedientes, generar **Cartas de Recomendación en Word (.DOCX)** con tu plantilla oficial o **Certificados Laborales en PDF**.\n\n` +
        `Prueba escribiendo un nombre (ej: *diana arias*) o selecciona una consulta rápida:`
    };
  }

  // ── INTENTO 1: SOLICITUD DE GENERACIÓN DE CERTIFICADO / CARTA LABORAL ─────
  if (q.includes('certificado') || q.includes('carta') || q.includes('recomendacion') || q.includes('constancia')) {
    const palabrasIgnoradasCert = new Set(['genera', 'generar', 'generame', 'dame', 'haz', 'hacer', 'una', 'un', 'carta', 'certificado', 'laboral', 'de', 'recomendacion', 'para', 'constancia', 'expedir']);
    const tokensCert = q.split(/\s+/).filter(w => w.length >= 2 && !palabrasIgnoradasCert.has(w));

    if (tokensCert.length > 0) {
      let queryAnd = supabase.from('expedientes').select('*');
      for (const t of tokensCert) {
        queryAnd = queryAnd.ilike('nombre', `%${t}%`);
      }
      const { data: resAnd } = await queryAnd.limit(1);

      if (resAnd && resAnd.length > 0) {
        const exp = resAnd[0];
        return {
          text: `📄 **Generador de Carta de Recomendación y Certificado**\n\nHe encontrado a **${exp.nombre}** (CC: ${exp.cedula}). Puedes generar su carta con la plantilla Word oficial o descargar el PDF:`,
          expedientesEncontrados: [exp],
          acciones: [
            {
              label: '📝 Generar Carta Recomendación (Word .DOCX Oficial)',
              tipo: 'GENERAR_DOCX',
              expediente: exp
            },
            {
              label: '📑 Generar Certificado Laboral (PDF)',
              tipo: 'GENERAR_CERTIFICADO',
              expediente: exp
            },
            {
              label: '👁️ Abrir Expediente Completo',
              tipo: 'NAVEGAR',
              expediente: exp
            }
          ]
        };
      }
    }
  }

  // ── INTENTO 2: RESUMEN / ESTADÍSTICAS GENERALES ────────────────────────────
  if (q.includes('resumen') || q.includes('cuantos') || q.includes('total') || q.includes('estadistica')) {
    const { count, error } = await supabase.from('expedientes').select('*', { count: 'exact', head: true });
    const { data: remesasData } = await supabase.from('expedientes').select('id').eq('es_remesa', true);
    
    if (error) return { text: `Hubo un error al consultar Supabase: ${error.message}` };

    const totalExp = count || 0;
    const totalRemesas = remesasData ? remesasData.length : 0;
    const activos = totalExp - totalRemesas;

    return {
      text: `📊 **Resumen General de Expedientes Fundamiga**:\n\n` +
        `• **Total Expedientes**: ${totalExp}\n` +
        `• **Expedientes Regulares**: ${activos}\n` +
        `• **Sección de Remesas**: ${totalRemesas}\n\n` +
        `Puedes pedirme información sobre cualquier persona por nombre o cédula.`
    };
  }

  // ── INTENTO 3: DOCUMENTOS FALTANTES / INCOMPLETOS ──────────────────────────
  if (q.includes('incompleto') || q.includes('faltan') || q.includes('falta') || q.includes('documentos pendientes')) {
    const { data: expedientes } = await supabase.from('expedientes').select('id, nombre, cedula').limit(50);
    const { data: docs } = await supabase.from('documentos_expediente').select('expediente_id, tipo_documento');

    if (!expedientes || expedientes.length === 0) return { text: 'No se encontraron expedientes en el sistema.' };

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
      return { text: '🎉 ¡Excelente noticia! Todos los expedientes registrados tienen su documentación esencial completa.' };
    }

    const lista = incompletos.slice(0, 5).map(i => `• **${i.nombre}** (CC: ${i.cedula}): le faltan ${i.faltantesCount} doc(s)`).join('\n');
    return {
      text: `⚠️ **Expedientes con Documentación Pendiente** (mostrando ${Math.min(5, incompletos.length)} de ${incompletos.length}):\n\n${lista}\n\n*Consejo: Escribe el nombre de cualquiera para ver su expediente y generar su carta laboral.*`
    };
  }

  // ── INTENTO 4: SECCIÓN REMESAS ─────────────────────────────────────────────
  if (q.includes('remesa') || q.includes('remesas')) {
    const { data: remesas } = await supabase.from('expedientes').select('*').eq('es_remesa', true).limit(10);
    
    if (!remesas || remesas.length === 0) {
      return { text: 'No hay expedientes asignados actualmente a la sección de Remesas.' };
    }

    const lista = remesas.map(r => `• **${r.nombre}** (CC: ${r.cedula}) - ${r.cargo || 'Sin cargo'}`).join('\n');
    return {
      text: `🚚 **Expedientes en Sección Remesas** (Total: ${remesas.length}):\n\n${lista}`
    };
  }

  // ── INTENTO 5: BÚSQUEDA MULTI-PALABRA (NOMBRES, APELLIDOS O CÉDULAS) ─────────
  const palabrasIgnoradas = new Set([
    'busca', 'buscar', 'dame', 'info', 'informacion', 'telefono', 'correo', 'cedula',
    'de', 'el', 'la', 'los', 'las', 'un', 'una', 'hola', 'buenos', 'dias', 'tardes', 'noches',
    'por', 'favor', 'quien', 'es', 'ver', 'datos', 'expediente'
  ]);

  const tokens = q
    .split(/\s+/)
    .filter(palabra => palabra.length >= 2 && !palabrasIgnoradas.has(palabra));

  if (tokens.length > 0) {
    let queryAnd = supabase.from('expedientes').select('*');
    for (const t of tokens) {
      queryAnd = queryAnd.ilike('nombre', `%${t}%`);
    }
    const { data: resAnd } = await queryAnd.limit(5);

    let resultados = resAnd || [];

    if (resultados.length === 0 && /^\d+$/.test(tokens.join(''))) {
      const { data: resCedula } = await supabase
        .from('expedientes')
        .select('*')
        .ilike('cedula', `%${tokens.join('')}%`)
        .limit(5);
      resultados = resCedula || [];
    }

    if (resultados.length === 0 && tokens.length > 1) {
      const condOr = tokens.map(t => `nombre.ilike.%${t}%,cedula.ilike.%${t}%`).join(',');
      const { data: resOr } = await supabase
        .from('expedientes')
        .select('*')
        .or(condOr)
        .limit(5);
      resultados = resOr || [];
    }

    if (resultados.length > 0) {
      let respuesta = `🔎 **Resultados encontrados (${resultados.length})**:\n\n`;
      const accionesList: ChatAction[] = [];

      for (const p of resultados) {
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

        const primerNombre = p.nombre.split(' ')[0];
        accionesList.push(
          {
            label: `👁️ Abrir Expediente: ${primerNombre}`,
            tipo: 'NAVEGAR',
            expediente: p
          },
          {
            label: `📝 Carta Recomendación (Word .DOCX Oficial): ${primerNombre}`,
            tipo: 'GENERAR_DOCX',
            expediente: p
          },
          {
            label: `📑 Certificado Laboral (PDF): ${primerNombre}`,
            tipo: 'GENERAR_CERTIFICADO',
            expediente: p
          }
        );
      }

      return {
        text: respuesta,
        expedientesEncontrados: resultados,
        acciones: accionesList
      };
    }
  }

  return {
    text: `🤖 No encontré coincidencias para "${query}".\n\n` +
      `Prueba escribiendo un **nombre**, **apellido** (ej: *diana arias* o *arias*) o el **número de cédula**.`
  };
}
