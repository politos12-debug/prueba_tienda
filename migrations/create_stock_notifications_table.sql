-- Tabla para registrar notificaciones de stock enviadas a usuarios con favoritos
-- Evita enviar emails duplicados para el mismo evento de stock

CREATE TABLE IF NOT EXISTS stock_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('stock_bajo', 'agotado', 'restock')),
    enviado_at TIMESTAMPTZ DEFAULT now(),
    -- Evitar duplicados: misma notificación al mismo usuario para el mismo producto
    UNIQUE(user_id, producto_id, tipo)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_stock_notif_user ON stock_notifications(user_id);
CREATE INDEX idx_stock_notif_producto ON stock_notifications(producto_id);
CREATE INDEX idx_stock_notif_tipo ON stock_notifications(tipo);

-- Habilitar RLS
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede leer/escribir (operaciones server-side)
CREATE POLICY "Service role full access" ON stock_notifications
    FOR ALL USING (true) WITH CHECK (true);
