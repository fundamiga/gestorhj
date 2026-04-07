'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Save, AlertCircle, X, RefreshCw, Check, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CARGOS } from '@/types';

export default function NuevoExpedientePage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    cedula: '',
    nombre: '',
    cargo: CARGOS[0],
    fecha_ingreso: new Date().toISOString().split('T')[0],
    estado: 'Activo' as 'Activo' | 'Retirado',
    fecha_retiro: '',
    observaciones: '',
  });

  const set = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errores[field]) setErrores(prev => ({ ...prev, [field]: '' }));
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!form.fecha_ingreso) e.fecha_ingreso = 'La fecha de ingreso es obligatoria';
    if (form.estado === 'Retirado' && !form.fecha_retiro) e.fecha_retiro = 'Ingresa la fecha de retiro';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true); setError(null);

    if (form.cedula.trim()) {
      const { data } = await supabase.from('expedientes').select('id, nombre').eq('cedula', form.cedula.trim());
      if (data && data.length > 0) {
        setErrores(prev => ({ ...prev, cedula: `Ya existe: ${data[0].nombre}` }));
        setGuardando(false); return;
      }
    }

    const { error } = await supabase.from('expedientes').insert({
      id: Date.now().toString(),
      cedula: form.cedula.trim() || null,
      nombre: form.nombre.trim(),
      cargo: form.cargo,
      fecha_ingreso: form.fecha_ingreso || null,
      estado: form.estado,
      fecha_retiro: form.fecha_retiro.trim() ? form.fecha_retiro : null,
      observaciones: form.observaciones.trim() || null,
    });

    if (error) { setError('Error al guardar: ' + error.message); setGuardando(false); return; }
    setGuardado(true);
    setTimeout(() => router.push('/'), 1200);
  };

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
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />Nuevo Expediente
              </p>
            </div>
          </div>
          <Link href="/" className="group flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-all px-5 py-2.5 rounded-2xl hover:bg-emerald-50 border border-transparent hover:border-emerald-100/50 shadow-sm font-black text-sm">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />Volver a Expedientes
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-1.5 w-12 bg-emerald-500 rounded-full" />
            <div className="h-1.5 w-4 bg-yellow-400 rounded-full" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
            Nuevo <span className="text-emerald-600">Expediente</span>
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg border-l-4 border-yellow-400 pl-6">
            Registra los datos del trabajador para crear su expediente.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Formulario */}
          <div className="lg:col-span-1 sticky top-28">
            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-emerald-50 transition-all duration-500">
              <div className="bg-emerald-600 p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Plus size={24} className="text-white" strokeWidth={3} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Datos del Trabajador</h2>
                    <p className="text-white/70 text-xs mt-0.5">Completa todos los campos</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Nombre completo *</label>
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                    placeholder="Ej: García López Juan Carlos"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.nombre ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`} />
                  {errores.nombre && <p className="text-red-500 text-[10px] font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errores.nombre}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Cédula de Ciudadanía</label>
                  <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                    placeholder="Número de cédula"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.cedula ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`} />
                  {errores.cedula && <p className="text-red-500 text-[10px] font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} />{errores.cedula}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Cargo / Parqueadero</label>
                  <div className="relative">
                    <select value={form.cargo} onChange={e => set('cargo', e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-sm font-semibold text-slate-800 outline-none cursor-pointer transition-all">
                      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Fecha Ingreso *</label>
                    <input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.fecha_ingreso ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100'}`} />
                    {errores.fecha_ingreso && <p className="text-red-500 text-[10px] font-bold mt-1">{errores.fecha_ingreso}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Estado</label>
                    <div className="flex gap-1">
                      {(['Activo', 'Retirado'] as const).map(e => (
                        <button key={e} onClick={() => set('estado', e)} type="button"
                          className={`flex-1 py-3 rounded-xl text-xs font-black border transition-all ${form.estado === e ? e === 'Activo' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-500' : 'bg-gray-50 text-slate-500 border-gray-200 hover:border-slate-300'}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {form.estado === 'Retirado' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1.5">Fecha de Retiro *</label>
                    <input type="date" value={form.fecha_retiro} onChange={e => set('fecha_retiro', e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-slate-800 outline-none transition-all ${errores.fecha_retiro ? 'border-red-300 bg-red-50' : 'border-rose-200 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'}`} />
                    {errores.fecha_retiro && <p className="text-red-500 text-[10px] font-bold mt-1">{errores.fecha_retiro}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Observaciones <span className="text-slate-400 normal-case font-normal">(opcional)</span></label>
                  <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                    placeholder="Notas adicionales…" rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 text-sm font-medium text-slate-800 outline-none transition-all resize-none placeholder:text-slate-400" />
                </div>

                <button onClick={handleGuardar} disabled={guardando || guardado}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all shadow-sm disabled:opacity-60 ${guardado ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {guardando ? <RefreshCw size={15} className="animate-spin" /> : guardado ? <><Check size={16} />¡Guardado!</> : <><Save size={16} />Crear Expediente</>}
                </button>
              </div>
            </div>
          </div>

          {/* Info lateral */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
              <h3 className="text-2xl font-black text-slate-800 mb-2">¿Qué puedes guardar?</h3>
              <p className="text-slate-500 font-medium mb-6 border-l-4 border-yellow-400 pl-4">
                Después de crear el expediente podrás subir cualquier documento relacionado con el trabajador.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                { emoji: '📄', label: 'Hoja de Vida' },
{ emoji: '🪪', label: 'Cédula de Ciudadanía' },
{ emoji: '📝', label: 'Contrato' },



{ emoji: '🏥', label: 'Certificado EPS' },

{ emoji: '🦺', label: 'Certificado ARL' },

{ emoji: '🧾', label: 'RUT' },

{ emoji: '✍️', label: 'Firma' },

// 🔥 ANTECEDENTES
{ emoji: '👮', label: 'Antecedentes Policía' },
{ emoji: '📊', label: 'Antecedentes Contraloría' },
{ emoji: '⚖️', label: 'Antecedentes Procuraduría' },

{ emoji: '📤', label: 'Solicitud de Retiro' },
{ emoji: '📑', label: 'Solicitud de Ingreso' },



{ emoji: '📎', label: 'Otro' },
                ].map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-xl">{d.emoji}</span>
                    <span className="text-xs font-bold text-slate-600">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
