
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================================
   PROJECT HUB — BAGIAN 1
   Koneksi Supabase dan autentikasi
========================================= */

const SUPABASE_URL = "https://ppdbojfpgwnjxsjpiczd.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ztdupX3KWoKH3siIc6U7mQ_Yffv6prG";


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // Pertahankan sesi login saat halaman ditutup dan dibuka kembali.
      persistSession: true,
      // Perbarui token sesi secara otomatis selama sesi masih valid.
      autoRefreshToken: true,
      // Tangani callback login OAuth seperti Google.
      detectSessionInUrl: true
    }
  }
);

// Simpan workspace terakhir agar bisa dibuka kembali setelah webapp ditutup.
const LAST_WORKSPACE_STORAGE_KEY = "project_hub_last_workspace_id";

// State aplikasi yang dipakai oleh bagian berikutnya.
let currentUser = null;
let currentWorkspace = null;
let projects = [];
let currentPage = "home";
let authMode = "login";

const $ = (id) => document.getElementById(id);

/* =========================================
   UTILITAS
========================================= */

function showScreen(screenId) {
  ["auth-screen", "workspace-screen", "app-shell"].forEach((id) => {
    const element = $(id);
    if (element) element.classList.toggle("hidden", id !== screenId);
  });
}

function showToast(message, type = "info") {
  const container = $("toast-container");
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";

  if (type === "error") {
    toast.style.borderColor = "#fecaca";
  } else if (type === "success") {
    toast.style.borderColor = "#bbf7d0";
  }

  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4500);
}

function showAuthMessage(message, type = "error") {
  const element = $("auth-message");
  if (!element) return;

  element.textContent = message;
  element.classList.remove(
    "hidden",
    "alert-error",
    "alert-success",
    "alert-info"
  );
  element.classList.add(`alert-${type}`);
}

function hideAuthMessage() {
  const element = $("auth-message");
  if (element) {
    element.classList.add("hidden");
    element.textContent = "";
  }
}

function setButtonLoading(button, loading, loadingText = "Memproses...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function getErrorMessage(error) {
  const message = error?.message || "Terjadi kesalahan yang tidak diketahui.";

  if (/invalid login credentials/i.test(message)) {
    return "Email atau password salah.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Email belum diverifikasi. Periksa kotak masuk email kamu.";
  }

  if (/user already registered/i.test(message)) {
    return "Email ini sudah terdaftar. Silakan masuk.";
  }

  if (/password should be at least/i.test(message)) {
    return "Password terlalu pendek. Gunakan password yang lebih kuat.";
  }

  if (/network|fetch/i.test(message)) {
    return "Koneksi gagal. Periksa internet lalu coba lagi.";
  }

  return message;
}

/* =========================================
   TAMPILAN LOGIN DAN PENDAFTARAN
========================================= */

function setAuthMode(mode) {
  authMode = mode;
  hideAuthMessage();

  const isSignup = mode === "signup";

  if ($("auth-title")) {
    $("auth-title").textContent = isSignup
      ? "Buat akun"
      : "Masuk ke akun";
  }

  if ($("auth-description")) {
    $("auth-description").textContent = isSignup
      ? "Daftar untuk mulai menggunakan Project Hub."
      : "Masuk untuk melanjutkan ke workspace kamu.";
  }

  if ($("auth-name-group")) {
    $("auth-name-group").classList.toggle("hidden", !isSignup);
  }

  if ($("auth-name")) {
    $("auth-name").required = isSignup;
  }

  if ($("auth-password")) {
    $("auth-password").autocomplete = isSignup
      ? "new-password"
      : "current-password";
  }

  if ($("auth-submit")) {
    $("auth-submit").textContent = isSignup
      ? "Daftar"
      : "Masuk";
  }

  if ($("auth-switch-text")) {
    $("auth-switch-text").textContent = isSignup
      ? "Sudah punya akun?"
      : "Belum punya akun?";
  }

  if ($("auth-switch-button")) {
    $("auth-switch-button").textContent = isSignup
      ? "Masuk"
      : "Daftar";
  }

  if ($("forgot-password-button")) {
    $("forgot-password-button").classList.toggle("hidden", isSignup);
  }
}

/* =========================================
   PROSES LOGIN DAN PENDAFTARAN
========================================= */

