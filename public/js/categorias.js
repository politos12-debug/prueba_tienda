// =============================================
// categorias.js — Página de categoría individual
// URL: /categoria/{slug}
// =============================================

let categoriaActual = '';
let categoriaNombre = '';
let categoriaSlugActual = '';
let productosActuales = [];
let subcategoriaSeleccionada = null;
let ordenamientoActual = 'relevancia';
let precioMinGlobal = 0;
let precioMaxGlobal = 5000;

let filtrosAplicados = {
    precioMin: 0,
    precioMax: 5000,
    soloOfertas: false
};

// Generar slug a partir de un nombre
function slugify(text) {
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

function inicializarRangoPrecios() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    if (!minRange || !maxRange) return;

    if (productosActuales.length > 0) {
        var precios = productosActuales.map(function(p) {
            return p.descuento_oferta > 0 ? p.precio * (1 - p.descuento_oferta / 100) : p.precio;
        });
        precioMinGlobal = 0;
        precioMaxGlobal = Math.ceil(Math.max.apply(null, precios) / 10) * 10;

        minRange.min = precioMinGlobal;
        minRange.max = precioMaxGlobal;
        maxRange.min = precioMinGlobal;
        maxRange.max = precioMaxGlobal;

        minRange.value = filtrosAplicados.precioMin || precioMinGlobal;
        maxRange.value = filtrosAplicados.precioMax || precioMaxGlobal;

        filtrosAplicados.precioMin = precioMinGlobal;
        filtrosAplicados.precioMax = precioMaxGlobal;
    }

    actualizarDisplayPrecios();
    actualizarTrackPrecios();

    minRange.addEventListener('input', function() {
        if (parseInt(minRange.value) > parseInt(maxRange.value) - 10) {
            minRange.value = parseInt(maxRange.value) - 10;
        }
        actualizarDisplayPrecios();
        actualizarTrackPrecios();
    });

    maxRange.addEventListener('input', function() {
        if (parseInt(maxRange.value) < parseInt(minRange.value) + 10) {
            maxRange.value = parseInt(minRange.value) + 10;
        }
        actualizarDisplayPrecios();
        actualizarTrackPrecios();
    });
}

function actualizarDisplayPrecios() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var minDisplay = document.getElementById('precio-min-display');
    var maxDisplay = document.getElementById('precio-max-display');
    if (!minRange || !maxRange || !minDisplay || !maxDisplay) return;

    minDisplay.textContent = parseInt(minRange.value).toLocaleString('es-ES') + ' \u20ac';
    maxDisplay.textContent = parseInt(maxRange.value).toLocaleString('es-ES') + ' \u20ac';
}

function actualizarTrackPrecios() {
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

function aplicarFiltrosDesdeModal() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var soloOfertas = document.getElementById('filtro-solo-ofertas');

    filtrosAplicados.precioMin = minRange ? parseInt(minRange.value) : precioMinGlobal;
    filtrosAplicados.precioMax = maxRange ? parseInt(maxRange.value) : precioMaxGlobal;
    filtrosAplicados.soloOfertas = soloOfertas ? soloOfertas.checked : false;

    cerrarModalFiltros();
    aplicarFiltrosYMostrar();
    actualizarFiltrosActivosUI();
}

function limpiarTodosFiltros() {
    var minRange = document.getElementById('precio-min-range');
    var maxRange = document.getElementById('precio-max-range');
    var soloOfertas = document.getElementById('filtro-solo-ofertas');

    if (minRange) minRange.value = precioMinGlobal;
    if (maxRange) maxRange.value = precioMaxGlobal;
    if (soloOfertas) soloOfertas.checked = false;

    filtrosAplicados = {
        precioMin: precioMinGlobal,
        precioMax: precioMaxGlobal,
        soloOfertas: false
    };

    actualizarDisplayPrecios();
    actualizarTrackPrecios();
}

function aplicarFiltrosYMostrar() {
    var productos = productosActuales.slice();

    // Filtro por subcategoría
    if (subcategoriaSeleccionada) {
        productos = productos.filter(function(p) {
            return p.subcategoria_id === subcategoriaSeleccionada;
        });
    }

    // Filtro por precio
    productos = productos.filter(function(p) {
        var precioFinal = p.descuento_oferta > 0 ? p.precio * (1 - p.descuento_oferta / 100) : p.precio;
        return precioFinal >= filtrosAplicados.precioMin && precioFinal <= filtrosAplicados.precioMax;
    });

    // Filtro solo ofertas
    if (filtrosAplicados.soloOfertas) {
        productos = productos.filter(function(p) { return p.descuento_oferta && p.descuento_oferta > 0; });
    }

    // Aplicar ordenamiento
    productos = aplicarOrdenamientoAProductos(productos);

    renderizarProductos(productos);

    var countEl = document.getElementById('resultados-count');
    if (countEl) {
        countEl.textContent = productos.length + (productos.length === 1 ? ' producto' : ' productos');
    }
}

