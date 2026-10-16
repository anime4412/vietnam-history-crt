// ==============================================================================
// admin.js - BỘ ĐIỀU HÀNH LOGIC TRUNG TÂM QUẢN TRỊ BẢO TÀNG LỊCH SỬ (ADMIN CMS)
// Dự án: Vietnam History CRT Experience
// ==============================================================================
// Chức năng:
// 1. Quản lý trạng thái xác thực bảo mật (Admin PIN)
// 2. Giao tiếp hai chiều với hệ thống REST API (/api/data, /api/relics, /api/tapes, /api/settings)
// 3. Thực hiện đầy đủ các thao tác CRUD (Thêm, Xem, Sửa, Xóa) cho Bảo vật Quốc gia và Cuộn băng
// 4. Đồng bộ tức thì với không gian 3D Three.js và trang Bảo tàng số 2D
// 5. Quản lý sao lưu (Export JSON) và phục hồi cơ sở dữ liệu (Import JSON)
// ==============================================================================

// Biến lưu trữ trạng thái cục bộ
const state = {
  settings: {},
  relics: [],
  tapes: [],
  filterRelicQuery: ""
};

// ==============================================================================
// 1. KHỞI TẠO HỆ THỐNG KHI TẢI TRANG
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initTabs();
  initModals();
  initRelicEvents();
  initTapeEvents();
  initSettingsEvents();
  initBackupEvents();

  // Kiểm tra phiên đăng nhập đã có từ trước chưa
  const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
  const authModal = document.getElementById("authModal");
  if (token) {
    if (authModal) {
      authModal.hidden = true;
      authModal.style.display = "none";
    }
    loadAllData();
  } else {
    showAuthModal();
  }
});

// ==============================================================================
// 2. QUẢN LÝ BẢO MẬT & ĐĂNG NHẬP (PIN LOCK)
// ==============================================================================
function initAuth() {
  const authModal = document.getElementById("authModal");
  const authForm = document.getElementById("authForm");
  const authPinInput = document.getElementById("authPinInput");
  const authErrorMsg = document.getElementById("authErrorMsg");
  const btnLogout = document.getElementById("btnLogout");

  // Xử lý gửi biểu mẫu đăng nhập
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = authPinInput.value.trim();
    if (!pin) return;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("admin_token", data.token);
        sessionStorage.setItem("admin_token", data.token);
        authModal.hidden = true;
        authModal.style.display = "none";
        authErrorMsg.hidden = true;
        authErrorMsg.style.display = "none";
        authPinInput.value = "";
        showToast("Mở khóa hệ thống quản trị thành công!", "success");
        loadAllData();
      } else {
        authErrorMsg.textContent = data.message || "Mã PIN không đúng!";
        authErrorMsg.hidden = false;
        authErrorMsg.style.display = "block";
        authPinInput.select();
      }
    } catch (err) {
      // Chế độ chạy Offline / Không có server Node.js: kiểm tra cục bộ mã pin mặc định
      if (pin === "admin123") {
        localStorage.setItem("admin_token", "local-token");
        sessionStorage.setItem("admin_token", "local-token");
        authModal.hidden = true;
        authModal.style.display = "none";
        showToast("Đăng nhập thành công (Chế độ cục bộ)!", "success");
        loadAllData();
      } else {
        authErrorMsg.textContent = "Không thể kết nối đến máy chủ API.";
        authErrorMsg.hidden = false;
        authErrorMsg.style.display = "block";
      }
    }
  });

  // Xử lý nút Đăng xuất / Khóa hệ thống
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    showAuthModal();
    showToast("Đã khóa bảng điều khiển bảo tàng.", "info");
  });
}

function showAuthModal() {
  const authModal = document.getElementById("authModal");
  const authPinInput = document.getElementById("authPinInput");
  authModal.hidden = false;
  authModal.style.display = "flex";
  setTimeout(() => authPinInput.focus(), 100);
}

// ==============================================================================
// 2.5 BỘ TRUYỀN TẢI YÊU CẦU BẢO MẬT (SECURE AUTH FETCH WRAPPER WITH BEARER TOKEN)
// ==============================================================================
async function authFetch(url, options = {}) {
  const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  options.headers = headers;

  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    showAuthModal();
    showToast("Phiên đăng nhập đã hết hạn hoặc chưa xác thực. Vui lòng mở khóa lại!", "error");
  }
  return res;
}

