/* Amber Trinkets – shared cart behavior */

let cart = [];

let cartItemsContainerListenerAttached = false;

let toastTimer = null;

function ensureToastElement() {
  let toast = document.querySelector('.js-toast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.className = 'toast js-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  document.body.appendChild(toast);
  return toast;
}

function showToast(message) {
  const toast = ensureToastElement();

  toast.textContent = String(message ?? '');
  toast.hidden = false;
  toast.classList.add('is-visible');

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.hidden = true;
    }, 240);
  }, 2200);
}

function formatINR(amount) {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return '₹ 0';
  return `₹ ${value.toLocaleString('en-IN')}`;
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    const price = Number(item?.price ?? 0);
    const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1)));
    return sum + (Number.isFinite(price) ? price : 0) * qty;
  }, 0);
}

function normalizeCart(rawCart) {
  if (!Array.isArray(rawCart)) return [];

  const normalized = [];

  rawCart.forEach((item) => {
    const name = String(item?.name ?? 'Item');
    const price = Number(item?.price ?? 0);
    const qtyCandidate = Number(item?.qty ?? 1);
    const qty = Number.isFinite(qtyCandidate) ? Math.max(1, Math.floor(qtyCandidate)) : 1;

    if (!Number.isFinite(price) || price < 0) return;

    // Merge identical lines (same name + price)
    const existing = normalized.find((x) => x.name === name && x.price === price);
    if (existing) {
      existing.qty += qty;
    } else {
      normalized.push({ name, price, qty });
    }
  });

  return normalized;
}

function getTotalQuantity() {
  return cart.reduce((sum, item) => sum + (Number(item?.qty ?? 0) || 0), 0);
}

function loadCart() {
  try {
    const savedCart = localStorage.getItem('amberTrinketsCart');
    const rawCart = savedCart ? JSON.parse(savedCart) : [];
    cart = normalizeCart(rawCart);
  } catch {
    cart = [];
  }
}

function saveCart() {
  localStorage.setItem('amberTrinketsCart', JSON.stringify(cart));
}

function incrementQty(index) {
  const item = cart[index];
  if (!item) return;
  item.qty = Math.max(1, Math.floor(Number(item.qty ?? 1)) + 1);
  saveCart();
  updateCartUI();
}

function decrementQty(index) {
  const item = cart[index];
  if (!item) return;
  const nextQty = Math.floor(Number(item.qty ?? 1)) - 1;

  if (nextQty <= 0) {
    removeFromCart(index);
    return;
  }

  item.qty = nextQty;
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const cartContainer = document.getElementById('cart-items');
  const cartCountElement = document.getElementById('cart-count');
  const cartTotalElement = document.getElementById('cart-total');

  if (!cartContainer || !cartCountElement || !cartTotalElement) return;

  if (!cartItemsContainerListenerAttached) {
    cartContainer.addEventListener('click', (event) => {
      const removeButton = event.target?.closest?.('.remove-item');
      if (!removeButton) return;

      const index = Number(removeButton.dataset.index);
      if (!Number.isInteger(index)) return;

      removeFromCart(index);
    });

    cartContainer.addEventListener('click', (event) => {
      const qtyButton = event.target?.closest?.('.qty-btn');
      if (!qtyButton) return;

      const index = Number(qtyButton.dataset.index);
      if (!Number.isInteger(index)) return;

      const action = qtyButton.dataset.action;
      if (action === 'plus') incrementQty(index);
      if (action === 'minus') decrementQty(index);
    });

    cartItemsContainerListenerAttached = true;
  }

  cartCountElement.innerText = String(getTotalQuantity());

  const checkoutBtns = document.querySelectorAll('.js-checkout');
  
  if (cart.length === 0) {
    cartContainer.innerHTML = '<p class="empty-cart-msg">Your bag is currently empty.</p>';
    cartTotalElement.innerText = '₹ 0';
    checkoutBtns.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    });
    return;
  }

  checkoutBtns.forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  });

  let cartHTML = '';
  let total = 0;

  cart.forEach((item, index) => {
    const price = Number(item?.price ?? 0);
    const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1)));
    const lineTotal = (Number.isFinite(price) ? price : 0) * qty;
    total += lineTotal;

    const name = String(item?.name ?? 'Item');
    cartHTML += `
      <div class="cart-item">
        <div class="cart-item-details">
          <span class="cart-item-title">${escapeHtml(name)}</span>
          <div class="cart-item-controls">
            <div class="qty-controls" aria-label="Quantity controls">
              <button class="qty-btn" type="button" data-action="minus" data-index="${index}" aria-label="Decrease quantity">−</button>
              <span class="qty-value" aria-label="Quantity">${qty}</span>
              <button class="qty-btn" type="button" data-action="plus" data-index="${index}" aria-label="Increase quantity">+</button>
            </div>
            <button class="remove-item" type="button" data-index="${index}">Remove</button>
          </div>
        </div>
        <span class="cart-item-price">₹ ${lineTotal.toLocaleString('en-IN')}</span>
      </div>
    `;
  });

  cartContainer.innerHTML = cartHTML;
  cartTotalElement.innerText = `₹ ${total.toLocaleString('en-IN')}`;
}

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.querySelector('.cart-overlay');
  if (!drawer || !overlay) return;

  drawer.classList.toggle('active');
  overlay.classList.toggle('active');
}