function aplicarOrdenamientoAProductos(productos) {
    var copia = productos.slice();
    switch (ordenamientoActual) {
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

function contarFiltrosActivos() {
    var count = 0;
    if (filtrosAplicados.precioMin > precioMinGlobal || filtrosAplicados.precioMax < precioMaxGlobal) count++;
    if (filtrosAplicados.soloOfertas) count++;
    return count;
}

function actualizarFiltrosActivosUI() {
    var count = contarFiltrosActivos();

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

function inicializarEventosModales() {
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
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltrosDesdeModal);
    if (btnLimpiarModal) btnLimpiarModal.addEventListener('click', function() {
        limpiarTodosFiltros();
        aplicarFiltrosDesdeModal();
    });
    if (btnLimpiarToolbar) btnLimpiarToolbar.addEventListener('click', function() {
        limpiarTodosFiltros();
        aplicarFiltrosYMostrar();
        actualizarFiltrosActivosUI();
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
            ordenamientoActual = radio.value;
            cerrarModalOrden();
            aplicarFiltrosYMostrar();
        });
    });
}

// Cargar categoría desde el slug de la URL
async function cargarCategoria() {
    categoriaSlugActual = window.__categoriaSlug || '';

    if (!categoriaSlugActual) {
        console.error('No se encontró slug de categoría');
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
        // Buscar la categoría por slug
        const { data: categoriaData, error: catError } = await window.supabaseClient
            .from('categorias_tienda')
            .select('*')
            .eq('slug', categoriaSlugActual)
            .single();

        if (catError || !categoriaData) {
            // Fallback: buscar por nombre (compatibilidad con URLs antiguas)
            const { data: catFallback } = await window.supabaseClient
                .from('categorias_tienda')
                .select('*')
                .ilike('nombre', categoriaSlugActual)
                .single();

            if (!catFallback) {
                document.getElementById('sin-productos').style.display = 'block';
                return;
            }
            categoriaNombre = catFallback.nombre;
            categoriaSlugActual = catFallback.slug;
        } else {
            categoriaNombre = categoriaData.nombre;
        }

        categoriaActual = categoriaNombre;

        // Cargar productos de esta categoría
        const { data: productos, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', categoriaNombre)
            .eq('activo', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error cargando productos:', error);
            return;
        }

        productosActuales = productos || [];

        // Registrar productos para sincronización de stock
        if (typeof window.registrarProductosParaSync === 'function') {
            window.registrarProductosParaSync(productosActuales);
        }

        // Actualizar título y breadcrumbs
        document.getElementById('categoria-titulo').textContent = categoriaNombre;
        document.getElementById('categoria-desc').textContent = 'Descubre nuestra colección de ' + categoriaNombre.toLowerCase();

        var breadcrumbCat = document.getElementById('breadcrumb-categoria');
        if (breadcrumbCat) breadcrumbCat.textContent = categoriaNombre;

        // Cargar subcategorías como enlaces y como filtros
        await cargarSubcategorias();

        inicializarRangoPrecios();
        inicializarEventosModales();
        aplicarFiltrosYMostrar();
        actualizarFiltrosActivosUI();
        updateCartCount();

    } catch (err) {
        console.error('Error:', err);
    }
}

// Cargar subcategorías — como enlaces de navegación y como filtros
async function cargarSubcategorias() {
    const contenedorFiltro = document.getElementById('filtro-subcategoria');
    const contenedorNav = document.getElementById('subcategorias-links');
    const navWrapper = document.getElementById('subcategorias-nav');

    try {
        const { data, error } = await window.supabaseClient
            .from('subcategorias')
            .select('id, nombre')
            .ilike('categoria', categoriaActual)
            .order('nombre', { ascending: true });

        if (error) {
            console.error('Error cargando subcategorías:', error);
            return;
        }

        if (data && data.length > 0) {
            // --- Navegación de subcategorías (enlaces) ---
            if (contenedorNav && navWrapper) {
                contenedorNav.innerHTML = '';
                data.forEach(function (sub) {
                    var link = document.createElement('a');
                    link.href = '/categoria/' + categoriaSlugActual + '/' + slugify(sub.nombre);
                    link.className = 'subcategoria-link';
                    link.textContent = sub.nombre;
                    contenedorNav.appendChild(link);
                });
                navWrapper.style.display = '';
            }

            // --- Filtros de subcategoría (botones) ---
            if (contenedorFiltro) {
                contenedorFiltro.innerHTML = '';

                // Botón "Ver Todos"
                var btnTodos = document.createElement('button');
                btnTodos.className = 'subcategoria-btn active';
                btnTodos.textContent = 'Ver Todos';
                btnTodos.onclick = function () {
                    subcategoriaSeleccionada = null;
                    document.querySelectorAll('.subcategoria-btn').forEach(function (b) { b.classList.remove('active'); });
                    btnTodos.classList.add('active');
                    filtrarPorSubcategoria();
                };
                contenedorFiltro.appendChild(btnTodos);

                data.forEach(function (sub) {
                    var btn = document.createElement('button');
                    btn.className = 'subcategoria-btn';
                    btn.textContent = sub.nombre;
                    btn.onclick = function () {
                        subcategoriaSeleccionada = sub.id;
                        document.querySelectorAll('.subcategoria-btn').forEach(function (b) { b.classList.remove('active'); });
                        btn.classList.add('active');
                        filtrarPorSubcategoria();
                    };
                    contenedorFiltro.appendChild(btn);
                });
            }
        }
    } catch (err) {
        console.error('Error cargando subcategorías:', err);
    }
}

// Filtrar productos por subcategoría
function filtrarPorSubcategoria() {
    aplicarFiltrosYMostrar();
}

// Renderizar productos (estilo unificado con página de productos)
function renderizarProductos(productos) {
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
                window.agregarAlCarrito(item);
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

// Aplicar filtros (ordenamiento) — ahora usa modales
function aplicarFiltros() {
    aplicarFiltrosYMostrar();
}

// Función global para agregar al carrito
window.agregarAlCarrito = function (producto) {
    var productoEnBD = productosActuales.find(function (p) { return p.id === producto.id; });
    if (!productoEnBD) {
        mostrarMensajeErrorStock('Producto no encontrado');
        return;
    }

    if (productoEnBD.categoria === 'Anillos') {
        abrirModalSeleccionarTalla(productoEnBD);
        return;
    }

    validarYAgregarAlCarrito(producto);
};

// Validar stock con el servidor
async function validarYAgregarAlCarrito(producto) {
    try {
        var response = await fetch('/api/add-to-cart-validated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: producto.id, cantidad: 1 })
        });

        var data = await response.json();

        if (!response.ok) {
            mostrarMensajeErrorStock(data.error || 'Error al agregar al carrito');
            if (data.stockDisponible >= 0) {
                var p = productosActuales.find(function (x) { return x.id === producto.id; });
                if (p) {
                    p.stock = data.stockDisponible;
                    renderizarProductos(productosActuales);
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
        updateCartCount();

        var productoEnBD = productosActuales.find(function (x) { return x.id === producto.id; });
        if (productoEnBD) {
            productoEnBD.stock = data.producto.stockDisponible;
            renderizarProductos(productosActuales);
        }

        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(function () { window.forzarActualizacionStock(); }, 100);
        }

        // Abrir carrito slide
        if (typeof openCartSlide === 'function') {
            setTimeout(function () { openCartSlide(); }, 100);
        }

    } catch (err) {
        console.error('Error validando carrito:', err);
        mostrarMensajeErrorStock('Error al agregar al carrito');
    }
}

// Mostrar mensaje de éxito
function mostrarMensajeExito(mensaje) {
    var exitoDiv = document.getElementById('exito-stock-categorias');
    if (!exitoDiv) {
        exitoDiv = document.createElement('div');
        exitoDiv.id = 'exito-stock-categorias';
        document.body.appendChild(exitoDiv);
    }
    exitoDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#4caf50;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:10000;max-width:400px;';
    exitoDiv.textContent = mensaje;
    setTimeout(function () { exitoDiv.remove(); }, 3000);
}

// Mostrar mensaje de error
function mostrarMensajeErrorStock(mensaje) {
    var errorDiv = document.getElementById('error-stock-cat');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-cat';
        errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background-color:#c00;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:1000;font-size:14px;max-width:400px;';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    setTimeout(function () { errorDiv.style.display = 'none'; }, 3000);
}

// Actualizar contador del carrito
function updateCartCount() {
    var carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    var count = carrito.reduce(function (total, item) { return total + item.cantidad; }, 0);
    var el = document.getElementById('cart-count');
    if (el) el.textContent = count;
}

// Login modal (compatibilidad)
window.openLoginModal = function () {
    var modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeLoginModal = function () {
    var modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
};

// Iniciar
document.addEventListener('DOMContentLoaded', function () {
    var intentos = 0;
    function iniciar() {
        if (window.supabaseClient) {
            cargarCategoria();
            updateCartCount();
        } else if (intentos < 50) {
            intentos++;
            setTimeout(iniciar, 100);
        }
    }
    setTimeout(iniciar, 300);
});
