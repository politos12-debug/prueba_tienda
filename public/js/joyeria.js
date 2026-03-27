// ========== JOYERÍA PAGE SCRIPT ==========
// Muestra todos los productos EXCEPTO relojes

// Inyectar estilos para checkboxes de categorías (se generan dinámicamente)
(function() {
    const s = document.createElement('style');
    s.textContent = `
        .categorias-checkboxes{display:flex;flex-direction:column;gap:2px}
        .categoria-checkbox-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:all .2s;border:1.5px solid transparent;user-select:none}
        .categoria-checkbox-item:hover{background:#faf6eb}
        .categoria-checkbox-item input{display:none}
        .cat-check-box{width:18px;height:18px;border:1.8px solid #cdc7b8;border-radius:4px;position:relative;transition:all .25s;flex-shrink:0;background:#fff}
        .cat-check-box::after{content:'';position:absolute;top:1px;left:5px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);transition:transform .2s cubic-bezier(.4,0,.2,1)}
        .categoria-checkbox-item.active .cat-check-box{background:linear-gradient(135deg,#d4af37,#c9a232);border-color:#d4af37;box-shadow:0 1px 4px rgba(212,175,55,.3)}
        .categoria-checkbox-item.active .cat-check-box::after{transform:rotate(45deg) scale(1)}
        .categoria-checkbox-item.active{background:#faf6eb;border-color:rgba(212,175,55,.15)}
        .cat-check-label{font-size:13.5px;font-weight:500;color:#555;letter-spacing:.01em}
        .categoria-checkbox-item.active .cat-check-label{color:#7a5c10;font-weight:600}
    `;
    document.head.appendChild(s);
})();

// Variables globales
let allProductosPage = [];
let ordenamientoActual = 'relevancia';
let precioMinGlobal = 0;
let precioMaxGlobal = 5000;

// Estado actual de filtros aplicados
let filtrosAplicados = {
    precioMin: 0,
    precioMax: 5000,
    soloOfertas: false,
    categorias: []
};

// ========== MODALES ==========

