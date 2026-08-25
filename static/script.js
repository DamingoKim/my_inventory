// Every function here just calls one of the endpoints documented in
// API_REFERENCE.md / openapi.yaml, then updates the page with whatever
// the server sent back. The server (Flask + Postgres) is still the only
// thing that actually changes stock, price, or revenue -- this file
// never does math itself.

// Per-fruit image + accent color, purely cosmetic -- comes from
// Wikimedia Commons (freely licensed), keyed by the product name the
// API already returns.
const FRUIT_STYLE = {
  apple: {
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_Apple.jpg?width=400",
    color: "#e74c3c",
  },
  banana: {
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Bananas.jpg?width=400",
    color: "#f1c40f",
  },
  grape: {
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Grapes.jpg?width=400",
    color: "#8e44ad",
  },
  orange: {
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Orange-Fruit-Pieces.jpg?width=400",
    color: "#e67e22",
  },
  watermelon: {
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Watermelons.jpg?width=400",
    color: "#27ae60",
  },
};

async function loadProducts() {
  const res = await fetch("/api/products");
  const products = await res.json();

  const grid = document.getElementById("products-grid");
  grid.innerHTML = "";

  products.forEach((p) => {
    const style = FRUIT_STYLE[p.name] || { image: "", color: "#ccc" };

    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.id = p.id;
    card.style.setProperty("--accent", style.color);

    card.innerHTML = `
      <img src="${style.image}" alt="${p.name}">
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-stats">
          <span>Stock: <strong class="stock">${p.stock_qty}</strong></span>
          <span>Price: <strong class="price">$${p.price.toFixed(2)}</strong></span>
        </div>
        <div class="btn-row">
          <button class="restock-btn">+1 Stock</button>
          <button class="sell-btn">Sell -1</button>
        </div>
        <div class="price-row">
          <input type="number" step="0.01" min="0" class="price-input" placeholder="e.g. 1.50">
          <button class="set-price-btn">Set price</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  attachHandlers();
}

async function loadValuation() {
  const res = await fetch("/api/valuation");
  const data = await res.json();
  document.getElementById("net-worth-value").textContent = `$${data.net_worth.toFixed(2)}`;
}

function updateCard(product) {
  const card = document.querySelector(`.product-card[data-id="${product.id}"]`);
  card.querySelector(".stock").textContent = product.stock_qty;
  card.querySelector(".price").textContent = `$${product.price.toFixed(2)}`;
}

function attachHandlers() {
  document.querySelectorAll(".restock-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".product-card").dataset.id;
      const res = await fetch(`/api/products/${id}/restock`, { method: "POST" });
      if (res.ok) {
        updateCard(await res.json());
      }
    };
  });

  document.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".product-card").dataset.id;
      const res = await fetch(`/api/products/${id}/sell`, { method: "POST" });
      if (res.ok) {
        updateCard(await res.json());
        loadValuation();
      } else {
        const err = await res.json();
        alert(err.error || "Could not sell that item.");
      }
    };
  });

  document.querySelectorAll(".set-price-btn").forEach((btn) => {
    btn.onclick = async () => {
      const card = btn.closest(".product-card");
      const id = card.dataset.id;
      const input = card.querySelector(".price-input");
      const price = parseFloat(input.value);

      if (Number.isNaN(price) || price < 0) {
        alert("Enter a valid price (0 or more).");
        return;
      }

      const res = await fetch(`/api/products/${id}/price`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });

      if (res.ok) {
        updateCard(await res.json());
        input.value = "";
      }
    };
  });
}

async function openHistoryModal() {
  const res = await fetch("/api/sales");
  const sales = await res.json();

  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  if (sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">No sales yet.</td></tr>`;
  } else {
    sales.forEach((s) => {
      const tr = document.createElement("tr");
      const total = (s.qty_sold * s.price_at_sale).toFixed(2);
      const when = new Date(s.sold_at).toLocaleString();
      tr.innerHTML = `
        <td>${when}</td>
        <td class="capitalize">${s.product_name}</td>
        <td>${s.qty_sold}</td>
        <td>$${total}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("history-overlay").classList.add("open");
}

function closeHistoryModal() {
  document.getElementById("history-overlay").classList.remove("open");
}

document.getElementById("net-worth").addEventListener("click", openHistoryModal);
document.getElementById("history-close").addEventListener("click", closeHistoryModal);
// clicking the dark backdrop (not the box itself) also closes it
document.getElementById("history-overlay").addEventListener("click", (e) => {
  if (e.target.id === "history-overlay") closeHistoryModal();
});

loadProducts();
loadValuation();
