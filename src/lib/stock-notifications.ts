import { createClient } from '@supabase/supabase-js';
import { sendStockAlertEmail } from './brevo';

const UMBRAL_STOCK_BAJO = 3;

/**
 * Verifica si un cambio de stock requiere enviar notificaciones
 * a usuarios que tienen el producto en favoritos.
 * 
 * Se ejecuta de forma asíncrona (fire-and-forget) para no bloquear
 * la respuesta al usuario.
 */
export async function notifyStockChange(
    productId: number,
    stockAnterior: number,
    stockNuevo: number,
    origen: 'carrito' | 'confirmado' = 'confirmado'
): Promise<void> {
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.warn('[stock-notifications] Variables de entorno no configuradas');
            return;
        }

        const tipo = determinarTipoAlerta(stockAnterior, stockNuevo);
        if (!tipo) return;

        // Desde el carrito solo enviar stock_bajo (aviso preventivo).
        // Agotado y restock no se envían porque el carrito reserva stock
        // temporalmente y el usuario puede eliminarlo después.
        if (origen === 'carrito' && tipo !== 'stock_bajo') return;

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        // Obtener producto
        const { data: producto } = await supabase
            .from('products')
            .select('id, nombre, precio, imagen_url, referencia, categoria')
            .eq('id', productId)
            .single();

        if (!producto) return;

        // Obtener usuarios con este producto en favoritos
        const { data: favoritos } = await supabase
            .from('favoritos')
            .select('user_id')
            .eq('producto_id', productId);

        if (!favoritos || favoritos.length === 0) return;

        const userIds = favoritos.map(f => f.user_id);

        // Obtener datos de usuarios
        const { data: usuarios } = await supabase
            .from('usuarios')
            .select('id, email, nombre')
            .in('id', userIds);

        if (!usuarios || usuarios.length === 0) return;

        // Verificar notificaciones ya enviadas
        const { data: previas } = await supabase
            .from('stock_notifications')
            .select('user_id')
            .eq('producto_id', productId)
            .eq('tipo', tipo);

        const yaNotificados = new Set((previas || []).map(n => n.user_id));

        // Limpiar notificaciones previas según el ciclo
        if (tipo === 'restock') {
            await supabase
                .from('stock_notifications')
                .delete()
                .eq('producto_id', productId)
                .in('tipo', ['agotado', 'stock_bajo']);
        }
        if (tipo === 'agotado') {
            await supabase
                .from('stock_notifications')
                .delete()
                .eq('producto_id', productId)
                .eq('tipo', 'restock');
        }

        // Parsear imagen
        let imagenUrl = '';
        if (producto.imagen_url) {
            try {
                const imgs = JSON.parse(producto.imagen_url);
                imagenUrl = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : '';
            } catch {
                if (typeof producto.imagen_url === 'string' && producto.imagen_url.startsWith('http')) {
                    imagenUrl = producto.imagen_url;
                }
            }
        }

        // Enviar emails
        let enviados = 0;
        for (const usuario of usuarios) {
            if (yaNotificados.has(usuario.id)) continue;

            try {
                const result = await sendStockAlertEmail(
                    usuario.email,
                    usuario.nombre || 'Cliente',
                    { nombre: producto.nombre, imagen: imagenUrl, precio: producto.precio, id: producto.id },
                    tipo,
                    stockNuevo > 0 ? stockNuevo : undefined
                );

                if (result.success) {
                    await supabase
                        .from('stock_notifications')
                        .upsert({
                            user_id: usuario.id,
                            producto_id: productId,
                            tipo,
                            enviado_at: new Date().toISOString()
                        }, { onConflict: 'user_id,producto_id,tipo' });
                    enviados++;
                }
            } catch (err) {
                console.error(`[stock-notifications] Error enviando a ${usuario.email}:`, err);
            }
        }

        if (enviados > 0) {
            console.log(`[stock-notifications] ✅ ${enviados} email(s) de "${tipo}" enviados para "${producto.nombre}" (stock: ${stockAnterior} → ${stockNuevo})`);
        }
    } catch (err) {
        console.error('[stock-notifications] Error general:', err);
    }
}

function determinarTipoAlerta(
    stockAnterior: number,
    stockNuevo: number
): 'stock_bajo' | 'restock' | null {
    if (stockAnterior <= 0 && stockNuevo > 0) return 'restock';
    if (stockAnterior > UMBRAL_STOCK_BAJO && stockNuevo > 0 && stockNuevo <= UMBRAL_STOCK_BAJO) return 'stock_bajo';
    return null;
}
