'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Send, Bot, User, ChevronDown, Download, Eye, FileText } from 'lucide-react';
import { processAIChatMessage, ChatMessage, ChatAction } from '@/lib/aiChatService';
import { generarCartaRecomendacionPDF, generarCartaRecomendacionDOCX, descargarBlob } from '@/lib/documentGenerator';

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
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    try {
      const responseObj = await processAIChatMessage(query);
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
    }
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold">{part.slice(2, -2)}</strong>;
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
      {/* Ventana de Chat */}
      {isOpen && (
        <div className="pointer-events-auto mb-3 w-[360px] sm:w-[420px] h-[550px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
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
                <p className="text-[11px] text-indigo-100">Cartas Word (.DOCX) y PDF Oficiales</p>
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
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {renderFormattedText(msg.text)}

                  {/* Renderizar Botones de Acción si existen */}
                  {msg.acciones && msg.acciones.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      {msg.acciones.map((act, aIdx) => {
                        const isDocx = act.tipo === 'GENERAR_DOCX';
                        const isPdf = act.tipo === 'GENERAR_CERTIFICADO';
                        const keyId = isDocx ? `${act.expediente?.id}-docx` : `${act.expediente?.id}-pdf`;
                        const isGenerating = generatingId === keyId;

                        return (
                          <button
                            key={aIdx}
                            onClick={() => handleExecuteAction(act)}
                            disabled={isGenerating}
                            className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                              isDocx
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : isPdf
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isGenerating ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generando documento...
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

            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Escribe un nombre o 'Genera carta de recomendación'..."
              className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </form>
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
              <p className="text-[10px] text-slate-300 mt-0.5 leading-none">Consultas rápidas y cartas oficiales</p>
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
