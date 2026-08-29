from flask import Flask, jsonify, request, send_from_directory
from flask_swagger_ui import get_swaggerui_blueprint
from db import get_connection

app = Flask(__name__)

# Swagger UI: an interactive docs page that reads openapi.yaml and renders
# a "try it out" style browser UI, instead of a static PDF/Markdown page.
SWAGGER_URL = "/api/docs-ui"
OPENAPI_SPEC_URL = "/api/openapi.yaml"
app.register_blueprint(
    get_swaggerui_blueprint(
        SWAGGER_URL, OPENAPI_SPEC_URL, config={"app_name": "Inventory Tracker API"}
    ),
    url_prefix=SWAGGER_URL,
)


@app.route("/api/openapi.yaml", methods=["GET"])
def openapi_spec():
    """Serves the raw OpenAPI spec file -- this is the machine-readable
    file Swagger UI (and any other OAS-aware tool) reads."""
    return send_from_directory(".", "openapi.yaml", mimetype="text/yaml")


def _product_dict(row):
    return {
        "id": row[0],
        "name": row[1],
        "stock_qty": row[2],
        "price": float(row[3]),
        "cost": float(row[4]),
    }


PRODUCT_COLS = "id, name, stock_qty, price, cost"


@app.route("/")
def index():
    """Serves the actual page. Everything below stays exactly as it was --
    the buttons on this page just call the same endpoints you tested with
    curl."""
    return send_from_directory("static", "index.html")


@app.route("/api/docs", methods=["GET"])
def get_docs():
    """
    Lets any client (browser, curl, another program) download the current
    API reference as a PDF -- e.g. GET /api/docs. This is served straight
    from the project folder, not the database, so it's always whatever
    API_REFERENCE.pdf currently contains.
    """
    return send_from_directory(".", "API_REFERENCE.pdf", mimetype="application/pdf")


@app.route("/api/products", methods=["GET"])
def get_products():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT {PRODUCT_COLS} FROM products ORDER BY id;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([_product_dict(r) for r in rows])


@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """Look up a single product by id -- e.g. GET /api/products/2 returns
    just the banana row instead of all 5."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        f"SELECT {PRODUCT_COLS} FROM products WHERE id = %s;",
        (product_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row is None:
        return jsonify({"error": "no product with that id"}), 404
    return jsonify(_product_dict(row))


@app.route("/api/products/<int:product_id>/restock", methods=["POST"])
def restock_product(product_id):
    """+1 to stock_qty and log a purchase at the product's current cost.
    That purchase cost is subtracted from net worth."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT cost FROM products WHERE id = %s;", (product_id,))
    row = cur.fetchone()
    if row is None:
        cur.close()
        conn.close()
        return jsonify({"error": "no product with that id"}), 404

    (cost,) = row
    cur.execute(
        f"UPDATE products SET stock_qty = stock_qty + 1 WHERE id = %s "
        f"RETURNING {PRODUCT_COLS};",
        (product_id,),
    )
    updated = cur.fetchone()

    cur.execute(
        "INSERT INTO purchases (product_id, qty, cost_at_purchase) VALUES (%s, 1, %s);",
        (product_id, cost),
    )

    conn.commit()
    cur.close()
    conn.close()
    return jsonify(_product_dict(updated))


