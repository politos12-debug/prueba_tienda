// Cart Slide Over Functions
// Usar window.cartSlideOpen para persistencia global
if (!window.cartSlideOpen) {
    window.cartSlideOpen = false;
}

// Constante de expiración del carrito (15 minutos)
if (!window.EXPIRACION_CARRITO_MS) {
    window.EXPIRACION_CARRITO_MS = 15 * 60 * 1000; // 15 minutos
}

// Función de inicialización global para sincronizar carrito desde localStorage
function initializeCart() {
    const carritoLocal = JSON.parse(localStorage.getItem('carrito') || '[]');
    window.carrito = carritoLocal;
    console.log('[initializeCart] Carrito inicializado desde localStorage:', carritoLocal.length, 'items');
    updateCartCount();
}

// Inicializar al cargar el documento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCart);
} else {
    initializeCart();
}

// Función global para manejar clicks en el carrito
function handleCartClick() {
    // Páginas donde no se puede abrir el slide
    const pagesNoSlide = ['/carrito', '/checkout', '/pago', '/pago-exitoso'];

    if (pagesNoSlide.includes(window.location.pathname)) {
        return;
    }

    // Si el slide está abierto, ciérralo
    if (window.cartSlideOpen) {
        closeCartSlide();
    } else {
        // Si no está abierto, ábrelo (siempre, incluso con carrito vacío)
        openCartSlide();
    }
}

// Función global para actualizar el contador del carrito en tiempo real
function updateCartCount() {
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const count = carrito.reduce((total, item) => total + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = count;
    }
}

function openCartSlide() {
    // Páginas donde no se puede abrir el slide
    const pagesNoSlide = ['/carrito', '/checkout', '/pago', '/pago-exitoso'];
    if (pagesNoSlide.includes(window.location.pathname)) {
        return;
    }

    const overlay = document.getElementById('cart-slide-overlay');
    const panel = document.getElementById('cart-slide-panel');

    if (!overlay || !panel) {
        console.error('Cart slide elements not found. Overlay:', !!overlay, 'Panel:', !!panel);
        return;
    }

    overlay.classList.add('active');
    panel.classList.add('active');
    window.cartSlideOpen = true;

    // Guardar posición actual del scroll
    window.scrollPosition = window.scrollY;

    // Bloquear scroll manteniendo la posición visual
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = -window.scrollPosition + 'px';

    renderCartSlide();
}

function closeCartSlide() {
    const overlay = document.getElementById('cart-slide-overlay');
    const panel = document.getElementById('cart-slide-panel');

    if (overlay && panel) {
        overlay.classList.remove('active');
        panel.classList.remove('active');
        window.cartSlideOpen = false;

        // Restaurar scroll de la página a su posición original
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';

        // Restaurar posición de scroll si fue guardada
        if (window.scrollPosition !== undefined) {
            window.scrollTo(0, window.scrollPosition);
        }
    }
}

