'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Send, Bot, User, ChevronDown, Download, Eye, FileText, Paperclip, CheckCircle2, UploadCloud, AlertCircle, Users, Search } from 'lucide-react';
import { processAIChatMessage, ChatMessage, ChatAction } from '@/lib/aiChatService';
import { generarCartaRecomendacionPDF, generarCartaRecomendacionDOCX, descargarBlob } from '@/lib/documentGenerator';
import { subirArchivoAExpediente } from '@/lib/chatDocumentUpload';
import { buscarTrabajadoresGlobales, obtenerTrabajadoresUnificados, TrabajadorItem } from '@/lib/trabajadoresService';

export default function AIChatWidget() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy tu **Asistente Fundamiga**. ¿Qué información de expedientes o trabajadores deseas consultar?',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Estados para subida de archivos
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Estados para autocompletado y directorio de trabajadores
  const [suggestions, setSuggestions] = useState<TrabajadorItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryList, setDirectoryList] = useState<TrabajadorItem[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Mostrar aviso emergente después de 1 segundo
    const timerShow = setTimeout(() => {
      setShowTooltip(true);
    }, 1000);

    // Ocultar aviso automáticamente después de 7 segundos
    const timerHide = setTimeout(() => {
      setShowTooltip(false);
    }, 8000);

    return () => {
      clearTimeout(timerShow);
      clearTimeout(timerHide);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping, isUploading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  // Autocompletado: busca trabajadores mientras se escribe
  const handleInputChange = async (value: string) => {
    setInputText(value);

    // Detectar si el texto termina con @ o tiene @ seguido de texto
    const atMatch = value.match(/@([^\s]*)$/);

    if (atMatch !== null) {
      // Si escribió solo @ o @texto → buscar por lo que sigue al @
      const queryAfterAt = atMatch[1]; // puede ser vacío si es solo "@"
      const results = queryAfterAt.length === 0
        ? await buscarTrabajadoresGlobales('', 8).then(() => obtenerTrabajadoresUnificados()).then(all => all.slice(0, 8))
        : await buscarTrabajadoresGlobales(queryAfterAt, 8);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else if (value.length >= 2) {
      const results = await buscarTrabajadoresGlobales(value, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Pegar contacto seleccionado en el input
  const handleSelectContact = (t: TrabajadorItem) => {
    const atMatch = inputText.match(/@([^\s]*)$/);

    let texto: string;
    if (atMatch) {
      // Reemplazar el @... por el nombre + cédula manteniendo el resto del texto
      const beforeAt = inputText.slice(0, inputText.lastIndexOf('@'));
      texto = `${beforeAt}${t.nombre} (CC: ${t.cedula})`;
    } else {
      // Sin @: usar plantilla completa
      texto = attachedFile
        ? `Lleva este archivo a ${t.nombre} (CC: ${t.cedula})`
        : `Dame los datos de ${t.nombre} (CC: ${t.cedula})`;
    }

    setInputText(texto);
    setSuggestions([]);
    setShowSuggestions(false);
    setShowDirectory(false);
    setDirectorySearch('');
  };

  // Abrir directorio de trabajadores
  const handleOpenDirectory = async () => {
    const next = !showDirectory;
    setShowDirectory(next);
    if (next && directoryList.length === 0) {
      setLoadingDirectory(true);
      try {
        const todos = await obtenerTrabajadoresUnificados();
        setDirectoryList(todos);
      } finally {
        setLoadingDirectory(false);
      }
    }
  };

  // Filtrar directorio en tiempo real
  const filteredDirectory = directorySearch.length >= 1
    ? directoryList.filter(t => {
        const q = directorySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const name = t.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(q) || (t.cedula || '').includes(directorySearch);
      }).slice(0, 8)
    : directoryList.slice(0, 8);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query && !attachedFile) return;
    if (isTyping || isUploading) return;

    const currentFile = attachedFile;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query || `Adjunto: ${currentFile?.name}`,
      timestamp: new Date(),
      archivoAdjunto: currentFile ? {
        nombre: currentFile.name,
        tamaño: `${(currentFile.size / 1024).toFixed(0)} KB`
      } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    try {
      const filePayload = currentFile ? { name: currentFile.name, size: currentFile.size } : null;
      const responseObj = await processAIChatMessage(query, filePayload);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: responseObj.text,
        timestamp: new Date(),
        expedientesEncontrados: responseObj.expedientesEncontrados,
        acciones: responseObj.acciones
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Lo siento, ocurrió un problema al procesar tu consulta. Inténtalo de nuevo.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecuteAction = async (action: ChatAction) => {
    if (action.tipo === 'NAVEGAR' && action.expediente?.id) {
      setIsOpen(false);
      router.push(`/expediente/${action.expediente.id}`);
    } else if (action.tipo === 'VER_DOCUMENTO' && action.payload?.url) {
      window.open(action.payload.url, '_blank');
    } else if (action.tipo === 'GENERAR_DOCX' && action.expediente) {
      const keyId = `${action.expediente.id}-docx`;
      setGeneratingId(keyId);
      try {
        const blob = await generarCartaRecomendacionDOCX(action.expediente);
        const nombreLimpio = action.expediente.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        descargarBlob(blob, `Carta_Recomendacion_${nombreLimpio}.docx`);
      } catch (err: any) {
        console.error('Error generando Word DOCX:', err);
      } finally {
        setGeneratingId(null);
      }
    } else if (action.tipo === 'GENERAR_CERTIFICADO' && action.expediente) {
      const keyId = `${action.expediente.id}-pdf`;
      setGeneratingId(keyId);
      try {
        const blob = await generarCartaRecomendacionPDF(action.expediente);
        const nombreLimpio = action.expediente.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        descargarBlob(blob, `Certificado_Laboral_${nombreLimpio}.pdf`);
      } catch (err: any) {
        console.error('Error generando PDF:', err);
      } finally {
        setGeneratingId(null);
      }
    } else if (action.tipo === 'SELECCIONAR_CATEGORIA' && action.payload) {
      // Mostrar lista de categorías para elegir
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
        expediente: action.expediente,
        payload: { categoria: cat, expedienteId: action.payload.expedienteId, expedienteNombre: action.payload.expedienteNombre }
      }));

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'assistant',
          text: `Selecciona la categoría para el archivo de **${action.payload.expedienteNombre}**:`,
          timestamp: new Date(),
          acciones: accionesCategorias
        }
      ]);
    } else if (action.tipo === 'CONFIRMAR_SUBIDA' && action.payload) {
      if (!attachedFile) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'assistant',
            text: '⚠️ Por favor adjunta el archivo con el botón de clip 📎 para poder subirlo.',
            timestamp: new Date()
          }
        ]);
        return;
      }

      const { expedienteId, expedienteNombre, categoria } = action.payload;
      setIsUploading(true);
      setUploadProgressText(`Subiendo "${attachedFile.name}" como ${categoria}...`);

      try {
        const uploadResult = await subirArchivoAExpediente(attachedFile, expedienteId, categoria);

        if (uploadResult.ok && uploadResult.doc) {
          const docGuardado = uploadResult.doc;
          setAttachedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';

          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: 'assistant',
              text: `✅ **¡Documento subido y registrado con éxito!**\n\n` +
                `• **Archivo**: \`${docGuardado.nombre_archivo}\`\n` +
                `• **Categoría**: **${categoria}**\n` +
                `• **Expediente**: **${expedienteNombre}**\n\n` +
                `Ya se encuentra vinculado formalmente en su expediente.`,
              timestamp: new Date(),
              acciones: [
                {
                  label: '👁️ Ver Documento Subido',
                  tipo: 'VER_DOCUMENTO',
                  payload: { url: docGuardado.url }
                },
                {
                  label: `👤 Abrir Expediente de ${expedienteNombre.split(' ')[0]}`,
                  tipo: 'NAVEGAR',
                  expediente: action.expediente
                }
              ]
            }
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: 'assistant',
              text: `❌ No se pudo subir el archivo: ${uploadResult.error || 'Error en almacenamiento'}`,
              timestamp: new Date()
            }
          ]);
        }
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'assistant',
            text: `❌ Ocurrió un error inesperado al subir el archivo: ${err.message}`,
            timestamp: new Date()
          }
        ]);
      } finally {
        setIsUploading(false);
        setUploadProgressText('');
      }
    }
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono text-[11px]">{part.slice(1, -1)}</code>;
        }
        return part;
      });

      return (
        <React.Fragment key={idx}>
          {formattedLine}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end pointer-events-none">
      {/* Input de Archivo Oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
      />

      {/* Ventana de Chat */}
      {isOpen && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setAttachedFile(e.dataTransfer.files[0]);
            }
          }}
          className={`pointer-events-auto mb-3 w-[360px] sm:w-[430px] h-[560px] max-h-[84vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 relative ${
            isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Asistente Fundamiga
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[11px] text-indigo-100">Consultas, subida de archivos y cartas</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chips de Preguntas Rápidas */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSendMessage('Resumen general')}
              className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              📊 Resumen
            </button>
            <button
              onClick={() => handleSendMessage('¿Quiénes tienen documentos pendientes?')}
              className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              ⚠️ Incompletos
            </button>
            <button
              onClick={() => handleSendMessage('¿Quiénes están en la sección de Remesas?')}
              className="text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              🚚 Remesas
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm mt-0.5">
                    <Bot size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[86%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {/* Badge de archivo adjunto en mensaje de usuario */}
                  {msg.archivoAdjunto && (
                    <div className="mb-2 p-1.5 bg-indigo-700/80 rounded-lg flex items-center gap-1.5 text-[11px] text-white">
                      <FileText size={13} />
                      <span className="truncate font-medium">{msg.archivoAdjunto.nombre}</span>
                      <span className="text-[10px] opacity-75">({msg.archivoAdjunto.tamaño})</span>
                    </div>
                  )}

                  {renderFormattedText(msg.text)}

                  {/* Renderizar Botones de Acción si existen */}
                  {msg.acciones && msg.acciones.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      {msg.acciones.map((act, aIdx) => {
                        const isDocx = act.tipo === 'GENERAR_DOCX';
                        const isPdf = act.tipo === 'GENERAR_CERTIFICADO';
                        const isUploadConfirm = act.tipo === 'CONFIRMAR_SUBIDA';
                        const isViewDoc = act.tipo === 'VER_DOCUMENTO';
                        const keyId = isDocx ? `${act.expediente?.id}-docx` : `${act.expediente?.id}-pdf`;
                        const isGenerating = generatingId === keyId;

                        return (
                          <button
                            key={aIdx}
                            onClick={() => handleExecuteAction(act)}
                            disabled={isGenerating || isUploading}
                            className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                              isUploadConfirm
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : isDocx
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : isPdf
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : isViewDoc
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isGenerating ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generando documento...
                              </>
                            ) : isUploadConfirm ? (
                              <>
                                <UploadCloud size={13} /> {act.label}
                              </>
                            ) : isDocx ? (
                              <>
                                <FileText size={13} /> {act.label}
                              </>
                            ) : isPdf ? (
                              <>
                                <Download size={13} /> {act.label}
                              </>
                            ) : (
                              <>
                                <Eye size={13} /> {act.label}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1 text-right font-medium ${
                      msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm mt-0.5">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                  <Bot size={15} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {isUploading && (
              <div className="flex gap-2.5 items-center text-indigo-600 text-xs">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                  <Bot size={15} />
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold">{uploadProgressText || 'Subiendo archivo a la nube...'}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Badge de archivo adjunto seleccionado */}
          {attachedFile && (
            <div className="mx-3 mb-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-700 animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <FileText size={14} className="text-indigo-600 flex-shrink-0" />
                <span className="font-semibold truncate">{attachedFile.name}</span>
                <span className="text-[10px] text-indigo-500">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-indigo-400 hover:text-indigo-700 p-0.5"
                title="Quitar archivo adjunto"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Formulario de Entrada */}
          <div className="relative">
            {/* Autocompletado flotante */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-2.5 py-1.5 text-[10px] text-slate-400 font-medium border-b border-slate-100 bg-slate-50">
                  👥 Sugerencias de trabajadores
                </div>
                {suggestions.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={() => handleSelectContact(t)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 text-[11px] font-bold">
                      {t.nombre.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{t.nombre}</p>
                      <p className="text-[10px] text-slate-400">CC: {t.cedula} {t.cargo ? `· ${t.cargo}` : ''}</p>
                    </div>
                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${t.origen === 'expediente' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                      {t.origen === 'expediente' ? 'Exp.' : 'Global'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Panel de Directorio de Trabajadores */}
            {showDirectory && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col" style={{ maxHeight: 260 }}>
                <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Search size={12} className="text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={directorySearch}
                    onChange={e => setDirectorySearch(e.target.value)}
                    placeholder="Buscar por nombre o cédula..."
                    className="flex-1 text-xs outline-none bg-transparent text-slate-700 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowDirectory(false); setDirectorySearch(''); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {loadingDirectory ? (
                    <div className="text-center text-xs text-slate-400 py-4">Cargando trabajadores...</div>
                  ) : filteredDirectory.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-4">Sin resultados</div>
                  ) : (
                    filteredDirectory.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectContact(t)}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 text-[11px] font-bold">
                          {t.nombre.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{t.nombre}</p>
                          <p className="text-[10px] text-slate-400">CC: {t.cedula} {t.cargo ? `· ${t.cargo}` : ''}</p>
                        </div>
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${t.origen === 'expediente' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                          {t.origen === 'expediente' ? 'Exp.' : 'Global'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                setShowSuggestions(false);
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              {/* Botón de Adjuntar Archivo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  attachedFile
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                title="Adjuntar documento o archivo (PDF, Imagen, Word)"
              >
                <Paperclip size={17} />
              </button>

              {/* Botón Directorio de Trabajadores */}
              <button
                type="button"
                onClick={handleOpenDirectory}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  showDirectory
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                title="Buscar trabajador y pegarlo en el chat"
              >
                <Users size={16} />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={e => handleInputChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder={attachedFile ? 'Escribe: "Lleva esto a [Nombre]"...' : 'Escribe o adjunta un archivo con 📎...'}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={(!inputText.trim() && !attachedFile) || isTyping || isUploading}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}


      {/* Launcher & Speech Bubble */}
      <div className="flex items-center">
        {/* Burbuja / Mensaje de Presentación */}
        {showTooltip && !isOpen && (
          <div
            onClick={() => {
              setIsOpen(true);
              setShowTooltip(false);
            }}
            className="pointer-events-auto cursor-pointer mr-3 flex items-center gap-2.5 bg-slate-900/90 text-white text-xs py-2 px-3.5 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300 hover:scale-105 transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-amber-300 shadow-sm">
              <Sparkles size={13} className="animate-spin [animation-duration:3s]" />
            </div>
            <div className="pr-1 text-left">
              <p className="font-bold text-[11px] text-white flex items-center gap-1.5 leading-none">
                ¡Nuevo Asistente IA!
                <span className="text-[10px] text-indigo-300 font-normal">✨ Clic aquí</span>
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5 leading-none">Consultas, subida de archivos y cartas</p>
            </div>
            <button
              onClick={e => {
                e.stopPropagation();
                setShowTooltip(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors ml-1"
              title="Cerrar aviso"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Botón Flotante Launcher */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setShowTooltip(false);
          }}
          className="pointer-events-auto group relative w-14 h-14 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-white/20 flex-shrink-0"
          title="Abrir Asistente Fundamiga"
        >
          {isOpen ? (
            <ChevronDown size={24} />
          ) : (
            <div className="relative">
              <Sparkles size={24} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-600" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