function addToCart(productName, price) {
  const name = String(productName);
  const unitPrice = Number(price);

  // If the same product already exists, increment qty.
  const existingIndex = cart.findIndex((item) => item?.name === name && item?.price === unitPrice);
  if (existingIndex >= 0) {
    incrementQty(existingIndex);
    toggleCart();
    return;
  }

  cart.push({ name, price: unitPrice, qty: 1 });
  saveCart();
  updateCartUI();
  toggleCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

function checkout() {
  if (cart.length === 0) {
    showToast('Your bag is empty.');
    return;
  }

  const brandName = 'Amber Trinkets';
  const brandInstagramUrl = 'https://www.instagram.com/amber.trinkets?igsh=MTZ2ODB6dng4cDg1aQ==';
  const paymentGatewayUrl = '';
  const whatsappBusinessE164 = '917000303182';

  function openInNewTab(url) {
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      window.location.href = url;
    }
  }

  function ensureCheckoutModal() {
    let overlay = document.querySelector('.js-checkout-modal-overlay');
    let modal = document.querySelector('.js-checkout-modal');

    if (overlay && modal) return { overlay, modal };

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-checkout-modal-overlay';
    overlay.hidden = true;

    modal = document.createElement('div');
    modal.className = 'checkout-modal js-checkout-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'checkout-modal-title');
    modal.hidden = true;

    modal.innerHTML = `
      <div class="contact-modal__header">
        <h3 class="contact-modal__title" id="checkout-modal-title">Checkout</h3>
        <button class="contact-modal__close js-checkout-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="contact-modal__subtitle">Review your order, then choose how you’d like to pay.</p>
      <div class="checkout-summary js-checkout-summary" aria-label="Order summary"></div>
      <div class="contact-modal__actions">
        <button class="btn btn-inline contact-modal__primary js-checkout-whatsapp" type="button">Checkout on WhatsApp</button>
      </div>
      <p class="contact-modal__note js-checkout-note" aria-live="polite"></p>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const closeButton = modal.querySelector('.js-checkout-modal-close');

    function setOpen(isOpen) {
      modal.hidden = !isOpen;
      overlay.hidden = !isOpen;
      document.body.classList.toggle('is-modal-open', isOpen);
      if (isOpen) closeButton?.focus?.();
    }

    overlay.addEventListener('click', () => setOpen(false));
    closeButton?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (modal.hidden) return;
      setOpen(false);
    });

    modal.__setOpen = setOpen;

    return { overlay, modal };
  }

  const { modal } = ensureCheckoutModal();
  const setOpen = modal.__setOpen;

  const summary = modal.querySelector('.js-checkout-summary');
  const payLink = modal.querySelector('.js-checkout-pay');
  const whatsappButton = modal.querySelector('.js-checkout-whatsapp');
  const note = modal.querySelector('.js-checkout-note');

  const total = getCartTotal();
  const itemLines = cart.map((item) => {
    const name = String(item?.name ?? 'Item');
    const price = Number(item?.price ?? 0);
    const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1)));
    const lineTotal = (Number.isFinite(price) ? price : 0) * qty;
    return { name, price: Number.isFinite(price) ? price : 0, qty, lineTotal };
  });

  if (summary) {
    const rows = itemLines
      .map(
        (x) => `
        <div class="checkout-item">
          <div class="checkout-item__left">
            <div class="checkout-item__name">${escapeHtml(x.name)}</div>
            <div class="checkout-item__meta">Qty ${x.qty} · ${formatINR(x.price)} each</div>
          </div>
          <div class="checkout-item__right">${formatINR(x.lineTotal)}</div>
        </div>
      `,
      )
      .join('');

    summary.innerHTML = `
      <div class="checkout-items">${rows}</div>
      <div class="checkout-total">
        <span>Subtotal</span>
        <strong>${formatINR(total)}</strong>
      </div>
      <div class="checkout-hint">Shipping & taxes (if any) will be confirmed on WhatsApp.</div>
    `;
  }

  const orderTextLines = [
    `Hello ${brandName} ✨`,
    '🛍️ I want to place an order from the website.',
    '',
    '📦 Order details:',
    ...itemLines.map((x) => `• ${x.name} ×${x.qty} — ${formatINR(x.lineTotal)}`),
    '',
    `💰 Subtotal: ${formatINR(total)}`,
    '',
    '✅ Please share the payment link / UPI details.',
    '🏠 I will share delivery address & pincode next.',
    brandInstagramUrl ? `📸 Instagram: ${brandInstagramUrl}` : null,
  ].filter(Boolean);

  const orderText = orderTextLines.join('\n');
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappBusinessE164}&text=${encodeURIComponent(orderText)}`;

  if (note) note.textContent = '';

  if (whatsappButton) {
    whatsappButton.onclick = () => {
      openInNewTab(whatsappUrl);
      setOpen?.(false);
    };
  }

  // Close cart drawer if it is open, then show checkout modal.
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.querySelector('.cart-overlay');
  if (drawer?.classList?.contains('active')) {
    drawer.classList.remove('active');
    overlay?.classList?.remove('active');
  }

  setOpen?.(true);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initPerformanceMode() {
  const body = document.body;
  if (!body) return;
  const root = document.documentElement;

  const params = new URLSearchParams(window.location.search);
  const forced = params.get('perf');

  if (forced === 'lite') {
    body.classList.add('perf-lite');
    root?.classList?.add('perf-lite');
    return;
  }

  if (forced === 'full') {
    body.classList.remove('perf-lite');
    root?.classList?.remove('perf-lite');
    return;
  }

  const stored = window.localStorage?.getItem('amberPerfMode');
  if (stored === 'lite') {
    body.classList.add('perf-lite');
    root?.classList?.add('perf-lite');
    return;
  }
  if (stored === 'full') {
    // Avoid accidental heavy-mode on desktop; only allow full via ?perf=full.
    window.localStorage?.removeItem('amberPerfMode');
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType ?? '');
  const slowNetwork = /(slow-2g|2g)/i.test(effectiveType);

  const deviceMemory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const lowMemory = typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 4;
  const lowCores = typeof cores === 'number' && cores > 0 && cores <= 4;

  // Default to perf-lite EVERYWHERE for now (smooth performance is priority)
  // Allow opt-in to full effects with ?perf=full
  const shouldLite = true;

  if (shouldLite) {
    body.classList.add('perf-lite');
    root?.classList?.add('perf-lite');
  }
}

function init3DTilt() {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;
  if (document.body.classList.contains('perf-lite')) return;

  const tiltElements = Array.from(document.querySelectorAll('.js-tilt'));
  if (tiltElements.length === 0) return;

  const maxTilt = 10; // degrees

  tiltElements.forEach((element) => {
    element.classList.add('u-3d-card');
    const stage = element.closest('.u-3d-stage');
    if (!stage) {
      // ensure perspective even if user forgot wrapper
      element.style.perspective = '1000px';
    }

    let rafId = null;
    let lastClientX = null;
    let lastClientY = null;

    function applyTilt(clientX, clientY) {
      element.style.transform = '';
      const rect = element.getBoundingClientRect();
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      const rotateY = (x - 0.5) * (maxTilt * 2);
      const rotateX = (0.5 - y) * (maxTilt * 2);

      element.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`;
      element.style.setProperty('--shine-x', `${(x * 100).toFixed(1)}%`);
      element.style.setProperty('--shine-y', `${(y * 100).toFixed(1)}%`);
      element.style.setProperty('--shine-o', '1');
      element.classList.add('is-tilting');
    }

    function reset() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = null;
      lastClientX = null;
      lastClientY = null;
      element.style.transform = '';
      element.style.setProperty('--shine-o', '0');
      element.classList.remove('is-tilting');
    }

    function schedule() {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyTilt(lastClientX, lastClientY);
      });
    }

    function onMove(event) {
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      const clientY = event.touches?.[0]?.clientY ?? event.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
      lastClientX = clientX;
      lastClientY = clientY;
      schedule();
    }

    element.addEventListener('pointerenter', () => {
      element.style.transition = 'transform 120ms ease, box-shadow 200ms ease';
    });

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', reset);

    element.addEventListener(
      'touchmove',
      (e) => {
        onMove(e);
      },
      { passive: true },
    );
    element.addEventListener('touchend', reset);
  });
}

function initHeroParallax() {
  const hero = document.querySelector('.hero-luxe');
  if (!hero) return;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;
  if (document.body.classList.contains('perf-lite')) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = null;
  let isInView = true;

  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver(
      (entries) => {
        isInView = Boolean(entries?.[0]?.isIntersecting);
        if (!isInView) {
          targetX = 0;
          targetY = 0;
          hero.style.setProperty('--mx', '0');
          hero.style.setProperty('--my', '0');
        }
      },
      { threshold: 0.05 },
    );
    io.observe(hero);
  }

  function scheduleTick() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(tick);
  }

  function tick() {
    // Smooth towards target
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    hero.style.setProperty('--mx', currentX.toFixed(3));
    hero.style.setProperty('--my', currentY.toFixed(3));

    const dx = Math.abs(targetX - currentX);
    const dy = Math.abs(targetY - currentY);
    if (!isInView || (dx < 0.001 && dy < 0.001)) {
      rafId = null;
      return;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function setFromEvent(clientX, clientY) {
    const rect = hero.getBoundingClientRect();
    const x = (clientX - rect.left) / Math.max(1, rect.width);
    const y = (clientY - rect.top) / Math.max(1, rect.height);
    targetX = (x - 0.5) * 2;
    targetY = (y - 0.5) * 2;
  }

  hero.addEventListener('pointermove', (e) => {
    if (!isInView) return;
    setFromEvent(e.clientX, e.clientY);
    scheduleTick();
  });

  hero.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    scheduleTick();
  });

  // Gentle scroll parallax (small nudge)
  window.addEventListener(
    'scroll',
    () => {
      if (!isInView) return;
      const y = hero.getBoundingClientRect().top;
      const normalized = Math.max(-1, Math.min(1, y / window.innerHeight));
      targetY = targetY + normalized * 0.06;
      scheduleTick();
    },
    { passive: true },
  );
}

function initAmbientParallax() {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;
  if (document.body.classList.contains('perf-lite')) return;

  const root = document.documentElement;
  if (!root) return;

  let targetX = 0;
  let targetY = 0;
  let targetScroll = 0;
  let currentX = 0;
  let currentY = 0;
  let currentScroll = 0;
  let rafId = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function schedule() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(tick);
  }

  function tick() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    currentScroll += (targetScroll - currentScroll) * 0.06;

    root.style.setProperty('--ambient-x', currentX.toFixed(3));
    root.style.setProperty('--ambient-y', currentY.toFixed(3));
    root.style.setProperty('--ambient-scroll', currentScroll.toFixed(3));

    const dx = Math.abs(targetX - currentX);
    const dy = Math.abs(targetY - currentY);
    const ds = Math.abs(targetScroll - currentScroll);

    if (dx < 0.001 && dy < 0.001 && ds < 0.001) {
      rafId = null;
      return;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function updateScrollTarget() {
    const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const p = clamp(window.scrollY / max, 0, 1);
    targetScroll = (p - 0.5) * 2;
    schedule();
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const x = clamp(e.clientX / w, 0, 1);
      const y = clamp(e.clientY / h, 0, 1);
      targetX = (x - 0.5) * 2;
      targetY = (y - 0.5) * 2;
      schedule();
    },
    { passive: true },
  );

  document.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
    schedule();
  });

  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  updateScrollTarget();
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress-bar');
  if (!bar) return;

  let rafId = null;
  let lastP = -1;

  function update() {
    rafId = null;
    const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const p = Math.max(0, Math.min(1, window.scrollY / max));

    if (Math.abs(p - lastP) < 0.001) return;
    lastP = p;

    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  }

  function schedule() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  schedule();
}

function initSideActions() {
  const canShow = () => window.innerWidth >= 980;

  function ensureGroup(side) {
    const cls = side === 'left' ? 'side-actions--left' : 'side-actions--right';
    let el = document.querySelector(`.side-actions.${cls}`);
    if (el) return el;

    el = document.createElement('div');
    el.className = `side-actions ${cls}`;
    el.setAttribute('aria-label', 'Quick links');
    document.body.appendChild(el);
    return el;
  }

  function setLink(group, text, href, opts = {}) {
    const key = String(text).toLowerCase().replaceAll(/\s+/g, '-');
    let a = group.querySelector(`a[data-key="${key}"]`);
    if (!a) {
      a = document.createElement('a');
      a.className = 'side-actions__link';
      a.dataset.key = key;
      group.appendChild(a);
    }
    a.textContent = text;
    a.setAttribute('href', href);
    if (opts.newTab) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
    return a;
  }

  function mount() {
    if (!canShow()) return;

    const left = ensureGroup('left');
    const right = ensureGroup('right');

    setLink(left, 'Shop', 'collection.html');
    setLink(left, 'Contact', 'index.html#contact');

    const phoneE164 = '917000303182';
    setLink(right, 'WhatsApp', `https://api.whatsapp.com/send?phone=${phoneE164}&text=${encodeURIComponent('Hello Amber Trinkets!')}`, { newTab: true });
    setLink(right, 'Instagram', 'https://www.instagram.com/amber.trinkets?igsh=MTZ2ODB6dng4cDg1aQ==', { newTab: true });
  }

  function unmount() {
    document.querySelectorAll('.side-actions').forEach((el) => el.remove());
  }

  function sync() {
    if (!canShow()) {
      unmount();
      return;
    }
    mount();
  }

  window.addEventListener('resize', sync, { passive: true });
  sync();
}

function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;
  const isLite = document.body.classList.contains('perf-lite');

  const selectors = [
    // Sections / blocks
    '.page-header',
    '.featured-banner',
    '.new-collection',
    '.latest-launch',
    '.contact-section',
    '.categories-container',
    '.products-container',
    // Home media / CTAs
    '.new-collection__media',
    '.new-collection__cta',
    '.latest-launch__media',
    '.latest-launch__actions',
    // Cards
    '.category-card',
    '.product-card',
    '.new-collection__card',
    '.latest-launch__card',
  ];

  const elements = Array.from(document.querySelectorAll(selectors.join(','))).filter(Boolean);
  if (elements.length === 0) return;

  // If IntersectionObserver is unavailable, just show everything.
  if (typeof IntersectionObserver === 'undefined') {
    elements.forEach((el) => {
      el.classList.add(isLite ? 'reveal' : 'reveal-3d', 'is-visible');
    });
    return;
  }

  elements.forEach((el) => {
    const base = isLite ? 'reveal' : 'reveal-3d';
    if (!el.classList.contains(base)) el.classList.add(base);

    if (el.matches('.category-card, .product-card, .new-collection__card, .latest-launch__card')) {
      el.classList.add(isLite ? 'reveal--fast' : 'reveal-3d--fast');
    }
  });

  // Add a subtle stagger so items feel more premium.
  // Group by section, then apply incremental delays within that group.
  const groupSelectors = ['.new-collection', '.latest-launch', '.categories-container', '.products-container'];
  const groupMap = new Map();

  function getGroupKey(el) {
    const groupEl = el.closest(groupSelectors.join(','));
    if (groupEl) return groupEl;
    return el.closest('.page-header, .featured-banner, .contact-section') ?? document.body;
  }

  elements.forEach((el) => {
    const key = getGroupKey(el);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(el);
  });

  groupMap.forEach((groupEls) => {
    // Prioritize hero-like pieces first, then cards.
    const sorted = groupEls.slice().sort((a, b) => {
      const aPri = a.matches('.new-collection__media, .latest-launch__media, .new-collection__cta, .latest-launch__actions') ? 0 : 1;
      const bPri = b.matches('.new-collection__media, .latest-launch__media, .new-collection__cta, .latest-launch__actions') ? 0 : 1;
      return aPri - bPri;
    });

    sorted.forEach((el, index) => {
      const delay = Math.min(320, index * 90);
      el.style.setProperty('--reveal-delay', `${delay}ms`);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -10% 0px' },
  );

  elements.forEach((el) => observer.observe(el));
}

function initSmoothScrollAnchors() {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;

  const nav = document.querySelector('nav');
  const getOffset = () => (nav ? Math.ceil(nav.getBoundingClientRect().height) : 0) + 12;

  document.addEventListener('click', (event) => {
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.target && link.target !== '_self') return;
    if (event.defaultPrevented) return;

    const rawHref = link.getAttribute('href') || '';
    if (!rawHref.includes('#')) return;

    let url;
    try {
      url = new URL(link.href);
    } catch {
      return;
    }

    // Only handle same-page anchors.
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== window.location.pathname) return;

    const hash = url.hash;
    if (!hash || hash === '#') return;

    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();

    const top = target.getBoundingClientRect().top + window.scrollY - getOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

    try {
      window.history.pushState({}, '', hash);
    } catch {
      // ignore
    }
  });
}

function initPreloader() {
  const isLite = document.body.classList.contains('perf-lite');
  const preloader = document.getElementById('awwwards-preloader');
  if (!preloader || isLite) {
    document.body.classList.add('is-ready', 'is-loaded');
    return;
  }
  
  // Bring text in
  setTimeout(() => {
    document.body.classList.add('is-ready');
  }, 100);

  // Slide preloader up
  setTimeout(() => {
    document.body.classList.add('is-loaded');
  }, 1200);

  // Clean up
  setTimeout(() => {
    preloader.remove();
  }, 2200);
}

function initAwwwardsMagnetic() {
  const magnets = document.querySelectorAll('.magnetic-btn, .nav-links a');
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  if(isCoarse) return; // Don't run on mobile touch

  magnets.forEach(btn => {
    btn.addEventListener('mousemove', function(e) {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      this.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      this.style.transition = 'transform 0.1s ease-out';
    });

    btn.addEventListener('mouseleave', function(e) {
      this.style.transform = `translate(0px, 0px)`;
      this.style.transition = 'transform 0.5s cubic-bezier(0.77, 0, 0.175, 1)';
    });
  });
}

function initLiquidResin() {
  const ambientTurb = document.querySelector('#ambient-turbulence');
  const hoverTurb = document.querySelector('#resin-turbulence');
  const displacement = document.querySelector('#resin-displacement');
  if (!ambientTurb) return;

  let p = 0;
  function render() {
    p += 0.005;
    // Ambient slow drift
    if (ambientTurb) ambientTurb.setAttribute('baseFrequency', `0.005 ${0.008 + Math.sin(p) * 0.002}`);
    
    // Fast liquid ripples for hover states
    if (hoverTurb) hoverTurb.setAttribute('baseFrequency', `0.012 ${0.015 + Math.cos(p * 2) * 0.005}`);
    
    // Pulse the exact displacement scale
    if(displacement) displacement.setAttribute('scale', `${25 + Math.sin(p * 3) * 5}`);
    
    requestAnimationFrame(render);
  }
  render();
}

function updateNavOnScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      document.body.classList.add('is-scrolled');
    } else {
      document.body.classList.remove('is-scrolled');
    }
  }, { passive: true });
}

