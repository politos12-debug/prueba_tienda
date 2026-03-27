// =============================================
// subcategoria.js — Página de subcategoría
// URL: /categoria/{slug}/{subcategoria-slug}
// =============================================

let subcatCategoriaSlug = '';
let subcatCategoriaNombre = '';
let subcatSubcategoriaSlug = '';
let subcatSubcategoriaNombre = '';
let subcatSubcategoriaId = null;
let subcatProductos = [];
let ordenamientoActualSubcat = 'relevancia';
let precioMinGlobalSubcat = 0;
let precioMaxGlobalSubcat = 5000;

let filtrosAplicadosSubcat = {
    precioMin: 0,
    precioMax: 5000,
    soloOfertas: false
};

// Generar slug a partir de un nombre
function slugifySubcat(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// ========== MODALES ==========

function abrirModalFiltros() {
    var overlay = document.getElementById('modal-filtros-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    document.body.style.overflow = 'hidden';
}

function cerrarModalFiltros() {
    var overlay = document.getElementById('modal-filtros-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(function() { overlay.style.display = 'none'; }, 350);
    document.body.style.overflow = '';
}

function abrirModalOrden() {
    var overlay = document.getElementById('modal-orden-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    document.body.style.overflow = 'hidden';
}

function cerrarModalOrden() {
    var overlay = document.getElementById('modal-orden-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(function() { overlay.style.display = 'none'; }, 350);
    document.body.style.overflow = '';
}

// ========== RANGO DE PRECIOS ==========

function inicializarRangoPreciosSubcat() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    if (!minRange || !maxRange) return;

    if (subcatProductos.length > 0) {
        var precios = subcatProductos.map(function(p) {
            return p.descuento_oferta > 0 ? p.precio * (1 - p.descuento_oferta / 100) : p.precio;
        });
        precioMinGlobalSubcat = 0;
        precioMaxGlobalSubcat = Math.ceil(Math.max.apply(null, precios) / 10) * 10;

        minRange.min = precioMinGlobalSubcat;
        minRange.max = precioMaxGlobalSubcat;
        maxRange.min = precioMinGlobalSubcat;
        maxRange.max = precioMaxGlobalSubcat;

        minRange.value = filtrosAplicadosSubcat.precioMin || precioMinGlobalSubcat;
        maxRange.value = filtrosAplicadosSubcat.precioMax || precioMaxGlobalSubcat;

        filtrosAplicadosSubcat.precioMin = precioMinGlobalSubcat;
        filtrosAplicadosSubcat.precioMax = precioMaxGlobalSubcat;
    }

    actualizarDisplayPreciosSubcat();
    actualizarTrackPreciosSubcat();

    minRange.addEventListener('input', function() {
        if (parseInt(minRange.value) > parseInt(maxRange.value) - 10) {
            minRange.value = parseInt(maxRange.value) - 10;
        }
        actualizarDisplayPreciosSubcat();
        actualizarTrackPreciosSubcat();
    });

    maxRange.addEventListener('input', function() {
        if (parseInt(maxRange.value) < parseInt(minRange.value) + 10) {
            maxRange.value = parseInt(minRange.value) + 10;
        }
        actualizarDisplayPreciosSubcat();
        actualizarTrackPreciosSubcat();
    });
}

function actualizarDisplayPreciosSubcat() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var minDisplay = document.getElementById('precio-min-display');
    var maxDisplay = document.getElementById('precio-max-display');
    if (!minRange || !maxRange || !minDisplay || !maxDisplay) return;

    minDisplay.textContent = parseInt(minRange.value).toLocaleString('es-ES') + ' \u20ac';
    maxDisplay.textContent = parseInt(maxRange.value).toLocaleString('es-ES') + ' \u20ac';
}

function actualizarTrackPreciosSubcat() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var track = document.getElementById('range-track');
    if (!minRange || !maxRange || !track) return;

    var min = parseInt(minRange.min);
    var max = parseInt(minRange.max);
    var minVal = parseInt(minRange.value);
    var maxVal = parseInt(maxRange.value);

    var leftPct = ((minVal - min) / (max - min)) * 100;
    var rightPct = ((maxVal - min) / (max - min)) * 100;
    track.style.cssText = 'position:absolute;top:50%;left:0;right:0;height:4px;background:#e8e0d0;border-radius:4px;transform:translateY(-50%);';
    track.innerHTML = '<div style="position:absolute;top:0;height:100%;left:' + leftPct + '%;right:' + (100 - rightPct) + '%;background:linear-gradient(90deg,#d4af37,#c9a232);border-radius:4px;"></div>';
}

// ========== APLICAR / LIMPIAR FILTROS ==========

function aplicarFiltrosDesdeModalSubcat() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var soloOfertas = document.getElementById('filtro-solo-ofertas');

    filtrosAplicadosSubcat.precioMin = minRange ? parseInt(minRange.value) : precioMinGlobalSubcat;
    filtrosAplicadosSubcat.precioMax = maxRange ? parseInt(maxRange.value) : precioMaxGlobalSubcat;
    filtrosAplicadosSubcat.soloOfertas = soloOfertas ? soloOfertas.checked : false;

    cerrarModalFiltros();
    aplicarFiltrosYMostrarSubcat();
    actualizarFiltrosActivosUISubcat();
}

function limpiarTodosFiltrosSubcat() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var soloOfertas = document.getElementById('filtro-solo-ofertas');

    if (minRange) minRange.value = precioMinGlobalSubcat;
    if (maxRange) maxRange.value = precioMaxGlobalSubcat;
    if (soloOfertas) soloOfertas.checked = false;

    filtrosAplicadosSubcat = {
        precioMin: precioMinGlobalSubcat,
        precioMax: precioMaxGlobalSubcat,
        soloOfertas: false
    };

    actualizarDisplayPreciosSubcat();
    actualizarTrackPreciosSubcat();
}

