// ========== PÁGINA DE FAVORITOS ==========

(function () {
    'use strict';

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

    function getUserId() {
        if (window.currentUserData && window.currentUserData.id) {
            return window.currentUserData.id;
        }
        try {
            var stored = localStorage.getItem('currentUser');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && parsed.id) return parsed.id;
            }
        } catch (e) { }
        return null;
    }

    function mostrarEstado(id) {
        ['favoritos-no-auth', 'favoritos-loading', 'favoritos-empty', 'favoritos-grid'].forEach(function (elId) {
            var el = document.getElementById(elId);
            if (el) el.style.display = 'none';
        });
        var target = document.getElementById(id);
        if (target) target.style.display = id === 'favoritos-grid' ? 'grid' : 'flex';
    }

    async function cargarPaginaFavoritos() {
        var userId = getUserId();

        if (!userId) {
            mostrarEstado('favoritos-no-auth');
            return;
        }

        mostrarEstado('favoritos-loading');

        try {
            // Cargar IDs de favoritos
            var resFav = await window.supabaseClient
                .from('favoritos')
                .select('producto_id')
                .eq('user_id', userId);

            if (resFav.error) {
                console.error('Error cargando favoritos:', resFav.error);
                mostrarEstado('favoritos-empty');
                return;
            }

            var ids = (resFav.data || []).map(function (f) { return f.producto_id; });

            if (ids.length === 0) {
                mostrarEstado('favoritos-empty');
                return;
            }

            // Cargar datos de los productos
            var resProd = await window.supabaseClient
                .from('products')
                .select('*')
                .in('id', ids)
                .eq('activo', true);

            if (resProd.error) {
                console.error('Error cargando productos:', resProd.error);
                mostrarEstado('favoritos-empty');
                return;
            }

            var productos = resProd.data || [];

            if (productos.length === 0) {
                mostrarEstado('favoritos-empty');
                return;
            }

            // Actualizar subtítulo
            var subtitle = document.getElementById('favoritos-subtitle');
            if (subtitle) {
                subtitle.textContent = productos.length + (productos.length === 1 ? ' pieza guardada' : ' piezas guardadas');
            }

            renderizarFavoritos(productos);
        } catch (err) {
            console.error('Error:', err);
            mostrarEstado('favoritos-empty');
        }
    }

    function renderizarFavoritos(productos) {
        var grid = document.getElementById('favoritos-grid');
        if (!grid) return;

        grid.innerHTML = '';
        mostrarEstado('favoritos-grid');

        productos.forEach(function (producto) {
            var imagenUrl = '';
            if (producto.imagen_url) {
                try {
                    var imagenes = JSON.parse(producto.imagen_url);
                    imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
                } catch (e) {
                    imagenUrl = producto.imagen_url;
                }
            }

            var precioFinal = producto.precio;
            var precioHTML = '<div class="producto-precio">\u20AC' + parseFloat(producto.precio).toFixed(2) + '</div>';
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                precioFinal = producto.precio * (1 - producto.descuento_oferta / 100);
                precioHTML = '<div class="producto-precio">' +
                    '<span style="text-decoration:line-through;color:#888;font-size:0.85em;">\u20AC' + parseFloat(producto.precio).toFixed(2) + '</span> ' +
                    '<span style="font-weight:bold;color:#d4af37;font-size:1.1em;">\u20AC' + precioFinal.toFixed(2) + '</span>' +
                    '</div>';
            }

            var hayStock = producto.stock > 0;
            var stockClass = hayStock ? '' : 'sin-stock';
            var btnDisabled = hayStock ? '' : 'disabled';
            var btnText = hayStock ? 'Agregar al carrito' : 'Agotado';

            var badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
                ? '<div class="oferta-badge">-' + producto.descuento_oferta + '%</div>'
                : '';

            var card = document.createElement('div');
            card.className = 'producto-card';
            card.setAttribute('data-producto-id', producto.id);
            card.style.cursor = 'pointer';

            card.innerHTML =
                badgeOferta +
                '<div class="producto-imagen" style="' + (!hayStock ? 'opacity:0.5;' : '') + '">' +
                    (imagenUrl
                        ? '<img src="' + imagenUrl + '" alt="' + producto.nombre + '">'
                        : '<div class="producto-imagen-vacia">\uD83D\uDC8E</div>') +
                '</div>' +
                (!hayStock ? '<div class="stock-indicator">Agotado</div>' : '') +
                '<h3>' + producto.nombre + '</h3>' +
                precioHTML +
                '<div class="favoritos-card-actions">' +
                    '<button class="btn-agregar ' + stockClass + '" onclick="event.stopPropagation(); agregarAlCarrito({id: ' + producto.id + ', nombre: \'' + producto.nombre.replace(/'/g, "\\'") + '\', precio: ' + precioFinal + ', imagen: \'' + (imagenUrl || '').replace(/'/g, "\\'") + '\'})" ' + btnDisabled + '>' + btnText + '</button>' +
                    '<button class="btn-quitar-favorito" data-id="' + producto.id + '" title="Quitar de favoritos">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
                    '</button>' +
                '</div>';

            // Click en la tarjeta -> ir al detalle
            card.addEventListener('click', function (e) {
                if (e.target.closest('.btn-agregar') || e.target.closest('.btn-quitar-favorito')) return;
                window.location.href = '/productos/' + producto.id;
            });

            // Botón quitar favorito
            var btnQuitar = card.querySelector('.btn-quitar-favorito');
            if (btnQuitar) {
                btnQuitar.addEventListener('click', function (e) {
                    e.stopPropagation();
                    quitarFavorito(producto.id, card);
                });
            }

            grid.appendChild(card);
        });

        // Disparar inyección de corazones del sistema global
        if (window.favoritosSystem) {
            setTimeout(function () {
                window.favoritosSystem.inyectarCorazonesEnCards();
            }, 50);
        }
    }

    async function quitarFavorito(productoId, card) {
        // Animación de salida
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';

        if (window.favoritosSystem) {
            var btn = card.querySelector('.btn-favorito');
            if (btn) {
                await window.favoritosSystem.toggleFavorito(productoId, btn);
            } else {
                // Fallback: quitar directo
                var userId = getUserId();
                if (userId && window.supabaseClient) {
                    await window.supabaseClient
                        .from('favoritos')
                        .delete()
                        .eq('user_id', userId)
                        .eq('producto_id', productoId);
                }
            }
        }

        setTimeout(function () {
            card.remove();

            // Verificar si quedan favoritos
            var grid = document.getElementById('favoritos-grid');
            if (grid && grid.children.length === 0) {
                mostrarEstado('favoritos-empty');
            }

            // Actualizar subtítulo
            var count = grid ? grid.children.length : 0;
            var subtitle = document.getElementById('favoritos-subtitle');
            if (subtitle) {
                subtitle.textContent = count + (count === 1 ? ' pieza guardada' : ' piezas guardadas');
            }

            // Refrescar contador del header
            if (window.favoritosSystem) {
                window.favoritosSystem.cargarFavoritos();
            }
        }, 300);
    }

    function init() {
        waitForSupabase(function () {
            // Esperar a que auth-new.js haya procesado la sesión
            setTimeout(cargarPaginaFavoritos, 600);
        });

        // Si el usuario se autentica después de cargar la página
        document.addEventListener('userAuthenticated', function () {
            cargarPaginaFavoritos();
        });

        // Escuchar cuando se quita un favorito desde el corazón (no solo la X)
        document.addEventListener('favoritoRemoved', function (e) {
            var productoId = e.detail && e.detail.productoId;
            if (!productoId) return;

            var grid = document.getElementById('favoritos-grid');
            if (!grid) return;

            var card = grid.querySelector('.producto-card[data-producto-id="' + productoId + '"]');
            if (!card) return;

            // Animación de salida
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';

            setTimeout(function () {
                card.remove();

                // Verificar si quedan favoritos
                if (grid.children.length === 0) {
                    mostrarEstado('favoritos-empty');
                }

                // Actualizar subtítulo
                var count = grid.children.length;
                var subtitle = document.getElementById('favoritos-subtitle');
                if (subtitle) {
                    subtitle.textContent = count + (count === 1 ? ' pieza guardada' : ' piezas guardadas');
                }
            }, 300);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
