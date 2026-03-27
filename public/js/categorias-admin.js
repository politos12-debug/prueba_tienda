// ─── Gestión de Categorías del Admin ───
(function () {
    let supabase = null;
    let categoriasData = [];
    let subcategoriasTemp = []; // subcategorías temporales en el modal
    let imagenCategoriaUrl = ''; // URL de la imagen subida
    let zonaSubidaIniciada = false;

    // Cloudinary config (misma que productos en admin.js)
    const CLOUDINARY_CAT = {
        cloudName: 'Dvwudlogd',
        uploadPreset: 'Galiana'
    };

    function waitForSupabase() {
        if (window.supabaseClient) {
            supabase = window.supabaseClient;
            cargarCategoriasAdmin();
        } else {
            setTimeout(waitForSupabase, 100);
        }
    }
    waitForSupabase();

    // ─── Subir imagen a Cloudinary ───
    async function subirImagenCategoria(file) {
        if (!file || !file.type.startsWith('image/')) return null;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CAT.uploadPreset);
            formData.append('folder', 'joyeria-galiana/categorias');

            const zonaSubida = document.getElementById('cat-zona-subida');
            if (zonaSubida) {
                zonaSubida.innerHTML = '<p style="margin:0; color:#d4af37; display:flex; align-items:center; justify-content:center; gap:8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Subiendo imagen...</p>';
                zonaSubida.style.pointerEvents = 'none';
            }

            const response = await fetch(
                'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CAT.cloudName + '/image/upload',
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                console.error('Error Cloudinary:', await response.text());
                restaurarZonaSubida();
                return null;
            }

            const data = await response.json();
            const url = 'https://res.cloudinary.com/' + CLOUDINARY_CAT.cloudName + '/image/upload/w_800,h_800,c_fill,q_auto,f_webp/' + data.public_id + '.webp';

            restaurarZonaSubida();
            return url;
        } catch (err) {
            console.error('Error subiendo imagen:', err);
            restaurarZonaSubida();
            return null;
        }
    }

    function restaurarZonaSubida() {
        const zonaSubida = document.getElementById('cat-zona-subida');
        if (zonaSubida) {
            zonaSubida.innerHTML = '<p style="margin:0; color:#666; font-size:0.95rem;">Haz clic o arrastra una imagen aquí</p><small style="display:block; margin-top:0.4rem; color:#999;">PNG, JPG, JPEG, WEBP</small><input type="file" id="cat-imagen-file" accept="image/*" style="display:none;">';
            zonaSubida.style.pointerEvents = '';
            vincularInputFile();
        }
    }

    function vincularInputFile() {
        const inputFile = document.getElementById('cat-imagen-file');
        if (inputFile) {
            inputFile.addEventListener('change', function (e) {
                var archivo = e.target.files[0];
                if (archivo) procesarArchivoCategoria(archivo);
            });
        }
    }

    async function procesarArchivoCategoria(archivo) {
        if (!archivo.type.startsWith('image/')) {
            alert('El archivo debe ser una imagen');
            return;
        }

        var url = await subirImagenCategoria(archivo);
        if (url) {
            imagenCategoriaUrl = url;
            document.getElementById('cat-imagen-url').value = url;
            mostrarPreviewImagen(url);
        } else {
            alert('Error al subir la imagen. Inténtalo de nuevo.');
        }
    }

    function mostrarPreviewImagen(url) {
        var preview = document.getElementById('cat-imagen-preview');
        var img = document.getElementById('cat-imagen-preview-img');
        var zona = document.getElementById('cat-zona-subida');

        if (url) {
            img.src = url;
            preview.style.display = 'block';
            if (zona) zona.style.display = 'none';
        } else {
            preview.style.display = 'none';
            if (zona) zona.style.display = 'block';
        }
    }

    window.eliminarImagenCategoria = function () {
        imagenCategoriaUrl = '';
        document.getElementById('cat-imagen-url').value = '';
        mostrarPreviewImagen(null);
    };

    function inicializarZonaSubidaCat() {
        var zonaSubida = document.getElementById('cat-zona-subida');
        var inputFile = document.getElementById('cat-imagen-file');
        if (!zonaSubida || !inputFile) return;

        // Click en zona
        zonaSubida.addEventListener('click', function (e) {
            if (e.target.tagName !== 'INPUT') {
                document.getElementById('cat-imagen-file').click();
            }
        });

        // File input change
        vincularInputFile();

        // Drag and drop
        zonaSubida.addEventListener('dragover', function (e) {
            e.preventDefault();
            zonaSubida.style.borderColor = '#720916';
            zonaSubida.style.backgroundColor = '#fff5f5';
        });

        zonaSubida.addEventListener('dragleave', function () {
            zonaSubida.style.borderColor = '#d4af37';
            zonaSubida.style.backgroundColor = '#fafaf8';
        });

        zonaSubida.addEventListener('drop', function (e) {
            e.preventDefault();
            zonaSubida.style.borderColor = '#d4af37';
            zonaSubida.style.backgroundColor = '#fafaf8';

            var archivo = e.dataTransfer.files[0];
            if (archivo && archivo.type.startsWith('image/')) {
                procesarArchivoCategoria(archivo);
            } else {
                alert('Por favor arrastra una imagen válida');
            }
        });

        zonaSubidaIniciada = true;
    }

    // ─── Cargar categorías ───
    async function cargarCategoriasAdmin() {
        var grid = document.getElementById('categorias-admin-grid');
        if (!grid) return;

        grid.innerHTML = '<p style="color:#999; text-align:center; grid-column: 1/-1;">Cargando categorías...</p>';

        var result = await supabase
            .from('categorias_tienda')
            .select('*')
            .order('orden', { ascending: true });

        if (result.error) {
            grid.innerHTML = '<p style="color:red;">Error al cargar categorías</p>';
            console.error(result.error);
            return;
        }

        categoriasData = result.data || [];

        // Ordenar: visibles primero, desactivadas al final
        categoriasData.sort(function (a, b) {
            if (a.visible === b.visible) return a.orden - b.orden;
            return a.visible ? -1 : 1;
        });

        // Cargar subcategorías de la tabla existente 'subcategorias'
        var subcResult = await supabase
            .from('subcategorias')
            .select('*')
            .order('nombre', { ascending: true });

        var subcatsPorCat = {};
        (subcResult.data || []).forEach(function (s) {
            var catKey = (s.categoria || '').toLowerCase();
            if (!subcatsPorCat[catKey]) subcatsPorCat[catKey] = [];
            subcatsPorCat[catKey].push(s);
        });

        grid.innerHTML = '';

        if (categoriasData.length === 0) {
            grid.innerHTML = '<p style="color:#999; text-align:center; grid-column: 1/-1;">No hay categorías creadas</p>';
            return;
        }

        categoriasData.forEach(function (cat) {
            var catKey = (cat.nombre || '').toLowerCase();
            var subcatsArr = subcatsPorCat[catKey] || [];
            var card = document.createElement('div');
            card.style.cssText = 'background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden; border:2px solid ' + (cat.visible ? '#d4af37' : '#e0e0e0') + '; transition: all 0.3s;';

            var imgSrc = cat.imagen_url || '';
            var imgHTML = imgSrc
                ? '<img src="' + imgSrc + '" alt="' + cat.nombre + '" style="width:100%; height:160px; object-fit:cover;">'
                : '<div style="width:100%; height:160px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#ccc;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';

            var subcatsHTML = subcatsArr.length > 0
                ? subcatsArr.map(function (s) { return '<span style="display:inline-block; padding:2px 10px; background:#faf3e0; color:#8b6914; border-radius:12px; font-size:0.78rem; font-weight:500;">' + s.nombre + '</span>'; }).join(' ')
                : '<span style="color:#bbb; font-size:0.85rem;">Sin subcategorías</span>';

            card.innerHTML =
                imgHTML +
                '<div style="padding:1rem;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">' +
                        '<h3 style="margin:0; font-size:1.1rem; color:#333;">' + cat.nombre + '</h3>' +
                        '<span style="padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:600; ' +
                            (cat.visible ? 'background:#e8f5e9; color:#2e7d32;' : 'background:#fce4ec; color:#c62828;') + '">' +
                            (cat.visible ? 'Visible' : 'Oculta') +
                        '</span>' +
                    '</div>' +
                    '<p style="color:#777; font-size:0.9rem; margin-bottom:0.7rem;">' + (cat.descripcion || '') + '</p>' +
                    '<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:1rem;">' + subcatsHTML + '</div>' +
                    '<div style="display:flex; gap:0.5rem;">' +
                        '<button onclick="toggleVisibilidadCategoria(' + cat.id + ', ' + cat.visible + ')" style="flex:1; padding:0.5rem; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:4px; ' +
                            (cat.visible ? 'background:#fce4ec; color:#c62828;' : 'background:#e8f5e9; color:#2e7d32;') + '">' +
                            (cat.visible ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Ocultar' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Mostrar') +
                        '</button>' +
                        '<button onclick="editarCategoria(' + cat.id + ')" style="flex:1; padding:0.5rem; background:#f0f0f0; color:#333; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>' +
                        '<button onclick="eliminarCategoria(' + cat.id + ', \'' + cat.nombre.replace(/'/g, "\\'") + '\')" style="padding:0.5rem 0.8rem; background:#fff; color:#c62828; border:1px solid #fcc; border-radius:6px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                    '</div>' +
                '</div>';

            grid.appendChild(card);
        });
    }

    // ─── Toggle visibilidad ───
    window.toggleVisibilidadCategoria = async function (id, estadoActual) {
        var visiblesActuales = categoriasData.filter(function (c) { return c.visible; }).length;

        // No permitir activar más de 6
        if (!estadoActual && visiblesActuales >= 6) {
            alert('Solo puede haber 6 categorías activas. Desactiva una antes de activar otra.');
            return;
        }

        var result = await supabase
            .from('categorias_tienda')
            .update({ visible: !estadoActual, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (result.error) {
            alert('Error al actualizar: ' + result.error.message);
            return;
        }
        cargarCategoriasAdmin();
    };

    // ─── Modal: abrir para crear ───
    window.abrirModalCategoria = function () {
        document.getElementById('cat-edit-id').value = '';
        document.getElementById('cat-nombre').value = '';
        document.getElementById('cat-descripcion').value = '';
        document.getElementById('cat-imagen-url').value = '';
        document.getElementById('modal-cat-titulo').textContent = 'Nueva Categoría';
        imagenCategoriaUrl = '';
        subcategoriasTemp = [];
        renderSubcategoriasTemp();
        mostrarPreviewImagen(null);
        document.getElementById('modal-categoria').style.display = 'flex';

        // Inicializar zona de subida si aún no se hizo
        if (!zonaSubidaIniciada) {
            setTimeout(inicializarZonaSubidaCat, 50);
        }
    };

    // ─── Modal: abrir para editar ───
    window.editarCategoria = async function (id) {
        var cat = categoriasData.find(function (c) { return c.id === id; });
        if (!cat) return;

        document.getElementById('cat-edit-id').value = id;
        document.getElementById('cat-nombre').value = cat.nombre;
        document.getElementById('cat-descripcion').value = cat.descripcion || '';
        document.getElementById('modal-cat-titulo').textContent = 'Editar Categoría';

        // Imagen
        imagenCategoriaUrl = cat.imagen_url || '';
        document.getElementById('cat-imagen-url').value = imagenCategoriaUrl;
        mostrarPreviewImagen(imagenCategoriaUrl || null);

        // Cargar subcategorías desde tabla 'subcategorias' por nombre de categoría
        var result = await supabase
            .from('subcategorias')
            .select('id, nombre')
            .ilike('categoria', cat.nombre)
            .order('nombre', { ascending: true });

        subcategoriasTemp = (result.data || []).map(function (s) { return { id: s.id, nombre: s.nombre }; });
        renderSubcategoriasTemp();
        document.getElementById('modal-categoria').style.display = 'flex';

        if (!zonaSubidaIniciada) {
            setTimeout(inicializarZonaSubidaCat, 50);
        }
    };

    // ─── Modal: cerrar ───
    window.cerrarModalCategoria = function () {
        document.getElementById('modal-categoria').style.display = 'none';
    };

    // ─── Subcategorías temporales ───
    window.agregarSubcategoriaInput = function () {
        var input = document.getElementById('cat-nueva-subcat');
        var nombre = input.value.trim();
        if (!nombre) return;

        if (subcategoriasTemp.some(function (s) { return s.nombre.toLowerCase() === nombre.toLowerCase(); })) {
            alert('Esta subcategoría ya existe');
            return;
        }

        subcategoriasTemp.push({ id: null, nombre: nombre });
        input.value = '';
        renderSubcategoriasTemp();
    };

    window.quitarSubcategoriaTemp = function (index) {
        subcategoriasTemp.splice(index, 1);
        renderSubcategoriasTemp();
    };

    function renderSubcategoriasTemp() {
        var container = document.getElementById('cat-subcategorias-list');
        container.innerHTML = '';

        subcategoriasTemp.forEach(function (sub, i) {
            var tag = document.createElement('span');
            tag.style.cssText = 'display:inline-flex; align-items:center; gap:6px; padding:5px 12px; background:#f5f0e5; color:#8b6914; border-radius:20px; font-size:0.88rem; font-weight:500;';
            tag.innerHTML = sub.nombre + ' <button onclick="quitarSubcategoriaTemp(' + i + ')" style="background:none; border:none; cursor:pointer; color:#c62828; font-size:1rem; line-height:1; padding:0;">✕</button>';
            container.appendChild(tag);
        });
    }

    // ─── Guardar categoría ───
    window.guardarCategoria = async function () {
        var editId = document.getElementById('cat-edit-id').value;
        var nombre = document.getElementById('cat-nombre').value.trim();
        var descripcion = document.getElementById('cat-descripcion').value.trim();
        var imgUrl = document.getElementById('cat-imagen-url').value.trim();

        if (!nombre) {
            alert('El nombre es obligatorio');
            return;
        }

        var slug = nombre.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Obtener nombre anterior antes de actualizar (para renombrar subcategorías)
        var nombreAnterior = '';
        if (editId) {
            var catAnterior = categoriasData.find(function (c) { return c.id === parseInt(editId); });
            nombreAnterior = catAnterior ? catAnterior.nombre : '';
        }

        if (editId) {
            // Actualizar categoría
            var resUpdate = await supabase
                .from('categorias_tienda')
                .update({ nombre: nombre, slug: slug, descripcion: descripcion, imagen_url: imgUrl, updated_at: new Date().toISOString() })
                .eq('id', parseInt(editId));

            if (resUpdate.error) {
                alert('Error al actualizar: ' + resUpdate.error.message);
                return;
            }

            // Sincronizar subcategorías en tabla 'subcategorias':
            // 1. Eliminar las que ya no están
            var existentes = await supabase
                .from('subcategorias')
                .select('id, nombre')
                .ilike('categoria', nombreAnterior || nombre);

            var idsExistentes = (existentes.data || []).map(function (s) { return s.id; });
            var idsConservados = subcategoriasTemp.filter(function (s) { return s.id !== null; }).map(function (s) { return s.id; });
            var idsEliminar = idsExistentes.filter(function (id) { return idsConservados.indexOf(id) === -1; });

            if (idsEliminar.length > 0) {
                await supabase.from('subcategorias').delete().in('id', idsEliminar);
            }

            // 2. Si se cambió el nombre de categoría, actualizar las existentes
            if (nombreAnterior && nombreAnterior !== nombre && idsConservados.length > 0) {
                await supabase
                    .from('subcategorias')
                    .update({ categoria: nombre.toLowerCase() })
                    .in('id', idsConservados);
            }

            // 3. Insertar subcategorías nuevas
            var nuevas = subcategoriasTemp.filter(function (s) { return s.id === null; });
            if (nuevas.length > 0) {
                var insertsNuevas = nuevas.map(function (s) {
                    return { nombre: s.nombre, categoria: nombre.toLowerCase() };
                });
                await supabase.from('subcategorias').insert(insertsNuevas);
            }

        } else {
            // Crear nueva categoría
            var maxOrden = categoriasData.reduce(function (max, c) { return c.orden > max ? c.orden : max; }, 0);

            // Verificar si ya hay 6 visibles
            var visiblesCount = categoriasData.filter(function (c) { return c.visible; }).length;
            var nuevaVisible = visiblesCount < 6;

            var resInsert = await supabase
                .from('categorias_tienda')
                .insert({ nombre: nombre, slug: slug, descripcion: descripcion, imagen_url: imgUrl, visible: nuevaVisible, orden: maxOrden + 1 })
                .select()
                .single();

            if (resInsert.error) {
                alert('Error al crear: ' + resInsert.error.message);
                return;
            }

            // Insertar subcategorías nuevas en tabla 'subcategorias'
            if (subcategoriasTemp.length > 0) {
                var inserts = subcategoriasTemp.map(function (s) {
                    return { nombre: s.nombre, categoria: nombre.toLowerCase() };
                });
                await supabase.from('subcategorias').insert(inserts);
            }
        }

        cerrarModalCategoria();
        cargarCategoriasAdmin();
    };

    // ─── Eliminar categoría ───
    window.eliminarCategoria = async function (id, nombre) {
        if (!confirm('¿Eliminar la categoría "' + nombre + '"? Se eliminarán también sus subcategorías.')) return;

        // Eliminar subcategorías de la tabla 'subcategorias' que pertenezcan a esta categoría
        await supabase.from('subcategorias').delete().ilike('categoria', nombre);

        // Eliminar la categoría
        var result = await supabase
            .from('categorias_tienda')
            .delete()
            .eq('id', id);

        if (result.error) {
            alert('Error al eliminar: ' + result.error.message);
            return;
        }

        cargarCategoriasAdmin();
    };
})();