function renderCartSlide() {
    // Leer carrito desde localStorage y sincronizar con window.carrito
    const carritoLocalStorage = JSON.parse(localStorage.getItem('carrito') || '[]');

    // Sincronizar window.carrito con localStorage si es necesario
    if (window.carrito && JSON.stringify(window.carrito) !== JSON.stringify(carritoLocalStorage)) {
        console.log('[renderCartSlide] Sincronizando window.carrito con localStorage');
        window.carrito = carritoLocalStorage;
    }

    const cart = carritoLocalStorage;
    const container = document.getElementById('cart-slide-items');
    const footerContent = document.getElementById('cart-slide-footer-content');

    if (!container || !footerContent) return;

    console.log('[renderCartSlide] Carrito actual:', cart.length, 'items');

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty-message">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>Tu carrito está vacío</p>
            </div>
        `;
        footerContent.innerHTML = '';
        return;
    }

    const itemsHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-image">
                <img src="${item.imagen}" alt="${item.nombre}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23ccc%22 stroke-width=%222%22%3E%3Crect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%222%22%3E%3C/rect%3E%3Ccircle cx=%228.5%22 cy=%228.5%22 r=%221.5%22%3E%3C/circle%3E%3Cpolyline points=%2221 15 16 10 5 21%22%3E%3C/polyline%3E%3C/svg%3E'" />
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-price">€${item.precio.toFixed(2)}</div>
                <div class="cart-item-quantity">
                    <button class="qty-btn-small" onclick="updateCartSlideQuantity(${index}, -1)">−</button>
                    <input type="number" class="qty-input-small" value="${item.cantidad}" readonly />
                    <button class="qty-btn-small" onclick="updateCartSlideQuantity(${index}, 1)">+</button>
                </div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCartSlide(${index})">Eliminar</button>
        </div>
    `).join('');

    container.innerHTML = itemsHTML;

    // Calcular totales
    const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const shipping = subtotal > 100 ? 0 : 3;
    const total = subtotal + shipping;

    footerContent.innerHTML = `
        <div class="cart-summary-row">
            <span>Subtotal:</span>
            <span>€${subtotal.toFixed(2)}</span>
        </div>
        <div class="cart-summary-row">
            <span>Envío:</span>
            <span>${shipping === 0 ? 'Gratis' : '€' + shipping.toFixed(2)}</span>
        </div>
        <div class="cart-summary-row total">
            <span>Total:</span>
            <span>€${total.toFixed(2)}</span>
        </div>
        <div class="cart-slide-buttons">
            <button class="btn-continue-shopping" onclick="closeCartSlide()">Seguir Comprando</button>
            <button class="btn-checkout" onclick="goToCheckout()">Finalizar Compra</button>
        </div>
    `;

    // ⚠️ Actualización de timer removida - manejada por PublicLayout.astro
}

// Lock para evitar race conditions al spamear botones +/-
let _updatingQuantity = false;

// direction: +1 para incrementar, -1 para decrementar
async function updateCartSlideQuantity(index, direction) {
    // Prevenir llamadas concurrentes (spam de botones)
    if (_updatingQuantity) return;
    _updatingQuantity = true;

    // Deshabilitar TODOS los botones de cantidad inmediatamente
    document.querySelectorAll('.qty-btn-small').forEach(btn => btn.disabled = true);

    try {
        // Leer carrito FRESCO desde localStorage DENTRO del mutex
        const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
        if (!cart[index]) return;

        const item = cart[index];
        const newQuantity = item.cantidad + direction;

        if (newQuantity < 1) {
            await removeFromCartSlide(index);
            return;
        }

        if (direction > 0) {
            // INCREMENTAR: El SERVIDOR valida y resta stock atómicamente
            const res = await fetch('/api/add-to-cart-validated', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: item.id, cantidad: 1 })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                mostrarErrorStockSlide(data.error || `No hay suficiente stock. Disponible: ${data.stockDisponible || 0}`);
                return;
            }

            // Servidor aprobó → ahora sí actualizar localStorage
            const freshCart = JSON.parse(localStorage.getItem('carrito') || '[]');
            if (freshCart[index]) {
                freshCart[index].cantidad += 1;
                localStorage.setItem('carrito', JSON.stringify(freshCart));
                window.carrito = freshCart;
            }

            console.log('[updateCartSlideQuantity] +1 aprobado por servidor para', item.nombre);

        } else {
            // DECREMENTAR: Restaurar stock en servidor y luego actualizar localStorage
            await fetch('/api/update-cart-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: item.id, cantidad: 1, accion: 'sumar' })
            });

            const freshCart = JSON.parse(localStorage.getItem('carrito') || '[]');
            if (freshCart[index]) {
                freshCart[index].cantidad -= 1;
                localStorage.setItem('carrito', JSON.stringify(freshCart));
                window.carrito = freshCart;
            }

            console.log('[updateCartSlideQuantity] -1 para', item.nombre);
        }

        window.dispatchEvent(new CustomEvent('carritoActualizado', {
            detail: { carrito: JSON.parse(localStorage.getItem('carrito') || '[]') }
        }));

    } catch (err) {
        console.error('Error en updateCartSlideQuantity:', err);
    } finally {
        _updatingQuantity = false;
        renderCartSlide();
        updateCartCount();
    }
}

