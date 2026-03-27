export const prerender = false;
import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { sendEmail } from '../../../lib/brevo';
import Stripe from 'stripe';
import { generateRefundInvoicePDF, obtenerDatosProducto } from '../../../lib/invoice-generator';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

interface ManageReturnRequest {
  devolucionId: number;
  action: 'listar' | 'confirmar' | 'rechazar';
  motivo_rechazo?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = (await context.request.json()) as ManageReturnRequest;
    const { devolucionId, action, motivo_rechazo } = body;

    // Validar que sea admin (en un proyecto real, verificarías el token JWT)
    // Por ahora asumimos que si llega a este endpoint, es admin

    if (action === 'listar') {
      // Listar todas las devoluciones pendientes (usando admin client para saltarse RLS)
      const { data: devoluciones, error } = await supabaseAdmin
        .from('devoluciones')
        .select(`
          *,
          pedidos:pedido_id(*)
        `)
        .in('estado', ['procesado', 'confirmada', 'rechazada'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[manage-returns] Error fetching devoluciones:', error);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al obtener devoluciones'
          }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          devoluciones
        }),
        { status: 200 }
      );
    }

    if (action === 'confirmar') {
      if (!devolucionId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'ID de devolución requerido'
          }),
          { status: 400 }
        );
      }

      // Obtener la devolución (usando admin client para saltarse RLS)
      const { data: devolucion, error: fetchError } = await supabaseAdmin
        .from('devoluciones')
        .select(`
          *,
          pedidos:pedido_id(*)
        `)
        .eq('id', devolucionId)
        .single();

      if (fetchError || !devolucion) {
        console.error('[manage-returns] Error fetching devolucion:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Devolución no encontrada'
          }),
          { status: 404 }
        );
      }

      const pedido = devolucion.pedidos;

      // PASO 1: Generar PDF de factura de devolución confirmada
      let pdfBuffer: Buffer | undefined;
      try {
        // Usar los items devueltos guardados en la devolución
        const itemsDevueltos = devolucion.items_devueltos || [];
        const montoReembolso = devolucion.monto_reembolso || 0;

        const productosConDetalles: any[] = [];
        for (const item of itemsDevueltos) {
          const detalles = await obtenerDatosProducto(item.product_id || item.id);
          productosConDetalles.push({
            id: item.product_id || item.id,
            nombre: item.nombre || detalles?.nombre || 'Producto',
            cantidad: item.cantidad || 1,
            precio_unitario: item.precio || 0,
            subtotal: item.subtotal || (item.precio * item.cantidad),
            imagen_url: detalles?.imagen_url,
            talla: item.talla
          });
        }

        const datosFacturaDevolucion = {
          numero_pedido: `DEV-${devolucion.pedido_id}`,
          fecha: new Date(),
          cliente: {
            nombre: devolucion.usuario_nombre || 'Cliente',
            email: devolucion.usuario_email,
            telefono: pedido?.telefono || 'No proporcionado',
            direccion: pedido?.direccion || 'No proporcionada',
            ciudad: pedido?.ciudad || 'No proporcionada',
            codigo_postal: pedido?.codigo_postal || 'No proporcionado',
            pais: pedido?.pais || 'ES'
          },
          productos: productosConDetalles,
          subtotal: montoReembolso,
          envio: 0, // No se devuelve gastos de envío en devoluciones parciales
          descuento: 0,
          total: montoReembolso
        };

        pdfBuffer = await generateRefundInvoicePDF(datosFacturaDevolucion);
        console.log('[manage-returns] ✅ Factura de devolución generada');
      } catch (pdfError) {
        console.warn('[manage-returns] ⚠️ Error generando factura de devolución:', pdfError);
      }

      // PASO 1-B: Procesar reembolso proporcional en Stripe
      let refundProcessed = false;
      let refundAmount = 0;
      try {
        if (pedido && pedido.stripe_payment_id) {
          const stripeId = pedido.stripe_payment_id;
          const montoReembolso = devolucion.monto_reembolso || 0;
          const amountInCents = Math.round(montoReembolso * 100);

          let paymentIntentId: string | null = null;
          if (stripeId.startsWith('pi_')) {
            // Ya es un Payment Intent ID (pedidos desde la app móvil)
            paymentIntentId = stripeId;
            console.log('[manage-returns] Payment Intent ID (desde app móvil):', paymentIntentId);
          } else {
            // Es un Checkout Session ID (pedidos desde la web)
            console.log('[manage-returns] Checkout Session ID:', stripeId);
            try {
              const session = await stripe.checkout.sessions.retrieve(stripeId);
              paymentIntentId = session.payment_intent as string;
              console.log('[manage-returns] Payment Intent obtenido:', paymentIntentId);
            } catch (sessionError: any) {
              console.error('[manage-returns] Error obteniendo sesión de checkout:', sessionError.message);
            }
          }

          console.log('[manage-returns] Monto a reembolsar:', montoReembolso, '€ (', amountInCents, 'céntimos)');

          try {

            if (paymentIntentId) {
              // Crear reembolso proporcional basado en los items devueltos
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amountInCents, // Reembolso solo del monto de los items devueltos
                reason: 'requested_by_customer'
              });

              if (refund.id) {
                console.log('[manage-returns] ✅ Reembolso procesado:', refund.id, '- Monto:', refund.amount / 100, '€');
                refundProcessed = true;
                refundAmount = refund.amount / 100;
              }
            }
          } catch (refundError: any) {
            console.error('[manage-returns] Error procesando refund:', refundError.message);
          }
        }
      } catch (refundError) {
        console.warn('[manage-returns] ⚠️ Error al procesar reembolso de Stripe:', refundError);
      }

      // PASO 2: Actualizar estado de devolución a 'confirmada' (usando admin client para saltarse RLS)
      const { error: updateError } = await supabaseAdmin
        .from('devoluciones')
        .update({
          estado: 'confirmada',
          updated_at: new Date().toISOString()
        })
        .eq('id', devolucionId);

      if (updateError) {
        console.error('[manage-returns] Error updating devolucion:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al actualizar devolución'
          }),
          { status: 500 }
        );
      }

      // PASO 2-B: Restaurar stock de productos devueltos
      try {
        const itemsParaStock = devolucion.items_devueltos || [];
        console.log('[manage-returns] Restaurando stock para', itemsParaStock.length, 'productos devueltos');

        for (const item of itemsParaStock) {
          if (item.product_id) {
            // Obtener el stock actual
            const { data: productData, error: getError } = await supabaseAdmin
              .from('products')
              .select('stock, id')
              .eq('id', item.product_id)
              .single();

            if (!getError && productData) {
              const nuevoStock = (productData.stock || 0) + (item.cantidad || 1);

              // Actualizar stock
              const { error: updateStockError } = await supabaseAdmin
                .from('products')
                .update({ stock: nuevoStock })
                .eq('id', item.product_id);

              if (!updateStockError) {
                console.log(`[manage-returns] Stock restaurado para producto ${item.product_id}: +${item.cantidad || 1}`);
              } else {
                console.warn(`[manage-returns] Error al restaurar stock para producto ${item.product_id}:`, updateStockError);
              }
            } else {
              console.warn(`[manage-returns] No se encontró producto ${item.product_id} para restaurar stock`);
            }
          }
        }
        console.log('[manage-returns] Restauración de stock completada');
      } catch (stockError) {
        console.error('[manage-returns] Error al procesar restauración de stock:', stockError);
        // No bloqueamos el flujo si falla la restauración de stock
      }

      // PASO 3: Enviar email "Devolución Confirmada y Reembolso en Proceso"
      const itemsDevueltos = devolucion.items_devueltos || [];
      const montoReembolso = devolucion.monto_reembolso || 0;
      
      const itemsHTML = itemsDevueltos
        .map(item => `<li style="color: #666; margin: 8px 0;"><strong>${item.nombre}</strong> (x${item.cantidad}) - €${item.subtotal?.toFixed(2) || (item.precio * item.cantidad).toFixed(2)}</li>`)
        .join('');

      const emailContent = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Devolución Confirmada</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin-bottom: 24px;">Hola <strong>${devolucion.usuario_nombre}</strong>,</p>
            
            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Tu devolución para el pedido <strong>#${devolucion.pedido_id}</strong> ha sido <strong>confirmada</strong>.
            </p>

            <div style="background: #f9f9f9; padding: 16px; border-radius: 6px; margin: 24px 0; border: 1px solid #e0e0e0;">
              <h4 style="color: #333; margin-top: 0; font-size: 14px; margin-bottom: 12px;">📦 Productos devueltos:</h4>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                ${itemsHTML}
              </ul>
              <div style="border-top: 1px solid #e0e0e0; margin-top: 12px; padding-top: 12px;">
                <p style="color: #333; margin: 0; font-weight: bold;">
                  💰 Monto a reembolsar: €${montoReembolso.toFixed(2)}
                </p>
              </div>
            </div>

            <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #155724; margin: 0; font-size: 14px;">
                <strong>✅ Reembolso en Proceso:</strong> Hemos iniciado el proceso de reembolso de €${montoReembolso.toFixed(2)}. El dinero aparecerá en tu cuenta en 5-10 días hábiles dependiendo de tu banco.
              </p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
              <h3 style="color: #333; margin-top: 0; font-size: 16px;">Detalles de la devolución:</h3>
              <p style="color: #666; margin: 8px 0;"><strong>Pedido:</strong> #${devolucion.pedido_id}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Motivo:</strong> ${devolucion.motivo_solicitud}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Estado:</strong> Confirmada</p>
              <p style="color: #666; margin: 8px 0;"><strong>Monto a reembolsar:</strong> €${montoReembolso.toFixed(2)}</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>📎 Adjunto:</strong> Encontrarás la nota de referencia de tu devolución.
              </p>
            </div>

            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:
            </p>
            
            <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
              📧 <a href="mailto:info@joyeriagaliana.com" style="color: #28a745; text-decoration: none;">info@joyeriagaliana.com</a><br>
              🌐 <a href="https://galiana-produccion.vercel.app" style="color: #28a745; text-decoration: none;">galiana-produccion.vercel.app</a>
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              Joyería Galiana<br>
              Sanlúcar de Barrameda, España<br>
              <em>Gracias por tu confianza</em>
            </p>
          </div>
        </div>
      `;

      const emailResult = await sendEmail({
        to: [{ email: devolucion.usuario_email, name: devolucion.usuario_nombre }],
        subject: `Devolución Confirmada y Reembolso en Proceso - Pedido #${devolucion.pedido_id} - Joyería Galiana`,
        htmlContent: emailContent,
        attachment: pdfBuffer ? {
          content: pdfBuffer.toString('base64'),
          name: `nota_devolucion_${devolucion.pedido_id}.pdf`
        } : undefined
      });

      if (!emailResult.success) {
        console.error('[manage-returns] Error sending email:', emailResult.error);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Devolución confirmada y reembolso procesado',
          refundProcessed: refundProcessed
        }),
        { status: 200 }
      );
    }

    if (action === 'rechazar') {
      if (!devolucionId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'ID de devolución requerido'
          }),
          { status: 400 }
        );
      }

      if (!motivo_rechazo || motivo_rechazo.trim().length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Motivo de rechazo requerido'
          }),
          { status: 400 }
        );
      }

      // Obtener la devolución (usando admin client para saltarse RLS)
      const { data: devolucion, error: fetchError } = await supabaseAdmin
        .from('devoluciones')
        .select('*')
        .eq('id', devolucionId)
        .single();

      if (fetchError || !devolucion) {
        console.error('[manage-returns] Error fetching devolucion:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Devolución no encontrada'
          }),
          { status: 404 }
        );
      }

      // Actualizar estado de devolución a 'rechazada' con motivo (usando admin client para saltarse RLS)
      const { error: updateError } = await supabaseAdmin
        .from('devoluciones')
        .update({
          estado: 'rechazada',
          motivo_rechazo: motivo_rechazo,
          updated_at: new Date().toISOString()
        })
        .eq('id', devolucionId);

      if (updateError) {
        console.error('[manage-returns] Error updating devolucion:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al actualizar devolución'
          }),
          { status: 500 }
        );
      }

      // Enviar email "Devolución Rechazada"
      const emailContent = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">❌ Devolución Rechazada</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin-bottom: 24px;">Hola <strong>${devolucion.usuario_nombre}</strong>,</p>
            
            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Lamentablemente, tu solicitud de devolución para el pedido <strong>#${devolucion.pedido_id}</strong> ha sido <strong>rechazada</strong>.
            </p>

            <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #c62828; margin: 0; font-size: 14px; font-weight: bold;">
                Motivo del rechazo:
              </p>
              <p style="color: #d32f2f; margin: 8px 0 0 0; font-size: 14px; line-height: 1.6;">
                ${motivo_rechazo}
              </p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
              <h3 style="color: #333; margin-top: 0; font-size: 16px;">Detalles de tu solicitud:</h3>
              <p style="color: #666; margin: 8px 0;"><strong>Pedido:</strong> #${devolucion.pedido_id}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Motivo solicitado:</strong> ${devolucion.motivo_solicitud}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Estado:</strong> Rechazada</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>¿Tienes preguntas?</strong> Si crees que se trata de un error o deseas obtener más información sobre esta decisión, no dudes en contactarnos. Revisaremos tu caso.
              </p>
            </div>

            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Estamos aquí para ayudarte. Contáctanos si necesitas más información:
            </p>
            
            <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
              📧 <a href="mailto:info@joyeriagaliana.com" style="color: #f44336; text-decoration: none;">info@joyeriagaliana.com</a><br>
              🌐 <a href="https://galiana-produccion.vercel.app" style="color: #f44336; text-decoration: none;">galiana-produccion.vercel.app</a>
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              Joyería Galiana<br>
              Sanlúcar de Barrameda, España
            </p>
          </div>
        </div>
      `;

      const emailResult = await sendEmail({
        to: [{ email: devolucion.usuario_email, name: devolucion.usuario_nombre }],
        subject: `Devolución Rechazada - Pedido #${devolucion.pedido_id} - Joyería Galiana`,
        htmlContent: emailContent
      });

      if (!emailResult.success) {
        console.error('[manage-returns] Error sending email:', emailResult.error);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Devolución rechazada'
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Acción no reconocida'
      }),
      { status: 400 }
    );

  } catch (error) {
    console.error('[manage-returns] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor'
      }),
      { status: 500 }
    );
  }
};