async function handleAuthSubmit(event) {
  event.preventDefault();
  hideAuthMessage();

  const email = $("auth-email")?.value.trim();
  const password = $("auth-password")?.value;
  const name = $("auth-name")?.value.trim();

  if (!email || !password) {
    showAuthMessage("Email dan password wajib diisi.");
    return;
  }

  const button = $("auth-submit");
  setButtonLoading(button, true);

  try {
    if (authMode === "signup") {
      if (!name) {
        showAuthMessage("Nama lengkap wajib diisi.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        showToast("Pendaftaran berhasil.", "success");
        await afterLogin();
      } else {
        showAuthMessage(
          "Pendaftaran berhasil. Periksa email untuk verifikasi sebelum masuk.",
          "success"
        );
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      showToast("Login berhasil.", "success");
      await afterLogin();
    }
  } catch (error) {
    console.error("Autentikasi gagal:", error);
    showAuthMessage(getErrorMessage(error));
  } finally {
    setButtonLoading(button, false);
  }
}

/* =========================================
   LUPA PASSWORD
========================================= */

async function handleForgotPassword() {
  const email = $("auth-email")?.value.trim();

  if (!email) {
    showAuthMessage(
      "Masukkan email terlebih dahulu untuk menerima tautan reset password.",
      "info"
    );
    $("auth-email")?.focus();
    return;
  }

  const button = $("forgot-password-button");
  setButtonLoading(button, true, "Mengirim...");

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) throw error;

    showAuthMessage(
      "Jika email terdaftar, tautan reset password akan dikirim. Periksa kotak masuk dan folder spam.",
      "success"
    );
  } catch (error) {
    console.error("Reset password gagal:", error);
    showAuthMessage(getErrorMessage(error));
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleGoogleLogin() {
const button = $("google-login-button");

hideAuthMessage();
setButtonLoading(button, true, "Menghubungkan...");

try {
const { error } = await supabase.auth.signInWithOAuth({
provider: "google",
options: {
redirectTo: window.location.origin + window.location.pathname
}
});

if (error) throw error;

} catch (error) {
console.error("Login Google gagal:", error);
showAuthMessage(getErrorMessage(error));
setButtonLoading(button, false);
}
}

/* =========================================
   SESI LOGIN
========================================= */

async function afterLogin() {
  if (!currentUser) return;

  await loadWorkspaces(true);
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    currentUser = null;
    currentWorkspace = null;
    projects = [];
    localStorage.removeItem(LAST_WORKSPACE_STORAGE_KEY);

    showScreen("auth-screen");
    setAuthMode("login");
    $("auth-form")?.reset();

    showToast("Kamu sudah keluar dari akun.", "success");
  } catch (error) {
    console.error("Logout gagal:", error);
    showToast(getErrorMessage(error), "error");
  }
}

/* =========================================
   INISIALISASI BAGIAN 1
========================================= */

$("auth-form")?.addEventListener("submit", handleAuthSubmit);
$("google-login-button")?.addEventListener(
  "click",
  handleGoogleLogin
);

$("auth-switch-button")?.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

$("forgot-password-button")?.addEventListener(
  "click",
  handleForgotPassword
);

$("workspace-logout-button")?.addEventListener("click", handleLogout);
$("logout-button")?.addEventListener("click", handleLogout);
$("settings-logout-button")?.addEventListener("click", handleLogout);

// Periksa sesi yang masih aktif saat halaman dibuka.
async function initializeAuth() {
  try {
    if (
      SUPABASE_PUBLISHABLE_KEY === "TEMPEL_PUBLISHABLE_KEY_DI_SINI"
    ) {
      showScreen("auth-screen");
      showAuthMessage(
        "Konfigurasi belum selesai. Masukkan publishable key Supabase di app.js."
      );
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      currentUser = data.session.user;
      await afterLogin();
    } else {
      showScreen("auth-screen");
      setAuthMode("login");
    }
  } catch (error) {
    console.error("Inisialisasi autentikasi gagal:", error);
    showScreen("auth-screen");
    showAuthMessage(
      "Tidak dapat memeriksa sesi login. Periksa koneksi internet dan konfigurasi Supabase."
    );
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showScreen("auth-screen");
    showToast("Silakan lanjutkan proses pemulihan password.");
  }

  if (event === "SIGNED_OUT") {
    currentUser = null;
    currentWorkspace = null;
    projects = [];
    showScreen("auth-screen");
  }
});

initializeAuth();

