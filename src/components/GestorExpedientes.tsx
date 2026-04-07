'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, X, User, FileText, Upload, Trash2, Download,
  ChevronDown, RefreshCw, AlertCircle, Check, Pencil, Eye,
  Calendar, Building2, UserCheck, UserX, Clock, Filter,
  FolderOpen, File, Image, ChevronRight, Users, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TIPOS_DOCUMENTO } from '@/types';
// ── Types ────────────────────────────────────────────────────────────
interface Expediente {
  id: string;
  cedula: string;
  nombre: string;
  cargo: string;
  fecha_ingreso: string;
  estado: 'Activo' | 'Retirado';
  fecha_retiro?: string;
  observaciones?: string;
  creado_at?: string;
}

interface Documento {
  id: string;
  expediente_id: string;
  nombre_archivo: string;
  tipo_documento: string;
  url: string;
  storage_path: string;
  subido_at: string;
}

// ── Constants ────────────────────────────────────────────────────────
const CARGOS = [
  'CONTRATISTAS DE ADMINISTRACION',
  '5 - 6', '6 - 6', 'CARTON C', 'GUACANDA',
  'TERCERA', 'ROZO', '2 - 10', 'MAYORISTA', 'GUABINAS', 'BOLIVAR', 'REMESAS'
];



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

const fileIcon = (nombre: string) => {
  const ext = nombre.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image size={14} className="text-blue-500" />;
  if (ext === 'pdf') return <FileText size={14} className="text-red-500" />;
  return <File size={14} className="text-slate-500" />;
};

const formVacio = (): Omit<Expediente, 'id' | 'creado_at'> => ({
  cedula: '', nombre: '', cargo: CARGOS[0],
  fecha_ingreso: new Date().toISOString().split('T')[0],
  estado: 'Activo', fecha_retiro: '', observaciones: '',
});

