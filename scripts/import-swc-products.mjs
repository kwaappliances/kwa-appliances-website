#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const TARGET_BRANDS = new Set(["Sub-Zero", "Wolf", "Cove"]);
const MARKET_BASE_URLS = {
  us: "https://www.subzero-wolf.com/webapi",
  "ca-en": "https://ca.subzero-wolf.com/en/webapi",
  "ca-fr": "https://ca.subzero-wolf.com/fr/webapi",
  mx: "https://mx.subzero-wolf.com/en/webapi"
};

const IMAGE_ARRAY_KEYS = [
  "HeadOnImages",
  "InteriorFeatureImages",
  "OverallDimensionIllustrations",
  "OverallDimensionsIllustrations",
  "ElectricalLocationIllustrations",
  "PlumbingLocationIllustrations",
  "GasSupplyIllustrations",
  "StandardInstallationIllustrations",
  "SingleStandardInstallationIllustrations",
  "SingleFlushInsetInstallationIllustrations",
  "FlushInsetInstallationIllustrations",
  "DualStandardInstallationIllustrations",
  "DualFlushInsetInstallationIllustrations",
  "DualFlushInsetInstallationIlustrations",
  "CombustibleInstallationIllustrations",
  "NonCombustibleInstallationIllustrations"
];

const DOCUMENT_ARRAY_KEYS = ["Downloads", "WarrantyDocuments"];