function ensureDashboardWorkspacePanel() {
  const homePage = $("page-home");
  if (!homePage) return null;

  let panel = $("dashboard-workspace-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "dashboard-workspace-panel";
    panel.className = "content-card";
    panel.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Workspace Saya</h2>
          <p>Kelola ruang kerja dan anggota langsung dari dashboard.</p>
        </div>
      </div>
      <div id="dashboard-workspace-list" class="workspace-list"></div>
      <div id="dashboard-workspace-actions" class="dashboard-workspace-actions"></div>
      <div id="dashboard-workspace-create-slot"></div>
      <div id="dashboard-workspace-join-slot"></div>
    `;

    const stats = homePage.querySelector(".stats-grid");
    homePage.insertBefore(panel, stats || homePage.firstChild);
  }

  // Gunakan form workspace yang sudah ada agar tidak menduplikasi ID atau logika.
  const createCard = document.querySelector(".create-workspace-card");
  const joinCard = document.querySelector(".join-workspace-card");
  const createSlot = $("dashboard-workspace-create-slot");
  const joinSlot = $("dashboard-workspace-join-slot");

  if (createCard && createSlot && createCard.parentElement !== createSlot) {
    createSlot.appendChild(createCard);
  }
  if (joinCard && joinSlot && joinCard.parentElement !== joinSlot) {
    joinSlot.appendChild(joinCard);
  }

  return panel;
}

function renderPersonalWorkspaceDashboard(workspaces = []) {
  currentWorkspace = null;
  projects = [];

  const panel = ensureDashboardWorkspacePanel();
  if (!panel) {
    showScreen("workspace-screen");
    return;
  }

  const list = $("dashboard-workspace-list");
  const actions = $("dashboard-workspace-actions");

  if (list) {
    list.replaceChildren();

    if (workspaces.length) {
      workspaces.forEach((workspace) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workspace-option";

        const mark = document.createElement("div");
        mark.className = "brand-mark";
        mark.style.width = "40px";
        mark.style.height = "40px";
        mark.textContent = "W";

        const info = document.createElement("div");
        info.className = "workspace-info";

        const name = document.createElement("strong");
        name.textContent = workspace.name;

        const role = document.createElement("span");
        role.className = "muted small";
        role.textContent = workspace.role || "Anggota";

        info.append(name, role);

        const arrow = document.createElement("span");
        arrow.textContent = "Buka →";

        button.append(mark, info, arrow);
        button.addEventListener("click", () => openWorkspace(workspace));
        list.appendChild(button);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>Belum ada workspace</strong><p>Kamu tetap bisa menggunakan dashboard pribadi. Buat workspace jika ingin mengelola proyek bersama anggota lain.</p>";
      list.appendChild(empty);
    }
  }

  if (actions) {
    actions.replaceChildren();

    const inviteButton = document.createElement("button");
    inviteButton.type = "button";
    inviteButton.className = "secondary-button";
    inviteButton.textContent = "Kelola Anggota / Undang";
    inviteButton.addEventListener("click", () => {
      if (!currentWorkspace) {
        showToast("Buat atau buka workspace terlebih dahulu untuk mengundang anggota.", "info");
        return;
      }
      navigateTo("users");
    });

    const switchButton = document.createElement("button");
    switchButton.type = "button";
    switchButton.className = "secondary-button";
    switchButton.textContent = "Pilih Workspace";
    switchButton.addEventListener("click", async () => {
      showScreen("workspace-screen");
      await loadWorkspaces(false);
    });

    actions.append(inviteButton, switchButton);
  }

  // Dashboard pribadi tetap dapat dibuka tanpa workspace.
  if ($("sidebar-workspace-name")) $("sidebar-workspace-name").textContent = "Dashboard Pribadi";
  if ($("sidebar-workspace-role")) $("sidebar-workspace-role").textContent = "Pribadi";
  if ($("user-name")) {
    $("user-name").textContent =
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split("@")[0] ||
      "Pengguna";
  }
  if ($("user-email")) $("user-email").textContent = currentUser?.email || "";
  if ($("settings-account-email")) $("settings-account-email").textContent = currentUser?.email || "";
  if ($("user-avatar")) {
    const displayName = currentUser?.user_metadata?.full_name || currentUser?.email || "U";
    $("user-avatar").textContent = displayName.charAt(0).toUpperCase();
  }

  showScreen("app-shell");
  navigateTo("home");
}

async function loadWorkspaces(autoOpenSavedWorkspace = true) {
  const list = $("workspace-list");
  if (!currentUser || !list) return;

  list.innerHTML = `
    <div class="empty-state">
      <strong>Memuat workspace...</strong>
      <p>Mohon tunggu sebentar.</p>
    </div>
  `;

  try {
    const { data: memberships, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", currentUser.id);

    if (error) throw error;

    if (!memberships || memberships.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">▤</div>
          <strong>Belum ada workspace</strong>
          <p>Buat workspace baru atau terima undangan untuk mulai.</p>
        </div>
      `;

      if (autoOpenSavedWorkspace) {
        renderPersonalWorkspaceDashboard([]);
      }
      return;
    }

    const results = await Promise.all(
      memberships.map(async (membership) => {
        const { data: workspace, error: workspaceError } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("id", membership.workspace_id)
          .maybeSingle();

        if (workspaceError) throw workspaceError;

        return workspace
          ? {
              ...workspace,
              role: membership.role || "Viewer"
            }
          : null;
      })
    );

    const workspaces = results.filter(Boolean);

    if (workspaces.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <strong>Workspace tidak ditemukan</strong>
          <p>Periksa kembali keanggotaan workspace kamu.</p>
        </div>
      `;
      return;
    }

    // Saat login biasa, buka otomatis workspace terakhir yang masih bisa diakses.
    // Saat pengguna memilih Ganti Workspace, tampilkan daftar tanpa membuka otomatis.
    const lastWorkspaceId = localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
    const lastWorkspace = autoOpenSavedWorkspace
      ? workspaces.find((workspace) => String(workspace.id) === lastWorkspaceId)
      : null;

    if (lastWorkspace) {
      await openWorkspace(lastWorkspace);
      return;
    }

    if (autoOpenSavedWorkspace) {
      renderPersonalWorkspaceDashboard(workspaces);
      return;
    }

    list.replaceChildren();

    workspaces.forEach((workspace) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-option";

      const mark = document.createElement("div");
      mark.className = "brand-mark";
      mark.style.width = "40px";
      mark.style.height = "40px";
      mark.textContent = "W";

      const info = document.createElement("div");
      info.className = "workspace-info";

      const name = document.createElement("strong");
      name.textContent = workspace.name;

      const role = document.createElement("span");
      role.className = "muted small";
      role.textContent = workspace.role;

      info.append(name, role);

      const arrow = document.createElement("span");
      arrow.textContent = "→";

      button.append(mark, info, arrow);

      button.addEventListener("click", () => {
        openWorkspace(workspace);
      });

      list.appendChild(button);
    });
  } catch (error) {
    console.error("Gagal memuat workspace:", error);

    list.innerHTML = `
      <div class="empty-state">
        <strong>Workspace gagal dimuat</strong>
        <p id="workspace-load-error"></p>
        <button id="retry-workspaces" class="btn btn-secondary" type="button">
          Coba Lagi
        </button>
      </div>
    `;

    $("workspace-load-error").textContent = getErrorMessage(error);
    $("retry-workspaces").addEventListener("click", () => loadWorkspaces());
  }
}

/* =========================================
   MEMBUAT WORKSPACE
========================================= */

async function createWorkspace() {
  const input = $("new-workspace-name");
  const name = input?.value.trim();

  if (!currentUser) {
    showToast("Silakan masuk terlebih dahulu.", "error");
    return;
  }

  if (!name) {
    showToast("Nama workspace wajib diisi.", "error");
    input?.focus();
    return;
  }

  const button = $("create-workspace-button");
  setButtonLoading(button, true, "Membuat...");

  try {
    // Pembuatan workspace + Owner dilakukan secara atomik oleh fungsi database.
    const { data: workspace, error: workspaceError } = await supabase
      .rpc("create_workspace", { p_name: name });

    if (workspaceError) throw workspaceError;

    const createdWorkspace = Array.isArray(workspace)
      ? workspace[0]
      : workspace;

    if (!createdWorkspace?.id) {
      throw new Error("Fungsi create_workspace tidak mengembalikan ID workspace.");
    }

    input.value = "";
    showToast("Workspace berhasil dibuat.", "success");

    await openWorkspace({
      ...createdWorkspace,
      role: "Owner"
    });
  } catch (error) {
    console.error("Gagal membuat workspace:", error);
    showToast(
      "Workspace gagal dibuat: " + getErrorMessage(error),
      "error"
    );
  } finally {
    setButtonLoading(button, false);
  }
}

/* =========================================
   MEMBUKA WORKSPACE
========================================= */

async function openWorkspace(workspace) {
  if (!workspace?.id) return;

  currentWorkspace = workspace;

  // ID ini bukan akses otomatis: keanggotaan tetap diverifikasi dari Supabase.
  localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, String(workspace.id));

  if ($("sidebar-workspace-name")) {
    $("sidebar-workspace-name").textContent = workspace.name;
  }

  if ($("sidebar-workspace-role")) {
    $("sidebar-workspace-role").textContent = workspace.role || "Anggota";
  }

  if ($("user-name")) {
    $("user-name").textContent =
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split("@")[0] ||
      "Pengguna";
  }

  if ($("user-email")) {
    $("user-email").textContent = currentUser?.email || "";
  }

  if ($("settings-account-email")) {
    $("settings-account-email").textContent = currentUser?.email || "";
  }

  if ($("user-avatar")) {
    const name =
      currentUser?.user_metadata?.full_name ||
      currentUser?.email ||
      "U";

    $("user-avatar").textContent = name.charAt(0).toUpperCase();
  }

  const panel = ensureDashboardWorkspacePanel();
  if (panel) panel.classList.remove("hidden");

  const dashboardList = $("dashboard-workspace-list");
  if (dashboardList) {
    dashboardList.replaceChildren();
    const currentItem = document.createElement("div");
    currentItem.className = "workspace-option";
    const mark = document.createElement("div");
    mark.className = "brand-mark";
    mark.style.width = "40px";
    mark.style.height = "40px";
    mark.textContent = "W";
    const info = document.createElement("div");
    info.className = "workspace-info";
    const name = document.createElement("strong");
    name.textContent = workspace.name || "Workspace";
    const role = document.createElement("span");
    role.className = "muted small";
    role.textContent = workspace.role || "Anggota";
    info.append(name, role);
    currentItem.append(mark, info);
    dashboardList.appendChild(currentItem);
  }

  const dashboardActions = $("dashboard-workspace-actions");
  if (dashboardActions && !dashboardActions.dataset.ready) {
    dashboardActions.dataset.ready = "true";
    const inviteButton = document.createElement("button");
    inviteButton.type = "button";
    inviteButton.className = "secondary-button";
    inviteButton.textContent = "Kelola Anggota / Undang";
    inviteButton.addEventListener("click", () => navigateTo("users"));

    const switchButton = document.createElement("button");
    switchButton.type = "button";
    switchButton.className = "secondary-button";
    switchButton.textContent = "Pilih Workspace";
    switchButton.addEventListener("click", async () => {
      showScreen("workspace-screen");
      await loadWorkspaces(false);
    });
    dashboardActions.append(inviteButton, switchButton);
  }

  showScreen("app-shell");
  await navigateTo("home");
}

/* =========================================
   ANGGOTA WORKSPACE
========================================= */

async function loadWorkspaceMembers() {
  const container = $("users-content");
  if (!container) return;

  if (!currentUser || !currentWorkspace) {
    container.innerHTML = '<div class="empty-state"><strong>Workspace belum dibuka</strong><p>Buka atau buat workspace untuk melihat anggotanya.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loading-state">Memuat anggota workspace...</div>';

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", currentWorkspace.id)
    .order("role", { ascending: true });

  if (error) {
    console.error("Gagal memuat anggota workspace:", error);
    container.innerHTML = `
      <div class="empty-state">
        <strong>Anggota gagal dimuat</strong>
        <p>${escapeHtml(getErrorMessage(error))}</p>
        <button id="retry-load-members" class="secondary-button" type="button">Coba Lagi</button>
      </div>
    `;
    $("retry-load-members")?.addEventListener("click", loadWorkspaceMembers);
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><strong>Belum ada anggota</strong><p>Daftar anggota akan muncul di sini setelah ada anggota workspace.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="member-list-summary"><strong>${data.length} anggota</strong><p class="muted">Informasi email/nama anggota akan ditampilkan setelah profil anggota terhubung.</p></div>
    <div class="table-responsive">
      <table>
        <thead><tr><th>Anggota</th><th>Peran</th></tr></thead>
        <tbody>
          ${data.map((member) => {
            const isCurrentUser = String(member.user_id) === String(currentUser.id);
            const memberLabel = isCurrentUser
              ? (currentUser.user_metadata?.full_name || currentUser.email || member.user_id)
              : "ID: " + String(member.user_id).slice(0, 8) + "…";
            return `<tr><td><strong>${escapeHtml(memberLabel)}</strong>${isCurrentUser ? '<div class="muted small">Akun kamu</div>' : ''}</td><td><span class="badge">${escapeHtml(member.role || "Viewer")}</span></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

}

function handleInviteButtonClick() {
  if (!currentWorkspace) {
    showToast("Buka workspace terlebih dahulu.", "info");
    return;
  }

  if (currentWorkspace.role !== "Owner") {
    showToast("Peran kamu belum memiliki izin untuk mengundang anggota.", "error");
    return;
  }

  showToast("Halaman Anggota sudah aktif. Sistem undangan perlu disambungkan ke fungsi undangan aman di Supabase sebelum undangan dikirim.", "info");
}

/* =========================================
   NAVIGASI HALAMAN
========================================= */

async function navigateTo(page) {
  if (!currentWorkspace && page !== "home" && page !== "settings") {
    showToast("Buka atau buat workspace untuk menggunakan fitur ini.", "info");
    page = "home";
  }

  const target = $("page-" + page);

  if (!target) {
    showToast("Halaman tidak ditemukan: " + page, "error");
    return;
  }

  currentPage = page;

  document.querySelectorAll(".page").forEach((element) => {
    element.classList.add("hidden");
  });

  target.classList.remove("hidden");

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    home: "Beranda",
    projects: "Data Proyek",
    features: "Daftar Fitur",
    "general-notes": "Catatan Umum",
    revisions: "Riwayat Revisi",
    activities: "Aktivitas",
    users: "Anggota",
    settings: "Pengaturan",
    "project-detail": "Detail Proyek"
  };

  if ($("topbar-title")) {
    $("topbar-title").textContent = titles[page] || "Project Hub";
  }

  if (page === "home" || page === "projects") {
    if (currentWorkspace && typeof loadProjects === "function") {
      await loadProjects();
    } else if (!currentWorkspace) {
      projects = [];
      renderDashboard();
      const projectList = $("project-list");
      if (projectList) {
        projectList.innerHTML = "<div class=\"empty-state\"><strong>Dashboard pribadi</strong><p>Buat atau buka workspace untuk mulai mengelola proyek.</p></div>";
      }
    }
  }

  if (page === "home" && typeof renderDashboard === "function") {
    renderDashboard();
  }

  if (page === "users" && typeof loadWorkspaceMembers === "function") {
    await loadWorkspaceMembers();
  }

  if (page === "features" && typeof loadAllFeatures === "function") {
    await loadAllFeatures();
  }

  if (page === "general-notes" && typeof loadGeneralNotes === "function") {
    await loadGeneralNotes();
  }

  if (page === "revisions" && typeof loadRevisions === "function") {
    await loadRevisions();
  }

  if (page === "activities" && typeof loadActivities === "function") {
    await loadActivities();
  }
}

