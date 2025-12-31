// admin.js – lógica exclusiva del panel administrativo

// Config
const SUPABASE_URL =
  window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';
const SUPABASE_BUCKET = 'products';
const ADMIN_EMAILS = ['acostasolutions.dev@gmail.com'];

const savedThemeAdmin = localStorage.getItem('ln_theme');
document.body.dataset.theme = savedThemeAdmin || 'default';

let supabaseClient = null;
let currentUser = null;
let isAdmin = false;
let orders = [];
let orderItemsByOrderId = new Map();
let orderComputedTotalsByOrderId = new Map();
let productsCache = null;
const biState = {
  preset: '30d',
  from: null,
  to: null,
  status: 'all',
  category: 'all',
};

// DOM
const adminBtn = document.getElementById('admin-btn');
const adminPanel = document.getElementById('admin-panel');
const adminForm = document.getElementById('admin-form');
const inputId = document.getElementById('product-id');
const inputNombre = document.getElementById('product-nombre');
const inputPrecio = document.getElementById('product-precio');
const inputCosto = document.getElementById('product-cost');
const inputDescripcion = document.getElementById('product-descripcion');
const inputCategoria = document.getElementById('product-categoria');
const inputStock = document.getElementById('product-stock');
const inputImagen = document.getElementById('product-imagen');
const adminStatus = document.getElementById('admin-status');
const adminResetBtn = document.getElementById('admin-reset');
const adminOrdersSection = document.getElementById('admin-orders');
const adminOrdersTbody = document.getElementById('admin-orders-tbody');
const orderModal = document.getElementById('order-modal');
const orderModalOverlay = document.getElementById('order-modal-overlay');
const orderModalClose = document.getElementById('order-modal-close');
const orderModalOk = document.getElementById('order-modal-ok');
const orderModalTitle = document.getElementById('order-modal-title');
const orderModalMeta = document.getElementById('order-modal-meta');
const orderModalItems = document.getElementById('order-modal-items');
const orderModalTotal = document.getElementById('order-modal-total');

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
const biDashboardSection = document.getElementById('bi-dashboard');
const biIncomeEl = document.getElementById('bi-income');
const biIncomeDeltaEl = document.getElementById('bi-income-delta');
const biOrdersTotalEl = document.getElementById('bi-orders-total');
const biOrdersPaidEl = document.getElementById('bi-orders-paid');
const biOrdersPendingEl = document.getElementById('bi-orders-pending');
const biOrdersCancelledEl = document.getElementById('bi-orders-cancelled');
const biTicketEl = document.getElementById('bi-ticket');
const biOrdersDeltaEl = document.getElementById('bi-orders-delta');
const biCustomersUniqueEl = document.getElementById('bi-customers-unique');
const biCustomersReturningEl = document.getElementById('bi-customers-returning');
const biCancelRateEl = document.getElementById('bi-cancel-rate');
const biUnitsEl = document.getElementById('bi-units');
const biCloseRateEl = document.getElementById('bi-close-rate');
const biCostEl = document.getElementById('bi-cost');
const biProfitEl = document.getElementById('bi-profit');
const biMarginEl = document.getElementById('bi-margin');
const biCoverageEl = document.getElementById('bi-coverage');
const biCoverageHintEl = document.getElementById('bi-coverage-hint');
const biBarsSvg = document.getElementById('bi-sales-bars');
const biBarsX = document.getElementById('bi-sales-bars-x');
const biStatusDonut = document.getElementById('bi-status-donut');
const biDonutPaidRate = document.getElementById('bi-paid-rate');
const biPaidPctEl = document.getElementById('bi-paid-pct');
const biPendingPctEl = document.getElementById('bi-pending-pct');
const biCancelledPctEl = document.getElementById('bi-cancelled-pct');
const biTopProductsAmountTbody = document.getElementById('bi-top-products-amount');
const biTopProductsQtyTbody = document.getElementById('bi-top-products');
const biCatTableTbody = document.getElementById('bi-cat-table');
const biStockAlertCountEl = document.getElementById('bi-stock-alert-count');
const biStockTableTbody = document.getElementById('bi-stock-table');
const biPresetBtns = document.querySelectorAll('[data-bi-preset]');
const biFromInput = document.getElementById('bi-from');
const biToInput = document.getElementById('bi-to');
const biStatusSelect = document.getElementById('bi-status');
const biCategorySelect = document.getElementById('bi-category');
const biApplyBtn = document.getElementById('bi-apply');
const biResetBtn = document.getElementById('bi-reset');

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

