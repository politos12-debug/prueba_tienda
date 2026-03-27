-- Tabla para gestionar las categorías visibles en "Compra por Categorías"
CREATE TABLE IF NOT EXISTS categorias_tienda (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descripcion TEXT DEFAULT '',
    imagen_url TEXT DEFAULT '',
    visible BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para las subcategorías de cada categoría
CREATE TABLE IF NOT EXISTS subcategorias_tienda (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias_tienda(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE categorias_tienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias_tienda ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
CREATE POLICY "categorias_tienda_public_read" ON categorias_tienda FOR SELECT USING (true);
CREATE POLICY "subcategorias_tienda_public_read" ON subcategorias_tienda FOR SELECT USING (true);

-- Políticas de escritura (admin)
CREATE POLICY "categorias_tienda_public_insert" ON categorias_tienda FOR INSERT WITH CHECK (true);
CREATE POLICY "categorias_tienda_public_update" ON categorias_tienda FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "categorias_tienda_public_delete" ON categorias_tienda FOR DELETE USING (true);

CREATE POLICY "subcategorias_tienda_public_insert" ON subcategorias_tienda FOR INSERT WITH CHECK (true);
CREATE POLICY "subcategorias_tienda_public_update" ON subcategorias_tienda FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "subcategorias_tienda_public_delete" ON subcategorias_tienda FOR DELETE USING (true);

-- Datos iniciales
INSERT INTO categorias_tienda (nombre, slug, descripcion, imagen_url, visible, orden) VALUES
('Anillos', 'anillos', 'Diseños elegantes y modernos', '/images/categoria-anillos.png', true, 1),
('Collares', 'collares', 'Piezas sofisticadas', '/images/categoria-collares.png', true, 2),
('Pendientes', 'pendientes', 'Elegancia en cada oreja', '/images/categoria-pendientes.jpg', true, 3),
('Pulseras', 'pulseras', 'Brazaletes exclusivos', '/images/categoria-pulseras.jpg', true, 4),
('Relojes', 'relojes', 'Relojes de lujo y precisión', '/images/categoria-relojes.png', true, 5),
('Medallas', 'medallas', 'Medallas exclusivas y religiosas', '/images/categoria-medallas.png', true, 6);