// ── Main Component ───────────────────────────────────────────────────
export const GestorExpedientes: React.FC = () => {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activo' | 'Retirado'>('Todos');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [vistaActual, setVistaActual] = useState<'lista' | 'perfil' | 'nuevo'>('lista');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [tipoDocSeleccionado, setTipoDocSeleccionado] = useState(TIPOS_DOCUMENTO[0]);
  const [form, setForm] = useState(formVacio());
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load expedientes ─────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('expedientes').select('*').order('nombre');
    if (error) setError('Error al cargar expedientes: ' + error.message);
    else setExpedientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Load documentos ──────────────────────────────────────────────
  const cargarDocumentos = useCallback(async (expedienteId: string) => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from('documentos_expediente')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('subido_at', { ascending: false });
    if (!error) setDocumentos(data || []);
    setLoadingDocs(false);
  }, []);

  // ── Filtros ──────────────────────────────────────────────────────
  const filtrados = expedientes.filter(e => {
    const matchBusqueda = !busqueda ||
      e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.cedula.includes(busqueda) ||
      e.cargo.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === 'Todos' || e.estado === filtroEstado;
    const matchCargo = !filtroCargo || e.cargo === filtroCargo;
    return matchBusqueda && matchEstado && matchCargo;
  });

  const activos = expedientes.filter(e => e.estado === 'Activo').length;
  const retirados = expedientes.filter(e => e.estado === 'Retirado').length;

  // ── Validar ──────────────────────────────────────────────────────
  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'Nombre obligatorio';
    if (!form.cedula.trim()) e.cedula = 'Cédula obligatoria';
    if (!form.fecha_ingreso) e.fecha_ingreso = 'Fecha de ingreso obligatoria';
    if (form.estado === 'Retirado' && !form.fecha_retiro) e.fecha_retiro = 'Fecha de retiro obligatoria';
    // Validar cédula duplicada
    if (form.cedula.trim() && !editando) {
      const dup = expedientes.find(ex => ex.cedula === form.cedula.trim());
      if (dup) e.cedula = `Ya existe: ${dup.nombre}`;
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  // ── Guardar expediente ───────────────────────────────────────────
  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    const payload = { ...form, cedula: form.cedula.trim(), nombre: form.nombre.trim() };
    if (editando && expedienteSeleccionado) {
      const { error } = await supabase.from('expedientes').update(payload).eq('id', expedienteSeleccionado.id);
      if (error) { setError('Error al actualizar: ' + error.message); setGuardando(false); return; }
      const updated = { ...expedienteSeleccionado, ...payload };
      setExpedientes(prev => prev.map(e => e.id === updated.id ? updated : e));
      setExpedienteSeleccionado(updated);
      setEditando(false);
      setVistaActual('perfil');
    } else {
      const id = Date.now().toString();
      const { error } = await supabase.from('expedientes').insert({ ...payload, id });
      if (error) { setError('Error al crear: ' + error.message); setGuardando(false); return; }
      await cargar();
      setVistaActual('lista');
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    setGuardando(false);
  };

  // ── Subir documento ──────────────────────────────────────────────
  const handleSubirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !expedienteSeleccionado) return;
    setSubiendoDoc(true);
    const ext = file.name.split('.').pop();
    const path = `${expedienteSeleccionado.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('expedientes').upload(path, file);
    if (uploadError) { setError('Error al subir: ' + uploadError.message); setSubiendoDoc(false); return; }
    const { data: urlData } = supabase.storage.from('expedientes').getPublicUrl(path);
    const doc: Documento = {
      id: Date.now().toString(),
      expediente_id: expedienteSeleccionado.id,
      nombre_archivo: file.name,
      tipo_documento: tipoDocSeleccionado,
      url: urlData.publicUrl,
      storage_path: path,
      subido_at: new Date().toISOString(),
    };
    const { error: dbError } = await supabase.from('documentos_expediente').insert(doc);
    if (dbError) { setError('Error al registrar documento: ' + dbError.message); }
    else { setDocumentos(prev => [doc, ...prev]); }
    setSubiendoDoc(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Eliminar documento ───────────────────────────────────────────
  const handleEliminarDoc = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    await supabase.storage.from('expedientes').remove([doc.storage_path]);
    await supabase.from('documentos_expediente').delete().eq('id', doc.id);
    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
  };

  // ── Abrir perfil ─────────────────────────────────────────────────
  const abrirPerfil = (exp: Expediente) => {
    setExpedienteSeleccionado(exp);
    setVistaActual('perfil');
    cargarDocumentos(exp.id);
  };

  // ── Abrir edición ────────────────────────────────────────────────
  const abrirEdicion = (exp: Expediente) => {
    setForm({
      cedula: exp.cedula, nombre: exp.nombre, cargo: exp.cargo,
      fecha_ingreso: exp.fecha_ingreso, estado: exp.estado,
      fecha_retiro: exp.fecha_retiro || '', observaciones: exp.observaciones || '',
    });
    setEditando(true);
    setExpedienteSeleccionado(exp);
    setVistaActual('nuevo');
  };

  const set = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errores[field]) setErrores(prev => ({ ...prev, [field]: undefined }));
  };

  // ── Render: Lista ────────────────────────────────────────────────
  const renderLista = () => (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Expedientes', value: expedientes.length, color: 'text-slate-800', bg: 'bg-white' },
          { label: 'Activos', value: activos, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Retirados', value: retirados, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
          { label: 'Mostrando', value: filtrados.length, color: 'text-slate-600', bg: 'bg-white' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl border border-gray-100 p-5 shadow-sm`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 space-y-3">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cédula o cargo…"
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400" />
          {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-slate-400 hover:text-red-400" /></button>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {(['Todos', 'Activo', 'Retirado'] as const).map(estado => (
              <button key={estado} onClick={() => setFiltroEstado(estado)}
                className={`px-4 py-2 text-xs font-black transition-all ${filtroEstado === estado
                  ? estado === 'Activo' ? 'bg-emerald-500 text-white'
                    : estado === 'Retirado' ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 hover:bg-gray-50'}`}>
                {estado}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-48">
            <select value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}
              className="w-full appearance-none px-4 py-2 pr-8 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-slate-600 outline-none cursor-pointer">
              <option value="">Todos los cargos</option>
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-sm">Cargando expedientes…</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-20 text-center">
            <FolderOpen size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No se encontraron expedientes</p>
            <p className="text-slate-300 text-sm mt-1">Intenta con otros filtros o agrega uno nuevo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Persona', 'Cargo', 'Ingreso', 'Estado', 'Documentos', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(exp => (
                  <tr key={exp.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors cursor-pointer" onClick={() => abrirPerfil(exp)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${exp.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                          {exp.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{exp.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono">C.C. {exp.cedula || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-full border whitespace-nowrap ${cargoColor[exp.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {exp.cargo}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-700">{exp.fecha_ingreso ? new Date(exp.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO') : '—'}</p>
                      {exp.fecha_retiro && <p className="text-[10px] text-rose-400 mt-0.5">Retiro: {new Date(exp.fecha_retiro + 'T00:00:00').toLocaleDateString('es-CO')}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${exp.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                        {exp.estado === 'Activo' ? <UserCheck size={10} /> : <UserX size={10} />}
                        {exp.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <FileText size={11} />ver docs
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => abrirPerfil(exp)} className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500 border border-blue-100 transition-all" title="Ver perfil">
                          <Eye size={13} />
                        </button>
                        <button onClick={() => abrirEdicion(exp)} className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-100 transition-all" title="Editar">
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-bold">{filtrados.length} de {expedientes.length} expedientes</p>
          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Sincronizado con Supabase
          </p>
        </div>
      </div>
    </div>
  );

  // ── Render: Perfil ───────────────────────────────────────────────
  const renderPerfil = () => {
    if (!expedienteSeleccionado) return null;
    const exp = expedienteSeleccionado;
    const diasEnEmpresa = exp.fecha_ingreso ? Math.floor((new Date(exp.fecha_retiro || new Date()).getTime() - new Date(exp.fecha_ingreso + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header perfil */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className={`h-24 ${exp.estado === 'Activo' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'}`} />
          <div className="px-8 pb-8 -mt-10">
            <div className="flex items-end gap-5 mb-6">
              <div className={`w-20 h-20 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-3xl font-black ${exp.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                {exp.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 pb-1">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{exp.nombre}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${cargoColor[exp.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{exp.cargo}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${exp.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                    {exp.estado === 'Activo' ? <UserCheck size={10} /> : <UserX size={10} />}{exp.estado}
                  </span>
                </div>
              </div>
              <button onClick={() => abrirEdicion(exp)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-xl font-bold text-sm transition-all">
                <Pencil size={14} />Editar
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Cédula', value: exp.cedula || '—', icon: <User size={14} /> },
                { label: 'Fecha de Ingreso', value: exp.fecha_ingreso ? new Date(exp.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO') : '—', icon: <Calendar size={14} /> },
                { label: exp.estado === 'Activo' ? 'Días en la empresa' : 'Fecha de Retiro', value: exp.estado === 'Activo' ? `${diasEnEmpresa} días` : (exp.fecha_retiro ? new Date(exp.fecha_retiro + 'T00:00:00').toLocaleDateString('es-CO') : '—'), icon: <Clock size={14} /> },
                { label: 'Cargo', value: exp.cargo, icon: <Building2 size={14} /> },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">{item.icon}{item.label}</p>
                  <p className="font-bold text-slate-800 text-sm">{item.value}</p>
                </div>
              ))}
            </div>

            {exp.observaciones && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-600 mb-1">Observaciones</p>
                <p className="text-sm text-slate-700 font-medium">{exp.observaciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
                <FolderOpen size={15} className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-800">Documentos</h3>
                <p className="text-[10px] text-slate-400">{documentos.length} archivo{documentos.length !== 1 ? 's' : ''} adjunto{documentos.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Subir documento */}
          <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Agregar documento</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Tipo de documento</label>
                <div className="relative">
                  <select value={tipoDocSeleccionado} onChange={e => setTipoDocSeleccionado(e.target.value)}
                    className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-slate-700 outline-none cursor-pointer">
                    {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <input ref={fileInputRef} type="file" onChange={handleSubirDocumento}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                  className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={subiendoDoc}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-60">
                  {subiendoDoc ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  {subiendoDoc ? 'Subiendo…' : 'Seleccionar archivo'}
                </button>
              </div>
            </div>
          </div>

          {/* Lista documentos */}
          <div className="divide-y divide-gray-50">
            {loadingDocs ? (
              <div className="py-10 text-center">
                <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : documentos.length === 0 ? (
              <div className="py-12 text-center">
                <File size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold text-sm">Sin documentos adjuntos</p>
                <p className="text-slate-300 text-xs mt-1">Sube el primer documento usando el botón de arriba</p>
              </div>
            ) : documentos.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                  {fileIcon(doc.nombre_archivo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{doc.nombre_archivo}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded">{doc.tipo_documento}</span>
                    <span className="text-[10px] text-slate-400">{new Date(doc.subido_at).toLocaleDateString('es-CO')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 transition-all" title="Descargar">
                    <Download size={13} />
                  </a>
                  <button onClick={() => handleEliminarDoc(doc)}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Formulario ───────────────────────────────────────────
  const renderFormulario = () => (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className={`p-6 ${editando ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              {editando ? <Pencil size={22} className="text-white" strokeWidth={3} /> : <Plus size={24} className="text-white" strokeWidth={3} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{editando ? 'Editar Expediente' : 'Nuevo Expediente'}</h2>
              <p className="text-white/70 text-xs mt-0.5">{editando ? 'Modifica los datos del trabajador' : 'Completa los datos del nuevo trabajador'}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Nombre completo *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.nombre ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`}
              placeholder="Ej: García López Juan" />
            {errores.nombre && <p className="text-red-500 text-[10px] font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errores.nombre}</p>}
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Cédula *</label>
            <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.cedula ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`}
              placeholder="Número de cédula" />
            {errores.cedula && <p className="text-red-500 text-[10px] font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errores.cedula}</p>}
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Cargo / Lugar</label>
            <div className="relative">
              <select value={form.cargo} onChange={e => set('cargo', e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-sm font-semibold text-slate-800 outline-none transition-all cursor-pointer">
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Fecha ingreso */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Fecha de ingreso *</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.fecha_ingreso ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`} />
            {errores.fecha_ingreso && <p className="text-red-500 text-[10px] font-bold mt-1">{errores.fecha_ingreso}</p>}
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Estado</label>
            <div className="flex gap-3">
              {(['Activo', 'Retirado'] as const).map(est => (
                <button key={est} onClick={() => set('estado', est)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-sm transition-all ${form.estado === est
                    ? est === 'Activo' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-rose-500 text-white border-rose-500'
                    : 'bg-gray-50 text-slate-500 border-gray-200 hover:border-gray-300'}`}>
                  {est === 'Activo' ? <UserCheck size={16} /> : <UserX size={16} />}{est}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha retiro */}
          {form.estado === 'Retirado' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1.5">Fecha de retiro *</label>
              <input type="date" value={form.fecha_retiro} onChange={e => set('fecha_retiro', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.fecha_retiro ? 'border-red-300 bg-red-50' : 'border-rose-200 bg-rose-50 focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100'}`} />
              {errores.fecha_retiro && <p className="text-red-500 text-[10px] font-bold mt-1">{errores.fecha_retiro}</p>}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Observaciones <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
              rows={3} placeholder="Notas adicionales sobre el trabajador…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-sm font-medium text-slate-800 outline-none transition-all resize-none placeholder:text-slate-400" />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleGuardar} disabled={guardando}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm text-white transition-all shadow-sm disabled:opacity-60 ${editando ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {guardando ? <RefreshCw size={15} className="animate-spin" /> : guardado ? <><Check size={16} />¡Guardado!</> : <><Plus size={16} />{editando ? 'Actualizar' : 'Crear Expediente'}</>}
            </button>
            <button onClick={() => { setVistaActual(expedienteSeleccionado && editando ? 'perfil' : 'lista'); setEditando(false); setErrores({}); }}
              className="px-5 py-3.5 rounded-xl border border-gray-200 text-slate-500 hover:text-red-500 hover:border-red-200 font-bold text-sm transition-all">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-100/30 blur-[120px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-100/20 blur-[100px] rounded-full -z-10 translate-x-1/4 translate-y-1/4" />

      {/* Error */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold max-w-lg w-full mx-4">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={15} /></button>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {vistaActual !== 'lista' && (
              <button onClick={() => { setVistaActual('lista'); setEditando(false); setExpedienteSeleccionado(null); }}
                className="p-2 rounded-xl hover:bg-gray-100 text-slate-500 hover:text-slate-800 transition-all">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <span className="text-lg font-black text-slate-800 tracking-tighter block leading-none">Expedientes</span>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em] mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />Fundamiga
                </p>
              </div>
            </div>
            {vistaActual === 'perfil' && expedienteSeleccionado && (
              <div className="flex items-center gap-2 text-slate-400">
                <ChevronRight size={14} />
                <span className="text-sm font-bold text-slate-600">{expedienteSeleccionado.nombre}</span>
              </div>
            )}
            {vistaActual === 'nuevo' && (
              <div className="flex items-center gap-2 text-slate-400">
                <ChevronRight size={14} />
                <span className="text-sm font-bold text-slate-600">{editando ? 'Editar' : 'Nuevo'}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cargar} className="p-2.5 rounded-xl border border-gray-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all" title="Recargar">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => { setForm(formVacio()); setEditando(false); setErrores({}); setVistaActual('nuevo'); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-sm transition-all shadow-sm">
              <Plus size={16} />Nuevo Expediente
            </button>
          </div>
        </div>
      </nav>

      {/* Breadcrumb stats en lista */}
      {vistaActual === 'lista' && (
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-1.5 w-12 bg-emerald-500 rounded-full" />
            <div className="h-1.5 w-4 bg-yellow-400 rounded-full" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
            Gestión de <span className="text-emerald-600">Expedientes</span>
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-base border-l-4 border-yellow-400 pl-5">
            Archivador digital de personal — busca, consulta y gestiona documentos de cada trabajador.
          </p>
        </div>
      )}

      {/* Content */}
      {vistaActual === 'lista' && renderLista()}
      {vistaActual === 'perfil' && renderPerfil()}
      {vistaActual === 'nuevo' && renderFormulario()}
    </div>
  );
};
