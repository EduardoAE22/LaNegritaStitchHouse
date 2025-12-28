// app.js

// Config
const WHATSAPP_NUMBER = '529381952228';
const CART_STORAGE_KEY = 'ln_cart';
const SUPABASE_URL = window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';
const SUPABASE_BUCKET = 'products';
const ADMIN_EMAILS = ['acostasolutions.dev@gmail.com'];

// Estado
let products = [];
let cart = [];
let activeCategory = 'all';
let supabaseClient = null;
let currentUser = null;
let isAdmin = false;
let orders = []; // pedidos cargados para el panel admin

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

const menuToggle = document.getElementById('menu-toggle');
const headerNav = document.querySelector('.header__nav');
const menuOverlay = document.getElementById('menu-overlay');

const adminBtn = document.getElementById('admin-btn');
const catAddBtn = document.getElementById('cat-add-btn');
const catEditBtn = document.getElementById('cat-edit-btn');
const catDeleteBtn = document.getElementById('cat-delete-btn');
const categoryCards = document.querySelectorAll('.category-card');


// Modal imagen producto
const imageModal = document.getElementById('image-modal');
const imageModalOverlay = document.getElementById('image-modal-overlay');
const imageModalClose = document.getElementById('image-modal-close');
const imageModalImg = document.getElementById('image-modal-img');
const imageModalCaption = document.getElementById('image-modal-caption');

// Admin form DOM
const adminPanel = document.getElementById('admin-panel');
const adminForm = document.getElementById('admin-form');
const inputId = document.getElementById('product-id');
const inputNombre = document.getElementById('product-nombre');
const inputPrecio = document.getElementById('product-precio');
const inputDescripcion = document.getElementById('product-descripcion');
const inputCategoria = document.getElementById('product-categoria');
const inputStock = document.getElementById('product-stock');
const inputImagen = document.getElementById('product-imagen');
const adminStatus = document.getElementById('admin-status');
const adminResetBtn = document.getElementById('admin-reset');
const adminOrdersSection = document.getElementById('admin-orders');
const adminOrdersTbody = document.getElementById('admin-orders-tbody');

//Reporte de ventas para el administrador
const adminAnalyticsSection = document.getElementById('admin-analytics');
const salesTodayEl = document.getElementById('analytics-sales-today');
const salesWeekEl = document.getElementById('analytics-sales-week');
const salesMonthEl = document.getElementById('analytics-sales-month');
const salesYearEl = document.getElementById('analytics-sales-year');
const topProductEl = document.getElementById('analytics-top-product');
const bottomProductEl = document.getElementById('analytics-bottom-product');
const topCustomerEl = document.getElementById('analytics-top-customer');
const bottomCustomerEl = document.getElementById('analytics-bottom-customer');
const customersTbodyAnalytics = document.getElementById('analytics-customers-tbody');


//Splash delay
const SPLASH_HIDE_DELAY = 2500; // 3 segundos (ajusta al gusto)

// Inicializar Supabase client
supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// (Opcional) Evita exponer el cliente globalmente en producción
// window.supabaseClient = supabaseClient;

