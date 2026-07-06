'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, Plus, Eye, Calendar, FileText, ChevronDown,
  X, RefreshCw, AlertCircle, Building2, ArrowUpDown, ShieldAlert,
  Banknote, ArrowRightLeft, LogOut, LogIn, Check
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Expediente, CARGOS, DOCUMENTOS_ESENCIALES } from '@/types';

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
  'REMESAS': 'bg-purple-50 text-purple-700 border-purple-200',
};

const CARGOS_SIN_REMESAS = CARGOS.filter(c => c !== 'REMESAS');

// ── Indicador de completitud ──────────────────────────────────────────────────
function IndicadorExpediente({ tiposDocumentos }: { tiposDocumentos: string[] }) {
  const faltantes = DOCUMENTOS_ESENCIALES.filter(d => !tiposDocumentos.includes(d));
  const completo = faltantes.length === 0;
  const parcial = faltantes.length <= 2;
  if (completo) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />OK
    </span>
  );
  if (parcial) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full" title={`Faltan: ${faltantes.join(', ')}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{faltantes.length} falt.
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full" title={`Faltan: ${faltantes.join(', ')}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{faltantes.length} falt.
    </span>
  );
}

function DocumentInfo({ expedienteId, onLoad }: { expedienteId: string; onLoad: (id: string, count: number, tipos: string[]) => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [tipos, setTipos] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('documentos_expediente')
      .select('tipo_documento')
      .eq('expediente_id', expedienteId)
      .then(({ data }) => {
        const t = (data || []).map((d: any) => d.tipo_documento);
        setCount(t.length); setTipos(t);
        onLoad(expedienteId, t.length, t);
      });
  }, [expedienteId, onLoad]);
  if (count === null) return <span className="text-slate-300 text-xs">…</span>;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${count > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
        <FileText size={11} />{count} {count === 1 ? 'doc' : 'docs'}
      </span>
      <IndicadorExpediente tiposDocumentos={tipos} />
    </div>
  );
}

type OrdenType = 'nombre' | 'ingreso_asc' | 'ingreso_desc' | 'reciente';
type VistaTab = 'expedientes' | 'remesas';

