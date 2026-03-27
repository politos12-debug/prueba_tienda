// ========== NOTIFICACIONES TELEGRAM ==========
// Envía notificaciones de nuevos pedidos a Telegram via Bot API

const TELEGRAM_BOT_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.TELEGRAM_CHAT_ID;

interface PedidoTelegram {
  sessionId?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  codigoPostal?: string;
  total: number;
  envio: number;
  productos: Array<{
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    talla?: string;
  }>;
}

export async function sendTelegramOrderNotification(pedido: PedidoTelegram): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Telegram no configurado (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID faltante)');
    return false;
  }

  try {
    // Construir lista de productos
    const productosText = pedido.productos
      .map(p => {
        let line = `  • ${p.nombre} x${p.cantidad} — €${p.precio_unitario.toFixed(2)}`;
        if (p.talla) line += ` (Talla: ${p.talla})`;
        return line;
      })
      .join('\n');

    const envioText = pedido.envio > 0 ? `€${pedido.envio.toFixed(2)}` : 'Gratis';

    const message =
      `🛍 *NUEVO PEDIDO*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `\n` +
      `👤 *Cliente:* ${escapeMarkdown(pedido.nombre || 'No proporcionado')}\n` +
      `📧 *Email:* ${escapeMarkdown(pedido.email || 'No proporcionado')}\n` +
      `📱 *Teléfono:* ${escapeMarkdown(pedido.telefono || 'No proporcionado')}\n` +
      `\n` +
      `📦 *Productos:*\n${productosText}\n` +
      `\n` +
      `🚚 *Envío:* ${envioText}\n` +
      `💰 *TOTAL: €${pedido.total.toFixed(2)}*\n` +
      `\n` +
      `📍 *Dirección:*\n` +
      `${escapeMarkdown(pedido.direccion || '')}` +
      `${pedido.ciudad ? ', ' + escapeMarkdown(pedido.ciudad) : ''}` +
      `${pedido.codigoPostal ? ' ' + escapeMarkdown(pedido.codigoPostal) : ''}\n` +
      `\n` +
      `🔗 [Ver en panel admin](https://galiana-produccion.vercel.app/admin/panel.html)`;

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
      const error = await response.text();
      console.error('❌ Error enviando notificación Telegram:', error);
      return false;
    }

    console.log('✅ Notificación Telegram enviada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación Telegram:', error);
    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}