// Utils
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function userIsAdmin(user) {
  if (!user) return false;

  const email = normalizeEmail(user.email);
  const allowList = ADMIN_EMAILS.map(normalizeEmail);
  
  // Rol CONFIABLE: solo app_metadata (no user_metadata, porque el usuario puede editarlo)
  const role = user?.app_metadata?.role || null;

  return (
    allowList.includes(email) || // lista blanca (tú)
    role === 'superadmin' ||     // por si luego quieres otro super
    role === 'admin'             // admins normales (como tu suegra)
  );
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

function updateAdminUI() {
  if (adminPanel) {
    adminPanel.classList.toggle('is-visible', !!isAdmin);
    adminStatus.textContent = isAdmin
      ? 'Panel admin activo'
      : 'Acceso solo para administradores autorizados';

        // Panel de analítica: solo admin
  if (adminAnalyticsSection) {
    adminAnalyticsSection.classList.toggle('is-visible', isAdmin);
    }
  if (!isAdmin && customersTbodyAnalytics) {
    customersTbodyAnalytics.innerHTML =
      '<tr><td colspan="5">Aún no hay clientes con pedidos.</td></tr>';
    }

  }

  const showCatActions = isAdmin && catAddBtn && catEditBtn && catDeleteBtn;
  if (showCatActions) {
    catAddBtn.style.display = 'inline-flex';
    catEditBtn.style.display = 'inline-flex';
    catDeleteBtn.style.display = 'inline-flex';
  } else {
    if (catAddBtn) catAddBtn.style.display = 'none';
    if (catEditBtn) catEditBtn.style.display = 'none';
    if (catDeleteBtn) catDeleteBtn.style.display = 'none';
  }

  // Panel de pedidos: solo visible para admin
  if (adminOrdersSection) {
    adminOrdersSection.classList.toggle('is-visible', isAdmin);
  }

  // Si dejamos de ser admin, limpiamos la tabla
  if (!isAdmin && adminOrdersTbody) {
    adminOrdersTbody.innerHTML = '';
    orders = [];
  }

  if (adminBtn) {
    const hasSession = !!currentUser;
    adminBtn.textContent = hasSession ? 'Cerrar sesión' : 'Admin';
    adminBtn.title = hasSession ? 'Cerrar sesión de tu cuenta' : 'Iniciar sesión';
  }
}

// Botón "Admin / Cerrar sesión" en la cabecera
function handleAdminButton() {
  console.log('handleAdminButton: REDIRECT TEST → login.html?logout=1');
  // Da igual si hay sesión o no, siempre lo mandamos al login con flag de logout
  window.location.href = 'login.html?logout=1';
}
// Acciones de categorías (placeholder)
function handleCatAdd() {
  alert('Agregar nueva categoría: función próximamente.');
}
function handleCatEdit() {
  alert('Editar categoría: función próximamente.');
}
function handleCatDelete() {
  alert('Eliminar categoría: función próximamente.');
}

// =========================
// PRODUCTOS
// =========================

async function loadProducts() {
  setProductsFeedback('Cargando catálogo...', false);

  try {
    console.log('[loadProducts] consulta con supabase-js…');

    const { data, error } = await supabaseClient
      .from('products')
      .select('id,nombre,precio,categoria,descripcion,stock,imagen_url,activo')
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
  productsFeedback.textContent = message;
  productsFeedback.classList.toggle('products-feedback--error', !!isError);
}

function buildFilters(list) {
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


function renderProducts() {
  productsGrid.innerHTML = '';

  const visible =
    activeCategory === 'all'
      ? products
      : products.filter((product) => product.categoria === activeCategory);

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

    // --- Iconos admin (lapiz + basura) ---
    if (isAdmin) {
      const adminActions = document.createElement('div');
      adminActions.className = 'product-card__admin-actions';

      const editIconBtn = document.createElement('button');
      editIconBtn.type = 'button';
      editIconBtn.className = 'product-card__icon-btn';
      editIconBtn.textContent = '✏️';
      editIconBtn.title = 'Editar producto';
      editIconBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handleEditProduct(product);
      });

      const deleteIconBtn = document.createElement('button');
      deleteIconBtn.type = 'button';
      deleteIconBtn.className = 'product-card__icon-btn product-card__icon-btn--delete';
      deleteIconBtn.textContent = '🗑️';
      deleteIconBtn.title = 'Eliminar producto';
      deleteIconBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handleDeleteProduct(product);
      });

      adminActions.appendChild(editIconBtn);
      adminActions.appendChild(deleteIconBtn);
      card.appendChild(adminActions);
    }

    const imgBtn = document.createElement('button');
    imgBtn.type = 'button';
    imgBtn.className = 'product-card__image-btn';
    imgBtn.dataset.id = product.id;

    if (!isAdmin) {
      imgBtn.classList.add('disabled');
    }

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

    if (stockValue !== null && stockValue <= 0) {
      btnAdd.disabled = true;
      btnAdd.textContent = 'Agotado';
      btnAdd.classList.add('btn-primary--disabled');
    }

    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(stockLine);
    body.appendChild(desc);
    body.appendChild(btnAdd);

    card.appendChild(imgBtn);
    card.appendChild(body);
    productsGrid.appendChild(card);
  });

  // Ya no rellenamos las listas de categorías dinámicas
  //renderCategoryItems();
}

