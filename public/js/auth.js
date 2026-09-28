const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const alertBox = document.getElementById("alertBox");

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.style.display = "block";
}

function hideAlert() {
  alertBox.style.display = "none";
}

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.style.display = "flex";
  registerForm.style.display = "none";
  hideAlert();
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  registerForm.style.display = "flex";
  loginForm.style.display = "none";
  hideAlert();
});

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  const fd = new FormData(loginForm);
  try {
    await postJSON("/api/auth/login", {
      username: fd.get("username"),
      password: fd.get("password"),
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    showAlert(err.message);
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  const fd = new FormData(registerForm);
  try {
    await postJSON("/api/auth/register", {
      username: fd.get("username"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    showAlert(err.message);
  }
});

// If already logged in, skip straight to dashboard.
fetch("/api/auth/me")
  .then((res) => (res.ok ? (window.location.href = "dashboard.html") : null))
  .catch(() => {});
