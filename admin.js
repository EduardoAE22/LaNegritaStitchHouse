// admin.js – lógica exclusiva del panel administrativo

// Config
const SUPABASE_URL =
  window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';
const SUPABASE_BUCKET = 'products';
const ADMIN_EMAILS = ['acostasolutions.dev@gmail.com'];

let supabaseClient = null;
let currentUser = null;
let isAdmin = false;
let orders = [];

// DOM
const adminBtn = document.getElementById('admin-btn');
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

// Analítica
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

// Utils
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function userIsAdmin(user) {
  if (!user) return false;

  const email = normalizeEmail(user.email);
  const allowList = ADMIN_EMAILS.map(normalizeEmail);

  const role = user?.app_metadata?.role || null;

  return (
    allowList.includes(email) ||
    role === 'superadmin' ||
    role === 'admin'
  );
}

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

async function ensureSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Error verificando sesión', error);
  }

  const session = data?.session || null;
  currentUser = session?.user || null;
  isAdmin = userIsAdmin(currentUser);
  updateAdminUI();
  return session;
}

function updateAdminUI() {
  if (adminPanel) {
    adminPanel.classList.toggle('is-visible', !!isAdmin);
    if (adminStatus) {
      adminStatus.textContent = isAdmin
        ? 'Panel admin activo'
        : 'Acceso solo para administradores autorizados';
    }
  }

  if (adminAnalyticsSection) {
    adminAnalyticsSection.classList.toggle('is-visible', isAdmin);
  }
  if (!isAdmin && customersTbodyAnalytics) {
    customersTbodyAnalytics.innerHTML =
      '<tr><td colspan="5">Aún no hay clientes con pedidos.</td></tr>';
  }

  if (adminOrdersSection) {
    adminOrdersSection.classList.toggle('is-visible', isAdmin);
  }
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

// Pedidos
async function restoreStockFromOrderItems(orderId) {
  const { data: items, error } = await supabaseClient
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (error) throw error;
  if (!items || !items.length) return;

  for (const item of items) {
    const productId = item.product_id;
    const qty = item.quantity || 0;

    const { data: productRow, error: productError } = await supabaseClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    const currentStock =
      productRow && typeof productRow.stock === 'number' && !Number.isNaN(productRow.stock)
        ? productRow.stock
        : 0;
    const newStock = currentStock + qty;

    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);

    if (updateError) throw updateError;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  if (!isAdmin) return;

  const { data: order, error: orderError } = await supabaseClient
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;
  const oldStatus = (order.status || '').toLowerCase();
  const targetStatus = (newStatus || '').toLowerCase();

  if (oldStatus === targetStatus) return;

  if (oldStatus === 'pending' && targetStatus === 'cancelled') {
    await restoreStockFromOrderItems(orderId);
  }

  const { error: updateError } = await supabaseClient
    .from('orders')
    .update({ status: targetStatus })
    .eq('id', orderId);

  if (updateError) throw updateError;

  await loadOrders();
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

    const btnPaid = document.createElement('button');
    btnPaid.type = 'button';
    btnPaid.className = 'admin-orders__btn admin-orders__btn--primary';
    btnPaid.textContent = 'Marcar pagado';
    btnPaid.dataset.orderId = order.id;
    btnPaid.dataset.orderAction = 'mark-paid';
    if (normalized === 'paid') {
      btnPaid.disabled = true;
    }

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

async function loadOrders() {
  if (!isAdmin || !adminOrdersTbody) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('id,created_at,status,total,customer_email')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

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

// Analítica
async function loadAnalytics() {
  if (!isAdmin || !adminAnalyticsSection) {
    return;
  }

  try {
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
  startWeek.setDate(startWeek.getDate() - 6);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startYear = new Date(now.getFullYear(), 0, 1);

  let totalToday = 0;
  let totalWeek = 0;
  let totalMonth = 0;
  let totalYear = 0;

  const ordersById = new Map();
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

  const productMap = new Map();

  for (const item of items) {
    if (!ordersById.has(item.order_id)) continue;
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

  const customers = Array.from(customersMap.values()).sort(
    (a, b) => b.totalSpent - a.totalSpent
  );
  const topCustomer = customers[0] || null;
  const bottomCustomer = customers.length ? customers[customers.length - 1] : null;

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
      function appendTd(tr, text) {
        const td = document.createElement('td');
        td.textContent = text ?? '';
        tr.appendChild(td);
      }

      customers.forEach((c) => {
        const tr = document.createElement('tr');

        const firstDate = c.firstOrderAt.toLocaleString('es-MX', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        appendTd(tr, c.name || '—');
        appendTd(tr, c.email || '—');
        appendTd(tr, firstDate);
        appendTd(tr, String(c.ordersCount || 0));
        appendTd(tr, formatCurrencyMXN(c.totalSpent));

        customersTbodyAnalytics.appendChild(tr);
      });
    }
  }
}

// Productos (admin)
function getStoragePathFromUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function resetAdminForm() {
  if (adminForm) adminForm.reset();
  if (inputId) inputId.value = '';
  if (inputStock) inputStock.value = '';
  if (adminStatus) adminStatus.textContent = 'Crear nuevo producto';
}

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
  if (adminStatus) adminStatus.textContent = `Editando ID ${product.id}`;
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

  const ok = confirm(
    `¿Desea eliminar el producto "${product.nombre}"?\n\n` +
    'Esta acción no se puede deshacer.'
  );
  if (!ok) {
    return;
  }

  const imagePath = getStoragePathFromUrl(product.imagen);

  try {
    const { error } = await supabaseClient
      .from('products')
      .update({ activo: false })
      .eq('id', product.id);

    if (error) throw error;

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
  } catch (err) {
    console.error('[admin] error eliminando producto', err);
    alert('No se pudo eliminar el producto. Revisa la consola para más detalles.');
  }
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

    let dbError = null;

    if (productId) {
      const updatePayload = { ...payload };
      if (imagenUrl) updatePayload.imagen_url = imagenUrl;

      const { error } = await supabaseClient
        .from('products')
        .update(updatePayload)
        .eq('id', productId);

      dbError = error;
    } else {
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
  } catch (err) {
    console.error('Error guardando producto', err);
    alert('No se pudo guardar el producto. Revisa permisos y datos.');
  }
}

// Eventos
function handleOrderActionClick(event) {
  const btn = event.target.closest('[data-order-action]');
  if (!btn || !isAdmin) return;

  const orderId = Number(btn.dataset.orderId);
  const action = btn.dataset.orderAction;

  if (!orderId || !action) return;

  (async () => {
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
  })();
}

function handleAdminButton() {
  window.location.href = 'login.html?logout=1';
}

// Bootstrap
(function bootstrapAdmin() {
  console.log('[admin] iniciando panel admin...');
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  if (adminBtn) adminBtn.addEventListener('click', handleAdminButton);
  if (adminOrdersSection) {
    adminOrdersSection.addEventListener('click', handleOrderActionClick);
  }
  if (adminForm) adminForm.addEventListener('submit', handleAdminSubmit);
  if (adminResetBtn) adminResetBtn.addEventListener('click', resetAdminForm);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    isAdmin = userIsAdmin(currentUser);
    updateAdminUI();

    setTimeout(() => {
      if (isAdmin) {
        loadOrders().catch((err) => console.error('[orders] fallo post-auth', err));
        loadAnalytics().catch((err) => {
          console.error('[analytics] fallo post-auth', err);
          resetAnalyticsUI();
        });
      } else {
        resetAnalyticsUI();
        if (adminOrdersTbody) adminOrdersTbody.innerHTML = '';
      }
    }, 0);
  });

  (async () => {
    try {
      await ensureSession();
      if (isAdmin) {
        await loadOrders();
        loadAnalytics().catch((err) => {
          console.error('[analytics] fallo al cargar en bootstrap', err);
          resetAnalyticsUI();
        });
      } else {
        alert('Acceso solo para administradores. Inicia sesión con una cuenta autorizada.');
        window.location.href = 'login.html?next=administrativo.html';
      }
    } catch (err) {
      console.error('[admin] error inicializando panel', err);
    }
  })();
})();