function bindUI() {
  document.querySelectorAll('.js-cart-toggle').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      toggleCart();
    });
  });

  document.querySelectorAll('.js-cart-close').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      toggleCart();
    });
  });

  document.querySelectorAll('.js-cart-overlay').forEach((element) => {
    element.addEventListener('click', () => {
      toggleCart();
    });
  });

  document.querySelectorAll('.js-checkout').forEach((element) => {
    element.addEventListener('click', () => {
      checkout();
    });
  });

  document.querySelectorAll('.js-add-to-cart').forEach((element) => {
    element.addEventListener('click', () => {
      const name = element.dataset.productName ?? 'Item';
      const price = Number(element.dataset.price ?? 0);
      addToCart(name, price);
    });
  });

  const contactForm = document.querySelector('.js-contact-form');
  if (contactForm) {
    const modal = document.querySelector('.js-contact-modal');
    const modalOverlay = document.querySelector('.js-contact-modal-overlay');
    const modalClose = document.querySelector('.js-contact-modal-close');
    const modalPreview = document.querySelector('.js-contact-modal-preview');
    const modalOpen = document.querySelector('.js-contact-modal-open');
    const modalNote = document.querySelector('.js-contact-modal-note');

    function setModalOpen(isOpen) {
      if (!modal || !modalOverlay) return;
      modal.hidden = !isOpen;
      modalOverlay.hidden = !isOpen;
      document.body.classList.toggle('is-modal-open', isOpen);

      if (isOpen) {
        modalClose?.focus?.();
      }
    }

    function closeModal() {
      setModalOpen(false);
    }

    function openInNewTab(url) {
      try {
        window.open(url, '_blank', 'noopener');
      } catch {
        window.location.href = url;
      }
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => {
        closeModal();
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', () => {
        closeModal();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!modal || modal.hidden) return;
      closeModal();
    });

    const chipsContainer = contactForm.querySelector('.js-inquiry-chips');
    if (chipsContainer) {
      chipsContainer.addEventListener('click', (event) => {
        const chip = event.target?.closest('.pro-chip');
        if (!chip || !chipsContainer.contains(chip)) return;

        const isActive = chip.classList.contains('is-active');
        chip.classList.toggle('is-active');
        chip.setAttribute('aria-pressed', isActive ? 'false' : 'true');
      });
    }

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = contactForm.querySelector('#contact-name')?.value?.trim() ?? '';
      const message = contactForm.querySelector('#contact-message')?.value?.trim() ?? '';

      const inquiries = Array.from(contactForm.querySelectorAll('.pro-chip.is-active'))
        .map((el) => String(el.dataset.value ?? el.textContent ?? '').trim())
        .filter(Boolean);

      if (inquiries.length === 0) {
        alert('Please select at least one Custom Inquiry option.');
        return;
      }

      const phoneE164 = '917000303182';
      // Update these to match your brand.
      const brandName = 'Amber Trinkets';
      const brandTagline = 'Luxury resin art & jewellery · Custom commissions · Wholesale';
      const brandInstagramUrl = 'https://www.instagram.com/amber.trinkets?igsh=MTZ2ODB6dng4cDg1aQ==';

      const textLines = [
        `Hello ${brandName} ✨`,
        'I’m reaching out via your website.',
        '',
        name ? `👤 Name: ${name}` : null,
        inquiries.length ? `🧿 Interested in: ${inquiries.join(', ')}` : null,
        message ? `📝 Details: ${message}` : null,
        '',
        `— ${brandName}`,
        `🌿 ${brandTagline}`,
        brandInstagramUrl ? `📸 Instagram: ${brandInstagramUrl}` : null,
      ].filter(Boolean);

      const text = textLines.join('\n');
      const url = `https://api.whatsapp.com/send?phone=${phoneE164}&text=${encodeURIComponent(text)}`;

      // Premium flow: show confirmation modal instead of instant redirect.
      if (modal && modalOverlay && modalPreview && modalOpen) {
        modalPreview.textContent = text;
        modalOpen.setAttribute('href', url);
        if (modalNote) modalNote.textContent = '';

        modalOpen.onclick = (e) => {
          e?.preventDefault?.();
          openInNewTab(url);
          closeModal();
        };

        setModalOpen(true);
        return;
      }

      // Fallback: open WhatsApp in a new tab.
      openInNewTab(url);
    });
  }
}

