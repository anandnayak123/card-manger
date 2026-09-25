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

// ---------- Auth / profile ----------
const welcomeText = document.getElementById("welcomeText");
let currentUser = null;

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
      <div class="limit-row"><span>Due date</span><span>${formatDate(card.dueDate)}</span></div>
      <div class="leftover">Remaining: ${card.leftoverLimit.toLocaleString()}</div>

      <div class="card-actions">
        <button class="btn primary" data-action="pay">Pay Bill</button>
        <button class="btn ghost" data-action="edit">Edit</button>
        <button class="btn ghost" data-action="remind">Test Email</button>
        <button class="btn danger" data-action="delete">Delete</button>
      </div>
    `;

    tile.querySelector('[data-action="pay"]').addEventListener("click", () => openPaymentModal(card));
    tile.querySelector('[data-action="edit"]').addEventListener("click", () => openCardModal(card));
    tile.querySelector('[data-action="delete"]').addEventListener("click", () => deleteCard(card));
    tile.querySelector('[data-action="remind"]').addEventListener("click", () => sendTestReminder(card));

    cardsGrid.appendChild(tile);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

  // Default the "next due date" suggestion to +1 month from current due date.
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

// ---------- Init ----------
(async function init() {
  await loadMe();
  loadCards();
})();