// Imagen admin -> Storage
async function handleImageClick(product) {
  if (!isAdmin) {
    alert('Solo administradores autorizados pueden cambiar imágenes.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop();
      const filePath = `product-${product.id}-${Date.now()}.${ext || 'jpg'}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl || '';

      const { error: updateError } = await supabaseClient
        .from('products')
        .update({ imagen_url: publicUrl })
        .eq('id', product.id);

      if (updateError) throw updateError;

      product.imagen = publicUrl;
      renderProducts();
      alert('Imagen actualizada en Supabase.');
    } catch (err) {
      console.error('No se pudo subir la imagen', err);
      alert('No se pudo subir la imagen. Revisa permisos y bucket en Supabase.');
    }
  });

  input.click();
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
  const totalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);
  cartCount.textContent = totalItems;
}

function getStoragePathFromUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
function renderCart() {
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
// PEDIDOS (ADMIN)
// =========================

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatOrderStatus(status) {
  const normalized = (status || '').toLowerCase();
  let label = normalized;
  if (normalized === 'pending') label = 'Pendiente';
  else if (normalized === 'paid') label = 'Pagado';
  else if (normalized === 'cancelled') label = 'Cancelado';

  return { normalized, label };
}

function formatCurrencyMXN(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  });
}

function resetAnalyticsUI() {
  const dash = '—';
  if (salesTodayEl) salesTodayEl.textContent = dash;
  if (salesWeekEl) salesWeekEl.textContent = dash;
  if (salesMonthEl) salesMonthEl.textContent = dash;
  if (salesYearEl) salesYearEl.textContent = dash;

  if (topProductEl) topProductEl.textContent = 'Sin datos aún';
  if (bottomProductEl) bottomProductEl.textContent = 'Sin datos aún';
  if (topCustomerEl) topCustomerEl.textContent = 'Sin datos aún';
  if (bottomCustomerEl) bottomCustomerEl.textContent = 'Sin datos aún';

  if (customersTbodyAnalytics) {
    customersTbodyAnalytics.innerHTML =
      '<tr><td colspan="5">Aún no hay clientes con pedidos.</td></tr>';
  }
}



async function loadOrders() {
  if (!isAdmin || !adminOrdersTbody) {
    console.log('[orders] no es admin o no hay tbody, no cargo pedidos');
    return;
  }

  try {
    console.log('[orders] cargando pedidos (supabase-js)...');

    const { data, error } = await supabaseClient
      .from('orders')
      .select('id,created_at,status,total,customer_email')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[orders] error', error);
      throw error;
    }

    orders = data || [];
    renderOrders();
  } catch (err) {
    console.error('[orders] error cargando pedidos', err);
    if (adminOrdersTbody) {
      adminOrdersTbody.innerHTML =
        '<tr><td colspan="6">No se pudieron cargar los pedidos. Revisa la consola.</td></tr>';
    }
  }
}

function renderOrders() {
  if (!adminOrdersTbody) return;

  if (!orders.length) {
    adminOrdersTbody.innerHTML =
      '<tr><td colspan="6">Aún no hay pedidos registrados.</td></tr>';
    return;
  }

  adminOrdersTbody.innerHTML = '';

  orders.forEach((order) => {
    const tr = document.createElement('tr');

    const { normalized, label } = formatOrderStatus(order.status);

    const tdId = document.createElement('td');
    tdId.textContent = order.id;

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateTime(order.created_at);

    const tdCustomer = document.createElement('td');
    tdCustomer.textContent = order.customer_email || '-';

    const tdTotal = document.createElement('td');
    tdTotal.textContent = `$${(order.total || 0).toFixed(2)} MXN`;

    const tdStatus = document.createElement('td');
    const statusSpan = document.createElement('span');
    statusSpan.className = `order-status order-status--${normalized}`;
    statusSpan.textContent = label;
    tdStatus.appendChild(statusSpan);

    const tdActions = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'admin-orders__actions';

    // Botón "Pagado"
    const btnPaid = document.createElement('button');
    btnPaid.type = 'button';
    btnPaid.className = 'admin-orders__btn admin-orders__btn--primary';
    btnPaid.textContent = 'Marcar pagado';
    btnPaid.dataset.orderId = order.id;
    btnPaid.dataset.orderAction = 'mark-paid';
    if (normalized === 'paid') {
      btnPaid.disabled = true;
    }

    // Botón "Cancelar"
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'admin-orders__btn admin-orders__btn--danger';
    btnCancel.textContent = 'Cancelar';
    btnCancel.dataset.orderId = order.id;
    btnCancel.dataset.orderAction = 'cancel';
    if (normalized === 'cancelled') {
      btnCancel.disabled = true;
    }

    actionsDiv.appendChild(btnPaid);
    actionsDiv.appendChild(btnCancel);
    tdActions.appendChild(actionsDiv);

    tr.appendChild(tdId);
    tr.appendChild(tdDate);
    tr.appendChild(tdCustomer);
    tr.appendChild(tdTotal);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    adminOrdersTbody.appendChild(tr);
  });
}

// =========================
// ANALÍTICA / ESTADÍSTICAS
// =========================

async function loadAnalytics() {
  if (!isAdmin || !adminAnalyticsSection) {
    console.log('[analytics] no admin o no hay sección, no se carga');
    return;
  }

  try {
    console.log('[analytics] cargando estadísticas...');

    // 1) Traemos pedidos PAGADOS (últimos 500 por si acaso)
    const { data: paidOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, created_at, status, total, customer_email, customer_name')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(500);

    if (ordersError) throw ordersError;

    if (!paidOrders || !paidOrders.length) {
      resetAnalyticsUI();
      return;
    }

    const orderIds = paidOrders.map((o) => o.id);

    // 2) Traemos las líneas de pedido de esos pedidos
    const { data: items, error: itemsError } = await supabaseClient
      .from('order_items')
      .select('order_id, product_id, product_name, quantity')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    computeAnalytics(paidOrders, items || []);
  } catch (err) {
    console.error('[analytics] error cargando estadísticas', err);
    resetAnalyticsUI();
  }
}

function computeAnalytics(paidOrders, items) {
  if (!paidOrders || !paidOrders.length) {
    resetAnalyticsUI();
    return;
  }

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 6); // últimos 7 días
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startYear = new Date(now.getFullYear(), 0, 1);

  let totalToday = 0;
  let totalWeek = 0;
  let totalMonth = 0;
  let totalYear = 0;

  // Map para cruzar items con pedidos
  const ordersById = new Map();
  // Map de clientes
  const customersMap = new Map();

  for (const o of paidOrders) {
    const created = new Date(o.created_at);
    const total = Number(o.total) || 0;

    ordersById.set(o.id, { ...o, created, total });

    if (created >= startYear) totalYear += total;
    if (created >= startMonth) totalMonth += total;
    if (created >= startWeek) totalWeek += total;
    if (created >= startToday) totalToday += total;

    const emailKey = (o.customer_email || 'sin-correo').toLowerCase();
    const existing = customersMap.get(emailKey) || {
      email: o.customer_email || '—',
      name: o.customer_name || '',
      firstOrderAt: created,
      lastOrderAt: created,
      ordersCount: 0,
      totalSpent: 0,
    };

    existing.ordersCount += 1;
    existing.totalSpent += total;
    if (created < existing.firstOrderAt) existing.firstOrderAt = created;
    if (created > existing.lastOrderAt) existing.lastOrderAt = created;

    customersMap.set(emailKey, existing);
  }

  // Productos: más y menos vendidos
  const productMap = new Map();

  for (const item of items) {
    if (!ordersById.has(item.order_id)) continue; // por seguridad
    const key = item.product_id || item.product_name;
    if (!key) continue;

    const existing = productMap.get(key) || {
      productId: item.product_id,
      name: item.product_name || `Producto #${item.product_id}`,
      quantity: 0,
    };
    existing.quantity += Number(item.quantity) || 0;
    productMap.set(key, existing);
  }

  let topProduct = null;
  let bottomProduct = null;

  for (const p of productMap.values()) {
    if (!topProduct || p.quantity > topProduct.quantity) topProduct = p;
    if (!bottomProduct || p.quantity < bottomProduct.quantity) bottomProduct = p;
  }

  // Clientes ordenados por consumo total
  const customers = Array.from(customersMap.values()).sort(
    (a, b) => b.totalSpent - a.totalSpent
  );
  const topCustomer = customers[0] || null;
  const bottomCustomer = customers.length ? customers[customers.length - 1] : null;

  // === Actualizar UI ===
  if (salesTodayEl) salesTodayEl.textContent = formatCurrencyMXN(totalToday);
  if (salesWeekEl) salesWeekEl.textContent = formatCurrencyMXN(totalWeek);
  if (salesMonthEl) salesMonthEl.textContent = formatCurrencyMXN(totalMonth);
  if (salesYearEl) salesYearEl.textContent = formatCurrencyMXN(totalYear);

  if (topProductEl) {
    topProductEl.textContent = topProduct
      ? `${topProduct.name} (${topProduct.quantity} pzas)`
      : 'Sin datos aún';
  }
  if (bottomProductEl) {
    bottomProductEl.textContent = bottomProduct
      ? `${bottomProduct.name} (${bottomProduct.quantity} pzas)`
      : 'Sin datos aún';
  }

  if (topCustomerEl) {
    topCustomerEl.textContent = topCustomer
      ? `${topCustomer.name || topCustomer.email} — ${formatCurrencyMXN(
          topCustomer.totalSpent
        )}`
      : 'Sin datos aún';
  }
  if (bottomCustomerEl) {
    bottomCustomerEl.textContent = bottomCustomer
      ? `${bottomCustomer.name || bottomCustomer.email} — ${formatCurrencyMXN(
          bottomCustomer.totalSpent
        )}`
      : 'Sin datos aún';
  }

  if (customersTbodyAnalytics) {
    customersTbodyAnalytics.innerHTML = '';
    if (!customers.length) {
      customersTbodyAnalytics.innerHTML =
        '<tr><td colspan="5">Aún no hay clientes con pedidos.</td></tr>';
    } else {
      customers.forEach((c) => {
        const tr = document.createElement('tr');
        const firstDate = c.firstOrderAt.toLocaleString('es-MX', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
        tr.innerHTML = `
          <td>${c.name || '—'}</td>
          <td>${c.email}</td>
          <td>${firstDate}</td>
          <td>${c.ordersCount}</td>
          <td>${formatCurrencyMXN(c.totalSpent)}</td>
        `;
        customersTbodyAnalytics.appendChild(tr);
      });
    }
  }
}


async function restoreStockFromOrderItems(orderId) {
  // Traemos items del pedido
  const { data: items, error } = await supabaseClient
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (error) throw error;
  if (!items || !items.length) return;

  for (const item of items) {
    const productId = item.product_id;
    const qty = item.quantity || 0;

    // Buscamos el producto en el array local para calcular nuevo stock
    const product = products.find((p) => p.id === productId);
    const currentStock =
      product && typeof product.stock === 'number'
        ? product.stock
        : 0;
    const newStock = currentStock + qty;

    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);

    if (updateError) throw updateError;

    if (product) {
      product.stock = newStock;
    }
  }
}

