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

const WARN_TRIANGLE_SVG = `
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
    <path d="M12 2.5 L22 20.5 H2 Z" fill="#e67e22" stroke="#d35400" stroke-width="1" stroke-linejoin="round"/>
    <rect x="11" y="8" width="2.2" height="7" rx="1" fill="#fff"/>
    <circle cx="12.1" cy="17.5" r="1.2" fill="#fff"/>
  </svg>
`;

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

    const lowStock = p.stock_qty <= 1;
    const outOfStock = `<span class="out-of-stock-tag"${lowStock ? "" : " hidden"}>(Out of Stock)</span>`;
    const warnIcon = `<span class="stock-warn-icon"${lowStock ? "" : " hidden"} title="Out of Stock" aria-label="Out of Stock">${WARN_TRIANGLE_SVG}</span>`;

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${style.image}" alt="${p.name}">
        ${warnIcon}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name} ${outOfStock}</div>
        <div class="product-stats">
          <span>Stock: <strong class="stock">${p.stock_qty}</strong></span>
          <span>Sell: <strong class="price">$${p.price.toFixed(2)}</strong></span>
        </div>
        <div class="product-stats">
          <span>Cost: <strong class="cost">$${p.cost.toFixed(2)}</strong></span>
        </div>
        <div class="btn-row">
          <button class="restock-btn">+1 Stock</button>
          <button class="sell-btn">Sell -1</button>
        </div>
        <div class="price-row">
          <input type="number" step="0.01" min="0" class="price-input" placeholder="Sell price">
          <button class="set-price-btn">Set sell</button>
        </div>
        <div class="price-row">
          <input type="number" step="0.01" min="0" class="cost-input" placeholder="Cost price">
          <button class="set-cost-btn">Set cost</button>
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
  card.querySelector(".cost").textContent = `$${product.cost.toFixed(2)}`;
  const lowStock = product.stock_qty <= 1;
  const tag = card.querySelector(".out-of-stock-tag");
  if (tag) tag.hidden = !lowStock;
  const warn = card.querySelector(".stock-warn-icon");
  if (warn) warn.hidden = !lowStock;
}

function attachHandlers() {
  document.querySelectorAll(".restock-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".product-card").dataset.id;
      const res = await fetch(`/api/products/${id}/restock`, { method: "POST" });
      if (res.ok) {
        updateCard(await res.json());
        loadValuation();
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
        alert("Enter a valid sell price (0 or more).");
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

  document.querySelectorAll(".set-cost-btn").forEach((btn) => {
    btn.onclick = async () => {
      const card = btn.closest(".product-card");
      const id = card.dataset.id;
      const input = card.querySelector(".cost-input");
      const cost = parseFloat(input.value);

      if (Number.isNaN(cost) || cost < 0) {
        alert("Enter a valid cost price (0 or more).");
        return;
      }

      const res = await fetch(`/api/products/${id}/cost`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost }),
      });

      if (res.ok) {
        updateCard(await res.json());
        input.value = "";
      }
    };
  });
}

async function loadHistoryTab() {
  const typeFilter = document.getElementById("tx-type-filter").value || "ALL";
  const res = await fetch(`/api/transactions?type=${encodeURIComponent(typeFilter)}`);
  const transactions = await res.json();

  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No transactions yet.</td></tr>`;
    return;
  }

  transactions.forEach((t) => {
    const tr = document.createElement("tr");
    const when = new Date(t.occurred_at).toLocaleString();
    const sign = t.type === "sell" ? "+" : "-";
    const totalClass = t.type === "sell" ? "total-sell" : "total-replenish";
    tr.innerHTML = `
      <td>${when}</td>
      <td>${t.type}</td>
      <td class="capitalize">${t.product_name}</td>
      <td>${t.qty}</td>
      <td class="${totalClass}">${sign}$${t.total.toFixed(2)}</td>
      <td>$${t.net_worth.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadStockTab() {
  // Reuses the same /api/products endpoint the cards on the main page
  // use -- this tab is just another view of the exact same live data.
  const res = await fetch("/api/products");
  const products = await res.json();

  const tbody = document.getElementById("stock-body");
  tbody.innerHTML = "";

  products.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="capitalize">${p.name}</td>
      <td>${p.stock_qty}</td>
      <td>$${p.cost.toFixed(2)}</td>
      <td>$${p.price.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.panel !== tabName);
  });

  if (tabName === "history") loadHistoryTab();
  if (tabName === "stock") loadStockTab();
}

function openHistoryModal() {
  document.getElementById("history-overlay").classList.add("open");
  switchTab("history"); // always open back on the Transactions tab
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
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
document.getElementById("tx-type-filter").addEventListener("change", loadHistoryTab);

loadProducts();
loadValuation();
