-- Añadir columna 'activo' a la tabla products
-- Por defecto true para que todos los productos existentes sigan apareciendo
ALTER TABLE products ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Índice parcial para consultas de productos activos (las más frecuentes)
CREATE INDEX IF NOT EXISTS idx_products_activo ON products (activo) WHERE activo = true;
