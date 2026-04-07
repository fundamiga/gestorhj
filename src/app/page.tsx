'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, Plus, Eye, Calendar, FileText, ChevronDown,
  X, RefreshCw, AlertCircle, Building2, ArrowUpDown, ShieldAlert
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
  'REMESAS' : 'bg-lime-50 text-lime-700 border-lime-200',
};

// Indicador discreto de completitud del expediente
function IndicadorExpediente({ expedienteId, tiposDocumentos }: { expedienteId: string; tiposDocumentos: string[] }) {
  const faltantes = DOCUMENTOS_ESENCIALES.filter(d => !tiposDocumentos.includes(d));
  const completo = faltantes.length === 0;
  const parcial = faltantes.length <= 2;

  if (completo) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full" title="Expediente completo">
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
        setCount(t.length);
        setTipos(t);
        onLoad(expedienteId, t.length, t);
      });
  }, [expedienteId, onLoad]);

  if (count === null) return <span className="text-slate-300 text-xs">…</span>;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${count > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
        <FileText size={11} />{count} {count === 1 ? 'doc' : 'docs'}
      </span>
      <IndicadorExpediente expedienteId={expedienteId} tiposDocumentos={tipos} />
    </div>
  );
}

type OrdenType = 'nombre' | 'ingreso_asc' | 'ingreso_desc' | 'reciente';

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activo' | 'Retirado'>('Todos');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroDocFaltante, setFiltroDocFaltante] = useState('');
  const [orden, setOrden] = useState<OrdenType>('nombre');
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

  // Filtrar
  let filtrados = expedientes.filter(e => {
    const matchB = !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (e.cedula || '').includes(busqueda) || e.cargo.toLowerCase().includes(busqueda.toLowerCase());
    const matchE = filtroEstado === 'Todos' || e.estado === filtroEstado;
    const matchC = !filtroCargo || e.cargo === filtroCargo;
    const matchDoc = !filtroDocFaltante || !(docsMap[e.id]?.tipos || []).includes(filtroDocFaltante);
    return matchB && matchE && matchC && matchDoc;
  });

  // Ordenar
  filtrados = [...filtrados].sort((a, b) => {
    if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
    if (orden === 'ingreso_asc') return (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || '');
    if (orden === 'ingreso_desc') return (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '');
    if (orden === 'reciente') return (b.creado_at || '').localeCompare(a.creado_at || '');
    return 0;
  });

  const activos = expedientes.filter(e => e.estado === 'Activo').length;
  const retirados = expedientes.filter(e => e.estado === 'Retirado').length;
  const incompletos = expedientes.filter(e => {
    const tipos = docsMap[e.id]?.tipos || [];
    return DOCUMENTOS_ESENCIALES.some(d => !tipos.includes(d));
  }).length;
  const recientes = expedientes.filter(e => {
    const dias = (Date.now() - new Date(e.creado_at || '').getTime()) / 86400000;
    return dias <= 30;
  }).length;

  const resumenPorCargo = CARGOS.map(cargo => ({
    cargo,
    activos: expedientes.filter(e => e.cargo === cargo && e.estado === 'Activo').length,
    total: expedientes.filter(e => e.cargo === cargo).length,
  })).filter(r => r.total > 0);

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-100/30 blur-[120px] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-100/20 blur-[100px] rounded-full -z-10 translate-x-1/4 translate-y-1/4" />

      <nav className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <Image src="/LOGO.png" alt="Fundamiga Logo" fill sizes="48px" className="object-contain p-1.5" priority />
            </div>
            <div>
              <span className="text-xl font-black text-slate-800 tracking-tighter leading-none block">Fundamiga</span>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em] mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />Gestión de Expedientes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMostrarResumen(v => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs transition-all ${mostrarResumen ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200'}`}>
              <Building2 size={14} />Resumen
            </button>
            <button onClick={cargar} className="p-2.5 rounded-xl border border-gray-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all" title="Recargar">
              <RefreshCw size={16} />
            </button>
            <Link href="/nuevo" className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-sm transition-all shadow-sm">
              <Plus size={16} />Nuevo Expediente
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1.5 w-12 bg-emerald-500 rounded-full" />
            <div className="h-1.5 w-4 bg-yellow-400 rounded-full" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
            Expedientes de <span className="text-emerald-600">Personal</span>
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg border-l-4 border-yellow-400 pl-6">
            Archivador digital de hojas de vida y documentos del personal.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Expedientes', value: loading ? '…' : expedientes.length, color: 'text-slate-700' },
            { label: 'Activos', value: loading ? '…' : activos, color: 'text-emerald-600' },
            { label: 'Retirados', value: loading ? '…' : retirados, color: 'text-rose-500' },
            { label: 'Incompletos', value: loading ? '…' : incompletos, color: incompletos > 0 ? 'text-amber-500' : 'text-slate-400' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Resumen por parqueadero */}
        {mostrarResumen && (
          <div className="mb-8 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <Building2 size={16} className="text-emerald-600" />
              <h3 className="font-black text-slate-800">Resumen por Parqueadero</h3>
              <span className="text-[10px] text-slate-400 font-bold ml-auto">{expedientes.length} expedientes en total</span>
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

        {/* Alerta documentos faltantes */}
        {incompletos > 0 && !filtroDocFaltante && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <ShieldAlert size={18} className="shrink-0 text-amber-500" />
            <p className="text-sm font-semibold text-amber-700 flex-1">
              <strong>{incompletos} expediente{incompletos !== 1 ? 's' : ''}</strong> con documentos esenciales faltantes.
            </p>
            <button onClick={() => setFiltroDocFaltante('Hoja de Vida')}
              className="text-xs font-black text-amber-600 hover:text-amber-800 underline transition-colors">
              Ver incompletos
            </button>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 space-y-3">
            {/* Buscador */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, cédula o cargo…"
                className="flex-1 bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400" />
              {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-slate-400 hover:text-red-400" /></button>}
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              {/* Estado */}
              <div className="flex gap-1">
                {(['Todos', 'Activo', 'Retirado'] as const).map(e => (
                  <button key={e} onClick={() => setFiltroEstado(e)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                      filtroEstado === e
                        ? e === 'Activo' ? 'bg-emerald-600 text-white border-emerald-600'
                        : e === 'Retirado' ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-800 text-white border-slate-800'
                        : 'bg-gray-50 text-slate-500 border-gray-200 hover:border-slate-300'
                    }`}>{e}</button>
                ))}
              </div>

              {/* Cargo */}
              <div className="relative">
                <select value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-emerald-400 transition-all">
                  <option value="">Todos los cargos</option>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Doc faltante */}
              <div className="relative">
                <select value={filtroDocFaltante} onChange={e => setFiltroDocFaltante(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-amber-400 transition-all">
                  <option value="">Sin filtro de documento</option>
{['Hoja de Vida','Cédula de Ciudadanía','Contrato','Afiliación ARL'].map(d => (                    <option key={d} value={d}>Falta: {d}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Orden */}
              <div className="relative flex items-center gap-1">
                <ArrowUpDown size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <select value={orden} onChange={e => setOrden(e.target.value as OrdenType)}
                  className="appearance-none pl-7 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer focus:border-emerald-400 transition-all">
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
            ) : filtrados.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold text-sm">No se encontraron expedientes</p>
                <Link href="/nuevo" className="inline-flex items-center gap-2 mt-4 text-emerald-600 font-black text-sm hover:underline">
                  <Plus size={14} />Crear primer expediente
                </Link>
              </div>
            ) : (
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
                    <tr key={exp.id} className="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
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
                      <td className="px-5 py-4">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-full border whitespace-nowrap ${cargoColor[exp.cargo] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {exp.cargo}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                          <Calendar size={11} className="text-emerald-500" />
                          {exp.fecha_ingreso ? new Date(exp.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        {exp.fecha_retiro && (
                          <div className="text-[10px] text-rose-400 font-medium mt-0.5">
                            Retiro: {new Date(exp.fecha_retiro + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${exp.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${exp.estado === 'Activo' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
                          {exp.estado}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <DocumentInfo expedienteId={exp.id} onLoad={handleDocLoad} />
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/expediente/${exp.id}`}
                          className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-xl text-xs font-black transition-all">
                          <Eye size={12} />Ver expediente
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold">{filtrados.length} de {expedientes.length} expedientes</p>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Sincronizado con Supabase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