/* =========================================
   EVENT LISTENERS WORKSPACE
========================================= */

$("invite-user-button")?.addEventListener("click", handleInviteButtonClick);

$("create-workspace-button")?.addEventListener(
  "click",
  createWorkspace
);

$("workspace-switcher")?.addEventListener("click", async () => {
  showScreen("workspace-screen");
  await loadWorkspaces(false);
});

$("join-workspace-button")?.addEventListener("click", () => {
  showToast(
    "Fitur penerimaan undangan akan disambungkan setelah struktur undangan diperiksa.",
    "info"
  );
});

/* =========================================
   EVENT LISTENERS NAVIGASI
========================================= */

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});

$("mobile-menu-button")?.addEventListener("click", () => {
  const nav = $("mobile-nav");
  if (!nav) return;

  nav.classList.toggle("hidden");
});

$("home-add-project")?.addEventListener("click", () => {
  navigateTo("projects").then(() => {
    if (typeof openProjectForm === "function") {
      openProjectForm();
    }
  });
});

$("add-project-button")?.addEventListener("click", () => {
  if (typeof openProjectForm === "function") {
    openProjectForm();
  } else {
    showToast("Form proyek akan ditambahkan pada bagian berikutnya.");
  }
});

$("back-to-projects")?.addEventListener("click", () => {
  navigateTo("projects");
});

