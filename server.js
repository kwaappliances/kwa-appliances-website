const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STORE = path.join(DATA_DIR, "products.json");
const TEMPLATE = path.join(ROOT, "outputs", "kwa-product-import-template.csv");
const PORT = Number(process.env.PORT || 4173);
const CATEGORIES = ["Refrigeration", "Cooking", "Dishwashers", "Laundry", "Outdoor", "Ventilation", "Coffee Systems", "Wine Storage"];

async function ensureStore() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE)) await saveProducts(seedProducts());
}

function seedProducts() {
  const now = new Date().toISOString();
  return [
    product({ sku:"SKSFD4826P", brand:"Signature Kitchen Suite", productName:"48 Inch Built-In French Door Refrigerator", category:"Refrigeration", subcategory:"Built-In Refrigerators", description:"Panel-ready built-in refrigeration with precise temperature control for luxury kitchens.", specs:{capacity:"26 cu. ft.", zones:"Dual evaporators", controls:"Wi-Fi enabled"}, dimensions:{width:48,height:83.5,depth:24}, finish:"Panel Ready", installationType:"Built-In", panelReady:true, price:11499, salePrice:null, requestPricing:true, imageUrls:["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80"], pdfLinks:["https://example.com/manuals/sksfd4826p-spec-sheet.pdf"], builderPrice:9875, now }),
    product({ sku:"MON-GRP366", brand:"Monogram", productName:"36 Inch Professional Gas Range", category:"Cooking", subcategory:"Ranges", description:"A professional-style gas range with brass burners, continuous grates, and refined stainless detailing.", specs:{burners:"6 sealed dual-flame burners", oven:"Convection", controls:"LED task lighting"}, dimensions:{width:36,height:35.25,depth:28.25}, finish:"Stainless Steel", fuelType:"Gas", installationType:"Freestanding", panelReady:false, price:8799, salePrice:8299, requestPricing:false, imageUrls:["https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1400&q=80"], pdfLinks:["https://example.com/manuals/mon-grp366-install-guide.pdf"], builderPrice:7525, now }),
    product({ sku:"ASKO-DBI786IXXL", brand:"ASKO", productName:"40 Series Panel-Ready Dishwasher", category:"Dishwashers", subcategory:"Built-In Dishwashers", description:"Quiet, flexible dish care with a panel-ready front for integrated kitchen design.", specs:{racks:"3 flexible racks", noise:"39 dBA", programs:"16 wash programs"}, dimensions:{width:24,height:35.75,depth:22}, finish:"Panel Ready", installationType:"Built-In", panelReady:true, price:2299, salePrice:null, requestPricing:false, imageUrls:["https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1400&q=80"], pdfLinks:[], builderPrice:1875, now })
  ];
}

function product(input) {
  return { sku: input.sku, brand: input.brand, productName: input.productName, category: input.category, subcategory: input.subcategory || "", description: input.description || "", specs: input.specs || {}, dimensions: input.dimensions || {}, finish: input.finish || "", fuelType: input.fuelType || "", installationType: input.installationType || "", panelReady: !!input.panelReady, price: input.price ?? null, salePrice: input.salePrice ?? null, requestPricing: !!input.requestPricing, visible: input.visible !== false, imageUrls: input.imageUrls || [], pdfLinks: input.pdfLinks || [], internal: { builderPrice: input.builderPrice ?? null }, updatedAt: input.now || new Date().toISOString() };
}

async function loadProducts() { await ensureStore(); return JSON.parse(await fsp.readFile(STORE, "utf8")); }
async function saveProducts(products) { await fsp.writeFile(STORE, JSON.stringify(products, null, 2) + "\n", "utf8"); }

function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch.charCodeAt(0) === 34 && quoted && next && next.charCodeAt(0) === 34) { cell += String.fromCharCode(34); i++; }
    else if (ch.charCodeAt(0) === 34) quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && next === "\n") i++; row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] || "").trim()])));
}