// ==============================================================================
// 3. TẢI DỮ LIỆU TỪ MÁY CHỦ (FETCH API DATA)
// ==============================================================================
async function loadAllData() {
  try {
    const res = await fetch("/api/data");
    const json = await res.json();

    if (json.success) {
      state.settings = json.settings || {};
      state.relics = json.relics || [];
      state.tapes = json.tapes || [];

      updateKpis();
      renderRelicsTable();
      renderTapesTable();
      populateSettingsForm();
    }
  } catch (err) {
    console.warn("Chưa chạy qua server.js, tải dữ liệu từ tệp cục bộ:", err);
    // Tải dự phòng nếu mở trực tiếp bằng live server
    try {
      const module = await import("./vietnam-history-data.js");
      state.relics = module.VIETNAM_RELICS || [];
      state.tapes = module.VIETNAM_TAPES || [];
      updateKpis();
      renderRelicsTable();
      renderTapesTable();
    } catch (e) {
      showToast("Lỗi nạp dữ liệu lịch sử", "error");
    }
  }
}

// Cập nhật các thẻ số liệu thống kê nhanh (KPIs)
function updateKpis() {
  document.getElementById("kpiRelicNum").textContent = state.relics.length;
  document.getElementById("kpiTapeNum").textContent = state.tapes.length;
  document.getElementById("badgeRelicCount").textContent = String(state.relics.length).padStart(2, "0");
  document.getElementById("badgeTapeCount").textContent = String(state.tapes.length).padStart(2, "0");

  const videoCount = state.tapes.filter(t => t.videoUrl && t.videoUrl.trim() !== "").length;
  document.getElementById("kpiVideoNum").textContent = videoCount;
}

// ==============================================================================
// 4. QUẢN LÝ CHUYỂN TAB ĐIỀU HƯỚNG
// ==============================================================================
function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetPaneId = tab.getAttribute("data-tab");
      switchTab(targetPaneId);
    });
  });

  // Các nút chuyển nhanh trên màn hình tổng quan
  document.getElementById("qaGoRelics")?.addEventListener("click", () => switchTab("tab-relics"));
  document.getElementById("qaGoTapes")?.addEventListener("click", () => switchTab("tab-tapes"));
  document.getElementById("qaGo3D")?.addEventListener("click", () => window.open("index.html", "_blank"));
  document.getElementById("btnQuickAddRelic")?.addEventListener("click", () => {
    switchTab("tab-relics");
    openRelicModal();
  });
}

function switchTab(paneId) {
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === paneId);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === paneId);
  });
}

// ==============================================================================
// 5. QUẢN LÝ BẢO VẬT QUỐC GIA (RELICS CRUD)
// ==============================================================================
function initRelicEvents() {
  const btnOpenAddRelic = document.getElementById("btnOpenAddRelicModal");
  const relicSearchInput = document.getElementById("relicSearchInput");
  const relicForm = document.getElementById("relicForm");
  const btnAddNoteRow = document.getElementById("btnAddNoteRow");

  btnOpenAddRelic.addEventListener("click", () => openRelicModal());

  // Tìm kiếm tức thì trong bảng bảo vật
  relicSearchInput.addEventListener("input", (e) => {
    state.filterRelicQuery = e.target.value.toLowerCase().trim();
    renderRelicsTable();
  });

  // Thêm dòng ghi chép khảo cổ động
  btnAddNoteRow.addEventListener("click", () => {
    addNoteRow("");
  });

  // Lưu biểu mẫu bảo vật (Thêm mới hoặc Cập nhật)
  relicForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("relicFormId").value.trim() || ("relic_" + Date.now());
    const title = document.getElementById("relicFormTitle").value.trim();
    const era = document.getElementById("relicFormEra").value.trim();
    const badge = document.getElementById("relicFormBadge").value.trim();
    const location = document.getElementById("relicFormLocation").value.trim();
    const image = document.getElementById("relicFormImage").value.trim();
    const material = document.getElementById("relicFormMaterial").value.trim();
    const dims = document.getElementById("relicFormDims").value.trim();
    const discovery = document.getElementById("relicFormDiscovery").value.trim();
    const desc = document.getElementById("relicFormDesc").value.trim();
    const significance = document.getElementById("relicFormSignificance").value.trim();

    // Thu thập danh sách ghi chép khảo cổ học từ các input động
    const noteInputs = document.querySelectorAll(".note-input-item");
    const notes = Array.from(noteInputs).map(i => i.value.trim()).filter(Boolean);

    const relicData = {
      id,
      title,
      era,
      badge,
      location,
      image,
      material,
      dims,
      discovery,
      desc,
      significance,
      notes,
      highlights: [era, material, location].filter(Boolean)
    };

    try {
      const res = await authFetch("/api/relics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relic: relicData })
      });
      if (res.status === 401) return;
      const data = await res.json();

      if (data.success) {
        state.relics = data.relics;
        updateKpis();
        renderRelicsTable();
        closeModal("relicModal");
        showToast("Đã lưu hồ sơ Bảo vật Quốc gia thành công!", "success");
      } else {
        showToast(data.message || "Lỗi lưu bảo vật", "error");
      }
    } catch (err) {
      showToast("Lỗi khi kết nối đến máy chủ", "error");
    }
  });
}