function initWhatsAppCheckoutLinks() {
  const links = document.querySelectorAll('.js-whatsapp-checkout-link');
  if (!links.length) return;

  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.dataset.bound === 'true') return;
    link.dataset.bound = 'true';

    link.addEventListener('click', (event) => {
      const phoneE164 = String(link.dataset.phone ?? '917000303182').trim();
      const text = String(link.dataset.text ?? '').trim();
      if (!phoneE164) return;

      const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phoneE164)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;

      event.preventDefault();
      try {
        window.open(url, '_blank', 'noopener');
      } catch {
        window.location.href = url;
      }
    });
  });
}

function initFallingPetals() {
  const isLite = document.body.classList.contains('perf-lite');
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion) return;

  const container = document.createElement('div');
  container.className = 'falling-petals-container';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  const petalCount = isLite ? 12 : 32;

  for (let i = 0; i < petalCount; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'falling-petal-wrapper';

    const petal = document.createElement('div');
    const isDark = Math.random() > 0.5;
    petal.className = `falling-petal ${isDark ? 'falling-petal--dark' : ''}`;

    wrapper.appendChild(petal);
    container.appendChild(wrapper);

    const size = 0.5 + Math.random() * 0.7;
    const duration = 12 + Math.random() * 15;
    const delay = -(Math.random() * 30);
    const startX = Math.random() * 100;
    const scrollSpeed = -0.1 - (Math.random() * 0.4);
    const drift = (Math.random() - 0.5) * 100;

    wrapper.style.setProperty('--startX', `${startX}vw`);
    wrapper.style.setProperty('--scrollSpeed', scrollSpeed);

    petal.style.setProperty('--size', size);
    petal.style.setProperty('--duration', `${duration}s`);
    petal.style.setProperty('--delay', `${delay}s`);
    petal.style.setProperty('--drift', `${drift}px`);

    const depth = Math.random();
    if (depth > 0.8) petal.style.filter = 'blur(4px)';
    else if (depth < 0.2) petal.style.filter = 'blur(1px)';
  }

  let rafId;
  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      container.style.setProperty('--scroll-y', `${window.scrollY}px`);
      rafId = null;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initCustomCursor() {
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (!isFinePointer) return; // Only add on desktop devices with mice

  const body = document.body;
  body.classList.add('has-custom-cursor');

  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';

  const follower = document.createElement('div');
  follower.className = 'custom-cursor-follower';

  body.appendChild(follower);
  body.appendChild(cursor);

  // We keep track of explicit target coordinates vs actual follower coordinates
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let followerX = mouseX;
  let followerY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // The main dot follows instantly
    cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
  });

  // Smooth lerp for follower using requestAnimationFrame
  function renderCursor() {
    followerX += (mouseX - followerX) * 0.15; // lerp amount
    followerY += (mouseY - followerY) * 0.15;

    follower.style.transform = `translate3d(${followerX}px, ${followerY}px, 0) translate(-50%, -50%)`;

    // Provide CSS variables in case we need them for hovering transitions
    cursor.style.setProperty('--cx', `${mouseX}px`);
    cursor.style.setProperty('--cy', `${mouseY}px`);

    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  // Add highly intuitive hover states
  const interactables = document.querySelectorAll('a, button, input, textarea, .js-tilt, [role="button"]');

  interactables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (el.closest('.product-image') || el.closest('.new-collection__media') || el.closest('.latest-launch__media') || el.closest('.category-image-wrapper')) {
        cursor.classList.add('is-viewing');
        follower.classList.add('is-viewing');
      } else {
        cursor.classList.add('is-hovering');
        follower.classList.add('is-hovering');
      }
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('is-hovering', 'is-viewing');
      follower.classList.remove('is-hovering', 'is-viewing');
    });
  });
}