function numberValue(value, fallback) { if (value === undefined || value === null || value === "") return fallback; const n = Number(String(value).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : fallback; }
function boolValue(value, fallback) { if (value === undefined || value === null || value === "") return fallback; return ["true","yes","y","1","show","visible"].includes(String(value).trim().toLowerCase()); }
function listValue(value, fallback) { if (!value) return fallback; return String(value).split(/[|;]/).map(v => v.trim()).filter(Boolean); }
function keyValues(value, fallback) { if (!value) return fallback; const out = {}; String(value).split("|").forEach(part => { const pieces = part.split(":"); if (pieces.length > 1) out[pieces.shift().trim()] = pieces.join(":").trim(); }); return out; }
function dimensions(value, width, fallback) { const out = Object.assign({}, fallback); if (width) out.width = numberValue(width, out.width); if (value) String(value).split("|").forEach(part => { const pieces = part.split(":"); if (pieces.length > 1) out[pieces.shift().trim().toLowerCase()] = numberValue(pieces.join(":"), null); }); return out; }

function normalize(row, existing) {
  existing = existing || {}; const sku = String(row.sku || existing.sku || "").trim().toUpperCase(); const category = String(row.category || existing.category || "Uncategorized").trim();
  return { sku, brand:String(row.brand || existing.brand || "").trim(), productName:String(row.product_name || existing.productName || "").trim(), category:CATEGORIES.includes(category) ? category : category, subcategory:String(row.subcategory || existing.subcategory || "").trim(), description:String(row.description || existing.description || "").trim(), specs:keyValues(row.specs, existing.specs || {}), dimensions:dimensions(row.dimensions, row.width, existing.dimensions || {}), finish:String(row.finish || existing.finish || "").trim(), fuelType:String(row.fuel_type || existing.fuelType || "").trim(), installationType:String(row.installation_type || existing.installationType || "").trim(), panelReady:boolValue(row.panel_ready, existing.panelReady || false), price:numberValue(row.price, existing.price ?? null), salePrice:numberValue(row.sale_price, existing.salePrice ?? null), requestPricing:boolValue(row.request_pricing, existing.requestPricing || false), visible:boolValue(row.visible, existing.visible ?? true), imageUrls:listValue(row.image_urls, existing.imageUrls || []), pdfLinks:listValue(row.pdf_links, existing.pdfLinks || []), internal:{ builderPrice:numberValue(row.builder_price, existing.internal?.builderPrice ?? null) }, updatedAt:new Date().toISOString() };
}

async function importProducts(csvText) {
  const products = await loadProducts(); const bySku = new Map(products.map(p => [p.sku.toUpperCase(), p])); const report = { created:0, updated:0, skipped:0, errors:[] };
  parseCsv(csvText).forEach((row, index) => { const sku = String(row.sku || "").trim().toUpperCase(); if (!sku) { report.skipped++; report.errors.push("Row " + (index + 2) + ": missing SKU."); return; } const exists = bySku.get(sku); bySku.set(sku, normalize(row, exists)); exists ? report.updated++ : report.created++; });
  await saveProducts(Array.from(bySku.values()).sort((a,b) => a.brand.localeCompare(b.brand) || a.productName.localeCompare(b.productName))); return report;
}

function money(value) { return value === null || value === undefined || value === "" ? "" : new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(Number(value)); }
function publicProduct(p) { const safe = Object.assign({}, p); delete safe.internal; safe.displayPrice = p.requestPricing ? null : (p.salePrice || p.price || null); safe.priceLabel = p.requestPricing ? "Request Pricing" : money(p.salePrice || p.price); return safe; }
function facets(products) { const visible = products.filter(p => p.visible); const unique = f => [...new Set(visible.map(p => p[f]).filter(Boolean))].sort(); return { categories:CATEGORIES, brands:unique("brand"), finishes:unique("finish"), fuelTypes:unique("fuelType"), installationTypes:unique("installationType"), widths:[...new Set(visible.map(p => p.dimensions && p.dimensions.width).filter(Boolean))].sort((a,b)=>a-b) }; }
function filtered(products, params) { return products.filter(p => p.visible && (!params.brand || p.brand === params.brand) && (!params.category || p.category === params.category) && (!params.finish || p.finish === params.finish) && (!params.fuelType || p.fuelType === params.fuelType) && (!params.installationType || p.installationType === params.installationType) && (!params.panelReady || String(p.panelReady) === params.panelReady) && (!params.width || Number(p.dimensions?.width || 0) === Number(params.width)) && (!params.minPrice || Number(p.salePrice || p.price || 0) >= Number(params.minPrice)) && (!params.maxPrice || Number(p.salePrice || p.price || 0) <= Number(params.maxPrice)) && (!params.q || (p.sku + " " + p.brand + " " + p.productName + " " + p.category + " " + p.subcategory).toLowerCase().includes(String(params.q).toLowerCase()))); }
function json(res, code, body) { res.writeHead(code, { "Content-Type":"application/json; charset=utf-8" }); res.end(JSON.stringify(body, null, 2)); }
function body(req) { return new Promise(resolve => { const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); }); }
function multipartFile(buffer, contentType) { const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/); if (!match) return ""; const boundary = match[1] || match[2]; const part = buffer.toString("utf8").split("--" + boundary).find(x => x.includes('name="csvFile"')); if (!part) return ""; const i = part.indexOf("\r\n\r\n"); return i < 0 ? "" : part.slice(i + 4).replace(/\r\n--$/, "").trimEnd(); }
async function serve(req, res) {
  const url = new URL(req.url, "http://" + req.headers.host); const pathname = url.pathname;
  if (req.method === "GET" && pathname === "/api/products") { const products = await loadProducts(); return json(res, 200, { products: filtered(products, Object.fromEntries(url.searchParams)).map(publicProduct), facets: facets(products) }); }
  if (req.method === "GET" && pathname.startsWith("/api/products/")) { const sku = decodeURIComponent(pathname.replace("/api/products/", "")).toUpperCase(); const p = (await loadProducts()).find(x => x.sku.toUpperCase() === sku && x.visible); return p ? json(res, 200, { product: publicProduct(p) }) : json(res, 404, { error:"Product not found" }); }
  if (req.method === "GET" && pathname === "/api/admin/products") return json(res, 200, { products: await loadProducts() });
  if (req.method === "POST" && pathname === "/admin/import") { const raw = await body(req); const type = req.headers["content-type"] || ""; const csv = type.includes("multipart/form-data") ? multipartFile(raw, type) : raw.toString("utf8"); const report = await importProducts(csv); res.writeHead(303, { Location:"/admin.html?created=" + report.created + "&updated=" + report.updated + "&skipped=" + report.skipped }); return res.end(); }
  if (req.method === "GET" && pathname === "/templates/kwa-product-import-template.csv") { res.writeHead(200, { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":"attachment; filename=kwa-product-import-template.csv" }); return fs.createReadStream(TEMPLATE).pipe(res); }
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname)); if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(filePath, (err, file) => { if (err) { res.writeHead(404); return res.end("Not found"); } const ext = path.extname(filePath); const type = {".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".md":"text/markdown; charset=utf-8"}[ext] || "application/octet-stream"; res.writeHead(200, { "Content-Type":type }); res.end(file); });
}
if (require.main === module) { ensureStore().then(() => http.createServer((req,res) => serve(req,res).catch(err => { console.error(err); json(res, 500, { error:"Server error" }); })).listen(PORT, () => console.log("KWA Appliances is running at http://localhost:" + PORT))); }
module.exports = { importProducts, parseCsv, publicProduct, loadProducts, serve };