function normalizeStatus(status) {
  const v = String(status || '').toLowerCase().trim();
  if (v === 'paid' || v === 'pagado') return 'paid';
  if (v === 'cancelled' || v === 'cancelado') return 'cancelled';
  return 'pending';
}

function getSaleDate(order) {
  const ref = order?.paid_at || order?.created_at;
  return ref ? new Date(ref) : new Date();
}

function formatCurrencyMXN(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  });
}

function buildOrderProductsSummary(orderId) {
  const items = orderItemsByOrderId.get(orderId) || [];
  if (!items.length) {
    return { label: '—', totalQty: 0, countItems: 0 };
  }

  const totalQty = items.reduce(
    (acc, item) => acc + (Number(item.qty) || 0),
    0
  );

  const label = `${totalQty} artículo${totalQty === 1 ? '' : 's'}`;

  return {
    label,
    totalQty,
    countItems: items.length,
  };
}

function closeOrderModal() {
  if (!orderModal) return;
  orderModal.classList.remove('is-open');
  orderModal.setAttribute('aria-hidden', 'true');
  if (orderModalItems) {
    orderModalItems.textContent = '';
  }
}

function openOrderModal(orderId) {
  if (!orderModal) return;

  const order = orders.find((o) => Number(o.id) === Number(orderId));
  const items = orderItemsByOrderId.get(orderId) || [];
  const statusInfo = formatOrderStatus(order?.status || '');

  if (orderModalMeta) {
    const metaParts = [
      order ? `Pedido #${order.id}` : `Pedido #${orderId}`,
      formatDateTime(order?.created_at),
      order?.customer_email || '—',
      statusInfo.label || '',
    ].filter(Boolean);

    orderModalMeta.textContent = metaParts.join(' · ');
  }

  if (orderModalItems) {
    orderModalItems.textContent = '';

    if (!items.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Sin productos';
      tr.appendChild(td);
      orderModalItems.appendChild(tr);
    } else {
      items.forEach((item) => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = item.name || '—';

        const tdQty = document.createElement('td');
        tdQty.className = 't-right';
        tdQty.textContent = String(item.qty || 0);

        const tdUnit = document.createElement('td');
        tdUnit.className = 't-right';
        tdUnit.textContent = formatCurrencyMXN(item.unit);

        const tdSubtotal = document.createElement('td');
        tdSubtotal.className = 't-right';
        tdSubtotal.textContent = formatCurrencyMXN(item.subtotal);

        tr.appendChild(tdName);
        tr.appendChild(tdQty);
        tr.appendChild(tdUnit);
        tr.appendChild(tdSubtotal);
        orderModalItems.appendChild(tr);
      });
    }
  }

  if (orderModalTotal) {
    const computed = orderComputedTotalsByOrderId.get(orderId);
    const totalBase = Number(order?.total) || 0;
    const totalToShow =
      Number.isFinite(computed) && computed > 0 ? computed : totalBase;
    orderModalTotal.textContent = formatCurrencyMXN(totalToShow);
  }

  if (orderModalTitle) {
    orderModalTitle.textContent = 'Detalle del pedido';
  }

  orderModal.classList.add('is-open');
  orderModal.setAttribute('aria-hidden', 'false');
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
  if (biDashboardSection) {
    biDashboardSection.classList.toggle('is-visible', isAdmin);
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

  if (targetStatus === 'paid') {
    // asegurar costos antes de marcar pagado (los triggers bloquean después)
    const { data: items, error: itemsError } = await supabaseClient
      .from('order_items')
      .select('id,product_id,unit_cost,cost_subtotal,quantity')
      .eq('order_id', orderId);
    if (itemsError) throw itemsError;

    let productsMap = null;
    if (!productsCache) {
      productsCache = await fetchProducts();
    }
    productsMap = buildProductMap(productsCache);

    const updates = [];
    for (const it of items || []) {
      const unitCost = Number(it.unit_cost);
      const costSub = Number(it.cost_subtotal);
      const qty = Number(it.quantity) || 0;
      if ((unitCost || costSub) > 0 || qty <= 0) continue;
      const prod = productsMap.get(it.product_id);
      const prodCost = prod && Number.isFinite(Number(prod.costo)) ? Number(prod.costo) : 0;
      if (prodCost > 0) {
        updates.push({
          id: it.id,
          unit_cost: prodCost,
          cost_subtotal: prodCost * qty,
        });
      }
    }

    if (updates.length) {
      const { error: updErr } = await supabaseClient
        .from('order_items')
        .upsert(updates, { onConflict: 'id' });
      if (updErr) throw updErr;
    }
  }

  const { error: updateError } = await supabaseClient
    .from('orders')
    .update(
      targetStatus === 'paid'
        ? { status: targetStatus, paid_at: new Date().toISOString() }
        : { status: targetStatus }
    )
    .eq('id', orderId);

  if (updateError) throw updateError;

  await loadOrders();
}

