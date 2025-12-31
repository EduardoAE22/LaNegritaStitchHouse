// store.js

// Config
const WHATSAPP_NUMBER = '529381952228';
const CART_STORAGE_KEY = 'ln_cart';
const THEME_STORAGE_KEY = 'ln_theme';
const SUPABASE_URL = window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';
const SUPABASE_BUCKET = 'products';
const ADMIN_EMAILS = ['acostasolutions.dev@gmail.com'];
const ADMIN_DISPLAY_NAME_BY_EMAIL = {
  'acostasolutions.dev@gmail.com': 'Eduardo Acosta',
};

function getSavedTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored || 'default';
}

function applyTheme(themeId) {
  const target = themeId && typeof themeId === 'string' && themeId.trim()
    ? themeId.trim()
    : 'default';
  document.body.dataset.theme = target;

  const badgeEl = document.querySelector('.hero__badge');
  if (badgeEl) {
    if (!badgeEl.dataset.defaultText) {
      badgeEl.dataset.defaultText = badgeEl.textContent || '';
    }
    if (target === 'reyes') {
      badgeEl.textContent = '🎁 Edición Reyes';
    } else {
      badgeEl.textContent = badgeEl.dataset.defaultText || badgeEl.textContent || '';
    }
  }
}

function saveTheme(themeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId || 'default');
  } catch (err) {
    console.warn('[theme] no se pudo guardar tema', err);
  }
}

// Estado
let products = [];
let cart = [];
let activeCategory = 'all';
let viewMode = 'category'; // 'category' | 'catalogo'
const hasCatalogUI = !!document.getElementById('products-grid');
const hasCartUI =
  document.getElementById('cart-count') &&
  document.getElementById('cart-panel') &&
  document.getElementById('cart-overlay') &&
  document.getElementById('cart-items') &&
  document.getElementById('cart-total');
let supabaseClient = null;
let currentUser = null;
let isAdmin = false;

// DOM
const productsGrid = document.getElementById('products-grid');
const productsFeedback = document.getElementById('products-feedback');
const filterButtonsContainer = document.getElementById('filter-buttons');

const cartBtn = document.getElementById('cart-btn');
const cartCount = document.getElementById('cart-count');
const cartPanel = document.getElementById('cart-panel');
const cartOverlay = document.getElementById('cart-overlay');
const closeCartBtn = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const cartWhatsappBtn = document.getElementById('cart-whatsapp');
const adminBtn = document.getElementById('admin-btn');
const heroBadgeEl = document.querySelector('.hero__badge');

const menuToggle = document.getElementById('menu-toggle');
const headerNav = document.querySelector('.header__nav');
const menuOverlay = document.getElementById('menu-overlay');
const adminLink = document.getElementById('admin-link');
const catAddBtn = document.getElementById('cat-add-btn');
const catEditBtn = document.getElementById('cat-edit-btn');
const catDeleteBtn = document.getElementById('cat-delete-btn');
const themesBtn = document.getElementById('themes-btn');
const themesModal = document.getElementById('themes-modal');
const themesModalOverlay = document.getElementById('themes-modal-overlay');
const themesModalClose = document.getElementById('themes-modal-close');
const themesList = document.getElementById('themes-list');
const themesReset = document.getElementById('themes-reset');
const themesApplyClose = document.getElementById('themes-apply-close');

if (heroBadgeEl && !heroBadgeEl.dataset.defaultText) {
  heroBadgeEl.dataset.defaultText = heroBadgeEl.textContent || '';
}

applyTheme(getSavedTheme());

const categoryCards = document.querySelectorAll('.category-card');


// Modal imagen producto
const imageModal = document.getElementById('image-modal');
const imageModalOverlay = document.getElementById('image-modal-overlay');
const imageModalClose = document.getElementById('image-modal-close');
const imageModalImg = document.getElementById('image-modal-img');
const imageModalCaption = document.getElementById('image-modal-caption');

//Splash delay
const SPLASH_HIDE_DELAY = 2500; // 3 segundos (ajusta al gusto)

