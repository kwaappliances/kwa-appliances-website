# KWA Appliances Website

Premium appliance dealer website prototype with CSV product import, public catalogue, product pages, pricing controls, and advisor-first positioning.

## Local Run

```bash
npm start
```

Open `http://127.0.0.1:4173`.

## Vercel

This project includes `vercel.json` for routing all requests through `server.js`.

## Notes

- Public product API removes internal builder pricing.
- CSV imports update products by SKU.
- Sample CSV template is in `outputs/kwa-product-import-template.csv`.
