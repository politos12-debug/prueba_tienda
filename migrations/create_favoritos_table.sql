-- Tabla para productos favoritos de cada usuario
CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, producto_id)
);

-- Habilitar RLS
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver sus propios favoritos
CREATE POLICY "Usuarios ven sus favoritos" ON favoritos
    FOR SELECT USING (auth.uid() = user_id);

-- Cada usuario solo puede insertar sus propios favoritos
CREATE POLICY "Usuarios insertan sus favoritos" ON favoritos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cada usuario solo puede borrar sus propios favoritos
CREATE POLICY "Usuarios borran sus favoritos" ON favoritos
    FOR DELETE USING (auth.uid() = user_id);