// Inicializar Supabase client
supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// (Opcional) Evita exponer el cliente globalmente en producción
// window.supabaseClient = supabaseClient;

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function capitalizeWords(text) {
  return (text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function userIsAdmin(user) {
  if (!user) return false;
  const email = normalizeEmail(user.email);
  const allowList = ADMIN_EMAILS.map(normalizeEmail);
  const role = user?.app_metadata?.role || null;
  return allowList.includes(email) || role === 'superadmin' || role === 'admin';
}

function getSafeUserFullName(user) {
  if (!user) return 'Cuenta';
  const email = user.email || '';
  const emailKey = normalizeEmail(email);
  if (ADMIN_DISPLAY_NAME_BY_EMAIL[emailKey]) {
    return ADMIN_DISPLAY_NAME_BY_EMAIL[emailKey];
  }

  const meta = user.user_metadata || {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.first_name && meta.last_name ? `${meta.first_name} ${meta.last_name}` : '',
  ];

  const chosen =
    candidates.find((c) => typeof c === 'string' && c.trim()) ||
    (email.split('@')[0] || 'Cuenta');

  if (chosen === email.split('@')[0]) {
    const cleaned = chosen.replace(/[\.\-_]+/g, ' ');
    return capitalizeWords(cleaned);
  }

  return chosen.trim();
}

function getFirstNameAndSurname(fullName) {
  const parts = (fullName || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Cuenta';
  return capitalizeWords(parts.slice(0, 2).join(' '));
}

function renderSessionButton(user) {
  if (!adminBtn) return;

  if (!user) {
    adminBtn.classList.remove('admin-btn--user');
    adminBtn.replaceChildren();
    adminBtn.textContent = 'Admin';
    adminBtn.title = 'Iniciar sesión';
    return;
  }

  adminBtn.classList.add('admin-btn--user');
  const fullName = getSafeUserFullName(user);
  const label = getFirstNameAndSurname(fullName);

  const mainSpan = document.createElement('span');
  mainSpan.className = 'admin-btn__name';
  mainSpan.textContent = label;

  const subSpan = document.createElement('span');
  subSpan.className = 'admin-btn__sub';
  subSpan.textContent = 'Cerrar sesión';

  adminBtn.replaceChildren(mainSpan, subSpan);
  adminBtn.title = 'Cerrar sesión';
}

function updateAdminUI() {
  const showAdmin = !!isAdmin;
  if (adminLink) {
    adminLink.hidden = !showAdmin;
    if (showAdmin) adminLink.removeAttribute('hidden');
    else adminLink.setAttribute('hidden', '');
  }
  if (catAddBtn) catAddBtn.hidden = !showAdmin;
  if (catEditBtn) catEditBtn.hidden = !showAdmin;
  if (catDeleteBtn) catDeleteBtn.hidden = !showAdmin;

  renderSessionButton(currentUser);
}

// =========================
// SESIÓN / AUTH
// =========================

async function ensureSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Error verificando sesión', error);
  }

  const session = data?.session || null;
  currentUser = session?.user || null;
  isAdmin = userIsAdmin(currentUser);
  console.log('ensureSession → user:', currentUser?.email, 'isAdmin:', isAdmin);
  updateAdminUI();
  return session;
}

// =========================
// PRODUCTOS
// =========================

async function loadProducts() {
  if (!hasCatalogUI) {
    console.log('[loadProducts] sin UI de catálogo, se omite');
    return;
  }
  setProductsFeedback('Cargando catálogo...', false);

  try {
    console.log('[loadProducts] consulta con supabase-js…');

    const { data, error } = await supabaseClient
      .from('products')
      .select('id,nombre,precio,costo,categoria,descripcion,stock,imagen_url,activo')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('[loadProducts] error', error);
      throw error;
    }

    products = (data || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      costo: p.costo,
      descripcion: p.descripcion,
      categoria: p.categoria,
      imagen: p.imagen_url || '',
      stock: typeof p.stock === 'number' ? p.stock : null,
      activo: p.activo !== false,
    }));

    buildFilters(products);
    renderProducts();

    setProductsFeedback(products.length ? '' : 'Aún no hay productos cargados.', false);
  } catch (err) {
    console.error('Error cargando productos:', err);
    setProductsFeedback(
      'No se pudieron cargar los productos desde Supabase. Revisa tu conexión o las políticas (RLS).',
      true
    );
  }
}

function setProductsFeedback(message, isError = false) {
  if (!productsFeedback) return;
  productsFeedback.textContent = message;
  productsFeedback.classList.toggle('products-feedback--error', !!isError);
}

