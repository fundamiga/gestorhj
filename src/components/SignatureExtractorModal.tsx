'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Check, RefreshCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Upload, Sparkles, Sliders, Image as ImageIcon, AlertCircle, FileText
} from 'lucide-react';
import { Expediente, DocumentoExpediente } from '@/types';
import { uploadToCorrectBucket, sanitizeFilename } from '@/lib/supabaseStorage';
import { supabase } from '@/lib/supabase';

interface SignatureExtractorModalProps {
  expediente: Expediente;
  documentos: DocumentoExpediente[];
  initialDocId?: string | null;
  onClose: () => void;
  onSignatureSaved: (newDoc: DocumentoExpediente) => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SignatureExtractorModal({
  expediente,
  documentos,
  initialDocId,
  onClose,
  onSignatureSaved,
}: SignatureExtractorModalProps) {
  // ── Document candidates ──
  const cedulaDoc = documentos.find(d => d.tipo_documento === 'Cédula de Ciudadanía');
  const hojaVidaDoc = documentos.find(d => d.tipo_documento === 'Hoja de Vida');
  const otrosDocs = documentos.filter(d => d.tipo_documento !== 'Cédula de Ciudadanía' && d.tipo_documento !== 'Hoja de Vida');

  // Elegir documento inicial: el indicado, o Cédula, o Hoja de Vida, o el primero disponible
  const getInitialSelectedDoc = () => {
    if (initialDocId) {
      const found = documentos.find(d => d.id === initialDocId);
      if (found) return found;
    }
    return cedulaDoc || hojaVidaDoc || (documentos.length > 0 ? documentos[0] : null);
  };

  const [selectedDoc, setSelectedDoc] = useState<DocumentoExpediente | null>(getInitialSelectedDoc());
  const [customFile, setCustomFile] = useState<{ file: File; url: string; isPdf: boolean } | null>(null);

  // Estados de carga y visualización
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.2);

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Recorte interactivo (coordenadas relativas al sourceCanvas)
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Filtros de firma
  const [filterMode, setFilterMode] = useState<'clean' | 'original'>('clean');
  const [inkColor, setInkColor] = useState<'black' | 'blue' | 'original'>('black');
  const [threshold, setThreshold] = useState<number>(185); // 0-255 umbral para limpiar fondo
  const [transparentBg, setTransparentBg] = useState<boolean>(true);

  // Estado de guardado
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Determinar URL actual a procesar
  const currentUrl = customFile ? customFile.url : selectedDoc?.url || '';
  const currentFileName = customFile ? customFile.file.name : selectedDoc?.nombre_archivo || '';
  const isPDF = customFile ? customFile.isPdf : (currentUrl.toLowerCase().includes('.pdf') || currentFileName.toLowerCase().endsWith('.pdf'));

  // ── Cargar documento (PDF o Imagen) ──
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      if (!currentUrl) return;
      setLoadingDoc(true);
      setErrorMsg(null);
      setCropRect(null);

