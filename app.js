
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

    stopCalendarRealtime();
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
$("mobile-logout-button")?.addEventListener("click", handleLogout);
$("settings-logout-button")?.addEventListener("click", handleLogout);

// Pulihkan sesi saat halaman dibuka ulang.
async function initializeAuth() {
  if (
    SUPABASE_PUBLISHABLE_KEY === "TEMPEL_PUBLISHABLE_KEY_DI_SINI"
  ) {
    showScreen("auth-screen");
    showAuthMessage(
      "Konfigurasi belum selesai. Masukkan publishable key Supabase di app.js."
    );
    return;
  }

  let session = null;

  // Pisahkan kegagalan membaca sesi dari kegagalan memuat data workspace.
  // Error workspace tidak boleh membuat pengguna yang masih login kembali ke form login.
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    session = data.session;
  } catch (error) {
    console.error("Pemeriksaan sesi login gagal:", error);
    showScreen("auth-screen");
    setAuthMode("login");
    showAuthMessage(
      "Sesi login belum dapat diperiksa. Periksa koneksi internet lalu muat ulang halaman."
    );
    return;
  }

  if (!session?.user) {
    currentUser = null;
    showScreen("auth-screen");
    setAuthMode("login");
    return;
  }

  currentUser = session.user;

  try {
    await afterLogin();
  } catch (error) {
    console.error("Sesi pulih, tetapi data workspace gagal dimuat:", error);

    // Pertahankan sesi aktif dan tampilkan pemilih workspace sebagai fallback.
    showScreen("workspace-screen");
    showToast(
      "Sesi login masih aktif, tetapi data workspace gagal dimuat. Periksa koneksi lalu coba lagi.",
      "error"
    );
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showScreen("auth-screen");
    showToast("Silakan lanjutkan proses pemulihan password.");
  }

  if (event === "SIGNED_OUT") {
    stopCalendarRealtime();
    currentUser = null;
    currentWorkspace = null;
    projects = [];
    showScreen("auth-screen");
  }
});

initializeAuth();

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
        showScreen("workspace-screen");
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
      showScreen("workspace-screen");
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
  setupCalendarRealtime(workspace.id);

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
   CATATAN UMUM WORKSPACE
========================================= */
let generalNotesRows = [];
let generalNotesCanManage = false;
let editingGeneralNoteId = null;
let generalNotesLoadToken = 0;

async function loadGeneralNotes() {
  const content = $("general-notes-content");
  if (!content) return;
  if (!currentWorkspace) {
    content.innerHTML = '<div class="empty-state"><strong>Workspace belum dibuka</strong><p>Buka workspace terlebih dahulu untuk melihat catatan umum.</p></div>';
    return;
  }

  const workspaceId = currentWorkspace.id;
  const token = ++generalNotesLoadToken;
  content.innerHTML =
    '<div class="general-notes-panel">' +
      '<div class="general-notes-heading">' +
        '<div><span class="detail-eyebrow">DOKUMENTASI WORKSPACE</span><h3>Catatan Umum</h3>' +
        '<p>Catatan bersama untuk informasi penting di workspace ini.</p></div>' +
        '<button type="button" class="primary-button" id="add-general-note-button" hidden>+ Tambah Catatan</button>' +
      '</div>' +
      '<div id="general-note-form-container"></div>' +
      '<div id="general-notes-list" class="general-notes-list"><div class="loading-state">Memuat catatan...</div></div>' +
    '</div>';

  const [roleResult, notesResult] = await Promise.all([
    supabase.rpc("workspace_role", { p_workspace_id: workspaceId }),
    supabase.from("workspace_notes")
      .select("id, workspace_id, title, content, created_by, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
  ]);

  if (token !== generalNotesLoadToken || currentWorkspace?.id !== workspaceId || !$("general-notes-content")) return;

  generalNotesCanManage = !roleResult.error && ["Owner", "Editor"].includes(roleResult.data);
  const addButton = $("add-general-note-button");
  if (addButton) addButton.hidden = !generalNotesCanManage;
  addButton?.addEventListener("click", () => renderGeneralNoteForm(null));

  const list = $("general-notes-list");
  if (!list) return;
  if (notesResult.error) {
    list.innerHTML =
      '<div class="empty-state"><strong>Catatan gagal dimuat</strong><p id="general-notes-load-error"></p>' +
      '<button type="button" class="secondary-button" id="retry-general-notes">Coba Lagi</button></div>';
    $("general-notes-load-error").textContent = getErrorMessage(notesResult.error);
    $("retry-general-notes")?.addEventListener("click", loadGeneralNotes);
    return;
  }

  generalNotesRows = notesResult.data || [];
  renderGeneralNotesList(workspaceId);
}

function renderGeneralNotesList(workspaceId) {
  const list = $("general-notes-list");
  if (!list) return;

  if (!generalNotesRows.length) {
    list.innerHTML =
      '<div class="empty-state general-notes-empty"><div class="empty-icon" aria-hidden="true">▧</div>' +
      '<strong>Belum ada catatan umum</strong><p>Tambahkan catatan pertama untuk menyimpan informasi penting workspace.</p>' +
      '</div>';
    return;
  }

  const currentName = currentUser?.user_metadata?.full_name || currentUser?.email || "Akun kamu";
  list.innerHTML = generalNotesRows.map((note) => {
    const isAuthor = String(note.created_by) === String(currentUser?.id);
    const author = isAuthor ? currentName : "Anggota " + String(note.created_by || "").slice(0, 8);
    const canEdit = generalNotesCanManage && isAuthor;
    return '<article class="general-note-card"><div class="general-note-copy">' +
      '<h4>' + escapeHtml(note.title || "Tanpa judul") + '</h4>' +
      '<p class="general-note-content">' + escapeHtml(note.content || "").replace(/\n/g, "<br>") + '</p>' +
      '<div class="general-note-meta"><span>' + escapeHtml(author) + '</span><span>' +
      escapeHtml(formatProjectNoteTimestamp(note.updated_at || note.created_at)) + '</span></div></div>' +
      ((canEdit || generalNotesCanManage) ? '<div class="general-note-actions">' +
        (canEdit ? '<button type="button" class="secondary-button" data-general-note-action="edit" data-note-id="' + escapeHtml(note.id) + '">Edit</button>' : '') +
        (generalNotesCanManage ? '<button type="button" class="secondary-button note-delete-button" data-general-note-action="delete" data-note-id="' + escapeHtml(note.id) + '">Hapus</button>' : '') +
      '</div>' : '') + '</article>';
  }).join("");

  list.querySelectorAll("[data-general-note-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const note = generalNotesRows.find((item) => String(item.id) === String(button.dataset.noteId));
      if (!note) return;
      if (button.dataset.generalNoteAction === "edit") renderGeneralNoteForm(note);
      if (button.dataset.generalNoteAction === "delete") await deleteGeneralNote(note, workspaceId);
    });
  });
}

function renderGeneralNoteForm(note = null) {
  const container = $("general-note-form-container");
  if (!container || !currentWorkspace || !generalNotesCanManage) return;
  editingGeneralNoteId = note?.id || null;
  container.innerHTML =
    '<form id="general-note-form" class="general-note-form">' +
      '<div class="general-note-form-heading"><strong>' + (note ? "Edit Catatan Umum" : "Catatan Umum Baru") + '</strong>' +
      '<button type="button" class="text-button" id="cancel-general-note">Batal</button></div>' +
      '<div class="form-group"><label for="general-note-title">Judul catatan</label>' +
      '<input id="general-note-title" name="title" type="text" maxlength="150" required placeholder="Contoh: Informasi workspace" value="' + escapeHtml(note?.title || "") + '"></div>' +
      '<div class="form-group"><label for="general-note-content">Isi catatan</label>' +
      '<textarea id="general-note-content" name="content" rows="5" maxlength="10000" required placeholder="Tulis informasi penting...">' + escapeHtml(note?.content || "") + '</textarea></div>' +
      '<p id="general-note-form-error" class="form-error" hidden></p>' +
      '<div class="general-note-form-actions"><button type="submit" class="primary-button" id="save-general-note">' + (note ? "Simpan Perubahan" : "Simpan Catatan") + '</button></div>' +
    '</form>';

  $("cancel-general-note")?.addEventListener("click", () => {
    editingGeneralNoteId = null;
    container.replaceChildren();
  });
  $("general-note-form")?.addEventListener("submit", saveGeneralNote);
  requestAnimationFrame(() => $("general-note-title")?.focus());
}

async function saveGeneralNote(event) {
  event.preventDefault();
  const button = $("save-general-note");
  const errorElement = $("general-note-form-error");
  const title = $("general-note-title")?.value.trim();
  const noteContent = $("general-note-content")?.value.trim();
  if (!currentUser || !currentWorkspace || !generalNotesCanManage) {
    showToast("Kamu tidak memiliki izin untuk mengelola catatan umum.", "error");
    return;
  }
  if (!title || !noteContent) {
    if (errorElement) {
      errorElement.textContent = "Judul dan isi catatan wajib diisi.";
      errorElement.hidden = false;
    }
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }
  let result;
  if (editingGeneralNoteId) {
    result = await supabase.from("workspace_notes")
      .update({ title, content: noteContent, updated_at: new Date().toISOString() })
      .eq("id", editingGeneralNoteId)
      .eq("workspace_id", currentWorkspace.id);
  } else {
    result = await supabase.from("workspace_notes").insert({
      workspace_id: currentWorkspace.id,
      title,
      content: noteContent,
      created_by: currentUser.id
    });
  }

  if (result.error) {
    if (errorElement) {
      errorElement.textContent = getErrorMessage(result.error);
      errorElement.hidden = false;
    }
    if (button) {
      button.disabled = false;
      button.textContent = editingGeneralNoteId ? "Simpan Perubahan" : "Simpan Catatan";
    }
    return;
  }

  editingGeneralNoteId = null;
  $("general-note-form-container")?.replaceChildren();
  showToast("Catatan umum berhasil disimpan.", "success");
  await loadGeneralNotes();
}