function aplicarFiltrosYMostrarSubcat() {
    var productos = subcatProductos.slice();

    // Filtro por precio
    productos = productos.filter(function(p) {
        var precioFinal = p.descuento_oferta > 0 ? p.precio * (1 - p.descuento_oferta / 100) : p.precio;
        return precioFinal >= filtrosAplicadosSubcat.precioMin && precioFinal <= filtrosAplicadosSubcat.precioMax;
    });

    // Filtro solo ofertas
    if (filtrosAplicadosSubcat.soloOfertas) {
        productos = productos.filter(function(p) { return p.descuento_oferta && p.descuento_oferta > 0; });
    }

    // Aplicar ordenamiento
    productos = aplicarOrdenamientoAProductosSubcat(productos);

    renderizarProductosSubcat(productos);

    var countEl = document.getElementById('resultados-count');
    if (countEl) {
        countEl.textContent = productos.length + (productos.length === 1 ? ' producto' : ' productos');
    }
}

function aplicarOrdenamientoAProductosSubcat(productos) {
    var copia = productos.slice();
    switch (ordenamientoActualSubcat) {
        case 'a-z':
            copia.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
            break;
        case 'z-a':
            copia.sort(function(a, b) { return b.nombre.localeCompare(a.nombre); });
            break;
        case 'precio-menor':
            copia.sort(function(a, b) { return a.precio - b.precio; });
            break;
        case 'precio-mayor':
            copia.sort(function(a, b) { return b.precio - a.precio; });
            break;
        case 'relevancia':
        default:
            copia.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }
    return copia;
}

function contarFiltrosActivosSubcat() {
    var count = 0;
    if (filtrosAplicadosSubcat.precioMin > precioMinGlobalSubcat || filtrosAplicadosSubcat.precioMax < precioMaxGlobalSubcat) count++;
    if (filtrosAplicadosSubcat.soloOfertas) count++;
    return count;
}

