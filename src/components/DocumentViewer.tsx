'use client';

import React, { useState } from 'react';
import { X, Download, ExternalLink, Printer, FileText, AlertCircle } from 'lucide-react';

interface DocumentViewerProps {
  url: string;
  nombreArchivo: string;
  tipoDocumento: string;
  onClose: () => void;
}

export default function DocumentViewer({ url, nombreArchivo, tipoDocumento, onClose }: DocumentViewerProps) {
  const [iframeError, setIframeError] = useState(false);

  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif)$/i.test(nombreArchivo);
  const isPDF = url.toLowerCase().includes('.pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');

  // Para PDFs: usar Google Docs Viewer que puede renderizar PDFs de URLs externas
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  const handlePrint = () => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Container */}
      <div className="relative w-full max-w-6xl h-full flex flex-col bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-800 text-sm md:text-base truncate">{nombreArchivo}</h3>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{tipoDocumento}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="hidden md:flex p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all"
              title="Imprimir"
            >
              <Printer size={18} />
            </button>
            <a 
              href={url} 
              download={nombreArchivo}
              className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
              title="Descargar"
            >
              <Download size={18} />
            </a>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink size={18} />
            </a>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button 
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-50 overflow-auto flex items-center justify-center p-4">
          {isImage ? (
            <img 
              src={url} 
              alt={nombreArchivo} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          ) : isPDF && !iframeError ? (
            <iframe
              src={googleDocsUrl}
              className="w-full h-full rounded-lg border border-slate-200 shadow-sm"
              title={nombreArchivo}
              onLoad={(e) => {
                // Si el iframe carga vacío (error de Google Docs Viewer), mostrar fallback
                try {
                  const iframe = e.currentTarget as HTMLIFrameElement;
                  if (iframe.contentDocument?.body?.innerHTML === '') {
                    setIframeError(true);
                  }
                } catch {
                  // CORS: no podemos leer el contenido, asumimos que cargó bien
                }
              }}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-md">
              {isPDF ? (
                <>
                  <AlertCircle size={48} className="text-amber-400 mx-auto mb-4" />
                  <h4 className="font-black text-slate-800 mb-2">No se puede previsualizar</h4>
                  <p className="text-sm text-slate-500 mb-6 font-medium">
                    El servidor no permite mostrar este archivo en el visor interno. 
                    Puedes descargarlo o abrirlo directamente en una nueva pestaña.
                  </p>
                </>
              ) : (
                <>
                  <FileText size={48} className="text-slate-200 mx-auto mb-4" />
                  <h4 className="font-black text-slate-800 mb-2">Vista previa no disponible</h4>
                  <p className="text-sm text-slate-500 mb-6 font-medium">Este tipo de archivo no se puede previsualizar directamente en el navegador.</p>
                </>
              )}
              <div className="flex gap-3 justify-center flex-wrap">
                <a 
                  href={url} 
                  download={nombreArchivo}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:bg-emerald-700 shadow-sm transition-all"
                >
                  <Download size={15} /> Descargar
                </a>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:bg-indigo-700 shadow-sm transition-all"
                >
                  <ExternalLink size={15} /> Abrir en nueva pestaña
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer info (Solo movil) */}
        <div className="md:hidden p-4 bg-white border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Vista previa del documento</p>
        </div>
      </div>
    </div>
  );
}