import PDFDocument from 'pdfkit';
import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

interface ProductoFactura {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  imagen_url?: string;
  talla?: string;
}

interface DatosFactura {
  numero_pedido: string;
  fecha: Date;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
    direccion: string;
    ciudad: string;
    codigo_postal: string;
    pais: string;
  };
  productos: ProductoFactura[];
  subtotal: number;
  envio: number;
  descuento: number;
  total: number;
  esReembolso?: boolean;
}

/**
 * Descarga una imagen desde una URL y la devuelve como Buffer
 */
async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    if (!url || !url.startsWith('http')) return null;
    
    // Cloudinary: convertir webp a jpg y reducir tamaño para PDF
    let finalUrl = url;
    if (finalUrl.includes('cloudinary.com')) {
      finalUrl = finalUrl
        .replace(/f_webp/g, 'f_jpg')
        .replace(/w_\d+/g, 'w_200')
        .replace(/h_\d+/g, 'h_200')
        .replace(/q_\d+/g, 'q_80');
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(finalUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn('⚠️ Imagen respuesta no OK:', response.status, finalUrl);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[invoice-generator]   ✅ Imagen descargada: ${buffer.length} bytes`);
    return buffer;
  } catch (err) {
    console.warn('⚠️ No se pudo descargar imagen:', url, err instanceof Error ? err.message : '');
    return null;
  }
}

/**
 * Extrae la primera URL de imagen de un campo que puede ser string o array
 */
function getFirstImageUrl(imagenUrl: any): string | null {
  if (!imagenUrl) return null;
  
  // Si es un array, tomar la primera imagen
  if (Array.isArray(imagenUrl)) {
    return imagenUrl.length > 0 ? imagenUrl[0] : null;
  }
  
  // Si es un string que parece un JSON array, parsearlo
  if (typeof imagenUrl === 'string' && imagenUrl.startsWith('[')) {
    try {
      const parsed = JSON.parse(imagenUrl);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    } catch {
      return imagenUrl;
    }
  }
  
  // Si es un string normal, devolverlo
  return typeof imagenUrl === 'string' ? imagenUrl : null;
}

/**
 * Pre-descarga todas las imágenes de los productos para usarlas en el PDF
 */
async function preloadProductImages(productos: ProductoFactura[]): Promise<Map<string, Buffer>> {
  const imageMap = new Map<string, Buffer>();
  
  const promises = productos.map(async (producto) => {
    if (producto.imagen_url) {
      const url = getFirstImageUrl(producto.imagen_url);
      if (url) {
        const buffer = await fetchImageAsBuffer(url);
        if (buffer && buffer.length > 0) {
          imageMap.set(producto.id, buffer);
        }
      }
    }
  });
  
  await Promise.all(promises);
  console.log(`[invoice-generator] 🖼️ Imágenes pre-cargadas: ${imageMap.size}/${productos.length}`);
  return imageMap;
}

/**
 * Genera un PDF de factura con el logo, datos del cliente y productos
 */
export async function generateInvoicePDF(datos: DatosFactura): Promise<Buffer> {
  const TIMEOUT_MS = 10000;
  
  const pdfPromise = new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30
      });

      const buffers: Buffer[] = [];

      doc.on('data', (chunk: any) => {
        buffers.push(chunk as Buffer);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.on('error', (error: any) => {
        reject(error);
      });

      // ===== HEADER CON LOGO =====
      try {
        const logoPath = path.resolve('public/images/logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 30, 30, { width: 80, height: 80 });
        }
      } catch (logoErr) {
        console.warn('⚠️ No se pudo cargar el logo:', logoErr);
      }

      // Datos de empresa
      doc.fontSize(18)
        .font('Helvetica-Bold')
        .text('JOYERÍA GALIANA', 120, 35);

      doc.fontSize(10)
        .font('Helvetica')
        .text('Sanlúcar de Barrameda, España', 120, 60)
        .text('Email: info@joyeriagaliana.com', 120, 75)
        .text('Teléfono: +34 XXX XXX XXX', 120, 90);

      // ===== NÚMERO Y FECHA DE FACTURA =====
      const tipoDocumento = datos.esReembolso ? 'NOTA DE REEMBOLSO' : 'FACTURA';
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .text(tipoDocumento, 450, 35);

      doc.fontSize(10)
        .font('Helvetica')
        .text(`${datos.esReembolso ? 'Reembolso' : 'Factura'} #${datos.numero_pedido}`, 450, 65)
        .text(`Fecha: ${datos.fecha.toLocaleDateString('es-ES')}`, 450, 80);

      // ===== LÍNEA SEPARADORA =====
      doc.moveTo(30, 125)
        .lineTo(565, 125)
        .stroke();

      // ===== DATOS DEL CLIENTE =====
      let yPosition = 145;

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('DATOS DEL CLIENTE', 30, yPosition);

      yPosition += 20;

      doc.fontSize(9)
        .font('Helvetica')
        .text(`Nombre: ${datos.cliente.nombre}`, 30, yPosition)
        .text(`Email: ${datos.cliente.email}`, 30, yPosition + 12)
        .text(`Teléfono: ${datos.cliente.telefono}`, 30, yPosition + 24)
        .text(`Dirección: ${datos.cliente.direccion}`, 30, yPosition + 36)
        .text(`${datos.cliente.codigo_postal} ${datos.cliente.ciudad}, ${datos.cliente.pais}`, 30, yPosition + 48);

      yPosition += 85;

      // ===== LÍNEA SEPARADORA =====
      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== TABLA DE PRODUCTOS =====
      // Pre-descargar todas las imágenes de productos
      const imageMap = await preloadProductImages(datos.productos);

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('PRODUCTOS', 30, yPosition);

      yPosition += 25;

      // Headers de tabla - ajustados para incluir columna de imagen
      const tableTop = yPosition;
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('', 30, tableTop) // Espacio para imagen
        .text('Descripción', 80, tableTop)
        .text('Cantidad', 300, tableTop)
        .text('Precio Unit.', 360, tableTop)
        .text('Subtotal', 460, tableTop);

      // Línea bajo headers
      doc.moveTo(30, tableTop + 12)
        .lineTo(565, tableTop + 12)
        .stroke();

      yPosition = tableTop + 20;

      // Filas de productos
      doc.fontSize(9)
        .font('Helvetica');

      const ROW_HEIGHT_WITH_IMG = 50;
      const ROW_HEIGHT_NO_IMG = 25;
      const IMG_SIZE = 40;

      for (const producto of datos.productos) {
        const hasImage = imageMap.has(producto.id);
        const rowHeight = hasImage ? ROW_HEIGHT_WITH_IMG : ROW_HEIGHT_NO_IMG;

        // Verificar si hay espacio en la página
        if (yPosition + rowHeight > 700) {
          doc.addPage();
          yPosition = 30;
        }

        const currentY = yPosition;
        const textY = hasImage ? currentY + (IMG_SIZE - 12) / 2 : currentY;

        // Imagen del producto
        if (hasImage) {
          try {
            const imgBuffer = imageMap.get(producto.id)!;
            doc.image(imgBuffer, 30, currentY, { 
              width: IMG_SIZE, 
              height: IMG_SIZE,
              fit: [IMG_SIZE, IMG_SIZE]
            });
          } catch (imgErr) {
            console.warn('⚠️ Error insertando imagen en PDF:', imgErr);
          }
        }

        // Nombre del producto
        let nombreProducto = producto.nombre;
        if (producto.talla) {
          nombreProducto += ` (Talla: ${producto.talla})`;
        }
        doc.text(nombreProducto, 80, textY, { width: 210 });

        // Cantidad
        doc.text(String(producto.cantidad), 300, textY);

        // Precio unitario
        doc.text(`€${producto.precio_unitario.toFixed(2)}`, 360, textY);

        // Subtotal
        doc.text(`€${producto.subtotal.toFixed(2)}`, 460, textY);

        yPosition += rowHeight + 5;
      }

      // Línea separadora antes de totales
      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== TOTALES =====
      doc.fontSize(10)
        .font('Helvetica');

      const totalLabelX = 350;
      const totalValueX = 450;
      const multiplicador = datos.esReembolso ? -1 : 1;
      const colorReembolso = datos.esReembolso ? '#ff4444' : '#000000';

      // Subtotal
      if (datos.esReembolso) {
        doc.fillColor(colorReembolso);
      }
      doc.text('Subtotal:', totalLabelX, yPosition)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.subtotal).toFixed(2)}`, totalValueX, yPosition);

      // Envío
      yPosition += 20;
      doc.text('Gastos de envío:', totalLabelX, yPosition)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.envio).toFixed(2)}`, totalValueX, yPosition);

      // Descuento
      if (datos.descuento > 0) {
        yPosition += 20;
        if (!datos.esReembolso) {
          doc.text('Descuento:', totalLabelX, yPosition)
            .text(`-€ ${datos.descuento.toFixed(2)}`, totalValueX, yPosition);
        }
      }

      // Total
      yPosition += 25;
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(datos.esReembolso ? 'REEMBOLSO:' : 'TOTAL:', totalLabelX - 30, yPosition)
        .fontSize(14)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.total).toFixed(2)}`, totalValueX, yPosition);

      // Restaurar color si fue modificado
      if (datos.esReembolso) {
        doc.fillColor('#000000');
      }

      // ===== FOOTER =====
      yPosition = 740;

      doc.fontSize(9)
        .font('Helvetica')
        .text('Gracias por tu compra. Todos nuestros productos están garantizados.', 30, yPosition)
        .text('Si tienes dudas, contacta con nosotros.', 30, yPosition + 15);

      yPosition += 35;

      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      doc.fontSize(8)
        .text('© 2026 Joyería Galiana. Todos los derechos reservados.', 30, yPosition + 10, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
  
  // Agregar timeout para evitar cuelgues de PDF
  const timeoutPromise = new Promise<Buffer>((_, reject) => {
    setTimeout(() => reject(new Error('PDF generation timeout after ' + TIMEOUT_MS + 'ms')), TIMEOUT_MS);
  });
  
  return Promise.race([pdfPromise, timeoutPromise]);
}

/**
 * Obtiene los datos del producto desde Supabase
 */
export async function obtenerDatosProducto(productId: string) {
  try {
    const { data, error } = await supabase!
      .from('products')
      .select('id, nombre, precio, imagen_url, referencia')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in obtenerDatosProducto:', error);
    return null;
  }
}

/**
 * Genera un PDF de factura de devolución
 */
export async function generateRefundInvoicePDF(datos: DatosFactura): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30
      });

      const buffers: Buffer[] = [];

      doc.on('data', (chunk: any) => {
        buffers.push(chunk as Buffer);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.on('error', (error: any) => {
        reject(error);
      });

      // ===== HEADER CON LOGO =====
      try {
        const logoPath = path.resolve('public/images/logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 30, 30, { width: 80, height: 80 });
        }
      } catch (logoErr) {
        console.warn('⚠️ No se pudo cargar el logo:', logoErr);
      }

      doc.fontSize(18)
        .font('Helvetica-Bold')
        .text('NOTA DE DEVOLUCIÓN', 120, 35, { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .text('Factura de devolución y reembolso', 120, 60, { align: 'center' });

      // ===== INFORMACIÓN BÁSICA =====
      let yPosition = 120;

      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Información del Documento', 30, yPosition);

      yPosition += 20;

      const infoItems = [
        { label: 'Número:', value: datos.numero_pedido },
        { label: 'Fecha de Devolución:', value: datos.fecha.toLocaleDateString('es-ES') },
        { label: 'Cliente:', value: datos.cliente.nombre }
      ];

      doc.fontSize(9).font('Helvetica');
      infoItems.forEach((item) => {
        doc.text(`${item.label} ${item.value}`, 30, yPosition);
        yPosition += 15;
      });

      yPosition += 10;

      // ===== TABLA DE PRODUCTOS =====
      // Pre-descargar todas las imágenes de productos
      const imageMap = await preloadProductImages(datos.productos);

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('PRODUCTOS DEVUELTOS', 30, yPosition);

      yPosition += 25;

      const tableTop = yPosition;
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('', 30, tableTop) // Espacio para imagen
        .text('Descripción', 80, tableTop)
        .text('Cantidad', 300, tableTop)
        .text('Precio Unit.', 360, tableTop)
        .text('Subtotal', 460, tableTop);

      doc.moveTo(30, tableTop + 12)
        .lineTo(565, tableTop + 12)
        .stroke();

      yPosition = tableTop + 20;
      doc.fontSize(9).font('Helvetica');

      const ROW_HEIGHT_WITH_IMG = 50;
      const ROW_HEIGHT_NO_IMG = 25;
      const IMG_SIZE = 40;

      for (const producto of datos.productos) {
        const hasImage = imageMap.has(producto.id);
        const rowHeight = hasImage ? ROW_HEIGHT_WITH_IMG : ROW_HEIGHT_NO_IMG;

        if (yPosition + rowHeight > 700) {
          doc.addPage();
          yPosition = 30;
        }

        const currentY = yPosition;
        const textY = hasImage ? currentY + (IMG_SIZE - 12) / 2 : currentY;

        // Imagen del producto
        if (hasImage) {
          try {
            const imgBuffer = imageMap.get(producto.id)!;
            doc.image(imgBuffer, 30, currentY, { 
              width: IMG_SIZE, 
              height: IMG_SIZE,
              fit: [IMG_SIZE, IMG_SIZE]
            });
          } catch (imgErr) {
            console.warn('⚠️ Error insertando imagen en PDF:', imgErr);
          }
        }

        let nombreProducto = producto.nombre;
        if (producto.talla) {
          nombreProducto += ` (Talla: ${producto.talla})`;
        }
        doc.text(nombreProducto, 80, textY, { width: 210 });
        doc.text(String(producto.cantidad), 300, textY);
        doc.text(`€${producto.precio_unitario.toFixed(2)}`, 360, textY);
        doc.text(`€${producto.subtotal.toFixed(2)}`, 460, textY);

        yPosition += rowHeight + 5;
      }

      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== RESUMEN FINANCIERO =====
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('RESUMEN DE REEMBOLSO', 30, yPosition);

      yPosition += 25;

      const summaryItems = [
        { label: 'Subtotal Devuelto:', value: `€ ${datos.subtotal.toFixed(2)}` },
        { label: 'Envío:', value: `€ ${datos.envio.toFixed(2)}` }
      ];

      doc.fontSize(9).font('Helvetica');
      summaryItems.forEach((item) => {
        doc.text(item.label, 30, yPosition);
        doc.text(item.value, 450, yPosition, { align: 'right' });
        yPosition += 20;
      });

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('TOTAL A REEMBOLSAR:', 30, yPosition);

      doc.text(`€ ${datos.total.toFixed(2)}`, 450, yPosition, { align: 'right' });

      yPosition += 40;

      // ===== NOTAS IMPORTANTES =====
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('INFORMACIÓN IMPORTANTE', 30, yPosition);

      yPosition += 20;

      const notasTexto = [
        '• Este documento confirma la devolución de los productos listados arriba.',
        '• El reembolso se procesará en los próximos 5-10 días hábiles a tu método de pago original.',
        '• Por cualquier pregunta, no dudes en contactarnos a info@joyeriagaliana.com',
        '• Consulta nuestra política de devoluciones en www.joyeriagaliana.com'
      ];

      doc.fontSize(8).font('Helvetica');
      notasTexto.forEach((nota) => {
        doc.text(nota, 30, yPosition, { width: 500 });
        yPosition += 15;
      });

      yPosition += 20;

      // ===== FOOTER =====
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Joyería Galiana', 30, yPosition, { align: 'center' })
        .fontSize(8)
        .font('Helvetica')
        .text('Sanlúcar de Barrameda, España | info@joyeriagaliana.com', 30, yPosition + 20, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
