-- schema.sql
-- Creates the two tables this app needs INSIDE the `prototype` database only.
-- Run with:  psql -d prototype -f schema.sql
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING mean it won't error
-- or duplicate data if you run it more than once. It never touches any
-- database other than the one you connect to (prototype).

BEGIN;

CREATE TABLE IF NOT EXISTS products (
    id         SERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    stock_qty  INTEGER NOT NULL DEFAULT 0,
    price      NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS sales (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    qty_sold       INTEGER NOT NULL,
    price_at_sale  NUMERIC(10, 2) NOT NULL,
    sold_at        TIMESTAMP NOT NULL DEFAULT now()
);

-- Seed the 5 fixed items. ON CONFLICT DO NOTHING means running this twice
-- will not reset stock/price you've already changed by hand.
INSERT INTO products (name, stock_qty, price) VALUES
    ('apple',      0, 0.00),
    ('banana',     0, 0.00),
    ('grape',      0, 0.00),
    ('orange',     0, 0.00),
    ('watermelon', 0, 0.00)
ON CONFLICT (name) DO NOTHING;

COMMIT;