async function deleteGeneralNote(note, workspaceId) {
  if (!generalNotesCanManage) return;
  if (!window.confirm('Hapus catatan "' + (note.title || "Tanpa judul") + '"? Tindakan ini tidak dapat dibatalkan.')) return;
  const { error } = await supabase.from("workspace_notes")
    .delete()
    .eq("id", note.id)
    .eq("workspace_id", workspaceId);
  if (error) {
    showToast("Catatan umum gagal dihapus: " + getErrorMessage(error), "error");
    return;
  }
  showToast("Catatan umum berhasil dihapus.", "success");
  await loadGeneralNotes();
}



/* =========================================
   CATATAN MEETING WORKSPACE + PROYEK
========================================= */
let meetingRows = [];
let meetingCanManage = false;
let editingMeetingId = null;
let meetingLoadToken = 0;
let meetingViewProjectId = null;

function renderMeetingWorkspace() {
  const content = $("meeting-content");
  if (!content) return;
  renderMeetingPanel(content, null);
}

function renderProjectMeetings(content, project) {
  renderMeetingPanel(content, project);
}

function renderMeetingPanel(content, project) {
  const token = ++meetingLoadToken;
  meetingRows = [];
  editingMeetingId = null;
  meetingCanManage = false;
  const projectId = project?.id || null;
  meetingViewProjectId = projectId;
  content.innerHTML =
    '<div class="meeting-panel">' +
      '<div class="meeting-panel-heading"><div><span class="detail-eyebrow">DOKUMENTASI MEETING</span>' +
      '<h3>' + (project ? 'Meeting Proyek' : 'Catatan Meeting') + '</h3>' +
      '<p>' + (project ? 'Catatan rapat dan tindak lanjut untuk proyek ini.' : 'Kelola catatan meeting dari seluruh proyek di workspace.') + '</p></div>' +
      '<button type="button" class="primary-button" id="add-meeting-button" hidden>+ Catat Meeting</button></div>' +
      '<div id="meeting-form-container"></div>' +
      '<div id="meeting-list" class="meeting-list"><div class="loading-state">Memuat catatan meeting...</div></div>' +
    '</div>';
  $("add-meeting-button")?.addEventListener("click", () => renderMeetingForm(null, projectId));
  loadMeetingRecords(projectId, token);
}

async function loadMeetingRecords(projectId = null, token = meetingLoadToken) {
  const list = $("meeting-list");
  if (!list || !currentWorkspace) return;
  const workspaceId = currentWorkspace.id;
  const [roleResult, meetingsResult] = await Promise.all([
    supabase.rpc("workspace_role", { p_workspace_id: workspaceId }),
    (() => {
      let query = supabase.from("meeting_records").select("*")
        .eq("workspace_id", workspaceId)
        .order("starts_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      return query;
    })()
  ]);
  if (token !== meetingLoadToken || !document.getElementById("meeting-list") || currentWorkspace?.id !== workspaceId) return;
  meetingCanManage = !roleResult.error && ["Owner", "Editor"].includes(roleResult.data);
  const addButton = $("add-meeting-button");
  if (addButton) addButton.hidden = !meetingCanManage;
  if (meetingsResult.error) {
    list.innerHTML = '<div class="empty-state"><strong>Catatan meeting gagal dimuat</strong><p id="meeting-load-error"></p><button type="button" class="secondary-button" id="retry-meetings">Coba lagi</button></div>';
    $("meeting-load-error").textContent = getErrorMessage(meetingsResult.error);
    $("retry-meetings")?.addEventListener("click", () => loadMeetingRecords(projectId, token));
    return;
  }
  meetingRows = meetingsResult.data || [];
  renderMeetingList(projectId);
}

function renderMeetingList(projectId = null) {
  const list = $("meeting-list");
  if (!list) return;
  if (!meetingRows.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon" aria-hidden="true">▤</div><strong>Belum ada catatan meeting</strong><p>Catat agenda, hasil pembahasan, keputusan, dan tindak lanjut meeting di sini.</p>' +
      (meetingCanManage ? '<button type="button" class="primary-button" id="meeting-empty-add">+ Catat Meeting Pertama</button>' : '') + '</div>';
    $("meeting-empty-add")?.addEventListener("click", () => renderMeetingForm(null, projectId));
    return;
  }
  list.innerHTML = meetingRows.map((meeting) => {
    const project = projects.find((item) => String(item.id) === String(meeting.project_id));
    const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
    const actions = Array.isArray(meeting.action_items) ? meeting.action_items : [];
    const attachments = Array.isArray(meeting.attachments) ? meeting.attachments : [];
    const attendance = participants.length
      ? participants.map((p) => '<span class="meeting-chip">' + escapeHtml(p.name || "Peserta") + ' · ' + escapeHtml(p.attendance || "Belum diisi") + '</span>').join("")
      : '<span class="meeting-muted">Peserta belum dicatat</span>';
    const actionMarkup = actions.length
      ? '<ul class="meeting-action-list">' + actions.map((a) => '<li><strong>' + escapeHtml(a.title || "Tindak lanjut") + '</strong><span>' + escapeHtml(a.assignee || "Belum ditentukan") + (a.due_date ? ' · Tenggat ' + escapeHtml(a.due_date) : '') + '</span></li>').join("") + '</ul>'
      : '<p class="meeting-muted">Belum ada tindak lanjut.</p>';
    const attachmentMarkup = attachments.length
      ? '<div class="meeting-attachments">' + attachments.map((a) => '<button type="button" class="text-button" data-meeting-attachment="' + escapeHtml(a.path || "") + '" data-meeting-file-name="' + escapeHtml(a.name || "Lampiran") + '">📎 ' + escapeHtml(a.name || "Lampiran") + '</button>').join("") + '</div>'
      : '';
    return '<article class="meeting-card">' +
      '<div class="meeting-card-heading"><div><span class="detail-eyebrow">' + escapeHtml(formatProjectDate(meeting.starts_at)) + '</span><h4>' + escapeHtml(meeting.title) + '</h4>' +
      '<p>' + escapeHtml(project?.name || (meeting.project_id ? "Proyek tidak tersedia" : "Meeting workspace")) + (meeting.location ? ' · ' + escapeHtml(meeting.location) : '') + '</p></div>' +
      (meetingCanManage ? '<div class="meeting-card-actions"><button type="button" class="secondary-button" data-meeting-edit="' + escapeHtml(meeting.id) + '">Edit</button><button type="button" class="danger-button" data-meeting-delete="' + escapeHtml(meeting.id) + '">Hapus</button></div>' : '') + '</div>' +
      (meeting.agenda ? '<div class="meeting-section"><strong>Agenda</strong><p>' + escapeHtml(meeting.agenda) + '</p></div>' : '') +
      (meeting.discussion ? '<div class="meeting-section"><strong>Hasil pembahasan</strong><p>' + escapeHtml(meeting.discussion) + '</p></div>' : '') +
      (meeting.decisions ? '<div class="meeting-section"><strong>Keputusan meeting</strong><p>' + escapeHtml(meeting.decisions) + '</p></div>' : '') +
      '<div class="meeting-section"><strong>Peserta & kehadiran</strong><div class="meeting-chips">' + attendance + '</div></div>' +
      '<div class="meeting-section"><strong>Tindak lanjut</strong>' + actionMarkup + '</div>' +
      (attachmentMarkup ? '<div class="meeting-section"><strong>Lampiran</strong>' + attachmentMarkup + '</div>' : '') +
      '</article>';
  }).join("");
  list.querySelectorAll("[data-meeting-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const meeting = meetingRows.find((item) => item.id === button.dataset.meetingEdit);
      if (meeting) renderMeetingForm(meeting, projectId);
    });
  });
  list.querySelectorAll("[data-meeting-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteMeetingRecord(button.dataset.meetingDelete, projectId));
  });
  list.querySelectorAll("[data-meeting-attachment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { data, error } = await supabase.storage.from("project-hub-meeting-files")
        .createSignedUrl(button.dataset.meetingAttachment, 60);
      if (error || !data?.signedUrl) {
        showToast("Lampiran tidak dapat dibuka: " + getErrorMessage(error), "error");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
  });
}

function meetingDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function renderMeetingForm(meeting = null, projectId = null) {
  const container = $("meeting-form-container");
  if (!container || !currentWorkspace || !meetingCanManage) return;
  editingMeetingId = meeting?.id || null;
  const participantLines = (Array.isArray(meeting?.participants) ? meeting.participants : [])
    .map((p) => [p.name || "", p.email || "", p.attendance || "Hadir"].join(" | ")).join("\n");
  const actionLines = (Array.isArray(meeting?.action_items) ? meeting.action_items : [])
    .map((a) => [a.title || "", a.assignee || "", a.due_date || ""].join(" | ")).join("\n");
  const projectOptions = ['<option value="">Meeting workspace (tanpa proyek)</option>'].concat(
    projects.map((p) => '<option value="' + escapeHtml(p.id) + '"' +
      (String(meeting?.project_id || projectId || "") === String(p.id) ? " selected" : "") + '>' +
      escapeHtml(p.name || "Tanpa nama") + '</option>')
  ).join("");
  container.innerHTML =
    '<form id="meeting-form" class="meeting-form">' +
      '<div class="meeting-form-heading"><strong>' + (meeting ? "Edit Catatan Meeting" : "Catat Meeting Baru") + '</strong><button type="button" class="text-button" id="cancel-meeting-form">Batal</button></div>' +
      '<div class="meeting-form-grid">' +
        '<div class="form-group"><label for="meeting-title">Judul meeting *</label><input id="meeting-title" maxlength="160" required placeholder="Contoh: Evaluasi progres proyek" value="' + escapeHtml(meeting?.title || "") + '"></div>' +
        '<div class="form-group"><label for="meeting-project">Proyek terkait</label><select id="meeting-project">' + projectOptions + '</select></div>' +
        '<div class="form-group"><label for="meeting-starts">Tanggal & waktu *</label><input id="meeting-starts" type="datetime-local" required value="' + escapeHtml(meetingDateTimeLocal(meeting?.starts_at)) + '"></div>' +
        '<div class="form-group"><label for="meeting-ends">Selesai (opsional)</label><input id="meeting-ends" type="datetime-local" value="' + escapeHtml(meetingDateTimeLocal(meeting?.ends_at)) + '"></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-location">Lokasi / tautan meeting</label><input id="meeting-location" maxlength="300" placeholder="Contoh: Ruang rapat / tautan video" value="' + escapeHtml(meeting?.location || "") + '"></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-agenda">Agenda</label><textarea id="meeting-agenda" rows="3" maxlength="10000" placeholder="Topik yang dibahas...">' + escapeHtml(meeting?.agenda || "") + '</textarea></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-discussion">Hasil pembahasan</label><textarea id="meeting-discussion" rows="3" maxlength="10000" placeholder="Ringkasan pembahasan...">' + escapeHtml(meeting?.discussion || "") + '</textarea></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-decisions">Keputusan meeting</label><textarea id="meeting-decisions" rows="3" maxlength="10000" placeholder="Keputusan yang disepakati...">' + escapeHtml(meeting?.decisions || "") + '</textarea></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-participants">Peserta dan kehadiran</label><textarea id="meeting-participants" rows="4" placeholder="Satu peserta per baris: Nama | Email (opsional) | Hadir/Tidak Hadir/Izin">' + escapeHtml(participantLines) + '</textarea><small>Format: Nama | Email (opsional) | status kehadiran.</small></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-actions">Tindak lanjut</label><textarea id="meeting-actions" rows="4" placeholder="Satu tugas per baris: Tugas | Penanggung jawab | YYYY-MM-DD">' + escapeHtml(actionLines) + '</textarea><small>Format: Tugas | Nama penanggung jawab | tanggal tenggat (opsional).</small></div>' +
        '<div class="form-group meeting-form-wide"><label for="meeting-files">Lampiran file / dokumen</label><input id="meeting-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"><small>Maksimal 10 MB per file. File yang sudah ada tetap tersimpan saat mengedit.</small></div>' +
      '</div><p id="meeting-form-error" class="form-error" hidden></p>' +
      '<div class="meeting-form-actions"><button type="submit" class="primary-button" id="save-meeting-button">' + (meeting ? "Simpan Perubahan" : "Simpan Meeting") + '</button></div>' +
    '</form>';
  $("cancel-meeting-form")?.addEventListener("click", () => {
    editingMeetingId = null;
    container.replaceChildren();
  });
  $("meeting-form")?.addEventListener("submit", (event) => saveMeetingRecord(event, meeting));
  $("meeting-title")?.focus();
}

function parseMeetingLines(value, type) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (type === "participant") {
      return { name: parts[0] || "", email: parts[1] || "", attendance: parts[2] || "Hadir" };
    }
    return { title: parts[0] || "", assignee: parts[1] || "", due_date: parts[2] || "" };
  }).filter((item) => type === "participant" ? item.name : item.title);
}

async function saveMeetingRecord(event, existingMeeting = null) {
  event.preventDefault();
  const form = $("meeting-form");
  const button = $("save-meeting-button");
  const errorElement = $("meeting-form-error");
  if (!form || !currentUser || !currentWorkspace || !meetingCanManage) {
    showToast("Kamu tidak memiliki izin untuk menyimpan catatan meeting.", "error");
    return;
  }
  const title = $("meeting-title")?.value.trim();
  const starts = $("meeting-starts")?.value;
  const ends = $("meeting-ends")?.value;
  if (!title || !starts) {
    errorElement.textContent = "Judul, tanggal, dan waktu meeting wajib diisi.";
    errorElement.hidden = false;
    return;
  }
  if (ends && new Date(ends).getTime() < new Date(starts).getTime()) {
    errorElement.textContent = "Waktu selesai tidak boleh lebih awal dari waktu mulai.";
    errorElement.hidden = false;
    return;
  }
  const files = Array.from($("meeting-files")?.files || []);
  const maxBytes = 10 * 1024 * 1024;
  const tooLarge = files.find((file) => file.size > maxBytes);
  if (tooLarge) {
    errorElement.textContent = 'File "' + tooLarge.name + '" melebihi batas 10 MB.';
    errorElement.hidden = false;
    return;
  }
  const payload = {
    workspace_id: currentWorkspace.id,
    project_id: $("meeting-project")?.value || null,
    title,
    starts_at: new Date(starts).toISOString(),
    ends_at: ends ? new Date(ends).toISOString() : null,
    location: $("meeting-location")?.value.trim() || null,
    agenda: $("meeting-agenda")?.value.trim() || "",
    discussion: $("meeting-discussion")?.value.trim() || "",
    decisions: $("meeting-decisions")?.value.trim() || "",
    participants: parseMeetingLines($("meeting-participants")?.value, "participant"),
    action_items: parseMeetingLines($("meeting-actions")?.value, "action"),
    updated_at: new Date().toISOString()
  };
  button.disabled = true;
  button.textContent = "Menyimpan...";
  errorElement.hidden = true;
  let meetingId = existingMeeting?.id || null;
  let result;
  if (meetingId) {
    result = await supabase.from("meeting_records").update(payload)
      .eq("id", meetingId).eq("workspace_id", currentWorkspace.id);
  } else {
    result = await supabase.from("meeting_records")
      .insert({ ...payload, created_by: currentUser.id })
      .select("id").single();
    if (!result.error) meetingId = result.data.id;
  }
  if (result.error) {
    errorElement.textContent = getErrorMessage(result.error);
    errorElement.hidden = false;
    button.disabled = false;
    button.textContent = existingMeeting ? "Simpan Perubahan" : "Simpan Meeting";
    return;
  }
  let uploadedAttachments = Array.isArray(existingMeeting?.attachments) ? [...existingMeeting.attachments] : [];
  const uploadErrors = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "lampiran";
    const path = currentWorkspace.id + "/" + meetingId + "/" + crypto.randomUUID() + "-" + safeName;
    const upload = await supabase.storage.from("project-hub-meeting-files")
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (upload.error) {
      uploadErrors.push(file.name + ": " + getErrorMessage(upload.error));
    } else {
      uploadedAttachments.push({ name: file.name, path, size: file.size, type: file.type || "application/octet-stream" });
    }
  }
  if (files.length && uploadedAttachments.length) {
    const attachResult = await supabase.from("meeting_records")
      .update({ attachments: uploadedAttachments, updated_at: new Date().toISOString() })
      .eq("id", meetingId).eq("workspace_id", currentWorkspace.id);
    if (attachResult.error) uploadErrors.push("Metadata lampiran gagal disimpan: " + getErrorMessage(attachResult.error));
  }
  editingMeetingId = null;
  showToast(uploadErrors.length
    ? "Catatan meeting tersimpan, tetapi sebagian lampiran gagal: " + uploadErrors.join("; ")
    : (existingMeeting ? "Catatan meeting berhasil diperbarui." : "Catatan meeting berhasil disimpan."),
    uploadErrors.length ? "error" : "success");
  await loadMeetingRecords(meetingViewProjectId, meetingLoadToken);
}