function buildFilters(list) {
  if (!filterButtonsContainer) return;
  const categories = Array.from(new Set(list.map((p) => p.categoria).filter(Boolean)));
  const allCats = ['all', ...categories];
  filterButtonsContainer.innerHTML = '';
  allCats.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.textContent = cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.dataset.cat = cat;
    btn.classList.toggle('is-active', activeCategory === cat);
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderProducts();
    });
    filterButtonsContainer.appendChild(btn);
  });
}

function applyCategoryFilter(categoryName) {
  if (!categoryName) return;

  // Seteamos categoría activa
  activeCategory = categoryName;

  // Actualizar botones de filtro visualmente
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    const btnCat = btn.dataset.cat;
    btn.classList.toggle('is-active', btnCat === categoryName);
  });

  // Renderizar productos con ese filtro
  renderProducts();

  // Hacer scroll suave al catálogo
  const section = document.getElementById('catalogo-destacado');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function sendProductToWhatsApp(product) {
  const name = product.nombre || 'Producto';
  const price = product.precio ? `$${product.precio} MXN` : 'sin precio';
  const cat = product.categoria ? `Categoría: ${product.categoria}` : '';
  const desc = product.descripcion ? `\n${product.descripcion}` : '';

  const text =
    `Hola 👋 me interesa este producto de La Negrita Stitch House:\n\n` +
    `• ${name}\n` +
    `• ${price}\n` +
    (cat ? `• ${cat}\n` : '') +
    (desc ? `${desc}\n` : '\n') +
    `\nEstá agotado, pero quisiera cotizarlo para sobre pedido. ¿Me ayudas con tiempos y costo final?`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}


function renderProducts() {
  if (!productsGrid) return;
  productsGrid.innerHTML = '';

  const visibleBase =
    activeCategory === 'all'
      ? products
      : products.filter((product) => product.categoria === activeCategory);

  const visible =
    viewMode === 'category'
      ? visibleBase.filter((p) => {
          const s =
            typeof p.stock === 'number' && !Number.isNaN(p.stock)
              ? p.stock
              : null;
          // En vista categoría mostramos disponibles.
          // Si no manejas stock (null), lo dejamos pasar.
          return s === null || s > 0;
        })
      : visibleBase; // catálogo: todo (aunque esté en 0)

  if (!products.length) {
    setProductsFeedback('Aún no hay productos cargados.', false);
    return;
  }

  if (!visible.length) {
    setProductsFeedback('No hay productos en esta categoría.', false);
    return;
  }

  setProductsFeedback('', false);

  visible.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const imgBtn = document.createElement('button');
    imgBtn.type = 'button';
    imgBtn.className = 'product-card__image-btn';
    imgBtn.dataset.id = product.id;

    if (product.imagen) {
      const img = document.createElement('img');
      img.src = product.imagen;
      img.alt = product.nombre;
      imgBtn.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'product-card__image-placeholder';
      placeholder.textContent = 'Imagen pendiente';
      imgBtn.appendChild(placeholder);
    }

    // Siempre que haya imagen abrimos modal; si no hay, no hace nada
    imgBtn.addEventListener('click', () => {
      if (!product.imagen) return;
      openImageModal(product);
    });

    const body = document.createElement('div');
    body.className = 'product-card__body';

    const title = document.createElement('h3');
    title.textContent = product.nombre;

    const price = document.createElement('p');
    price.className = 'product-card__price';
    price.textContent = `$${product.precio} MXN`;

    const stockLine = document.createElement('p');
    stockLine.className = 'product-card__stock';

    let stockValue =
      typeof product.stock === 'number' && !Number.isNaN(product.stock)
        ? product.stock
        : null;

    if (stockValue === null) {
      stockLine.textContent = '';
    } else if (stockValue <= 0) {
      stockLine.textContent = 'Agotado';
    } else {
      stockLine.textContent =
        stockValue === 1
          ? '1 pieza disponible'
          : `${stockValue} piezas disponibles`;
    }

    const desc = document.createElement('p');
    desc.className = 'product-card__desc';
    desc.textContent = product.descripcion;

    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-primary btn-full';
    btnAdd.type = 'button';
    btnAdd.textContent = 'Agregar al carrito';
    btnAdd.addEventListener('click', () => addToCart(product));

    let outOfStockNote = null;
    if (stockValue !== null && stockValue <= 0) {
      // Catálogo: permitir encargo por WhatsApp (no carrito)
      btnAdd.textContent = 'Encargar por WhatsApp';
      btnAdd.disabled = false;
      btnAdd.classList.remove('btn-primary--disabled');

      btnAdd.addEventListener('click', () => sendProductToWhatsApp(product));

      // Aviso visual junto al botón
      outOfStockNote = document.createElement('p');
      outOfStockNote.className = 'product-card__note product-card__note--out';
      outOfStockNote.textContent = 'Agotado ahora, encárgalo por WhatsApp.';
    }

    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(stockLine);
    body.appendChild(desc);
    if (outOfStockNote) body.appendChild(outOfStockNote);
    body.appendChild(btnAdd);

    card.appendChild(imgBtn);
    card.appendChild(body);
    productsGrid.appendChild(card);
  });

  // Ya no rellenamos las listas de categorías dinámicas
  //renderCategoryItems();
}

