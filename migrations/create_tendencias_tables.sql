-- Tabla para categorías visibles en tendencias
CREATE TABLE IF NOT EXISTS tendencias_categorias (
    id SERIAL PRIMARY KEY,
    categoria TEXT UNIQUE NOT NULL,
    visible BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla para productos seleccionados por categoría en tendencias
CREATE TABLE IF NOT EXISTS tendencias_productos (
    id SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    producto_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(categoria, producto_id)
);

-- Insertar todas las categorías existentes
INSERT INTO tendencias_categorias (categoria, visible, orden) VALUES
    ('Anillos', true, 1),
    ('Collares', true, 2),
    ('Pendientes', true, 3),
    ('Pulseras', true, 4),
    ('Relojes', true, 5),
    ('Medallas', true, 6)
ON CONFLICT (categoria) DO NOTHING;

-- Habilitar RLS
ALTER TABLE tendencias_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tendencias_productos ENABLE ROW LEVEL SECURITY;

-- Políticas para lectura pública
CREATE POLICY "Lectura pública tendencias_categorias" ON tendencias_categorias
    FOR SELECT USING (true);

CREATE POLICY "Lectura pública tendencias_productos" ON tendencias_productos
    FOR SELECT USING (true);

-- Políticas para escritura (admin opera con service role)
CREATE POLICY "Admin insert tendencias_categorias" ON tendencias_categorias
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin update tendencias_categorias" ON tendencias_categorias
    FOR UPDATE USING (true);

CREATE POLICY "Admin delete tendencias_categorias" ON tendencias_categorias
    FOR DELETE USING (true);

CREATE POLICY "Admin insert tendencias_productos" ON tendencias_productos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin update tendencias_productos" ON tendencias_productos
    FOR UPDATE USING (true);

CREATE POLICY "Admin delete tendencias_productos" ON tendencias_productos
    FOR DELETE USING (true);
