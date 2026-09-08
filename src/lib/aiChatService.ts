import { supabase } from '@/lib/supabase';
import { DOCUMENTOS_ESENCIALES, TIPOS_DOCUMENTO, Expediente } from '@/types';

export interface ChatAction {
  label: string;
  tipo: 'NAVEGAR' | 'GENERAR_CERTIFICADO' | 'GENERAR_DOCX' | 'MOVER_REMESA' | 'MARCAR_RETIRADO' | 'SELECCIONAR_CATEGORIA' | 'CONFIRMAR_SUBIDA' | 'VER_DOCUMENTO';
  expediente?: Expediente;
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
  archivoAdjunto?: {
    nombre: string;
    tamaño: string;
  };
}

export function detectarCategoria(texto: string): string | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('cedula') || t.includes('cc') || t.includes('identidad')) return 'Cédula de Ciudadanía';
  if (t.includes('hoja de vida') || t.includes('hv') || t.includes('curriculum')) return 'Hoja de Vida';
  if (t.includes('contrato')) return 'Contrato';
  if (t.includes('eps')) return 'Certificado EPS';
  if (t.includes('arl')) return 'Afiliación ARL';
  if (t.includes('policia')) return 'Antecedentes Policía';
  if (t.includes('contraloria')) return 'Antecedentes Contraloría';
  if (t.includes('procuraduria')) return 'Antecedentes Procuraduría';
  if (t.includes('antecedente')) return 'Antecedentes Policía';
  if (t.includes('rut')) return 'RUT';
  if (t.includes('firma')) return 'Firma';
  if (t.includes('cuenta') || t.includes('bancari') || t.includes('bancario')) return 'Certificado de cuenta';
  if (t.includes('ingreso')) return 'Solicitud de Ingreso';
  if (t.includes('retiro')) return 'Solicitud de Retiro';
  return null;
}

