export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF, generateRefundInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

export const GET: APIRoute = async ({ url }) => {
  try {
    const pedidoIdParam = url.searchParams.get('id') || url.searchParams.get('pedidoId');
    const pedidoId = parseInt(pedidoIdParam || '0', 10);
    const tipoFactura = url.searchParams.get('type'); // 'devolucio' para factura de devolución, null para compra

    console.log('[download-invoice] >>> Iniciando descarga de factura');
    console.log('[download-invoice]     - Pedido ID: ' + pedidoId);
    console.log('[download-invoice]     - Tipo solicitado: ' + (tipoFactura || 'compra'));

    // Validar que se proporcionó pedidoId válido
    if (!pedidoIdParam || isNaN(pedidoId)) {
      console.error('[download-invoice] Falta id o pedidoId válido');
      return new Response(
        JSON.stringify({ error: 'Falta id o pedidoId válido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener variables de entorno
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[download-invoice] Supabase no configurado correctamente');
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Usar cliente con SERVICE_ROLE_KEY para bypass de RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Obtener pedido de Supabase
    console.log('[download-invoice] 🔍 Buscando pedido en Supabase...');
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      console.error('[download-invoice] Pedido no encontrado:', pedidoError);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[download-invoice] ✅ Pedido encontrado:', pedidoId);
    console.log('[download-invoice]     - Estado: ' + pedido.estado);

    // Verificar si se solicita factura de devolución o de compra
    let esDevolucion = false;
    let itemsAFacturar: any[] = [];
    let datosDevolucion = null;
    let montoReembolso = 0;

    // Si se pide explícitamente factura de devolución (type=devolucio)
    if (tipoFactura === 'devolucio') {
      console.log('[download-invoice] 🔍 Buscando devolución para factura de devolución...');
      
      const { data: devoluciones, error: devError } = await supabase
        .from('devoluciones')
        .select('*')
        .eq('pedido_id', pedidoId)
        .in('estado', ['procesado', 'confirmada'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (!devError && devoluciones && devoluciones.length > 0) {
        console.log('[download-invoice] ✅ Devolución encontrada');
        esDevolucion = true;
        datosDevolucion = devoluciones[0];
        itemsAFacturar = datosDevolucion.items_devueltos || [];
        montoReembolso = datosDevolucion.monto_reembolso || 0;
        console.log('[download-invoice]     - Items devueltos: ' + itemsAFacturar.length);
        console.log('[download-invoice]     - Monto reembolso: €' + montoReembolso);
      } else if (pedido.estado === 'cancelado') {
        // Pedido cancelado sin registro de devolución: generar factura de reembolso con todos los items
        console.log('[download-invoice] ✅ Pedido cancelado - generando factura de reembolso (sin registro de devolución)');
        esDevolucion = true;
        itemsAFacturar = typeof pedido.items === 'string' 
          ? JSON.parse(pedido.items) 
          : (pedido.items || []);
        montoReembolso = pedido.total || 0;
      } else {
        console.log('[download-invoice] ⚠️ No se encontró devolución activa para este pedido');
        return new Response(
          JSON.stringify({ error: 'No se encontró devolución para este pedido' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Factura de compra normal (incluso para cancelados)
      console.log('[download-invoice] 📄 Generando factura de compra');
      itemsAFacturar = typeof pedido.items === 'string' 
        ? JSON.parse(pedido.items) 
        : (pedido.items || []);
    }

    // Enriquecer items
    console.log('[download-invoice] 🔄 Enriqueciendo datos de productos...');
    const productosEnriquecidos = [];

    for (const item of itemsAFacturar) {
      const productId = item.product_id || item.id;
      console.log(`[download-invoice]   Obteniendo datos del producto: ${productId}`);
      const datosProducto = await obtenerDatosProducto(productId);

      if (datosProducto) {
        console.log(`[download-invoice]     - imagen_url: ${datosProducto.imagen_url || 'NO DISPONIBLE'}`);
        productosEnriquecidos.push({
          id: productId,
          nombre: datosProducto.nombre || item.nombre,
          cantidad: item.cantidad,
          precio_unitario: datosProducto.precio || item.precio,
          subtotal: (datosProducto.precio || item.precio) * item.cantidad,
          imagen_url: datosProducto.imagen_url,
          talla: item.talla,
        });
      } else {
        productosEnriquecidos.push({
          id: productId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          subtotal: item.precio * item.cantidad,
          talla: item.talla,
        });
      }
    }

    console.log('[download-invoice] ✅ Datos de productos enriquecidos');

    // Crear objeto datosFactura
    let datosFactura: any;

    if (esDevolucion) {
      // Estructura para factura de devolución/reembolso
      // Usar datos de devolucion si existe, sino usar datos del pedido (para cancelaciones)
      datosFactura = {
        numero_pedido: datosDevolucion ? `DEV-${pedidoId}` : `CANC-${pedidoId}`,
        fecha: new Date(datosDevolucion?.created_at || new Date()),
        cliente: {
          nombre: datosDevolucion?.usuario_nombre || pedido.nombre,
          email: datosDevolucion?.usuario_email || pedido.email,
          telefono: pedido.telefono || '',
          direccion: pedido.direccion,
          ciudad: pedido.ciudad,
          codigo_postal: pedido.codigo_postal || '',
          pais: pedido.pais || 'España',
        },
        productos: productosEnriquecidos,
        subtotal: montoReembolso,
        envio: 0,
        descuento: 0,
        total: montoReembolso,
        esReembolso: true,
      };
    } else {
      // Estructura para factura de compra
      datosFactura = {
        numero_pedido: pedidoId.toString(),
        fecha: new Date(pedido.fecha_creacion || new Date()),
        cliente: {
          nombre: pedido.nombre,
          email: pedido.email,
          telefono: pedido.telefono || '',
          direccion: pedido.direccion,
          ciudad: pedido.ciudad,
          codigo_postal: pedido.codigo_postal || '',
          pais: pedido.pais || 'España',
        },
        productos: productosEnriquecidos,
        subtotal: pedido.subtotal,
        envio: pedido.envio,
        descuento: 0,
        total: pedido.total,
      };
    }

    // Generar PDF (usar la función correspondiente)
    console.log('[download-invoice] 📄 Generando PDF de factura' + (esDevolucion ? ' de devolución' : '') + '...');
    let pdfBuffer: Buffer;

    try {
      if (esDevolucion) {
        pdfBuffer = await generateRefundInvoicePDF(datosFactura);
      } else {
        pdfBuffer = await generateInvoicePDF(datosFactura);
      }

      if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        console.error('[download-invoice] PDF generado inválido');
        return new Response(
          JSON.stringify({ error: 'Error al generar el PDF' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[download-invoice] ✅ PDF generado exitosamente (${pdfBuffer.length} bytes)`);
    } catch (pdfError) {
      console.error('[download-invoice] ❌ Error generando PDF:', pdfError);
      return new Response(
        JSON.stringify({ error: 'Error al generar el PDF' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Retornar PDF
    console.log('[download-invoice] 📤 Enviando PDF al cliente...');

    const nombreArchivo = esDevolucion 
      ? `comprobante_reembolso_${pedidoId}.pdf`
      : `factura_${pedidoId}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[download-invoice] ❌ Error:', error.message);
    console.error('[download-invoice] Stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
