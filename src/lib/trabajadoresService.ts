import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Cliente para la Base de Datos Global de Trabajadores (App Fundamiga / Consulta PWA)
const GLOBAL_SUPABASE_URL = 'https://upgrsqatxeokoagcwbks.supabase.co';
const GLOBAL_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZ3JzcWF0eGVva29hZ2N3YmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTM0NzUsImV4cCI6MjA5MDMyOTQ3NX0.b87zEqrr-dznnsOwX58mKHlVcgLjYEJkTTJwaf5-KCQ';

export const globalSupabase = createClient(GLOBAL_SUPABASE_URL, GLOBAL_SUPABASE_KEY);

export interface TrabajadorItem {
  id: string;
  nombre: string;
  cedula: string;
  cargo?: string;
  origen: 'expediente' | 'global';
  expedienteId?: string;
}

let cacheTrabajadores: TrabajadorItem[] = [];
let ultimaCarga = 0;
const TIEMPO_CACHE_MS = 5 * 60 * 1000; // 5 minutos de caché

export async function obtenerTrabajadoresUnificados(forzar = false): Promise<TrabajadorItem[]> {
  const ahora = Date.now();
  if (!forzar && cacheTrabajadores.length > 0 && ahora - ultimaCarga < TIEMPO_CACHE_MS) {
    return cacheTrabajadores;
  }

  try {
    // Cargar en paralelo de ambas bases de datos
    const [resExpedientes, resGlobal] = await Promise.all([
      supabase.from('expedientes').select('id, nombre, cedula, cargo').order('nombre'),
      globalSupabase.from('trabajadores').select('id, nombre, cedula, cargo').order('nombre')
    ]);

    const mapa = new Map<string, TrabajadorItem>();

    // 1. Añadir expedientes
    if (resExpedientes.data) {
      resExpedientes.data.forEach((exp: any) => {
        const ced = (exp.cedula || '').toString().trim();
        const key = ced || exp.nombre.toLowerCase().trim();
        mapa.set(key, {
          id: exp.id,
          nombre: exp.nombre.trim(),
          cedula: ced,
          cargo: exp.cargo || 'Sin cargo',
          origen: 'expediente',
          expedienteId: exp.id
        });
      });
    }

    // 2. Fusionar con la base de datos global de trabajadores
    if (resGlobal.data) {
      resGlobal.data.forEach((trab: any) => {
        const ced = (trab.cedula || '').toString().trim();
        const key = ced || trab.nombre.toLowerCase().trim();

        if (mapa.has(key)) {
          // Si ya existe en expedientes, preservar su expedienteId y complementar datos
          const existente = mapa.get(key)!;
          if (!existente.cargo || existente.cargo === 'Sin cargo') {
            existente.cargo = trab.cargo || existente.cargo;
          }
        } else {
          mapa.set(key, {
            id: trab.id.toString(),
            nombre: trab.nombre.trim(),
            cedula: ced,
            cargo: trab.cargo || 'Sin cargo',
            origen: 'global'
          });
        }
      });
    }

    cacheTrabajadores = Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    ultimaCarga = ahora;
    return cacheTrabajadores;
  } catch (err) {
    console.error('Error cargando trabajadores unificados:', err);
    return cacheTrabajadores;
  }
}

export async function buscarTrabajadoresGlobales(texto: string, limite: number = 8): Promise<TrabajadorItem[]> {
  const q = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!q) return [];

  const todos = await obtenerTrabajadoresUnificados();
  const tokens = q.split(/\s+/).filter(t => t.length > 0);

  // Filtrar por coincidencia en nombre o cédula
  const filtrados = todos.filter(t => {
    const nombreNorm = t.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cedulaStr = (t.cedula || '').toString();

    // Si coincide con la cédula
    if (cedulaStr.includes(q)) return true;

    // Si todas las palabras coinciden con el nombre
    return tokens.every(tok => nombreNorm.includes(tok));
  });

  return filtrados.slice(0, limite);
}