async function removeFromCartSlide(index) {
    const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
    const productoEliminado = cart[index];
    
    cart.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(cart));

    // Sincronizar window.carrito
    window.carrito = cart;

    // Restaurar stock en BD si existe el producto
    if (productoEliminado && productoEliminado.cantidad && window.supabaseClient) {
        fetch('/api/update-cart-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: productoEliminado.id,
                cantidad: productoEliminado.cantidad,
                accion: 'sumar'
            })
        })
        .then(res => {
            if (!res.ok) {
                console.warn('[removeFromCartSlide] API error:', res.status);
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data?.success) {
                console.log('[removeFromCartSlide] Stock restaurado:', data);
                // 📢 Disparar evento para que otras páginas sepan que el stock cambió
                window.dispatchEvent(new CustomEvent('stockActualizado', {
                    detail: {
                        productId: productoEliminado.id,
                        stockAnterior: data.stockAnterior,
                        stockNuevo: data.stockNuevo
                    }
                }));
            }
        })
        .catch(err => console.warn('[removeFromCartSlide] Error restaurando stock:', err));
    }

    // Guardar en localStorage (carrito NO se guarda en BD)
    console.log('[removeFromCartSlide] Carrito actualizado en localStorage, no se sincroniza con BD');

    // Actualizar contador: buscar en Header
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        const count = cart.reduce((total, item) => total + item.cantidad, 0);
        cartCountEl.textContent = count;
    }

    // También llamar a updateCartCount global si existe
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    }

    renderCartSlide();

    // Si no hay más productos, cerrar el slide
    if (cart.length === 0) {
        setTimeout(() => {
            closeCartSlide();
        }, 300);
    }
}

function goToCheckout() {
    window.location.href = '/carrito';
}

// Cerrar slide al hacer clic en overlay
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('cart-slide-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeCartSlide);
    }

    // ⚠️ Timer de expiración removido - ahora gestionado globalmente en PublicLayout.astro
});

// Mostrar mensaje de error de stock
function mostrarErrorStockSlide(mensaje) {
    let errorDiv = document.getElementById('error-stock-msg-slide');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-msg-slide';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(255, 68, 68, 0.4);
            font-weight: bold;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        document.body.appendChild(errorDiv);
    }

    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';

    // Ocultar después de 3 segundos
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// Hacer funciones globales INMEDIATAMENTE
window.handleCartClick = handleCartClick;
window.updateCartCount = updateCartCount;
window.openCartSlide = openCartSlide;
window.closeCartSlide = closeCartSlide;
window.updateCartSlideQuantity = updateCartSlideQuantity;
window.removeFromCartSlide = removeFromCartSlide;
window.goToCheckout = goToCheckout;

// Inicializar contador cuando carga la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        updateCartCount();
    });
} else {
    // Si ya se cargó el DOM, ejecutar inmediatamente
    updateCartCount();
}

// Actualizar contador de expiración del carrito slide
// ⚠️ FUNCIÓN DESACTIVADA: La expiración ahora se maneja globalmente en PublicLayout.astro
function actualizarContadorExpiracionSlide() {
    // DESACTIVADA - Ver PublicLayout.astro -> gestionarExpirationCarrito()
    console.log('[cart-slide.js] actualizarContadorExpiracionSlide DESACTIVADA - usando función global');
}

// Debug: verificar que el slide existe
console.log('Cart slide functions loaded:');
console.log('- handleCartClick:', typeof window.handleCartClick);
console.log('- updateCartCount:', typeof window.updateCartCount);
console.log('- openCartSlide:', typeof window.openCartSlide);
console.log('- closeCartSlide:', typeof window.closeCartSlide);
console.log('- Overlay exists:', !!document.getElementById('cart-slide-overlay'));
console.log('- Panel exists:', !!document.getElementById('cart-slide-panel'));