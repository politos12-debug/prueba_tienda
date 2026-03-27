// ========== MARCA RELOJERÍA PAGE SCRIPT ==========
// Muestra productos de Relojes filtrados por marca, con filtros modales

(function () {
    'use strict';

    var productosActuales = [];
    var ordenamientoActual = 'relevancia';
    var marcaSlug = window.__marcaSlug || '';
    var marcaNombreReal = '';
    var precioMinGlobal = 0;
    var precioMaxGlobal = 5000;

    var filtrosAplicados = {
        precioMin: 0,
        precioMax: 5000,
        soloOfertas: false
    };

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

    function escapeHTML(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
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

            minRange.value = precioMinGlobal;
            maxRange.value = precioMaxGlobal;

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
        productos = aplicarOrdenamiento(productos);

        renderizarProductos(productos);

        var countEl = document.getElementById('resultados-count');
        if (countEl) {
            countEl.textContent = productos.length + (productos.length === 1 ? ' producto' : ' productos');
        }
    }

    function aplicarOrdenamiento(productos) {
        var copia = productos.slice();
        switch (ordenamientoActual) {
            case 'a-z':
                copia.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
                break;
            case 'z-a':
                copia.sort(function(a, b) { return b.nombre.localeCompare(a.nombre); });
                break;
            case 'precio-menor':
                copia.sort(function(a, b) {
                    var pa = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                    var pb = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                    return pa - pb;
                });
                break;
            case 'precio-mayor':
                copia.sort(function(a, b) {
                    var pa = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                    var pb = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                    return pb - pa;
                });
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

    // ========== EVENTOS MODALES ==========

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

        // Orden radios — auto-close on selection
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

    // ========== RENDERIZAR PRODUCTOS ==========

    function renderizarProductos(productos) {
        var grid = document.getElementById('productos-grid');
        var sinProductos = document.getElementById('sin-productos');

        if (productos.length === 0) {
            grid.style.display = 'none';
            if (sinProductos) sinProductos.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (sinProductos) sinProductos.style.display = 'none';
        grid.innerHTML = '';

        productos.forEach(function(producto) {
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

            var precioHTML = '\u20ac' + parseFloat(producto.precio).toFixed(2);
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                precioHTML =
                    '<span style="text-decoration:line-through;color:#888;font-size:0.85em;">\u20ac' + parseFloat(producto.precio).toFixed(2) + '</span> ' +
                    '<span style="font-weight:bold;color:#d4af37;font-size:1.1em;">\u20ac' + precioFinal.toFixed(2) + '</span>';
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
                '<img src="' + (imagenURL || '/images/placeholder.png') + '" alt="' + escapeHTML(producto.nombre) + '" style="width:100%;height:200px;object-fit:cover;' + (!hayStock ? 'opacity:0.5;' : '') + '">' +
                (!hayStock ? '<div class="stock-indicator">Agotado</div>' : '') +
                '<h3>' + escapeHTML(producto.nombre) + '</h3>' +
                '<div class="precio">' + precioHTML + '</div>' +
                '<button class="btn-agregar ' + stockClass + '" data-producto-id="' + producto.id + '" data-producto-nombre="' + escapeHTML(producto.nombre) + '" data-producto-precio="' + precioFinal + '" data-producto-imagen="' + escapeHTML(imagenURL) + '" ' + btnDisabled + '>' + btnText + '</button>';

            var btnAgregar = card.querySelector('.btn-agregar');
            if (btnAgregar && hayStock) {
                btnAgregar.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    agregarAlCarritoMarca({
                        id: parseInt(this.dataset.productoId),
                        nombre: this.dataset.productoNombre,
                        precio: parseFloat(this.dataset.productoPrecio),
                        imagen: this.dataset.productoImagen
                    });
                });
            }

            card.addEventListener('click', function(e) {
                if (e.target.classList.contains('btn-agregar') || e.target.closest('.btn-agregar')) return;
                window.location.href = '/productos/' + producto.id;
            });

            grid.appendChild(card);
        });
    }

    // ========== CARRITO ==========

    function agregarAlCarritoMarca(producto) {
        var productoEnBD = productosActuales.find(function(p) { return p.id === producto.id; });
        if (!productoEnBD) return;

        validarYAgregarAlCarrito(producto);
    }

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
                    var p = productosActuales.find(function(x) { return x.id === producto.id; });
                    if (p) {
                        p.stock = data.stockDisponible;
                        aplicarFiltrosYMostrar();
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

            var existingItem = cart.find(function(i) { return i.id === item.id; });
            if (existingItem) {
                existingItem.cantidad += 1;
            } else {
                cart.push(item);
            }

            localStorage.setItem('carrito', JSON.stringify(cart));
            updateCartCount();

            var productoEnBD = productosActuales.find(function(x) { return x.id === producto.id; });
            if (productoEnBD) {
                productoEnBD.stock = data.producto.stockDisponible;
                aplicarFiltrosYMostrar();
            }

            if (typeof window.forzarActualizacionStock === 'function') {
                setTimeout(function() { window.forzarActualizacionStock(); }, 100);
            }

            if (typeof openCartSlide === 'function') {
                setTimeout(function() { openCartSlide(); }, 100);
            }

        } catch (err) {
            console.error('Error validando carrito:', err);
            mostrarMensajeErrorStock('Error al agregar al carrito');
        }
    }

    function mostrarMensajeErrorStock(mensaje) {
        var errorDiv = document.getElementById('error-stock-marca');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-stock-marca';
            errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background-color:#c00;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:1000;font-size:14px;max-width:400px;';
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
        setTimeout(function() { errorDiv.style.display = 'none'; }, 3000);
    }

    function updateCartCount() {
        var carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        var count = carrito.reduce(function(total, item) { return total + item.cantidad; }, 0);
        var el = document.getElementById('cart-count');
        if (el) el.textContent = count;
    }

    // ========== CARGAR PRODUCTOS ==========

    async function cargarProductosMarca() {
        var intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(function(r) { setTimeout(r, 100); });
            intentos++;
        }

        if (!window.supabaseClient) {
            console.error('Supabase no se inicializó');
            return;
        }

        // Obtener nombre real de marca
        var marcasResult = await window.supabaseClient
            .from('marcas')
            .select('nombre')
            .order('nombre', { ascending: true });

        if (marcasResult.data) {
            var found = marcasResult.data.find(function(m) {
                return slugify(m.nombre) === marcaSlug;
            });
            if (found) {
                marcaNombreReal = found.nombre;
            }
        }

        if (!marcaNombreReal) {
            marcaNombreReal = decodeURIComponent(marcaSlug).replace(/-/g, ' ');
        }

        // Actualizar UI
        var titulo = document.getElementById('marca-titulo');
        var breadcrumb = document.getElementById('breadcrumb-marca');
        var desc = document.getElementById('marca-desc');

        if (titulo) titulo.textContent = marcaNombreReal;
        if (breadcrumb) breadcrumb.textContent = marcaNombreReal;
        if (desc) desc.textContent = 'Relojes ' + marcaNombreReal;

        // Cargar productos
        var result = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', 'Relojes')
            .ilike('marca', marcaNombreReal)
            .eq('activo', true)
            .order('created_at', { ascending: false });

        if (result.error) {
            console.error('Error al cargar productos:', result.error);
            return;
        }

        productosActuales = result.data || [];

        inicializarRangoPrecios();
        inicializarEventosModales();
        aplicarFiltrosYMostrar();
        actualizarFiltrosActivosUI();
        updateCartCount();
    }

    // ========== INIT ==========

    function init() {
        var intentos = 0;
        function iniciar() {
            if (window.supabaseClient) {
                cargarProductosMarca();
            } else if (intentos < 50) {
                intentos++;
                setTimeout(iniciar, 100);
            }
        }
        iniciar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