function actualizarFiltrosActivosUISubcat() {
    var count = contarFiltrosActivosSubcat();

    var badge = document.getElementById('filtros-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    var inlineBadge = document.getElementById('filtros-count-inline');
    if (inlineBadge) {
        inlineBadge.textContent = count;
        inlineBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    var btnLimpiar = document.getElementById('btn-limpiar-toolbar');
    if (btnLimpiar) {
        btnLimpiar.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

function inicializarEventosModalesSubcat() {
    var btnAbrir = document.getElementById('btn-abrir-filtros');
    var btnCerrar = document.getElementById('btn-cerrar-filtros');
    var btnAplicar = document.getElementById('btn-aplicar-filtros');
    var btnLimpiarModal = document.getElementById('btn-limpiar-filtros');
    var btnLimpiarToolbar = document.getElementById('btn-limpiar-toolbar');
    var btnAbrirOrden = document.getElementById('btn-abrir-orden');
    var btnCerrarOrden = document.getElementById('btn-cerrar-orden');
    var overlayFiltros = document.getElementById('modal-filtros-overlay');
    var overlayOrden = document.getElementById('modal-orden-overlay');

    if (btnAbrir) btnAbrir.addEventListener('click', abrirModalFiltros);
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalFiltros);
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltrosDesdeModalSubcat);
    if (btnLimpiarModal) btnLimpiarModal.addEventListener('click', function() {
        limpiarTodosFiltrosSubcat();
        aplicarFiltrosDesdeModalSubcat();
    });
    if (btnLimpiarToolbar) btnLimpiarToolbar.addEventListener('click', function() {
        limpiarTodosFiltrosSubcat();
        aplicarFiltrosYMostrarSubcat();
        actualizarFiltrosActivosUISubcat();
    });
    if (btnAbrirOrden) btnAbrirOrden.addEventListener('click', abrirModalOrden);
    if (btnCerrarOrden) btnCerrarOrden.addEventListener('click', cerrarModalOrden);

    if (overlayFiltros) overlayFiltros.addEventListener('click', function(e) {
        if (e.target === overlayFiltros) cerrarModalFiltros();
    });
    if (overlayOrden) overlayOrden.addEventListener('click', function(e) {
        if (e.target === overlayOrden) cerrarModalOrden();
    });

    // Orden radios
    document.querySelectorAll('.orden-opcion input[name="ordenamiento"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.orden-opcion').forEach(function(op) { op.classList.remove('active'); });
            radio.closest('.orden-opcion').classList.add('active');
            ordenamientoActualSubcat = radio.value;
            cerrarModalOrden();
            aplicarFiltrosYMostrarSubcat();
        });
    });
}

// Cargar datos de la subcategoría
async function cargarSubcategoria() {
    subcatCategoriaSlug = window.__categoriaSlug || '';
    subcatSubcategoriaSlug = window.__subcategoriaSlug || '';

    if (!subcatCategoriaSlug || !subcatSubcategoriaSlug) {
        console.error('No se encontraron los slugs');
        return;
    }

    // Esperar a que Supabase esté listo
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) {
        console.error('Supabase no se inicializó');
        return;
    }

    try {
        // 1. Buscar la categoría por slug
        const { data: categoriaData } = await window.supabaseClient
            .from('categorias_tienda')
            .select('*')
            .eq('slug', subcatCategoriaSlug)
            .single();

        if (!categoriaData) {
            document.getElementById('sin-productos').style.display = 'block';
            return;
        }

        subcatCategoriaNombre = categoriaData.nombre;

        // 2. Buscar todas las subcategorías de esta categoría
        const { data: subcategorias } = await window.supabaseClient
            .from('subcategorias')
            .select('id, nombre')
            .ilike('categoria', subcatCategoriaNombre)
            .order('nombre', { ascending: true });

        if (!subcategorias || subcategorias.length === 0) {
            document.getElementById('sin-productos').style.display = 'block';
            return;
        }

        // 3. Encontrar la subcategoría que coincide con el slug
        var subcatEncontrada = subcategorias.find(function (s) {
            return slugifySubcat(s.nombre) === subcatSubcategoriaSlug;
        });

        if (!subcatEncontrada) {
            document.getElementById('sin-productos').style.display = 'block';
            return;
        }

        subcatSubcategoriaNombre = subcatEncontrada.nombre;
        subcatSubcategoriaId = subcatEncontrada.id;

        // 4. Cargar productos de esta subcategoría
        const { data: productos, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', subcatCategoriaNombre)
            .eq('subcategoria_id', subcatSubcategoriaId)
            .eq('activo', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error cargando productos:', error);
            return;
        }

        subcatProductos = productos || [];

        // Registrar productos para sincronización de stock
        if (typeof window.registrarProductosParaSync === 'function') {
            window.registrarProductosParaSync(subcatProductos);
        }

        // 5. Actualizar UI
        document.getElementById('subcategoria-titulo').textContent = subcatSubcategoriaNombre;
        document.getElementById('subcategoria-desc').textContent =
            'Explora nuestra selección de ' + subcatSubcategoriaNombre.toLowerCase() + ' en ' + subcatCategoriaNombre.toLowerCase();

        // Breadcrumbs
        var breadcrumbCatLink = document.getElementById('breadcrumb-categoria-link');
        if (breadcrumbCatLink) {
            breadcrumbCatLink.href = '/categoria/' + subcatCategoriaSlug;
            breadcrumbCatLink.textContent = subcatCategoriaNombre;
        }

        var breadcrumbSubcat = document.getElementById('breadcrumb-subcategoria');
        if (breadcrumbSubcat) breadcrumbSubcat.textContent = subcatSubcategoriaNombre;

        // Link de volver
        var volverLink = document.getElementById('volver-categoria');
        if (volverLink) volverLink.href = '/categoria/' + subcatCategoriaSlug;

        renderizarProductosSubcat(subcatProductos);
        updateCartCountSubcat();

        inicializarRangoPreciosSubcat();
        inicializarEventosModalesSubcat();
        aplicarFiltrosYMostrarSubcat();
        actualizarFiltrosActivosUISubcat();

    } catch (err) {
        console.error('Error:', err);
    }
}

