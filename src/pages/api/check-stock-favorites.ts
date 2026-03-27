export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sendStockAlertEmail } from '../../lib/brevo';

/**
 * Endpoint que verifica el stock de un producto y envía alertas por email
 * a los usuarios que lo tienen en favoritos.
 * 
 * Se llama automáticamente cada vez que cambia el stock de un producto.
 * 
 * Tipos de alerta:
 *   - stock_bajo: stock entre 1 y UMBRAL_STOCK_BAJO (por defecto 3)
 *   - agotado: stock llega a 0
 *   - restock: stock pasa de 0 a > 0
 */

const UMBRAL_STOCK_BAJO = 3;

export const POST: APIRoute = async ({ request }) => {
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return new Response(JSON.stringify({ success: false, error: 'Config missing' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { productId, stockAnterior, stockNuevo } = await request.json();

        if (productId == null || stockAnterior == null || stockNuevo == null) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan datos: productId, stockAnterior, stockNuevo' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Determinar qué tipo de alerta enviar
        const tipo = determinarTipoAlerta(stockAnterior, stockNuevo);

        if (!tipo) {
            return new Response(JSON.stringify({ success: true, enviados: 0, razon: 'No requiere notificación' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener datos del producto
        const { data: producto, error: prodError } = await supabase
            .from('products')
            .select('id, nombre, precio, imagen_url, referencia, categoria')
            .eq('id', productId)
            .single();

        if (prodError || !producto) {
            console.error('[check-stock-favorites] Producto no encontrado:', productId);
            return new Response(JSON.stringify({ success: false, error: 'Producto no encontrado' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener usuarios que tienen este producto en favoritos
        const { data: favoritos, error: favError } = await supabase
            .from('favoritos')
            .select('user_id')
            .eq('producto_id', productId);

        if (favError || !favoritos || favoritos.length === 0) {
            return new Response(JSON.stringify({ success: true, enviados: 0, razon: 'Nadie tiene este producto en favoritos' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const userIds = favoritos.map(f => f.user_id);

        // Obtener datos de los usuarios (email, nombre)
        const { data: usuarios, error: userError } = await supabase
            .from('usuarios')
            .select('id, email, nombre')
            .in('id', userIds)
            .eq('activo', true);

        if (userError || !usuarios || usuarios.length === 0) {
            return new Response(JSON.stringify({ success: true, enviados: 0, razon: 'No se encontraron usuarios activos' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verificar qué usuarios ya fueron notificados para este tipo
        const { data: notificacionesPrevias } = await supabase
            .from('stock_notifications')
            .select('user_id')
            .eq('producto_id', productId)
            .eq('tipo', tipo);

        const yaNotificados = new Set((notificacionesPrevias || []).map(n => n.user_id));

        // Si es restock, limpiar notificaciones anteriores de 'agotado' y 'stock_bajo'
        // para que puedan volver a recibir si se agota otra vez
        if (tipo === 'restock') {
            await supabase
                .from('stock_notifications')
                .delete()
                .eq('producto_id', productId)
                .in('tipo', ['agotado', 'stock_bajo']);
        }

        // Si es agotado, limpiar notificaciones de 'restock' previas
        if (tipo === 'agotado') {
            await supabase
                .from('stock_notifications')
                .delete()
                .eq('producto_id', productId)
                .eq('tipo', 'restock');
        }

        // Parsear imagen del producto
        let imagenUrl = '';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                imagenUrl = Array.isArray(imagenes) && imagenes.length > 0 ? imagenes[0] : '';
            } catch {
                if (typeof producto.imagen_url === 'string' && producto.imagen_url.startsWith('http')) {
                    imagenUrl = producto.imagen_url;
                }
            }
        }

        // Enviar emails a usuarios no notificados previamente
        let enviados = 0;
        const errores: string[] = [];

        for (const usuario of usuarios) {
            if (yaNotificados.has(usuario.id)) {
                continue;
            }

            try {
                const result = await sendStockAlertEmail(
                    usuario.email,
                    usuario.nombre || 'Cliente',
                    {
                        nombre: producto.nombre,
                        imagen: imagenUrl,
                        precio: producto.precio,
                        id: producto.id
                    },
                    tipo,
                    stockNuevo > 0 ? stockNuevo : undefined
                );

                if (result.success) {
                    // Registrar la notificación enviada
                    await supabase
                        .from('stock_notifications')
                        .upsert({
                            user_id: usuario.id,
                            producto_id: productId,
                            tipo: tipo,
                            enviado_at: new Date().toISOString()
                        }, { onConflict: 'user_id,producto_id,tipo' });

                    enviados++;
                    console.log(`[check-stock-favorites] ✅ Email ${tipo} enviado a ${usuario.email} para producto ${producto.nombre}`);
                } else {
                    errores.push(`${usuario.email}: ${result.error}`);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error desconocido';
                errores.push(`${usuario.email}: ${msg}`);
            }
        }

        console.log(`[check-stock-favorites] Resumen: ${enviados} emails enviados de tipo "${tipo}" para producto "${producto.nombre}" (stock: ${stockAnterior} → ${stockNuevo})`);

        return new Response(JSON.stringify({
            success: true,
            tipo,
            producto: producto.nombre,
            enviados,
            totalFavoritos: favoritos.length,
            errores: errores.length > 0 ? errores : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[check-stock-favorites] Error general:', err);
        return new Response(JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Error interno'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * Determina el tipo de alerta según el cambio de stock
 */
function determinarTipoAlerta(
    stockAnterior: number,
    stockNuevo: number
): 'stock_bajo' | 'restock' | null {
    // Restock: de 0 a > 0
    if (stockAnterior <= 0 && stockNuevo > 0) {
        return 'restock';
    }

    // Stock bajo: stock acaba de entrar en zona baja (cruzó el umbral hacia abajo)
    if (stockAnterior > UMBRAL_STOCK_BAJO && stockNuevo > 0 && stockNuevo <= UMBRAL_STOCK_BAJO) {
        return 'stock_bajo';
    }

    return null;
}