@app.route("/api/products/<int:product_id>/price", methods=["PUT"])
def set_price(product_id):
    """Manually set what this product sells for. Body: {"price": 1.50}"""
    data = request.get_json(silent=True) or {}
    price = data.get("price")

    if not isinstance(price, (int, float)) or price < 0:
        return jsonify({"error": "price must be a number >= 0"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE products SET price = %s WHERE id = %s "
        f"RETURNING {PRODUCT_COLS};",
        (price, product_id),
    )
    row = cur.fetchone()
    if row is None:
        cur.close()
        conn.close()
        return jsonify({"error": "no product with that id"}), 404
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(_product_dict(row))


@app.route("/api/products/<int:product_id>/cost", methods=["PUT"])
def set_cost(product_id):
    """Manually set purchase cost (매입가). Body: {"cost": 0.80}"""
    data = request.get_json(silent=True) or {}
    cost = data.get("cost")

    if not isinstance(cost, (int, float)) or cost < 0:
        return jsonify({"error": "cost must be a number >= 0"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE products SET cost = %s WHERE id = %s "
        f"RETURNING {PRODUCT_COLS};",
        (cost, product_id),
    )
    row = cur.fetchone()
    if row is None:
        cur.close()
        conn.close()
        return jsonify({"error": "no product with that id"}), 404
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(_product_dict(row))


@app.route("/api/products/<int:product_id>/sell", methods=["POST"])
def sell_product(product_id):
    """
    -1 from stock, and log the sale in the `sales` table so net worth
    (revenue minus purchase costs) is always calculated from real history.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT stock_qty, price FROM products WHERE id = %s;", (product_id,))
    row = cur.fetchone()
    if row is None:
        cur.close()
        conn.close()
        return jsonify({"error": "no product with that id"}), 404

    stock_qty, price = row
    if stock_qty <= 0:
        cur.close()
        conn.close()
        return jsonify({"error": "out of stock"}), 400

    cur.execute(
        f"UPDATE products SET stock_qty = stock_qty - 1 WHERE id = %s "
        f"RETURNING {PRODUCT_COLS};",
        (product_id,),
    )
    updated = cur.fetchone()

    cur.execute(
        "INSERT INTO sales (product_id, qty_sold, price_at_sale) VALUES (%s, 1, %s);",
        (product_id, price),
    )

    conn.commit()
    cur.close()
    conn.close()
    return jsonify(_product_dict(updated))


@app.route("/api/sales", methods=["GET"])
def get_sales():
    """Transaction history, newest first by default.

    Query params:
      - product_id: filter to one product id (e.g. ?product_id=2)
      - product:    filter by product name (e.g. ?product=banana)
      - group_by:   if "product", return sales sorted into product buckets
                    instead of a flat list
      - sort:       "sold_at" (default) or "product" (name, then newest)
    """
    product_id = request.args.get("product_id", type=int)
    product_name = request.args.get("product")
    group_by = request.args.get("group_by")
    sort = request.args.get("sort", "sold_at")

    if product_id is not None and product_id < 1:
        return jsonify({"error": "product_id must be a positive integer"}), 400
    if group_by is not None and group_by != "product":
        return jsonify({"error": 'group_by must be "product"'}), 400
    if sort not in ("sold_at", "product"):
        return jsonify({"error": 'sort must be "sold_at" or "product"'}), 400

    where_clauses = []
    params = []
    if product_id is not None:
        where_clauses.append("sales.product_id = %s")
        params.append(product_id)
    if product_name is not None:
        where_clauses.append("products.name = %s")
        params.append(product_name)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    if sort == "product":
        order_sql = "ORDER BY products.name ASC, sales.sold_at DESC"
    else:
        order_sql = "ORDER BY sales.sold_at DESC"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT sales.id, sales.product_id, products.name, sales.qty_sold,
               sales.price_at_sale, sales.sold_at
        FROM sales
        JOIN products ON products.id = sales.product_id
        {where_sql}
        {order_sql};
        """,
        params,
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    sales = [
        {
            "id": r[0],
            "product_id": r[1],
            "product_name": r[2],
            "qty_sold": r[3],
            "price_at_sale": float(r[4]),
            "sold_at": r[5].isoformat(),
        }
        for r in rows
    ]

    if group_by == "product":
        grouped = {}
        for sale in sales:
            key = sale["product_name"]
            grouped.setdefault(key, []).append(sale)
        return jsonify(grouped)

    return jsonify(sales)


@app.route("/api/valuation", methods=["GET"])
def get_valuation():
    """Net worth = total sales revenue − total purchase costs from restocks."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(SUM(qty_sold * price_at_sale), 0) FROM sales;")
    (revenue,) = cur.fetchone()
    cur.execute("SELECT COALESCE(SUM(qty * cost_at_purchase), 0) FROM purchases;")
    (costs,) = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify({
        "net_worth": float(revenue) - float(costs),
        "revenue": float(revenue),
        "costs": float(costs),
    })


if __name__ == "__main__":
    # debug=True gives auto-reload + readable error pages -- fine for
    # local-only development, never used for anything public-facing.
    app.run(port=5001, debug=True)