// Renderizar productos (estilo unificado con página de productos)
function renderizarProductosSubcat(productos) {
    var grid = document.getElementById('productos-grid');
    var sinProductos = document.getElementById('sin-productos');

    if (productos.length === 0) {
        grid.style.display = 'none';
        sinProductos.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    sinProductos.style.display = 'none';
    grid.innerHTML = '';

    productos.forEach(function (producto) {
        var imagenURL = '';
        try {
            var imagenes = Array.isArray(producto.imagen_url)
                ? producto.imagen_url
                : JSON.parse(producto.imagen_url || '[]');
            imagenURL = imagenes[0] || '';
        } catch (e) {
            if (producto.imagen_url && producto.imagen_url.startsWith('http')) {
                imagenURL = producto.imagen_url;
            }
        }

        var precioFinal = producto.descuento_oferta > 0
            ? producto.precio * (1 - producto.descuento_oferta / 100)
            : producto.precio;

        var badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? '<div class="oferta-badge">-' + producto.descuento_oferta + '%</div>'
            : '';

        var precioHTML = '€' + parseFloat(producto.precio).toFixed(2);
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            precioHTML =
                '<span style="text-decoration: line-through;color: #888;font-size:0.85em;">€' + parseFloat(producto.precio).toFixed(2) + '</span> ' +
                '<span style="font-weight:bold;color:#d4af37;font-size:1.1em;">€' + precioFinal.toFixed(2) + '</span>';
        }

        var hayStock = producto.stock > 0;
        var stockClass = hayStock ? '' : 'sin-stock';
        var btnDisabled = hayStock ? '' : 'disabled';
        var btnText = hayStock ? 'Agregar al carrito' : 'Agotado';

        var card = document.createElement('div');
        card.className = 'producto-card';
        card.style.cursor = 'pointer';

        card.innerHTML =
            badgeOferta +
            '<img src="' + (imagenURL || 'https://via.placeholder.com/250x200?text=Producto') + '" alt="' + producto.nombre + '" style="width:100%;height:200px;object-fit:cover;' + (!hayStock ? 'opacity:0.5;' : '') + '">' +
            (!hayStock ? '<div class="stock-indicator">Agotado</div>' : '') +
            '<h3>' + producto.nombre + '</h3>' +
            '<div class="precio">' + precioHTML + '</div>' +
            '<button class="btn-agregar ' + stockClass + '" data-producto-id="' + producto.id + '" data-producto-nombre="' + producto.nombre + '" data-producto-precio="' + precioFinal + '" data-producto-imagen="' + imagenURL + '" ' + btnDisabled + '>' + btnText + '</button>';

        // Click en botón agregar
        var btnAgregar = card.querySelector('.btn-agregar');
        if (btnAgregar && hayStock) {
            btnAgregar.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var item = {
                    id: parseInt(this.dataset.productoId),
                    nombre: this.dataset.productoNombre,
                    precio: parseFloat(this.dataset.productoPrecio),
                    imagen: this.dataset.productoImagen
                };
                window.agregarAlCarritoSubcat(item);
            });
        }

        // Click en la tarjeta → ir al detalle
        card.addEventListener('click', function (e) {
            if (e.target.classList.contains('btn-agregar') || e.target.closest('.btn-agregar')) {
                return;
            }
            window.location.href = '/productos/' + producto.id;
        });

        grid.appendChild(card);
    });
}

