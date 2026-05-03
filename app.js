/* ═══════════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════════ */
const API = "https://api.freeapi.app/api/v1/users";

/* ═══════════════════════════════════════════════════════════════════
   STATE
   We rely on the server session cookie (httpOnly) for auth persistence.
   accessToken is stored in memory only — refresh from localStorage is
   intentionally omitted to keep this project simple and demo the
   cookie-based session flow the API uses.
═══════════════════════════════════════════════════════════════════ */
let state = {
    user: null, // current user object from API
    rawResponse: null, // raw API data payload
    loading: false,
};

/* ═══════════════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════════════ */
const views = {
    login: document.getElementById("view-login"),
    register: document.getElementById("view-register"),
    dashboard: document.getElementById("view-dashboard"),
};

const $ = (id) => document.getElementById(id);

/* ═══════════════════════════════════════════════════════════════════
   VIEW ROUTER
═══════════════════════════════════════════════════════════════════ */
function showView(name) {
    Object.values(views).forEach((v) => v.classList.remove("active"));
    views[name].classList.add("active");
    updateStatusBar(name === "dashboard");
}

/* ═══════════════════════════════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════════════════════════════ */
function updateStatusBar(authed) {
    $("status-dot").classList.toggle("live", authed);
    $("status-text").textContent = authed
        ? `session active · ${state.user?.username ?? ""}`
        : "not authenticated";
}