function initHeroSparkles() {
  const heroBg = document.querySelector('.hero-luxe__bg');
  if (!heroBg) return;

  const isLite = document.body.classList.contains('perf-lite');
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion || isLite) return;

  const sparkleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFA6C9"><path d="M12 0C12 0 12 10 22 12C12 14 12 24 12 24C12 24 12 14 2 12C12 10 12 0 12 0Z"/></svg>`;

  for (let i = 0; i < 15; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'hero-sparkle';
    sparkle.innerHTML = sparkleSVG;
    
    const top = Math.random() * 100;
    const left = Math.random() * 100;
    const size = 0.4 + Math.random() * 0.8;
    const duration = 4 + Math.random() * 6;
    const delay = -(Math.random() * 10);

    sparkle.style.top = `${top}%`;
    sparkle.style.left = `${left}%`;
    sparkle.style.setProperty('--size', size);
    sparkle.style.setProperty('--dur', `${duration}s`);
    sparkle.style.animationDelay = `${delay}s`;
    
    heroBg.appendChild(sparkle);
  }
}

function initTapBursts() {
  document.addEventListener('pointerdown', (e) => {
    if (!window.matchMedia('(pointer: coarse)').matches) return; // Only do on mobile
    
    for(let i=0; i<4; i++) {
       const spark = document.createElement('div');
       spark.className = 'tap-burst';
       spark.style.left = e.clientX + 'px';
       spark.style.top = e.clientY + 'px';
       
       const angle = Math.random() * Math.PI * 2;
       const velocity = 20 + Math.random() * 30;
       const tx = Math.cos(angle) * velocity;
       const ty = Math.sin(angle) * velocity;
       
       spark.style.setProperty('--tx', `${tx}px`);
       spark.style.setProperty('--ty', `${ty}px`);
       document.body.appendChild(spark);
       
       setTimeout(() => spark.remove(), 600);
    }
  });
}