// Aplicar filtros de ordenamiento — ahora usa modales
function aplicarFiltrosSubcat() {
    aplicarFiltrosYMostrarSubcat();
}

// Agregar al carrito
window.agregarAlCarritoSubcat = function (producto) {
    var productoEnBD = subcatProductos.find(function (p) { return p.id === producto.id; });
    if (!productoEnBD) {
        mostrarMensajeErrorStockSubcat('Producto no encontrado');
        return;
    }

    if (productoEnBD.categoria === 'Anillos') {
        if (typeof abrirModalSeleccionarTalla === 'function') {
            abrirModalSeleccionarTalla(productoEnBD);
        }
        return;
    }

    validarYAgregarSubcat(producto);
};

async function validarYAgregarSubcat(producto) {
    try {
        var response = await fetch('/api/add-to-cart-validated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: producto.id, cantidad: 1 })
        });

        var data = await response.json();

        if (!response.ok) {
            mostrarMensajeErrorStockSubcat(data.error || 'Error al agregar al carrito');
            if (data.stockDisponible >= 0) {
                var p = subcatProductos.find(function (x) { return x.id === producto.id; });
                if (p) {
                    p.stock = data.stockDisponible;
                    renderizarProductosSubcat(subcatProductos);
                }
            }
            return;
        }

        var cart = JSON.parse(localStorage.getItem('carrito') || '[]');
        var item = {
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            imagen: producto.imagen || '',
            tiempoAgregado: Date.now()
        };

        var existingItem = cart.find(function (i) { return i.id === item.id; });
        if (existingItem) {
            existingItem.cantidad += 1;
        } else {
            cart.push(item);
        }

        localStorage.setItem('carrito', JSON.stringify(cart));
        updateCartCountSubcat();

        var productoEnBD = subcatProductos.find(function (x) { return x.id === producto.id; });
        if (productoEnBD) {
            productoEnBD.stock = data.producto.stockDisponible;
            renderizarProductosSubcat(subcatProductos);
        }

        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(function () { window.forzarActualizacionStock(); }, 100);
        }

        if (typeof openCartSlide === 'function') {
            setTimeout(function () { openCartSlide(); }, 100);
        }

    } catch (err) {
        console.error('Error validando carrito:', err);
        mostrarMensajeErrorStockSubcat('Error al agregar al carrito');
    }
}

function mostrarMensajeErrorStockSubcat(mensaje) {
    var errorDiv = document.getElementById('error-stock-subcat');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-subcat';
        errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background-color:#c00;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:1000;font-size:14px;max-width:400px;';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    setTimeout(function () { errorDiv.style.display = 'none'; }, 3000);
}

function updateCartCountSubcat() {
    var carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    var count = carrito.reduce(function (total, item) { return total + item.cantidad; }, 0);
    var el = document.getElementById('cart-count');
    if (el) el.textContent = count;
}

// Iniciar
document.addEventListener('DOMContentLoaded', function () {
    var intentos = 0;
    function iniciar() {
        if (window.supabaseClient) {
            cargarSubcategoria();
            updateCartCountSubcat();
        } else if (intentos < 50) {
            intentos++;
            setTimeout(iniciar, 100);
        }
    }
    setTimeout(iniciar, 300);
});
