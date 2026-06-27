const fields = ["q", "category", "brand", "width", "finish", "fuelType", "installationType", "panelReady", "minPrice", "maxPrice"];

document.addEventListener("DOMContentLoaded", () => {
  initHomeNavigation();
  initPromotionsCarousel();
  const page = document.body.dataset.page;
  if (page === "catalogue") initCatalogue();
  if (page === "product") initProduct();
  if (page === "admin") initAdmin();
});

function initHomeNavigation() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-nav");
  if (!header) return;
  const setScrolled = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  setScrolled();
  window.addEventListener("scroll", setScrolled, { passive: true });
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
  });
}

async function initCatalogue() {
  const params = new URLSearchParams(location.search);
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el && params.has(id)) el.value = params.get(id);
  });
  document.getElementById("applyFilters").addEventListener("click", () => {
    const next = new URLSearchParams();
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.value) next.set(id, el.value);
    });
    history.replaceState({}, "", location.pathname + "?" + next.toString());
    loadProducts(next);
  });
  await loadProducts(params);
}

async function loadProducts(params) {
  const response = await fetch("/api/products?" + params.toString());
  const payload = await response.json();
  populateFilters(payload.facets);
  renderProducts(payload.products);
}

function populateFilters(facets) {
  select("category", facets.categories, "All categories");
  select("brand", facets.brands, "All brands");
  select("width", facets.widths, "Any width", (value) => value + " in.");
  select("finish", facets.finishes, "Any finish");
  select("fuelType", facets.fuelTypes, "Any fuel");
  select("installationType", facets.installationTypes, "Any installation");
}

function select(id, values, label, format) {
  const el = document.getElementById(id);
  if (!el || el.options.length > 1) return;
  const current = el.value;
  el.innerHTML = '<option value="">' + label + '</option>';
  (values || []).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = (format || String)(value);
    el.appendChild(option);
  });
  el.value = current;
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  document.getElementById("resultCount").textContent = products.length + " product" + (products.length === 1 ? "" : "s");
  if (!products.length) {
    grid.innerHTML = '<p class="meta">No products match the selected filters.</p>';
    return;
  }
  grid.innerHTML = products.map((p) =>
    '<a class="product-card" href="/product.html?sku=' + encodeURIComponent(p.sku) + '">' +
      '<img src="' + esc((p.imageUrls || [])[0] || "") + '" alt="' + esc(p.productName) + '">' +
      '<div class="product-card-body">' +
        '<div class="meta">' + esc(p.brand) + ' · ' + esc(p.category) + '</div>' +
        '<h3>' + esc(p.productName) + '</h3>' +
        '<div class="badge-row">' +
          (p.dimensions && p.dimensions.width ? '<span class="badge">' + p.dimensions.width + ' in.</span>' : '') +
          (p.finish ? '<span class="badge">' + esc(p.finish) + '</span>' : '') +
          (p.panelReady ? '<span class="badge">Panel-ready</span>' : '') +
        '</div>' +
        '<div class="price">' + esc(p.priceLabel) + '</div><div class="advisor-note">Advisor-assisted planning available</div>' +
      '</div>' +
    '</a>'
  ).join("");
}

async function initProduct() {
  const sku = new URLSearchParams(location.search).get("sku");
  const target = document.getElementById("productDetail");
  if (!sku) {
    target.textContent = "Missing product SKU.";
    return;
  }
  const response = await fetch("/api/products/" + encodeURIComponent(sku));
  if (!response.ok) {
    target.textContent = "Product not found.";
    return;
  }
  const data = await response.json();
  const p = data.product;
  document.title = p.productName + " | KWA Appliances";
  target.innerHTML =
    '<section class="detail-grid">' +
      '<div class="product-media">' +
        ((p.imageUrls && p.imageUrls.length ? p.imageUrls : [""]).map((url) => '<img src="' + esc(url) + '" alt="' + esc(p.productName) + '">').join("")) +
      '</div>' +
      '<article class="product-copy">' +
        '<p class="eyebrow">' + esc(p.brand) + ' · ' + esc(p.sku) + '</p>' +
        '<h1>' + esc(p.productName) + '</h1>' +
        '<p>' + esc(p.description) + '</p>' +
        '<div class="price">' + esc(p.priceLabel) + '</div><p class="advisor-note">Ask a KWA advisor to confirm fit, specifications, installation requirements, and package options for your project.</p>' +
        '<div class="badge-row"><span class="badge">' + esc(p.category) + '</span>' +
          (p.subcategory ? '<span class="badge">' + esc(p.subcategory) + '</span>' : '') +
          (p.finish ? '<span class="badge">' + esc(p.finish) + '</span>' : '') +
          (p.panelReady ? '<span class="badge">Panel-ready</span>' : '') +
        '</div>' +
        specs(p) + downloads(p) +
      '</article>' +
    '</section>';
}

