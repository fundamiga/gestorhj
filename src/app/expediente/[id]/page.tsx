'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, FileText, Upload, Download, Trash2, Pencil, Save,
  X, AlertCircle, RefreshCw, Check, Eye, Clock, UserCheck,
  UserX, Plus, ChevronDown, Calendar, Archive
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { supabaseStorage, uploadToCorrectBucket, deleteFromCorrectBucket } from '@/lib/supabaseStorage';
import { Expediente, DocumentoExpediente, CARGOS, TIPOS_DOCUMENTO, DOCUMENTOS_ESENCIALES } from '@/types';

const cargoColor: Record<string, string> = {
  'CONTRATISTAS DE ADMINISTRACION': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '5 - 6': 'bg-blue-50 text-blue-700 border-blue-200',
  '6 - 6': 'bg-violet-50 text-violet-700 border-violet-200',
  'CARTON C': 'bg-orange-50 text-orange-700 border-orange-200',
  'GUACANDA': 'bg-teal-50 text-teal-700 border-teal-200',
  'TERCERA': 'bg-pink-50 text-pink-700 border-pink-200',
  'ROZO': 'bg-amber-50 text-amber-700 border-amber-200',
  '2 - 10': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'MAYORISTA': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'GUABINAS': 'bg-rose-50 text-rose-700 border-rose-200',
  'BOLIVAR': 'bg-lime-50 text-lime-700 border-lime-200',
  'REMESAS' : 'bg-lime-50 text-lime-700 border-lime-200',
};

const tipoIcono: Record<string, string> = {
  'Hoja de Vida': '📄',
  'Cédula de Ciudadanía': '🪪',
  'Contrato': '📝',

  'Solicitud de Ingreso': '📑',
  'Solicitud de Retiro': '📤',

  
  'Certificado EPS': '🏥',

  'Afiliación ARL': '🦺',

  'RUT': '🧾',

  'Firma': '✍️',

  // 🔥 ANTECEDENTES
  'Antecedentes Policía': '👮',
  'Antecedentes Contraloría': '📊',
  'Antecedentes Procuraduría': '⚖️',

  
  'Carta de Renuncia': '📮',
  'Acta de Liquidación': '📋',
  'Certificado de cuenta': '🏦',
  'Otro': '📎',
};


