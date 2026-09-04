'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registrarRastreoSilencioso } from '@/lib/tracker';
import { Shield, KeyRound, X, AlertCircle } from 'lucide-react';

export default function InvisibleTracker() {
  const router = useRouter();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // 1. Ejecutar el rastreo silencioso al cargar la aplicación
    registrarRastreoSilencioso('APERTURA_APP');

    // 2. Escuchar la combinación de teclas secreta Ctrl + Shift + A
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowAdminModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    // Clave secreta por defecto: fundamiga2026 (o 12345)
    if (passcode === 'fundamiga2026' || passcode === '12345') {
      setShowAdminModal(false);
      setPasscode('');
      setErrorMsg('');
      sessionStorage.setItem('fundamiga_admin_auth', 'true');
      router.push('/admin/dispositivos');
    } else {
      setErrorMsg('Clave de acceso incorrecta');
    }
  };

  return (
    <>
      {/* Modal de Acceso Oculto que SOLO aparece al pulsar Ctrl+Shift+A */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Panel de Auditoría Interno</h3>
                <p className="text-xs text-slate-500">Ingreso exclusivo para administración</p>
              </div>
            </div>

            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Clave Secreta
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <KeyRound size={16} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
                {errorMsg && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errorMsg}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  Ingresar al Panel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