function initWavyText() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const links = document.querySelectorAll('.nav-links a');
  links.forEach(link => {
    if (link.querySelector('span')) return;
    const text = link.textContent.trim();
    link.textContent = '';
    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      if (char === ' ') {
        span.innerHTML = '&nbsp;';
      } else {
        span.textContent = char;
      }
      span.style.setProperty('--delay', `${i * 0.04}s`);
      link.appendChild(span);
    });
    link.classList.add('wavy-link');
  });
}

function initHamburger() {
  const hamburgers = document.querySelectorAll('.js-hamburger');
  const overlay = document.querySelector('.js-mobile-overlay');
  const closeBtn = document.querySelector('.js-mobile-close');

  if (!overlay) return;

  hamburgers.forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    });
  }

  const links = overlay.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', () => {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLiquidResin();
  updateNavOnScroll();
  initPreloader();
  initAwwwardsMagnetic();
  loadCart();
  initPerformanceMode();
  initFallingPetals();
  initCustomCursor();
  initHeroSparkles();
  initTapBursts();
  initWavyText();
  initHamburger();
  bindUI();
  updateCartUI();
  initHeroParallax();
  initAmbientParallax();
  initScrollProgress();
  initSideActions();
  initScrollReveal();
  initWhatsAppCheckoutLinks();
  initSmoothScrollAnchors();
  
  // New Luxe Interactions
  initLuxeScroll();
  initMagneticButtons();
  initLuxeReveal();

  document.body.classList.add('is-loaded');
  setTimeout(() => document.body.classList.add('is-ready'), 100);
});