$("theme-setting")?.addEventListener("change", (event) => {
  const theme = event.target.value;

  if (theme === "dark") {
    document.documentElement.style.filter = "invert(1) hue-rotate(180deg)";
    showToast("Tema gelap sementara diterapkan.");
  } else {
    document.documentElement.style.filter = "";
    showToast("Tampilan diperbarui.");
  }
});

$("density-setting")?.addEventListener("change", (event) => {
  document.body.dataset.density = event.target.value;
});

$("notification-button")?.addEventListener("click", () => {
  showToast("Panel notifikasi akan disambungkan pada bagian berikutnya.");
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatProjectDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getProjectStatus(project) {
  return project.status || "Belum Dikerjakan";
}

function getStatusClass(status) {
  const classes = {
    "Belum Dikerjakan": "status-not-started",
    "Sedang Dikerjakan": "status-in-progress",
    "Revisi": "status-revision",
    "Selesai": "status-completed"
  };

  return classes[status] || "";
}

function getFilteredProjects() {
  const searchInput = document.getElementById("project-search");
  const statusInput = document.getElementById("project-status-filter");
  const sortInput = document.getElementById("project-sort");

  const search = (searchInput?.value || "").trim().toLowerCase();
  const selectedStatus = statusInput?.value || "all";
  const sort = sortInput?.value || "updated";

  let result = [...projects];

  result = result.filter((project) => {
    const name = String(project.name || "").toLowerCase();
    const description = String(project.description || "").toLowerCase();

    const matchesSearch =
      !search ||
      name.includes(search) ||
      description.includes(search);

    const status = getProjectStatus(project);
    const matchesStatus =
      selectedStatus === "all" ||
      status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  result.sort((a, b) => {
    const dateA = new Date(
      a.updated_at || a.created_at || 0
    ).getTime();

    const dateB = new Date(
      b.updated_at || b.created_at || 0
    ).getTime();

    if (sort === "name") {
      return String(a.name || "").localeCompare(
        String(b.name || ""),
        "id"
      );
    }

    if (sort === "oldest") {
      return dateA - dateB;
    }

    return dateB - dateA;
  });

  return result;
}

function renderProjectCards() {
  const container = document.getElementById("project-list");

  if (!container) return;

  const filteredProjects = getFilteredProjects();

  if (filteredProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Belum ada proyek</h3>
        <p>
          Proyek yang sesuai pencarian atau filter
          akan muncul di sini.
        </p>
        <button
          class="primary-button"
          id="empty-add-project"
          type="button"
        >
          + Tambah Proyek
        </button>
      </div>
    `;

    document
      .getElementById("empty-add-project")
      ?.addEventListener("click", () => openProjectForm());

    return;
  }

  container.innerHTML = filteredProjects.map((project) => {
    const status = getProjectStatus(project);
    const date = formatProjectDate(
      project.updated_at || project.created_at
    );

    return `
      <article class="project-card">
        <div class="project-card-header">
          <div>
            <h3>${escapeHtml(project.name || "Tanpa nama")}</h3>
            <span class="badge ${getStatusClass(status)}">
              ${escapeHtml(status)}
            </span>
          </div>

          <button
            type="button"
            class="icon-button"
            data-project-edit="${escapeHtml(project.id)}"
            aria-label="Edit proyek"
            title="Edit proyek"
          >✎</button>
        </div>

        <p class="project-description">
          ${escapeHtml(project.description || "Belum ada deskripsi.")}
        </p>

        <div class="project-card-footer">
          <span>Diperbarui ${escapeHtml(date)}</span>

          <button
            type="button"
            class="text-button"
            data-project-open="${escapeHtml(project.id)}"
          >
            Lihat detail →
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-project-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const project = projects.find(
        (item) => String(item.id) === button.dataset.projectEdit
      );

      if (project) openProjectForm(project);
    });
  });

  container.querySelectorAll("[data-project-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const project = projects.find(
        (item) => String(item.id) === button.dataset.projectOpen
      );

      if (!project) return;

      if (typeof openProjectDetail === "function") {
        openProjectDetail(project);
      } else {
        showToast("Detail proyek akan disambungkan pada bagian berikutnya.");
      }
    });
  });
}