function renderOrders() {
  if (!adminOrdersTbody) return;

  if (!orders.length) {
    adminOrdersTbody.innerHTML =
      '<tr><td colspan="7">Aún no hay pedidos registrados.</td></tr>';
    return;
  }

  adminOrdersTbody.innerHTML = '';

  orders.forEach((order) => {
    const tr = document.createElement('tr');

    const { normalized, label } = formatOrderStatus(order.status);
    const { label: summaryLabel } = buildOrderProductsSummary(order.id);

    const tdId = document.createElement('td');
    tdId.textContent = order.id;

    const tdProducts = document.createElement('td');
    const productsWrapper = document.createElement('div');
    productsWrapper.className = 'order-products';

    const summarySpan = document.createElement('span');
    summarySpan.className = 'order-products__summary';
    summarySpan.textContent = summaryLabel;

    const detailsBtn = document.createElement('button');
    detailsBtn.type = 'button';
    detailsBtn.className = 'btn-outline';
    detailsBtn.textContent = 'Ver detalles';
    detailsBtn.dataset.orderDetails = '1';
    detailsBtn.dataset.orderId = order.id;

    productsWrapper.appendChild(summarySpan);
    productsWrapper.appendChild(detailsBtn);
    tdProducts.appendChild(productsWrapper);

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateTime(order.created_at);

    const tdCustomer = document.createElement('td');
    tdCustomer.textContent = order.customer_email || '-';

    const tdTotal = document.createElement('td');
    const computed = orderComputedTotalsByOrderId.get(order.id);
    const totalToShow =
      Number.isFinite(computed) && computed > 0
        ? computed
        : Number(order.total) || 0;
    tdTotal.textContent = formatCurrencyMXN(totalToShow);

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
    tr.appendChild(tdProducts);
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
    if (!orders.length) {
      orderItemsByOrderId = new Map();
      orderComputedTotalsByOrderId = new Map();
      renderOrders();
      return;
    }

    const orderIds = orders.map((o) => o.id);

    const { data: items, error: itemsError } = await supabaseClient
      .from('order_items')
      .select('order_id, product_name, quantity, unit_price, subtotal')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    orderItemsByOrderId = new Map();
    orderComputedTotalsByOrderId = new Map();

    (items || []).forEach((it) => {
      const oid = Number(it.order_id);
      if (!Number.isFinite(oid)) return;

      const arr = orderItemsByOrderId.get(oid) || [];
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price) || 0;
      const sub = Number(it.subtotal);
      const subtotal = Number.isFinite(sub) ? sub : unit * qty;

      arr.push({
        name: it.product_name || '—',
        qty,
        unit,
        subtotal,
      });

      orderItemsByOrderId.set(oid, arr);
      orderComputedTotalsByOrderId.set(
        oid,
        (orderComputedTotalsByOrderId.get(oid) || 0) + subtotal
      );
    });

    renderOrders();
  } catch (err) {
    console.error('[orders] error cargando pedidos', err);
    orderItemsByOrderId = new Map();
    orderComputedTotalsByOrderId = new Map();
    if (adminOrdersTbody) {
      adminOrdersTbody.innerHTML =
        '<tr><td colspan="7">No se pudieron cargar los pedidos. Revisa la consola.</td></tr>';
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

function formatDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderBarsSVG(svg, series) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const width = 280;
  const height = 88;
  const pad = 10;
  const n = series.length;
  const gap = 6;
  const barW = Math.floor((width - pad * 2 - gap * (n - 1)) / n);

  let max = 0;
  for (const v of series) {
    if (v > max) max = v;
  }
  if (max <= 0) max = 1;

  const NS = 'http://www.w3.org/2000/svg';

  const base = document.createElementNS(NS, 'line');
  base.setAttribute('x1', String(pad));
  base.setAttribute('x2', String(width - pad));
  base.setAttribute('y1', String(height - pad));
  base.setAttribute('y2', String(height - pad));
  base.setAttribute('stroke', 'rgba(148,163,184,.25)');
  base.setAttribute('stroke-width', '1');
  svg.appendChild(base);

  for (let i = 0; i < n; i += 1) {
    const val = series[i];
    const h = Math.max(2, Math.round((val / max) * (height - pad * 2 - 6)));
    const x = pad + i * (barW + gap);
    const y = height - pad - h;

    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(barW));
    r.setAttribute('height', String(h));
    r.setAttribute('rx', '6');
    r.setAttribute('fill', i % 2 === 0 ? '#86efac' : '#a7f3d0');
    svg.appendChild(r);
  }
}

function renderDonut(paidPct, pendingPct, cancelledPct) {
  if (!biStatusDonut) return;

  const paid = biStatusDonut.querySelector('.bi-donut__seg--paid');
  const pend = biStatusDonut.querySelector('.bi-donut__seg--pending');
  const canc = biStatusDonut.querySelector('.bi-donut__seg--cancelled');

  const clamp = (n) => Math.max(0, Math.min(100, n));
  const p1 = clamp(paidPct);
  const p2 = clamp(pendingPct);
  const p3 = clamp(cancelledPct);

  let offset = 0;
  if (paid) {
    paid.setAttribute('stroke-dasharray', `${p1} ${100 - p1}`);
    paid.setAttribute('stroke-dashoffset', String(-offset));
    offset += p1;
  }
  if (pend) {
    pend.setAttribute('stroke-dasharray', `${p2} ${100 - p2}`);
    pend.setAttribute('stroke-dashoffset', String(-offset));
    offset += p2;
  }
  if (canc) {
    canc.setAttribute('stroke-dasharray', `${p3} ${100 - p3}`);
    canc.setAttribute('stroke-dashoffset', String(-offset));
  }
}

async function fetchProducts() {
  if (productsCache) return productsCache;
  const { data, error } = await supabaseClient
    .from('products')
    .select('id,nombre,categoria,stock,activo,costo');
  if (error) throw error;
  productsCache = data || [];
  return productsCache;
}

function buildProductMap(products) {
  const map = new Map();
  (products || []).forEach((p) => {
    map.set(p.id, p);
  });
  return map;
}

function setPresetActive(preset) {
  biState.preset = preset;
  if (biPresetBtns && biPresetBtns.length) {
    biPresetBtns.forEach((btn) => {
      const isActive = btn.dataset.biPreset === preset;
      btn.classList.toggle('is-active', isActive);
    });
  }
}

function getRangeFromState() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const presets = {
    today: { from: todayStart, to: now },
    '7d': { from: new Date(todayStart.getTime() - 6 * 86400000), to: now },
    '30d': { from: new Date(todayStart.getTime() - 29 * 86400000), to: now },
    '90d': { from: new Date(todayStart.getTime() - 89 * 86400000), to: now },
  };

  if (biState.preset && presets[biState.preset]) {
    return { ...presets[biState.preset], preset: biState.preset };
  }

  const fromVal = biState.from || biFromInput?.value || '';
  const toVal = biState.to || biToInput?.value || '';
  if (fromVal && toVal) {
    const from = new Date(fromVal);
    const to = new Date(toVal);
    to.setHours(23, 59, 59, 999);
    return { from, to, preset: 'custom' };
  }

  return { ...presets['30d'], preset: '30d' };
}