// =========================
// CARRITO
// =========================

// =========================
// HELPERS DE STOCK
// =========================

function getProductById(id) {
  return products.find((p) => p.id === id);
}

function getMaxAvailable(product) {
  if (!product) return Infinity; // por si no lo encuentra
  const stock =
    typeof product.stock === 'number' && !Number.isNaN(product.stock)
      ? product.stock
      : null;
  if (stock === null || stock < 0) return Infinity;
  return stock;
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
}

function addToCart(product) {
  const existing = cart.find((item) => item.id === product.id);
  const max = getMaxAvailable(product);
  const currentQty = existing ? existing.cantidad : 0;
  const newQty = currentQty + 1;

  if (newQty > max) {
    if (max === 0) {
      alert('Este producto está agotado por el momento.');
    } else {
      alert(
        `Solo hay ${max} pieza(s) disponible(s) de este producto.\n` +
          'Ya agregaste todas las piezas disponibles al carrito.'
      );
    }
    return;
  }

  if (existing) {
    existing.cantidad = newQty;
  } else {
    cart.push({
      id: product.id,
      nombre: product.nombre,
      precio: product.precio,
      cantidad: 1,
    });
  }

  updateCartBadge();
  renderCart();
  persistCart();
  openCart();
}

function updateCartBadge() {
  if (!cartCount) return;
  const totalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);
  cartCount.textContent = totalItems;
}

function renderCart() {
  if (!cartItemsContainer || !cartTotalEl) return;
  cartItemsContainer.innerHTML = '';

  if (cart.length === 0) {
    cartItemsContainer.textContent = 'Tu carrito está vacío.';
    cartTotalEl.textContent = '$0 MXN';
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    const info = document.createElement('div');
    info.className = 'cart-item__info';
    // ⚠️ Evitamos innerHTML para no abrir la puerta a XSS si algún dato viene contaminado
    const strong = document.createElement('strong');
    strong.textContent = item.nombre;
    const priceLine = document.createElement('div');
    priceLine.textContent = `$${item.precio} MXN c/u`;
    info.appendChild(strong);
    info.appendChild(document.createElement('br'));
    info.appendChild(priceLine);

    const qty = document.createElement('div');
    qty.className = 'cart-item__qty';

    const btnMinus = document.createElement('button');
    btnMinus.className = 'cart-item__btn';
    btnMinus.textContent = '-';
    btnMinus.addEventListener('click', () => changeQty(item.id, -1));

    const spanQty = document.createElement('span');
    spanQty.textContent = item.cantidad;

    const btnPlus = document.createElement('button');
    btnPlus.className = 'cart-item__btn';
    btnPlus.textContent = '+';

    // Ver si ya está al máximo permitido
    const product = getProductById(item.id);
    const max = getMaxAvailable(product);
    const reachedMax = item.cantidad >= max && max !== Infinity;

    if (reachedMax) {
      btnPlus.disabled = true;
      btnPlus.classList.add('cart-item__btn--disabled');
    }

    btnPlus.addEventListener('click', () => changeQty(item.id, 1));

    qty.appendChild(btnMinus);
    qty.appendChild(spanQty);
    qty.appendChild(btnPlus);

    row.appendChild(info);
    row.appendChild(qty);
    cartItemsContainer.appendChild(row);

    total += item.precio * item.cantidad;
  });

  cartTotalEl.textContent = `$${total} MXN`;
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  const product = getProductById(id);
  const max = getMaxAvailable(product);
  const newQty = item.cantidad + delta;

  // Intento de subir por encima del stock disponible
  if (delta > 0 && newQty > max) {
    if (max === 0) {
      alert('Este producto está agotado por el momento.');
    } else {
      alert(`Solo hay ${max} pieza(s) disponible(s) de este producto.`);
    }
    return;
  }

  // Si baja a 0 o menos, se elimina del carrito
  if (newQty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  } else {
    item.cantidad = newQty;
  }

  updateCartBadge();
  renderCart();
  persistCart();
}