function abrirModalFiltros() {
    const overlay = document.getElementById('modal-filtros-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';
}

function cerrarModalFiltros() {
    const overlay = document.getElementById('modal-filtros-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 350);
    document.body.style.overflow = '';
}

function abrirModalOrden() {
    const overlay = document.getElementById('modal-orden-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';
}

function cerrarModalOrden() {
    const overlay = document.getElementById('modal-orden-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 350);
    document.body.style.overflow = '';
}

// ========== RANGO DE PRECIOS ==========

function inicializarRangoPrecios() {
    const minRange = document.getElementById('precio-min-range');
    const maxRange = document.getElementById('precio-max-range');
    if (!minRange || !maxRange) return;

    // Calcular precios reales del catálogo
    if (allProductosPage.length > 0) {
        const precios = allProductosPage.map(p => {
            return p.descuento_oferta > 0
                ? p.precio * (1 - p.descuento_oferta / 100)
                : p.precio;
        });
        precioMinGlobal = 0;
        precioMaxGlobal = Math.ceil(Math.max(...precios) / 10) * 10;

        minRange.min = precioMinGlobal;
        minRange.max = precioMaxGlobal;
        maxRange.min = precioMinGlobal;
        maxRange.max = precioMaxGlobal;

        minRange.value = filtrosAplicados.precioMin || precioMinGlobal;
        maxRange.value = filtrosAplicados.precioMax || precioMaxGlobal;
    }

    actualizarDisplayPrecios();
    actualizarTrackPrecios();

    minRange.addEventListener('input', function () {
        if (parseInt(minRange.value) > parseInt(maxRange.value) - 10) {
            minRange.value = parseInt(maxRange.value) - 10;
        }
        actualizarDisplayPrecios();
        actualizarTrackPrecios();
    });

    maxRange.addEventListener('input', function () {
        if (parseInt(maxRange.value) < parseInt(minRange.value) + 10) {
            maxRange.value = parseInt(minRange.value) + 10;
        }
        actualizarDisplayPrecios();
        actualizarTrackPrecios();
    });
}

function actualizarDisplayPrecios() {
    const minRange = document.getElementById('precio-min-range');
    const maxRange = document.getElementById('precio-max-range');
    const minDisplay = document.getElementById('precio-min-display');
    const maxDisplay = document.getElementById('precio-max-display');

    if (minRange && minDisplay) {
        minDisplay.textContent = parseInt(minRange.value).toLocaleString('es-ES') + ' €';
    }
    if (maxRange && maxDisplay) {
        maxDisplay.textContent = parseInt(maxRange.value).toLocaleString('es-ES') + ' €';
    }
}

function actualizarTrackPrecios() {
    const minRange = document.getElementById('precio-min-range');
    const maxRange = document.getElementById('precio-max-range');
    const track = document.getElementById('range-track');
    if (!minRange || !maxRange || !track) return;

    const min = parseInt(minRange.min);
    const max = parseInt(minRange.max);
    const left = ((parseInt(minRange.value) - min) / (max - min)) * 100;
    const right = ((parseInt(maxRange.value) - min) / (max - min)) * 100;

    track.style.setProperty('--left', left + '%');
    track.style.setProperty('--right', right + '%');
    if (track.querySelector('::after') === null) {
        // Use inline style on track::after via CSS custom properties
    }
    track.setAttribute('style',
        '--left:' + left + '%;--right:' + right + '%;'
    );
}

// Añadir CSS para el track dinámico
(function () {
    const style = document.createElement('style');
    style.textContent = `
        .range-track::after {
            left: var(--left, 0%);
            right: calc(100% - var(--right, 100%));
        }
    `;
    document.head.appendChild(style);
})();

// ========== CATEGORÍAS CHIPS ==========

async function cargarCategoriasChips() {
    if (!window.supabaseClient) return;

    const container = document.getElementById('categorias-checkboxes');
    if (!container) return;

    try {
        const result = await window.supabaseClient
            .from('categorias_tienda')
            .select('nombre, slug')
            .eq('visible', true)
            .order('orden', { ascending: true });

        if (result.error || !result.data) return;

        container.innerHTML = '';
        result.data.forEach(function (cat) {
            if (cat.slug === 'relojes') return;
            const label = document.createElement('label');
            label.className = 'categoria-checkbox-item';
            label.innerHTML = '<input type="checkbox" class="cat-checkbox" value="' + cat.nombre + '">' +
                '<span class="cat-check-box"></span>' +
                '<span class="cat-check-label">' + cat.nombre + '</span>';
            const input = label.querySelector('input');
            input.addEventListener('change', function () {
                label.classList.toggle('active', input.checked);
            });
            container.appendChild(label);
        });

        // Marcar activas si ya hay categorías en filtros
        if (filtrosAplicados.categorias.length > 0) {
            container.querySelectorAll('.cat-checkbox').forEach(function (cb) {
                if (filtrosAplicados.categorias.includes(cb.value)) {
                    cb.checked = true;
                    cb.closest('.categoria-checkbox-item').classList.add('active');
                }
            });
        }
    } catch (err) {
        console.error('Error cargando categorías:', err);
    }
}

// ========== APLICAR / LIMPIAR FILTROS ==========

function aplicarFiltrosDesdeModal() {
    const minRange = document.getElementById('precio-min-range');
    const maxRange = document.getElementById('precio-max-range');
    const soloOfertas = document.getElementById('filtro-solo-ofertas');
    filtrosAplicados.precioMin = minRange ? parseInt(minRange.value) : precioMinGlobal;
    filtrosAplicados.precioMax = maxRange ? parseInt(maxRange.value) : precioMaxGlobal;
    filtrosAplicados.soloOfertas = soloOfertas ? soloOfertas.checked : false;

    // Recoger categorías seleccionadas de los checkboxes
    const checked = document.querySelectorAll('.cat-checkbox:checked');
    filtrosAplicados.categorias = Array.from(checked).map(function (cb) { return cb.value; });

    cerrarModalFiltros();
    aplicarFiltrosYMostrar();
    actualizarFiltrosActivosUI();
}

function limpiarTodosFiltros() {
    const minRange = document.getElementById('precio-min-range');
    const maxRange = document.getElementById('precio-max-range');
    const soloOfertas = document.getElementById('filtro-solo-ofertas');
    if (minRange) minRange.value = precioMinGlobal;
    if (maxRange) maxRange.value = precioMaxGlobal;
    if (soloOfertas) soloOfertas.checked = false;

    // Desmarcar todos los checkboxes de categorías
    document.querySelectorAll('.cat-checkbox').forEach(function (cb) {
        cb.checked = false;
        cb.closest('.categoria-checkbox-item').classList.remove('active');
    });

    filtrosAplicados = {
        precioMin: precioMinGlobal,
        precioMax: precioMaxGlobal,
        soloOfertas: false,
        categorias: []
    };

    actualizarDisplayPrecios();
    actualizarTrackPrecios();
}

function aplicarFiltrosYMostrar() {
    let productos = [...allProductosPage];

    // Filtro por precio
    productos = productos.filter(p => {
        const precioFinal = p.descuento_oferta > 0
            ? p.precio * (1 - p.descuento_oferta / 100)
            : p.precio;
        return precioFinal >= filtrosAplicados.precioMin && precioFinal <= filtrosAplicados.precioMax;
    });

    // Filtro solo ofertas
    if (filtrosAplicados.soloOfertas) {
        productos = productos.filter(p => p.descuento_oferta && p.descuento_oferta > 0);
    }

    // Filtro por categorías
    if (filtrosAplicados.categorias.length > 0) {
        productos = productos.filter(p => filtrosAplicados.categorias.includes(p.categoria));
    }

    // Aplicar ordenamiento
    productos = aplicarOrdenamientoAProductos(productos);

    mostrarProductos(productos);

    // Actualizar contador de resultados
    const countEl = document.getElementById('resultados-count');
    if (countEl) {
        countEl.textContent = productos.length + (productos.length === 1 ? ' producto' : ' productos');
    }
}

function contarFiltrosActivos() {
    let count = 0;
    if (filtrosAplicados.precioMin > precioMinGlobal || filtrosAplicados.precioMax < precioMaxGlobal) count++;
    if (filtrosAplicados.soloOfertas) count++;
    count += filtrosAplicados.categorias.length;
    return count;
}

function actualizarFiltrosActivosUI() {
    const count = contarFiltrosActivos();

    // Badge en el botón Filtrar
    const badge = document.getElementById('filtros-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    // Contador inline en el botón Filtrar de la toolbar
    const countInline = document.getElementById('filtros-count-inline');
    if (countInline) {
        countInline.textContent = count;
        countInline.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    // Botón Limpiar filtros en la toolbar
    const btnLimpiarToolbar = document.getElementById('btn-limpiar-toolbar');
    if (btnLimpiarToolbar) {
        btnLimpiarToolbar.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

// ========== ORDENAMIENTO ==========

function aplicarOrdenDesdeModal(tipo) {
    ordenamientoActual = tipo;

    // Actualizar radio visual
    document.querySelectorAll('.orden-opcion').forEach(function (opt) {
        opt.classList.toggle('active', opt.dataset.orden === tipo);
    });

    cerrarModalOrden();
    aplicarFiltrosYMostrar();
}

function aplicarOrdenamientoAProductos(productos) {
    const copia = [...productos];

    switch (ordenamientoActual) {
        case 'a-z':
            return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
        case 'z-a':
            return copia.sort((a, b) => b.nombre.localeCompare(a.nombre));
        case 'precio-menor':
            return copia.sort((a, b) => {
                const precioA = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                const precioB = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                return precioA - precioB;
            });
        case 'precio-mayor':
            return copia.sort((a, b) => {
                const precioA = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                const precioB = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                return precioB - precioA;
            });
        default:
            return copia;
    }
}

// ========== CARGAR PRODUCTOS ==========

async function cargarProductosPagina() {
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) {
        console.error('Supabase no se inicializó');
        return;
    }

    // Cargar categorías en los chips del modal
    await cargarCategoriasChips();

    const { data: productos, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .neq('categoria', 'Relojes')
        .eq('activo', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar productos:', error);
        return;
    }

    allProductosPage = (productos || []);
    console.log('Productos joyería cargados:', allProductosPage.length);

    // Inicializar rango de precios con datos reales
    inicializarRangoPrecios();

    // Obtener categoría de la URL
    const urlParams = new URLSearchParams(window.location.search);
    let categoria = urlParams.get('categoria');

    if (!categoria) {
        const pathParts = window.location.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== '' && lastPart !== 'joyeria') {
            categoria = decodeURIComponent(lastPart);
        }
    }

    // Si hay categoría en URL, preseleccionarla
    if (categoria && categoria !== 'Todos') {
        if (categoria === 'Ofertas') {
            filtrosAplicados.soloOfertas = true;
            const cb = document.getElementById('filtro-solo-ofertas');
            if (cb) cb.checked = true;
        } else {
            filtrosAplicados.categorias = [categoria];
            const matchCb = document.querySelector('.cat-checkbox[value="' + categoria + '"]');
            if (matchCb) {
                matchCb.checked = true;
                matchCb.closest('.categoria-checkbox-item').classList.add('active');
            }
        }
    }

    aplicarFiltrosYMostrar();
    actualizarFiltrosActivosUI();
}

// ========== MOSTRAR PRODUCTOS ==========

function mostrarProductos(productos) {
    const grid = document.querySelector('.productos-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!productos || productos.length === 0) {
        grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:40px;">No hay productos disponibles</p>';
        return;
    }

    productos.forEach(producto => {
        const precioFinal = producto.descuento_oferta > 0
            ? producto.precio * (1 - producto.descuento_oferta / 100)
            : producto.precio;

        const card = document.createElement('div');
        card.className = 'producto-card';

        let imagenUrl = 'https://via.placeholder.com/250x200?text=Producto';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                if (Array.isArray(imagenes) && imagenes.length > 0) {
                    imagenUrl = imagenes[0];
                } else if (typeof imagenes === 'string') {
                    imagenUrl = imagenes;
                }
            } catch (e) {
                if (producto.imagen_url.startsWith('http')) {
                    imagenUrl = producto.imagen_url;
                }
            }
        }

        const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
            : '';

        let precioHtml = `€${producto.precio.toFixed(2)}`;
        if (producto.descuento_oferta > 0) {
            precioHtml = `
                <span style="text-decoration: line-through;color: #888;font-size:0.85em;">€${producto.precio.toFixed(2)}</span>
                <span style="font-weight:bold;color:#d4af37;font-size:1.1em;">€${precioFinal.toFixed(2)}</span>
            `;
        }

        const hayStock = producto.stock > 0;
        const stockClass = hayStock ? '' : 'sin-stock';
        const btnDisabled = hayStock ? '' : 'disabled';
        const btnText = hayStock ? 'Agregar al carrito' : 'Agotado';

        card.innerHTML = `
            ${badgeOferta}
            <img src="${imagenUrl}" alt="${producto.nombre}" style="width:100%;height:200px;object-fit:cover;${!hayStock ? 'opacity: 0.5;' : ''}">
            ${!hayStock ? '<div class="stock-indicator">Agotado</div>' : ''}
            <h3>${producto.nombre}</h3>
            <div class="precio">${precioHtml}</div>
            <button class="btn-agregar ${stockClass}" data-producto-id="${producto.id}" data-producto-nombre="${producto.nombre}" data-producto-precio="${precioFinal}" data-producto-imagen="${imagenUrl}" style="pointer-events: auto;" ${btnDisabled}>${btnText}</button>
        `;

        card.style.cursor = 'pointer';

        const btnAgregar = card.querySelector('.btn-agregar');
        if (btnAgregar && hayStock) {
            btnAgregar.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();

                const item = {
                    id: parseInt(this.dataset.productoId),
                    nombre: this.dataset.productoNombre,
                    precio: parseFloat(this.dataset.productoPrecio),
                    imagen: this.dataset.productoImagen
                };

                agregarAlCarritoJoyeria(e, item);
                return false;
            });
        }

        card.addEventListener('click', function (e) {
            if (e.target.classList.contains('btn-agregar') || e.target.closest('.btn-agregar')) {
                return;
            }
            window.location.href = `/productos/${producto.id}`;
        });

        grid.appendChild(card);
    });

    updateCartCount();
}

// ========== CARRITO ==========

function agregarAlCarritoJoyeria(event, item) {
    if (window.agregarAlCarritoEnProceso) return;
    window.agregarAlCarritoEnProceso = true;

    if (event) {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    const producto = allProductosPage.find(p => p.id === item.id);
    if (!producto || producto.stock <= 0) {
        window.agregarAlCarritoEnProceso = false;
        mostrarMensajeErrorStock('Lo siento, este producto no tiene stock disponible en este momento.');
        return;
    }

    if (producto.categoria === 'Anillos') {
        window.agregarAlCarritoEnProceso = false;
        abrirModalSeleccionarTalla(producto);
        return;
    }

    let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const existe = carrito.find(i => i.id === item.id);
    let cantidadEnCarrito = existe ? existe.cantidad : 0;
    let cantidadTotal = cantidadEnCarrito + 1;

    if (cantidadTotal > producto.stock) {
        window.agregarAlCarritoEnProceso = false;
        const stockDisponible = producto.stock - cantidadEnCarrito;
        mostrarMensajeErrorStock(`No hay suficiente stock disponible.\n\nYa tienes ${cantidadEnCarrito} en el carrito.\nStock disponible: ${stockDisponible}`);
        return;
    }

    if (existe) {
        existe.cantidad += 1;
    } else {
        carrito.push({ ...item, cantidad: 1, tiempoAgregado: Date.now() });
    }

    localStorage.setItem('carrito', JSON.stringify(carrito));
    window.carrito = carrito;

    if (window.supabaseClient) {
        fetch('/api/update-cart-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: item.id,
                cantidad: 1,
                accion: 'restar'
            })
        })
            .then(res => { if (!res.ok) return null; return res.json(); })
            .then(data => { if (data?.success) console.log('[joyeria] Stock actualizado:', data); })
            .catch(err => console.warn('[joyeria] Error actualizando stock:', err));
    }

    if (typeof openCartSlide === 'function') {
        setTimeout(() => { try { openCartSlide(); } catch (e) { console.error('Error al abrir carrito slide:', e); } }, 100);
    }

    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof window.calcularTotales === 'function') window.calcularTotales();

    updateCartCount();
    window.agregarAlCarritoEnProceso = false;
}