export async function processAIChatMessage(
  message: string,
  attachedFile?: { name: string; size: number } | null
): Promise<ChatResponse> {
  const cleanMsg = message.trim();
  if (!cleanMsg && !attachedFile) return { text: 'Por favor escribe una consulta o adjunta un archivo.' };

  // Si hay un archivo adjunto o la intención es subir/llevar un archivo
  if (attachedFile || cleanMsg.toLowerCase().includes('lleva') || cleanMsg.toLowerCase().includes('sube') || cleanMsg.toLowerCase().includes('archivo')) {
    return await processFileUploadIntent(cleanMsg, attachedFile);
  }

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

// ── PROCESAR INTENCIÓN DE SUBIDA DE ARCHIVO A UN EXPEDIENTE ──────────────────
async function processFileUploadIntent(
  query: string,
  attachedFile?: { name: string; size: number } | null
): Promise<ChatResponse> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const nombreArchivo = attachedFile ? attachedFile.name : 'este archivo';

  // 1. Detectar si mencionó categoría en el texto
  const categoriaDetectada = detectarCategoria(q) || (attachedFile ? detectarCategoria(attachedFile.name) : null);

  // 2. Extraer términos para buscar persona
  const palabrasIgnoradas = new Set([
    'lleva', 'llevale', 'sube', 'subelo', 'subele', 'guarda', 'guardalo', 'asigna', 'asignalo',
    'este', 'esta', 'estos', 'archivo', 'documento', 'foto', 'pdf', 'a', 'donde', 'de', 'para',
    'el', 'la', 'los', 'las', 'por', 'favor', 'como', 'su', 'cedula', 'hoja', 'vida', 'contrato',
    'eps', 'arl', 'antecedentes', 'rut', 'firma', 'cuenta'
  ]);

  const tokens = q
    .split(/\s+/)
    .filter(palabra => palabra.length >= 2 && !palabrasIgnoradas.has(palabra));

  let personaEncontrada: Expediente | null = null;

  if (tokens.length > 0) {
    let queryAnd = supabase.from('expedientes').select('*');
    for (const t of tokens) {
      queryAnd = queryAnd.ilike('nombre', `%${t}%`);
    }
    const { data: resAnd } = await queryAnd.limit(1);

    if (resAnd && resAnd.length > 0) {
      personaEncontrada = resAnd[0];
    } else {
      // Intentar por cédula si hay números
      const numMatch = q.match(/\d{5,}/);
      if (numMatch) {
        const { data: resCed } = await supabase.from('expedientes').select('*').ilike('cedula', `%${numMatch[0]}%`).limit(1);
        if (resCed && resCed.length > 0) personaEncontrada = resCed[0];
      }
    }
  }

  // CASO A: Se encontró la persona
  if (personaEncontrada) {
    const p = personaEncontrada;

    // Si ya detectó la categoría:
    if (categoriaDetectada) {
      return {
        text: `📎 **Archivo**: \`${nombreArchivo}\`\n\n` +
          `Identifiqué el expediente de **${p.nombre}** (CC: ${p.cedula}) y la categoría **${categoriaDetectada}**.\n\n` +
          `¿Deseas confirmar la subida de este documento a su expediente?`,
        expedientesEncontrados: [p],
        acciones: [
          {
            label: `🚀 Confirmar y Subir como ${categoriaDetectada}`,
            tipo: 'CONFIRMAR_SUBIDA',
            expediente: p,
            payload: { categoria: categoriaDetectada, expedienteId: p.id, expedienteNombre: p.nombre }
          },
          {
            label: `✏️ Elegir otra categoría`,
            tipo: 'SELECCIONAR_CATEGORIA',
            expediente: p,
            payload: { expedienteId: p.id, expedienteNombre: p.nombre }
          }
        ]
      };
    }

    // Si no detectó la categoría, mostrar las categorías disponibles como botones:
    const categoriasPrincipales = [
      'Cédula de Ciudadanía',
      'Hoja de Vida',
      'Contrato',
      'Certificado EPS',
      'Afiliación ARL',
      'Antecedentes Policía',
      'Certificado de cuenta',
      'Otro'
    ];

    const accionesCategorias: ChatAction[] = categoriasPrincipales.map(cat => ({
      label: `${cat === 'Cédula de Ciudadanía' ? '📄' : cat === 'Hoja de Vida' ? '📋' : cat === 'Contrato' ? '📑' : cat === 'Certificado EPS' ? '🏥' : cat === 'Afiliación ARL' ? '🛡️' : '📁'} ${cat}`,
      tipo: 'CONFIRMAR_SUBIDA',
      expediente: p,
      payload: { categoria: cat, expedienteId: p.id, expedienteNombre: p.nombre }
    }));

    return {
      text: `📎 **Archivo**: \`${nombreArchivo}\`\n\n` +
        `He identificado a **${p.nombre}** (CC: ${p.cedula}).\n\n` +
        `**¿Qué tipo o categoría de documento es este archivo?** (Selecciona una opción a continuación):`,
      expedientesEncontrados: [p],
      acciones: accionesCategorias
    };
  }

  // CASO B: No se especificó o no se encontró la persona
  return {
    text: `📎 **Archivo recibido**: \`${nombreArchivo}\`\n\n` +
      `¿A qué trabajador o persona deseas asignarle este archivo?\n\n` +
      `Por favor escribe su **nombre** o **cédula** (ej: *"Súbelo a Diana Arias"* o *"Para Michael Guevara"*).`
  };
}

async function processSupabaseQuery(query: string): Promise<ChatResponse> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // ── INTENTO 0: SALUDOS Y CONVERSACIÓN BÁSICA ──────────────────────────────
  const esSaludo = /^(hola|buenos\s*dias|buenas\s*tardes|buenas\s*noches|saludos|que\s*tal|buenas|hi|hello)\b/i.test(q);
  if (esSaludo || q === 'hola') {
    return {
      text: `👋 **¡Hola! Soy tu Asistente Fundamiga.**\n\n` +
        `Puedo buscar trabajadores, abrir expedientes, **recibir y subir documentos** con el botón de clip 📎 o generar **Cartas de Recomendación (.DOCX)** y **PDFs**.\n\n` +
        `Prueba escribiendo un nombre (ej: *diana arias*), subiendo un archivo o seleccionando una consulta rápida:`
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
              label: '📝 Carta Recomendación (Word .DOCX Oficial)',
              tipo: 'GENERAR_DOCX',
              expediente: exp
            },
            {
              label: '📑 Certificado Laboral (PDF)',
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

        accionesList.push({
          label: `👁️ Abrir Expediente de ${p.nombre.split(' ')[0]}`,
          tipo: 'NAVEGAR',
          expediente: p
        });

        // Solo ofrecer generar carta si el usuario mencionó explícitamente 'carta', 'certificado' o 'recomendacion'
        if (q.includes('carta') || q.includes('certificado') || q.includes('recomendacion') || q.includes('constancia')) {
          accionesList.push(
            {
              label: `📝 Carta Recomendación (Word .DOCX Oficial)`,
              tipo: 'GENERAR_DOCX',
              expediente: p
            },
            {
              label: `📑 Certificado Laboral (PDF)`,
              tipo: 'GENERAR_CERTIFICADO',
              expediente: p
            }
          );
        }
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