async function fetchOrdersAndItems(range, statusFilter) {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  let query = supabaseClient
    .from('orders')
    .select('id,created_at,paid_at,status,total,customer_id,customer_email')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: ordersData, error } = await query;
  if (error) throw error;
  const ordersList = ordersData || [];
  const ids = ordersList.map((o) => o.id).filter(Boolean);
  if (!ids.length) return { orders: [], items: [] };

  const { data: items, error: itemsError } = await supabaseClient
    .from('order_items')
    .select('order_id,product_id,product_name,unit_price,quantity,subtotal,cost_subtotal,unit_cost')
    .in('order_id', ids);
  if (itemsError) throw itemsError;

  return { orders: ordersList, items: items || [] };
}

function filterByCategory(ordersList, itemsList, category, productMap) {
  if (category === 'all') return { orders: ordersList, items: itemsList };
  const matchOrders = new Set();
  const filteredItems = [];
  for (const it of itemsList) {
    const prod = productMap.get(it.product_id);
    const cat = (prod?.categoria || '').toLowerCase();
    if (cat && cat === category.toLowerCase()) {
      filteredItems.push(it);
      if (it.order_id) matchOrders.add(it.order_id);
    }
  }
  const filteredOrders = ordersList.filter((o) => matchOrders.has(o.id));
  return { orders: filteredOrders, items: filteredItems };
}