// Kết xuất bảng danh sách bảo vật
function renderRelicsTable() {
  const tbody = document.getElementById("relicsTbody");
  const countEl = document.getElementById("relicFilterCount");
  tbody.innerHTML = "";

  const q = state.filterRelicQuery;
  const filtered = state.relics.filter(r => {
    if (!q) return true;
    return (
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.era && r.era.toLowerCase().includes(q)) ||
      (r.material && r.material.toLowerCase().includes(q)) ||
      (r.location && r.location.toLowerCase().includes(q))
    );
  });

  countEl.textContent = `Đang hiển thị ${filtered.length} / ${state.relics.length} bảo vật`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: #64748b;">Không tìm thấy bảo vật nào khớp với từ khóa tìm kiếm.</td></tr>`;
    return;
  }

  filtered.forEach(relic => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <img src="${escapeHtml(relic.image)}" class="table-thumb" alt="${escapeHtml(relic.title)}" onerror="this.src='images/relics/trongdong.jpg'">
      </td>
      <td>
        <div class="table-title">${escapeHtml(relic.title)}</div>
        <div class="table-sub">${escapeHtml(relic.era)}</div>
      </td>
      <td>
        <span class="table-badge">${escapeHtml(relic.badge || "Bảo vật Quốc gia")}</span>
      </td>
      <td>${escapeHtml(relic.location || "Đang cập nhật")}</td>
      <td>
        <div><strong>Kích thước:</strong> ${escapeHtml(relic.dims || "—")}</div>
        <div style="font-size: 11px; color: #94a3b8;"><strong>Chất liệu:</strong> ${escapeHtml(relic.material || "—")}</div>
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon-edit" data-edit-relic="${relic.id}">SỬA</button>
          <button class="btn-icon-del" data-del-relic="${relic.id}">XÓA</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Gắn sự kiện nút Sửa và Xóa
  tbody.querySelectorAll("[data-edit-relic]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-relic");
      const relic = state.relics.find(r => r.id === id);
      if (relic) openRelicModal(relic);
    });
  });

  tbody.querySelectorAll("[data-del-relic]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-relic");
      deleteRelic(id);
    });
  });
}

function openRelicModal(relic = null) {
  const modal = document.getElementById("relicModal");
  const modalTitle = document.getElementById("relicModalTitle");
  const form = document.getElementById("relicForm");
  const notesContainer = document.getElementById("notesContainer");

  form.reset();
  notesContainer.innerHTML = "";

  if (relic) {
    modalTitle.textContent = "CHỈNH SỬA HỒ SƠ: " + relic.title;
    document.getElementById("relicFormId").value = relic.id;
    document.getElementById("relicFormTitle").value = relic.title || "";
    document.getElementById("relicFormEra").value = relic.era || "";
    document.getElementById("relicFormBadge").value = relic.badge || "";
    document.getElementById("relicFormLocation").value = relic.location || "";
    document.getElementById("relicFormImage").value = relic.image || "";
    document.getElementById("relicFormMaterial").value = relic.material || "";
    document.getElementById("relicFormDims").value = relic.dims || "";
    document.getElementById("relicFormDiscovery").value = relic.discovery || "";
    document.getElementById("relicFormDesc").value = relic.desc || "";
    document.getElementById("relicFormSignificance").value = relic.significance || "";

    if (Array.isArray(relic.notes) && relic.notes.length > 0) {
      relic.notes.forEach(n => addNoteRow(n));
    } else {
      addNoteRow("");
    }
  } else {
    modalTitle.textContent = "THÊM BẢO VẬT QUỐC GIA MỚI";
    document.getElementById("relicFormId").value = "";
    document.getElementById("relicFormImage").value = "images/relics/";
    addNoteRow("");
  }

  modal.hidden = false;
  modal.style.display = "flex";
}

