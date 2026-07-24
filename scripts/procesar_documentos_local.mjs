import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /(?:3\d{2}[\s\-]?\d{3}[\s\-]?\d{4})|(?:3\d{9})/g;

async function extraerTextoPDF(buffer) {
  try {
    const data = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n';
    }
    return text;
  } catch (e) {
    return '';
  }
}

async function procesarExpedientes() {
  console.log('🚀 Iniciando procesamiento masivo con pdfjs...\n');

  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, nombre, correo, telefono')
    .or('correo.is.null,telefono.is.null');

  console.log(`📋 ${expedientes.length} expedientes sin datos completos.\n`);

  const resultados = [];
  let actualizados = 0;

  for (const exp of expedientes) {
    console.log(`\n=== ${exp.nombre} ===`);

    const { data: docs } = await supabase
      .from('documentos_expediente')
      .select('url, nombre_archivo, tipo_documento')
      .eq('expediente_id', exp.id)
      .in('tipo_documento', ['Hoja de Vida', 'Cédula de Ciudadanía', 'RUT', 'Solicitud de Ingreso']);

    if (!docs || docs.length === 0) {
      console.log('Sin documentos relevantes.');
      continue;
    }

    let correoEncontrado = exp.correo;
    let telefonoEncontrado = exp.telefono;

    for (const doc of docs) {
      if (correoEncontrado && telefonoEncontrado) break;

      const ext = doc.nombre_archivo.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf') continue;

      console.log(`  📄 Leyendo: ${doc.nombre_archivo}`);

      try {
        const res = await fetch(doc.url);
        if (!res.ok) { console.log(`    ❌ HTTP ${res.status}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const texto = await extraerTextoPDF(buf);

        if (!texto.trim()) { console.log('    ⚠️  Sin texto legible'); continue; }

        if (!correoEncontrado) {
          const matches = texto.match(emailRegex);
          if (matches) {
            correoEncontrado = matches[0].toLowerCase();
            console.log(`    ✅ Correo: ${correoEncontrado}`);
          }
        }
        if (!telefonoEncontrado) {
          const matches = texto.match(phoneRegex);
          if (matches) {
            telefonoEncontrado = matches[0].replace(/[\s\-]/g, '');
            console.log(`    ✅ Teléfono: ${telefonoEncontrado}`);
          }
        }
      } catch (e) {
        console.log(`    ❌ Error: ${e.message}`);
      }
    }

    // Guardar si encontramos algo nuevo
    if (
      (correoEncontrado && correoEncontrado !== exp.correo) ||
      (telefonoEncontrado && telefonoEncontrado !== exp.telefono)
    ) {
      const { error } = await supabase
        .from('expedientes')
        .update({ correo: correoEncontrado || null, telefono: telefonoEncontrado || null })
        .eq('id', exp.id);

      if (!error) {
        actualizados++;
        console.log(`  💾 ¡Guardado!`);
        resultados.push({ nombre: exp.nombre, correo: correoEncontrado, telefono: telefonoEncontrado });
      } else {
        console.log(`  ❌ Error guardando: ${error.message}`);
      }
    } else {
      console.log('  ➡️  No se encontraron datos nuevos.');
    }
  }

  console.log(`\n\n✅ Proceso finalizado. ${actualizados} expedientes actualizados.`);
  if (resultados.length > 0) {
    console.log('\nResumen de lo encontrado:');
    resultados.forEach(r => console.log(`  - ${r.nombre}: ${r.correo || 'sin correo'} | ${r.telefono || 'sin teléfono'}`));
  }
}

procesarExpedientes();