// --- Premium Luxe Interactions ---

function initLuxeScroll() {
  const body = document.body;
  const scrollThreshold = 80;

  window.addEventListener('scroll', () => {
    if (window.scrollY > scrollThreshold) {
      body.classList.add('is-scrolled');
    } else {
      body.classList.remove('is-scrolled');
    }
  }, { passive: true });
}

function initMagneticButtons() {
  if (window.innerWidth < 1024) return;
  const buttons = document.querySelectorAll('.magnetic-btn');

  buttons.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      btn.style.transform = `translate(${x * 0.3}px, ${y * 0.5}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
}

function initLuxeReveal() {
  const reveals = document.querySelectorAll('.stagger-up');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

/* --- Policy Modal System --- */
function initPolicyModals() {
  const triggers = document.querySelectorAll('.js-policy-trigger');
  if (!triggers.length) return;

  let overlay = document.querySelector('.js-policy-modal-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-policy-modal-overlay';
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }

  function ensurePolicyModal() {
    let modal = document.querySelector('.js-policy-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'policy-modal js-policy-modal';
    modal.innerHTML = `
      <div class="policy-modal__header">
        <h3 class="policy-modal__title js-policy-title">Policy</h3>
        <button class="policy-modal__close js-policy-close">✕</button>
      </div>
      <div class="policy-modal__body js-policy-body"></div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.js-policy-close');
    closeBtn.addEventListener('click', () => closePolicyModal());
    overlay.addEventListener('click', () => closePolicyModal());
    
    return modal;
  }

  const shippingContent = `
    <div class="shipping-pro-grid">
      <div class="shipping-card">
        <span class="shipping-card__icon">🚀</span>
        <span class="shipping-card__title">Standard Dispatch</span>
        <p class="shipping-card__value">Same Day</p>
      </div>
      <div class="shipping-card">
        <span class="shipping-card__icon">✨</span>
        <span class="shipping-card__title">Customized Art</span>
        <p class="shipping-card__value">2-5 Working Days</p>
      </div>
      <div class="shipping-card">
        <span class="shipping-card__icon">📅</span>
        <span class="shipping-card__title">Estimated Delivery</span>
        <p class="shipping-card__value">2-5 Days post dispatch</p>
      </div>
      <div class="shipping-partners">
        <span>Trusted Partners:</span>
        <div class="partner-tag">Blue Dart</div>
        <div class="partner-tag">Delhivery</div>
      </div>
    </div>
  `;

  const returnsContent = `
    <div class="shipping-pro-grid">
      <div class="shipping-card">
        <span class="shipping-card__icon">📹</span>
        <span class="shipping-card__title">Mandatory</span>
        <p class="shipping-card__value">Unboxing Video required for all claims</p>
      </div>
      <div class="shipping-card">
        <span class="shipping-card__icon">⏱️</span>
        <span class="shipping-card__title">Window</span>
        <p class="shipping-card__value">Report within 48 hours of delivery</p>
      </div>
      <div class="shipping-card">
        <span class="shipping-card__icon">🎨</span>
        <span class="shipping-card__title">Custom Art</span>
        <p class="shipping-card__value">No returns on customized orders</p>
      </div>
      <div class="shipping-partners">
        <span>Assistance:</span>
        <p style="font-size: 14px; color: var(--text-main); font-weight: 500;">Contact us on WhatsApp for order issues.</p>
      </div>
    </div>
  `;

  function openPolicyModal(type) {
    const modal = ensurePolicyModal();
    const title = modal.querySelector('.js-policy-title');
    const body = modal.querySelector('.js-policy-body');

    if (type === 'shipping') {
      title.textContent = 'Shipping & Delivery';
      body.innerHTML = shippingContent;
    } else if (type === 'returns') {
      title.textContent = 'Returns & Exchanges';
      body.innerHTML = returnsContent;
    }

    overlay.hidden = false;
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }

  function closePolicyModal() {
    const modal = document.querySelector('.js-policy-modal');
    if (!modal) return;
    modal.classList.remove('is-active');
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    setTimeout(() => {
      overlay.hidden = true;
      document.body.style.overflow = '';
    }, 500);
  }

  triggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const type = trigger.dataset.policy;
      openPolicyModal(type);
    });
  });
}

// Add to main DOMContentLoaded at line 1422 or append here safely
document.addEventListener('DOMContentLoaded', () => {
  initPolicyModals();
  initNewsletter();
});

/* --- Newsletter Subscription --- */
function initNewsletter() {
  const forms = document.querySelectorAll('.pro-newsletter');
  
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      const email = input.value.trim();

      if (!email) return;

      // Pro state: Loading
      const originalText = btn.textContent;
      btn.innerHTML = '<span class="loading-dot"></span>';
      btn.disabled = true;
      input.disabled = true;

      // Simulate Backend Registration
      console.log(`Backend Action: Registering ${email}`);
      console.log(`Backend Action: Sending WhatsApp notification to admin`);

      setTimeout(() => {
        // Success state
        btn.innerHTML = '✓';
        btn.style.background = '#25D366'; // WhatsApp Green
        btn.style.color = '#fff';
        
        showToast('Welcome to the Inner Circle! ✨');

        // Reset after a delay
        setTimeout(() => {
          form.reset();
          btn.innerHTML = originalText;
          btn.style.background = '';
          btn.style.color = '';
          btn.disabled = false;
          input.disabled = false;
        }, 3000);
      }, 1500);
    });
  });
}