function computeKPIs(ordersList, itemsList, productMap, range) {
  const ordersById = new Map();
  ordersList.forEach((o) => {
    ordersById.set(o.id, o);
  });

  const itemsByOrder = new Map();
  for (const it of itemsList) {
    const arr = itemsByOrder.get(it.order_id) || [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  let incomeTotal = 0;
  let incomeWithCost = 0;
  let cost = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let units = 0;
  const customerPaidCount = new Map();
  const customerUnique = new Set();

  const seriesMap = new Map();
  const start14 = new Date(range.to);
  start14.setHours(0, 0, 0, 0);
  start14.setDate(start14.getDate() - 13);

  for (let i = 0; i < 14; i += 1) {
    const d = new Date(start14);
    d.setDate(start14.getDate() + i);
    seriesMap.set(formatDayKey(d), 0);
  }

  const categoryAgg = new Map();
  const topAmount = new Map();
  const topQty = new Map();

  const totalOrders = ordersList.length;

  for (const o of ordersList) {
    const st = normalizeStatus(o.status);
    if (st === 'paid') paidCount += 1;
    else if (st === 'cancelled') cancelledCount += 1;
    else pendingCount += 1;

    const items = itemsByOrder.get(o.id) || [];
    let orderCost = 0;
    let sumItems = 0;
    for (const it of items) {
      const sub = Number(it.subtotal);
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price) || 0;
      const val = Number.isFinite(sub) ? sub : unit * qty;
      if (Number.isFinite(val)) sumItems += val;

      if (st === 'paid') {
        units += qty;
        const costSubtotal = Number(it.cost_subtotal);
        const unitCost = Number(it.unit_cost);
        const prod = productMap.get(it.product_id);
        const prodCost = prod && Number.isFinite(Number(prod.costo)) ? Number(prod.costo) : 0;
        const calcCost = Number.isFinite(costSubtotal) && costSubtotal > 0
          ? costSubtotal
          : Number.isFinite(unitCost) && unitCost > 0
          ? unitCost * qty
          : prodCost > 0
          ? prodCost * qty
          : 0;
        if (calcCost > 0) orderCost += calcCost;
      }
    }

    const saleAmount = sumItems || (Number(o.total) || 0);

    if (st === 'paid') {
      incomeTotal += saleAmount;
      const custKey = o.customer_id || o.customer_email || `anon-${o.id}`;
      customerPaidCount.set(custKey, (customerPaidCount.get(custKey) || 0) + 1);
      customerUnique.add(custKey);
    }

    const effDate = getSaleDate(o);
    const k = formatDayKey(effDate);
    if (st === 'paid' && seriesMap.has(k)) {
      seriesMap.set(k, (seriesMap.get(k) || 0) + (sumItems || Number(o.total) || 0));
    }

    if (st === 'paid') {
      for (const it of items) {
        const sub = Number.isFinite(Number(it.subtotal))
          ? Number(it.subtotal)
          : (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
        const qty = Number(it.quantity) || 0;
        const key = it.product_name || 'Producto';
        topAmount.set(key, (topAmount.get(key) || 0) + sub);
        topQty.set(key, (topQty.get(key) || 0) + qty);

        const prod = productMap.get(it.product_id);
        const cat = prod?.categoria || 'Sin categoría';
        const agg = categoryAgg.get(cat) || { amount: 0, qty: 0 };
        agg.amount += sub;
        agg.qty += qty;
        categoryAgg.set(cat, agg);
      }
      if (orderCost > 0) {
        cost += orderCost;
        incomeWithCost += saleAmount;
      }
    }
  }

  const returning = Array.from(customerPaidCount.values()).filter((v) => v >= 2).length;
  const cancelRate = totalOrders ? Math.round((cancelledCount / totalOrders) * 100) : 0;
  const ticket = paidCount ? incomeTotal / paidCount : 0;
  const profit = incomeWithCost > 0 ? incomeWithCost - cost : 0;
  const margin = incomeWithCost > 0 ? (profit / incomeWithCost) * 100 : 0;
  const closeRate = totalOrders ? Math.round((paidCount / totalOrders) * 100) : 0;
  const coverage = incomeTotal > 0 ? Math.round((incomeWithCost / incomeTotal) * 100) : 0;

  return {
    income: incomeTotal,
    incomeWithCost,
    cost,
    profit,
    margin,
    coverage,
    paidCount,
    pendingCount,
    cancelledCount,
    totalOrders,
    units,
    uniqueCustomers: customerUnique.size,
    returningCustomers: returning,
    cancelRate,
    closeRate,
    ticket,
    series: Array.from(seriesMap.values()),
    seriesLabels: Array.from(seriesMap.keys()),
    topAmount,
    topQty,
    categoryAgg,
  };
}

function renderTopTable(tbody, entries, formatter) {
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  if (!entries.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.textContent = 'Sin datos en el rango.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  entries.forEach(([name, val]) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = name;
    const td2 = document.createElement('td');
    td2.className = 't-right';
    td2.textContent = formatter(val);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  });
}

function renderCategoryTable(tbody, categoryAgg, formatter) {
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  const arr = Array.from(categoryAgg.entries())
    .map(([cat, data]) => ({ cat, amount: data.amount, qty: data.qty }))
    .sort((a, b) => b.amount - a.amount);
  if (!arr.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Sin datos en el rango.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  const top = arr.slice(0, 5);
  const rest = arr.slice(5);
  if (rest.length) {
    const other = rest.reduce(
      (acc, item) => {
        acc.amount += item.amount;
        acc.qty += item.qty;
        return acc;
      },
      { amount: 0, qty: 0 }
    );
    top.push({ cat: 'Otros', amount: other.amount, qty: other.qty });
  }
  top.forEach((row) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = row.cat;
    const td2 = document.createElement('td');
    td2.className = 't-right';
    td2.textContent = formatter(row.amount);
    const td3 = document.createElement('td');
    td3.className = 't-right';
    td3.textContent = String(row.qty);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
}

function renderStockAlerts(tbody, countEl, products) {
  if (countEl) countEl.textContent = String(products.length);
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  if (!products.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Sin alertas.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  products.forEach((p) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = p.nombre || `Producto #${p.id}`;
    const td2 = document.createElement('td');
    td2.className = 't-right';
    td2.textContent = String(p.stock ?? 0);
    const td3 = document.createElement('td');
    td3.className = 't-right';
    td3.textContent = p.categoria || '—';
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
}

function renderDelta(el, delta) {
  if (!el) return;
  if (delta === null || Number.isNaN(delta)) {
    el.textContent = 'vs periodo anterior: —';
    return;
  }
  const sign = delta > 0 ? '+' : '';
  el.textContent = `vs periodo anterior: ${sign}${delta.toFixed(1)}%`;
}

async function loadBIDashboard() {
  if (!isAdmin || !biDashboardSection) return;
  await refreshBIDashboard();
}

async function refreshBIDashboard() {
  const range = getRangeFromState();
  if (biFromInput && range.from) {
    biFromInput.value = formatDayKey(range.from);
  }
  if (biToInput && range.to) {
    biToInput.value = formatDayKey(range.to);
  }

  try {
    const [productsList, currentData] = await Promise.all([
      fetchProducts(),
      fetchOrdersAndItems(range, biState.status),
    ]);
    const productMap = buildProductMap(productsList);
    const catFiltered = filterByCategory(
      currentData.orders,
      currentData.items,
      biState.category,
      productMap
    );

    let prevKpi = null;
    if (range.preset && range.preset !== 'custom') {
      const days =
        range.preset === 'today'
          ? 1
          : range.preset === '7d'
          ? 7
          : range.preset === '90d'
          ? 90
          : 30;
      const prevTo = new Date(range.from.getTime() - 86400000);
      prevTo.setHours(23, 59, 59, 999);
      const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
      prevFrom.setHours(0, 0, 0, 0);
      const prevRange = { from: prevFrom, to: prevTo };
      const prevData = await fetchOrdersAndItems(prevRange, biState.status);
      const prevFiltered = filterByCategory(
        prevData.orders,
        prevData.items,
        biState.category,
        productMap
      );
      prevKpi = computeKPIs(prevFiltered.orders, prevFiltered.items, productMap, prevRange);
    }

    const kpi = computeKPIs(catFiltered.orders, catFiltered.items, productMap, range);

    if (biIncomeEl) biIncomeEl.textContent = formatCurrencyMXN(kpi.income);
    if (biOrdersTotalEl) biOrdersTotalEl.textContent = String(kpi.totalOrders);
    if (biOrdersPaidEl) biOrdersPaidEl.textContent = String(kpi.paidCount);
    if (biOrdersPendingEl) biOrdersPendingEl.textContent = String(kpi.pendingCount);
    if (biOrdersCancelledEl) biOrdersCancelledEl.textContent = String(kpi.cancelledCount);
    if (biTicketEl) biTicketEl.textContent = formatCurrencyMXN(kpi.ticket);
    if (biCloseRateEl) biCloseRateEl.textContent = `${kpi.closeRate}%`;
    if (biCostEl) biCostEl.textContent = formatCurrencyMXN(kpi.cost);
    if (biProfitEl) biProfitEl.textContent = formatCurrencyMXN(kpi.profit);
    if (biMarginEl) biMarginEl.textContent = kpi.incomeWithCost > 0 ? `${kpi.margin.toFixed(1)}%` : '—';
    if (biCustomersUniqueEl) biCustomersUniqueEl.textContent = String(kpi.uniqueCustomers);
    if (biCustomersReturningEl)
      biCustomersReturningEl.textContent = String(kpi.returningCustomers);
    if (biCancelRateEl) biCancelRateEl.textContent = `${kpi.cancelRate}%`;
    if (biUnitsEl) biUnitsEl.textContent = String(kpi.units);
    if (biCoverageEl) biCoverageEl.textContent = `${kpi.coverage}%`;
    if (biCoverageHintEl) {
      biCoverageHintEl.textContent =
        kpi.coverage < 100 && kpi.income > 0
          ? 'Faltan costos en algunos productos.'
          : 'Costos capturados.';
    }

    if (prevKpi && prevKpi.totalOrders) {
      const incomeDelta =
        prevKpi.income > 0 ? ((kpi.income - prevKpi.income) / prevKpi.income) * 100 : null;
      const ordersDelta =
        prevKpi.totalOrders > 0
          ? ((kpi.totalOrders - prevKpi.totalOrders) / prevKpi.totalOrders) * 100
          : null;
      renderDelta(biIncomeDeltaEl, incomeDelta);
      if (biOrdersDeltaEl) {
        if (ordersDelta === null || Number.isNaN(ordersDelta)) {
          biOrdersDeltaEl.textContent = 'vs periodo anterior: —';
        } else {
          const sign = ordersDelta > 0 ? '+' : '';
          biOrdersDeltaEl.textContent = `vs periodo anterior: ${sign}${ordersDelta.toFixed(1)}%`;
        }
      }
    } else {
      renderDelta(biIncomeDeltaEl, null);
      if (biOrdersDeltaEl) biOrdersDeltaEl.textContent = 'vs periodo anterior: —';
    }

    renderBarsSVG(biBarsSvg, kpi.series);
    if (biBarsX) {
      while (biBarsX.firstChild) biBarsX.removeChild(biBarsX.firstChild);
      const left = document.createElement('span');
      left.textContent = kpi.seriesLabels[0]?.slice(5) || '';
      const right = document.createElement('span');
      right.textContent = kpi.seriesLabels[kpi.seriesLabels.length - 1]?.slice(5) || '';
      biBarsX.appendChild(left);
      biBarsX.appendChild(right);
    }

    const totalStatuses = Math.max(1, kpi.paidCount + kpi.pendingCount + kpi.cancelledCount);
    const paidPct = Math.round((kpi.paidCount / totalStatuses) * 100);
    const pendingPct = Math.round((kpi.pendingCount / totalStatuses) * 100);
    const cancelledPct = Math.max(0, 100 - paidPct - pendingPct);
    renderDonut(paidPct, pendingPct, cancelledPct);
    if (biDonutPaidRate) biDonutPaidRate.textContent = `${paidPct}%`;
    if (biPaidPctEl) biPaidPctEl.textContent = `${paidPct}%`;
    if (biPendingPctEl) biPendingPctEl.textContent = `${pendingPct}%`;
    if (biCancelledPctEl) biCancelledPctEl.textContent = `${cancelledPct}%`;

    const topAmountArr = Array.from(kpi.topAmount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    renderTopTable(biTopProductsAmountTbody, topAmountArr, (v) => formatCurrencyMXN(v));

    const topQtyArr = Array.from(kpi.topQty.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    renderTopTable(biTopProductsQtyTbody, topQtyArr, (v) => String(v));

    renderCategoryTable(biCatTableTbody, kpi.categoryAgg, (v) => formatCurrencyMXN(v));

    const lowStock = (productsList || []).filter(
      (p) => p.activo !== false && typeof p.stock === 'number' && p.stock <= 3
    );
    renderStockAlerts(biStockTableTbody, biStockAlertCountEl, lowStock.slice(0, 6));
  } catch (err) {
    console.error('[BI] error', err);
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
  if (inputCosto) {
    inputCosto.value =
      typeof product.costo === 'number' && !Number.isNaN(product.costo)
        ? product.costo
        : '';
  }
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
  const costo = Number(formData.get('costo') || 0);
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

  if (!Number.isFinite(costo) || costo < 0) {
    alert('El costo debe ser 0 o mayor.');
    return;
  }

  const payload = {
    nombre,
    precio,
    costo,
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
  if (!isAdmin) return;

  const detailsBtn = event.target.closest('[data-order-details]');
  if (detailsBtn) {
    const detailId = Number(detailsBtn.dataset.orderId);
    if (detailId) {
      openOrderModal(detailId);
    }
    return;
  }

  const btn = event.target.closest('[data-order-action]');
  if (!btn) return;

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

function initBIFilters(products) {
  if (!biCategorySelect) return;
  const categories = new Set();
  (products || []).forEach((p) => {
    if (p.categoria) categories.add(p.categoria);
  });
  const existing = biCategorySelect.querySelectorAll('option[data-dynamic]');
  existing.forEach((opt) => opt.remove());
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    opt.dataset.dynamic = '1';
    biCategorySelect.appendChild(opt);
  });
}

function setupBIFilters() {
  if (biPresetBtns && biPresetBtns.length) {
    biPresetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setPresetActive(btn.dataset.biPreset || '30d');
        biState.from = null;
        biState.to = null;
      });
    });
  }
  if (biStatusSelect) {
    biStatusSelect.addEventListener('change', () => {
      biState.status = biStatusSelect.value || 'all';
    });
  }
  if (biCategorySelect) {
    biCategorySelect.addEventListener('change', () => {
      biState.category = biCategorySelect.value || 'all';
    });
  }
  if (biApplyBtn) {
    biApplyBtn.addEventListener('click', () => {
      if (biFromInput?.value && biToInput?.value) {
        biState.from = biFromInput.value;
        biState.to = biToInput.value;
        biState.preset = 'custom';
      }
      refreshBIDashboard();
    });
  }
  if (biResetBtn) {
    biResetBtn.addEventListener('click', () => {
      setPresetActive('30d');
      biState.status = 'all';
      biState.category = 'all';
      biState.from = null;
      biState.to = null;
      if (biStatusSelect) biStatusSelect.value = 'all';
      if (biCategorySelect) biCategorySelect.value = 'all';
      if (biFromInput) biFromInput.value = '';
      if (biToInput) biToInput.value = '';
      refreshBIDashboard();
    });
  }
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
  if (orderModalOverlay) {
    orderModalOverlay.addEventListener('click', closeOrderModal);
  }
  if (orderModalClose) {
    orderModalClose.addEventListener('click', closeOrderModal);
  }
  if (orderModalOk) {
    orderModalOk.addEventListener('click', closeOrderModal);
  }
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && orderModal?.classList.contains('is-open')) {
      closeOrderModal();
    }
  });

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
        fetchProducts()
          .then((products) => {
            initBIFilters(products);
            setPresetActive(biState.preset || '30d');
            setupBIFilters();
            return loadBIDashboard();
          })
          .catch((err) => console.error('[BI] fallo post-auth', err));
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
        fetchProducts()
          .then((products) => {
            initBIFilters(products);
            setPresetActive('30d');
            setupBIFilters();
            return loadBIDashboard();
          })
          .catch((err) => console.error('[BI] fallo en bootstrap', err));
      } else {
        alert('Acceso solo para administradores. Inicia sesión con una cuenta autorizada.');
        window.location.href = 'login.html?next=administrativo.html';
      }
    } catch (err) {
      console.error('[admin] error inicializando panel', err);
    }
  })();
})();