async function updateOrderStatus(orderId, newStatus) {
  if (!isAdmin) return;

  // 1. Leemos el pedido actual
  const { data: order, error: orderError } = await supabaseClient
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;
  const oldStatus = (order.status || '').toLowerCase();
  const targetStatus = (newStatus || '').toLowerCase();

  if (oldStatus === targetStatus) return;

  // 2. Si pasamos de pending → cancelled, devolvemos stock
  if (oldStatus === 'pending' && targetStatus === 'cancelled') {
    await restoreStockFromOrderItems(orderId);
  }

  // 3. Actualizamos el estado del pedido
  const { error: updateError } = await supabaseClient
    .from('orders')
    .update({ status: targetStatus })
    .eq('id', orderId);

  if (updateError) throw updateError;

  console.log('[orders] estado actualizado', { orderId, oldStatus, targetStatus });

  // 4. Refrescamos pedidos y catálogo
  await loadOrders();
  await loadProducts();
}

async function handleOrderActionClick(event) {
  const btn = event.target.closest('[data-order-action]');
  if (!btn || !isAdmin) return;

  const orderId = Number(btn.dataset.orderId);
  const action = btn.dataset.orderAction;

  if (!orderId || !action) return;

  try {
    if (action === 'mark-paid') {
      const ok = confirm('¿Marcar este pedido como PAGADO?');
      if (!ok) return;
      await updateOrderStatus(orderId, 'paid');
      alert('Pedido marcado como pagado.');
    } else if (action === 'cancel') {
      const ok = confirm(
        '¿Cancelar este pedido?\n\nSe devolverá el stock de los productos asociados.'
      );
      if (!ok) return;
      await updateOrderStatus(orderId, 'cancelled');
      alert('Pedido cancelado y stock devuelto.');
    }
  } catch (err) {
    console.error('[orders] error al actualizar pedido', err);
    alert('No se pudo actualizar el pedido. Revisa la consola para más detalles.');
  }
}

