const fs = require("fs/promises");
const path = require("path");
const app = require("../server");

const store = path.join(__dirname, "..", "data", "products.json");

(async () => {
  const original = await fs.readFile(store, "utf8");
  try {
    const csv = [
      "sku,brand,product_name,category,subcategory,description,specs,dimensions,width,finish,fuel_type,installation_type,panel_ready,price,sale_price,request_pricing,visible,image_urls,pdf_links,builder_price",
      "TEST-100,KWA Test,Test Induction Cooktop,Cooking,Cooktops,Test import product,power:Induction|controls:Touch,width:30|height:4|depth:21,30,Black Glass,Electric,Built-In,false,3199,2999,false,true,https://example.com/test-a.jpg|https://example.com/test-b.jpg,https://example.com/test.pdf,2500",
      "MON-GRP366,Monogram,36 Inch Professional Gas Range,Cooking,Ranges,Updated smoke-test range,burners:6 sealed dual-flame burners,width:36|height:35.25|depth:28.25,36,Stainless Steel,Gas,Freestanding,false,8799,8199,false,true,https://example.com/range.jpg,https://example.com/range.pdf,7400"
    ].join("\n");
    const report = await app.importProducts(csv);
    const products = await app.loadProducts();
    const testProduct = products.find((product) => product.sku === "TEST-100");
    const safeProduct = app.publicProduct(testProduct);
    if (report.created !== 1 || report.updated !== 1 || !testProduct) throw new Error("Importer did not create and update expected products.");
    if (testProduct.imageUrls.length !== 2) throw new Error("Multiple image URLs were not preserved.");
    if (JSON.stringify(safeProduct).includes("builderPrice") || Object.prototype.hasOwnProperty.call(safeProduct, "internal")) throw new Error("Public product response exposed internal pricing.");
    console.log("Smoke test passed", report);
  } finally {
    await fs.writeFile(store, original, "utf8");
  }
})().catch((error) => { console.error(error); process.exit(1); });
