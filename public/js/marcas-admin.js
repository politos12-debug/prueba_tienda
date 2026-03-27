// ─── Gestión de Marcas del Admin ───
(function () {
    let supabase = null;
    let marcasData = [];
    let imagenMarcaUrl = '';
    let marcaEditarId = null;

    const CLOUDINARY_MARCA = {
        cloudName: 'Dvwudlogd',
        uploadPreset: 'Galiana'
    };

    function waitForSupabase() {
        if (window.supabaseClient) {
            supabase = window.supabaseClient;
            cargarMarcasAdmin();
        } else {
            setTimeout(waitForSupabase, 100);
        }
    }
    waitForSupabase();

    // ─── Subir imagen a Cloudinary ───
    async function subirImagenMarca(file) {
        if (!file || !file.type.startsWith('image/')) return null;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_MARCA.uploadPreset);
            formData.append('folder', 'joyeria-galiana/marcas');

            const zona = document.getElementById('marca-zona-subida');
            if (zona) {
                zona.innerHTML = '<p style="margin:0; color:#d4af37; display:flex; align-items:center; justify-content:center; gap:8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Subiendo imagen...</p>';
                zona.style.pointerEvents = 'none';
            }

            const response = await fetch(
                'https://api.cloudinary.com/v1_1/' + CLOUDINARY_MARCA.cloudName + '/image/upload',
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                console.error('Error Cloudinary:', await response.text());
                restaurarZonaSubidaMarca();
                return null;
            }

            const data = await response.json();
            const url = 'https://res.cloudinary.com/' + CLOUDINARY_MARCA.cloudName + '/image/upload/w_400,h_400,c_fit,q_auto,f_webp/' + data.public_id + '.webp';

            restaurarZonaSubidaMarca();
            return url;
        } catch (err) {
            console.error('Error subiendo imagen marca:', err);
            restaurarZonaSubidaMarca();
            return null;
        }
    }

    function restaurarZonaSubidaMarca() {
        const zona = document.getElementById('marca-zona-subida');
        if (zona) {
            zona.innerHTML = '<p style="margin:0; color:#666; font-size:0.95rem;">Haz clic o arrastra una imagen aquí</p><small style="display:block; margin-top:0.4rem; color:#999;">PNG, JPG, JPEG, WEBP</small><input type="file" id="marca-imagen-file" accept="image/*" style="display:none;">';
            zona.style.pointerEvents = '';
            vincularInputFileMarca();
        }
    }

    function vincularInputFileMarca() {
        const inputFile = document.getElementById('marca-imagen-file');
        if (inputFile) {
            inputFile.addEventListener('change', function (e) {
                const archivo = e.target.files[0];
                if (archivo) procesarArchivoMarca(archivo);
            });
        }
    }

    async function procesarArchivoMarca(file) {
        const url = await subirImagenMarca(file);
        if (url) {
            imagenMarcaUrl = url;
            document.getElementById('marca-imagen-url').value = url;
            const preview = document.getElementById('marca-imagen-preview');
            const previewImg = document.getElementById('marca-imagen-preview-img');
            previewImg.src = url;
            preview.style.display = 'block';
            document.getElementById('marca-zona-subida').style.display = 'none';
        }
    }

    // ─── Cargar marcas ───
    async function cargarMarcasAdmin() {
        const grid = document.getElementById('marcas-admin-grid');
        if (!grid) return;

        grid.innerHTML = '<p style="text-align:center; color:#999; padding:2rem;">Cargando marcas...</p>';

        const { data, error } = await supabase
            .from('marcas')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) {
            console.error('Error cargando marcas:', error);
            grid.innerHTML = '<p style="text-align:center; color:#c62828; padding:2rem;">Error al cargar marcas</p>';
            return;
        }

        marcasData = data || [];
        renderizarMarcas(marcasData);
    }

    function renderizarMarcas(marcas) {
        const grid = document.getElementById('marcas-admin-grid');
        if (!grid) return;

        if (marcas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:#999; padding:2rem; grid-column: 1 / -1;">No hay marcas creadas todavía. Usa el botón "+ Nueva Marca" para empezar.</p>';
            return;
        }

        grid.innerHTML = marcas.map(function (marca) {
            const imagenHtml = marca.imagen_url
                ? '<img src="' + marca.imagen_url + '" alt="' + marca.nombre + '" style="width:80px; height:80px; object-fit:contain; border-radius:8px; background:#f8f6f3;">'
                : '<div style="width:80px; height:80px; border-radius:8px; background:#f0ede8; display:flex; align-items:center; justify-content:center; color:#bbb;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></div>';

            return '<div style="background:white; border-radius:10px; padding:1.2rem; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #eee; display:flex; align-items:center; gap:1rem; transition:box-shadow 0.2s;">'
                + imagenHtml
                + '<div style="flex:1;">'
                + '<h4 style="margin:0 0 0.3rem 0; font-size:1.05rem; color:#333; word-break:break-word;">' + marca.nombre + '</h4>'
                + '<small style="color:#999;">' + new Date(marca.created_at).toLocaleDateString('es-ES') + '</small>'
                + '</div>'
                + '<div style="display:flex; flex-direction:column; gap:0.4rem; flex-shrink:0;">'
                + '<button onclick="editarMarca(\'' + marca.id + '\')" class="btn-editar" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:4px; border:none; cursor:pointer; background:#d4af37; color:white; font-weight:600;">Editar</button>'
                + '<button onclick="eliminarMarca(\'' + marca.id + '\', \'' + marca.nombre.replace(/'/g, "\\'") + '\')" class="btn-eliminar" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:4px; border:none; cursor:pointer; background:#c62828; color:white; font-weight:600;">Eliminar</button>'
                + '</div>'
                + '</div>';
        }).join('');
    }

    // ─── Filtrar marcas (búsqueda) ───
    window.filtrarMarcasAdmin = function () {
        const texto = (document.getElementById('buscar-marcas').value || '').toLowerCase().trim();
        if (!texto) {
            renderizarMarcas(marcasData);
            return;
        }
        const filtradas = marcasData.filter(function (m) {
            return m.nombre.toLowerCase().includes(texto);
        });
        renderizarMarcas(filtradas);
    };

    // ─── Modal Abrir / Cerrar ───
    window.abrirModalMarca = function () {
        marcaEditarId = null;
        imagenMarcaUrl = '';
        document.getElementById('marca-edit-id').value = '';
        document.getElementById('marca-nombre').value = '';
        document.getElementById('marca-imagen-url').value = '';
        document.getElementById('marca-imagen-preview').style.display = 'none';
        document.getElementById('marca-zona-subida').style.display = '';

        document.getElementById('modal-marca-titulo').textContent = 'Nueva Marca';
        document.getElementById('modal-marca').style.display = 'flex';

        restaurarZonaSubidaMarca();
        iniciarDragDropMarca();
    };

    window.cerrarModalMarca = function () {
        document.getElementById('modal-marca').style.display = 'none';
        marcaEditarId = null;
        imagenMarcaUrl = '';
    };

    // ─── Editar marca ───
    window.editarMarca = async function (id) {
        const marca = marcasData.find(function (m) { return m.id === id; });
        if (!marca) return;

        marcaEditarId = id;
        document.getElementById('marca-edit-id').value = id;
        document.getElementById('marca-nombre').value = marca.nombre;

        if (marca.imagen_url) {
            imagenMarcaUrl = marca.imagen_url;
            document.getElementById('marca-imagen-url').value = marca.imagen_url;
            document.getElementById('marca-imagen-preview-img').src = marca.imagen_url;
            document.getElementById('marca-imagen-preview').style.display = 'block';
            document.getElementById('marca-zona-subida').style.display = 'none';
        } else {
            imagenMarcaUrl = '';
            document.getElementById('marca-imagen-url').value = '';
            document.getElementById('marca-imagen-preview').style.display = 'none';
            document.getElementById('marca-zona-subida').style.display = '';
            restaurarZonaSubidaMarca();
        }

        document.getElementById('modal-marca-titulo').textContent = 'Editar Marca';
        document.getElementById('modal-marca').style.display = 'flex';
        iniciarDragDropMarca();
    };

    // ─── Guardar marca (crear o editar) ───
    window.guardarMarca = async function () {
        const nombre = document.getElementById('marca-nombre').value.trim();
        if (!nombre) {
            mostrarNotificacion('El nombre de la marca es obligatorio', 'error');
            return;
        }

        const datos = {
            nombre: nombre,
            imagen_url: imagenMarcaUrl || null
        };

        let result;
        if (marcaEditarId) {
            result = await supabase
                .from('marcas')
                .update(datos)
                .eq('id', marcaEditarId);
        } else {
            result = await supabase
                .from('marcas')
                .insert([datos]);
        }

        if (result.error) {
            if (result.error.code === '23505') {
                mostrarNotificacion('Ya existe una marca con ese nombre', 'error');
            } else {
                mostrarNotificacion('Error al guardar la marca: ' + result.error.message, 'error');
            }
            return;
        }

        mostrarNotificacion(marcaEditarId ? 'Marca actualizada correctamente' : 'Marca creada correctamente', 'success');
        cerrarModalMarca();
        cargarMarcasAdmin();
    };

    // ─── Eliminar marca ───
    window.eliminarMarca = function (id, nombre) {
        mostrarConfirmacion('¿Estás seguro de eliminar la marca "' + nombre + '"?', async function (confirmado) {
            if (!confirmado) return;

            const { error } = await supabase
                .from('marcas')
                .delete()
                .eq('id', id);

            if (error) {
                mostrarNotificacion('Error al eliminar la marca: ' + error.message, 'error');
                return;
            }

            mostrarNotificacion('Marca eliminada correctamente', 'success');
            cargarMarcasAdmin();
        });
    };

    // ─── Eliminar imagen del preview ───
    window.eliminarImagenMarca = function () {
        imagenMarcaUrl = '';
        document.getElementById('marca-imagen-url').value = '';
        document.getElementById('marca-imagen-preview').style.display = 'none';
        document.getElementById('marca-zona-subida').style.display = '';
        restaurarZonaSubidaMarca();
    };

    // ─── Drag & Drop ───
    function iniciarDragDropMarca() {
        const zona = document.getElementById('marca-zona-subida');
        if (!zona || zona.dataset.dragIniciado) return;
        zona.dataset.dragIniciado = 'true';

        zona.addEventListener('click', function () {
            const input = document.getElementById('marca-imagen-file');
            if (input) input.click();
        });

        zona.addEventListener('dragover', function (e) {
            e.preventDefault();
            zona.style.borderColor = '#720916';
            zona.style.background = '#fdf5e6';
        });

        zona.addEventListener('dragleave', function () {
            zona.style.borderColor = '#d4af37';
            zona.style.background = '#fafaf8';
        });

        zona.addEventListener('drop', function (e) {
            e.preventDefault();
            zona.style.borderColor = '#d4af37';
            zona.style.background = '#fafaf8';
            const archivo = e.dataTransfer.files[0];
            if (archivo) procesarArchivoMarca(archivo);
        });

        vincularInputFileMarca();
    }

    // Exponer carga para cambiarSeccion
    window.cargarMarcasAdmin = cargarMarcasAdmin;

})();
