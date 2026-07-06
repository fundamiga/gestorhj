-- Ejecuta esto en el SQL Editor de Supabase
ALTER TABLE expedientes
ADD COLUMN IF NOT EXISTS es_remesa BOOLEAN DEFAULT FALSE;

-- (Opcional) Si ya tenías expedientes con cargo = 'REMESAS' y quieres
-- migrarlos automáticamente al nuevo sistema:
UPDATE expedientes
SET es_remesa = TRUE
WHERE cargo = 'REMESAS';
