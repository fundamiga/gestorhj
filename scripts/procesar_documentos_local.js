const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Inicializar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Regex para extraer datos
const regexCorreo = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Celulares colombianos (ej: 3201234567, 320 123 4567)
const regexTelefono = /(?:(?:\+?57)?[\s-]*(?:3\d{2})[\s-]*\d{3}[\s-]*\d{4})|(?:3\d{9})/g;

async function extraerTexto(buffer, extension) {
  let texto = '';
  try {
    if (extension === '.pdf') {
      const data = await pdfParse(buffer);
      texto = data.text;
    } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
      const { data: { text } } = await Tesseract.recognize(buffer, 'spa', {
        logger: m => console.log(`[Tesseract] ${m.status} ${(m.progress * 100).toFixed(0)}%`)
      });
      texto = text;
    }
  } catch (error) {
    console.error(`Error extrayendo texto: ${error.message}`);
  }
  return texto;
}

async function procesarArchivos() {
  console.log('Iniciando procesamiento de documentos...');

  // Obtener expedientes que no tengan correo o teléfono
  const { data: expedientes, error: errorExp } = await supabase
    .from('expedientes')
    .select('id, nombre, correo, telefono')
    .or('correo.is.null,telefono.is.null');

  if (errorExp) {
    console.error('Error obteniendo expedientes:', errorExp);
    return;
  }

  console.log(`Se encontraron ${expedientes.length} expedientes incompletos.`);

  for (const exp of expedientes) {
    console.log(`\n==============================================`);
    console.log(`Procesando expediente: ${exp.nombre}`);

    // Buscar documentos de este expediente
    const { data: documentos } = await supabase
      .from('documentos_expediente')
      .select('*')
      .eq('expediente_id', exp.id);

    if (!documentos || documentos.length === 0) {
      console.log('No tiene documentos adjuntos.');
      continue;
    }

    let correoEncontrado = exp.correo;
    let telefonoEncontrado = exp.telefono;

    for (const doc of documentos) {
      if (correoEncontrado && telefonoEncontrado) break;

      console.log(`-> Analizando documento: ${doc.nombre_archivo}`);
      
      const ext = path.extname(doc.nombre_archivo).toLowerCase();
      if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
         continue;
      }

      try {
        const url = doc.url;
        console.log(`Descargando archivo...`);
        const res = await fetch(url);
        if (!res.ok) {
           console.log(`Error al descargar: HTTP ${res.status}`);
           continue;
        }
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Extrayendo texto...`);
        const texto = await extraerTexto(buffer, ext);

        if (!texto) {
           console.log(`No se pudo extraer texto o está vacío.`);
           continue;
        }

        // Buscar Correo
        if (!correoEncontrado) {
          const matchCorreo = texto.match(regexCorreo);
          if (matchCorreo) {
            correoEncontrado = matchCorreo[0].toLowerCase();
            console.log(`✅ Correo encontrado: ${correoEncontrado}`);
          }
        }

        // Buscar Teléfono
        if (!telefonoEncontrado) {
          const matchTelefono = texto.match(regexTelefono);
          if (matchTelefono) {
            // Limpiar espacios y guiones para guardar solo números
            telefonoEncontrado = matchTelefono[0].replace(/[\s-]/g, '');
            console.log(`✅ Teléfono encontrado: ${telefonoEncontrado}`);
          }
        }

      } catch (err) {
        console.error(`Error con el documento ${doc.nombre_archivo}: ${err.message}`);
      }
    }

    // Actualizar Base de Datos si se encontró algo nuevo
    if ((correoEncontrado && correoEncontrado !== exp.correo) || 
        (telefonoEncontrado && telefonoEncontrado !== exp.telefono)) {
      console.log(`Guardando nuevos datos en base de datos...`);
      const { error: updateError } = await supabase
        .from('expedientes')
        .update({
          correo: correoEncontrado,
          telefono: telefonoEncontrado
        })
        .eq('id', exp.id);
        
      if (updateError) {
        console.error('Error al actualizar:', updateError.message);
      } else {
        console.log('¡Actualizado con éxito!');
      }
    } else {
      console.log('No se encontraron datos nuevos para este expediente.');
    }
  }

  console.log('\n✅ Proceso masivo finalizado.');
}

procesarArchivos();
