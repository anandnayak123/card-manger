// ---------- Helpers ----------
const alertBox = document.getElementById("alertBox");

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(() => (alertBox.style.display = "none"), 5000);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(dateStr) {
  const MS = 24 * 60 * 60 * 1000;
  const today = new Date();
  const due = new Date(dateStr);
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / MS);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- Auth / profile ----------
const welcomeText = document.getElementById("welcomeText");
let currentUser = null;
let currentCards = []; // cached list, used to look up a card by id for modals

async function loadMe() {
  try {
    currentUser = await api("/api/auth/me");
    welcomeText.textContent = `Hi, ${currentUser.username}`;
  } catch {
    window.location.href = "index.html";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "index.html";
});

// Profile modal
const profileModal = document.getElementById("profileModal");
const profileForm = document.getElementById("profileForm");
document.getElementById("profileBtn").addEventListener("click", () => {
  document.getElementById("profileUsername").value = currentUser.username;
  document.getElementById("profileEmail").value = currentUser.email || "";
  profileModal.style.display = "flex";
});
document.getElementById("profileCancelBtn").addEventListener("click", () => {
  profileModal.style.display = "none";
});
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(profileForm);
  try {
    currentUser = await api("/api/auth/email", {
      method: "PUT",
      body: JSON.stringify({ email: fd.get("email") }),
    });
    profileModal.style.display = "none";
    showAlert("Reminder email updated.", "success");
  } catch (err) {
    showAlert(err.message);
  }
});

// ---------- Cards ----------
const cardsGrid = document.getElementById("cardsGrid");
const emptyState = document.getElementById("emptyState");

function dueBadge(dueDate) {
  const days = daysUntil(dueDate);
  if (days < 0) return { cls: "overdue", label: `Overdue by ${Math.abs(days)}d` };
  if (days === 0) return { cls: "overdue", label: "Due today" };
  if (days <= 3) return { cls: "soon", label: `Due in ${days}d` };
  return { cls: "ok", label: `Due in ${days}d` };
}

function renderCards(cards) {
  currentCards = cards;
  cardsGrid.innerHTML = "";
  emptyState.style.display = cards.length ? "none" : "block";

  for (const card of cards) {
    const badge = dueBadge(card.dueDate);
    const pct = Math.min(100, card.usagePercent);
    const barClass = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "";

    const tile = document.createElement("div");
    tile.className = "card-tile";
    tile.innerHTML = `
      <div class="card-tile-top">
        <div>
          <div class="card-bank">${escapeHtml(card.bank)}</div>
          <div class="card-type">${escapeHtml(card.type)}</div>
          <div class="card-number">**** **** **** ${escapeHtml(card.last4)}</div>
        </div>
        <span class="due-badge ${badge.cls}">${badge.label}</span>
      </div>

      <div class="progress-bar"><div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div></div>

      <div class="limit-row"><span>Used</span><span>${Number(card.usedLimit).toLocaleString()} / ${Number(card.totalLimit).toLocaleString()}</span></div>
      ${card.billGenerationDate ? `<div class="limit-row"><span>Bill generated</span><span>${formatDate(card.billGenerationDate)}</span></div>` : ""}
      <div class="limit-row"><span>Due date</span><span>${formatDate(card.dueDate)}</span></div>
      <div class="leftover">Remaining: ${card.leftoverLimit.toLocaleString()}</div>

      <div class="card-actions">
        <button class="btn primary" data-action="pay">Pay Bill</button>
        <button class="btn ghost" data-action="edit">Edit</button>
        <button class="btn ghost" data-action="benefits">Benefits</button>
        <button class="btn ghost" data-action="remind">Test Email</button>
        <button class="btn danger" data-action="delete">Delete</button>
      </div>
    `;

    tile.querySelector('[data-action="pay"]').addEventListener("click", () => openPaymentModal(card));
    tile.querySelector('[data-action="edit"]').addEventListener("click", () => openCardModal(card));
    tile.querySelector('[data-action="benefits"]').addEventListener("click", () => openBenefitsModal(card));
    tile.querySelector('[data-action="delete"]').addEventListener("click", () => deleteCard(card));
    tile.querySelector('[data-action="remind"]').addEventListener("click", () => sendTestReminder(card));

    cardsGrid.appendChild(tile);
  }
}

async function loadCards() {
  try {
    const cards = await api("/api/cards");
    renderCards(cards);
  } catch (err) {
    showAlert(err.message);
  }
}

async function sendTestReminder(card) {
  try {
    const result = await api(`/api/cards/${card.id}/send-test-reminder`, { method: "POST" });
    showAlert(`Test reminder sent to ${result.sentTo}.`, "success");
  } catch (err) {
    showAlert(err.message);
  }
}

