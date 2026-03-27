// ========== GESTIÓN DE ÚLTIMAS TENDENCIAS (ADMIN) ==========

let tendenciasCategorias = [];
let tendenciaCategoriaActual = null;
let tendenciasProductosCache = [];
let tendenciasIdsSeleccionadosCache = new Set();

// Cargar categorías de tendencias (sincroniza con categorias_tienda)
async function cargarTendenciasCategorias() {
    if (!window.supabaseClient) return;

    try {
        // 1. Obtener todas las categorías de la tienda
        const { data: catTienda, error: errTienda } = await window.supabaseClient
            .from('categorias_tienda')
            .select('nombre')
            .order('orden', { ascending: true });

        if (errTienda) {
            console.error('Error cargando categorías tienda:', errTienda);
        }

        // 2. Obtener las categorías ya registradas en tendencias
        const { data: catTendencias, error: errTend } = await window.supabaseClient
            .from('tendencias_categorias')
            .select('*')
            .order('orden', { ascending: true });

        if (errTend) {
            console.error('Error cargando categorías tendencias:', errTend);
            return;
        }

        // 3. Detectar categorías nuevas (en tienda pero no en tendencias)
        const nombresExistentes = new Set((catTendencias || []).map(c => c.categoria));
        const nuevas = (catTienda || []).filter(c => !nombresExistentes.has(c.nombre));

        if (nuevas.length > 0) {
            const maxOrden = (catTendencias || []).reduce((max, c) => Math.max(max, c.orden || 0), 0);
            const inserts = nuevas.map((c, i) => ({
                categoria: c.nombre,
                visible: false,
                orden: maxOrden + i + 1
            }));

            const { error: errInsert } = await window.supabaseClient
                .from('tendencias_categorias')
                .insert(inserts);

            if (errInsert) {
                console.error('Error insertando nuevas categorías en tendencias:', errInsert);
            }

            // Recargar después de insertar
            const { data: dataFinal, error: errFinal } = await window.supabaseClient
                .from('tendencias_categorias')
                .select('*')
                .order('orden', { ascending: true });

            tendenciasCategorias = dataFinal || [];
        } else {
            tendenciasCategorias = catTendencias || [];
        }

        renderizarTendenciasCategorias();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Renderizar la lista de categorías con toggle
function renderizarTendenciasCategorias() {
    const container = document.getElementById('tendencias-categorias-list');
    if (!container) return;

    container.innerHTML = '';

    tendenciasCategorias.forEach(cat => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #fff; border: 2px solid ' + (cat.visible ? '#d4af37' : '#ddd') + '; border-radius: 8px; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; transition: all 0.3s ease;';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-size: 1.1rem;">${cat.categoria}</h4>
                <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                    <input type="checkbox" ${cat.visible ? 'checked' : ''} onchange="toggleCategoriaTendencia('${cat.categoria}', this.checked)" style="opacity: 0; width: 0; height: 0;">
                    <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ${cat.visible ? '#d4af37' : '#ccc'}; border-radius: 26px; transition: 0.3s;"></span>
                    <span style="position: absolute; content: ''; height: 20px; width: 20px; left: ${cat.visible ? '26px' : '3px'}; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;"></span>
                </label>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span style="font-size: 0.85rem; color: ${cat.visible ? '#2ecc71' : '#999'};">${cat.visible ? 'Visible' : 'Oculta'}</span>
            </div>
            <button onclick="abrirProductosTendencia('${cat.categoria}')" style="padding: 0.6rem 1rem; background: ${cat.visible ? '#d4af37' : '#999'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.3s;" ${!cat.visible ? 'disabled' : ''}>
                Gestionar Productos
            </button>
        `;

        container.appendChild(card);
    });
}

// Toggle visibilidad de categoría
async function toggleCategoriaTendencia(categoria, visible) {
    if (!window.supabaseClient) return;

    try {
        const { error } = await window.supabaseClient
            .from('tendencias_categorias')
            .update({ visible: visible })
            .eq('categoria', categoria);

        if (error) {
            console.error('Error actualizando visibilidad:', error);
            alert('Error al actualizar la visibilidad');
            return;
        }

        // Recargar
        await cargarTendenciasCategorias();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Abrir panel de productos para una categoría
async function abrirProductosTendencia(categoria) {
    tendenciaCategoriaActual = categoria;

    document.getElementById('tendencias-categorias-panel').style.display = 'none';
    document.getElementById('tendencias-productos-panel').style.display = 'block';
    document.getElementById('tendencias-categoria-titulo').textContent = 'Productos de: ' + categoria;

    await cargarProductosTendencia(categoria);
}

// Volver a la vista de categorías
function volverACategoriasTendencias() {
    tendenciaCategoriaActual = null;
    document.getElementById('tendencias-categorias-panel').style.display = 'block';
    document.getElementById('tendencias-productos-panel').style.display = 'none';
}

// Cargar productos de una categoría mostrando cuáles están seleccionados
async function cargarProductosTendencia(categoria) {
    if (!window.supabaseClient) return;

    try {
        // Cargar todos los productos de esta categoría
        const { data: productos, error: errProd } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', categoria)
            .order('nombre', { ascending: true });

        if (errProd) {
            console.error('Error cargando productos:', errProd);
            return;
        }

        // Cargar los productos ya seleccionados para tendencias
        const { data: seleccionados, error: errSel } = await window.supabaseClient
            .from('tendencias_productos')
            .select('producto_id')
            .eq('categoria', categoria);

        if (errSel) {
            console.error('Error cargando seleccionados:', errSel);
            return;
        }

        const idsSeleccionados = new Set((seleccionados || []).map(s => s.producto_id));

        tendenciasProductosCache = productos || [];
        tendenciasIdsSeleccionadosCache = idsSeleccionados;

        // Limpiar buscador al cargar nueva categoría
        const inputBuscar = document.getElementById('tendencias-buscar-producto');
        if (inputBuscar) inputBuscar.value = '';

        renderizarProductosTendencia(tendenciasProductosCache, idsSeleccionados);
    } catch (err) {
        console.error('Error:', err);
    }
}

// Filtrar productos por nombre o referencia
function filtrarProductosTendencia() {
    const input = document.getElementById('tendencias-buscar-producto');
    const termino = (input ? input.value : '').toLowerCase().trim();

    if (!termino) {
        renderizarProductosTendencia(tendenciasProductosCache, tendenciasIdsSeleccionadosCache);
        return;
    }

    const filtrados = tendenciasProductosCache.filter(p => {
        const nombre = (p.nombre || '').toLowerCase();
        const ref = (p.referencia || '').toLowerCase();
        return nombre.includes(termino) || ref.includes(termino);
    });

    renderizarProductosTendencia(filtrados, tendenciasIdsSeleccionadosCache);
}

// Renderizar tabla de productos con checkboxes
function renderizarProductosTendencia(productos, idsSeleccionados) {
    const tbody = document.getElementById('tendencias-productos-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    document.getElementById('tendencias-count-seleccionados').textContent = idsSeleccionados.size;

    productos.forEach(prod => {
        const isSelected = idsSeleccionados.has(prod.id);

        // Parsear imagen
        let imgSrc = '';
        if (prod.imagen_url) {
            try {
                const imgs = JSON.parse(prod.imagen_url);
                imgSrc = Array.isArray(imgs) ? imgs[0] : imgs;
            } catch (e) {
                imgSrc = prod.imagen_url;
            }
        }

        const tr = document.createElement('tr');
        tr.style.background = isSelected ? '#fffbeb' : '';

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                    onchange="toggleProductoTendencia(${prod.id}, '${tendenciaCategoriaActual}', this.checked)"
                    style="width: 20px; height: 20px; cursor: pointer; accent-color: #d4af37;">
            </td>
            <td>
                ${imgSrc ? `<img src="${imgSrc}" alt="${prod.nombre}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : '<span style="color:#ccc;">Sin imagen</span>'}
            </td>
            <td><strong>${prod.nombre}</strong>${prod.referencia ? `<br><span style="font-size:0.8rem;color:#888;">Ref: ${prod.referencia}</span>` : ''}</td>
            <td>€${parseFloat(prod.precio).toFixed(2)}</td>
            <td style="color: ${prod.stock > 0 ? '#2ecc71' : '#e74c3c'};">${prod.stock}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Añadir o quitar un producto de tendencias
async function toggleProductoTendencia(productoId, categoria, seleccionado) {
    if (!window.supabaseClient) return;

    try {
        if (seleccionado) {
            // Insertar
            const { error } = await window.supabaseClient
                .from('tendencias_productos')
                .insert({ producto_id: productoId, categoria: categoria });

            if (error) {
                console.error('Error añadiendo producto a tendencias:', error);
                alert('Error al añadir producto');
                return;
            }
        } else {
            // Eliminar
            const { error } = await window.supabaseClient
                .from('tendencias_productos')
                .delete()
                .eq('producto_id', productoId)
                .eq('categoria', categoria);

            if (error) {
                console.error('Error eliminando producto de tendencias:', error);
                alert('Error al eliminar producto');
                return;
            }
        }

        // Recargar productos
        await cargarProductosTendencia(categoria);
    } catch (err) {
        console.error('Error:', err);
    }
}

// Inicializar cuando se navega a la sección de tendencias
(function initTendenciasAdmin() {
    function registrarNavegacion() {
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(link => {
            link.addEventListener('click', function () {
                const section = this.getAttribute('data-section');
                if (section === 'tendencias') {
                    volverACategoriasTendencias();
                    // Esperar a que Supabase esté listo
                    waitForSupabaseTendencias(function() {
                        cargarTendenciasCategorias();
                    });
                }
            });
        });
    }

    // Esperar a Supabase antes de ejecutar callback
    function waitForSupabaseTendencias(callback, maxAttempts) {
        maxAttempts = maxAttempts || 100;
        var attempts = 0;
        function check() {
            attempts++;
            if (window.supabaseClient) {
                callback();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 150);
            } else {
                console.error('tendencias-admin: Supabase no disponible');
            }
        }
        check();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registrarNavegacion);
    } else {
        registrarNavegacion();
    }

    // Si la sección ya está activa al cargar (por ejemplo, recarga en la pestaña de tendencias)
    setTimeout(function() {
        var seccion = document.getElementById('tendencias');
        if (seccion && seccion.classList.contains('active')) {
            waitForSupabaseTendencias(function() {
                cargarTendenciasCategorias();
            });
        }
    }, 500);
})();