function renderCategoryItems() {
  const itemsLists = document.querySelectorAll('.category-items');
  if (!itemsLists.length) return;
  const groups = products.reduce((acc, p) => {
    const catKey = (p.categoria || '').toLowerCase();
    if (!catKey) return acc;
    acc[catKey] = acc[catKey] || [];
    acc[catKey].push(p);
    return acc;
  }, {});

  itemsLists.forEach(list => {
    const catName = (list.dataset.cat || '').toLowerCase();
    const listItems = groups[catName] || [];
    list.innerHTML = '';
    if (!listItems.length) {
      return;
    }
    listItems.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p.nombre;
      list.appendChild(li);
    });
  });
}

function persistCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function loadCartFromStorage() {
  const stored = localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: item.id,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
        }))
        .filter((item) => item.id && item.cantidad > 0);
    }
  } catch (error) {
    console.warn('No se pudo leer el carrito guardado', error);
  }
  return [];
}

// =========================
// CARRITO UI
// =========================

function openCart() {
  if (!cartPanel || !cartOverlay) return;
  cartPanel.classList.add('cart-panel--open');
  cartOverlay.classList.add('cart-overlay--open');
}

function closeCart() {
  if (!cartPanel || !cartOverlay) return;
  cartPanel.classList.remove('cart-panel--open');
  cartOverlay.classList.remove('cart-overlay--open');
}

// =========================
// PEDIDOS (ORDERS)
// =========================

async function saveOrderToSupabase() {
  if (cart.length === 0) return null;
  if (!currentUser) {
    throw new Error('Debes iniciar sesión para completar el pedido.');
  }

  const total = getCartTotal();

  const customerName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    null;

  const orderPayload = {
    customer_id: currentUser.id,
    total,
    status: 'pending',
    customer_email: currentUser?.email || null,
    customer_name: customerName,
    customer_phone: null, // luego podemos pedirlo en el checkout
  };

  // 1) Insertar pedido
  const { data: orderData, error: orderError } = await supabaseClient
    .from('orders')
    .insert(orderPayload)
    .select('id')
    .single();

  if (orderError) {
    throw orderError;
  }

  const orderId = orderData.id;

  // 2) Insertar líneas de pedido
  const itemsPayload = cart.map((item) => ({
    order_id: orderId,
    product_id: item.id,
    product_name: item.nombre,
    unit_price: item.precio,
    unit_cost: Number(item.costo || 0),
    quantity: item.cantidad,
    subtotal: item.precio * item.cantidad,
    cost_subtotal: Number(item.costo || 0) * item.cantidad,
  }));

  const { error: itemsError } = await supabaseClient
    .from('order_items')
    .insert(itemsPayload);

  if (itemsError) {
    throw itemsError;
  }

  // 3) El stock se actualiza en la BD (trigger) al insertar order_items.
  //    No lo actualizamos desde el cliente para evitar manipulación y respetar RLS.

  return orderId;
}

// =========================
// WHATSAPP
// =========================

