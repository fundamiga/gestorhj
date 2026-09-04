'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Monitor, Globe, Clock, RefreshCw, Search,
  ArrowLeft, Lock, HardDrive, Filter, Download
} from 'lucide-react';
import Link from 'next/link';
import { RegistroAuditoria } from '@/types';

export default function AuditDevicesAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passError, setPassError] = useState('');

  const [logs, setLogs] = useState<RegistroAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const auth = sessionStorage.getItem('fundamiga_admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchLogs();
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/log');
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setLogs(json.data);
      }
    } catch (e) {
      console.error('Error al obtener registros de auditoría:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'fundamiga2026' || passcode === '12345') {
      sessionStorage.setItem('fundamiga_admin_auth', 'true');
      setIsAuthenticated(true);
      setPassError('');
      fetchLogs();
    } else {
      setPassError('Clave de acceso incorrecta');
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Fecha y Hora', 'IP', 'Dispositivo', 'Sistema Operativo', 'Navegador', 'Resolución', 'Acción'];
    const rows = logs.map(l => [
      l.id,
      new Date(l.fecha_registro).toLocaleString('es-CO'),
      l.ip_address,
      `"${l.dispositivo_nombre || ''}"`,
      `"${l.sistema_operativo || ''}"`,
      `"${l.navegador || ''}"`,
      l.resolucion_pantalla,
      l.accion_realizada
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_dispositivos_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrar logs
  const filteredLogs = logs.filter(l => {
    const q = searchTerm.toLowerCase();
    return (
      (l.ip_address && l.ip_address.toLowerCase().includes(q)) ||
      (l.dispositivo_nombre && l.dispositivo_nombre.toLowerCase().includes(q)) ||
      (l.sistema_operativo && l.sistema_operativo.toLowerCase().includes(q)) ||
      (l.navegador && l.navegador.toLowerCase().includes(q)) ||
      (l.accion_realizada && l.accion_realizada.toLowerCase().includes(q))
    );
  });

  // Métricas
  const totalAccesos = logs.length;
  const ipsUnicas = new Set(logs.map(l => l.ip_address)).size;
  const dispositivosUnicos = new Set(logs.map(l => `${l.sistema_operativo}-${l.navegador}`)).size;
  const ultimoAcceso = logs.length > 0 ? new Date(logs[0].fecha_registro).toLocaleString('es-CO') : 'Sin registros';

  if (isAuthenticated === null) return null;

  // Si no está autenticado, mostrar pantalla de clave
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
          <div className="flex items-center gap-3 mb-6 text-indigo-600">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Lock size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Acceso Privado</h2>
              <p className="text-xs text-slate-500">Panel de Monitoreo e IPs</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contraseña de Administración
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPassError('');
                }}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                autoFocus
              />
              {passError && <p className="text-xs text-red-500 mt-1">{passError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
            >
              Ingresar al Panel
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Volver a la Aplicación Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="Volver"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg leading-tight">Monitoreo de Dispositivos e IPs</h1>
                <p className="text-xs text-slate-500">Historial silencioso de accesos al sistema</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download size={14} /> Exportar CSV
            </button>
            <button
              onClick={fetchLogs}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <HardDrive size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Registros</p>
              <p className="text-2xl font-black text-slate-900">{totalAccesos}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Globe size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">IPs Únicas</p>
              <p className="text-2xl font-black text-slate-900">{ipsUnicas}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
              <Monitor size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Dispositivos Únicos</p>
              <p className="text-2xl font-black text-slate-900">{dispositivosUnicos}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Último Ingreso</p>
              <p className="text-xs font-bold text-slate-800 truncate">{ultimoAcceso}</p>
            </div>
          </div>
        </div>

        {/* Search & Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por IP, SO, navegador o acción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Mostrando {filteredLogs.length} de {logs.length} eventos
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-600" /> Cargando historial de dispositivos...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No se encontraron registros de auditoría que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Dirección IP</th>
                    <th className="py-3 px-4">Dispositivo / SO</th>
                    <th className="py-3 px-4">Navegador / Cliente</th>
                    <th className="py-3 px-4">Resolución</th>
                    <th className="py-3 px-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                        {new Date(log.fecha_registro).toLocaleString('es-CO')}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                        <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {log.ip_address || '127.0.0.1'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {log.sistema_operativo || log.dispositivo_nombre}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {log.navegador}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {log.resolucion_pantalla}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {log.accion_realizada}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
