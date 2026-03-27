// =============================================
// mega-menu.js — Mega menú de categorías (Joyería + Relojería)
// =============================================

(function () {
    'use strict';

    var megaMenuLoaded = false;
    var megaMenuDataJoyeria = null;
    var megaMenuMarcasRelojeria = null;
    var hideTimeoutJoyeria = null;
    var hideTimeoutRelojeria = null;

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

    // Sanitizar texto para evitar XSS
    function escapeHTML(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    async function cargarDatosMegaMenu() {
        if (megaMenuLoaded) return megaMenuDataJoyeria;

        var intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(function (r) { setTimeout(r, 100); });
            intentos++;
        }
        if (!window.supabaseClient) return null;

        try {
            var catResult = await window.supabaseClient
                .from('categorias_tienda')
                .select('id, nombre, slug')
                .order('orden', { ascending: true });

            if (catResult.error || !catResult.data) return null;

            var subResult = await window.supabaseClient
                .from('subcategorias')
                .select('id, nombre, categoria')
                .order('nombre', { ascending: true });

            var subcategorias = subResult.data || [];

            // Filtrar: excluir categoría "Relojes" para Joyería
            megaMenuDataJoyeria = catResult.data
                .filter(function (cat) {
                    return cat.slug !== 'relojes';
                })
                .map(function (cat) {
                    var catNombre = cat.nombre.toLowerCase();
                    return {
                        nombre: cat.nombre,
                        slug: cat.slug,
                        subcategorias: subcategorias.filter(function (s) {
                            return s.categoria.toLowerCase() === catNombre;
                        })
                    };
                });

            megaMenuLoaded = true;
            return megaMenuDataJoyeria;
        } catch (err) {
            console.error('Error cargando mega menú:', err);
            return null;
        }
    }

    function construirMegaMenuJoyeria(datos) {
        var contenedor = document.getElementById('mega-menu-joyeria');
        if (!contenedor || !datos || datos.length === 0) return;

        var numCols = datos.length;
        contenedor.style.setProperty('--mega-cols', numCols);

        var html = '<div class="mega-menu-inner">';

        datos.forEach(function (cat) {
            var catSlug = encodeURIComponent(cat.slug);
            html += '<div class="mega-menu-category">';
            html += '<a href="/categoria/' + catSlug + '" class="mega-menu-cat-title">' + escapeHTML(cat.nombre) + '</a>';

            if (cat.subcategorias.length > 0) {
                html += '<ul class="mega-menu-subcats">';
                cat.subcategorias.forEach(function (sub) {
                    var subSlug = slugify(sub.nombre);
                    html += '<li><a href="/categoria/' + catSlug + '/' + encodeURIComponent(subSlug) + '">' + escapeHTML(sub.nombre) + '</a></li>';
                });
                html += '</ul>';
            }

            html += '</div>';
        });

        html += '</div>';
        html += '<div class="mega-menu-footer">';
        html += '<a href="/joyeria" class="mega-menu-all-link">Ver toda la joyería →</a>';
        html += '</div>';

        contenedor.innerHTML = html;
    }

    async function cargarMarcasRelojeria() {
        if (megaMenuMarcasRelojeria) return megaMenuMarcasRelojeria;

        var intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(function (r) { setTimeout(r, 100); });
            intentos++;
        }
        if (!window.supabaseClient) return null;

        try {
            var result = await window.supabaseClient
                .from('marcas')
                .select('id, nombre, imagen_url')
                .order('nombre', { ascending: true });

            if (result.error || !result.data) return null;

            megaMenuMarcasRelojeria = result.data;
            return megaMenuMarcasRelojeria;
        } catch (err) {
            console.error('Error cargando marcas relojería:', err);
            return null;
        }
    }

    function construirMegaMenuRelojeria(marcas) {
        var contenedor = document.getElementById('mega-menu-relojeria');
        if (!contenedor) return;

        if (!marcas || marcas.length === 0) {
            contenedor.innerHTML = '<div class="mega-menu-inner" style="justify-content: center; text-align: center; padding: 40px 48px;"><p style="color: #999; font-size: 14px; margin: 0;">Próximamente</p></div>';
            return;
        }

        var numCols = Math.min(marcas.length, 5);
        var html = '<div class="mega-menu-inner mega-menu-marcas-cols">';

        marcas.forEach(function (marca) {
            var marcaSlug = slugify(marca.nombre);
            html += '<div class="mega-menu-category">';
            html += '<a href="/relojeria/' + encodeURIComponent(marcaSlug) + '" class="mega-menu-cat-title">' + escapeHTML(marca.nombre) + '</a>';
            html += '</div>';
        });

        html += '</div>';
        html += '<div class="mega-menu-footer">';
        html += '<a href="/relojeria" class="mega-menu-all-link">Ver toda la relojería →</a>';
        html += '</div>';

        contenedor.innerHTML = html;
    }

    function positionMegaMenu(menuId) {
        var header = document.querySelector('.header');
        var menu = document.getElementById(menuId);
        if (!header || !menu) return;
        var rect = header.getBoundingClientRect();
        menu.style.top = rect.bottom + 'px';
    }

    // ===== JOYERÍA Desktop =====
    function showMegaMenuJoyeria() {
        clearTimeout(hideTimeoutJoyeria);
        var menu = document.getElementById('mega-menu-joyeria');
        if (menu) {
            positionMegaMenu('mega-menu-joyeria');
            menu.classList.add('active');
        }
        hideMegaMenuRelojeriaImmediate();
    }

    function hideMegaMenuJoyeria() {
        hideTimeoutJoyeria = setTimeout(function () {
            var menu = document.getElementById('mega-menu-joyeria');
            if (menu) menu.classList.remove('active');
        }, 200);
    }

    function hideMegaMenuJoyeriaImmediate() {
        clearTimeout(hideTimeoutJoyeria);
        var menu = document.getElementById('mega-menu-joyeria');
        if (menu) menu.classList.remove('active');
    }

    // ===== RELOJERÍA Desktop =====
    function showMegaMenuRelojeria() {
        clearTimeout(hideTimeoutRelojeria);
        var menu = document.getElementById('mega-menu-relojeria');
        if (menu) {
            positionMegaMenu('mega-menu-relojeria');
            menu.classList.add('active');
        }
        hideMegaMenuJoyeriaImmediate();
    }

    function hideMegaMenuRelojeria() {
        hideTimeoutRelojeria = setTimeout(function () {
            var menu = document.getElementById('mega-menu-relojeria');
            if (menu) menu.classList.remove('active');
        }, 200);
    }

    function hideMegaMenuRelojeriaImmediate() {
        clearTimeout(hideTimeoutRelojeria);
        var menu = document.getElementById('mega-menu-relojeria');
        if (menu) menu.classList.remove('active');
    }

    function initMegaMenuJoyeria() {
        var wrapper = document.getElementById('nav-joyeria-link');
        var menu = document.getElementById('mega-menu-joyeria');
        if (!wrapper || !menu) return;

        var preloaded = false;

        wrapper.addEventListener('mouseenter', function () {
            showMegaMenuJoyeria();
            if (!preloaded) {
                preloaded = true;
                cargarDatosMegaMenu().then(function (datos) {
                    if (datos) construirMegaMenuJoyeria(datos);
                });
            }
        });

        wrapper.addEventListener('mouseleave', hideMegaMenuJoyeria);
        menu.addEventListener('mouseenter', showMegaMenuJoyeria);
        menu.addEventListener('mouseleave', hideMegaMenuJoyeria);
    }

    function initMegaMenuRelojeria() {
        var wrapper = document.getElementById('nav-relojeria-link');
        var menu = document.getElementById('mega-menu-relojeria');
        if (!wrapper || !menu) return;

        var preloaded = false;

        wrapper.addEventListener('mouseenter', function () {
            showMegaMenuRelojeria();
            if (!preloaded) {
                preloaded = true;
                cargarMarcasRelojeria().then(function (marcas) {
                    construirMegaMenuRelojeria(marcas);
                });
            }
        });

        wrapper.addEventListener('mouseleave', hideMegaMenuRelojeria);
        menu.addEventListener('mouseenter', showMegaMenuRelojeria);
        menu.addEventListener('mouseleave', hideMegaMenuRelojeria);
    }

    // ===== MOBILE: Joyería =====
    function initMobileCategoriasJoyeria() {
        var container = document.getElementById('mobile-categorias-joyeria');
        var chevronBtn = document.getElementById('mobile-joyeria-chevron');
        var wrapper = document.getElementById('nav-joyeria-link');
        if (!container || !chevronBtn || !wrapper) return;

        var loaded = false;

        chevronBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var isOpen = wrapper.classList.contains('mobile-cats-open');
            wrapper.classList.toggle('mobile-cats-open', !isOpen);

            // Cerrar Relojería si está abierto
            var relojeriaWrapper = document.getElementById('nav-relojeria-link');
            if (relojeriaWrapper) relojeriaWrapper.classList.remove('mobile-cats-open');

            if (!isOpen && !loaded) {
                loaded = true;
                cargarDatosMegaMenu().then(function (datos) {
                    if (datos) construirMobileCategorias(datos, container);
                });
            }
        });
    }

    // ===== MOBILE: Relojería =====
    function initMobileCategoriasRelojeria() {
        var container = document.getElementById('mobile-categorias-relojeria');
        var chevronBtn = document.getElementById('mobile-relojeria-chevron');
        var wrapper = document.getElementById('nav-relojeria-link');
        if (!container || !chevronBtn || !wrapper) return;

        var loaded = false;

        chevronBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var isOpen = wrapper.classList.contains('mobile-cats-open');
            wrapper.classList.toggle('mobile-cats-open', !isOpen);

            // Cerrar Joyería si está abierto
            var joyeriaWrapper = document.getElementById('nav-joyeria-link');
            if (joyeriaWrapper) joyeriaWrapper.classList.remove('mobile-cats-open');

            if (!isOpen && !loaded) {
                loaded = true;
                cargarMarcasRelojeria().then(function (marcas) {
                    construirMobileMarcasRelojeria(marcas, container);
                });
            }
        });
    }

    function construirMobileMarcasRelojeria(marcas, container) {
        if (!container) return;

        if (!marcas || marcas.length === 0) {
            container.innerHTML = '<div class="mobile-cat-header" style="justify-content: center;"><span style="color: rgba(255,255,255,0.5); font-size: 0.9rem; padding: 12px 0;">Próximamente</span></div>';
            return;
        }

        var html = '';
        marcas.forEach(function (marca) {
            var marcaSlug = slugify(marca.nombre);
            html += '<div class="mobile-cat-accordion">';
            html += '<div class="mobile-cat-header">';
            html += '<a href="/relojeria/' + encodeURIComponent(marcaSlug) + '" class="mobile-cat-name" onclick="closeMobileMenu()">' + escapeHTML(marca.nombre) + '</a>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
    }

    function construirMobileCategorias(datos, container) {
        if (!datos || !container) return;

        var html = '';
        datos.forEach(function (cat) {
            var catSlug = encodeURIComponent(cat.slug);
            var hasSubs = cat.subcategorias.length > 0;

            html += '<div class="mobile-cat-accordion">';

            if (hasSubs) {
                html += '<div class="mobile-cat-header">';
                html += '<a href="/categoria/' + catSlug + '" class="mobile-cat-name" onclick="closeMobileMenu()">' + escapeHTML(cat.nombre) + '</a>';
                html += '<button class="mobile-cat-chevron" aria-label="Expandir ' + escapeHTML(cat.nombre) + '">';
                html += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                html += '</button>';
                html += '</div>';

                html += '<ul class="mobile-cat-subcats">';
                cat.subcategorias.forEach(function (sub) {
                    var subSlug = slugify(sub.nombre);
                    html += '<li><a href="/categoria/' + catSlug + '/' + encodeURIComponent(subSlug) + '" onclick="closeMobileMenu()">' + escapeHTML(sub.nombre) + '</a></li>';
                });
                html += '</ul>';
            } else {
                html += '<div class="mobile-cat-header">';
                html += '<a href="/categoria/' + catSlug + '" class="mobile-cat-name" onclick="closeMobileMenu()">' + escapeHTML(cat.nombre) + '</a>';
                html += '</div>';
            }

            html += '</div>';
        });

        container.innerHTML = html;

        // Event listeners para los chevrons de subcategorías
        var chevrons = container.querySelectorAll('.mobile-cat-chevron');
        chevrons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                var accordion = btn.closest('.mobile-cat-accordion');
                var isOpen = accordion.classList.contains('open');

                container.querySelectorAll('.mobile-cat-accordion.open').forEach(function (el) {
                    if (el !== accordion) el.classList.remove('open');
                });

                accordion.classList.toggle('open', !isOpen);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initMegaMenuJoyeria();
            initMegaMenuRelojeria();
            initMobileCategoriasJoyeria();
            initMobileCategoriasRelojeria();
        });
    } else {
        initMegaMenuJoyeria();
        initMegaMenuRelojeria();
        initMobileCategoriasJoyeria();
        initMobileCategoriasRelojeria();
    }
})();