      try {
        if (isPDF) {
          // Importar pdfjs dinámicamente
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
          if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
          }

          let pdfDataUrl = currentUrl;
          // Si es URL remota, usar el proxy para evitar bloqueos CORS
          if (!currentUrl.startsWith('blob:') && !currentUrl.startsWith('data:')) {
            pdfDataUrl = `/api/proxy-file?url=${encodeURIComponent(currentUrl)}`;
          }

          const response = await fetch(pdfDataUrl);
          if (!response.ok) throw new Error('No se pudo descargar el archivo PDF.');
          const buffer = await response.arrayBuffer();

          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
          const doc = await loadingTask.promise;

          if (isCancelled) return;
          setPdfDocProxy(doc);
          setTotalPages(doc.numPages);

          // Si es Hoja de Vida y tiene varias páginas, ir por defecto a la última página donde firman
          const isHV = selectedDoc?.tipo_documento === 'Hoja de Vida';
          const defaultPage = isHV && doc.numPages > 1 ? doc.numPages : 1;
          setCurrentPage(defaultPage);
        } else {
          // Es una imagen (JPG, PNG, WebP)
          setPdfDocProxy(null);
          setTotalPages(1);
          setCurrentPage(1);

          let imageUrl = currentUrl;
          if (!currentUrl.startsWith('blob:') && !currentUrl.startsWith('data:')) {
            imageUrl = `/api/proxy-file?url=${encodeURIComponent(currentUrl)}`;
          }

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = imageUrl;

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('No se pudo cargar la imagen para recorte.'));
          });

          if (isCancelled) return;
          renderImageToCanvas(img);
        }
      } catch (err: any) {
        console.error('Error cargando documento:', err);
        if (!isCancelled) {
          setErrorMsg(err.message || 'Error al procesar el archivo');
        }
      } finally {
        if (!isCancelled) setLoadingDoc(false);
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [currentUrl, isPDF]);

  // ── Renderizar página de PDF cuando cambia página o zoom ──
  const renderPdfPage = useCallback(async () => {
    if (!pdfDocProxy || !sourceCanvasRef.current) return;
    try {
      const page = await pdfDocProxy.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoomScale });
      const canvas = sourceCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Sugerir recuadro inicial si no hay ninguno
      initDefaultCrop(canvas.width, canvas.height);
    } catch (err) {
      console.error('Error al renderizar página PDF:', err);
    }
  }, [pdfDocProxy, currentPage, zoomScale]);

  useEffect(() => {
    if (pdfDocProxy) {
      renderPdfPage();
    }
  }, [pdfDocProxy, currentPage, zoomScale, renderPdfPage]);

  // ── Renderizar Imagen en Canvas ──
  const renderImageToCanvas = (img: HTMLImageElement) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    initDefaultCrop(canvas.width, canvas.height);
  };

  // Sugerir un área inicial donde típicamente está la firma (tercio inferior central)
  const initDefaultCrop = (w: number, h: number) => {
    const cropW = Math.min(w * 0.45, 320);
    const cropH = Math.min(h * 0.22, 160);
    const cropX = (w - cropW) / 2;
    const cropY = h * 0.65; // un poco más abajo del centro
    setCropRect({
      x: Math.round(Math.max(0, cropX)),
      y: Math.round(Math.max(0, cropY)),
      w: Math.round(cropW),
      h: Math.round(cropH),
    });
  };

  // ── Manejar selección interactiva con el ratón / toque ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDragging(true);
    setDragStart({ x, y });
    setCropRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !sourceCanvasRef.current) return;
    const canvas = sourceCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
    const currentY = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const w = Math.abs(currentX - dragStart.x);
    const h = Math.abs(currentY - dragStart.y);

    setCropRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // ── Actualizar vista previa del recorte y aplicar filtro de limpieza ──
  useEffect(() => {
    if (!cropRect || cropRect.w < 10 || cropRect.h < 10) return;
    const sourceCanvas = sourceCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!sourceCanvas || !previewCanvas) return;

    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx || !previewCtx) return;

    previewCanvas.width = cropRect.w;
    previewCanvas.height = cropRect.h;

    // Obtener píxeles del recorte original
    const imgData = sourceCtx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

    if (filterMode === 'original') {
      previewCtx.putImageData(imgData, 0, 0);
      return;
    }

    // ── Algoritmo de Limpieza Digital de Firma ──
    // Elimina sombras del papel / sellos claros y deja el trazo de tinta nítido
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luminancia percibida
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (gray > threshold) {
        // Fondo claro: volver transparente o blanco
        if (transparentBg) {
          data[i + 3] = 0; // Transparente
        } else {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      } else {
        // Tinta oscura detectada
        // Factor de profundidad del trazo (0 cerca al umbral, 1 trazo sólido profundo)
        const depth = Math.min(1, Math.max(0, (threshold - gray) / (threshold * 0.75)));
        const alpha = transparentBg ? Math.min(255, Math.round(180 + 75 * depth)) : 255;

        if (inkColor === 'black') {
          // Negro profesional tipo sello oficial
          data[i] = Math.round(15 * (1 - depth));
          data[i + 1] = Math.round(23 * (1 - depth));
          data[i + 2] = Math.round(42 * (1 - depth));
          data[i + 3] = alpha;
        } else if (inkColor === 'blue') {
          // Azul bolígrafo clásico
          data[i] = Math.round(20 + 9 * (1 - depth));
          data[i + 1] = Math.round(65 + 15 * (1 - depth));
          data[i + 2] = Math.round(195 + 25 * depth);
          data[i + 3] = alpha;
        } else {
          // Color original pero con contraste reforzado y fondo limpio
          const contrast = 1.35;
          data[i] = Math.max(0, Math.min(255, Math.round((r - 128) * contrast + 128)));
          data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 128) * contrast + 128)));
          data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 128) * contrast + 128)));
          data[i + 3] = alpha;
        }
      }
    }

    previewCtx.putImageData(imgData, 0, 0);
  }, [cropRect, filterMode, threshold, transparentBg, inkColor]);

  // ── Subir archivo personalizado desde disco ──
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setCustomFile({ file, url, isPdf: isFilePdf });
    setSelectedDoc(null);
  };

  // ── Guardar firma en el expediente ──
  const handleGuardarFirma = async () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !cropRect || cropRect.w < 10 || cropRect.h < 10) {
      alert('Por favor selecciona el área de la firma en el documento antes de guardar.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      // 1. Convertir el canvas de vista previa a Blob PNG
      const blob = await new Promise<Blob | null>(resolve => {
        previewCanvas.toBlob(b => resolve(b), 'image/png');
      });

      if (!blob) throw new Error('No se pudo generar la imagen de la firma.');

      const cleanCedula = sanitizeFilename(expediente.cedula || expediente.nombre || 'colaborador');
      const filename = `Firma_${cleanCedula}.png`;
      const fileToUpload = new File([blob], filename, { type: 'image/png' });

      // 2. Subir a Supabase Storage
      const path = `${expediente.id}/${Date.now()}_${filename}`;
      const uploadResult = await uploadToCorrectBucket(path, fileToUpload);

      // 3. Registrar en documentos_expediente
      const docId = Date.now().toString();
      const origenDoc = selectedDoc ? selectedDoc.tipo_documento : 'Archivo local';
      const newDoc: DocumentoExpediente = {
        id: docId,
        expediente_id: expediente.id,
        nombre_archivo: filename,
        tipo_documento: 'Firma',
        url: uploadResult.url,
        storage_path: uploadResult.path,
        subido_at: new Date().toISOString(),
        notas: `Extraída de ${origenDoc}`,
      };

      const { error: dbError } = await supabase.from('documentos_expediente').insert(newDoc);
      if (dbError) throw dbError;

      setSavedSuccess(true);
      onSignatureSaved(newDoc);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error al guardar firma:', err);
      setErrorMsg('Error al guardar la firma: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose} />

      {/* Contenedor Modal */}
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black tracking-tight text-white">
                  Extractor de Firmas con IA
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                  Asistido
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Selecciona la firma de <strong className="text-slate-200">{expediente.nombre}</strong> para digitalizarla y anexarla a su expediente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Selección de Documento Origen */}
        <div className="px-6 py-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">Origen:</span>

            {/* Botón Cédula */}
            {cedulaDoc ? (
              <button
                onClick={() => { setSelectedDoc(cedulaDoc); setCustomFile(null); }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  selectedDoc?.id === cedulaDoc.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <span>🪪 Cédula de Ciudadanía</span>
                <span className="text-[10px] opacity-75">(Recomendada)</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-slate-800/40 text-slate-500 text-[11px] border border-dashed border-slate-700">
                Sin Cédula
              </span>
            )}

            {/* Botón Hoja de Vida */}
            {hojaVidaDoc && (
              <button
                onClick={() => { setSelectedDoc(hojaVidaDoc); setCustomFile(null); }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  selectedDoc?.id === hojaVidaDoc.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <span>📄 Hoja de Vida</span>
                {selectedDoc?.id === hojaVidaDoc.id && <span className="text-[10px] opacity-75">(Última pág)</span>}
              </button>
            )}

            {/* Otros documentos si los hay */}
            {otrosDocs.map(d => (
              <button
                key={d.id}
                onClick={() => { setSelectedDoc(d); setCustomFile(null); }}
                className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all ${
                  selectedDoc?.id === d.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400'
                }`}
              >
                {d.tipo_documento}
              </button>
            ))}

            {/* Cargar archivo directo */}
            <label className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              customFile ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}>
              <Upload size={13} />
              <span>{customFile ? `Archivo: ${customFile.file.name.slice(0, 15)}…` : 'Subir otro archivo'}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleCustomFileUpload} />
            </label>
          </div>

          {/* Controles de página para PDF */}
          {isPDF && totalPages > 1 && (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-slate-200">
                Pág. {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
              {selectedDoc?.tipo_documento === 'Hoja de Vida' && currentPage === totalPages && (
                <span className="ml-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Página final
                </span>
              )}
            </div>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setZoomScale(s => Math.max(0.7, s - 0.2))}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Alejar"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-[11px] font-bold text-slate-300 w-12 text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(s => Math.min(2.5, s + 0.2))}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Acercar"
            >
              <ZoomIn size={15} />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal: Visor + Panel Lateral */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Área del documento con selección interactiva */}
          <div
            ref={containerRef}
            className="flex-1 bg-slate-950/80 overflow-auto p-4 flex flex-col items-center justify-center relative select-none"
          >
            {loadingDoc ? (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <RefreshCw size={36} className="animate-spin text-emerald-500" />
                <p className="text-sm font-semibold">Cargando y procesando documento…</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center max-w-md p-6 bg-red-950/40 border border-red-800/50 rounded-2xl">
                <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-red-300 mb-1">No se pudo cargar el documento</p>
                <p className="text-xs text-red-400/80 mb-4">{errorMsg}</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer text-white">
                  <Upload size={14} /> Seleccionar archivo desde tu equipo
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCustomFileUpload} />
                </label>
              </div>
            ) : !currentUrl ? (
              <div className="text-center max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                <FileText size={36} className="text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300 mb-1">Sin documento disponible</p>
                <p className="text-xs text-slate-400 mb-4">Este expediente no tiene Cédula ni Hoja de Vida subida aún.</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold cursor-pointer text-white">
                  <Upload size={14} /> Subir archivo para recortar firma
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCustomFileUpload} />
                </label>
              </div>
            ) : (
              <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-slate-800">
                {/* Canvas donde se dibuja el documento */}
                <canvas
                  ref={sourceCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="cursor-crosshair block max-w-full"
                />

                {/* Overlay visual de selección de recorte */}
                {cropRect && sourceCanvasRef.current && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${(cropRect.x / sourceCanvasRef.current.width) * 100}%`,
                      top: `${(cropRect.y / sourceCanvasRef.current.height) * 100}%`,
                      width: `${(cropRect.w / sourceCanvasRef.current.width) * 100}%`,
                      height: `${(cropRect.h / sourceCanvasRef.current.height) * 100}%`,
                      pointerEvents: 'none',
                    }}
                    className="border-2 border-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-none"
                  >
                    <div className="absolute -top-6 left-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow">
                      Firma Seleccionada
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guía en la parte inferior */}
            {currentUrl && !loadingDoc && (
              <div className="mt-3 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Haz clic y arrastra con el ratón directamente sobre la firma para seleccionarla
              </div>
            )}
          </div>

          {/* Panel Lateral: Vista Previa y Filtros */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
            
            <div className="space-y-5">
              {/* Sección Vista Previa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-emerald-400" />
                    Vista Previa del Recorte
                  </p>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {transparentBg ? 'Fondo Transparente' : 'Fondo Blanco'}
                  </span>
                </div>
                
                {/* Contenedor con fondo blanco/ajedrezado claro para visualización de alta nitidez */}
                <div className="w-full h-40 rounded-2xl border-2 border-slate-700 bg-white flex items-center justify-center p-4 relative overflow-hidden shadow-inner bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
                  <canvas
                    ref={previewCanvasRef}
                    className="max-w-full max-h-full object-contain rounded drop-shadow-md"
                  />
                  {(!cropRect || cropRect.w < 10) && (
                    <p className="text-xs text-slate-400 text-center font-medium italic">
                      Arrastra sobre el documento para recortar la firma
                    </p>
                  )}
                </div>
              </div>

              {/* Filtros de Calidad de Firma */}
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-800 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sliders size={13} className="text-emerald-400" />
                  Optimización de Firma
                </p>

                {/* Modos */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilterMode('clean')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      filterMode === 'clean'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>✨ Limpia / Digital</span>
                    <span className="text-[9px] opacity-75 font-normal">Quita papel/sombras</span>
                  </button>

                  <button
                    onClick={() => setFilterMode('original')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      filterMode === 'original'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📷 Original</span>
                    <span className="text-[9px] opacity-75 font-normal">Sin filtros</span>
                  </button>
                </div>

                {/* Color de tinta (en modo limpio) */}
                {filterMode === 'clean' && (
                  <div className="space-y-3 pt-2 border-t border-slate-700/50">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                        Color de Tinta:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInkColor('black')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            inkColor === 'black'
                              ? 'bg-slate-950 text-white ring-2 ring-emerald-400'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-black border border-slate-500" />
                          <span>Negro</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInkColor('blue')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            inkColor === 'blue'
                              ? 'bg-blue-900 text-white ring-2 ring-emerald-400'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span>Azul</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInkColor('original')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            inkColor === 'original'
                              ? 'bg-emerald-900 text-white ring-2 ring-emerald-400'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🌈</span>
                          <span>Original</span>
                        </button>
                      </div>
                    </div>

                    {/* Sensibilidad / Umbral */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>Sensibilidad de tinta:</span>
                        <span className="text-emerald-400 font-mono">{threshold}</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="240"
                        value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-medium mt-0.5">
                        <span>Más limpio</span>
                        <span>Más trazo</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-semibold pt-1">
                      <input
                        type="checkbox"
                        checked={transparentBg}
                        onChange={e => setTransparentBg(e.target.checked)}
                        className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Fondo transparente (PNG para cartas)</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de Acción Principal */}
            <div className="pt-4 space-y-2">
              <button
                onClick={handleGuardarFirma}
                disabled={saving || !cropRect || cropRect.w < 10 || savedSuccess}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Guardando firma…</span>
                  </>
                ) : savedSuccess ? (
                  <>
                    <Check size={16} />
                    <span>¡Firma guardada con éxito!</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Guardar como Firma en Expediente</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-all text-center"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