// ── Fila de tabla ─────────────────────────────────────────────────────────────
function FilaExpediente({
  exp,
  docsMap,
  handleDocLoad,
  modoRemesas,
  toggling,
  quitandoId,
  cargoRestaurar,
  onAgregarRemesa,
  onIniciarQuitar,
  onCancelarQuitar,
  onConfirmarQuitar,
  onCargoChange,
}: {
  exp: Expediente;
  docsMap: Record<string, { count: number; tipos: string[] }>;
  handleDocLoad: (id: string, count: number, tipos: string[]) => void;
  modoRemesas: boolean;
  toggling: string | null;
  quitandoId: string | null;
  cargoRestaurar: string;
  onAgregarRemesa: (exp: Expediente) => void;
  onIniciarQuitar: (id: string) => void;
  onCancelarQuitar: () => void;
  onConfirmarQuitar: (exp: Expediente) => void;
  onCargoChange: (v: string) => void;
}) {
  const esEstaFila = toggling === exp.id || quitandoId === exp.id;

  return (
    <tr className={`border-b border-gray-50 transition-colors ${modoRemesas ? 'hover:bg-purple-50/30' : 'hover:bg-emerald-50/30'}`}>
      {/* Trabajador */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${exp.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {exp.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{exp.nombre}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">C.C. {exp.cedula || '—'}</p>
          </div>
        </div>
      </td>
      {/* Cargo */}
      <td className="px-5 py-4">
        <span className={`text-[9px] font-black px-2 py-1 rounded-full border whitespace-nowrap ${cargoColor[exp.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          {exp.cargo}
        </span>
      </td>
      {/* Fecha ingreso */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
          <Calendar size={11} className={modoRemesas ? 'text-purple-400' : 'text-emerald-500'} />
          {exp.fecha_ingreso ? new Date(exp.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </div>
        {exp.fecha_retiro && (
          <div className="text-[10px] text-rose-400 font-medium mt-0.5">
            Retiro: {new Date(exp.fecha_retiro + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        )}
      </td>
      {/* Estado */}
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${exp.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${exp.estado === 'Activo' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
          {exp.estado}
        </span>
      </td>
      {/* Docs */}
      <td className="px-5 py-4">
        <DocumentInfo expedienteId={exp.id} onLoad={handleDocLoad} />
      </td>
      {/* Acciones */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/expediente/${exp.id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${modoRemesas ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-100' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100'}`}>
            <Eye size={12} />Ver
          </Link>

          {/* Agregar a Remesas (desde expedientes) */}
          {!modoRemesas && (
            <button
              onClick={() => onAgregarRemesa(exp)}
              disabled={toggling === exp.id}
              title="Agregar a Remesas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-100 hover:border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {toggling === exp.id
                ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <><LogIn size={12} />Remesas</>}
            </button>
          )}

          {/* Quitar de Remesas (desde remesas) */}
          {modoRemesas && (
            <>
              {quitandoId === exp.id ? (
                // Selector de cargo para restaurar
                <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="relative">
                    <select
                      value={cargoRestaurar}
                      onChange={e => onCargoChange(e.target.value)}
                      className="appearance-none pl-2 pr-6 py-1.5 bg-white border border-slate-300 rounded-xl text-[10px] font-semibold text-slate-700 outline-none cursor-pointer focus:border-emerald-400 transition-all"
                    >
                      <option value="">Selecciona cargo…</option>
                      {CARGOS_SIN_REMESAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={() => onConfirmarQuitar(exp)}
                    disabled={!cargoRestaurar || toggling === exp.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {toggling === exp.id
                      ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Check size={11} />OK</>}
                  </button>
                  <button
                    onClick={onCancelarQuitar}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onIniciarQuitar(exp.id)}
                  disabled={!!toggling}
                  title="Quitar de Remesas"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100 hover:border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut size={12} />Quitar
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Tabla reutilizable ────────────────────────────────────────────────────────
function TablaExpedientes({
  filtrados, docsMap, handleDocLoad, modoRemesas, toggling,
  quitandoId, cargoRestaurar,
  onAgregarRemesa, onIniciarQuitar, onCancelarQuitar, onConfirmarQuitar, onCargoChange,
}: {
  filtrados: Expediente[];
  docsMap: Record<string, { count: number; tipos: string[] }>;
  handleDocLoad: (id: string, count: number, tipos: string[]) => void;
  modoRemesas: boolean;
  toggling: string | null;
  quitandoId: string | null;
  cargoRestaurar: string;
  onAgregarRemesa: (exp: Expediente) => void;
  onIniciarQuitar: (id: string) => void;
  onCancelarQuitar: () => void;
  onConfirmarQuitar: (exp: Expediente) => void;
  onCargoChange: (v: string) => void;
}) {
  if (filtrados.length === 0) return (
    <div className="py-16 text-center">
      <Users size={32} className="text-slate-200 mx-auto mb-3" />
      <p className="text-slate-400 font-bold text-sm">No se encontraron expedientes</p>
      {!modoRemesas && (
        <Link href="/nuevo" className="inline-flex items-center gap-2 mt-4 text-emerald-600 font-black text-sm hover:underline">
          <Plus size={14} />Crear primer expediente
        </Link>
      )}
    </div>
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/50">
          {['Trabajador', 'Cargo / Lugar', 'Fecha Ingreso', 'Estado', 'Documentos', 'Acciones'].map(h => (
            <th key={h} className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtrados.map(exp => (
          <FilaExpediente
            key={exp.id}
            exp={exp}
            docsMap={docsMap}
            handleDocLoad={handleDocLoad}
            modoRemesas={modoRemesas}
            toggling={toggling}
            quitandoId={quitandoId}
            cargoRestaurar={cargoRestaurar}
            onAgregarRemesa={onAgregarRemesa}
            onIniciarQuitar={onIniciarQuitar}
            onCancelarQuitar={onCancelarQuitar}
            onConfirmarQuitar={onConfirmarQuitar}
            onCargoChange={onCargoChange}
          />
        ))}
      </tbody>
    </table>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaTab, setVistaTab] = useState<VistaTab>('expedientes');
  const [toggling, setToggling] = useState<string | null>(null);

  // Estado para quitar de remesas
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [cargoRestaurar, setCargoRestaurar] = useState('');

  // Filtros — Expedientes
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activo' | 'Retirado'>('Todos');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroDocFaltante, setFiltroDocFaltante] = useState('');
  const [orden, setOrden] = useState<OrdenType>('nombre');

  // Filtros — Remesas
  const [busquedaRemesas, setBusquedaRemesas] = useState('');
  const [filtroEstadoRemesas, setFiltroEstadoRemesas] = useState<'Todos' | 'Activo' | 'Retirado'>('Todos');
  const [ordenRemesas, setOrdenRemesas] = useState<OrdenType>('nombre');

  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [docsMap, setDocsMap] = useState<Record<string, { count: number; tipos: string[] }>>({});

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('expedientes').select('*');
    if (error) setError('Error al cargar expedientes: ' + error.message);
    else setExpedientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleDocLoad = useCallback((id: string, count: number, tipos: string[]) => {
    setDocsMap(prev => ({ ...prev, [id]: { count, tipos } }));
  }, []);

  // ── Agregar a Remesas: cambia cargo a 'REMESAS' ───────────────────────────
  const handleAgregarRemesa = useCallback(async (exp: Expediente) => {
    setToggling(exp.id);
    const { error } = await supabase
      .from('expedientes')
      .update({ cargo: 'REMESAS' })
      .eq('id', exp.id);
    if (error) {
      setError('Error al mover a Remesas: ' + error.message);
    } else {
      setExpedientes(prev => prev.map(e => e.id === exp.id ? { ...e, cargo: 'REMESAS' } : e));
    }
    setToggling(null);
  }, []);

  // ── Quitar de Remesas: restaura el cargo seleccionado ─────────────────────
  const handleConfirmarQuitar = useCallback(async (exp: Expediente) => {
    if (!cargoRestaurar) return;
    setToggling(exp.id);
    const { error } = await supabase
      .from('expedientes')
      .update({ cargo: cargoRestaurar })
      .eq('id', exp.id);
    if (error) {
      setError('Error al quitar de Remesas: ' + error.message);
    } else {
      setExpedientes(prev => prev.map(e => e.id === exp.id ? { ...e, cargo: cargoRestaurar } : e));
      setQuitandoId(null);
      setCargoRestaurar('');
    }
    setToggling(null);
  }, [cargoRestaurar]);

  // Separación
  const expedientesRemesas = expedientes.filter(e => e.cargo === 'REMESAS');
  const expedientesNormales = expedientes.filter(e => e.cargo !== 'REMESAS');

  // Filtrar normales
  let filtrados = expedientesNormales.filter(e => {
    const matchB = !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (e.cedula || '').includes(busqueda) || e.cargo.toLowerCase().includes(busqueda.toLowerCase());
    const matchE = filtroEstado === 'Todos' || e.estado === filtroEstado;
    const matchC = !filtroCargo || e.cargo === filtroCargo;
    const matchDoc = !filtroDocFaltante || !(docsMap[e.id]?.tipos || []).includes(filtroDocFaltante);
    return matchB && matchE && matchC && matchDoc;
  });
  filtrados = [...filtrados].sort((a, b) => {
    if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
    if (orden === 'ingreso_asc') return (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || '');
    if (orden === 'ingreso_desc') return (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '');
    if (orden === 'reciente') return (b.creado_at || '').localeCompare(a.creado_at || '');
    return 0;
  });

  // Filtrar remesas
  let filtradosRemesas = expedientesRemesas.filter(e => {
    const matchB = !busquedaRemesas || e.nombre.toLowerCase().includes(busquedaRemesas.toLowerCase()) || (e.cedula || '').includes(busquedaRemesas);
    const matchE = filtroEstadoRemesas === 'Todos' || e.estado === filtroEstadoRemesas;
    return matchB && matchE;
  });
  filtradosRemesas = [...filtradosRemesas].sort((a, b) => {
    if (ordenRemesas === 'nombre') return a.nombre.localeCompare(b.nombre);
    if (ordenRemesas === 'ingreso_asc') return (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || '');
    if (ordenRemesas === 'ingreso_desc') return (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '');
    if (ordenRemesas === 'reciente') return (b.creado_at || '').localeCompare(a.creado_at || '');
    return 0;
  });

  // Stats
  const activos = expedientesNormales.filter(e => e.estado === 'Activo').length;
  const retirados = expedientesNormales.filter(e => e.estado === 'Retirado').length;
  const incompletos = expedientesNormales.filter(e => {
    const tipos = docsMap[e.id]?.tipos || [];
    return DOCUMENTOS_ESENCIALES.some(d => !tipos.includes(d));
  }).length;
  const activosRemesas = expedientesRemesas.filter(e => e.estado === 'Activo').length;
  const retiradosRemesas = expedientesRemesas.filter(e => e.estado === 'Retirado').length;

  const resumenPorCargo = CARGOS_SIN_REMESAS.map(cargo => ({
    cargo,
    activos: expedientesNormales.filter(e => e.cargo === cargo && e.estado === 'Activo').length,
    total: expedientesNormales.filter(e => e.cargo === cargo).length,
  })).filter(r => r.total > 0);

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-100/40 blur-[140px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-100/30 blur-[120px] rounded-full -z-10 translate-x-1/4 translate-y-1/4" />

      {/* NAV */}
      <nav className="max-w-7xl mx-auto mt-6 px-6 sticky top-6 z-40">
        <div className="glass-panel rounded-[2rem] px-8 py-4 flex items-center justify-between shadow-2xl shadow-emerald-900/5">
          <div className="flex items-center gap-4">
            <div className="relative w-11 h-11 bg-white rounded-2xl shadow-inner overflow-hidden border border-slate-100 p-1.5">
              <Image src="/LOGO.png" alt="Fundamiga Logo" fill sizes="48px" className="object-contain" priority />
            </div>
            <div>
              <span className="text-xl font-black text-slate-800 tracking-tighter leading-none block premium-gradient-text">Fundamiga</span>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />Portal RRHH
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMostrarResumen(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all duration-300 ${mostrarResumen ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'}`}>
              <Building2 size={14} />Resumen
            </button>
            <button onClick={cargar} className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 hover:rotate-180 transition-all duration-500">
              <RefreshCw size={16} />
            </button>
            <Link href="/nuevo" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5">
              <Plus size={16} />Nuevo Registro
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="mb-10 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1.5 w-12 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <div className="h-1.5 w-4 bg-yellow-400 rounded-full" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
            Archivo Digital de <span className="premium-gradient-text text-emerald-600">Personal</span>
          </h1>
          <p className="text-slate-500 font-medium mt-4 text-xl border-l-4 border-yellow-400 pl-8 max-w-2xl leading-relaxed">
            Gestión eficiente y centralizada de <span className="text-slate-900 font-black">hojas de vida</span> y documentos esenciales para Fundamiga.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        {/* TABS */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setVistaTab('expedientes')}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm transition-all duration-300 ${
              vistaTab === 'expedientes'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            <Users size={16} />Expedientes
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${vistaTab === 'expedientes' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {loading ? '…' : expedientesNormales.length}
            </span>
          </button>

          <button
            onClick={() => setVistaTab('remesas')}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm transition-all duration-300 ${
              vistaTab === 'remesas'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-105'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-purple-300 hover:text-purple-600'
            }`}
          >
            <Banknote size={16} />Remesas
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${vistaTab === 'remesas' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'}`}>
              {loading ? '…' : expedientesRemesas.length}
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-white border border-slate-100 px-4 py-2.5 rounded-2xl">
            <ArrowRightLeft size={12} />
            Botón <span className="text-purple-500 font-black">Remesas</span> para mover · <span className="text-rose-500 font-black">Quitar</span> para devolver
          </div>
        </div>

        {/* ═══════════════════════════════════
            EXPEDIENTES
        ═══════════════════════════════════ */}
        {vistaTab === 'expedientes' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Total Expedientes', value: loading ? '…' : expedientesNormales.length, color: 'text-slate-700' },
                { label: 'Activos', value: loading ? '…' : activos, color: 'text-emerald-600' },
                { label: 'Retirados', value: loading ? '…' : retirados, color: 'text-rose-500' },
                { label: 'Incompletos', value: loading ? '…' : incompletos, color: incompletos > 0 ? 'text-amber-500' : 'text-slate-400' },
              ].map((s, i) => (
                <div key={i} className="group glass-panel rounded-[2rem] p-7 transition-all duration-500 hover:-translate-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3 group-hover:text-emerald-600 transition-colors">{s.label}</p>
                  <div className="flex items-end justify-between">
                    <p className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.value}</p>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      {i === 0 ? <Users size={14} /> : i === 1 ? <Plus size={14} /> : i === 2 ? <X size={14} /> : <AlertCircle size={14} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mostrarResumen && (
              <div className="mb-8 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <Building2 size={16} className="text-emerald-600" />
                  <h3 className="font-black text-slate-800">Resumen por Parqueadero</h3>
                  <span className="text-[10px] text-slate-400 font-bold ml-auto">{expedientesNormales.length} expedientes</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                  {resumenPorCargo.map((r, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${cargoColor[r.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{r.cargo}</p>
                      <p className="text-2xl font-black">{r.total}</p>
                      <p className="text-[10px] font-semibold opacity-60 mt-0.5">{r.activos} activo{r.activos !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incompletos > 0 && !filtroDocFaltante && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <ShieldAlert size={18} className="shrink-0 text-amber-500" />
                <p className="text-sm font-semibold text-amber-700 flex-1">
                  <strong>{incompletos} expediente{incompletos !== 1 ? 's' : ''}</strong> con documentos esenciales faltantes.
                </p>
                <button onClick={() => setFiltroDocFaltante('Hoja de Vida')} className="text-xs font-black text-amber-600 hover:text-amber-800 underline">Ver incompletos</button>
              </div>
            )}

            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="p-6 border-b border-gray-100 space-y-3">
                <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-50 transition-all shadow-sm">
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, cédula o cargo…"
                    className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300" />
                  {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-slate-400" /></button>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {(['Todos', 'Activo', 'Retirado'] as const).map(e => (
                      <button key={e} onClick={() => setFiltroEstado(e)}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${filtroEstado === e ? e === 'Activo' ? 'bg-emerald-600 text-white border-emerald-600' : e === 'Retirado' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-800 text-white border-slate-800' : 'bg-gray-50 text-slate-500 border-gray-200 hover:border-slate-300'}`}>{e}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <select value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-emerald-400 transition-all">
                      <option value="">Todos los cargos</option>
                      {CARGOS_SIN_REMESAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={filtroDocFaltante} onChange={e => setFiltroDocFaltante(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-amber-400 transition-all">
                      <option value="">Sin filtro de documento</option>
                      {['Hoja de Vida', 'Cédula de Ciudadanía', 'Contrato', 'Afiliación ARL'].map(d => (
                        <option key={d} value={d}>Falta: {d}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative flex items-center">
                    <ArrowUpDown size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                    <select value={orden} onChange={e => setOrden(e.target.value as OrdenType)} className="appearance-none pl-7 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-emerald-400 transition-all">
                      <option value="nombre">Nombre A-Z</option>
                      <option value="ingreso_asc">Ingreso más antiguo</option>
                      <option value="ingreso_desc">Ingreso más reciente</option>
                      <option value="reciente">Registrado recientemente</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {(busqueda || filtroEstado !== 'Todos' || filtroCargo || filtroDocFaltante) && (
                    <button onClick={() => { setBusqueda(''); setFiltroEstado('Todos'); setFiltroCargo(''); setFiltroDocFaltante(''); }}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-red-500 border border-gray-200 hover:border-red-200 transition-all flex items-center gap-1">
                      <X size={11} />Limpiar
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="py-16 text-center">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-sm">Cargando desde Supabase…</p>
                  </div>
                ) : (
                  <TablaExpedientes
                    filtrados={filtrados} docsMap={docsMap} handleDocLoad={handleDocLoad}
                    modoRemesas={false} toggling={toggling} quitandoId={quitandoId}
                    cargoRestaurar={cargoRestaurar} onAgregarRemesa={handleAgregarRemesa}
                    onIniciarQuitar={setQuitandoId} onCancelarQuitar={() => { setQuitandoId(null); setCargoRestaurar(''); }}
                    onConfirmarQuitar={handleConfirmarQuitar} onCargoChange={setCargoRestaurar}
                  />
                )}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold">{filtrados.length} de {expedientesNormales.length} expedientes</p>
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Sincronizado con Supabase
                </p>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════
            REMESAS
        ═══════════════════════════════════ */}
        {vistaTab === 'remesas' && (
          <>
            <div className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-8 text-white shadow-2xl shadow-purple-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full translate-y-1/3 -translate-x-1/3" />
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Banknote size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter">Sección de Remesas</h2>
                    <p className="text-purple-200 text-sm mt-0.5">
                      Pulsa <strong className="text-white">Quitar</strong>, elige el cargo y confirma para devolver al expediente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-black">{loading ? '…' : expedientesRemesas.length}</p>
                    <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mt-1">Total</p>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-4xl font-black text-emerald-300">{loading ? '…' : activosRemesas}</p>
                    <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mt-1">Activos</p>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-4xl font-black text-rose-300">{loading ? '…' : retiradosRemesas}</p>
                    <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mt-1">Retirados</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-purple-100 shadow-[0_20px_50px_rgba(147,51,234,0.06)] overflow-hidden">
              <div className="p-6 border-b border-purple-50 space-y-3">
                <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-purple-200 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-50 transition-all shadow-sm">
                  <Search size={18} className="text-purple-400 shrink-0" />
                  <input value={busquedaRemesas} onChange={e => setBusquedaRemesas(e.target.value)} placeholder="Buscar en remesas por nombre o cédula…"
                    className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300" />
                  {busquedaRemesas && <button onClick={() => setBusquedaRemesas('')}><X size={14} className="text-slate-400" /></button>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {(['Todos', 'Activo', 'Retirado'] as const).map(e => (
                      <button key={e} onClick={() => setFiltroEstadoRemesas(e)}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${filtroEstadoRemesas === e ? e === 'Activo' ? 'bg-emerald-600 text-white border-emerald-600' : e === 'Retirado' ? 'bg-rose-500 text-white border-rose-500' : 'bg-purple-700 text-white border-purple-700' : 'bg-gray-50 text-slate-500 border-gray-200 hover:border-purple-300'}`}>{e}</button>
                    ))}
                  </div>
                  <div className="relative flex items-center">
                    <ArrowUpDown size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                    <select value={ordenRemesas} onChange={e => setOrdenRemesas(e.target.value as OrdenType)} className="appearance-none pl-7 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-purple-400 transition-all">
                      <option value="nombre">Nombre A-Z</option>
                      <option value="ingreso_asc">Ingreso más antiguo</option>
                      <option value="ingreso_desc">Ingreso más reciente</option>
                      <option value="reciente">Registrado recientemente</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {(busquedaRemesas || filtroEstadoRemesas !== 'Todos') && (
                    <button onClick={() => { setBusquedaRemesas(''); setFiltroEstadoRemesas('Todos'); }}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-red-500 border border-gray-200 hover:border-red-200 transition-all flex items-center gap-1">
                      <X size={11} />Limpiar
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="py-16 text-center">
                    <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-sm">Cargando remesas…</p>
                  </div>
                ) : (
                  <TablaExpedientes
                    filtrados={filtradosRemesas} docsMap={docsMap} handleDocLoad={handleDocLoad}
                    modoRemesas={true} toggling={toggling} quitandoId={quitandoId}
                    cargoRestaurar={cargoRestaurar} onAgregarRemesa={handleAgregarRemesa}
                    onIniciarQuitar={id => { setQuitandoId(id); setCargoRestaurar(''); }}
                    onCancelarQuitar={() => { setQuitandoId(null); setCargoRestaurar(''); }}
                    onConfirmarQuitar={handleConfirmarQuitar} onCargoChange={setCargoRestaurar}
                  />
                )}
              </div>
              <div className="px-5 py-3 bg-purple-50/50 border-t border-purple-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold">{filtradosRemesas.length} de {expedientesRemesas.length} en remesas</p>
                <p className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />Sección Remesas
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