function addNoteRow(content = "") {
  const notesContainer = document.getElementById("notesContainer");
  const div = document.createElement("div");
  div.className = "dynamic-row";
  div.innerHTML = `
    <input type="text" class="form-input note-input-item" style="flex:1;" placeholder="Ghi chép khảo cổ học chi tiết..." value="${escapeHtml(content)}">
    <button type="button" class="btn-row-del" title="Xóa dòng">&times;</button>
  `;
  div.querySelector(".btn-row-del").addEventListener("click", () => div.remove());
  notesContainer.appendChild(div);
}

async function deleteRelic(id) {
  const relic = state.relics.find(r => r.id === id);
  const name = relic ? relic.title : id;
  if (!confirm(`Bạn có chắc chắn muốn xóa bảo vật "${name}" khỏi bảo tàng không?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/relics?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.success) {
      state.relics = data.relics;
      updateKpis();
      renderRelicsTable();
      showToast("Đã xóa bảo vật thành công!", "success");
    } else {
      showToast(data.message || "Lỗi xóa bảo vật", "error");
    }
  } catch (err) {
    showToast("Không thể kết nối máy chủ", "error");
  }
}

// ==============================================================================
// 6. QUẢN LÝ CUỘN BĂNG TƯ LIỆU VHS (TAPES CRUD)
// ==============================================================================
function initTapeEvents() {
  const btnOpenAddTape = document.getElementById("btnOpenAddTapeModal");
  const tapeForm = document.getElementById("tapeForm");

  btnOpenAddTape.addEventListener("click", () => openTapeModal());

  tapeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("tapeFormId").value.trim() || ("tape_" + Date.now());
    const t = document.getElementById("tapeFormTitle").value.trim();
    const y = document.getElementById("tapeFormYear").value.trim();
    const era = document.getElementById("tapeFormEra").value.trim();
    const videoUrl = document.getElementById("tapeFormVideoUrl").value.trim();
    const d = document.getElementById("tapeFormDesc").value.trim();
    const quote = document.getElementById("tapeFormQuote").value.trim();
    const quoteAuthor = document.getElementById("tapeFormAuthor").value.trim();
    const sceneType = document.getElementById("tapeFormScene").value;
    const bg = document.getElementById("tapeFormBg").value;
    const ink = document.getElementById("tapeFormInk").value;
    const bigRaw = document.getElementById("tapeFormBig").value;
    const big = bigRaw.split(",").map(s => s.trim()).filter(Boolean);

    const tapeData = {
      id,
      t,
      y,
      era,
      videoUrl,
      d,
      quote,
      quoteAuthor,
      sceneType,
      bg,
      ink,
      big: big.length > 0 ? big : [t],
      videoDuration: 40,
      highlights: [era, y]
    };

    try {
      const res = await authFetch("/api/tapes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tape: tapeData })
      });
      if (res.status === 401) return;
      const data = await res.json();

      if (data.success) {
        state.tapes = data.tapes;
        updateKpis();
        renderTapesTable();
        closeModal("tapeModal");
        showToast("Đã lưu cuộn băng tư liệu thành công!", "success");
      } else {
        showToast(data.message || "Lỗi lưu cuộn băng", "error");
      }
    } catch (err) {
      showToast("Lỗi kết nối máy chủ", "error");
    }
  });
}

function renderTapesTable() {
  const tbody = document.getElementById("tapesTbody");
  tbody.innerHTML = "";

  state.tapes.forEach((tape, idx) => {
    const tr = document.createElement("tr");
    const hasVideo = tape.videoUrl && tape.videoUrl.trim() !== "";
    const sourceBadge = hasVideo 
      ? `<span class="table-badge" style="background:#064e3b; color:#6ee7b7;">🎬 Video MP4</span>`
      : `<span class="table-badge" style="background:#3b1e06; color:#fcd34d;">📐 Sa Bàn Đồ Họa</span>`;

    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 16px; color: var(--gold-light);">
        BĂNG ${String(idx + 1).padStart(2, "0")}
      </td>
      <td>
        <div class="table-title">${escapeHtml(tape.t)}</div>
        <div class="table-sub">${escapeHtml(tape.y)}</div>
      </td>
      <td>${escapeHtml(tape.era || "Thời kỳ lịch sử")}</td>
      <td>
        ${sourceBadge}
        <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">${escapeHtml(tape.videoUrl || "Mô phỏng chiến thuật")}</div>
      </td>
      <td style="font-style: italic; max-width: 280px; font-size: 12px;">
        "${escapeHtml(tape.quote || "—")}"
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon-edit" data-edit-tape="${tape.id}">SỬA</button>
          <button class="btn-icon-del" data-del-tape="${tape.id}">XÓA</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit-tape]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-tape");
      const tape = state.tapes.find(t => t.id === id);
      if (tape) openTapeModal(tape);
    });
  });

  tbody.querySelectorAll("[data-del-tape]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-tape");
      deleteTape(id);
    });
  });
}

function openTapeModal(tape = null) {
  const modal = document.getElementById("tapeModal");
  const modalTitle = document.getElementById("tapeModalTitle");
  const form = document.getElementById("tapeForm");

  form.reset();

  if (tape) {
    modalTitle.textContent = "CHỈNH SỬA CUỘN BĂNG: " + tape.t;
    document.getElementById("tapeFormId").value = tape.id;
    document.getElementById("tapeFormTitle").value = tape.t || "";
    document.getElementById("tapeFormYear").value = tape.y || "";
    document.getElementById("tapeFormEra").value = tape.era || "";
    document.getElementById("tapeFormVideoUrl").value = tape.videoUrl || "";
    document.getElementById("tapeFormDesc").value = tape.d || "";
    document.getElementById("tapeFormQuote").value = tape.quote || "";
    document.getElementById("tapeFormAuthor").value = tape.quoteAuthor || "";
    document.getElementById("tapeFormScene").value = tape.sceneType || "generic";
    document.getElementById("tapeFormBg").value = tape.bg || "#132d4a";
    document.getElementById("tapeFormInk").value = tape.ink || "#d6ebff";
    document.getElementById("tapeFormBig").value = Array.isArray(tape.big) ? tape.big.join(", ") : (tape.big || "");
  } else {
    modalTitle.textContent = "THÊM CUỘN BĂNG LỊCH SỬ MỚI";
    document.getElementById("tapeFormId").value = "";
    document.getElementById("tapeFormBg").value = "#132d4a";
    document.getElementById("tapeFormInk").value = "#d6ebff";
  }

  modal.hidden = false;
  modal.style.display = "flex";
}

async function deleteTape(id) {
  const tape = state.tapes.find(t => t.id === id);
  const name = tape ? tape.t : id;
  if (!confirm(`Bạn có chắc chắn muốn xóa cuộn băng "${name}" khỏi phòng 3D không?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/tapes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.success) {
      state.tapes = data.tapes;
      updateKpis();
      renderTapesTable();
      showToast("Đã xóa cuộn băng thành công!", "success");
    } else {
      showToast(data.message || "Lỗi xóa cuộn băng", "error");
    }
  } catch (err) {
    showToast("Không thể kết nối máy chủ", "error");
  }
}

