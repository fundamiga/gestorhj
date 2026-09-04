import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Expediente } from '@/types';

function inferirTratamiento(nombreCompleto: string) {
  const norm = (nombreCompleto || '').toLowerCase();
  const palabras = norm.split(/\s+/);
  const n1 = palabras[0] || '';
  const n2 = palabras[1] || '';
  const nombresFemeninos = ['diana', 'maria', 'ana', 'isabella', 'erika', 'angela', 'emilce', 'jamileth', 'sonia', 'johana', 'isamar', 'mildred', 'melissa', 'carolina', 'patricia', 'sandra', 'gloria', 'luz', 'claudia', 'martha', 'rosa', 'marlen'];
  
  if (nombresFemeninos.includes(n1) || nombresFemeninos.includes(n2) || n1.endsWith('a')) {
    return { tratamiento: 'la señora', pronombre: 'ella' };
  }
  return { tratamiento: 'el señor', pronombre: 'él' };
}

function formatearCedula(cedula: string) {
  if (!cedula) return 'No registrada';
  const num = cedula.toString().replace(/\D/g, '');
  if (!num) return cedula;
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatearFecha(fechaStr?: string) {
  if (!fechaStr) return 'la fecha estipulada en el contrato';
  try {
    const [y, m, d] = fechaStr.split('-');
    if (!y || !m || !d) return fechaStr;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${parseInt(d, 10)} de ${meses[parseInt(m, 10) - 1]} de ${y}`;
  } catch (e) {
    return fechaStr;
  }
}

export async function generarCartaRecomendacionPDF(expediente: Expediente): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Tamaño A4 en puntos

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;

  // Header - Membrete Fundamiga
  page.drawRectangle({
    x: margin,
    y: height - 80,
    width: width - (margin * 2),
    height: 40,
    color: rgb(0.12, 0.23, 0.54) // Azul marino Fundamiga
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
  const fechaHoyStr = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  // Fecha y Título
  let yPos = height - 120;
  page.drawText(`Santiago de Cali, ${fechaHoyStr}`, {
    x: width - margin - 180,
    y: yPos,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  yPos -= 50;
  page.drawText('CERTIFICACIÓN Y CARTA DE RECOMENDACIÓN LABORAL', {
    x: margin,
    y: yPos,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.23, 0.54)
  });

  yPos -= 40;

  const tratamientoObj = inferirTratamiento(expediente.nombre);
  const cedulaFormateada = formatearCedula(expediente.cedula);
  const fechaIngresoFormateada = formatearFecha(expediente.fecha_ingreso);
  const cargoStr = (expediente.cargo || 'Trabajador/a').toUpperCase();

  // Texto del cuerpo
  const parrafo1 = `La FUNDACIÓN AMIGA (FUNDAMIGA) se permite certificar que ${tratamientoObj.tratamiento} ${expediente.nombre.toUpperCase()}, identificado(a) con Cédula de Ciudadanía N° ${cedulaFormateada}, se encuentra vinculado(a) laboralmente con nuestra institución desempeñando el cargo de ${cargoStr}, desde el ${fechaIngresoFormateada}.`;

  const parrafo2 = `Durante el tiempo de vinculación, ${tratamientoObj.tratamiento} ${expediente.nombre.toUpperCase()} ha demostrado un excelente desempeño profesional, alto sentido de responsabilidad, compromiso ético y un impecable trato con los usuarios y beneficiarios de la fundación.`;

  const parrafo3 = `Se expide la presente certificación a solicitud del interesado(a), a los ${hoy.getDate()} días del mes de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}.`;

  // Función helper para envolver texto
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
    yPos -= 15; // Espacio entre párrafos
  };

  drawParagraph(parrafo1);
  drawParagraph(parrafo2);
  drawParagraph(parrafo3);

  // Firma
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