async function deleteMeetingRecord(meetingId, projectId = null) {
  const meeting = meetingRows.find((item) => item.id === meetingId);
  if (!meeting || !meetingCanManage) return;
  if (!window.confirm('Hapus catatan meeting "' + meeting.title + '" beserta lampirannya? Tindakan ini tidak dapat dibatalkan.')) return;
  const attachments = Array.isArray(meeting.attachments) ? meeting.attachments : [];
  const paths = attachments.map((item) => item.path).filter(Boolean);
  if (paths.length) {
    const removeResult = await supabase.storage.from("project-hub-meeting-files").remove(paths);
    if (removeResult.error) {
      showToast("Lampiran gagal dihapus: " + getErrorMessage(removeResult.error), "error");
      return;
    }
  }
  const { error } = await supabase.from("meeting_records").delete()
    .eq("id", meetingId).eq("workspace_id", currentWorkspace.id);
  if (error) {
    showToast("Catatan meeting gagal dihapus: " + getErrorMessage(error), "error");
    return;
  }
  showToast("Catatan meeting berhasil dihapus.", "success");
  await loadMeetingRecords(projectId, meetingLoadToken);
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

  const secondaryPages = ["users", "settings"];
  const isSecondaryPage = secondaryPages.includes(page);

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  ["sidebar-more-toggle", "mobile-more-toggle"].forEach((id) => {
    const button = $(id);
    if (button) {
      button.classList.toggle("active", isSecondaryPage);
      button.setAttribute("aria-expanded", String(isSecondaryPage));
    }
  });

  const sidebarMoreMenu = $("sidebar-more-menu");
  if (sidebarMoreMenu) sidebarMoreMenu.classList.toggle("hidden", !isSecondaryPage);

  const mobileMoreMenu = $("mobile-more-menu");
  if (mobileMoreMenu) mobileMoreMenu.classList.toggle("hidden", !isSecondaryPage);

  const mobileNav = $("mobile-nav");
  if (mobileNav) mobileNav.classList.add("hidden");
  $("mobile-menu-button")?.setAttribute("aria-expanded", "false");

  const titles = {
    home: "Beranda",
    projects: "Data Proyek",
    calendar: "Kalender",
    "general-notes": "Catatan Umum",
    meetings: "Catatan Meeting",
    users: "Anggota",
    settings: "Pengaturan",
    "project-detail": "Detail Proyek"
  };

  if ($("topbar-title")) {
    $("topbar-title").textContent = titles[page] || "Project Hub";
  }

  if (page === "home" || page === "projects" || page === "calendar") {
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

  if (page === "calendar" && currentWorkspace) {
    await loadCalendarEvents();
  }

  if (page === "home" && typeof renderDashboard === "function") {
    renderDashboard();
  }

  if (page === "users" && typeof loadWorkspaceMembers === "function") {
    await loadWorkspaceMembers();
  }

  if (page === "general-notes" && typeof loadGeneralNotes === "function") {
    await loadGeneralNotes();
  }

  if (page === "meetings" && typeof renderMeetingWorkspace === "function") {
    renderMeetingWorkspace();
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

function toggleMoreMenu(buttonId, menuId) {
  const button = $(buttonId);
  const menu = $(menuId);
  if (!button || !menu) return;

  button.addEventListener("click", () => {
    const willOpen = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
}

toggleMoreMenu("sidebar-more-toggle", "sidebar-more-menu");
toggleMoreMenu("mobile-more-toggle", "mobile-more-menu");

$("mobile-menu-button")?.addEventListener("click", () => {
  const nav = $("mobile-nav");
  if (!nav) return;

  const willOpen = nav.classList.contains("hidden");
  nav.classList.toggle("hidden", !willOpen);
  $("mobile-menu-button")?.setAttribute("aria-expanded", String(willOpen));
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
  return project.status || "Perencanaan";
}

function getStatusClass(status) {
  const classes = {
    "Perencanaan": "status-not-started",
    "Sedang Dikerjakan": "status-in-progress",
    "Diarsipkan": "status-revision",
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

function renderProjectStats() {
  const total = document.getElementById("project-stat-total");
  const planning = document.getElementById("project-stat-planning");
  const active = document.getElementById("project-stat-active");
  const completed = document.getElementById("project-stat-completed");

  if (total) total.textContent = String(projects.length);
  if (planning) planning.textContent = String(projects.filter((project) => getProjectStatus(project) === "Perencanaan").length);
  if (active) active.textContent = String(projects.filter((project) => getProjectStatus(project) === "Sedang Dikerjakan").length);
  if (completed) completed.textContent = String(projects.filter((project) => getProjectStatus(project) === "Selesai").length);
}

function renderProjectCards() {
  renderProjectStats();
  const container = document.getElementById("project-list");

  if (!container) return;

  const filteredProjects = getFilteredProjects();

  if (filteredProjects.length === 0) {
    const hasProjects = projects.length > 0;
    const hasFilters = Boolean(
      document.getElementById("project-search")?.value.trim() ||
      (document.getElementById("project-status-filter")?.value || "all") !== "all"
    );

    container.innerHTML = `
      <div class="empty-state project-empty-state">
        <div class="empty-icon" aria-hidden="true">${hasProjects ? "⌕" : "▤"}</div>
        <h3>${hasProjects && hasFilters ? "Tidak ada proyek yang cocok" : "Belum ada proyek"}</h3>
        <p>${hasProjects && hasFilters
          ? "Coba ubah kata kunci atau filter status untuk menemukan proyek."
          : "Tambahkan proyek pertama untuk mulai mengelola pekerjaan."}</p>
        ${hasProjects && hasFilters
          ? '<button class="secondary-button" id="empty-reset-project-filters" type="button">Reset pencarian &amp; filter</button>'
          : '<button class="primary-button" id="empty-add-project" type="button">+ Tambah Proyek</button>'}
      </div>
    `;

    document.getElementById("empty-add-project")
      ?.addEventListener("click", () => openProjectForm());

    document.getElementById("empty-reset-project-filters")
      ?.addEventListener("click", () => {
        const search = document.getElementById("project-search");
        const status = document.getElementById("project-status-filter");
        const sort = document.getElementById("project-sort");
        if (search) search.value = "";
        if (status) status.value = "all";
        if (sort) sort.value = "updated";
        renderProjectCards();
      });

    return;
  }

  container.innerHTML = `
    <div class="project-table-wrap">
      <table class="project-table">
        <thead>
          <tr>
            <th scope="col">Proyek</th>
            <th scope="col">Status</th>
            <th scope="col">Terakhir diperbarui</th>
            <th scope="col" class="project-table-actions-heading">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filteredProjects.map((project) => {
            const status = getProjectStatus(project);
            const date = formatProjectDate(project.updated_at || project.created_at);
            const description = project.description?.trim() || "Belum ada deskripsi.";
            return `
              <tr>
                <td class="project-table-main">
                  <strong>${escapeHtml(project.name || "Tanpa nama")}</strong>
                  <p>${escapeHtml(description)}</p>
                </td>
                <td><span class="badge ${getStatusClass(status)}">${escapeHtml(status)}</span></td>
                <td class="project-table-date">${escapeHtml(date)}</td>
                <td class="project-table-actions">
                  <button type="button" class="text-button" data-project-open="${escapeHtml(project.id)}">Detail</button>
                  <button type="button" class="text-button" data-project-edit="${escapeHtml(project.id)}">Edit</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

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
    projects = [];
    renderProjectStats();
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
    renderProjectStats();

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


/* =========================================
   DETAIL PROYEK
   Data tetap menggunakan tabel projects yang ada.
========================================= */
let activeProject = null;
let activeProjectTab = "info";

function openProjectDetail(project) {
  if (!project) {
    showToast("Data proyek tidak ditemukan.", "error");
    return;
  }

  activeProject = project;
  activeProjectTab = "info";
  renderProjectDetail();
  navigateTo("project-detail");
}

function renderProjectDetail() {
  if (!activeProject) return;

  const title = $("detail-project-title");
  const description = $("detail-project-description");
  const content = $("project-detail-content");

  if (title) title.textContent = activeProject.name || "Tanpa nama";
  if (description) {
    description.textContent = activeProject.description || "Belum ada deskripsi proyek.";
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === activeProjectTab;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  if (!content) return;

  if (activeProjectTab === "info") {
    content.innerHTML = `
      <div class="project-detail-info">
        <div class="detail-info-heading">
          <div>
            <span class="detail-eyebrow">INFORMASI PROYEK</span>
            <h3>${escapeHtml(activeProject.name || "Tanpa nama")}</h3>
          </div>
          <span class="badge ${getStatusClass(getProjectStatus(activeProject))}">
            ${escapeHtml(getProjectStatus(activeProject))}
          </span>
        </div>
        <div class="detail-info-grid">
          <div class="detail-info-item">
            <span>Deskripsi</span>
            <p>${escapeHtml(activeProject.description || "Belum ada deskripsi.")}</p>
          </div>
          <div class="detail-info-item">
            <span>Dibuat</span>
            <p>${escapeHtml(formatProjectDate(activeProject.created_at))}</p>
          </div>
          <div class="detail-info-item">
            <span>Terakhir diperbarui</span>
            <p>${escapeHtml(formatProjectDate(activeProject.updated_at || activeProject.created_at))}</p>
          </div>
        </div>
        <div class="detail-next-step">
          <strong>Langkah berikutnya</strong>
          <p>Mulai dari menyusun daftar fitur. Bagian lain tetap bisa dikelola kapan saja.</p>
          <button type="button" class="primary-button" id="detail-start-features">Buka daftar fitur</button>
        </div>
      </div>
    `;
    $("detail-start-features")?.addEventListener("click", () => {
      setProjectDetailTab("features");
    });
    return;
  }

  if (activeProjectTab === "features") {
    renderProjectFeatures(content, activeProject);
    return;
  }

  if (activeProjectTab === "notes") {
    renderProjectNotes(content, activeProject);
    return;
  }

  if (activeProjectTab === "meetings") {
    renderProjectMeetings(content, activeProject);
    return;
  }

  const tabMessages = {
    revisions: {
      title: "Riwayat revisi",
      description: "Catat permintaan revisi dan perkembangan perbaikannya.",
      note: "Tab Revisi akan disambungkan pada tahap berikutnya."
    },
  };

  const selectedTab = tabMessages[activeProjectTab];
  if (selectedTab) {
    content.innerHTML = `
      <div class="project-detail-placeholder">
        <span class="detail-eyebrow">DETAIL PROYEK</span>
        <h3>${escapeHtml(selectedTab.title)}</h3>
        <p>${escapeHtml(selectedTab.description)}</p>
        <div class="inline-notice">${escapeHtml(selectedTab.note)}</div>
      </div>
    `;
  }
}


let projectNotesRows = [];
let projectNotesLoadToken = 0;
let projectNotesCanManage = false;
let editingProjectNoteId = null;

function renderProjectNotes(content, project) {
  const token = ++projectNotesLoadToken;
  projectNotesRows = [];
  projectNotesCanManage = false;
  editingProjectNoteId = null;

  content.innerHTML =
    '<div class="project-notes-panel">' +
      '<div class="project-notes-heading">' +
        '<div><span class="detail-eyebrow">DOKUMENTASI PROYEK</span>' +
        '<h3>Catatan Proyek</h3>' +
        '<p>Simpan informasi penting yang berkaitan dengan proyek ini.</p></div>' +
        '<button type="button" class="primary-button" id="add-project-note-button" hidden>+ Tambah Catatan</button>' +
      '</div>' +
      '<div id="project-note-form-container"></div>' +
      '<div id="project-notes-list" class="project-notes-list"><div class="loading-state">Memuat catatan proyek...</div></div>' +
    '</div>';

  $("add-project-note-button")?.addEventListener("click", () => renderProjectNoteForm(null));
  loadProjectNotes(project.id, token);
}

async function loadProjectNotes(projectId, token = projectNotesLoadToken) {
  const container = $("project-notes-list");
  if (!container) return;

  const [roleResult, notesResult] = await Promise.all([
    supabase.rpc("project_access_role", { p_project_id: projectId }),
    supabase
      .from("project_notes")
      .select("id, project_id, feature_id, title, content, created_by, created_at, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
  ]);

  if (token !== projectNotesLoadToken || !$("project-notes-list")) return;

  projectNotesCanManage = !roleResult.error &&
    ["Owner", "Editor"].includes(roleResult.data);
  const addButton = $("add-project-note-button");
  if (addButton) addButton.hidden = !projectNotesCanManage;

  if (notesResult.error) {
    container.innerHTML =
      '<div class="empty-state"><strong>Catatan gagal dimuat</strong><p id="project-notes-load-error"></p>' +
      '<button type="button" class="secondary-button" id="retry-project-notes">Coba Lagi</button></div>';
    $("project-notes-load-error").textContent = getErrorMessage(notesResult.error);
    $("retry-project-notes")?.addEventListener("click", () => loadProjectNotes(projectId, token));
    return;
  }

  projectNotesRows = notesResult.data || [];
  renderProjectNoteList(projectId);
}

function renderProjectNoteList(projectId) {
  const container = $("project-notes-list");
  if (!container) return;

  if (!projectNotesRows.length) {
    container.innerHTML =
      '<div class="empty-state project-notes-empty"><div class="empty-icon" aria-hidden="true">▧</div>' +
      '<strong>Belum ada catatan proyek</strong><p>Tambahkan catatan pertama untuk menyimpan informasi penting proyek.</p>' +
      (projectNotesCanManage ? '<button type="button" class="primary-button" id="empty-add-project-note">+ Tambah Catatan</button>' : '') +
      '</div>';
    $("empty-add-project-note")?.addEventListener("click", () => renderProjectNoteForm(null));
    return;
  }

  const currentName = currentUser?.user_metadata?.full_name ||
    currentUser?.email || "Akun kamu";

  container.innerHTML = projectNotesRows.map((note) => {
    const isAuthor = String(note.created_by) === String(currentUser?.id);
    const author = isAuthor ? currentName : "Anggota " + String(note.created_by || "").slice(0, 8);
    const canEdit = projectNotesCanManage && isAuthor;
    const canDelete = projectNotesCanManage;
    return '<article class="project-note-card">' +
      '<div class="project-note-copy"><h4>' + escapeHtml(note.title || "Tanpa judul") + '</h4>' +
      '<p class="project-note-content">' + escapeHtml(note.content || "").replace(/\n/g, "<br>") + '</p>' +
      '<div class="project-note-meta"><span>' + escapeHtml(author) + '</span><span>' +
      escapeHtml(formatProjectNoteTimestamp(note.updated_at || note.created_at)) + '</span></div></div>' +
      ((canEdit || canDelete) ? '<div class="project-note-actions">' +
        (canEdit ? '<button type="button" class="secondary-button" data-note-action="edit" data-note-id="' + escapeHtml(note.id) + '">Edit</button>' : '') +
        (canDelete ? '<button type="button" class="secondary-button note-delete-button" data-note-action="delete" data-note-id="' + escapeHtml(note.id) + '">Hapus</button>' : '') +
      '</div>' : '') +
      '</article>';
  }).join("");

  container.querySelectorAll("[data-note-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const note = projectNotesRows.find((item) => String(item.id) === String(button.dataset.noteId));
      if (!note) return;
      if (button.dataset.noteAction === "edit") {
        renderProjectNoteForm(note);
      } else if (button.dataset.noteAction === "delete") {
        await deleteProjectNote(note, projectId);
      }
    });
  });
}

function formatProjectNoteTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderProjectNoteForm(note = null) {
  const container = $("project-note-form-container");
  if (!container || !activeProject || !projectNotesCanManage) return;

  editingProjectNoteId = note?.id || null;
  container.innerHTML =
    '<form id="project-note-form" class="project-note-form">' +
      '<div class="project-note-form-heading"><strong>' + (note ? "Edit Catatan" : "Catatan Baru") + '</strong>' +
      '<button type="button" class="text-button" id="cancel-project-note">Batal</button></div>' +
      '<div class="form-group"><label for="project-note-title">Judul catatan</label>' +
      '<input id="project-note-title" name="title" type="text" maxlength="150" required placeholder="Contoh: Keputusan rapat" value="' + escapeHtml(note?.title || "") + '"></div>' +
      '<div class="form-group"><label for="project-note-content">Isi catatan</label>' +
      '<textarea id="project-note-content" name="content" rows="5" maxlength="10000" placeholder="Tulis detail catatan..." required>' + escapeHtml(note?.content || "") + '</textarea></div>' +
      '<p id="project-note-form-error" class="form-error" hidden></p>' +
      '<div class="project-note-form-actions"><button type="submit" class="primary-button" id="save-project-note">' + (note ? "Simpan Perubahan" : "Simpan Catatan") + '</button></div>' +
    '</form>';

  $("cancel-project-note")?.addEventListener("click", () => {
    editingProjectNoteId = null;
    container.replaceChildren();
  });
  $("project-note-form")?.addEventListener("submit", saveProjectNote);
  requestAnimationFrame(() => $("project-note-title")?.focus());
}

async function saveProjectNote(event) {
  event.preventDefault();
  const form = $("project-note-form");
  const button = $("save-project-note");
  const errorElement = $("project-note-form-error");
  const title = $("project-note-title")?.value.trim();
  const noteContent = $("project-note-content")?.value.trim();

  if (!form || !currentUser || !activeProject || !currentWorkspace) {
    showToast("Buka proyek terlebih dahulu sebelum menyimpan catatan.", "error");
    return;
  }
  if (!title || !noteContent) {
    if (errorElement) {
      errorElement.textContent = "Judul dan isi catatan wajib diisi.";
      errorElement.hidden = false;
    }
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }
  if (errorElement) {
    errorElement.hidden = true;
    errorElement.textContent = "";
  }

  let result;
  if (editingProjectNoteId) {
    result = await supabase
      .from("project_notes")
      .update({ title, content: noteContent, updated_at: new Date().toISOString() })
      .eq("id", editingProjectNoteId)
      .eq("project_id", activeProject.id);
  } else {
    result = await supabase
      .from("project_notes")
      .insert({
        project_id: activeProject.id,
        feature_id: null,
        title,
        content: noteContent,
        created_by: currentUser.id
      });
  }

  if (result.error) {
    if (errorElement) {
      errorElement.textContent = getErrorMessage(result.error);
      errorElement.hidden = false;
    }
    if (button) {
      button.disabled = false;
      button.textContent = editingProjectNoteId ? "Simpan Perubahan" : "Simpan Catatan";
    }
    return;
  }

  editingProjectNoteId = null;
  $("project-note-form-container")?.replaceChildren();
  showToast("Catatan berhasil disimpan.", "success");
  await loadProjectNotes(activeProject.id);
}

async function deleteProjectNote(note, projectId) {
  if (!projectNotesCanManage) return;
  if (!window.confirm('Hapus catatan "' + (note.title || "Tanpa judul") + '"? Tindakan ini tidak dapat dibatalkan.')) return;

  const { error } = await supabase
    .from("project_notes")
    .delete()
    .eq("id", note.id)
    .eq("project_id", projectId);

  if (error) {
    showToast("Catatan gagal dihapus: " + getErrorMessage(error), "error");
    return;
  }

  showToast("Catatan berhasil dihapus.", "success");
  await loadProjectNotes(projectId);
}

let featureRows = [];
let editingFeatureId = null;
let featureLoadToken = 0;

function renderProjectFeatures(content, project) {
  const token = ++featureLoadToken;
  content.innerHTML = `
    <div class="features-panel">
      <div class="features-panel-heading">
        <div>
          <span class="detail-eyebrow">PENGEMBANGAN PROYEK</span>
          <h3>Daftar fitur</h3>
          <p>Susun kebutuhan fitur dan pantau progresnya.</p>
        </div>
        <button type="button" class="primary-button" id="add-feature-button">+ Tambah fitur</button>
      </div>
      <div id="feature-form-container"></div>
      <div id="feature-list-container" class="feature-list-container">
        <p>Memuat daftar fitur...</p>
      </div>
    </div>
  `;

  $("add-feature-button")?.addEventListener("click", () => {
    editingFeatureId = null;
    renderFeatureForm();
  });
  loadProjectFeatures(project.id, token);
}

async function loadProjectFeatures(projectId, token = featureLoadToken) {
  const container = $("feature-list-container");
  if (!container) return;

  const { data, error } = await supabase
    .from("features")
    .select("id, project_id, name, description, scope, status, assignee_id, created_by, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (token !== featureLoadToken || !document.getElementById("feature-list-container")) return;

  if (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Daftar fitur gagal dimuat</strong>
        <p>${escapeHtml(getErrorMessage(error))}</p>
        <button type="button" id="retry-load-features">Coba lagi</button>
      </div>`;
    $("retry-load-features")?.addEventListener("click", () => loadProjectFeatures(projectId, token));
    return;
  }

  featureRows = data || [];
  renderFeatureList();
}

function renderFeatureList() {
  const container = $("feature-list-container");
  if (!container) return;

  if (!featureRows.length) {
    container.innerHTML = `
      <div class="feature-empty-state">
        <span aria-hidden="true">✦</span>
        <strong>Belum ada fitur</strong>
        <p>Tambahkan fitur pertama untuk mulai merencanakan proyek ini.</p>
      </div>`;
    return;
  }

  const completed = featureRows.filter((feature) => feature.status === "Selesai").length;
  container.innerHTML = `
    <div class="feature-summary"><span>${featureRows.length} fitur</span><span>${completed} selesai</span></div>
    <div class="feature-list">
      ${featureRows.map((feature) => {
        const done = feature.status === "Selesai";
        return `
          <article class="feature-item ${done ? "is-complete" : ""}">
            <div class="feature-item-main">
              <button type="button" class="feature-status-toggle" data-feature-toggle="${escapeHtml(feature.id)}" aria-label="${done ? "Tandai belum selesai" : "Tandai selesai"}" title="${done ? "Tandai belum selesai" : "Tandai selesai"}">${done ? "✓" : "○"}</button>
              <div class="feature-item-copy">
                <h4>${escapeHtml(feature.name)}</h4>
                <p>${escapeHtml(feature.description || "Belum ada deskripsi.")}</p>
                ${feature.scope ? `<small>Cakupan: ${escapeHtml(feature.scope)}</small>` : ""}
                <span class="badge ${done ? "status-completed" : "status-pending"}">${escapeHtml(feature.status)}</span>
              </div>
            </div>
            <div class="feature-item-actions">
              <button type="button" data-feature-edit="${escapeHtml(feature.id)}">Edit</button>
              <button type="button" class="feature-delete-button" data-feature-delete="${escapeHtml(feature.id)}">Hapus</button>
            </div>
          </article>`;
      }).join("")}
    </div>`;

  container.querySelectorAll("[data-feature-toggle]").forEach((button) => {
    button.addEventListener("click", () => updateFeatureStatus(button.dataset.featureToggle));
  });
  container.querySelectorAll("[data-feature-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingFeatureId = button.dataset.featureEdit;
      renderFeatureForm(featureRows.find((feature) => feature.id === editingFeatureId));
    });
  });
  container.querySelectorAll("[data-feature-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteFeature(button.dataset.featureDelete));
  });
}

function renderFeatureForm(feature = null) {
  const container = $("feature-form-container");
  if (!container) return;

  container.innerHTML = `
    <form id="feature-form" class="feature-form">
      <h4>${feature ? "Edit fitur" : "Tambah fitur"}</h4>
      <div class="form-group">
        <label for="feature-name">Nama fitur</label>
        <input id="feature-name" name="name" maxlength="150" required value="${escapeHtml(feature?.name || "")}" placeholder="Contoh: Login pengguna">
      </div>
      <div class="form-group">
        <label for="feature-description">Deskripsi</label>
        <textarea id="feature-description" name="description" rows="3" placeholder="Jelaskan fungsi fitur">${escapeHtml(feature?.description || "")}</textarea>
      </div>
      <div class="form-group">
        <label for="feature-scope">Cakupan</label>
        <textarea id="feature-scope" name="scope" rows="2" placeholder="Batasan atau detail pekerjaan fitur">${escapeHtml(feature?.scope || "")}</textarea>
      </div>
      <div class="form-group">
        <label for="feature-status">Status</label>
        <select id="feature-status" name="status">
          <option value="Belum Dikerjakan" ${!feature || feature.status === "Belum Dikerjakan" ? "selected" : ""}>Belum Dikerjakan</option>
          <option value="Sedang Dikerjakan" ${feature?.status === "Sedang Dikerjakan" ? "selected" : ""}>Sedang Dikerjakan</option>
          <option value="Selesai" ${feature?.status === "Selesai" ? "selected" : ""}>Selesai</option>
        </select>
      </div>
      <p id="feature-form-error" class="form-error" hidden></p>
      <div class="feature-form-actions">
        <button type="button" id="cancel-feature-form">Batal</button>
        <button type="submit" class="primary-button" id="save-feature-button">Simpan fitur</button>
      </div>
    </form>`;

  $("cancel-feature-form")?.addEventListener("click", () => {
    editingFeatureId = null;
    container.innerHTML = "";
  });
  $("feature-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveFeature(feature);
  });
  $("feature-name")?.focus();
}

async function saveFeature(existingFeature = null) {
  const button = $("save-feature-button");
  const errorElement = $("feature-form-error");
  if (!currentUser || !activeProject) {
    showToast("Sesi pengguna atau proyek tidak ditemukan.", "error");
    return;
  }

  const name = $("feature-name")?.value.trim();
  const description = $("feature-description")?.value.trim() || "";
  const scope = $("feature-scope")?.value.trim() || "";
  const status = $("feature-status")?.value || "Belum Dikerjakan";

  if (!name) {
    if (errorElement) {
      errorElement.textContent = "Nama fitur wajib diisi.";
      errorElement.hidden = false;
    }
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }

  const values = { name, description, scope, status, updated_at: new Date().toISOString() };
  let result;
  if (existingFeature) {
    result = await supabase.from("features")
      .update(values)
      .eq("id", existingFeature.id)
      .eq("project_id", activeProject.id);
  } else {
    result = await supabase.from("features").insert({
      project_id: activeProject.id,
      ...values,
      created_by: currentUser.id
    });
  }

  if (result.error) {
    if (errorElement) {
      errorElement.textContent = getErrorMessage(result.error);
      errorElement.hidden = false;
    }
    if (button) {
      button.disabled = false;
      button.textContent = "Simpan fitur";
    }
    return;
  }

  editingFeatureId = null;
  $("feature-form-container").innerHTML = "";
  showToast(existingFeature ? "Fitur berhasil diperbarui." : "Fitur berhasil ditambahkan.", "success");
  await loadProjectFeatures(activeProject.id);
}

async function updateFeatureStatus(featureId) {
  if (!activeProject) return;
  const feature = featureRows.find((item) => item.id === featureId);
  if (!feature) return;

  const nextStatus = feature.status === "Selesai" ? "Belum Dikerjakan" : "Selesai";
  const { error } = await supabase.from("features")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", featureId)
    .eq("project_id", activeProject.id);

  if (error) {
    showToast("Status fitur gagal diperbarui: " + getErrorMessage(error), "error");
    return;
  }

  showToast(nextStatus === "Selesai" ? "Fitur ditandai selesai." : "Fitur ditandai belum dikerjakan.", "success");
  await loadProjectFeatures(activeProject.id);
}

async function deleteFeature(featureId) {
  if (!activeProject) return;
  const feature = featureRows.find((item) => item.id === featureId);
  if (!feature || !window.confirm(`Hapus fitur "${feature.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;

  const { error } = await supabase.from("features")
    .delete()
    .eq("id", featureId)
    .eq("project_id", activeProject.id);

  if (error) {
    showToast("Fitur gagal dihapus: " + getErrorMessage(error), "error");
    return;
  }

  showToast("Fitur berhasil dihapus.", "success");
  await loadProjectFeatures(activeProject.id);
}

function setProjectDetailTab(tab) {
  const validTabs = ["info", "features", "notes", "revisions", "meetings"];
  if (!validTabs.includes(tab)) return;
  activeProjectTab = tab;
  renderProjectDetail();
}

$("edit-project-button")?.addEventListener("click", () => {
  if (activeProject) openProjectForm(activeProject);
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setProjectDetailTab(button.dataset.tab));
});

let modalReturnFocus = null;

function openProjectForm(project = null) {
  const backdrop = document.getElementById("modal-backdrop");
  const title = document.getElementById("modal-title");
  const body = document.getElementById("modal-body");
  const footer = document.getElementById("modal-footer");

  if (!backdrop || !title || !body || !footer) {
    showToast("Komponen formulir proyek tidak ditemukan.");
    return;
  }

  if (backdrop.classList.contains("hidden")) {
    modalReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
            "Perencanaan",
            "Sedang Dikerjakan",
            "Selesai",
            "Diarsipkan"
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
  requestAnimationFrame(() => document.getElementById("project-name")?.focus());

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
  const backdrop = document.getElementById("modal-backdrop");
  if (!backdrop || backdrop.classList.contains("hidden")) return;

  backdrop.classList.add("hidden");

  const returnTarget = modalReturnFocus;
  modalReturnFocus = null;
  if (returnTarget?.isConnected) {
    requestAnimationFrame(() => returnTarget.focus());
  }
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
    // Kolom projects.code wajib diisi dan tidak memiliki default di database.
    // Buat kode unik di sisi aplikasi tanpa mengubah skema atau RLS.
    const projectCode = `PRJ-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    result = await supabase
      .from("projects")
      .insert({
        workspace_id: currentWorkspace.id,
        code: projectCode,
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

  if (existingProject && activeProject &&
      String(activeProject.id) === String(existingProject.id)) {
    activeProject = projects.find(
      (item) => String(item.id) === String(existingProject.id)
    ) || activeProject;
    renderProjectDetail();
  }

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
  const planning = projects.filter(
    (project) => getProjectStatus(project) === "Perencanaan"
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
  setText("stat-planning-projects", planning);
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


/* =========================================
   KALENDER WORKSPACE
   Data tersimpan di public.calendar_events.
   Akses tetap dibatasi oleh RLS Supabase.
========================================= */
let calendarCursor = new Date();
calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
let calendarSelectedDate = localDateKey(new Date());
let calendarEvents = [];
let editingCalendarEventId = null;
let calendarLoadToken = 0;
let calendarRealtimeChannel = null;
let calendarRealtimeWorkspaceId = null;

function stopCalendarRealtime() {
  if (calendarRealtimeChannel) {
    supabase.removeChannel(calendarRealtimeChannel);
    calendarRealtimeChannel = null;
  }
  calendarRealtimeWorkspaceId = null;
}

function setupCalendarRealtime(workspaceId) {
  if (!workspaceId || !currentUser) {
    stopCalendarRealtime();
    return;
  }
  if (String(calendarRealtimeWorkspaceId) === String(workspaceId) && calendarRealtimeChannel) return;

  stopCalendarRealtime();
  calendarRealtimeWorkspaceId = String(workspaceId);
  calendarRealtimeChannel = supabase
    .channel(`calendar-events-${workspaceId}-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "calendar_events",
        filter: `workspace_id=eq.${workspaceId}`
      },
      () => {
        // Reload only while visible; RLS still controls which rows can be read.
        if (currentWorkspace && String(currentWorkspace.id) === String(workspaceId) && currentPage === "calendar") {
          loadCalendarEvents();
        }
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("Realtime kalender belum tersambung. Data tetap dapat dimuat ulang saat membuka Kalender.");
      }
    });
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCalendarDate(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatCalendarDate(date, options = {}) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options
  }).format(date);
}

function calendarEventDateKey(event) {
  return localDateKey(new Date(event.starts_at));
}

function calendarTypeLabel(type) {
  return ({
    project: "Proyek",
    agenda: "Agenda",
    meeting: "Rapat",
    reminder: "Pengingat"
  })[type] || "Agenda";
}

function calendarTimeLabel(event) {
  if (event.all_day) return "Seharian";
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const formatTime = (date) => new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(date);
  return end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
}

function calendarEventProjectName(event) {
  if (!event.project_id) return "";
  return projects.find((project) => String(project.id) === String(event.project_id))?.name || "";
}

function renderCalendar() {
  const grid = $("calendar-grid");
  const monthLabel = $("calendar-month-label");
  const selectedLabel = $("calendar-selected-date");
  if (!grid || !monthLabel || !selectedLabel) return;

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  monthLabel.textContent = new Intl.DateTimeFormat("id-ID", {
    month: "long", year: "numeric"
  }).format(calendarCursor);

  const selectedDate = parseCalendarDate(calendarSelectedDate) || new Date();
  selectedLabel.textContent = formatCalendarDate(selectedDate, {
    weekday: "long", day: "numeric", month: "long"
  });

  const typeFilter = $("calendar-type-filter")?.value || "all";
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const todayKey = localDateKey(new Date());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = localDateKey(date);
    const inMonth = date.getMonth() === month;
    const dayEvents = calendarEvents
      .filter((event) => calendarEventDateKey(event) === key)
      .filter((event) => typeFilter === "all" || event.event_type === typeFilter)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const dots = dayEvents.slice(0, 4).map((event) =>
      `<i class="calendar-dot dot-${escapeHtml(event.event_type)}" aria-hidden="true"></i>`
    ).join("");
    const labels = dayEvents.slice(0, 2).map((event) =>
      `<span class="calendar-cell-event type-${escapeHtml(event.event_type)}">${escapeHtml(event.title)}</span>`
    ).join("");
    cells.push(`
      <button type="button" class="calendar-day ${inMonth ? "" : "outside-month"} ${key === calendarSelectedDate ? "selected" : ""} ${key === todayKey ? "is-today" : ""}"
        data-calendar-date="${key}" aria-label="${escapeHtml(formatCalendarDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}"
        aria-pressed="${String(key === calendarSelectedDate)}">
        <span class="calendar-day-number">${date.getDate()}</span>
        <span class="calendar-cell-events">${labels}</span>
        <span class="calendar-day-dots">${dots}</span>
      </button>
    `);
  }
  grid.innerHTML = cells.join("");
  grid.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarSelectedDate = button.dataset.calendarDate;
      renderCalendar();
      renderCalendarDayEvents();
    });
  });
  renderCalendarDayEvents();
}

function renderCalendarDayEvents() {
  const container = $("calendar-day-events");
  if (!container) return;
  const typeFilter = $("calendar-type-filter")?.value || "all";
  const selectedEvents = calendarEvents
    .filter((event) => calendarEventDateKey(event) === calendarSelectedDate)
    .filter((event) => typeFilter === "all" || event.event_type === typeFilter)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (!selectedEvents.length) {
    container.innerHTML = `
      <div class="calendar-empty">
        <span aria-hidden="true">✦</span>
        <strong>Belum ada agenda</strong>
        <p>Tambahkan jadwal untuk tanggal ini agar rencana workspace tetap teratur.</p>
        <button type="button" class="secondary-button" id="calendar-empty-add">+ Tambah agenda</button>
      </div>`;
    $("calendar-empty-add")?.addEventListener("click", () => openCalendarEventForm());
    return;
  }

  container.innerHTML = selectedEvents.map((event) => {
    const projectName = calendarEventProjectName(event);
    const isCreator = String(event.created_by) === String(currentUser?.id);
    return `
      <article class="calendar-event-card type-${escapeHtml(event.event_type)}">
        <div class="calendar-event-time">${escapeHtml(calendarTimeLabel(event))}</div>
        <div class="calendar-event-main">
          <div class="calendar-event-title-row">
            <span class="calendar-type-pill type-${escapeHtml(event.event_type)}">${escapeHtml(calendarTypeLabel(event.event_type))}</span>
            ${event.reminder_at ? '<span class="calendar-reminder-indicator" title="Waktu pengingat tersimpan">◷ Pengingat</span>' : ""}
          </div>
          <h4>${escapeHtml(event.title)}</h4>
          ${projectName ? `<p class="calendar-event-meta"><span aria-hidden="true">▤</span> ${escapeHtml(projectName)}</p>` : ""}
          ${event.location ? `<p class="calendar-event-meta"><span aria-hidden="true">⌖</span> ${escapeHtml(event.location)}</p>` : ""}
          ${event.description ? `<p class="calendar-event-description">${escapeHtml(event.description)}</p>` : ""}
          ${isCreator ? `<div class="calendar-event-actions"><button type="button" class="text-button" data-calendar-edit="${escapeHtml(event.id)}">Edit</button><button type="button" class="text-button danger-text" data-calendar-delete="${escapeHtml(event.id)}">Hapus</button></div>` : ""}
        </div>
      </article>`;
  }).join("");

  container.querySelectorAll("[data-calendar-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = calendarEvents.find((item) => String(item.id) === String(button.dataset.calendarEdit));
      if (event) openCalendarEventForm(event);
    });
  });
  container.querySelectorAll("[data-calendar-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = calendarEvents.find((item) => String(item.id) === String(button.dataset.calendarDelete));
      if (event) deleteCalendarEvent(event);
    });
  });
}

