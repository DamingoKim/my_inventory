-- schema.sql
-- Creates the tables this app needs INSIDE the `prototype` database only.
-- Run with:  psql -d prototype -f schema.sql
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING mean it won't error
-- or duplicate data if you run it more than once. It never touches any
-- database other than the one you connect to (prototype).

BEGIN;

CREATE TABLE IF NOT EXISTS products (
    id         SERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    stock_qty  INTEGER NOT NULL DEFAULT 0,
    price      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cost       NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- For DBs created before `cost` existed:
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS sales (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    qty_sold       INTEGER NOT NULL,
    price_at_sale  NUMERIC(10, 2) NOT NULL,
    sold_at        TIMESTAMP NOT NULL DEFAULT now()
);

-- Each +1 stock click is logged here so net worth can subtract purchase cost.
CREATE TABLE IF NOT EXISTS purchases (
    id                SERIAL PRIMARY KEY,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    qty               INTEGER NOT NULL,
    cost_at_purchase  NUMERIC(10, 2) NOT NULL,
    purchased_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Seed the 5 fixed items. ON CONFLICT DO NOTHING means running this twice
-- will not reset stock/price/cost you've already changed by hand.
INSERT INTO products (name, stock_qty, price, cost) VALUES
    ('apple',      0, 0.00, 0.00),
    ('banana',     0, 0.00, 0.00),
    ('grape',      0, 0.00, 0.00),
    ('orange',     0, 0.00, 0.00),
    ('watermelon', 0, 0.00, 0.00)
ON CONFLICT (name) DO NOTHING;

COMMIT;