function mostrarMensajeErrorStock(mensaje) {
    let errorDiv = document.getElementById('error-stock-productos');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-productos';
        errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background-color:#c00;color:white;padding:16px 24px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:10000;font-size:14px;max-width:400px;';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
}

function updateCartCount() {
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const count = carrito.reduce((total, item) => total + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) cartCountEl.textContent = count;
}

// ========== EVENT LISTENERS ==========

function inicializarEventListeners() {
    // Botones abrir/cerrar
    const btnFiltros = document.getElementById('btn-abrir-filtros');
    const btnCerrarFiltros = document.getElementById('btn-cerrar-filtros');
    const btnOrden = document.getElementById('btn-abrir-orden');
    const btnCerrarOrden = document.getElementById('btn-cerrar-orden');
    const btnAplicar = document.getElementById('btn-aplicar-filtros');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');

    if (btnFiltros) btnFiltros.addEventListener('click', abrirModalFiltros);
    if (btnCerrarFiltros) btnCerrarFiltros.addEventListener('click', cerrarModalFiltros);
    if (btnOrden) btnOrden.addEventListener('click', abrirModalOrden);
    if (btnCerrarOrden) btnCerrarOrden.addEventListener('click', cerrarModalOrden);
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltrosDesdeModal);
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarTodosFiltros);

    // Botón limpiar de la toolbar
    const btnLimpiarToolbar = document.getElementById('btn-limpiar-toolbar');
    if (btnLimpiarToolbar) {
        btnLimpiarToolbar.addEventListener('click', function () {
            limpiarTodosFiltros();
            aplicarFiltrosYMostrar();
            actualizarFiltrosActivosUI();
        });
    }

    // Cerrar overlays al hacer click fuera
    const filtrosOverlay = document.getElementById('modal-filtros-overlay');
    const ordenOverlay = document.getElementById('modal-orden-overlay');

    if (filtrosOverlay) {
        filtrosOverlay.addEventListener('click', function (e) {
            if (e.target === filtrosOverlay) cerrarModalFiltros();
        });
    }
    if (ordenOverlay) {
        ordenOverlay.addEventListener('click', function (e) {
            if (e.target === ordenOverlay) cerrarModalOrden();
        });
    }

    // Opciones de orden
    document.querySelectorAll('.orden-opcion').forEach(function (opt) {
        opt.addEventListener('click', function () {
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                aplicarOrdenDesdeModal(radio.value);
            }
        });
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            cerrarModalFiltros();
            cerrarModalOrden();
        }
    });
}

// ========== INICIAR ==========

window.addEventListener('load', function () {
    let intentos = 0;
    function iniciar() {
        if (window.supabaseClient) {
            inicializarEventListeners();
            cargarProductosPagina();
            updateCartCount();
        } else if (intentos < 50) {
            intentos++;
            setTimeout(iniciar, 100);
        }
    }
    iniciar();
});