async function deleteCard(card) {
  if (!confirm(`Remove the ${card.bank} card ending ${card.last4}?`)) return;
  try {
    await api(`/api/cards/${card.id}`, { method: "DELETE" });
    loadCards();
  } catch (err) {
    showAlert(err.message);
  }
}

// ---------- Add / Edit card modal ----------
const cardModal = document.getElementById("cardModal");
const cardForm = document.getElementById("cardForm");
const cardModalTitle = document.getElementById("cardModalTitle");

document.getElementById("addCardBtn").addEventListener("click", () => openCardModal(null));
document.getElementById("cardCancelBtn").addEventListener("click", () => (cardModal.style.display = "none"));

function openCardModal(card) {
  cardForm.reset();
  if (card) {
    cardModalTitle.textContent = "Edit Card";
    cardForm.id.value = card.id;
    cardForm.bank.value = card.bank;
    cardForm.type.value = card.type;
    cardForm.last4.value = card.last4;
    cardForm.billGenerationDate.value = card.billGenerationDate ? card.billGenerationDate.slice(0, 10) : "";
    cardForm.dueDate.value = card.dueDate.slice(0, 10);
    cardForm.totalLimit.value = card.totalLimit;
    cardForm.usedLimit.value = card.usedLimit;
  } else {
    cardModalTitle.textContent = "Add Card";
    cardForm.id.value = "";
  }
  cardModal.style.display = "flex";
}

cardForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(cardForm);
  const payload = {
    bank: fd.get("bank"),
    type: fd.get("type"),
    last4: fd.get("last4"),
    billGenerationDate: fd.get("billGenerationDate") || "",
    dueDate: fd.get("dueDate"),
    totalLimit: fd.get("totalLimit"),
    usedLimit: fd.get("usedLimit") || 0,
  };
  const id = fd.get("id");

  try {
    if (id) {
      await api(`/api/cards/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/cards", { method: "POST", body: JSON.stringify(payload) });
    }
    cardModal.style.display = "none";
    loadCards();
  } catch (err) {
    showAlert(err.message);
  }
});

// ---------- Payment modal ----------
const paymentModal = document.getElementById("paymentModal");
const paymentForm = document.getElementById("paymentForm");
const paymentCardLabel = document.getElementById("paymentCardLabel");
const advanceDueDateCheckbox = document.getElementById("advanceDueDate");
const nextDueDateWrap = document.getElementById("nextDueDateWrap");

document.getElementById("paymentCancelBtn").addEventListener("click", () => (paymentModal.style.display = "none"));

advanceDueDateCheckbox.addEventListener("change", () => {
  nextDueDateWrap.style.display = advanceDueDateCheckbox.checked ? "flex" : "none";
});

function openPaymentModal(card) {
  paymentForm.reset();
  nextDueDateWrap.style.display = "none";
  paymentForm.id.value = card.id;
  paymentCardLabel.textContent = `${card.bank} — **** ${card.last4} (currently used: ${card.usedLimit})`;

  const next = new Date(card.dueDate);
  next.setMonth(next.getMonth() + 1);
  paymentForm.nextDueDate.value = next.toISOString().slice(0, 10);

  paymentModal.style.display = "flex";
}

paymentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(paymentForm);
  const id = fd.get("id");
  const payload = {
    amount: fd.get("amount"),
    advanceDueDate: advanceDueDateCheckbox.checked,
    nextDueDate: fd.get("nextDueDate"),
  };
  try {
    await api(`/api/cards/${id}/payment`, { method: "POST", body: JSON.stringify(payload) });
    paymentModal.style.display = "none";
    loadCards();
  } catch (err) {
    showAlert(err.message);
  }
});

// ---------- Benefits modal ----------
const CATEGORY_LABELS = {
  discountsDeals: "Discounts & Deals",
  cashback: "Cashback",
  entertainment: "Entertainment",
  foodDining: "Food & Dining",
  shopping: "Shopping",
  hotels: "Hotels",
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

const benefitsModal = document.getElementById("benefitsModal");
const benefitsModalTitle = document.getElementById("benefitsModalTitle");
const benefitsTabs = document.getElementById("benefitsTabs");
const benefitsList = document.getElementById("benefitsList");
const benefitItemForm = document.getElementById("benefitItemForm");
const benefitsSuggestBtn = document.getElementById("benefitsSuggestBtn");
const benefitsSuggestNote = document.getElementById("benefitsSuggestNote");

let benefitsState = {}; // { discountsDeals: [...], cashback: [...], ... }
let activeCategory = "discountsDeals";
let benefitsCardId = null;

function renderBenefitsList() {
  const items = benefitsState[activeCategory] || [];
  if (items.length === 0) {
    benefitsList.innerHTML = `<p class="empty-hint">No entries yet in ${CATEGORY_LABELS[activeCategory]}. Add one below.</p>`;
    return;
  }
  benefitsList.innerHTML = items
    .map(
      (item, idx) => `
      <div class="benefit-item">
        <div class="benefit-item-main">
          <div class="benefit-item-title">${escapeHtml(item.title)}</div>
          ${item.description ? `<div class="benefit-item-desc">${escapeHtml(item.description)}</div>` : ""}
          ${item.validTill ? `<div class="benefit-item-valid">Valid till ${formatDate(item.validTill)}</div>` : ""}
        </div>
        <button type="button" class="btn danger small" data-idx="${idx}">Remove</button>
      </div>
    `
    )
    .join("");

  benefitsList.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => removeBenefitItem(Number(btn.dataset.idx)));
  });
}

function switchBenefitsTab(category) {
  activeCategory = category;
  benefitsTabs.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.category === category);
  });
  renderBenefitsList();
}

benefitsTabs.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchBenefitsTab(tab.dataset.category));
});

async function saveBenefitCategory(category) {
  try {
    await api(`/api/cards/${benefitsCardId}/benefits/${category}`, {
      method: "PUT",
      body: JSON.stringify({ items: benefitsState[category] || [] }),
    });
  } catch (err) {
    showAlert(err.message);
  }
}

async function removeBenefitItem(idx) {
  benefitsState[activeCategory].splice(idx, 1);
  renderBenefitsList();
  await saveBenefitCategory(activeCategory);
}

benefitItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("benefitItemTitle").value.trim();
  const description = document.getElementById("benefitItemDescription").value.trim();
  const validTill = document.getElementById("benefitItemValidTill").value;
  if (!title) return;

  if (!benefitsState[activeCategory]) benefitsState[activeCategory] = [];
  benefitsState[activeCategory].push({ title, description, validTill: validTill || null });
  renderBenefitsList();
  benefitItemForm.reset();
  await saveBenefitCategory(activeCategory);
});

async function openBenefitsModal(card) {
  benefitsCardId = card.id;
  benefitsModalTitle.textContent = `${card.bank} •••• ${card.last4} — Benefits`;
  activeCategory = "discountsDeals";
  switchBenefitsTab("discountsDeals");

  try {
    benefitsState = await api(`/api/cards/${card.id}/benefits`);
  } catch (err) {
    benefitsState = {};
    showAlert(err.message);
  }
  for (const key of CATEGORY_KEYS) {
    if (!benefitsState[key]) benefitsState[key] = [];
  }

  // Offer a one-click prefill only when every category is still empty and
  // we recognise this bank/type from the small starter dataset.
  const totalItems = CATEGORY_KEYS.reduce((sum, k) => sum + benefitsState[k].length, 0);
  const suggestion =
    typeof findBenefitSuggestion === "function" ? findBenefitSuggestion(card.bank, card.type) : null;

  if (totalItems === 0 && suggestion) {
    benefitsSuggestBtn.style.display = "inline-block";
    benefitsSuggestNote.style.display = "block";
    benefitsSuggestNote.textContent =
      "We recognise this card — you can prefill common benefits as a starting point (please verify with your bank, terms change).";
    benefitsSuggestBtn.onclick = async () => {
      benefitsState = JSON.parse(JSON.stringify(suggestion));
      for (const key of CATEGORY_KEYS) {
        if (!benefitsState[key]) benefitsState[key] = [];
        benefitsState[key] = benefitsState[key].map((item) => ({ ...item, validTill: item.validTill || null }));
      }
      renderBenefitsList();
      for (const key of CATEGORY_KEYS) {
        await saveBenefitCategory(key);
      }
      benefitsSuggestBtn.style.display = "none";
      benefitsSuggestNote.style.display = "none";
      showAlert("Prefilled with common benefits — feel free to edit or remove any of them.", "success");
    };
  } else {
    benefitsSuggestBtn.style.display = "none";
    benefitsSuggestNote.style.display = "none";
  }

  renderBenefitsList();
  benefitsModal.style.display = "flex";
}

document.getElementById("benefitsCancelBtn").addEventListener("click", () => {
  benefitsModal.style.display = "none";
  loadCards();
});
document.getElementById("benefitsSaveBtn").addEventListener("click", () => {
  benefitsModal.style.display = "none";
  loadCards();
});

// ---------- Init ----------
(async function init() {
  await loadMe();
  loadCards();
})();