function specs(p) {
  const rows = [["Width", p.dimensions && p.dimensions.width ? p.dimensions.width + " in." : ""], ["Height", p.dimensions && p.dimensions.height ? p.dimensions.height + " in." : ""], ["Depth", p.dimensions && p.dimensions.depth ? p.dimensions.depth + " in." : ""], ["Fuel Type", p.fuelType], ["Installation", p.installationType]].concat(Object.entries(p.specs || {})).filter((row) => row[1]);
  return '<div class="spec-table">' + rows.map((row) => '<div class="spec-row"><strong>' + esc(row[0]) + '</strong><span>' + esc(row[1]) + '</span></div>').join("") + '</div>';
}

function downloads(p) {
  if (!p.pdfLinks || !p.pdfLinks.length) return "";
  return '<div class="hero-actions">' + p.pdfLinks.map((link, index) => '<a class="button dark" href="' + esc(link) + '" target="_blank" rel="noreferrer">Download PDF ' + (index + 1) + '</a>').join("") + '</div>';
}

function initAdmin() {
  const params = new URLSearchParams(location.search);
  if (!params.has("created") && !params.has("updated")) return;
  const result = document.getElementById("importResult");
  result.hidden = false;
  result.innerHTML = '<h2>Import complete</h2><p>' + (params.get("created") || 0) + ' created, ' + (params.get("updated") || 0) + ' updated, ' + (params.get("skipped") || 0) + ' skipped.</p>';
}

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function sitePath(path) {
  if (!path || !path.startsWith('/')) return path;
  const base = location.pathname.startsWith('/kwa-appliances-website/') ? '/kwa-appliances-website' : '';
  return base + path;
}

async function initPromotionsCarousel() {
  const track = document.querySelector("[data-promotions-track]");
  const carousel = document.querySelector("[data-promotions-carousel]");
  const dots = document.querySelector("[data-promotion-dots]");
  if (!track || !carousel || !dots) return;

  let promotions = [];
  try {
    const response = await fetch("data/promotions.json", { cache: "no-store" });
    promotions = await response.json();
  } catch (error) {
    carousel.closest(".promotions-section")?.remove();
    return;
  }

  const activePromotions = promotions.filter((promotion) => promotion.active);

  if (!activePromotions.length) {
    carousel.closest(".promotions-section")?.remove();
    return;
  }

  const formatDate = (dateText) => {
    if (!dateText) return "Limited time";
    const date = new Date(dateText + "T00:00:00");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  activePromotions.forEach((promotion) => {
    const card = document.createElement("article");
    card.className = "promotion-card";
    const media = document.createElement("div");
    media.className = "promotion-media";
    const img = document.createElement("img");
    img.src = sitePath(promotion.image);
    img.alt = promotion.brand + " promotion";
    media.append(img);
    const copy = document.createElement("div");
    copy.className = "promotion-copy";
    const brand = document.createElement("p");
    brand.className = "project-location";
    brand.textContent = promotion.brand;
    const title = document.createElement("h3");
    title.textContent = promotion.title;
    const description = document.createElement("p");
    description.textContent = promotion.description;
    const date = document.createElement("p");
    date.className = "promotion-date";
    date.textContent = "Available through " + formatDate(promotion.endDate);
    const link = document.createElement("a");
    link.className = "button secondary";
    link.href = sitePath(promotion.link);
    link.textContent = "View Promotion";
    copy.append(brand, title, description, date, link);
    card.append(media, copy);
    track.append(card);
  });

  activePromotions.forEach((promotion, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "Go to " + promotion.brand + " promotion");
    dot.dataset.promoDot = String(index);
    dots.append(dot);
  });

  const cards = Array.from(track.querySelectorAll(".promotion-card"));
  const dotButtons = Array.from(dots.querySelectorAll("button"));
  const setActiveDot = () => {
    const left = track.scrollLeft;
    const index = cards.reduce((best, card, current) => {
      const distance = Math.abs(card.offsetLeft - left);
      return distance < best.distance ? { index: current, distance } : best;
    }, { index: 0, distance: Infinity }).index;
    dotButtons.forEach((dot, current) => dot.classList.toggle("is-active", current === index));
  };

  const scrollToCard = (index) => cards[index]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  carousel.querySelector("[data-promo-prev]")?.addEventListener("click", () => {
    const active = dotButtons.findIndex((dot) => dot.classList.contains("is-active"));
    scrollToCard(Math.max(active - 1, 0));
  });
  carousel.querySelector("[data-promo-next]")?.addEventListener("click", () => {
    const active = dotButtons.findIndex((dot) => dot.classList.contains("is-active"));
    scrollToCard(Math.min(active + 1, cards.length - 1));
  });
  dotButtons.forEach((dot, index) => dot.addEventListener("click", () => scrollToCard(index)));
  track.addEventListener("scroll", () => requestAnimationFrame(setActiveDot), { passive: true });
  setActiveDot();
}