// ==============================================================================
// 7. CẤU HÌNH KHÔNG GIAN 3D & CRT (STUDIO SETTINGS)
// ==============================================================================
function initSettingsEvents() {
  const btnSaveSettings = document.getElementById("btnSaveSettings");

  btnSaveSettings.addEventListener("click", async () => {
    const newSettings = {
      studioName: document.getElementById("settingStudioName").value.trim(),
      defaultChannel: document.getElementById("settingDefaultChannel").value,
      defaultVolume: parseFloat(document.getElementById("settingDefaultVolume").value) || 0.85,
      crtScanlines: document.getElementById("settingCrtScanlines").checked,
      crtBloom: document.getElementById("settingCrtBloom").checked,
      musicEnabled: document.getElementById("settingMusicEnabled").checked
    };

    const pinInput = document.getElementById("settingAdminPin").value.trim();
    if (pinInput) {
      newSettings.adminPin = pinInput;
    }

    try {
      const res = await authFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings })
      });
      if (res.status === 401) return;
      const data = await res.json();
      if (data.success) {
        state.settings = data.settings;
        showToast("Đã lưu toàn bộ cấu hình không gian 3D!", "success");
      } else {
        showToast(data.message || "Lỗi lưu cấu hình", "error");
      }
    } catch (err) {
      showToast("Không thể kết nối máy chủ", "error");
    }
  });
}

