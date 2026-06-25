# KWA Appliances CSV Import Guide

Use the CSV importer when product data needs to be added or refreshed in bulk. The catalogue should support KWA's advisory sales process, not replace it.

## Website Focus

The public website should make visitors feel:

- "I've found experts."
- "They understand custom homes."
- "They will make my project easier."
- "I do not have to figure this out alone."

Product data should reinforce trust through accurate specs, dimensions, installation details, finishes, images, manuals, and pricing controls.

## Upload Steps

1. Open the CSV Import page.
2. Download the CSV template.
3. Fill one row per product.
4. Keep the SKU/model number exactly aligned with the manufacturer or internal product file.
5. Upload the CSV.
6. Spot-check updated products in the catalogue.

## SKU Update Rule

The importer uses `sku` as the permanent product key.

- If a SKU already exists, the product is updated.
- If a SKU does not exist, a new product is created.
- Rows without a SKU are skipped.

## Pricing Rules

Use `request_pricing` to control public pricing.

- `request_pricing=true` shows "Request Pricing" publicly.
- `request_pricing=false` shows the sale price when present, otherwise the regular price.
- `builder_price` is stored internally only and is never returned by the public product API.

## Multi-Value Fields

Separate multiple values with a pipe character.

- `image_urls`: `https://example.com/front.jpg|https://example.com/detail.jpg`
- `pdf_links`: `https://example.com/spec.pdf|https://example.com/manual.pdf`
- `specs`: `capacity:26 cu. ft.|features:Wi-Fi enabled`
- `dimensions`: `width:36|height:35.25|depth:28.25`

## Preferred Catalogue Content

Prioritize products and metadata that help homeowners, builders, designers, and architects make planning decisions:

- panel-ready requirements
- installation type
- fuel type
- exact width, height, and depth
- finish/color
- manuals and specification PDFs
- strong product imagery
- visibility status for products that should not appear publicly

## Supported Categories

- Refrigeration
- Cooking
- Dishwashers
- Laundry
- Outdoor
- Ventilation
- Coffee Systems
- Wine Storage
