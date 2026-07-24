import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';

const pdfPath = 'C:/Users/kevin17/.gemini/antigravity/brain/e0c31b0f-7790-4945-b92f-27bd839061ab/.tempmediaStorage/76b98248e2e87630.pdf';
const bytes = new Uint8Array(readFileSync(pdfPath));

const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
let fullText = '';
for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  fullText += content.items.map((item) => item.str).join(' ') + '\n';
}

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /3\d{9}/g;

const emails = fullText.match(emailRegex) || [];
const phones = fullText.match(phoneRegex) || [];

console.log('=== TEXTO EXTRAÍDO (primeros 2000 chars) ===');
console.log(fullText.substring(0, 2000));
console.log('\n=== CORREOS ENCONTRADOS ===', emails);
console.log('=== TELÉFONOS ENCONTRADOS ===', phones);
