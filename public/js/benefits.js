const LABELS = {
  discountsDeals: "Discounts & Deals",
  cashback: "Cashback",
  entertainment: "Entertainment",
  foodDining: "Food & Dining",
  shopping: "Shopping",
  hotels: "Hotels",
};

const alertBox = document.getElementById("alertBox");
const resultsSection = document.getElementById("categoryResults");
const resultsTitle = document.getElementById("categoryResultsTitle");
const resultsBody = document.getElementById("categoryResultsBody");

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.style.display = "block";
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(() => (alertBox.style.display = "none"), 5000);
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) window.location.href = "index.html";
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function showCategory(category) {
  document.querySelectorAll(".category-tile").forEach((t) =>
    t.classList.toggle("active", t.dataset.category === category)
  );
  resultsTitle.textContent = LABELS[category];
  resultsBody.innerHTML = "<p class='empty-hint'>Loading…</p>";
  resultsSection.style.display = "block";

  try {
    const groups = await api(`/api/cards/benefits/${category}`);
    if (groups.length === 0) {
      resultsBody.innerHTML =
        "<p class='empty-hint'>None of your cards have entries here yet. Open a card's <strong>Benefits</strong> button on the My Cards page to add some.</p>";
      return;
    }
    resultsBody.innerHTML = groups
      .map(
        (g) => `
        <div class="benefit-group">
          <div class="benefit-group-head">${escapeHtml(g.bank)} · ${escapeHtml(g.type)} · •••• ${escapeHtml(g.last4)}</div>
          ${g.items
            .map(
              (item) => `
            <div class="benefit-item">
              <div class="benefit-item-main">
                <div class="benefit-item-title">${escapeHtml(item.title)}</div>
                ${item.description ? `<div class="benefit-item-desc">${escapeHtml(item.description)}</div>` : ""}
                ${item.validTill ? `<div class="benefit-item-valid">Valid till ${formatDate(item.validTill)}</div>` : ""}
              </div>
            </div>`
            )
            .join("")}
        </div>`
      )
      .join("");
  } catch (err) {
    resultsBody.innerHTML = "";
    showAlert(err.message);
  }
}

document.querySelectorAll(".category-tile").forEach((tile) => {
  tile.addEventListener("click", () => showCategory(tile.dataset.category));
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "index.html";
});

// Make sure the user is logged in before showing anything.
api("/api/auth/me").catch(() => (window.location.href = "index.html"));