async function sendCartToWhatsApp() {
  // Si no hay nada en el carrito, dejamos que cualquiera pregunte info
  if (cart.length === 0) {
    const text =
      'Hola, quiero más información sobre los productos de La Negrita Stitch House.';
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      text
    )}`;
    window.open(url, '_blank');
    return;
  }

// 🔐 A PARTIR DE AQUÍ: SOLO USUARIOS CON SESIÓN
  if (!currentUser) {
    const goLogin = confirm(
      'Para finalizar tu pedido necesitas iniciar sesión o crear una cuenta.\n\n¿Quieres ir a la página de acceso ahora?'
    );
    if (goLogin) {
      const next = encodeURIComponent('index.html');
      window.location.href = `login.html?next=${next}`;
    }
    return; // no seguimos con el pedido
  }

  let orderId = null;

  try {
    // Guardar pedido en Supabase
    orderId = await saveOrderToSupabase();
    console.log('[orders] Pedido guardado con id:', orderId);
  } catch (err) {
    console.error('[orders] Error guardando pedido en Supabase', err);
    const seguir = confirm(
      'No se pudo guardar el pedido en el sistema, pero puedes continuar para enviarlo por WhatsApp.\n\n¿Quieres continuar de todos modos?'
    );
    if (!seguir) {
      return;
    }
  }

  let text = 'Hola, me gustaría hacer este pedido en La Negrita Stitch House:\n\n';

  if (orderId) {
    text += `Pedido #${orderId}\n\n`;
  }

  cart.forEach((item) => {
    text += `• ${item.cantidad} x ${item.nombre} — ${item.precio} MXN c/u\n`;
  });

  const total = getCartTotal();
  text += `\nTotal aproximado: ${total} MXN\n`;
  text += '\n¿Me ayudas con la disponibilidad, tiempos y formas de pago, por favor?';

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    text
  )}`;
  window.open(url, '_blank');

  // Limpiar carrito después de mandar el pedido
  cart = [];
  updateCartBadge();
  renderCart();
  persistCart();
}

// =========================
// MENÚ MÓVIL
// =========================

function toggleMenu() {
  const isOpen = headerNav.classList.toggle('is-open');
  menuOverlay.classList.toggle('menu-overlay--open', isOpen);
}

function closeMenu() {
  headerNav.classList.remove('is-open');
  menuOverlay.classList.remove('menu-overlay--open');
}

// =========================
// TEMAS
// =========================
function renderThemeList(activeId) {
  if (!themesList) return;

  themesList.textContent = '';
  const themeOptions = Array.isArray(window.LN_THEMES) ? window.LN_THEMES : [];

  if (!themeOptions.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No hay temas disponibles.';
    themesList.appendChild(empty);
    return;
  }

  themeOptions.forEach((theme) => {
    const item = document.createElement('div');
    item.className = 'theme-item';
    if (theme.id === activeId) {
      item.classList.add('is-active');
    }

    const left = document.createElement('div');
    left.className = 'theme-item__left';

    const title = document.createElement('span');
    title.className = 'theme-item__title';
    title.textContent = theme.title || theme.id;

    const sub = document.createElement('span');
    sub.className = 'theme-item__sub';
    sub.textContent = theme.subtitle || '';

    left.appendChild(title);
    left.appendChild(sub);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-item__btn';
    btn.textContent = theme.id === activeId ? 'Seleccionado' : 'Usar';

    btn.addEventListener('click', () => {
      applyTheme(theme.id);
      saveTheme(theme.id);
      renderThemeList(theme.id);
    });

    item.appendChild(left);
    item.appendChild(btn);
    themesList.appendChild(item);
  });
}

function openThemesModal() {
  if (!themesModal) return;
  renderThemeList(getSavedTheme());
  themesModal.classList.add('is-open');
  themesModal.setAttribute('aria-hidden', 'false');
  closeMenu();
}

function closeThemesModal() {
  if (!themesModal) return;
  themesModal.classList.remove('is-open');
  themesModal.setAttribute('aria-hidden', 'true');
}

// =========================
// MODAL IMAGEN PRODUCTO
// =========================

function openImageModal(product) {
  if (!product.imagen) return;
  imageModalImg.src = product.imagen;
  imageModalImg.alt = product.nombre || 'Producto';
  imageModalCaption.textContent = product.nombre || '';
  imageModal.classList.add('is-open');
}

function closeImageModal() {
  imageModal.classList.remove('is-open');
  imageModalImg.src = '';
}

async function handleSessionButtonClick() {
  if (!adminBtn) return;

  if (!currentUser) {
    const nextStore = encodeURIComponent('index.html');
    window.location.href = `login.html?next=${nextStore}`;
    return;
  }

  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('[auth] error en signOut', err);
  }
  window.location.href = 'index.html';
}


// =========================
// EVENTOS
// =========================
if (categoryCards && categoryCards.length) {
  categoryCards.forEach((card) => {
    const cat = card.dataset.cat || null;
    const mode = card.dataset.mode || 'category';

    card.addEventListener('click', () => {
      if (mode === 'catalog') {
        viewMode = 'catalogo';
        activeCategory = 'all';
        document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('is-active'));
        renderProducts();
        const section = document.getElementById('catalogo-destacado');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (cat) {
        viewMode = mode;
        applyCategoryFilter(cat);
      }
    });
  });
}

if (cartBtn) cartBtn.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
if (cartWhatsappBtn) cartWhatsappBtn.addEventListener('click', sendCartToWhatsApp);
if (adminBtn) adminBtn.addEventListener('click', handleSessionButtonClick);
if (imageModalClose) {
  imageModalClose.addEventListener('click', closeImageModal);
}
if (imageModalOverlay) {
  imageModalOverlay.addEventListener('click', closeImageModal);
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeImageModal();
    if (themesModal && themesModal.classList.contains('is-open')) {
      closeThemesModal();
    }
  }
});

if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

document.querySelectorAll('.header__nav a, .header__nav button').forEach((link) =>
  link.addEventListener('click', closeMenu)
);
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMenu();
});

if (themesBtn) {
  themesBtn.addEventListener('click', () => {
    closeMenu();
    openThemesModal();
  });
}
if (themesModalOverlay) {
  themesModalOverlay.addEventListener('click', closeThemesModal);
}
if (themesModalClose) {
  themesModalClose.addEventListener('click', closeThemesModal);
}
if (themesReset) {
  themesReset.addEventListener('click', () => {
    applyTheme('default');
    saveTheme('default');
    renderThemeList('default');
  });
}
if (themesApplyClose) {
  themesApplyClose.addEventListener('click', closeThemesModal);
}


// =========================
// INICIALIZAR
// =========================

cart = loadCartFromStorage();
if (hasCartUI) {
  updateCartBadge();
  renderCart();
}

// Fallback global: aunque algo truene, a los N segundos apagamos el splash sí o sí
const SPLASH_MAX_WAIT = 7000; // 7 seg de máximo
setTimeout(() => {
  console.warn('[splash] fallback timeout → ocultando splash forzado');
  try {
    hideSplash();
  } catch (e) {
    console.error('[splash] error al ocultar (fallback)', e);
    const splash = document.getElementById('splash');
    if (splash && splash.parentNode) {
      splash.parentNode.removeChild(splash);
    }
  }
}, SPLASH_MAX_WAIT);

// 🔄 Escuchamos cambios de sesión
// 🔄 Escuchamos cambios de sesión (NO usar async/await aquí para evitar deadlocks)
supabaseClient.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  isAdmin = userIsAdmin(currentUser);
  console.log('onAuthStateChange → user:', currentUser?.email, 'isAdmin:', isAdmin);
  updateAdminUI();

  // Ejecuta después del tick actual (evita lock interno de auth)
  setTimeout(() => {
    loadProducts().catch((err) => console.error('[loadProducts] fallo post-auth', err));
  }, 0);
});


// 🚀 Bootstrap principal
(async function bootstrap() {
  console.log('[bootstrap] iniciando app...');
  try {
    await ensureSession();
    await loadProducts();
  } catch (err) {
    console.error('[bootstrap] error inicializando app', err);
  } finally {
    console.log('[bootstrap] listo → ocultando splash');
    setTimeout(hideSplash, SPLASH_HIDE_DELAY);
  }
})();

// Respaldo: cuando termine de cargar la ventana, lo quitamos de nuevo por si acaso
window.addEventListener('load', () => {
  console.log('[splash] window load → ocultando splash');
  setTimeout(hideSplash, SPLASH_HIDE_DELAY);
});

console.log('✅ store.js cargado correctamente');


// =========================
// SPLASH
// =========================

let splashHidden = false;

function hideSplash() {
  if (splashHidden) return; // evitamos doble ejecución
  splashHidden = true;

  const splash = document.getElementById('splash');
  if (!splash) return;

  console.log('[splash] ocultando pantalla de carga');

  splash.classList.add('splash--hide');

  // Después de la transición lo removemos del DOM
  setTimeout(() => {
  if (splash && splash.parentNode) {
    splash.parentNode.removeChild(splash);
  }
}, 600);
}

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
