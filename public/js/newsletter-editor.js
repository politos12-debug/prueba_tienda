// ========== NEWSLETTER EDITOR ==========
// Sistema modular de creación y envío de newsletters con editor visual,
// selector de productos, plantillas y vista previa en tiempo real.

const NewsletterEditor = {
    // --- Estado ---
    blocks: [],
    allProducts: [],
    subscriberCount: 0,
    isEditorOpen: false,
    activeBlockIndex: null,
    productPickerBlockIndex: null,
    siteUrl: '',

    // --- Plantillas predefinidas ---
    templates: {
        nueva_coleccion: {
            name: 'Nueva Colección',
            icon: '✨',
            description: 'Presenta tu última colección con estilo',
            subject: 'Descubre nuestra nueva colección',
            blocks: [
                { type: 'header', data: { title: 'NUEVA COLECCIÓN', subtitle: 'Piezas exclusivas que marcan tendencia', bgColor: '#720916' } },
                { type: 'text', data: { content: 'Nos complace presentarte las últimas incorporaciones a nuestra colección. Cada pieza ha sido cuidadosamente seleccionada para ofrecerte diseños únicos que resaltan tu estilo personal.', align: 'left' } },
                { type: 'products', data: { productIds: [], columns: 2 } },
                { type: 'button', data: { text: 'VER COLECCIÓN COMPLETA', url: '/productos', color: '#d4af37' } },
                { type: 'divider', data: { style: 'solid' } },
                { type: 'text', data: { content: 'Todas nuestras piezas incluyen envío asegurado y certificado de autenticidad.', align: 'center' } }
            ]
        },
        ofertas: {
            name: 'Ofertas Especiales',
            icon: '🏷️',
            description: 'Comunica promociones y descuentos',
            subject: '¡Ofertas exclusivas solo para ti!',
            blocks: [
                { type: 'header', data: { title: 'OFERTAS EXCLUSIVAS', subtitle: 'Solo por tiempo limitado', bgColor: '#1a1a2e' } },
                { type: 'text', data: { content: 'Hemos preparado una selección especial de productos con precios irresistibles. ¡No dejes pasar esta oportunidad!', align: 'left' } },
                { type: 'products', data: { productIds: [], columns: 2 } },
                { type: 'button', data: { text: 'APROVECHAR OFERTAS', url: '/productos', color: '#c0392b' } }
            ]
        },
        novedades: {
            name: 'Novedades',
            icon: '📰',
            description: 'Comparte noticias y actualizaciones',
            subject: 'Novedades de Joyería Galiana',
            blocks: [
                { type: 'header', data: { title: 'NOVEDADES', subtitle: 'Lo último de Joyería Galiana', bgColor: '#2c3e50' } },
                { type: 'text', data: { content: 'Queremos compartir contigo las últimas novedades de nuestra tienda. Nuevos productos, eventos especiales y mucho más te esperan.', align: 'left' } },
                { type: 'divider', data: { style: 'solid' } },
                { type: 'text', data: { content: 'Añade aquí más información sobre tus novedades o productos destacados.', align: 'left' } },
                { type: 'button', data: { text: 'VISITAR TIENDA', url: '/', color: '#d4af37' } }
            ]
        },
        temporada: {
            name: 'Campaña Temporada',
            icon: '🌸',
            description: 'Promociones de temporada',
            subject: 'Tu joya perfecta para esta temporada',
            blocks: [
                { type: 'header', data: { title: 'COLECCIÓN DE TEMPORADA', subtitle: 'Piezas que capturan la esencia del momento', bgColor: '#6c3483' } },
                { type: 'text', data: { content: 'Esta temporada trae consigo nuevas tendencias y estilos. Descubre las piezas que hemos seleccionado especialmente para ti.', align: 'left' } },
                { type: 'products', data: { productIds: [], columns: 2 } },
                { type: 'divider', data: { style: 'solid' } },
                { type: 'text', data: { content: '🎁 Envío gratuito en pedidos superiores a 50€', align: 'center' } },
                { type: 'button', data: { text: 'EXPLORAR COLECCIÓN', url: '/productos', color: '#6c3483' } }
            ]
        }
    },

    // ===========================
    // INICIALIZACIÓN
    // ===========================
    init() {
        this.detectSiteUrl();
        this.loadProducts();
        this.loadSubscriberCount();
        this.renderTemplateSelector();
    },

    detectSiteUrl() {
        // Siempre usar la URL de producción para los enlaces del email
        this.siteUrl = 'https://galiana-produccion.vercel.app';
    },

    // ===========================
    // CARGA DE DATOS
    // ===========================
    async loadProducts() {
        try {
            const client = window.supabaseClient || window.supabaseAdmin;
            if (!client) return;

            const { data, error } = await client
                .from('products')
                .select('id, nombre, precio, categoria, imagen_url, descripcion, stock, etiqueta')
                .order('created_at', { ascending: false });

            if (!error && data) {
                this.allProducts = data;
            }
        } catch (err) {
            console.error('Error cargando productos para newsletter:', err);
        }
    },

    async loadSubscriberCount() {
        try {
            const client = window.supabaseClient || window.supabaseAdmin;
            if (!client) return;

            const { data, error } = await client
                .from('newsletter_subscribers')
                .select('id', { count: 'exact' })
                .eq('status', 'activo');

            if (!error && data) {
                this.subscriberCount = data.length;
                const el = document.getElementById('nl-subscriber-count');
                if (el) el.textContent = this.subscriberCount;
                const el2 = document.getElementById('subscriber-count');
                if (el2) el2.textContent = this.subscriberCount;
                const sendCount = document.getElementById('nl-send-count');
                if (sendCount) sendCount.textContent = this.subscriberCount;
            }
        } catch (err) {
            console.error('Error cargando suscriptores:', err);
        }
    },

    // ===========================
    // GESTIÓN DE PLANTILLAS
    // ===========================
    renderTemplateSelector() {
        const container = document.getElementById('nl-template-grid');
        if (!container) return;

        container.innerHTML = Object.entries(this.templates).map(([key, tpl]) => `
            <div class="nl-template-card" onclick="NewsletterEditor.loadTemplate('${key}')">
                <div class="nl-template-icon">${tpl.icon}</div>
                <div class="nl-template-name">${tpl.name}</div>
                <div class="nl-template-desc">${tpl.description}</div>
            </div>
        `).join('') + `
            <div class="nl-template-card nl-template-blank" onclick="NewsletterEditor.startBlank()">
                <div class="nl-template-icon">📝</div>
                <div class="nl-template-name">En Blanco</div>
                <div class="nl-template-desc">Empieza desde cero</div>
            </div>
        `;
    },

    loadTemplate(templateKey) {
        const tpl = this.templates[templateKey];
        if (!tpl) return;

        // Clonar bloques para no mutar la plantilla original
        this.blocks = JSON.parse(JSON.stringify(tpl.blocks));
        document.getElementById('nl-subject').value = tpl.subject;
        this.openEditor();
    },

    startBlank() {
        this.blocks = [
            { type: 'header', data: { title: 'JOYERÍA GALIANA', subtitle: 'Tu mensaje aquí', bgColor: '#720916' } }
        ];
        document.getElementById('nl-subject').value = '';
        this.openEditor();
    },

    // ===========================
    // EDITOR: ABRIR / CERRAR
    // ===========================
    openEditor() {
        this.isEditorOpen = true;
        document.getElementById('nl-template-section').style.display = 'none';
        document.getElementById('nl-editor-container').style.display = 'block';
        this.renderBlocks();
        this.updatePreview();
    },

    closeEditor() {
        if (!confirm('¿Deseas cerrar el editor? Se perderán los cambios no guardados.')) return;
        this.isEditorOpen = false;
        this.blocks = [];
        this.activeBlockIndex = null;
        document.getElementById('nl-editor-container').style.display = 'none';
        document.getElementById('nl-template-section').style.display = 'block';
    },

    // ===========================
    // GESTIÓN DE BLOQUES
    // ===========================
    addBlock(type) {
        const defaults = {
            header: { title: 'TÍTULO', subtitle: 'Subtítulo aquí', bgColor: '#720916' },
            text: { content: 'Escribe tu texto aquí...', align: 'left' },
            products: { productIds: [], columns: 2 },
            button: { text: 'VER MÁS', url: '/productos', color: '#d4af37' },
            divider: { style: 'solid' },
            image: { url: '', alt: '', link: '' }
        };

        this.blocks.push({ type, data: { ...defaults[type] } });
        this.renderBlocks();
        this.updatePreview();

        // Scroll al nuevo bloque
        const container = document.getElementById('nl-blocks-container');
        if (container) {
            setTimeout(() => container.scrollTop = container.scrollHeight, 50);
        }
    },

    removeBlock(index) {
        this.blocks.splice(index, 1);
        if (this.activeBlockIndex === index) this.activeBlockIndex = null;
        this.renderBlocks();
        this.updatePreview();
    },

    moveBlock(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.blocks.length) return;
        const temp = this.blocks[index];
        this.blocks[index] = this.blocks[newIndex];
        this.blocks[newIndex] = temp;
        this.renderBlocks();
        this.updatePreview();
    },

    updateBlockData(index, field, value) {
        if (this.blocks[index]) {
            this.blocks[index].data[field] = value;
            this.updatePreview();
        }
    },

    // ===========================
    // RENDERIZADO DE BLOQUES EN EDITOR
    // ===========================
    renderBlocks() {
        const container = document.getElementById('nl-blocks-container');
        if (!container) return;

        if (this.blocks.length === 0) {
            container.innerHTML = '<div class="nl-empty-blocks">Añade bloques usando la barra superior</div>';
            return;
        }

        container.innerHTML = this.blocks.map((block, i) => this.renderBlockEditor(block, i)).join('');

        // Inicializar dropzones de imagen después de renderizar
        this.blocks.forEach((block, i) => {
            if (block.type === 'image' && !block.data.url) {
                this.initImageDropzone(i);
            }
        });
    },

    renderBlockEditor(block, index) {
        const typeLabels = {
            header: 'Cabecera',
            text: 'Texto',
            products: 'Productos',
            button: 'Botón',
            divider: 'Divisor',
            image: 'Imagen'
        };
        const typeIcons = {
            header: '🎨',
            text: '📝',
            products: '💎',
            button: '🔗',
            divider: '➖',
            image: '🖼️'
        };

        let fieldsHTML = '';

        switch (block.type) {
            case 'header':
                fieldsHTML = `
                    <div class="nl-field">
                        <label>Título</label>
                        <input type="text" value="${this.escapeAttr(block.data.title)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'title', this.value)" />
                    </div>
                    <div class="nl-field">
                        <label>Subtítulo</label>
                        <input type="text" value="${this.escapeAttr(block.data.subtitle)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'subtitle', this.value)" />
                    </div>
                    <div class="nl-field">
                        <label>Color de fondo</label>
                        <div class="nl-color-presets">
                            ${['#720916', '#1a1a2e', '#2c3e50', '#6c3483', '#1e8449', '#d4af37'].map(c => `
                                <button class="nl-color-btn ${block.data.bgColor === c ? 'active' : ''}" 
                                        style="background:${c}" 
                                        onclick="NewsletterEditor.updateBlockData(${index}, 'bgColor', '${c}'); NewsletterEditor.renderBlocks();">
                                </button>
                            `).join('')}
                            <input type="color" value="${block.data.bgColor}" 
                                   onchange="NewsletterEditor.updateBlockData(${index}, 'bgColor', this.value); NewsletterEditor.renderBlocks();" 
                                   class="nl-color-custom" title="Color personalizado" />
                        </div>
                    </div>
                `;
                break;

            case 'text':
                fieldsHTML = `
                    <div class="nl-field">
                        <label>Contenido</label>
                        <textarea rows="4" oninput="NewsletterEditor.updateBlockData(${index}, 'content', this.value)">${this.escapeHtml(block.data.content)}</textarea>
                        <div class="nl-text-format-bar">
                            <button type="button" title="Negrita" onclick="NewsletterEditor.wrapTextSelection(${index}, '<b>', '</b>')"><b>N</b></button>
                            <button type="button" title="Cursiva" onclick="NewsletterEditor.wrapTextSelection(${index}, '<i>', '</i>')"><i>C</i></button>
                            <button type="button" title="Enlace" onclick="NewsletterEditor.insertLink(${index})">🔗</button>
                        </div>
                    </div>
                    <div class="nl-field">
                        <label>Alineación</label>
                        <div class="nl-align-btns">
                            ${['left', 'center', 'right'].map(a => `
                                <button class="${block.data.align === a ? 'active' : ''}" 
                                        onclick="NewsletterEditor.updateBlockData(${index}, 'align', '${a}'); NewsletterEditor.renderBlocks();">
                                    ${a === 'left' ? '⬛⬜⬜' : a === 'center' ? '⬜⬛⬜' : '⬜⬜⬛'}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;

            case 'products': {
                const selectedProducts = (block.data.productIds || [])
                    .map(id => this.allProducts.find(p => p.id === id))
                    .filter(Boolean);

                const productsListHTML = selectedProducts.length > 0
                    ? selectedProducts.map(p => `
                        <div class="nl-selected-product">
                            <img src="${this.escapeAttr(this.getProductImage(p))}" alt="${this.escapeAttr(p.nombre)}" onerror="this.src='/images/placeholder.png'" />
                            <div class="nl-selected-product-info">
                                <span class="nl-sp-name">${this.escapeHtml(p.nombre)}</span>
                                <span class="nl-sp-price">€${parseFloat(p.precio).toFixed(2)}</span>
                            </div>
                            <button class="nl-sp-remove" onclick="NewsletterEditor.removeProductFromBlock(${index}, ${p.id})">×</button>
                        </div>
                    `).join('')
                    : '<p class="nl-no-products">No hay productos seleccionados</p>';

                fieldsHTML = `
                    <div class="nl-field">
                        <label>Productos seleccionados</label>
                        <div class="nl-selected-products-list">${productsListHTML}</div>
                        <button type="button" class="nl-btn-add-product" onclick="NewsletterEditor.openProductPicker(${index})">
                            + Añadir Productos
                        </button>
                    </div>
                    <div class="nl-field">
                        <label>Columnas</label>
                        <div class="nl-align-btns">
                            ${[1, 2].map(n => `
                                <button class="${block.data.columns === n ? 'active' : ''}" 
                                        onclick="NewsletterEditor.updateBlockData(${index}, 'columns', ${n}); NewsletterEditor.renderBlocks();">
                                    ${n} col${n > 1 ? 's' : ''}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;
            }

            case 'button':
                fieldsHTML = `
                    <div class="nl-field">
                        <label>Texto del botón</label>
                        <input type="text" value="${this.escapeAttr(block.data.text)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'text', this.value)" />
                    </div>
                    <div class="nl-field">
                        <label>URL destino</label>
                        <input type="text" value="${this.escapeAttr(block.data.url)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'url', this.value)" placeholder="https://..." />
                    </div>
                    <div class="nl-field">
                        <label>Color</label>
                        <div class="nl-color-presets">
                            ${['#d4af37', '#720916', '#c0392b', '#2c3e50', '#1e8449', '#6c3483'].map(c => `
                                <button class="nl-color-btn ${block.data.color === c ? 'active' : ''}" 
                                        style="background:${c}" 
                                        onclick="NewsletterEditor.updateBlockData(${index}, 'color', '${c}'); NewsletterEditor.renderBlocks();">
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;

            case 'divider':
                fieldsHTML = `
                    <div class="nl-field">
                        <label>Estilo</label>
                        <div class="nl-align-btns">
                            ${['solid', 'dotted', 'space'].map(s => `
                                <button class="${block.data.style === s ? 'active' : ''}" 
                                        onclick="NewsletterEditor.updateBlockData(${index}, 'style', '${s}'); NewsletterEditor.renderBlocks();">
                                    ${s === 'solid' ? '━━━' : s === 'dotted' ? '┈┈┈' : '⬜⬜⬜'}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;

            case 'image': {
                const hasImage = !!block.data.url;
                fieldsHTML = `
                    <div class="nl-field">
                        <label>Imagen</label>
                        ${hasImage ? `
                            <div class="nl-image-uploaded">
                                <img src="${this.escapeAttr(block.data.url)}" alt="preview" onerror="this.style.display='none'" />
                                <button type="button" class="nl-image-remove" onclick="NewsletterEditor.updateBlockData(${index}, 'url', ''); NewsletterEditor.renderBlocks(); NewsletterEditor.updatePreview();">Cambiar imagen</button>
                            </div>
                        ` : `
                            <div class="nl-image-dropzone" data-block="${index}">
                                <div class="nl-dropzone-content">
                                    <div class="nl-dropzone-icon">🖼️</div>
                                    <p>Arrastra una imagen aquí</p>
                                    <span>o</span>
                                    <label class="nl-dropzone-btn">
                                        Seleccionar archivo
                                        <input type="file" accept="image/*" class="nl-image-file-input" style="display:none" />
                                    </label>
                                    <p class="nl-dropzone-hint">JPG, PNG, WebP — máx. 10MB</p>
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="nl-field">
                        <label>Texto alternativo</label>
                        <input type="text" value="${this.escapeAttr(block.data.alt)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'alt', this.value)" 
                               placeholder="Descripción de la imagen" />
                    </div>
                    <div class="nl-field">
                        <label>Enlace (opcional)</label>
                        <input type="text" value="${this.escapeAttr(block.data.link)}" 
                               oninput="NewsletterEditor.updateBlockData(${index}, 'link', this.value)" 
                               placeholder="https://..." />
                    </div>
                `;
                break;
            }
        }

        return `
            <div class="nl-block-card" data-index="${index}">
                <div class="nl-block-header">
                    <span class="nl-block-type">${typeIcons[block.type]} ${typeLabels[block.type]}</span>
                    <div class="nl-block-actions">
                        <button class="nl-block-btn" onclick="NewsletterEditor.moveBlock(${index}, -1)" title="Mover arriba" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button class="nl-block-btn" onclick="NewsletterEditor.moveBlock(${index}, 1)" title="Mover abajo" ${index === this.blocks.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="nl-block-btn nl-block-btn-delete" onclick="NewsletterEditor.removeBlock(${index})" title="Eliminar">×</button>
                    </div>
                </div>
                <div class="nl-block-fields">${fieldsHTML}</div>
            </div>
        `;
    },

    // ===========================
    // TEXT FORMATTING HELPERS
    // ===========================
    wrapTextSelection(blockIndex, openTag, closeTag) {
        const textareas = document.querySelectorAll(`#nl-blocks-container .nl-block-card[data-index="${blockIndex}"] textarea`);
        const textarea = textareas[0];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        if (start === end) return; // no selection

        const selected = text.substring(start, end);
        const newText = text.substring(0, start) + openTag + selected + closeTag + text.substring(end);
        textarea.value = newText;
        this.updateBlockData(blockIndex, 'content', newText);
    },

    insertLink(blockIndex) {
        const url = prompt('Introduce la URL del enlace:');
        if (!url) return;

        const textareas = document.querySelectorAll(`#nl-blocks-container .nl-block-card[data-index="${blockIndex}"] textarea`);
        const textarea = textareas[0];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end) || 'texto del enlace';
        const linkHtml = `<a href="${url}" style="color: #d4af37; text-decoration: underline;">${selected}</a>`;
        const newText = text.substring(0, start) + linkHtml + text.substring(end);
        textarea.value = newText;
        this.updateBlockData(blockIndex, 'content', newText);
    },

    // ===========================
    // SELECTOR DE PRODUCTOS
    // ===========================
    openProductPicker(blockIndex) {
        this.productPickerBlockIndex = blockIndex;
        const modal = document.getElementById('nl-product-picker');
        if (!modal) return;

        modal.style.display = 'flex';
        document.getElementById('nl-product-search').value = '';
        this.renderProductGrid(this.allProducts);
    },

    closeProductPicker() {
        const modal = document.getElementById('nl-product-picker');
        if (modal) modal.style.display = 'none';
        this.productPickerBlockIndex = null;
    },

    renderProductGrid(products) {
        const grid = document.getElementById('nl-product-grid');
        if (!grid) return;

        const blockIndex = this.productPickerBlockIndex;
        const block = this.blocks[blockIndex];
        const selectedIds = block ? (block.data.productIds || []) : [];

        if (!products || products.length === 0) {
            grid.innerHTML = '<p class="nl-no-results">No se encontraron productos</p>';
            return;
        }

        grid.innerHTML = products.map(p => {
            const isSelected = selectedIds.includes(p.id);
            return `
                <div class="nl-product-card ${isSelected ? 'selected' : ''}" onclick="NewsletterEditor.toggleProduct(${p.id})">
                    <div class="nl-product-card-img">
                        <img src="${this.escapeAttr(this.getProductImage(p))}" alt="${this.escapeAttr(p.nombre)}" onerror="this.src='/images/placeholder.png'" />
                        ${isSelected ? '<div class="nl-product-check">✓</div>' : ''}
                    </div>
                    <div class="nl-product-card-info">
                        <span class="nl-pc-name">${this.escapeHtml(p.nombre)}</span>
                        <span class="nl-pc-price">€${parseFloat(p.precio).toFixed(2)}</span>
                        <span class="nl-pc-cat">${this.escapeHtml(p.categoria || '')}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    searchProducts(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.renderProductGrid(this.allProducts);
            return;
        }
        const filtered = this.allProducts.filter(p =>
            (p.nombre || '').toLowerCase().includes(q) ||
            (p.categoria || '').toLowerCase().includes(q) ||
            (p.descripcion || '').toLowerCase().includes(q)
        );
        this.renderProductGrid(filtered);
    },

    toggleProduct(productId) {
        const blockIndex = this.productPickerBlockIndex;
        if (blockIndex === null || !this.blocks[blockIndex]) return;

        const ids = this.blocks[blockIndex].data.productIds || [];
        const idx = ids.indexOf(productId);
        if (idx > -1) {
            ids.splice(idx, 1);
        } else {
            ids.push(productId);
        }
        this.blocks[blockIndex].data.productIds = ids;

        // Re-render the product grid to update selection state
        const searchVal = document.getElementById('nl-product-search')?.value || '';
        if (searchVal) {
            this.searchProducts(searchVal);
        } else {
            this.renderProductGrid(this.allProducts);
        }
    },

    confirmProductSelection() {
        this.closeProductPicker();
        this.renderBlocks();
        this.updatePreview();
    },

    removeProductFromBlock(blockIndex, productId) {
        if (!this.blocks[blockIndex]) return;
        const ids = this.blocks[blockIndex].data.productIds || [];
        const idx = ids.indexOf(productId);
        if (idx > -1) ids.splice(idx, 1);
        this.renderBlocks();
        this.updatePreview();
    },

    // ===========================
    // GENERACIÓN DE HTML DEL EMAIL
    // ===========================
    generateEmailHTML() {
        const baseUrl = this.siteUrl;
        let blocksHTML = this.blocks.map(block => this.generateBlockHTML(block, baseUrl)).join('');

        return `
<div style="font-family: Georgia, 'Times New Roman', serif; background: #f8f6f3; padding: 30px 0; margin: 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; background: #ffffff; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        ${blocksHTML}
        <tr>
            <td style="background: #2c2c2c; padding: 30px; text-align: center;">
                <p style="color: #d4af37; font-size: 20px; margin: 0 0 8px; letter-spacing: 3px; font-weight: 300; font-family: Georgia, 'Times New Roman', serif;">JOYERÍA GALIANA</p>
                <p style="color: #aaa; font-size: 12px; margin: 0 0 12px; font-family: Arial, sans-serif;">Sanlúcar de Barrameda, España</p>
                <p style="margin: 0;">
                    <a href="${baseUrl}" style="color: #d4af37; font-size: 12px; text-decoration: underline; font-family: Arial, sans-serif;">Visitar tienda</a>
                </p>
                <p style="color: #666; font-size: 11px; margin: 18px 0 0; font-family: Arial, sans-serif;">&copy; 2026 Joyería Galiana. Todos los derechos reservados.</p>
            </td>
        </tr>
    </table>
</div>`.trim();
    },

    generateBlockHTML(block, baseUrl) {
        switch (block.type) {
            case 'header': {
                const bg = block.data.bgColor || '#720916';
                return `
        <tr>
            <td style="background: ${bg}; padding: 48px 30px; text-align: center;">
                <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 3px; font-family: Georgia, 'Times New Roman', serif;">${this.escapeHtml(block.data.title)}</h1>
                ${block.data.subtitle ? `<p style="color: rgba(255,255,255,0.85); margin: 14px 0 0; font-size: 15px; font-weight: 300; font-family: Georgia, 'Times New Roman', serif;">${this.escapeHtml(block.data.subtitle)}</p>` : ''}
            </td>
        </tr>`;
            }

            case 'text': {
                const align = block.data.align || 'left';
                return `
        <tr>
            <td style="padding: 28px 36px; text-align: ${align};">
                <p style="color: #444; font-size: 15px; line-height: 1.8; margin: 0; font-family: Georgia, 'Times New Roman', serif;">${block.data.content}</p>
            </td>
        </tr>`;
            }

            case 'products': {
                const ids = block.data.productIds || [];
                const products = ids.map(id => this.allProducts.find(p => p.id === id)).filter(Boolean);
                if (products.length === 0) return '';

                const cols = block.data.columns || 2;

                if (cols === 1) {
                    // Single column: products stacked
                    const rows = products.map(p => {
                        const imgUrl = this.getEmailProductImage(p, 280, 280);
                        const productUrl = baseUrl + '/productos/' + p.id;
                        return `
        <tr>
            <td style="padding: 12px 36px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #faf9f7; border-radius: 6px; overflow: hidden;">
                    <tr>
                        <td width="140" style="vertical-align: top;">
                            <a href="${productUrl}" style="text-decoration: none;">
                                <img src="${this.escapeAttr(imgUrl)}" alt="${this.escapeAttr(p.nombre)}" width="140" height="140" style="display: block; width: 140px; height: 140px;" />
                            </a>
                        </td>
                        <td style="vertical-align: middle; padding: 16px 20px;">
                            <a href="${productUrl}" style="text-decoration: none;">
                                <p style="color: #333; font-size: 16px; font-weight: 600; margin: 0 0 6px; font-family: Georgia, 'Times New Roman', serif;">${this.escapeHtml(p.nombre)}</p>
                            </a>
                            ${p.categoria ? `<p style="color: #999; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif;">${this.escapeHtml(p.categoria)}</p>` : ''}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>`;
                    }).join('');
                    return rows;
                }

                // Two columns layout
                const rows = [];
                for (let i = 0; i < products.length; i += 2) {
                    const p1 = products[i];
                    const p2 = products[i + 1];

                    const cellHTML = (p) => {
                        if (!p) return '<td width="48%" style="vertical-align: top;"></td>';
                        const imgUrl = this.getEmailProductImage(p, 480, 400);
                        const productUrl = baseUrl + '/productos/' + p.id;
                        return `
                        <td width="48%" style="vertical-align: top; padding: 8px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #faf9f7; border-radius: 6px; overflow: hidden;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${productUrl}" style="text-decoration: none;">
                                            <img src="${this.escapeAttr(imgUrl)}" alt="${this.escapeAttr(p.nombre)}" width="240" height="200" style="display: block; width: 100%; height: auto;" />
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 12px; text-align: center;">
                                        <a href="${productUrl}" style="text-decoration: none;">
                                            <p style="color: #333; font-size: 14px; font-weight: 600; margin: 0; font-family: Georgia, 'Times New Roman', serif;">${this.escapeHtml(p.nombre)}</p>
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>`;
                    };

                    rows.push(`
        <tr>
            <td style="padding: 8px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        ${cellHTML(p1)}
                        <td width="4%"></td>
                        ${cellHTML(p2)}
                    </tr>
                </table>
            </td>
        </tr>`);
                }
                return rows.join('');
            }

            case 'button': {
                const color = block.data.color || '#d4af37';
                const textColor = this.getContrastColor(color);
                let url = block.data.url || '#';
                if (url.startsWith('/')) url = baseUrl + url;
                return `
        <tr>
            <td style="padding: 24px 36px; text-align: center;">
                <a href="${url}" style="display: inline-block; background: ${color}; color: ${textColor}; padding: 14px 40px; text-decoration: none; border-radius: 3px; font-weight: 600; font-size: 14px; letter-spacing: 1.5px; font-family: Arial, sans-serif;">${this.escapeHtml(block.data.text)}</a>
            </td>
        </tr>`;
            }

            case 'divider': {
                const style = block.data.style || 'solid';
                if (style === 'space') {
                    return `<tr><td style="padding: 20px 0;"></td></tr>`;
                }
                const borderStyle = style === 'dotted' ? 'dotted' : 'solid';
                return `
        <tr>
            <td style="padding: 8px 36px;">
                <hr style="border: none; border-top: 1px ${borderStyle} #e0e0e0; margin: 0;" />
            </td>
        </tr>`;
            }

            case 'image': {
                if (!block.data.url) return '';
                const imgTag = `<img src="${this.escapeAttr(block.data.url)}" alt="${this.escapeAttr(block.data.alt || '')}" width="540" style="display: block; width: 100%; max-width: 540px; height: auto; border-radius: 4px;" />`;
                const content = block.data.link
                    ? `<a href="${this.escapeAttr(block.data.link)}" style="text-decoration: none;">${imgTag}</a>`
                    : imgTag;
                return `
        <tr>
            <td style="padding: 16px 30px; text-align: center;">${content}</td>
        </tr>`;
            }

            default:
                return '';
        }
    },

    // ===========================
    // VISTA PREVIA
    // ===========================
    updatePreview() {
        const frame = document.getElementById('nl-preview-frame');
        if (!frame) return;
        const html = this.generateEmailHTML();
        frame.innerHTML = `<div class="nl-preview-scale">${html}</div>`;
    },

    showFullPreview() {
        const html = this.generateEmailHTML();
        const subject = document.getElementById('nl-subject')?.value || 'Sin asunto';

        const modal = document.getElementById('nl-full-preview');
        if (!modal) return;

        document.getElementById('nl-full-preview-subject').textContent = subject;
        document.getElementById('nl-full-preview-content').innerHTML = html;
        modal.style.display = 'flex';
    },

    closeFullPreview() {
        const modal = document.getElementById('nl-full-preview');
        if (modal) modal.style.display = 'none';
    },

    // ===========================
    // ENVÍO
    // ===========================
    async sendNewsletter() {
        const subject = document.getElementById('nl-subject')?.value?.trim();
        if (!subject) {
            mostrarNotificacion('Debes escribir un asunto para el newsletter', 'warning');
            return;
        }

        if (this.blocks.length === 0) {
            mostrarNotificacion('El newsletter no tiene contenido', 'warning');
            return;
        }

        if (this.subscriberCount === 0) {
            mostrarNotificacion('No hay suscriptores activos', 'warning');
            return;
        }

        // Mostrar confirmación
        const confirmed = confirm(`¿Enviar este newsletter a ${this.subscriberCount} suscriptor${this.subscriberCount !== 1 ? 'es' : ''}?\n\nAsunto: ${subject}`);
        if (!confirmed) return;

        const sendBtn = document.getElementById('nl-send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span class="nl-spinner"></span> Enviando...';
        }

        try {
            const htmlContent = this.generateEmailHTML();
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            const response = await fetch('/api/send-newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    htmlContent,
                    adminEmail: currentUser.email || 'admin@joyeriagaliana.es',
                    adminId: currentUser.id
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                mostrarNotificacion(`Newsletter enviado a ${result.emailsSent} suscriptor${result.emailsSent !== 1 ? 'es' : ''}`, 'success');
                this.closeEditor();
                // Actualizar datos
                this.loadSubscriberCount();
                loadNewsletterData();
            } else {
                mostrarNotificacion('Error al enviar: ' + (result.error || 'Error desconocido'), 'error');
            }
        } catch (err) {
            console.error('Error enviando newsletter:', err);
            mostrarNotificacion('Error al enviar el newsletter', 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = 'Enviar Newsletter';
            }
        }
    },

    // ===========================
    // UTILIDADES
    // ===========================
    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    getProductImage(product) {
        const raw = product.imagen_url;
        if (!raw) return '/images/placeholder.png';
        // Si es un array directo
        if (Array.isArray(raw)) return raw[0] || '/images/placeholder.png';
        // Si es un string JSON array
        if (typeof raw === 'string' && raw.startsWith('[')) {
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length > 0) return arr[0];
            } catch (e) { /* no-op */ }
        }
        // URL simple
        return raw;
    },

    // Genera URL con transformaciones Cloudinary para emails (crop server-side, no object-fit)
    getEmailProductImage(product, width, height) {
        const url = this.getProductImage(product);
        if (!url || !url.includes('cloudinary.com')) return url;
        // Reemplazar transformaciones existentes o insertar nuevas
        // URL format: .../image/upload/[transforms]/public_id.ext
        const uploadIdx = url.indexOf('/image/upload/');
        if (uploadIdx === -1) return url;
        const base = url.substring(0, uploadIdx + '/image/upload/'.length);
        // Extraer public_id (todo después de la última transformación)
        const afterUpload = url.substring(uploadIdx + '/image/upload/'.length);
        // Quitar transformaciones existentes para obtener public_id
        const parts = afterUpload.split('/');
        // Las transformaciones contienen '_' o son como 'w_1200,h_1200,...'
        // El public_id es lo que queda después de las transformaciones
        let publicIdParts = [];
        let foundNonTransform = false;
        for (const part of parts) {
            if (!foundNonTransform && /^[a-z]_/.test(part)) continue; // es transformación
            foundNonTransform = true;
            publicIdParts.push(part);
        }
        const publicId = publicIdParts.join('/');
        return `${base}w_${width},h_${height},c_fill,q_auto,f_jpg/${publicId}`;
    },

    getContrastColor(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#333333' : '#ffffff';
    },

    // ===========================
    // SUBIDA DE IMÁGENES A CLOUDINARY
    // ===========================
    async uploadImageToCloudinary(file, blockIndex) {
        if (!file || !file.type.startsWith('image/')) {
            mostrarNotificacion('El archivo debe ser una imagen', 'error');
            return;
        }

        // Mostrar estado de carga
        const dropzone = document.querySelector(`#nl-blocks-container .nl-block-card[data-index="${blockIndex}"] .nl-image-dropzone`);
        if (dropzone) {
            dropzone.classList.add('uploading');
            dropzone.querySelector('.nl-dropzone-content').innerHTML = `
                <div class="nl-upload-spinner"></div>
                <p>Subiendo imagen...</p>
            `;
        }

        try {
            // Usar la función global subirImagen de admin.js
            if (typeof subirImagen === 'function') {
                const url = await subirImagen(file, 'newsletter');
                if (url) {
                    this.updateBlockData(blockIndex, 'url', url);
                    this.renderBlocks();
                    this.updatePreview();
                    mostrarNotificacion('Imagen subida correctamente', 'success');
                } else {
                    mostrarNotificacion('Error al subir la imagen', 'error');
                    this.renderBlocks();
                }
            } else {
                // Fallback: subir directamente con la config de Cloudinary
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'Galiana');
                formData.append('folder', 'joyeria-galiana/newsletter');

                const response = await fetch('https://api.cloudinary.com/v1_1/Dvwudlogd/image/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    mostrarNotificacion('Error al subir la imagen', 'error');
                    this.renderBlocks();
                    return;
                }

                const data = await response.json();
                const url = `https://res.cloudinary.com/Dvwudlogd/image/upload/q_auto,f_webp/${data.public_id}.webp`;
                this.updateBlockData(blockIndex, 'url', url);
                this.renderBlocks();
                this.updatePreview();
                mostrarNotificacion('Imagen subida correctamente', 'success');
            }
        } catch (err) {
            console.error('Error subiendo imagen:', err);
            mostrarNotificacion('Error al subir la imagen', 'error');
            this.renderBlocks();
        }
    },

    initImageDropzone(blockIndex) {
        const dropzone = document.querySelector(`#nl-blocks-container .nl-block-card[data-index="${blockIndex}"] .nl-image-dropzone`);
        if (!dropzone || dropzone.dataset.initialized) return;
        dropzone.dataset.initialized = 'true';

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.uploadImageToCloudinary(file, blockIndex);
        });

        const input = dropzone.querySelector('.nl-image-file-input');
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.uploadImageToCloudinary(file, blockIndex);
            });
        }
    }
};
