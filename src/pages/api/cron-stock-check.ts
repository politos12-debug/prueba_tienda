export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

/**
 * CRON: Revisa el stock de TODOS los productos cada día a las 8:00 UTC.
 * En invierno (CET) = 9:00 AM España, en verano (CEST) = 10:00 AM España.
 * Envía una notificación a Telegram con los productos que tienen stock = 0.
 * Protegido con CRON_SECRET para que solo Vercel pueda invocarlo.
 */

const TELEGRAM_BOT_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.TELEGRAM_CHAT_ID;

export const GET: APIRoute = async ({ request }) => {
  // Verificar que la llamada viene de Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = import.meta.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Config de Supabase faltante' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Obtener solo productos ACTIVOS con stock = 0
    const { data: productosAgotados, error } = await supabase
      .from('products')
      .select('id, nombre, referencia, precio, categoria, stock')
      .eq('stock', 0)
      .eq('activo', true)
      .order('categoria', { ascending: true });

    if (error) {
      console.error('[cron-stock-check] Error consultando productos:', error);
      return new Response(JSON.stringify({ error: 'Error consultando BD' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!productosAgotados || productosAgotados.length === 0) {
      console.log('[cron-stock-check] ✅ Todos los productos tienen stock');
      return new Response(JSON.stringify({ ok: true, agotados: 0, message: 'Todo el stock OK' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enviar un solo mensaje resumen a Telegram con todos los agotados
    await enviarResumenAgotados(productosAgotados);

    return new Response(
      JSON.stringify({
        ok: true,
        agotados: productosAgotados.length,
        productos: productosAgotados.map((p) => p.nombre),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[cron-stock-check] Error inesperado:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Envía un mensaje resumen agrupado a Telegram en vez de un mensaje por producto
async function enviarResumenAgotados(
  productos: Array<{ id: number; nombre: string; referencia?: string; precio?: number; categoria?: string; stock: number }>
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[cron-stock-check] Telegram no configurado');
    return;
  }

  // Agrupar por categoría
  const porCategoria: Record<string, typeof productos> = {};
  for (const p of productos) {
    const cat = p.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(p);
  }

  let listado = '';
  for (const [cat, prods] of Object.entries(porCategoria)) {
    listado += `\n📂 *${escapeMarkdown(cat)}*\n`;
    for (const p of prods) {
      const ref = p.referencia ? ` (${escapeMarkdown(p.referencia)})` : '';
      const precio = p.precio ? ` — €${p.precio.toFixed(2)}` : '';
      listado += `  • ${escapeMarkdown(p.nombre)}${ref}${precio}\n`;
    }
  }

  const message =
    `🔔 *INFORME DE STOCK — ${productos.length} producto${productos.length > 1 ? 's' : ''} agotado${productos.length > 1 ? 's' : ''}*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    listado +
    `\n🔗 [Ver en panel admin](https://galiana-produccion.vercel.app/admin/panel.html)`;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[cron-stock-check] Error Telegram:', err);
    } else {
      console.log(`[cron-stock-check] ✅ Resumen enviado a Telegram (${productos.length} agotados)`);
    }
  } catch (err) {
    console.error('[cron-stock-check] Error enviando a Telegram:', err);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
