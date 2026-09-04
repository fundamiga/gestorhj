import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { Expediente } from '@/types';

function numeroATexto(num: number): string {
  const numeros = [
    'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
    'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
    'veintiuno', 'veintidós', 'veintitrés', 'veinticincos', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'treinta y uno'
  ];
  return numeros[num] || num.toString();
}

function inferirTratamiento(nombreCompleto: string) {
  const norm = (nombreCompleto || '').toLowerCase();
  const palabras = norm.split(/\s+/);
  const n1 = palabras[0] || '';
  const n2 = palabras[1] || '';
  const nombresFemeninos = ['diana', 'maria', 'ana', 'isabella', 'erika', 'angela', 'emilce', 'jamileth', 'sonia', 'johana', 'isamar', 'mildred', 'mariland', 'melissa', 'carolina', 'patricia', 'sandra', 'gloria', 'luz', 'claudia', 'martha', 'rosa', 'marlen'];
  
  if (nombresFemeninos.includes(n1) || nombresFemeninos.includes(n2) || n1.endsWith('a')) {
    return { tratamiento: 'la señora', ref: 'la señora' };
  }
  return { tratamiento: 'el señor', ref: 'el señor' };
}

function formatearCedula(cedula: string) {
  if (!cedula) return 'No registrada';
  const num = cedula.toString().replace(/\D/g, '');
  if (!num) return cedula;
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatearFechaEspanol(fechaStr?: string) {
  if (!fechaStr) return 'la fecha de ingreso';
  try {
    const [y, m, d] = fechaStr.split('-');
    if (!y || !m || !d) return fechaStr;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaNum = parseInt(d, 10);
    const diaTexto = (diaNum < 10 ? '0' : '') + diaNum;
    return `${diaTexto} de ${meses[parseInt(m, 10) - 1]} de ${y}`;
  } catch (e) {
    return fechaStr;
  }
}

// ── GENERAR CARTA EN WORD (.DOCX) USANDO LA PLANTILLA OFICIAL DE FUNDAMIGA ──────
export async function generarCartaRecomendacionDOCX(expediente: Expediente): Promise<Blob> {
  const response = await fetch('/plantilla_carta_recomendacion.docx');
  if (!response.ok) {
    throw new Error('No se pudo cargar la plantilla plantilla_carta_recomendacion.docx');
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const hoy = new Date();
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const diaNum = hoy.getDate();
  const diaTexto = numeroATexto(diaNum);
  const mesTexto = meses[hoy.getMonth()];
  const anioTexto = hoy.getFullYear().toString();

  const fechaCarta = `${diaNum} de ${mesTexto} de ${anioTexto}`;
  const tratamientoObj = inferirTratamiento(expediente.nombre);

  const partesNombre = (expediente.nombre || '').split(/\s+/);
  const apellidoRef = partesNombre.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  doc.render({
    FECHA_CARTA: fechaCarta,
    TRATAMIENTO: tratamientoObj.tratamiento,
    NOMBRE_COMPLETO: (expediente.nombre || '').toUpperCase(),
    CEDULA: formatearCedula(expediente.cedula),
    CARGO: expediente.cargo || 'Trabajador/a',
    FECHA_INGRESO: formatearFechaEspanol(expediente.fecha_ingreso),
    TRATAMIENTO_REF: tratamientoObj.ref,
    APELLIDO_REF: apellidoRef,
    USUARIOS_TIPO: 'los usuarios y beneficiarios de la fundación',
    DIAS_TEXTO: `${diaTexto} (${diaNum})`,
    MES_ANIO_TEXTO: `${mesTexto} de ${anioTexto}`
  });

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  return blob;
}

// ── GENERAR CARTA EN PDF ───────────────────────────────────────────────────────
export async function generarCartaRecomendacionPDF(expediente: Expediente): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;

  // Header Membrete
  page.drawRectangle({
    x: margin,
    y: height - 80,
    width: width - (margin * 2),
    height: 40,
    color: rgb(0.12, 0.23, 0.54)
  });

  page.drawText('FUNDACIÓN AMIGA - FUNDAMIGA', {
    x: margin + 15,
    y: height - 62,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1)
  });

  page.drawText('GESTOR DE RECURSOS HUMANOS Y EXPEDIENTES', {
    x: margin + 15,
    y: height - 74,
    size: 8,
    font: fontHelvetica,
    color: rgb(0.85, 0.9, 1)
  });

  const hoy = new Date();
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaCartaStr = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  let yPos = height - 120;
  page.drawText(`Santiago de Cali, ${fechaCartaStr}`, {
    x: width - margin - 180,
    y: yPos,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  yPos -= 50;
  page.drawText('CARTA DE RECOMENDACIÓN Y CERTIFICACIÓN LABORAL', {
    x: margin,
    y: yPos,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.23, 0.54)
  });

  yPos -= 40;

  const tratamientoObj = inferirTratamiento(expediente.nombre);
  const cedulaFormateada = formatearCedula(expediente.cedula);
  const fechaIngresoFormateada = formatearFechaEspanol(expediente.fecha_ingreso);
  const cargoStr = (expediente.cargo || 'Trabajador/a').toUpperCase();

  const parrafo1 = `La FUNDACIÓN AMIGA (FUNDAMIGA) se permite certificar que ${tratamientoObj.tratamiento} ${expediente.nombre.toUpperCase()}, identificado(a) con Cédula de Ciudadanía N° ${cedulaFormateada}, se encuentra vinculado(a) laboralmente con nuestra institución desempeñando el cargo de ${cargoStr}, desde el ${fechaIngresoFormateada}.`;

  const parrafo2 = `Durante el tiempo de vinculación, ${tratamientoObj.tratamiento} ${expediente.nombre.toUpperCase()} ha demostrado un excelente desempeño profesional, alto sentido de responsabilidad, compromiso ético y un impecable trato con los usuarios y beneficiarios de la fundación.`;

  const parrafo3 = `Se expide la presente certificación a solicitud del interesado(a), a los ${numeroATexto(hoy.getDate())} (${hoy.getDate()}) días del mes de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}.`;

  const wrapText = (text: string, maxWidth: number, fontSize: number, font: any) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const widthTest = font.widthOfTextAtSize(testLine, fontSize);
      if (widthTest <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawParagraph = (text: string) => {
    const lines = wrapText(text, width - (margin * 2), 10.5, fontHelvetica);
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y: yPos,
        size: 10.5,
        font: fontHelvetica,
        color: rgb(0.2, 0.2, 0.2),
        lineHeight: 14
      });
      yPos -= 16;
    }
    yPos -= 15;
  };

  drawParagraph(parrafo1);
  drawParagraph(parrafo2);
  drawParagraph(parrafo3);

  yPos -= 40;
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: margin + 200, y: yPos },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2)
  });

  yPos -= 15;
  page.drawText('DIRECCIÓN DE RECURSOS HUMANOS', {
    x: margin,
    y: yPos,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.23, 0.54)
  });

  yPos -= 12;
  page.drawText('Fundación Amiga - Fundamiga', {
    x: margin,
    y: yPos,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.4, 0.4, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