async function loadCalendarEvents() {
  const grid = $("calendar-grid");
  if (!currentUser || !currentWorkspace) {
    if (grid) grid.innerHTML = '<div class="empty-state"><strong>Workspace belum dibuka</strong><p>Buka workspace untuk melihat kalender.</p></div>';
    return;
  }

  const token = ++calendarLoadToken;
  if (grid) grid.innerHTML = '<div class="calendar-loading">Memuat kalender...</div>';

  const firstDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
  const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .gte("starts_at", gridStart.toISOString())
    .lt("starts_at", gridEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (token !== calendarLoadToken) return;
  if (error) {
    console.error("Kalender gagal dimuat:", error);
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state calendar-load-error">
          <strong>Kalender belum siap</strong>
          <p>${escapeHtml(/calendar_events|schema cache|relation/i.test(error.message || "")
            ? "Tabel kalender belum tersedia. Jalankan SQL pada file supabase/migrations/20261014_calendar_events.sql di SQL Editor Supabase."
            : getErrorMessage(error))}</p>
          <button id="retry-calendar-load" type="button" class="secondary-button">Coba lagi</button>
        </div>`;
      $("retry-calendar-load")?.addEventListener("click", loadCalendarEvents);
    }
    if ($("calendar-day-events")) {
      $("calendar-day-events").innerHTML = '<p class="muted">Agenda belum dapat dimuat.</p>';
    }
    return;
  }

  calendarEvents = data || [];
  renderCalendar();
}

function openCalendarEventForm(event = null) {
  if (!currentUser || !currentWorkspace) {
    showToast("Buka workspace terlebih dahulu.", "info");
    return;
  }
  if (event && String(event.created_by) !== String(currentUser.id)) {
    showToast("Hanya pembuat agenda yang dapat mengubahnya.", "error");
    return;
  }

  editingCalendarEventId = event?.id || null;
  const backdrop = $("modal-backdrop");
  const title = $("modal-title");
  const body = $("modal-body");
  const footer = $("modal-footer");
  if (!backdrop || !title || !body || !footer) {
    showToast("Formulir kalender tidak ditemukan.", "error");
    return;
  }

  const start = event ? new Date(event.starts_at) : new Date(`${calendarSelectedDate}T09:00:00`);
  const dateValue = localDateKey(start);
  const timeValue = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const reminderValue = event?.reminder_at
    ? `${localDateKey(new Date(event.reminder_at))}T${timeValue(event.reminder_at)}`
    : "";
  const projectOptions = [
    '<option value="">Tanpa proyek terkait</option>',
    ...projects.map((project) => `<option value="${escapeHtml(project.id)}" ${String(event?.project_id || "") === String(project.id) ? "selected" : ""}>${escapeHtml(project.name || "Tanpa nama")}</option>`)
  ].join("");

  title.textContent = event ? "Edit Jadwal" : "Jadwal Baru";
  body.innerHTML = `
    <form id="calendar-event-form" class="calendar-event-form">
      <div class="form-group">
        <label for="calendar-event-title">Nama kegiatan *</label>
        <input id="calendar-event-title" maxlength="160" required value="${escapeHtml(event?.title || "")}" placeholder="Contoh: Review progres aplikasi">
      </div>
      <div class="calendar-form-grid">
        <div class="form-group">
          <label for="calendar-event-type">Jenis kegiatan</label>
          <select id="calendar-event-type" required>
            ${[
              ["project","Proyek / tenggat"],
              ["agenda","Agenda"],
              ["meeting","Rapat"],
              ["reminder","Pengingat"]
            ].map(([value,label]) => `<option value="${value}" ${(event?.event_type || "agenda") === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label for="calendar-event-date">Tanggal *</label>
          <input id="calendar-event-date" type="date" required value="${dateValue}">
        </div>
        <div class="form-group">
          <label for="calendar-event-start">Jam mulai</label>
          <input id="calendar-event-start" type="time" value="${event?.all_day ? "" : timeValue(start)}">
        </div>
        <div class="form-group">
          <label for="calendar-event-end">Jam selesai</label>
          <input id="calendar-event-end" type="time" value="${event?.ends_at && !event?.all_day ? timeValue(event.ends_at) : ""}">
        </div>
      </div>
      <label class="calendar-all-day-option"><input id="calendar-event-all-day" type="checkbox" ${event?.all_day ? "checked" : ""}> Sepanjang hari</label>
      <div class="form-group">
        <label for="calendar-event-project">Proyek terkait</label>
        <select id="calendar-event-project">${projectOptions}</select>
      </div>
      <div class="form-group">
        <label for="calendar-event-location">Lokasi / tautan rapat</label>
        <input id="calendar-event-location" maxlength="240" value="${escapeHtml(event?.location || "")}" placeholder="Opsional">
      </div>
      <div class="form-group">
        <label for="calendar-event-description">Catatan</label>
        <textarea id="calendar-event-description" rows="3" maxlength="3000" placeholder="Detail tambahan (opsional)">${escapeHtml(event?.description || "")}</textarea>
      </div>
      <div class="form-group">
        <label for="calendar-event-reminder">Waktu pengingat (opsional)</label>
        <input id="calendar-event-reminder" type="datetime-local" value="${reminderValue}">
        <small class="muted">Waktu pengingat disimpan bersama agenda. Notifikasi otomatis akan menjadi tahap pengembangan berikutnya.</small>
      </div>
      <p id="calendar-event-error" class="form-error" hidden></p>
    </form>`;

  footer.innerHTML = `
    <button type="button" id="cancel-calendar-event" class="secondary-button">Batal</button>
    <button type="submit" form="calendar-event-form" id="save-calendar-event" class="primary-button">${event ? "Simpan Perubahan" : "Simpan Jadwal"}</button>`;
  backdrop.classList.remove("hidden");
  requestAnimationFrame(() => $("calendar-event-title")?.focus());

  $("cancel-calendar-event")?.addEventListener("click", closeProjectForm);
  $("calendar-event-all-day")?.addEventListener("change", (change) => {
    const disabled = change.target.checked;
    $("calendar-event-start").disabled = disabled;
    $("calendar-event-end").disabled = disabled;
  });
  $("calendar-event-all-day")?.dispatchEvent(new Event("change"));
  $("calendar-event-form")?.addEventListener("submit", saveCalendarEvent);
}

async function saveCalendarEvent(event) {
  event.preventDefault();
  const errorElement = $("calendar-event-error");
  const button = $("save-calendar-event");
  const title = $("calendar-event-title")?.value.trim();
  const type = $("calendar-event-type")?.value;
  const date = $("calendar-event-date")?.value;
  const allDay = Boolean($("calendar-event-all-day")?.checked);
  const startTime = $("calendar-event-start")?.value || "09:00";
  const endTime = $("calendar-event-end")?.value || "";
  const reminderInput = $("calendar-event-reminder")?.value || "";

  if (!title || !date || !["project", "agenda", "meeting", "reminder"].includes(type)) {
    if (errorElement) {
      errorElement.textContent = "Nama kegiatan, tanggal, dan jenis kegiatan wajib diisi.";
      errorElement.hidden = false;
    }
    return;
  }

  const startsAt = new Date(`${date}T${allDay ? "00:00" : startTime}:00`);
  let endsAt = null;
  if (allDay) {
    endsAt = new Date(`${date}T23:59:00`);
  } else if (endTime) {
    endsAt = new Date(`${date}T${endTime}:00`);
    if (endsAt < startsAt) {
      if (errorElement) {
        errorElement.textContent = "Jam selesai tidak boleh lebih awal dari jam mulai.";
        errorElement.hidden = false;
      }
      return;
    }
  }

  const reminderAt = reminderInput ? new Date(reminderInput) : null;
  if (reminderAt && Number.isNaN(reminderAt.getTime())) {
    if (errorElement) {
      errorElement.textContent = "Waktu pengingat tidak valid.";
      errorElement.hidden = false;
    }
    return;
  }

  const projectId = $("calendar-event-project")?.value || null;
  if (projectId && !projects.some((project) => String(project.id) === String(projectId))) {
    if (errorElement) {
      errorElement.textContent = "Proyek terkait tidak ditemukan di workspace ini.";
      errorElement.hidden = false;
    }
    return;
  }

  const payload = {
    workspace_id: currentWorkspace.id,
    project_id: projectId,
    title,
    event_type: type,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    all_day: allDay,
    location: $("calendar-event-location")?.value.trim() || null,
    description: $("calendar-event-description")?.value.trim() || null,
    reminder_at: reminderAt ? reminderAt.toISOString() : null,
    updated_at: new Date().toISOString()
  };

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }
  if (errorElement) {
    errorElement.hidden = true;
    errorElement.textContent = "";
  }

  let result;
  if (editingCalendarEventId) {
    result = await supabase.from("calendar_events")
      .update(payload)
      .eq("id", editingCalendarEventId)
      .eq("workspace_id", currentWorkspace.id)
      .eq("created_by", currentUser.id);
  } else {
    result = await supabase.from("calendar_events").insert({
      ...payload,
      created_by: currentUser.id
    });
  }

  if (result.error) {
    if (errorElement) {
      errorElement.textContent = getErrorMessage(result.error);
      errorElement.hidden = false;
    }
    if (button) {
      button.disabled = false;
      button.textContent = editingCalendarEventId ? "Simpan Perubahan" : "Simpan Jadwal";
    }
    return;
  }

  const savedDate = date;
  editingCalendarEventId = null;
  closeProjectForm();
  calendarCursor = new Date(Number(savedDate.slice(0, 4)), Number(savedDate.slice(5, 7)) - 1, 1);
  calendarSelectedDate = savedDate;
  showToast("Jadwal berhasil disimpan.", "success");
  await loadCalendarEvents();
}

async function deleteCalendarEvent(event) {
  if (!currentUser || String(event.created_by) !== String(currentUser.id)) {
    showToast("Hanya pembuat agenda yang dapat menghapusnya.", "error");
    return;
  }
  if (!window.confirm(`Hapus jadwal "${event.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;

  const { error } = await supabase.from("calendar_events")
    .delete()
    .eq("id", event.id)
    .eq("workspace_id", currentWorkspace.id)
    .eq("created_by", currentUser.id);
  if (error) {
    showToast("Jadwal gagal dihapus: " + getErrorMessage(error), "error");
    return;
  }
  showToast("Jadwal berhasil dihapus.", "success");
  await loadCalendarEvents();
}

$("calendar-prev-month")?.addEventListener("click", async () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  calendarSelectedDate = localDateKey(calendarCursor);
  await loadCalendarEvents();
});
$("calendar-next-month")?.addEventListener("click", async () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  calendarSelectedDate = localDateKey(calendarCursor);
  await loadCalendarEvents();
});
$("calendar-today-button")?.addEventListener("click", async () => {
  const today = new Date();
  calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  calendarSelectedDate = localDateKey(today);
  await loadCalendarEvents();
});
$("calendar-type-filter")?.addEventListener("change", renderCalendar);
$("add-calendar-event-button")?.addEventListener("click", () => openCalendarEventForm());
$("calendar-add-selected")?.addEventListener("click", () => openCalendarEventForm());


/* Filter dan pencarian proyek */
document.getElementById("project-search")
  ?.addEventListener("input", renderProjectCards);

document.getElementById("project-status-filter")
  ?.addEventListener("change", renderProjectCards);

document.getElementById("project-sort")
  ?.addEventListener("change", renderProjectCards);

/* Tutup modal dan dukungan keyboard */
document.getElementById("modal-close-button")
  ?.addEventListener("click", closeProjectForm);

document.addEventListener("keydown", (event) => {
  const backdrop = document.getElementById("modal-backdrop");
  if (!backdrop || backdrop.classList.contains("hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeProjectForm();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = Array.from(backdrop.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter((element) => element instanceof HTMLElement &&
    element.getClientRects().length > 0 &&
    element.getAttribute("aria-hidden") !== "true");

  if (focusable.length === 0) {
    event.preventDefault();
    backdrop.querySelector(".modal-card")?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && (document.activeElement === first ||
      !backdrop.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey &&
      (document.activeElement === last || !backdrop.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});

document.getElementById("modal-backdrop")
  ?.addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") {
      closeProjectForm();
    }
  });