function populateSettingsForm() {
  const s = state.settings || {};
  document.getElementById("settingStudioName").value = s.studioName || "Bảo tàng Lịch sử & Không gian CRT 3D Việt Nam";
  document.getElementById("settingDefaultChannel").value = s.defaultChannel || "relics";
  document.getElementById("settingDefaultVolume").value = s.defaultVolume !== undefined ? s.defaultVolume : 0.85;
  document.getElementById("settingCrtScanlines").checked = s.crtScanlines !== false;
  document.getElementById("settingCrtBloom").checked = s.crtBloom !== false;
  document.getElementById("settingMusicEnabled").checked = s.musicEnabled !== false;
  document.getElementById("settingAdminPin").value = s.adminPin || "admin123";
}

// ==============================================================================
// 8. SAO LƯU & PHỤC HỒI (BACKUP & RESTORE)
// ==============================================================================
function initBackupEvents() {
  const fileInput = document.getElementById("importFileInput");
  const fileNameDisplay = document.getElementById("importFileName");
  const btnConfirmImport = document.getElementById("btnConfirmImport");
  const btnResetDefaults = document.getElementById("btnResetDefaults");
  const qaExport = document.getElementById("qaExport");

  qaExport?.addEventListener("click", () => {
    window.location.href = "/api/export";
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      fileNameDisplay.textContent = fileInput.files[0].name;
      btnConfirmImport.disabled = false;
    } else {
      fileNameDisplay.textContent = "Chưa chọn tệp tin";
      btnConfirmImport.disabled = true;
    }
  });

  btnConfirmImport.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const res = await authFetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json)
        });
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
          showToast("Khôi phục cơ sở dữ liệu thành công!", "success");
          fileInput.value = "";
          fileNameDisplay.textContent = "Chưa chọn tệp tin";
          btnConfirmImport.disabled = true;
          loadAllData();
        } else {
          showToast(data.message || "Tệp sao lưu không hợp lệ", "error");
        }
      } catch (err) {
        showToast("Tệp JSON không đúng định dạng", "error");
      }
    };
    reader.readAsText(file);
  });

  btnResetDefaults.addEventListener("click", async () => {
    if (!confirm("CẢNH BÁO: Thao tác này sẽ đưa toàn bộ 7 Bảo vật Quốc gia và 10 cuộn băng về trạng thái mặc định của dự án. Bạn có muốn tiếp tục không?")) {
      return;
    }
    try {
      const res = await authFetch("/api/reset", { method: "POST" });
      if (res.status === 401) return;
      const data = await res.json();
      if (data.success) {
        showToast("Đã khôi phục dữ liệu gốc thành công!", "success");
        loadAllData();
      }
    } catch (err) {
      showToast("Không thể thực hiện khôi phục", "error");
    }
  });
}

// ==============================================================================
// 9. QUẢN LÝ ĐÓNG / MỞ HỘP THOẠI MODAL
// ==============================================================================
function initModals() {
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      closeModal(modalId);
    });
  });

  // Đóng khi click bên ngoài hộp thoại
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop") && !e.target.classList.contains("auth-backdrop")) {
      e.target.hidden = true;
      e.target.style.display = "none";
    }
  });

  // Phím Escape để đóng modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const activeModals = document.querySelectorAll(".modal-backdrop:not(.auth-backdrop)");
      activeModals.forEach(m => {
        if (!m.hidden || m.style.display !== "none") {
          m.hidden = true;
          m.style.display = "none";
        }
      });
    }
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.hidden = true;
    modal.style.display = "none";
  }
}

// ==============================================================================
// 10. HỆ THỐNG THÔNG BÁO TỨC THÌ (TOAST NOTIFICATIONS)
// ==============================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";
  toast.innerHTML = `<span style="font-weight:bold; color:var(--gold-light);">${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Hàm hỗ trợ ngăn chặn lỗ hổng XSS
function escapeHtml(str) {
  if (typeof str !== "string") return str || "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
