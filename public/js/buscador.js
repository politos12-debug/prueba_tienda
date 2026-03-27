// ========== BUSCADOR FULLSCREEN ==========

(function () {
    'use strict';

    var overlay = null;
    var inputEl = null;
    var resultsEl = null;
    var countEl = null;
    var debounceTimer = null;
    var productosCache = null;

    // Esperar a Supabase
    function waitForSupabase(callback, maxAttempts) {
        maxAttempts = maxAttempts || 100;
        var attempts = 0;
        function check() {
            attempts++;
            if (window.supabaseClient) {
                callback();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 150);
            }
        }
        check();
    }

    // Cargar todos los productos (caché en memoria)
    async function cargarProductos() {
        if (productosCache) return productosCache;

        // Esperar a que supabaseClient esté disponible
        if (!window.supabaseClient) {
            await new Promise(function (resolve) {
                var attempts = 0;
                var check = setInterval(function () {
                    attempts++;
                    if (window.supabaseClient || attempts > 50) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
        }

        if (!window.supabaseClient) return [];

        try {
            var result = await window.supabaseClient
                .from('products')
                .select('id, nombre, precio, imagen_url, categoria, etiqueta, descuento_oferta, stock')
                .eq('activo', true)
                .order('nombre');

            if (result.error) {
                console.error('Error cargando productos para búsqueda:', result.error);
                return [];
            }

            productosCache = result.data || [];
            return productosCache;
        } catch (err) {
            console.error('Error cargando productos para búsqueda:', err);
            return [];
        }
    }

    // Buscar productos por texto
    function filtrarProductos(productos, query) {
        if (!query || query.length < 2) return [];

        var terms = query.toLowerCase().trim().split(/\s+/);

        return productos.filter(function (p) {
            var texto = (
                (p.nombre || '') + ' ' +
                (p.categoria || '') + ' ' +
                (p.etiqueta || '')
            ).toLowerCase();

            return terms.every(function (term) {
                return texto.indexOf(term) !== -1;
            });
        });
    }

    // Obtener la primera imagen de un producto
    function getImagen(producto) {
        if (!producto.imagen_url) return '';
        try {
            var imagenes = JSON.parse(producto.imagen_url);
            return Array.isArray(imagenes) ? imagenes[0] : imagenes;
        } catch (e) {
            return producto.imagen_url;
        }
    }

    // Renderizar resultados como tarjetas de producto
    function renderResults(productos) {
        if (!resultsEl || !countEl) return;

        if (productos.length === 0) {
            var query = inputEl ? inputEl.value.trim() : '';
            countEl.textContent = '';

            if (query.length < 2) {
                resultsEl.innerHTML =
                    '<div class="buscador-empty">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
                        '<p>Escribe para buscar entre nuestras joyas</p>' +
                    '</div>';
            } else {
                resultsEl.innerHTML =
                    '<div class="buscador-empty">' +
                        '<p>No se encontraron resultados para "<strong>' + escapeHtml(query) + '</strong>"</p>' +
                    '</div>';
            }
            return;
        }

        countEl.textContent = productos.length + (productos.length === 1 ? ' resultado' : ' resultados');

        var html = '<div class="buscador-grid">';
        productos.forEach(function (p) {
            var img = getImagen(p);
            var precioFinal = p.precio;
            var hayStock = p.stock > 0;

            // Imagen
            var imagenHTML = '';
            if (img) {
                imagenHTML = '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.nombre) + '" loading="lazy" style="width:100%;height:200px;object-fit:cover;">';
            } else {
                imagenHTML = '<div style="width:100%;height:200px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:#f0ede8;">\uD83D\uDC8E</div>';
            }

            // Badge oferta
            var badgeOferta = '';
            if (p.descuento_oferta && p.descuento_oferta > 0) {
                badgeOferta = '<div class="oferta-badge">-' + p.descuento_oferta + '%</div>';
                precioFinal = p.precio * (1 - p.descuento_oferta / 100);
            }

            // Precio
            var precioHTML = '<p class="precio">\u20AC' + parseFloat(p.precio).toFixed(2) + '</p>';
            if (p.descuento_oferta && p.descuento_oferta > 0) {
                precioHTML =
                    '<div class="precio">' +
                        '<span style="text-decoration:line-through;color:#888;font-size:0.85em;">\u20AC' + parseFloat(p.precio).toFixed(2) + '</span> ' +
                        '<span style="font-weight:bold;color:#d4af37;font-size:1.1em;">\u20AC' + precioFinal.toFixed(2) + '</span>' +
                    '</div>';
            }

            // Etiqueta
            var etiqueta = p.etiqueta ? '<div class="producto-etiqueta">' + escapeHtml(p.etiqueta) + '</div>' : '';

            // Stock
            var stockClass = hayStock ? '' : 'sin-stock';
            var btnDisabled = hayStock ? '' : 'disabled';
            var btnText = hayStock ? 'Agregar al carrito' : 'Agotado';
            var imgOpacity = hayStock ? '' : 'opacity:0.5;';
            var stockIndicator = hayStock ? '' : '<div class="stock-indicator">Agotado</div>';

            var nombreSafe = escapeHtml(p.nombre).replace(/'/g, "\\'");
            var imgSafe = escapeHtml(img || '').replace(/'/g, "\\'");

            html +=
                '<div class="producto-card" style="cursor:pointer;" data-producto-id="' + p.id + '" onclick="if(!event.target.closest(\'.btn-agregar\')){cerrarBuscador();window.location.href=\'/productos/' + p.id + '\'}">' +
                    etiqueta +
                    badgeOferta +
                    '<div class="producto-imagen" style="' + imgOpacity + '">' + imagenHTML + '</div>' +
                    stockIndicator +
                    '<h3>' + escapeHtml(p.nombre) + '</h3>' +
                    precioHTML +
                    '<button class="btn-agregar ' + stockClass + '" onclick="event.stopPropagation();agregarAlCarrito({id:' + p.id + ',nombre:\'' + nombreSafe + '\',precio:' + precioFinal + ',imagen:\'' + imgSafe + '\'})" ' + btnDisabled + '>' + btnText + '</button>' +
                '</div>';
        });
        html += '</div>';

        resultsEl.innerHTML = html;

        // Inyectar corazones de favoritos en las tarjetas
        if (window.favoritosSystem) {
            setTimeout(function () {
                window.favoritosSystem.inyectarCorazonesEnCards();
            }, 50);
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Crear el overlay del buscador
    function crearOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'buscador-overlay';
        overlay.innerHTML =
            '<button class="buscador-close" id="buscador-close" aria-label="Cerrar buscador">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            '</button>' +
            '<div class="buscador-content">' +
                '<div class="buscador-title">Buscar joyas</div>' +
                '<div class="buscador-input-wrapper">' +
                    '<input type="text" class="buscador-input" id="buscador-input" placeholder="Anillos, pulseras, pendientes..." autocomplete="off" />' +
                    '<div class="buscador-input-icon">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
                    '</div>' +
                '</div>' +
                '<div class="buscador-count" id="buscador-count"></div>' +
                '<div class="buscador-results" id="buscador-results"></div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Referencias
        inputEl = document.getElementById('buscador-input');
        resultsEl = document.getElementById('buscador-results');
        countEl = document.getElementById('buscador-count');

        // Cerrar
        document.getElementById('buscador-close').addEventListener('click', cerrarBuscador);

        // Cerrar con Escape
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') cerrarBuscador();
        });

        // Búsqueda en tiempo real
        inputEl.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            var query = inputEl.value.trim();

            if (query.length < 2) {
                renderResults([]);
                return;
            }

            // Mostrar spinner mientras busca
            resultsEl.innerHTML =
                '<div class="buscador-loading">' +
                    '<div class="buscador-spinner"></div>' +
                    '<p>Buscando...</p>' +
                '</div>';

            debounceTimer = setTimeout(async function () {
                var productos = await cargarProductos();
                var resultados = filtrarProductos(productos, query);
                renderResults(resultados);
            }, 250);
        });
    }

    // Abrir buscador
    function abrirBuscador() {
        crearOverlay();

        // Forzar display antes de activar animación
        overlay.style.display = 'flex';
        requestAnimationFrame(function () {
            overlay.classList.add('active');
        });

        document.body.style.overflow = 'hidden';

        // Focus en input con pequeño delay para la animación
        setTimeout(function () {
            if (inputEl) {
                inputEl.value = '';
                inputEl.focus();
                renderResults([]);
            }
        }, 100);

        // Pre-cargar productos al abrir
        cargarProductos();
    }

    // Cerrar buscador
    function cerrarBuscador() {
        if (!overlay) return;

        overlay.classList.remove('active');
        document.body.style.overflow = '';

        setTimeout(function () {
            overlay.style.display = 'none';
        }, 250);
    }

    // Exponer globalmente
    window.abrirBuscador = abrirBuscador;
    window.cerrarBuscador = cerrarBuscador;

    // Atajo de teclado: Ctrl+K o Cmd+K
    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            abrirBuscador();
        }
    });
})();
