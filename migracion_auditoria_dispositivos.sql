-- =========================================================================
-- MIGRACIÓN PARA REGISTRO DE AUDITORÍA Y RASTREO SILENCIOSO DE DISPOSITIVOS
-- Ejecutar este script en el Editor SQL de Supabase (SQL Editor)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.auditoria_dispositivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT,
  dispositivo_nombre TEXT,
  sistema_operativo TEXT,
  navegador TEXT,
  resolucion_pantalla TEXT,
  user_agent TEXT,
  accion_realizada TEXT DEFAULT 'APERTURA_APP',
  detalles JSONB,
  fecha_registro TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security) y permitir inserciones y lectura anónima
ALTER TABLE public.auditoria_dispositivos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para permitir inserción y lectura desde la aplicación
CREATE POLICY "Permitir insercion anonima auditoria" 
  ON public.auditoria_dispositivos 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Permitir lectura auditoria" 
  ON public.auditoria_dispositivos 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Crear índices para acelerar la consulta de dispositivos recientes por IP y fecha
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria_dispositivos(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_ip ON public.auditoria_dispositivos(ip_address);
