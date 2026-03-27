export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { notifyStockChange } from '../../lib/stock-notifications';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const { productId, cantidad, accion } = await request.json();

        // Validar datos
        if (!productId || !cantidad || !accion) {
            console.warn('[update-cart-stock] Datos incompletos:', { productId, cantidad, accion });
            return new Response(JSON.stringify({ success: false, error: 'Datos incompletos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!['restar', 'sumar'].includes(accion)) {
            console.warn('[update-cart-stock] Acción no válida:', accion);
            return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener stock actual
        const { data: producto, error: fetchError } = await supabase
            .from('products')
            .select('id, stock, nombre')
            .eq('id', productId)
            .single();

        if (fetchError) {
            console.error('[update-cart-stock] Error al obtener producto:', fetchError);
            return new Response(JSON.stringify({ error: 'Producto no encontrado', details: fetchError.message }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!producto) {
            console.warn('[update-cart-stock] Producto no encontrado:', productId);
            return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Calcular nuevo stock
        const stockActual = producto.stock || 0;
        
        // VALIDACIÓN SERVER-SIDE: nunca permitir restar más de lo que hay
        if (accion === 'restar' && stockActual < cantidad) {
            console.warn(`[update-cart-stock] Intento de restar ${cantidad} pero solo hay ${stockActual} para ${productId}`);
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Stock insuficiente. Disponible: ${stockActual}`,
                stockActual: stockActual
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const nuevoStock = accion === 'restar' 
            ? stockActual - cantidad
            : stockActual + cantidad;

        // Actualización con optimistic locking: solo actualizar si stock no cambió
        const { error: updateError, data: updateData } = await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productId)
            .eq('stock', stockActual)  // Solo actualiza si nadie más cambió el stock
            .select('stock');

        if (updateError) {
            console.error('[update-cart-stock] Error actualizando stock:', updateError);
            return new Response(JSON.stringify({ 
                error: 'Error al actualizar stock',
                details: updateError.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Si no se actualizó ninguna fila, otro proceso cambió el stock (optimistic lock)
        if (!updateData || updateData.length === 0) {
            console.warn(`[update-cart-stock] Stock cambió durante la actualización para ${productId}, reintentando...`);
            // Releer y reintentar una vez
            const { data: productoAhora } = await supabase
                .from('products')
                .select('stock')
                .eq('id', productId)
                .single();
            
            const stockAhora = productoAhora?.stock || 0;
            if (accion === 'restar' && stockAhora < cantidad) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `Stock insuficiente tras reintento`,
                    stockActual: stockAhora
                }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const nuevoStockReintento = accion === 'restar' ? stockAhora - cantidad : stockAhora + cantidad;
            await supabase
                .from('products')
                .update({ stock: nuevoStockReintento })
                .eq('id', productId)
                .eq('stock', stockAhora);

            console.log(`[update-cart-stock] ✅ Stock actualizado (reintento) para ${productId}: ${stockAhora} -> ${nuevoStockReintento}`);

            // Notificar cambio de stock (fire-and-forget, origen: carrito)
            notifyStockChange(productId, stockAhora, nuevoStockReintento, 'carrito').catch(() => {});

            return new Response(JSON.stringify({
                success: true,
                stockAnterior: stockAhora,
                stockNuevo: nuevoStockReintento,
                producto: producto.nombre
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[update-cart-stock] ✅ Stock actualizado para producto ${productId} (${producto.nombre}): ${stockActual} -> ${nuevoStock} (${accion})`);

        // Notificar cambio de stock (fire-and-forget, origen: carrito)
        notifyStockChange(productId, stockActual, nuevoStock, 'carrito').catch(() => {});

        return new Response(JSON.stringify({
            success: true,
            stockAnterior: stockActual,
            stockNuevo: nuevoStock,
            producto: producto.nombre
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[update-cart-stock] Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

