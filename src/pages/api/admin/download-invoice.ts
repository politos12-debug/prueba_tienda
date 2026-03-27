export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF, generateRefundInvoicePDF, obtenerDatosProducto } from '../../../lib/invoice-generator';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pedidoIdParam = url.searchParams.get('id');
    const pedidoId = parseInt(pedidoIdParam || '0', 10);

    if (!pedidoIdParam || isNaN(pedidoId)) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido requerido y válido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener variables de entorno
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[admin/download-invoice] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Usar cliente con SERVICE_ROLE_KEY para bypass de RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Obtener datos del pedido
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (error || !pedido) {
      console.error('Error al obtener pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si hay devoluciones asociadas
    let esDevolucion = false;
    let itemsAFacturar: any[] = [];
    let datosDevolucion = null;
    let montoReembolso = 0;

    // Buscar devoluciones (solo si no está cancelado)
    if (pedido.estado !== 'cancelado') {
      const { data: devoluciones, error: devError } = await supabase
        .from('devoluciones')
        .select('*')
        .eq('pedido_id', pedidoId)
        .in('estado', ['procesado', 'confirmada'])
        .order('created_at', { ascending: false })
        .limit(1);

      // Si hay devoluciones, usar los datos de la devolución
      if (!devError && devoluciones && devoluciones.length > 0) {
        esDevolucion = true;
        datosDevolucion = devoluciones[0];
        
        // Usar SOLO los items devueltos
        itemsAFacturar = datosDevolucion.items_devueltos || [];
        montoReembolso = datosDevolucion.monto_reembolso || 0;
      } else {
        // Obtener items del pedido original
        itemsAFacturar = typeof pedido.items === 'string' 
          ? JSON.parse(pedido.items) 
          : (pedido.items || []);
      }
    } else {
      // Pedido cancelado: generar factura de reembolso
      esDevolucion = true;
      
      // Usar todos los items del pedido como "devueltos"
      itemsAFacturar = typeof pedido.items === 'string' 
        ? JSON.parse(pedido.items) 
        : (pedido.items || []);
      
      montoReembolso = pedido.total || 0;
    }

    // Enriquecer productos con detalles
    const productosConDetalles: any[] = [];
    for (const item of itemsAFacturar) {
      const detalles = await obtenerDatosProducto(item.product_id || item.id);
      productosConDetalles.push({
        id: item.product_id || item.id,
        nombre: item.nombre || detalles?.nombre || 'Producto',
        cantidad: item.cantidad || 1,
        precio_unitario: item.precio || detalles?.precio || 0,
        subtotal: item.subtotal !== undefined 
          ? item.subtotal 
          : ((item.precio || detalles?.precio || 0) * (item.cantidad || 1)),
        imagen_url: detalles?.imagen_url,
        talla: item.talla
      });
    }

    // Generar PDF de factura
    let datosFactura: any;
    
    if (esDevolucion) {
      // Estructura para factura de devolución/reembolso
      datosFactura = {
        numero_pedido: datosDevolucion ? `DEV-${pedidoId}` : `CANC-${pedidoId}`,
        fecha: new Date(datosDevolucion?.created_at || new Date()),
        cliente: {
          nombre: datosDevolucion?.usuario_nombre || pedido.nombre || 'Cliente',
          email: datosDevolucion?.usuario_email || pedido.email || '',
          telefono: pedido.telefono || '',
          direccion: pedido.direccion || '',
          ciudad: pedido.ciudad || '',
          codigo_postal: pedido.codigo_postal || '',
          pais: pedido.pais || 'España'
        },
        productos: productosConDetalles,
        subtotal: montoReembolso,
        envio: 0,
        descuento: 0,
        total: montoReembolso,
        esReembolso: true
      };
    } else {
      // Estructura para factura de compra
      datosFactura = {
        numero_pedido: String(pedidoId),
        fecha: new Date(pedido.fecha_pedido || new Date()),
        cliente: {
          nombre: pedido.nombre || 'Cliente',
          email: pedido.email || '',
          telefono: pedido.telefono || '',
          direccion: pedido.direccion || '',
          ciudad: pedido.ciudad || '',
          codigo_postal: pedido.codigo_postal || '',
          pais: pedido.pais || 'España'
        },
        productos: productosConDetalles,
        subtotal: pedido.subtotal || 0,
        envio: pedido.envio || 0,
        descuento: 0,
        total: pedido.total || 0
      };
    }

    let pdfBuffer: Buffer;
    if (esDevolucion) {
      pdfBuffer = await generateRefundInvoicePDF(datosFactura);
    } else {
      pdfBuffer = await generateInvoicePDF(datosFactura);
    }

    const nombreArchivo = esDevolucion 
      ? `comprobante_reembolso_${pedidoId}.pdf`
      : `factura_${pedidoId}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error descargando factura:', error);
    return new Response(
      JSON.stringify({ error: 'Error al generar la factura' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