// =========================
// CARRITO UI
// =========================

function openCart() {
  cartPanel.classList.add('cart-panel--open');
  cartOverlay.classList.add('cart-overlay--open');
}

function closeCart() {
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
    quantity: item.cantidad,
    subtotal: item.precio * item.cantidad,
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
      window.location.href = 'login.html';
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

// =========================
// ADMIN FORM
// =========================

function fillAdminForm(product) {
  if (!adminForm || !isAdmin) return;
  inputId.value = product.id;
  inputNombre.value = product.nombre;
  inputPrecio.value = product.precio;
  inputDescripcion.value = product.descripcion;
  inputCategoria.value = product.categoria;
   if (inputStock) {
    inputStock.value =
      typeof product.stock === 'number' && !Number.isNaN(product.stock)
        ? product.stock
        : '';
  }
  adminStatus.textContent = `Editando ID ${product.id}`;
}

function handleEditProduct(product) {
  if (!isAdmin) return;
  fillAdminForm(product);
  if (adminPanel) {
    adminPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function handleDeleteProduct(product) {
  if (!isAdmin) {
    alert('Solo administradores pueden eliminar productos.');
    return;
  }

  const goBackToCatalog = () => {
    const section = document.getElementById('catalogo-destacado');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const ok = confirm(
    `¿Desea eliminar el producto "${product.nombre}"?\n\n` +
    'Esta acción no se puede deshacer.'
  );
  if (!ok) {
    // Si cancela, solo recargamos la lista y volvemos a piezas destacadas
    await loadProducts();
    goBackToCatalog();
    return;
  }

  const imagePath = getStoragePathFromUrl(product.imagen);

  try {
    // 1) Marcar producto como inactivo (soft delete)
    const { error } = await supabaseClient
      .from('products')
      .update({ activo: false })
      .eq('id', product.id);

    if (error) throw error;

    // 2) Borrar imagen asociada del bucket (si existe)
    if (imagePath) {
      const { error: storageError } = await supabaseClient
        .storage
        .from(SUPABASE_BUCKET)
        .remove([imagePath]);

      if (storageError) {
        console.warn(
          'Producto eliminado, pero la imagen no se pudo borrar:',
          storageError
        );
      }
    }

    alert('Producto ocultado del catálogo.');
    await loadProducts();
    goBackToCatalog();
  } catch (err) {
    console.error('[admin] error eliminando producto', err);
    alert('No se pudo eliminar el producto. Revisa la consola para más detalles.');
  }
}

function resetAdminForm() {
  adminForm.reset();
  inputId.value = '';
  if (inputStock) inputStock.value = '';
  adminStatus.textContent = 'Crear nuevo producto';
}

async function handleAdminSubmit(e) {
  e.preventDefault();
  if (!isAdmin) {
    alert('Solo administradores pueden guardar productos.');
    return;
  }

  const formData = new FormData(adminForm);
  const stockValue = (() => {
    const raw = Number(formData.get('stock'));
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  })();
  const nombre = (formData.get('nombre') || '').trim();
  const precioRaw = formData.get('precio');
  const precio = Number(precioRaw);
  const categoria = (formData.get('categoria') || '').trim();
  const descripcion = (formData.get('descripcion') || '').trim();

  if (!nombre) {
    alert('Escribe un nombre para el producto.');
    return;
  }

  if (!categoria) {
    alert('Selecciona o escribe una categoría.');
    return;
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    alert('El precio debe ser un número mayor a 0.');
    return;
  }

  // Si quieres obligar descripción:
  // if (!descripcion) {
  //   alert('Escribe una descripción corta del producto.');
  //   return;
  // }
  const payload = {
    nombre,
    precio,
    descripcion,
    categoria,
    stock: stockValue
  };

  const file = formData.get('imagen');
  let imagenUrl = null;

  try {
    // 1) Si viene archivo, súbelo al bucket como ya hacías
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop();
      const filePath = `product-${Date.now()}.${ext || 'jpg'}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient
        .storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

      imagenUrl = publicData?.publicUrl || null;
    }

    const productId = formData.get('id');
    console.log('[admin] guardando producto →', {
      productId,
      ...payload,
      imagenUrl,
    });

    let dbError = null;

    if (productId) {
      // 2A) UPDATE con Supabase JS (usa tu sesión autenticada)
      const updatePayload = { ...payload };
      if (imagenUrl) updatePayload.imagen_url = imagenUrl;

      const { error } = await supabaseClient
        .from('products')
        .update(updatePayload)
        .eq('id', productId);

      dbError = error;
    } else {
      // 2B) INSERT con Supabase JS
      const insertPayload = { ...payload };
      if (imagenUrl) insertPayload.imagen_url = imagenUrl;

      const { error } = await supabaseClient
        .from('products')
        .insert(insertPayload);

      dbError = error;
    }

    if (dbError) {
      console.error('[admin] error guardando producto', dbError);
      alert(
        'No se pudo guardar el producto: ' +
          (dbError.message || 'revisa las políticas o datos.')
      );
      return;
    }

    alert(productId ? 'Producto actualizado.' : 'Producto creado.');
    resetAdminForm();
    await loadProducts();
  } catch (err) {
    console.error('Error guardando producto', err);
    alert('No se pudo guardar el producto. Revisa permisos y datos.');
  }
}


// =========================
// EVENTOS
// =========================
if (categoryCards && categoryCards.length) {
  categoryCards.forEach((card) => {
    const cat = card.dataset.cat;
    if (!cat) return;
    card.addEventListener('click', () => {
      applyCategoryFilter(cat);
    });
  });
}

if (cartBtn) cartBtn.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
if (cartWhatsappBtn) cartWhatsappBtn.addEventListener('click', sendCartToWhatsApp);
if (adminOrdersSection) {
  adminOrdersSection.addEventListener('click', handleOrderActionClick);
}

if (adminBtn) adminBtn.addEventListener('click', handleAdminButton);
if (catAddBtn) catAddBtn.addEventListener('click', handleCatAdd);
if (catEditBtn) catEditBtn.addEventListener('click', handleCatEdit);
if (catDeleteBtn) catDeleteBtn.addEventListener('click', handleCatDelete);
if (imageModalClose) {
  imageModalClose.addEventListener('click', closeImageModal);
}
if (imageModalOverlay) {
  imageModalOverlay.addEventListener('click', closeImageModal);
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeImageModal();
  }
});

if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

if (adminForm) adminForm.addEventListener('submit', handleAdminSubmit);
if (adminResetBtn) adminResetBtn.addEventListener('click', resetAdminForm);

document.querySelectorAll('.header__nav a').forEach((link) =>
  link.addEventListener('click', closeMenu)
);
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeMenu();
});


// =========================
// INICIALIZAR
// =========================

cart = loadCartFromStorage();
updateCartBadge();
renderCart();

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

    if (isAdmin) {
      loadOrders().catch((err) => console.error('[orders] fallo post-auth', err));
      loadAnalytics().catch((err) => {
        console.error('[analytics] fallo post-auth', err);
        resetAnalyticsUI();
      });
    } else {
      resetAnalyticsUI();
    }
  }, 0);
});


// 🚀 Bootstrap principal
(async function bootstrap() {
  console.log('[bootstrap] iniciando app...');
  try {
    await ensureSession();
    await loadProducts();

    if (isAdmin) {
      await loadOrders();
      // Igual, estadísticas en segundo plano
      loadAnalytics().catch((err) => {
        console.error('[analytics] fallo al cargar en bootstrap', err);
        resetAnalyticsUI();
      });
    } else {
      resetAnalyticsUI();
    }
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

console.log('✅ app.js cargado correctamente');


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

document.getElementById('year').textContent = new Date().getFullYear();
