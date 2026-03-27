// ========== SISTEMA DE FAVORITOS ==========

(function () {
    'use strict';

    let favoritosIds = new Set();
    let favoritosLoaded = false;

    // SVG del corazón
    const HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    // Esperar a que Supabase esté listo
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

    // Obtener el user_id del usuario logueado
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

    // Comprobar si el usuario está logueado
    function isLoggedIn() {
        return !!getUserId();
    }

    // Cargar favoritos del usuario desde Supabase
    async function cargarFavoritos() {
        if (!window.supabaseClient || !isLoggedIn()) {
            favoritosIds = new Set();
            favoritosLoaded = true;
            actualizarContadorHeader();
            return;
        }

        try {
            var userId = getUserId();
            var result = await window.supabaseClient
                .from('favoritos')
                .select('producto_id')
                .eq('user_id', userId);

            if (result.error) {
                console.error('Error cargando favoritos:', result.error);
                favoritosIds = new Set();
            } else {
                favoritosIds = new Set((result.data || []).map(function (f) { return f.producto_id; }));
            }
        } catch (err) {
            console.error('Error cargando favoritos:', err);
            favoritosIds = new Set();
        }

        favoritosLoaded = true;
        actualizarContadorHeader();
        actualizarCorazonesEnCards();
    }

    // Añadir un producto a favoritos
    async function addFavorito(productoId) {
        if (!window.supabaseClient || !isLoggedIn()) return false;

        try {
            var userId = getUserId();
            var result = await window.supabaseClient
                .from('favoritos')
                .insert({ user_id: userId, producto_id: productoId });

            if (result.error) {
                if (result.error.code === '23505') {
                    // Ya existe, no es error
                    favoritosIds.add(productoId);
                    return true;
                }
                console.error('Error añadiendo favorito:', result.error);
                return false;
            }

            favoritosIds.add(productoId);
            actualizarContadorHeader();
            return true;
        } catch (err) {
            console.error('Error añadiendo favorito:', err);
            return false;
        }
    }

    // Quitar un producto de favoritos
    async function removeFavorito(productoId) {
        if (!window.supabaseClient || !isLoggedIn()) return false;

        try {
            var userId = getUserId();
            var result = await window.supabaseClient
                .from('favoritos')
                .delete()
                .eq('user_id', userId)
                .eq('producto_id', productoId);

            if (result.error) {
                console.error('Error eliminando favorito:', result.error);
                return false;
            }

            favoritosIds.delete(productoId);
            actualizarContadorHeader();
            return true;
        } catch (err) {
            console.error('Error eliminando favorito:', err);
            return false;
        }
    }

    // Mostrar modal para usuarios no logueados
    function mostrarModalLogin() {
        // No duplicar
        if (document.getElementById('modal-favoritos-login')) return;

        var overlay = document.createElement('div');
        overlay.id = 'modal-favoritos-login';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:16px;padding:32px 28px;max-width:380px;width:90%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3)';

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#888;line-height:1';
        closeBtn.addEventListener('click', function () { overlay.remove(); });

        var icon = document.createElement('div');
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
        icon.style.cssText = 'margin-bottom:16px';

        var msg = document.createElement('p');
        msg.textContent = 'Para agregar productos a la lista de favoritos, inicie sesión';
        msg.style.cssText = 'font-size:1rem;color:#333;margin:0 0 24px;line-height:1.5';

        var loginBtn = document.createElement('a');
        loginBtn.href = '/cuenta';
        loginBtn.textContent = 'Iniciar sesión';
        loginBtn.style.cssText = 'display:inline-block;background:linear-gradient(135deg,#d4af37,#b8962e);color:#fff;padding:12px 32px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.95rem;transition:transform .2s,box-shadow .2s';
        loginBtn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.05)'; this.style.boxShadow = '0 8px 20px rgba(212,175,55,0.4)'; });
        loginBtn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; this.style.boxShadow = 'none'; });

        box.appendChild(closeBtn);
        box.appendChild(icon);
        box.appendChild(msg);
        box.appendChild(loginBtn);
        overlay.appendChild(box);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });

        document.body.appendChild(overlay);
    }

    // Toggle favorito
    async function toggleFavorito(productoId, btn) {
        if (!isLoggedIn()) {
            mostrarModalLogin();
            return;
        }

        // Feedback visual inmediato
        var isFav = favoritosIds.has(productoId);
        btn.classList.toggle('is-favorito', !isFav);

        var ok;
        if (isFav) {
            ok = await removeFavorito(productoId);
            if (ok) {
                // Emitir evento para que la página de favoritos pueda reaccionar
                document.dispatchEvent(new CustomEvent('favoritoRemoved', { detail: { productoId: productoId } }));
            }
        } else {
            ok = await addFavorito(productoId);
        }

        // Revertir si falló
        if (!ok) {
            btn.classList.toggle('is-favorito', isFav);
        }
    }

    // Actualizar el icono del header (relleno si hay favoritos)
    function actualizarContadorHeader() {
        var iconEl = document.getElementById('favoritos-header-icon');
        if (!iconEl) return;

        var svg = iconEl.querySelector('svg');
        if (svg) {
            svg.style.fill = favoritosIds.size > 0 ? 'var(--color-principal)' : 'none';
        }
    }

    // Inyectar botón de corazón en una tarjeta de producto
    function inyectarCorazon(card, productoId) {
        // No duplicar
        if (card.querySelector('.btn-favorito')) return;

        var btn = document.createElement('button');
        btn.className = 'btn-favorito';
        btn.setAttribute('data-producto-id', productoId);
        btn.setAttribute('aria-label', 'Añadir a favoritos');
        btn.innerHTML = HEART_SVG;

        if (favoritosIds.has(productoId)) {
            btn.classList.add('is-favorito');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            toggleFavorito(productoId, btn);
        });

        // Insertar en posición absoluta sobre la imagen
        card.style.position = 'relative';
        card.appendChild(btn);
    }

    // Buscar todas las tarjetas de producto en la página y añadirles el corazón
    function inyectarCorazonesEnCards() {
        // 1. Tarjetas con data-producto-id ya definido (serán las de la página de favoritos)
        document.querySelectorAll('.producto-card[data-producto-id]').forEach(function (card) {
            var id = parseInt(card.getAttribute('data-producto-id'));
            if (id) inyectarCorazon(card, id);
        });

        // 2. Tarjetas generadas dinámicamente: extraer ID de onclick de botón Agregar o del enlace "Ver Detalle"
        document.querySelectorAll('.producto-card').forEach(function (card) {
            if (card.querySelector('.btn-favorito')) return; // Ya procesada

            var productoId = extraerProductoId(card);
            if (productoId) {
                card.setAttribute('data-producto-id', productoId);
                inyectarCorazon(card, productoId);
            }
        });
    }

    // Extraer el ID del producto de una tarjeta
    function extraerProductoId(card) {
        // Método 1: data attribute
        var dataId = card.getAttribute('data-producto-id');
        if (dataId) return parseInt(dataId);

        // Método 2: del botón "btn-agregar" con data-producto-id
        var btnAgregar = card.querySelector('.btn-agregar[data-producto-id]');
        if (btnAgregar) return parseInt(btnAgregar.getAttribute('data-producto-id'));

        // Método 3: del onclick del btn-agregar que tiene agregarAlCarrito({id: X, ...})
        var btnOnclick = card.querySelector('[onclick*="agregarAlCarrito"]');
        if (btnOnclick) {
            var match = btnOnclick.getAttribute('onclick').match(/id:\s*(\d+)/);
            if (match) return parseInt(match[1]);
        }

        // Método 4: del enlace a /productos/ID
        var link = card.querySelector('a[href*="/productos/"]');
        if (link) {
            var hrefMatch = link.getAttribute('href').match(/\/productos\/(\d+)/);
            if (hrefMatch) return parseInt(hrefMatch[1]);
        }

        // Método 5: del onclick del botón "Ver Detalle"
        var btnDetalle = card.querySelector('[onclick*="/productos/"]');
        if (btnDetalle) {
            var detalleMatch = btnDetalle.getAttribute('onclick').match(/\/productos\/(\d+)/);
            if (detalleMatch) return parseInt(detalleMatch[1]);
        }

        // Método 6: del event listener del card (click -> /productos/X)
        // No podemos acceder a event listeners, pero podemos revisar si el card tiene href
        return null;
    }

    // Actualizar corazones ya inyectados (cambio de estado tras login/logout)
    function actualizarCorazonesEnCards() {
        document.querySelectorAll('.btn-favorito').forEach(function (btn) {
            var id = parseInt(btn.getAttribute('data-producto-id'));
            if (id) {
                btn.classList.toggle('is-favorito', favoritosIds.has(id));
            }
        });
    }

    // Observer para detectar nuevas tarjetas añadidas al DOM
    var observer = new MutationObserver(function (mutations) {
        var needsInjection = false;
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    if (node.classList && node.classList.contains('producto-card') && !node.querySelector('.btn-favorito')) {
                        needsInjection = true;
                    }
                    if (node.querySelectorAll) {
                        var cards = node.querySelectorAll('.producto-card:not(:has(.btn-favorito))');
                        if (cards.length > 0) needsInjection = true;
                    }
                }
            });
        });
        if (needsInjection) {
            // Pequeño delay para que el contenido de la tarjeta esté completo
            setTimeout(inyectarCorazonesEnCards, 100);
        }
    });

    // Inicializar el sistema
    function init() {
        // Observar el DOM para inyectar corazones en tarjetas nuevas
        observer.observe(document.body, { childList: true, subtree: true });

        // Cargar favoritos cuando supabase esté listo
        waitForSupabase(function () {
            // Esperar un poco a que auth-new.js procese la sesión
            setTimeout(function () {
                cargarFavoritos();
            }, 500);
        });

        // Escuchar cambios de auth
        document.addEventListener('userAuthenticated', function () {
            cargarFavoritos();
        });

        // Si se hace logout, limpiar favoritos
        var originalLogout = window.logout;
        if (typeof originalLogout === 'function') {
            window.logout = async function () {
                favoritosIds = new Set();
                favoritosLoaded = false;
                actualizarContadorHeader();
                actualizarCorazonesEnCards();
                return originalLogout.apply(this, arguments);
            };
        }

        // Primera inyección de corazones (para contenido estático)
        inyectarCorazonesEnCards();
    }

    // Exponer funciones globales necesarias
    window.favoritosSystem = {
        cargarFavoritos: cargarFavoritos,
        isFavorito: function (id) { return favoritosIds.has(id); },
        getFavoritosIds: function () { return new Set(favoritosIds); },
        inyectarCorazonesEnCards: inyectarCorazonesEnCards,
        toggleFavorito: toggleFavorito
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