async function loadProjects() {
  const container = document.getElementById("project-list");

  if (!currentUser || !currentWorkspace) {
    if (container) {
      container.innerHTML = "<p>Pilih workspace terlebih dahulu.</p>";
    }
    return;
  }

  if (container) {
    container.innerHTML = "<p>Memuat data proyek...</p>";
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", currentWorkspace.id);

  if (error) {
    projects = [];

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Proyek gagal dimuat</h3>
          <p>${escapeHtml(getErrorMessage(error))}</p>
          <button id="retry-load-projects" type="button">
            Coba Lagi
          </button>
        </div>
      `;

      document
        .getElementById("retry-load-projects")
        ?.addEventListener("click", loadProjects);
    }

    showToast("Gagal memuat proyek.");
    return;
  }

  projects = data || [];

  renderProjectCards();
  renderDashboard();
}

function openProjectForm(project = null) {
  const backdrop = document.getElementById("modal-backdrop");
  const title = document.getElementById("modal-title");
  const body = document.getElementById("modal-body");
  const footer = document.getElementById("modal-footer");

  if (!backdrop || !title || !body || !footer) {
    showToast("Komponen formulir proyek tidak ditemukan.");
    return;
  }

  const isEditing = Boolean(project);

  title.textContent = isEditing ? "Edit Proyek" : "Tambah Proyek";

  body.innerHTML = `
    <form id="project-form">
      <div class="form-group">
        <label for="project-name">Nama Proyek</label>
        <input
          id="project-name"
          name="name"
          type="text"
          maxlength="150"
          required
          placeholder="Masukkan nama proyek"
          value="${escapeHtml(project?.name || "")}"
        >
      </div>

      <div class="form-group">
        <label for="project-description">Deskripsi</label>
        <textarea
          id="project-description"
          name="description"
          rows="4"
          placeholder="Jelaskan proyek ini"
        >${escapeHtml(project?.description || "")}</textarea>
      </div>

      <div class="form-group">
        <label for="project-status">Status</label>
        <select id="project-status" name="status" required>
          ${[
            "Belum Dikerjakan",
            "Sedang Dikerjakan",
            "Revisi",
            "Selesai"
          ].map((status) => `
            <option
              value="${escapeHtml(status)}"
              ${getProjectStatus(project || {}) === status ? "selected" : ""}
            >${escapeHtml(status)}</option>
          `).join("")}
        </select>
      </div>

      <p id="project-form-error" class="form-error" hidden></p>
    </form>
  `;

  footer.innerHTML = `
    <button type="button" id="cancel-project-form">
      Batal
    </button>
    <button type="submit" form="project-form" id="save-project-button">
      ${isEditing ? "Simpan Perubahan" : "Buat Proyek"}
    </button>
  `;

  backdrop.classList.remove("hidden");

  document
    .getElementById("cancel-project-form")
    ?.addEventListener("click", closeProjectForm);

  document
    .getElementById("project-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveProject(project);
    });
}

function closeProjectForm() {
  document.getElementById("modal-backdrop")?.classList.add("hidden");
}

async function saveProject(existingProject = null) {
  const form = document.getElementById("project-form");
  const saveButton = document.getElementById("save-project-button");
  const errorElement = document.getElementById("project-form-error");

  if (!form || !currentUser || !currentWorkspace) {
    showToast("Pilih workspace sebelum menyimpan proyek.");
    return;
  }

  const name = document.getElementById("project-name")?.value.trim();
  const description =
    document.getElementById("project-description")?.value.trim() || "";
  const status = document.getElementById("project-status")?.value;

  if (!name) {
    if (errorElement) {
      errorElement.textContent = "Nama proyek wajib diisi.";
      errorElement.hidden = false;
    }
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Menyimpan...";
  }

  if (errorElement) {
    errorElement.hidden = true;
    errorElement.textContent = "";
  }

  let result;

  if (existingProject) {
    result = await supabase
      .from("projects")
      .update({
        name,
        description,
        status
      })
      .eq("id", existingProject.id)
      .eq("workspace_id", currentWorkspace.id);
  } else {
    result = await supabase
      .from("projects")
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        description,
        status,
        created_by: currentUser.id
      });
  }

  if (result.error) {
    if (errorElement) {
      errorElement.textContent = getErrorMessage(result.error);
      errorElement.hidden = false;
    }

    showToast("Proyek gagal disimpan. Periksa pesan pada formulir.");

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = existingProject
        ? "Simpan Perubahan"
        : "Buat Proyek";
    }

    return;
  }

  closeProjectForm();
  showToast(existingProject ? "Proyek berhasil diperbarui." : "Proyek berhasil dibuat.");

  await loadProjects();

  if (!existingProject) {
    const createdProject = projects.find(
      (item) => item.name === name
    );

    if (createdProject && typeof openProjectDetail === "function") {
      openProjectDetail(createdProject);
    } else {
      await navigateTo("projects");
    }
  }
}

function renderDashboard() {
  const total = projects.length;
  const active = projects.filter(
    (project) => getProjectStatus(project) === "Sedang Dikerjakan"
  ).length;
  const revision = projects.filter(
    (project) => getProjectStatus(project) === "Revisi"
  ).length;
  const completed = projects.filter(
    (project) => getProjectStatus(project) === "Selesai"
  ).length;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };

  setText("stat-total-projects", total);
  setText("stat-active-projects", active);
  setText("stat-revision-projects", revision);
  setText("stat-completed-projects", completed);

  const recentContainer = document.getElementById("recent-projects");

  if (recentContainer) {
    const recent = [...projects]
      .sort((a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
      )
      .slice(0, 5);

    recentContainer.innerHTML = recent.length
      ? recent.map((project) => `
          <div class="recent-project-item">
            <div class="recent-project-leading">
              <span class="recent-project-icon" aria-hidden="true">▤</span>
              <div class="recent-project-copy">
                <strong>${escapeHtml(project.name || "Tanpa nama")}</strong>
                <small>Proyek workspace</small>
              </div>
            </div>
            <span class="badge ${getStatusClass(getProjectStatus(project))}">
              ${escapeHtml(getProjectStatus(project))}
            </span>
          </div>
        `).join("")
       : "<p>Belum ada proyek. Buat proyek pertamamu untuk memulai.</p>";
  }
}

/* Filter dan pencarian proyek */
document.getElementById("project-search")
  ?.addEventListener("input", renderProjectCards);

document.getElementById("project-status-filter")
  ?.addEventListener("change", renderProjectCards);

document.getElementById("project-sort")
  ?.addEventListener("change", renderProjectCards);

/* Tutup modal */
document.getElementById("modal-close-button")
  ?.addEventListener("click", closeProjectForm);

document.getElementById("modal-backdrop")
  ?.addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") {
      closeProjectForm();
    }
  });
