# Inventory & Revenue Tracker

A small local web app for tracking stock, sell price, and purchase cost of five fixed products (apple, banana, grape, orange, watermelon), and calculating **net worth** from real transaction history.

## What it does

- Show current stock, sell price, and purchase cost (매입가) for each product
- Restock (`+1 Stock`) — increases inventory and logs a purchase at the current cost
- Sell (`Sell -1`) — decreases inventory and logs a sale at the current sell price
- Update sell price and cost from the UI
- Net worth = total sales revenue − total restock purchase costs
- Modal with **Transactions** history and **Stock** status tables

## Stack

| Layer | Tech |
|-------|------|
| Backend | Flask (`app.py`) |
| Database | PostgreSQL (`prototype` DB via `psycopg2`) |
| Frontend | Static HTML / CSS / JS (`static/`) |
| API docs | OpenAPI (`openapi.yaml`) + Swagger UI at `/api/docs-ui` |

## Project layout

```
app.py           Flask API and page server
db.py            PostgreSQL connection helper
schema.sql       Tables: products, sales, purchases
static/          Homepage UI
openapi.yaml     API specification
requirements.txt Python dependencies
```

## Setup

1. Create / use a local Postgres database named `prototype`.
2. Apply the schema:

```bash
psql -d prototype -f schema.sql
```

3. Install dependencies and run:

```bash
pip install -r requirements.txt
python app.py
```

4. Open [http://127.0.0.1:5001](http://127.0.0.1:5001).

Interactive API docs: [http://127.0.0.1:5001/api/docs-ui](http://127.0.0.1:5001/api/docs-ui).

## Main API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/products` | List products |
| `POST` | `/api/products/<id>/restock` | +1 stock, log purchase |
| `POST` | `/api/products/<id>/sell` | −1 stock, log sale |
| `PUT` | `/api/products/<id>/price` | Set sell price |
| `PUT` | `/api/products/<id>/cost` | Set purchase cost |
| `GET` | `/api/sales` | Sales history (filter/sort/group query params) |
| `GET` | `/api/valuation` | Net worth (revenue − costs) |

This is a local development prototype — not intended for public deployment as written.