const SCALAR_SPEC_FIELDS = [
  ["SWC", "Source Status", "Status"],
  ["SWC", "Product Website", "ProductWebsiteUrl"],
  ["SWC", "Consumer Availability", "ConsumerAvailability"],
  ["GENERAL", "MSRP Range", "MsrpRange"],
  ["GENERAL", "Minimum MSRP", "MinMsrp"],
  ["GENERAL", "Overall Dimensions", "OverallDimensionsFormatted"],
  ["GENERAL", "Shipping Weight", "ShippingWeight"],
  ["GENERAL", "Weight", "Weight"],
  ["GENERAL", "Connected Appliance", "ConnectedAppliance"],
  ["GENERAL", "Star-K Certified", "IsStarK"],
  ["GENERAL", "ENERGY STAR Certified", "IsEnergyStar"],
  ["GENERAL", "Annual Energy Use", "AnnualEnergyUse"],
  ["GENERAL", "Annual Energy Usage", "AnnualEnergyUsage"],
  ["GENERAL", "Energy Cost Per KWh", "EnergyCostPerKwh"],
  ["INSTALLATION", "Door Clearance", "DoorClearance"],
  ["INSTALLATION", "Drawer Clearance", "DrawerClearance"],
  ["INSTALLATION", "Electrical Supply", "ElectricalSupply"],
  ["INSTALLATION", "Electrical Service", "ElectricalService"],
  ["INSTALLATION", "Electrical Outlet In Opening", "ElectricalOutletInOpening"],
  ["INSTALLATION", "Plumbing Supply", "PlumbingSupply"],
  ["INSTALLATION", "Plumbing Pressure", "PlumbingPressure"],
  ["INSTALLATION", "Water Connection", "WaterConnection"],
  ["INSTALLATION", "Drain Connection", "DrainConnection"],
  ["INSTALLATION", "Pressure", "Pressure"],
  ["INSTALLATION", "Gas Supply", "GasSupply"],
  ["INSTALLATION", "Gas Inlet", "GasInlet"],
  ["INSTALLATION", "Receptacle", "Receptacle"],
  ["CAPACITY", "Refrigerator Capacity", "RefrigeratorCapacity"],
  ["CAPACITY", "Freezer Capacity", "FreezerCapacity"],
  ["CAPACITY", "Dishwasher Capacity", "DishwasherCapacity"],
  ["CAPACITY", "Capacity", "Capacity"],
  ["PERFORMANCE", "Sound Level", "SoundLevel"],
  ["OVEN", "Oven 1 Overall Capacity", "Oven1OverallCapacity"],
  ["OVEN", "Oven 1 Usable Capacity", "Oven1UsableCapacity"],
  ["OVEN", "Oven 1 Interior Width", "Oven1InteriorWidth"],
  ["OVEN", "Oven 1 Interior Height", "Oven1InteriorHeight"],
  ["OVEN", "Oven 1 Interior Depth", "Oven1InteriorDepth"],
  ["OVEN", "Oven 2 Overall Capacity", "Oven2OverallCapacity"],
  ["OVEN", "Oven 2 Usable Capacity", "Oven2UsableCapacity"],
  ["OVEN", "Oven 2 Interior Width", "Oven2InteriorWidth"],
  ["OVEN", "Oven 2 Interior Height", "Oven2InteriorHeight"],
  ["OVEN", "Oven 2 Interior Depth", "Oven2InteriorDepth"]
];

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const body = raw.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      args[body] = true;
    } else {
      args[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const write = Boolean(args.write);
const market = String(args.market || "ca-en");
const baseUrl = String(args["base-url"] || MARKET_BASE_URLS[market] || MARKET_BASE_URLS["ca-en"]).replace(/\/$/, "");
const origin = new URL(baseUrl).origin;
const application = String(args.application || process.env.SWC_APPLICATION || "KWA-Appliances-Website");
const statuses = new Set(String(args.status || "Active").split(",").map((value) => value.trim()).filter(Boolean));
const recordMode = String(args["record-mode"] || "options");
const insecureTls = Boolean(args["insecure-tls"] || process.env.SWC_INSECURE_TLS === "true");
const staticPath = path.resolve(repoRoot, String(args["static-file"] || "data/products-static.json"));
const sourcePath = path.resolve(repoRoot, String(args["source-file"] || "data/products.json"));
const reportPath = path.resolve(repoRoot, String(args.report || "data/swc-import-report.json"));

if (!["options", "models"].includes(recordMode)) {
  throw new Error("--record-mode must be either options or models");
}

function printHelp() {
  console.log(`Sub-Zero/Wolf/Cove catalogue importer

Usage:
  node scripts/import-swc-products.mjs [options]

Common options:
  --write                    Write data/products-static.json and data/products.json.
  --market=ca-en             API market: ca-en, ca-fr, us, or mx. Default: ca-en.
  --application=NAME         Required SWC application label. Default: KWA-Appliances-Website.
  --status=Active            Comma-separated SWC statuses to import. Default: Active.
  --record-mode=options      Import one record per ModelOption SKU. Use models for one record per model.
  --insecure-tls             Allow insecure TLS if a local certificate store blocks the request.
  --report=PATH              Report path when writing. Default: data/swc-import-report.json.

Dry run:
  node scripts/import-swc-products.mjs

Write:
  node scripts/import-swc-products.mjs --write
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function requestText(url, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error(`Too many redirects for ${url}`));
  }

  return new Promise((resolve, reject) => {
    const current = new URL(url);
    const req = https.request({
      protocol: current.protocol,
      hostname: current.hostname,
      port: current.port || 443,
      path: `${current.pathname}${current.search}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": application
      },
      rejectUnauthorized: !insecureTls,
      timeout: 90000
    }, (res) => {
      const location = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && location) {
        res.resume();
        resolve(requestText(new URL(location, current).toString(), redirectCount + 1));
        return;
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`SWC API returned HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        resolve(body);
      });
    });

    req.on("timeout", () => req.destroy(new Error(`Request timed out: ${url}`)));
    req.on("error", reject);
    req.end();
  });
}

async function getJson(endpoint) {
  const url = new URL(`${baseUrl}/${endpoint.replace(/^\//, "")}`);
  url.searchParams.set("application", application);
  return JSON.parse(await requestText(url.toString()));
}

function categoryIndexFromBrands(brands) {
  const index = new Map();
  for (const brand of brands) {
    for (const superCategory of brand.SuperCategories || []) {
      for (const category of superCategory.Categories || []) {
        index.set(String(category.Id).toLowerCase(), {
          brandName: brand.Name,
          superCategoryName: superCategory.Name,
          categoryName: category.Name
        });
      }
    }
  }
  return index;
}

function compact(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function absoluteUrl(value) {
  const raw = compact(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${origin}${raw}`;
  return `${origin}/${raw}`;
}

function dedupeByUrl(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const url = typeof item === "string" ? item : item.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(item);
  }
  return result;
}

function collectFiles(product, keys) {
  const files = [];
  for (const key of keys) {
    for (const file of product[key] || []) {
      const url = absoluteUrl(file.Url || file.URL || file.url);
      if (!url) continue;
      files.push({
        title: compact(file.Title || file.Name || file.title || file.name),
        alt: compact(file.Alt || file.alt),
        description: compact(file.Description || file.description),
        extension: compact(file.Extension || file.extension),
        url,
        sourceField: key,
        sourceId: compact(file.Id || file.id)
      });
    }
  }
  return dedupeByUrl(files);
}

function addSpec(specs, section, label, value) {
  const text = compact(value);
  if (!text) return;
  specs[`${section} - ${label}`] = text;
}

function prettyCamel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function specName(item) {
  return compact(item.WebsiteDisplayName || item.DisplayName || item.Name || item.Heading || item.Title);
}

function specValue(item) {
  return compact(item.Value || item.ShortDescription || item.Description || item.LongDescription);
}

function collectSpecs(product, categoryInfo, option) {
  const specs = {};
  addSpec(specs, "SWC", "Brand", product.BrandName);
  addSpec(specs, "SWC", "Source Category", categoryInfo.categoryName || product.CategoryName);
  addSpec(specs, "SWC", "Source Super Category", categoryInfo.superCategoryName);
  addSpec(specs, "SWC", "Product Id", product.Id);
  addSpec(specs, "SWC", "Model Number", product.ModelNumber);

  if (option) {
    addSpec(specs, "SWC", "SKU", option.Sku || option.SKU);
    addSpec(specs, "SWC", "Model Option", option.ModelOptionNumber || option.Name);
    addSpec(specs, "GENERAL", "Option MSRP", option.Msrp);
  }

  for (const [section, label, key] of SCALAR_SPEC_FIELDS) {
    addSpec(specs, section, label, product[key]);
  }

  const modelOptions = product.ModelOptions || [];
  if (modelOptions.length) {
    addSpec(specs, "MODEL OPTIONS", "Available Options", modelOptions.map((modelOption) => compact(modelOption.ModelOptionNumber || modelOption.Sku || modelOption.SKU)).filter(Boolean).join("; "));
  }

  if (Array.isArray(product.ProductAccessories) && product.ProductAccessories.length) {
    addSpec(specs, "ACCESSORIES", "Available Accessories", product.ProductAccessories.join("; "));
  }

  if (Array.isArray(product.QrSheetNotes) && product.QrSheetNotes.length) {
    addSpec(specs, "NOTES", "Quick Reference Notes", product.QrSheetNotes.join("; "));
  }

  for (const [key, value] of Object.entries(product)) {
    if (!Array.isArray(value) || !value.length) continue;
    const first = value.find((item) => item && typeof item === "object");
    if (!first || !("WebsiteDisplayName" in first || "Value" in first)) continue;
    const section = prettyCamel(key).toUpperCase();
    for (const item of value) {
      const name = specName(item);
      const val = specValue(item);
      if (name && val) addSpec(specs, section, name, val);
    }
  }

  const featureSource = [...(product.FeaturedProductFeatures || []), ...(product.ProductFeatures || [])];
  const featureSeen = new Set();
  let featureCount = 0;
  for (const feature of featureSource) {
    const heading = compact(feature.Heading || feature.Title);
    const text = compact(feature.ShortDescription || feature.Description || feature.LongDescription);
    const key = `${heading}|${text}`;
    if (!heading || !text || featureSeen.has(key)) continue;
    featureSeen.add(key);
    addSpec(specs, "FEATURES", heading, text);
    featureCount += 1;
    if (featureCount >= 14) break;
  }

  return specs;
}

function mapWebsiteCategory(product, categoryInfo) {
  const brand = compact(product.BrandName).toLowerCase();
  const source = `${categoryInfo.superCategoryName || ""} ${categoryInfo.categoryName || product.CategoryName || ""} ${product.ModelName || ""}`.toLowerCase();
  if (brand === "cove" || source.includes("dishwasher")) return "Dishwashers";
  if (source.includes("wine")) return "Wine Storage";
  if (source.includes("ventilation") || source.includes("hood") || source.includes("blower")) return "Ventilation";
  if (source.includes("outdoor") || source.includes("grill")) return "Outdoor";
  if (source.includes("coffee")) return "Coffee Systems";
  if (source.includes("refriger") || source.includes("freezer") || source.includes("ice maker") || source.includes("undercounter")) return "Refrigeration";
  if (source.includes("range") || source.includes("cooktop") || source.includes("rangetop") || source.includes("oven") || source.includes("microwave") || source.includes("warming") || source.includes("module") || source.includes("vacuum")) return "Cooking";
  return compact(categoryInfo.categoryName || product.CategoryName) || "Uncategorized";
}

function inferFuelType(product) {
  const text = `${product.ModelName || ""} ${product.ModelNumber || ""} ${product.CategoryName || ""} ${product.GasSupply || ""} ${product.ElectricalSupply || ""}`.toLowerCase();
  if (text.includes("dual fuel")) return "Dual Fuel";
  if (text.includes("induction")) return "Induction";
  if (text.includes("electric")) return "Electric";
  if (text.includes("liquid propane") || /\blp\b/.test(text)) return "Liquid Propane";
  if (text.includes("natural gas")) return "Natural Gas";
  if (text.includes("gas")) return "Gas";
  return "";
}

function inferInstallationType(product, categoryInfo) {
  const text = `${categoryInfo.superCategoryName || ""} ${categoryInfo.categoryName || product.CategoryName || ""} ${product.ModelName || ""}`.toLowerCase();
  if (text.includes("island")) return "Island";
  if (text.includes("wall hood") || text.includes("wall mount")) return "Wall Mount";
  if (text.includes("under-cabinet") || text.includes("under cabinet")) return "Under-Cabinet";
  if (text.includes("range") && !text.includes("rangetop")) return "Freestanding";
  if (text.includes("countertop")) return "Countertop";
  if (text.includes("built-in") || text.includes("built in") || text.includes("integrated") || text.includes("designer") || text.includes("column") || text.includes("cooktop") || text.includes("rangetop") || text.includes("oven") || text.includes("coffee") || text.includes("microwave") || text.includes("dishwasher")) return "Built-In";
  return "";
}

function inferFinish(product, option) {
  const text = `${product.ModelName || ""} ${product.ModelNumber || ""} ${option?.ModelOptionNumber || ""} ${option?.Sku || ""}`.toLowerCase();
  if (text.includes("panel ready") || text.includes("overlay")) return "Panel Ready";
  if (text.includes("stainless")) return "Stainless Steel";
  if (text.includes("black")) return "Black";
  if (text.includes("white")) return "White";
  return "";
}

function isPanelReady(product, option) {
  const text = `${product.ModelName || ""} ${product.ModelNumber || ""} ${option?.ModelOptionNumber || ""} ${option?.Sku || ""}`.toLowerCase();
  return text.includes("panel ready") || text.includes("overlay");
}

function importedRecord(product, option, categoryInfo, importedAt) {
  const brand = compact(product.BrandName) || compact(categoryInfo.brandName);
  const optionSku = compact(option?.Sku || option?.SKU || option?.ModelOptionNumber);
  const modelNumber = compact(product.ModelNumber);
  const sku = optionSku || modelNumber || compact(product.Id);
  const optionLabel = compact(option?.ModelOptionNumber);
  const productName = recordMode === "options" && optionLabel && optionLabel !== modelNumber
    ? `${compact(product.ModelName)} - ${optionLabel}`
    : compact(product.ModelName);
  const documents = collectFiles(product, DOCUMENT_ARRAY_KEYS)
    .filter((doc) => /\.pdf(?:$|[?#])/i.test(doc.url) || doc.extension.toLowerCase() === "pdf")
    .map((doc) => ({
      title: doc.title || documentTitleFromUrl(doc.url),
      url: doc.url,
      type: "pdf",
      sourceField: doc.sourceField,
      sourceId: doc.sourceId
    }));
  const imageFiles = collectFiles(product, IMAGE_ARRAY_KEYS);
  const imageUrls = imageFiles.map((image) => image.url);
  const price = numberOrNull(option?.Msrp ?? product.MinMsrp);

  return {
    sku,
    brand,
    productName,
    category: mapWebsiteCategory(product, categoryInfo),
    subcategory: compact(categoryInfo.categoryName || product.CategoryName),
    description: compact(product.LongDescription || product.ShortDescription || product.SupportingText1 || productName),
    specs: collectSpecs(product, categoryInfo, option),
    dimensions: {
      width: numberOrNull(product.OverallWidth),
      height: numberOrNull(product.OverallHeight),
      depth: numberOrNull(product.OverallDepth)
    },
    finish: inferFinish(product, option),
    fuelType: inferFuelType(product),
    installationType: inferInstallationType(product, categoryInfo),
    panelReady: isPanelReady(product, option),
    price,
    salePrice: null,
    requestPricing: true,
    visible: true,
    imageUrls,
    documents,
    pdfLinks: documents.map((doc) => doc.url),
    modelOptions: (product.ModelOptions || []).map((modelOption) => ({
      modelOptionNumber: compact(modelOption.ModelOptionNumber),
      sku: compact(modelOption.Sku || modelOption.SKU),
      msrp: numberOrNull(modelOption.Msrp)
    })),
    source: {
      provider: "Sub-Zero/Wolf/Cove Product API",
      market,
      productId: compact(product.Id),
      productWebsiteUrl: absoluteUrl(product.ProductWebsiteUrl),
      status: compact(product.Status),
      modelNumber,
      modelOptionNumber: optionLabel,
      importedAt
    },
    internal: {
      builderPrice: null
    },
    updatedAt: importedAt,
    displayPrice: null,
    priceLabel: "Request Pricing"
  };
}

function documentTitleFromUrl(url) {
  const lower = String(url).toLowerCase();
  if (lower.includes("qr-sheet") || lower.includes("qrexport")) return "Quick Reference Guide";
  if (lower.includes("installation")) return "Installation Guide";
  if (lower.includes("use-and-care") || lower.includes("use_care") || lower.includes("ucg")) return "Use and Care Guide";
  if (lower.includes("design-guide")) return "Design Guide";
  if (lower.includes("energy")) return "Energy Guide";
  if (lower.includes("warranty")) return "Warranty";
  return "Product Document";
}

function productRecords(product, categoryInfo, importedAt) {
  if (recordMode === "models") {
    return [importedRecord(product, null, categoryInfo, importedAt)];
  }

  const options = product.ModelOptions || [];
  if (!options.length) {
    return [importedRecord(product, null, categoryInfo, importedAt)];
  }

  return options.map((option) => importedRecord(product, option, categoryInfo, importedAt));
}

function normalizeSku(record, seen) {
  if (!seen.has(record.sku)) {
    seen.add(record.sku);
    return record;
  }
  const suffix = record.source?.productId ? record.source.productId.slice(0, 8) : "swc";
  record.sku = `${record.sku}-${suffix}`;
  seen.add(record.sku);
  return record;
}

function mergeProducts(existing, imported) {
  const kept = existing.filter((product) => !TARGET_BRANDS.has(product.brand));
  const sortedImported = imported.slice().sort((a, b) =>
    a.brand.localeCompare(b.brand) ||
    a.category.localeCompare(b.category) ||
    a.productName.localeCompare(b.productName) ||
    a.sku.localeCompare(b.sku)
  );
  return [...kept, ...sortedImported];
}

function visibleProducts(products) {
  return products.filter((product) => product.visible !== false);
}

function uniqueSorted(products, field) {
  return [...new Set(visibleProducts(products).map((product) => product[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function buildFacets(products) {
  const visible = visibleProducts(products);
  return {
    categories: uniqueSorted(products, "category"),
    brands: uniqueSorted(products, "brand"),
    finishes: uniqueSorted(products, "finish"),
    fuelTypes: uniqueSorted(products, "fuelType"),
    installationTypes: uniqueSorted(products, "installationType"),
    widths: [...new Set(visible.map((product) => product.dimensions && product.dimensions.width).filter((value) => Number.isFinite(Number(value))).map(Number))]
      .sort((a, b) => a - b)
  };
}

function toSourceProduct(record) {
  const copy = { ...record };
  delete copy.displayPrice;
  delete copy.priceLabel;
  return copy;
}

function report(products, imported, rawProducts) {
  const byBrand = {};
  for (const record of imported) {
    byBrand[record.brand] ||= { records: 0, withImages: 0, withDocuments: 0 };
    byBrand[record.brand].records += 1;
    if (record.imageUrls.length) byBrand[record.brand].withImages += 1;
    if (record.pdfLinks.length) byBrand[record.brand].withDocuments += 1;
  }

  return {
    importedAt: new Date().toISOString(),
    market,
    baseUrl,
    statusFilter: [...statuses],
    recordMode,
    rawProductModels: rawProducts.length,
    importedRecords: imported.length,
    totalCatalogueRecordsAfterMerge: products.length,
    byBrand,
    missingImages: imported.filter((record) => !record.imageUrls.length).map((record) => record.sku),
    missingDocuments: imported.filter((record) => !record.pdfLinks.length).map((record) => record.sku)
  };
}

async function main() {
  const importedAt = new Date().toISOString();
  console.log(`Fetching SWC brands from ${baseUrl}`);
  const brands = await getJson("brands");
  const categoryIndex = categoryIndexFromBrands(brands);
  const rawProducts = [];

  for (const brand of brands.filter((item) => TARGET_BRANDS.has(item.Name))) {
    console.log(`Fetching ${brand.Name} products`);
    const products = await getJson(`getallproductsbybrand/${brand.Id}`);
    for (const product of products) {
      product.BrandName ||= brand.Name;
      rawProducts.push(product);
    }
  }

  const filteredProducts = rawProducts.filter((product) => statuses.has(compact(product.Status)));
  const seenSkus = new Set();
  const imported = filteredProducts
    .flatMap((product) => productRecords(product, categoryIndex.get(String(product.CategoryId).toLowerCase()) || {}, importedAt))
    .map((record) => normalizeSku(record, seenSkus));

  const staticPayload = readJson(staticPath);
  const staticProducts = staticPayload.products || [];
  const sourceProducts = fs.existsSync(sourcePath) ? readJson(sourcePath) : staticProducts;
  const nextStaticProducts = mergeProducts(staticProducts, imported);
  const nextSourceProducts = mergeProducts(Array.isArray(sourceProducts) ? sourceProducts : sourceProducts.products || [], imported.map(toSourceProduct));
  const nextStaticPayload = {
    facets: buildFacets(nextStaticProducts),
    products: nextStaticProducts
  };
  const importReport = report(nextStaticProducts, imported, rawProducts);

  console.log("");
  console.log("SWC import summary");
  console.log(JSON.stringify(importReport, null, 2));

  if (!write) {
    console.log("");
    console.log("Dry run complete. Re-run with --write to update the catalogue files.");
    return;
  }

  writeJson(staticPath, nextStaticPayload);
  writeJson(sourcePath, nextSourceProducts);
  writeJson(reportPath, importReport);
  console.log("");
  console.log(`Wrote ${path.relative(repoRoot, staticPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, sourcePath)}`);
  console.log(`Wrote ${path.relative(repoRoot, reportPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
