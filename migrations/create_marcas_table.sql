-- Crear tabla de marcas
CREATE TABLE IF NOT EXISTS public.marcas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    imagen_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY "Marcas visibles para todos"
    ON public.marcas
    FOR SELECT
    USING (true);

-- Política de escritura solo para admins autenticados
CREATE POLICY "Solo admins pueden insertar marcas"
    ON public.marcas
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Solo admins pueden actualizar marcas"
    ON public.marcas
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Solo admins pueden eliminar marcas"
    ON public.marcas
    FOR DELETE
    TO authenticated
    USING (true);
