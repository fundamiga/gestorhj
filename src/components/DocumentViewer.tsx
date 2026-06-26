'use client';

import React from 'react';
import { X, Download, ExternalLink, Printer, FileText } from 'lucide-react';

interface DocumentViewerProps {
  url: string;
  nombreArchivo: string;
  tipoDocumento: string;
  onClose: () => void;
}

export default function DocumentViewer({ url, nombreArchivo, tipoDocumento, onClose }: DocumentViewerProps) {
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif)$/i.test(nombreArchivo);
  const isPDF = url.toLowerCase().includes('.pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');

  // Intentar manejar la impresión
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
          ) : isPDF ? (
            <iframe 
              src={`${url}#toolbar=1&navpanes=0&scrollbar=1`} 
              className="w-full h-full rounded-lg border border-slate-200 shadow-sm"
              title={nombreArchivo}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-sm">
              <FileText size={48} className="text-slate-200 mx-auto mb-4" />
              <h4 className="font-black text-slate-800 mb-2">Vista previa no disponible</h4>
              <p className="text-sm text-slate-500 mb-6 font-medium">Este tipo de archivo no se puede previsualizar directamente en el navegador.</p>
              <a 
                href={url} 
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-emerald-700 shadow-sm transition-all"
              >
                <Download size={16} /> Descargar para ver
              </a>
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