/* ═══════════════════════════════════════════════════════════════════
   BUTTON LOADING STATE
═══════════════════════════════════════════════════════════════════ */
function setLoading(btn, loading) {
    const label = btn.querySelector(".btn-label");
    if (loading) {
        btn._originalText = label.textContent;
        label.innerHTML = `<span class="spinner"></span> Working…`;
        btn.disabled = true;
    } else {
        label.textContent = btn._originalText ?? "Submit";
        btn.disabled = false;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════════════════════════════ */
function toast(type, message, duration = 4000) {
    const container = $("toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
    <div class="toast-icon">${type === "success" ? "✓" : "✕"}</div>
    <div class="toast-body">
      <div class="toast-label">${type}</div>
      <div class="toast-msg">${message}</div>
    </div>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.transition = "opacity 0.3s";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 300);
    }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   TOKEN STORE
   sessionStorage: cleared when tab closes.
   Never store in localStorage for real apps — XSS readable.
   For this project (FreeAPI has no refresh token flow),
   sessionStorage is the right trade-off.
═══════════════════════════════════════════════════════════════ */
const TokenStore = {
    get: () => sessionStorage.getItem("auth_token"),
    set: (token) => sessionStorage.setItem("auth_token", token),
    clear: () => sessionStorage.removeItem("auth_token"),
    exists: () => !!sessionStorage.getItem("auth_token"),
};

/* ═══════════════════════════════════════════════════════════════
   API LAYER — no credentials: 'include'
   Attach Bearer token from store on every request.
═══════════════════════════════════════════════════════════════ */
async function apiFetch(path, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };

    const token = TokenStore.get();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
        const msg = data?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data;
}

/* ═══════════════════════════════════════════════════════════════════
   AUTH HANDLERS
═══════════════════════════════════════════════════════════════════ */

// REGISTER
async function handleRegister() {
    const btn = $("btn-register");
    const payload = {
        username: $("reg-username").value.trim(),
        email: $("reg-email").value.trim(),
        password: $("reg-password").value,
        role: $("reg-role").value,
    };

    // Basic client-side validation
    if (!payload.username || !payload.email || !payload.password) {
        toast("error", "All fields are required.");
        return;
    }
    if (payload.password.length < 6) {
        toast("error", "Password must be at least 6 characters.");
        return;
    }

    setLoading(btn, true);
    try {
        const data = await apiFetch("/register", "POST", payload);
        toast("success", data.message ?? "Account created! Please log in.");
        // Clear fields and redirect to login
        ["reg-username", "reg-email", "reg-password"].forEach(
            (id) => ($(id).value = ""),
        );
        showView("login");
    } catch (err) {
        toast("error", err.message);
    } finally {
        setLoading(btn, false);
    }
}

// LOGIN
async function handleLogin() {
    const btn = $("btn-login");
    const payload = {
        username: $("login-username").value.trim(),
        password: $("login-password").value,
    };

    if (!payload.username || !payload.password) {
        toast("error", "Username and password required.");
        return;
    }

    setLoading(btn, true);
    try {
        const data = await apiFetch("/login", "POST", payload);

        // FreeAPI returns tokens in data.data.accessToken
        const token = data?.data?.accessToken;
        if (!token)
            throw new Error(
                "No access token in response — check API contract.",
            );

        TokenStore.set(token);
        state.user = data.data?.user ?? null;

        toast("success", data.message ?? "Logged in.");
        showView("dashboard");
        fetchCurrentUser();
    } catch (err) {
        toast("error", err.message);
    } finally {
        setLoading(btn, false);
    }
}

// LOGOUT
async function handleLogout() {
    const btn = $("btn-logout");
    setLoading(btn, true);

    try {
        await apiFetch("/logout", "POST");
    } catch (err) {
        console.warn("Logout API call failed:", err.message);
    }

    // Clear auth state
    TokenStore.clear();
    state.user = null;
    state.rawResponse = null;

    // Reset sidebar to default tab
    document
        .querySelectorAll(".sidebar-item[data-section]")
        .forEach((b) => b.classList.remove("active"));
    document
        .querySelector('.sidebar-item[data-section="profile"]')
        ?.classList.add("active");
    document
        .querySelectorAll(".dash-section")
        .forEach((s) => s.classList.remove("active"));
    $("section-profile")?.classList.add("active");

    // Re-enable before DOM switch
    setLoading(btn, false);

    showView("login");
    toast("success", "Logged out.");
}

/* ═══════════════════════════════════════════════════════════════════
   CURRENT USER
═══════════════════════════════════════════════════════════════════ */
async function fetchCurrentUser() {
    renderProfileSkeleton();
    try {
        const data = await apiFetch("/current-user");
        state.user = data.data;
        state.rawResponse = data;
        updateStatusBar(true);
        renderProfile(state.user);
        renderRaw(state.rawResponse);
        $("dash-sub").textContent =
            `Last fetched: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        toast("error", `Session fetch failed: ${err.message}`);
        // Treat as unauthenticated
        showView("login");
    }
}

/* ═══════════════════════════════════════════════════════════════════
   RENDER HELPERS
═══════════════════════════════════════════════════════════════════ */
function renderProfileSkeleton() {
    $("profile-hero").innerHTML = `
    <div class="info-card" style="margin-bottom:16px;">
      <div class="skeleton" style="width:72px;height:72px;border-radius:50%;margin-bottom:12px;"></div>
      <div class="skeleton" style="width:180px;height:22px;margin-bottom:8px;"></div>
      <div class="skeleton" style="width:220px;height:14px;"></div>
    </div>`;
    $("profile-cards").innerHTML = "";
}

function getInitials(name) {
    if (!name) return "?";
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function renderProfile(user) {
    if (!user) return;

    // Hero block
    $("profile-hero").innerHTML = `
    <div class="info-card" style="margin-bottom:16px; display:flex; align-items:center; gap:20px;">
      <div class="avatar-lg">${getInitials(user.username ?? user.email)}</div>
      <div>
        <div class="user-name-lg">${user.username ?? "—"}</div>
        <div class="user-email-sm">${user.email ?? "—"}</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <span class="badge badge-role">${user.role ?? "USER"}</span>
          <span class="badge badge-active">● Active</span>
        </div>
      </div>
    </div>`;

    // Info cards
    const cards = [
        {
            label: "Identity",
            rows: [
                { key: "User ID", val: user._id ?? user.id ?? "—" },
                { key: "Username", val: user.username ?? "—" },
                { key: "Email", val: user.email ?? "—" },
            ],
        },
        {
            label: "Account",
            rows: [
                {
                    key: "Role",
                    val: `<span class="badge badge-role">${user.role ?? "—"}</span>`,
                },
                {
                    key: "Verified",
                    val: user.isEmailVerified
                        ? '<span class="badge badge-active">Yes</span>'
                        : "No",
                },
                { key: "Login Type", val: user.loginType ?? "EMAIL_PASSWORD" },
            ],
        },
    ];

    $("profile-cards").innerHTML = cards
        .map(
            (c) => `
    <div class="info-card">
      <div class="info-card-label">${c.label}</div>
      ${c.rows
          .map(
              (r) => `
        <div class="info-row">
          <span class="info-key">${r.key}</span>
          <span class="info-val">${r.val}</span>
        </div>`,
          )
          .join("")}
    </div>`,
        )
        .join("");
}

function renderRaw(data) {
    $("json-output").textContent = JSON.stringify(data, null, 2);
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD SECTION TABS
═══════════════════════════════════════════════════════════════════ */
document.querySelectorAll(".sidebar-item[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
        // Update active sidebar item
        document
            .querySelectorAll(".sidebar-item[data-section]")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Show correct section
        const target = btn.dataset.section;
        document
            .querySelectorAll(".dash-section")
            .forEach((s) => s.classList.remove("active"));
        $(`section-${target}`).classList.add("active");
    });
});

/* ═══════════════════════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════════════════════ */
$("btn-login").addEventListener("click", handleLogin);
$("btn-register").addEventListener("click", handleRegister);
$("btn-logout").addEventListener("click", handleLogout);
$("btn-refresh").addEventListener("click", fetchCurrentUser);

// Allow Enter key submission on login
$("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
});
$("reg-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleRegister();
});

// View navigation
$("goto-register").addEventListener("click", () => showView("register"));
$("goto-login").addEventListener("click", () => showView("login"));

/* ═══════════════════════════════════════════════════════════════════
   INIT — try to restore session on page load via current-user call.
   If the server-side session cookie is still valid, we skip login.
═══════════════════════════════════════════════════════════════════ */
(async function init() {
    if (!TokenStore.exists()) {
        showView("login");
        return;
    }
    try {
        const data = await apiFetch("/current-user");
        state.user = data.data;
        state.rawResponse = data;
        showView("dashboard");
        renderProfile(state.user);
        renderRaw(state.rawResponse);
        $("dash-sub").textContent =
            `Session restored · ${new Date().toLocaleTimeString()}`;
    } catch {
        // Token expired or invalid — clear it and force re-login
        TokenStore.clear();
        showView("login");
    }
})();