export default function ExpedienteDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoExpediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [formEdit, setFormEdit] = useState<Partial<Expediente>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [tipoDoc, setTipoDoc] = useState(TIPOS_DOCUMENTO[0]);
  const [fechaVencDoc, setFechaVencDoc] = useState('');
  const [notaDoc, setNotaDoc] = useState('');
  const [eliminandoDoc, setEliminandoDoc] = useState<string | null>(null);
  const [confirmEliminarExp, setConfirmEliminarExp] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [editandoDocId, setEditandoDocId] = useState<string | null>(null);
  const [notaEditando, setNotaEditando] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: exp, error: e1 } = await supabase.from('expedientes').select('*').eq('id', id).single();
    if (e1 || !exp) { setError('Expediente no encontrado'); setLoading(false); return; }
    setExpediente(exp); setFormEdit(exp);
    const { data: docs } = await supabase.from('documentos_expediente').select('*').eq('expediente_id', id).order('subido_at', { ascending: false });
    setDocumentos(docs || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { 
    cargar(); 
  }, [cargar]);

  const guardarEdicion = async () => {
    if (!formEdit.nombre?.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from('expedientes').update({
      cedula: formEdit.cedula || null,
      nombre: formEdit.nombre,
      cargo: formEdit.cargo,
      fecha_ingreso: formEdit.fecha_ingreso || null,
      estado: formEdit.estado,
      fecha_retiro: formEdit.fecha_retiro?.trim() ? formEdit.fecha_retiro : null,
      observaciones: formEdit.observaciones || null,
    }).eq('id', id);
    if (error) { setError('Error al guardar: ' + error.message); setGuardando(false); return; }
    setExpediente(prev => prev ? { ...prev, ...formEdit } as Expediente : prev);
    setGuardado(true);
    setTimeout(() => { setGuardado(false); setEditando(false); }, 1500);
    setGuardando(false);
  };

  const subirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true); setError(null);
    
    try {
      // 1. Subir a la NUEVA cuenta de Supabase Storage usando el helper robusto
      const path = `${id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { url, path: finalPath } = await uploadToCorrectBucket(path, file);

      // 2. Guardar referencia en la base de datos principal de Supabase
      const docId = Date.now().toString();
      const newDoc = {
        id: docId,
        expediente_id: id,
        nombre_archivo: file.name,
        tipo_documento: tipoDoc,
        url: url,
        storage_path: finalPath,
        fecha_vencimiento: fechaVencDoc || null,
        notas: notaDoc.trim() || null,
      };

      const { error: dbError } = await supabase.from('documentos_expediente').insert(newDoc);
      
      if (dbError) throw dbError;

      setDocumentos(prev => [
        { ...newDoc, fecha_vencimiento: fechaVencDoc || undefined, notas: notaDoc.trim() || undefined },
        ...prev
      ]);

      e.target.value = '';
      setFechaVencDoc('');
      setNotaDoc('');
    } catch (err: any) {
      console.error('Error en proceso de subida:', err);
      setError('Error al subir documento: ' + err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarDocumento = async (doc: DocumentoExpediente) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    setEliminandoDoc(doc.id);
    
    try {
      const isNewSupabase = doc.url.includes('gimldpldmkqvgizkczrs'); // Detectar si es la cuenta nueva

      if (isNewSupabase) {
        // Eliminar de la nueva cuenta usando el helper robusto
        await deleteFromCorrectBucket(doc.storage_path);
      } else {
        // Eliminar de la cuenta vieja (principal)
        await supabase.storage.from('expedientes').remove([doc.storage_path]);
      }

      await supabase.from('documentos_expediente').delete().eq('id', doc.id);
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      setError('Error al eliminar: ' + err.message);
    } finally {
      setEliminandoDoc(null);
    }
  };

  const guardarNotaDoc = async (docId: string) => {
    await supabase.from('documentos_expediente').update({ notas: notaEditando || null }).eq('id', docId);
    setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, notas: notaEditando || undefined } : d));
    setEditandoDocId(null);
  };

  const descargarTodo = async () => {
    if (documentos.length === 0) return;
    setDescargando(true);
    // Descargar uno por uno en secuencia
    for (const doc of documentos) {
      const a = document.createElement('a');
      a.href = doc.url;
      a.download = doc.nombre_archivo;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 500));
    }
    setDescargando(false);
  };

  const eliminarExpediente = async () => {
    if (documentos.length > 0) await supabase.storage.from('expedientes').remove(documentos.map(d => d.storage_path));
    await supabase.from('expedientes').delete().eq('id', id);
    router.push('/');
  };

  const tiempoEnEmpresa = () => {
    if (!expediente?.fecha_ingreso) return '—';
    const inicio = new Date(expediente.fecha_ingreso);
    const fin = expediente.fecha_retiro ? new Date(expediente.fecha_retiro) : new Date();
    const meses = Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (meses < 1) return 'Menos de 1 mes';
    if (meses < 12) return `${meses} mes${meses > 1 ? 'es' : ''}`;
    const años = Math.floor(meses / 12); const m = meses % 12;
    return `${años} año${años > 1 ? 's' : ''}${m > 0 ? ` y ${m} mes${m > 1 ? 'es' : ''}` : ''}`;
  };

  // Documentos esenciales faltantes
  const tiposActuales = documentos.map(d => d.tipo_documento);
  const faltantes = DOCUMENTOS_ESENCIALES.filter(d => !tiposActuales.includes(d));

  // Documentos próximos a vencer (30 días)
  const hoy = new Date();
  const porVencer = documentos.filter(d => {
    if (!d.fecha_vencimiento) return false;
    const venc = new Date(d.fecha_vencimiento);
    const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
    return dias >= 0 && dias <= 30;
  });
  const vencidos = documentos.filter(d => {
    if (!d.fecha_vencimiento) return false;
    return new Date(d.fecha_vencimiento) < hoy;
  });

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-semibold">Cargando expediente…</p>
      </div>
    </div>
  );

  if (!expediente) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={36} className="text-red-300 mx-auto mb-3" />
        <p className="text-slate-500 font-bold">Expediente no encontrado</p>
        <Link href="/" className="mt-4 inline-block text-emerald-600 font-black text-sm hover:underline">← Volver</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-100/30 blur-[120px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-100/20 blur-[100px] rounded-full -z-10 translate-x-1/4 translate-y-1/4" />

      {/* Modal eliminar */}
      {confirmEliminarExp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-slate-800 text-lg mb-2">¿Eliminar expediente?</h3>
            <p className="text-slate-500 text-sm mb-4">Se eliminarán <strong>{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</strong> adjuntos. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={eliminarExpediente} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-2.5 rounded-xl text-sm transition-all">Sí, eliminar</button>
              <button onClick={() => setConfirmEliminarExp(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-600 font-black py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <Image src="/LOGO.png" alt="Fundamiga Logo" fill sizes="48px" className="object-contain p-1.5" priority />
            </div>
            <div>
              <span className="text-xl font-black text-slate-800 tracking-tighter leading-none block">Fundamiga</span>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em] mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />Expediente de Personal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!editando ? (
              <>
                <button onClick={() => setEditando(true)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs transition-all">
                  <Pencil size={13} />Editar
                </button>
                <button onClick={() => setConfirmEliminarExp(true)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs transition-all">
                  <Trash2 size={13} />Eliminar
                </button>
              </>
            ) : (
              <>
                <button onClick={guardarEdicion} disabled={guardando || guardado}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all disabled:opacity-60">
                  {guardando ? <RefreshCw size={13} className="animate-spin" /> : guardado ? <><Check size={13} />¡Guardado!</> : <><Save size={13} />Guardar cambios</>}
                </button>
                <button onClick={() => { setEditando(false); setFormEdit(expediente); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-slate-500 hover:bg-gray-50 font-bold text-xs transition-all">
                  <X size={13} />Cancelar
                </button>
              </>
            )}
            <Link href="/" className="group flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-all px-5 py-2.5 rounded-2xl hover:bg-emerald-50 border border-transparent hover:border-emerald-100/50 shadow-sm font-black text-sm">
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />Volver
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={18} className="shrink-0" /><p className="text-sm font-semibold flex-1">{error}</p>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}

        {/* Alertas vencimiento */}
        {vencidos.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <p className="text-sm font-semibold text-red-700 flex-1">
              <strong>{vencidos.length} documento{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''}</strong>: {vencidos.map(d => d.nombre_archivo).join(', ')}
            </p>
          </div>
        )}
        {porVencer.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Clock size={16} className="shrink-0 text-amber-500" />
            <p className="text-sm font-semibold text-amber-700 flex-1">
              <strong>{porVencer.length} documento{porVencer.length !== 1 ? 's' : ''} por vencer</strong> en los próximos 30 días
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Perfil */}
          <div className="lg:col-span-1 sticky top-28 space-y-4">
            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-emerald-50 transition-all duration-500">
              <div className={`p-6 ${expediente.estado === 'Activo' ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                  <span className="text-3xl font-black text-white">{expediente.nombre.charAt(0).toUpperCase()}</span>
                </div>
                {!editando ? (
                  <>
                    <h2 className="text-xl font-black text-white leading-tight">{expediente.nombre}</h2>
                    <p className="text-white/70 text-xs mt-1 font-mono">C.C. {expediente.cedula || 'No registrada'}</p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input value={formEdit.nombre || ''} onChange={e => setFormEdit(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-white/50 font-bold text-sm outline-none focus:bg-white/30" />
                    <input value={formEdit.cedula || ''} onChange={e => setFormEdit(p => ({ ...p, cedula: e.target.value }))}
                      placeholder="Cédula"
                      className="w-full px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-white/50 font-semibold text-xs outline-none" />
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                {/* Estado */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Estado</p>
                  {!editando ? (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border ${expediente.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {expediente.estado === 'Activo' ? <UserCheck size={12} /> : <UserX size={12} />}{expediente.estado}
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      {(['Activo', 'Retirado'] as const).map(e => (
                        <button key={e} onClick={() => setFormEdit(p => ({ ...p, estado: e }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${formEdit.estado === e ? e === 'Activo' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-500' : 'bg-gray-50 text-slate-500 border-gray-200'}`}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cargo */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Cargo / Parqueadero</p>
                  {!editando ? (
                    <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-full border ${cargoColor[expediente.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{expediente.cargo}</span>
                  ) : (
                    <div className="relative">
                      <select value={formEdit.cargo} onChange={e => setFormEdit(p => ({ ...p, cargo: e.target.value }))}
                        className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-slate-700 outline-none cursor-pointer">
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Fecha ingreso */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Fecha de Ingreso</p>
                  {!editando ? (
                    <p className="text-sm font-semibold text-slate-700">
                      {expediente.fecha_ingreso ? new Date(expediente.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  ) : (
                    <input type="date" value={formEdit.fecha_ingreso || ''} onChange={e => setFormEdit(p => ({ ...p, fecha_ingreso: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-slate-700 outline-none" />
                  )}
                </div>

                {/* Tiempo */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                    {expediente.estado === 'Activo' ? 'Tiempo en la empresa' : 'Tiempo trabajado'}
                  </p>
                  <p className="text-sm font-black text-emerald-700">{tiempoEnEmpresa()}</p>
                </div>

                {/* Fecha retiro */}
                {(expediente.estado === 'Retirado' || formEdit.estado === 'Retirado') && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-2">Fecha de Retiro</p>
                    {!editando ? (
                      <div className="flex items-center gap-1.5 text-rose-500 text-sm font-semibold">
                        <Clock size={13} />{expediente.fecha_retiro ? new Date(expediente.fecha_retiro + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      </div>
                    ) : (
                      <input type="date" value={formEdit.fecha_retiro || ''} onChange={e => setFormEdit(p => ({ ...p, fecha_retiro: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-slate-700 outline-none" />
                    )}
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Observaciones</p>
                  {!editando ? (
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{expediente.observaciones || <span className="text-slate-300 italic">Sin observaciones</span>}</p>
                  ) : (
                    <textarea value={formEdit.observaciones || ''} onChange={e => setFormEdit(p => ({ ...p, observaciones: e.target.value }))}
                      rows={3} placeholder="Notas adicionales…"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-slate-700 outline-none resize-none focus:border-emerald-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Documentos faltantes */}
            {faltantes.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-1.5">
                  <AlertCircle size={11} />Documentos faltantes
                </p>
                <div className="space-y-1.5">
                  {faltantes.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="text-base">{tipoIcono[d] || '📎'}</span>
                      <span className="text-xs text-slate-500 font-medium">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen tipos */}
            {documentos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Documentos por tipo</p>
                <div className="space-y-2">
                  {Object.entries(documentos.reduce((acc, d) => { acc[d.tipo_documento] = (acc[d.tipo_documento] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([tipo, count]) => (
                    <div key={tipo} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-medium">{tipoIcono[tipo] || '📎'} {tipo}</span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Documentos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subir */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Upload size={14} className="text-blue-600" />
                </div>
                <h3 className="font-black text-slate-800">Subir Documento</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none cursor-pointer focus:border-emerald-400 transition-all">
                    {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{tipoIcono[t]} {t}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="date" value={fechaVencDoc} onChange={e => setFechaVencDoc(e.target.value)}
                    placeholder="Fecha vencimiento"
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-amber-400 transition-all" />
                </div>
              </div>
              <div className="mb-3">
                <input value={notaDoc} onChange={e => setNotaDoc(e.target.value)}
                  placeholder="Nota o comentario sobre este documento (opcional)"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 transition-all placeholder:text-slate-400" />
              </div>
              <label className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm cursor-pointer transition-all ${subiendo ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'}`}>
                {subiendo ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                {subiendo ? 'Subiendo…' : 'Seleccionar y subir archivo'}
                <input type="file" className="hidden" onChange={subirDocumento} disabled={subiendo} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" />
              </label>
              <p className="text-[10px] text-slate-400 mt-2 font-medium text-center">PDF, Word, Excel, imágenes — La fecha de vencimiento es opcional</p>
            </div>

            {/* Lista documentos */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <FileText size={14} className="text-blue-600" />
                  </div>
                  <h3 className="font-black text-slate-800">
                    Documentos <span className="text-slate-400 font-semibold">({documentos.length})</span>
                  </h3>
                </div>
                {documentos.length > 0 && (
                  <button onClick={descargarTodo} disabled={descargando}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 font-bold text-xs transition-all disabled:opacity-40">
                    {descargando ? <RefreshCw size={13} className="animate-spin" /> : <Archive size={13} />}
                    {descargando ? 'Descargando…' : 'Descargar todo'}
                  </button>
                )}
              </div>

              {documentos.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-bold text-sm">Sin documentos</p>
                  <p className="text-slate-300 text-xs mt-1">Sube el primer documento de este expediente</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {documentos.map(doc => {
                    const vencido = doc.fecha_vencimiento && new Date(doc.fecha_vencimiento) < hoy;
                    const diasParaVencer = doc.fecha_vencimiento
                      ? Math.ceil((new Date(doc.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000)
                      : null;
                    const proximoVencer = diasParaVencer !== null && diasParaVencer >= 0 && diasParaVencer <= 30;

                    return (
                      <div key={doc.id} className={`px-6 py-4 hover:bg-gray-50/50 transition-colors group ${vencido ? 'bg-red-50/30' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
                            {tipoIcono[doc.tipo_documento] || '📎'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{doc.nombre_archivo}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{doc.tipo_documento}</span>
                              {doc.subido_at && <span className="text-[10px] text-slate-400 font-medium">{new Date(doc.subido_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                              {vencido && <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">⚠ Vencido</span>}
                              {proximoVencer && <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">⏰ Vence en {diasParaVencer}d</span>}
                              {doc.fecha_vencimiento && !vencido && !proximoVencer && (
                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Calendar size={9} />Vence: {new Date(doc.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              )}
                            </div>
                            {/* Nota */}
                            {editandoDocId === doc.id ? (
                              <div className="mt-2 flex gap-2">
                                <input autoFocus value={notaEditando} onChange={e => setNotaEditando(e.target.value)}
                                  placeholder="Agregar nota…"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-emerald-400 font-medium text-slate-700 bg-gray-50" />
                                <button onClick={() => guardarNotaDoc(doc.id)} className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-xs font-black"><Check size={11} /></button>
                                <button onClick={() => setEditandoDocId(null)} className="px-2 py-1 bg-gray-100 text-slate-500 rounded-lg text-xs font-black"><X size={11} /></button>
                              </div>
                            ) : doc.notas ? (
                              <p className="text-[10px] text-slate-500 mt-1 italic cursor-pointer hover:text-emerald-600 transition-colors"
                                onClick={() => { setEditandoDocId(doc.id); setNotaEditando(doc.notas || ''); }}>
                                💬 {doc.notas}
                              </p>
                            ) : (
                              <button onClick={() => { setEditandoDocId(doc.id); setNotaEditando(''); }}
                                className="text-[10px] text-slate-300 hover:text-slate-500 mt-1 transition-colors opacity-0 group-hover:opacity-100">
                                + agregar nota
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 transition-all" title="Ver">
                              <Eye size={13} />
                            </a>
                            <a href={doc.url} download={doc.nombre_archivo}
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 transition-all" title="Descargar">
                              <Download size={13} />
                            </a>
                            <button onClick={() => eliminarDocumento(doc)} disabled={eliminandoDoc === doc.id}
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all disabled:opacity-40" title="Eliminar">
                              {eliminandoDoc === doc.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {documentos.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-bold">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Nuevos archivos almacenados en Cuenta de Respaldo
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
