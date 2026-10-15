// ==========================================================================
// BẢO TÀNG BẢO VẬT QUỐC GIA VIỆT NAM - EXHIBITION ENGINE
// Interactive Museum Experience, Lightbox, Audio Guide & Dossiers
// ==========================================================================

import { VIETNAM_RELICS } from "./vietnam-history-data.js";

class VietnamNationalMuseum {
  constructor() {
    this.relics = VIETNAM_RELICS || [];
    this.currentRelicIndex = 0;
    this.currentFilter = "all";
    this.searchQuery = "";
    this.viewMode = "grid"; // "grid" or "list"
    this.zoomLevel = 1;
    this.audioSpeech = null;
    this.isSpeaking = false;

    this.initDOM();
    this.renderExhibits();
    this.renderTimeline();
    this.bindEvents();
  }

  initDOM() {
    this.gridEl = document.getElementById("exhibitsGrid");
    this.counterEl = document.getElementById("exhibitsCounter");
    this.searchInput = document.getElementById("relicSearch");
    this.filterBtns = document.querySelectorAll(".filter-btn");
    this.viewBtns = document.querySelectorAll(".view-btn");
    
    // Modal elements
    this.modalEl = document.getElementById("dossierModal");
    this.modalImg = document.getElementById("modalRelicImg");
    this.modalTitle = document.getElementById("modalRelicTitle");
    this.modalBadge = document.getElementById("modalRelicBadge");
    this.modalEra = document.getElementById("modalRelicEra");
    this.tabContentArea = document.getElementById("modalTabContent");
    this.modalTabBtns = document.querySelectorAll(".modal-tab-btn");
    this.btnPrevRelic = document.getElementById("btnModalPrev");
    this.btnNextRelic = document.getElementById("btnModalNext");
    this.btnCloseModal = document.getElementById("btnModalClose");
    this.btnAudio = document.getElementById("btnAudioGuide");
    
    // Zoom tools
    this.btnZoomIn = document.getElementById("btnZoomIn");
    this.btnZoomOut = document.getElementById("btnZoomOut");
    this.btnZoomReset = document.getElementById("btnZoomReset");
  }

  getFilteredRelics() {
    return this.relics.filter(relic => {
      // 1. Period filter
      let matchesFilter = true;
      if (this.currentFilter === "dongson") {
        matchesFilter = relic.id === "trongdong" || relic.id === "thapdong";
      } else if (this.currentFilter === "lytran") {
        matchesFilter = relic.id === "rongly";
      } else if (this.currentFilter === "lamson") {
        matchesFilter = relic.id === "thuanthienkiem";
      } else if (this.currentFilter === "nguyen") {
        matchesFilter = relic.id === "cuudinh" || relic.id === "kiman";
      } else if (this.currentFilter === "modern") {
        matchesFilter = relic.id === "xetang390";
      }

      // 2. Search query
      let matchesSearch = true;
      if (this.searchQuery.trim() !== "") {
        const q = this.searchQuery.toLowerCase();
        const fullText = [
          relic.title,
          relic.era,
          relic.material,
          relic.location,
          relic.desc,
          relic.discovery,
          relic.significance,
          ...(relic.notes || []),
          ...(relic.highlights || [])
        ].join(" ").toLowerCase();

        matchesSearch = fullText.includes(q);
      }

      return matchesFilter && matchesSearch;
    });
  }

  renderExhibits() {
    const list = this.getFilteredRelics();
    this.counterEl.textContent = `HIỂN THỊ [ ${list.length} / ${this.relics.length} BẢO VẬT ]`;

    if (list.length === 0) {
      this.gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
          <h3 style="color: var(--text-secondary); margin-bottom: 8px;">Không tìm thấy bảo vật phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả bảo vật".</p>
        </div>
      `;
      return;
    }

    this.gridEl.className = this.viewMode === "grid" ? "exhibits-grid" : "exhibits-list-mode";

    this.gridEl.innerHTML = list.map((relic) => {
      const idx = this.relics.findIndex(r => r.id === relic.id);
      const highlightsHtml = (relic.highlights || []).slice(0, 3).map(h => `<span class="highlight-tag">✦ ${this.escapeHtml(h)}</span>`).join("");

      return `
        <article class="exhibit-card" data-index="${idx}">
          <div class="card-media" onclick="window.museumApp.openDossier(${idx})">
            <img src="${relic.image}" alt="${this.escapeHtml(relic.title)}" class="card-img" loading="lazy">
            <div class="card-badges">
              <span class="badge-national">BẢO VẬT QUỐC GIA</span>
              <span class="badge-era-chip">${this.escapeHtml(relic.era.split("(")[0].trim())}</span>
            </div>
            <div class="card-zoom-hint" title="Xem ảnh gốc & hồ sơ">🔍</div>
          </div>

          <div class="card-body">
            <h3 class="card-title">${this.escapeHtml(relic.title)}</h3>
            <div class="card-period">
              <span>🏛</span> ${this.escapeHtml(relic.era)}
            </div>

            <p class="card-desc">${this.escapeHtml(relic.desc)}</p>

            <div class="card-specs">
              <div class="spec-item">
                <span class="spec-key">Chất liệu:</span>
                <span class="spec-val" title="${this.escapeHtml(relic.material)}">${this.escapeHtml(relic.material)}</span>
              </div>
              <div class="spec-item">
                <span class="spec-key">Lưu giữ:</span>
                <span class="spec-val" title="${this.escapeHtml(relic.location)}">${this.escapeHtml(relic.location)}</span>
              </div>
            </div>

            <div class="card-highlights">
              ${highlightsHtml}
            </div>

            <button type="button" class="btn-open-dossier" onclick="window.museumApp.openDossier(${idx})">
              <span>KHÁM PHÁ HỒ SƠ DI SẢN</span>
              <span>→</span>
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  renderTimeline() {
    const timelineEl = document.getElementById("timelineTrack");
    if (!timelineEl) return;

    timelineEl.innerHTML = this.relics.map((relic, idx) => `
      <div class="timeline-event">
        <div class="timeline-marker"></div>
        <div class="timeline-card" onclick="window.museumApp.openDossier(${idx})">
          <div class="timeline-era">${this.escapeHtml(relic.era)}</div>
          <h4 class="timeline-title">${this.escapeHtml(relic.title)}</h4>
          <p class="timeline-summary">${this.escapeHtml(relic.desc.slice(0, 140))}…</p>
        </div>
      </div>
    `).join("");
  }

  openDossier(index) {
    this.currentRelicIndex = (index + this.relics.length) % this.relics.length;
    const relic = this.relics[this.currentRelicIndex];
    if (!relic) return;

    this.stopAudio();
    this.zoomLevel = 1;
    this.updateZoom();

    // Populate header & media
    this.modalImg.src = relic.image;
    this.modalImg.alt = relic.title;
    this.modalTitle.textContent = relic.title;
    this.modalBadge.textContent = relic.badge;
    this.modalEra.textContent = relic.era;

    // Reset tabs to Tab 0
    this.setModalTab(0);
    this.renderModalContent(relic);

    this.modalEl.classList.add("active");
    this.modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  closeDossier() {
    this.stopAudio();
    this.modalEl.classList.remove("active");
    this.modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  setModalTab(tabIndex) {
    this.modalTabBtns.forEach((btn, i) => {
      btn.classList.toggle("active", i === tabIndex);
    });

    const panes = this.tabContentArea.querySelectorAll(".tab-pane");
    panes.forEach((pane, i) => {
      pane.classList.toggle("active", i === tabIndex);
    });
  }

  renderModalContent(relic) {
    const notesListHtml = (relic.notes || []).map((n, i) => `
      <li><strong>Ghi chép ${String(i + 1).padStart(2, "0")}:</strong> ${this.escapeHtml(n)}</li>
    `).join("");

    this.tabContentArea.innerHTML = `
      <!-- TAB 1: TỔNG QUAN & KHAI QUẬT -->
      <div class="tab-pane active" id="paneOverview">
        <div class="dossier-quote-box">
          "${this.escapeHtml(relic.desc)}"
        </div>

        <div class="dossier-section">
          <h4 class="dossier-section-title"><span>⛏</span> Bối Cảnh Phát Hiện & Khảo Cổ Học</h4>
          <p style="color: #cbd5e1; margin-bottom: 16px;">${this.escapeHtml(relic.discovery || "Hiện vật được sưu tầm và gìn giữ theo hồ sơ di sản quốc gia.")}</p>
        </div>

        <div class="dossier-section">
          <h4 class="dossier-section-title"><span>🏛</span> Đặc Điểm Nổi Bật</h4>
          <div class="card-highlights">
            ${(relic.highlights || []).map(h => `<span class="highlight-tag" style="font-size: 0.85rem; padding: 5px 12px;">★ ${this.escapeHtml(h)}</span>`).join("")}
          </div>
        </div>
      </div>

      <!-- TAB 2: GHI CHÉP KHẢO CỔ -->
      <div class="tab-pane" id="paneNotes">
        <div class="dossier-section">
          <h4 class="dossier-section-title"><span>📋</span> Nhật Ký Hiện Trường & Giám Định Chuyên Sâu</h4>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.88rem;">
            Dữ liệu đối sánh từ hồ sơ khoa học Bảo tàng Lịch sử Quốc gia và Hội đồng Di sản Văn hóa Quốc gia:
          </p>
          <ul class="dossier-notes-list">
            ${notesListHtml}
          </ul>
        </div>
      </div>

      <!-- TAB 3: Ý NGHĨA & BIỂU TƯỢNG -->
      <div class="tab-pane" id="paneSignificance">
        <div class="dossier-section">
          <h4 class="dossier-section-title"><span>🇻🇳</span> Ý Nghĩa Lịch Sử & Chủ Quyền Dân Tộc</h4>
          <p style="color: #f1f5f9; font-size: 1.05rem; line-height: 1.8; margin-bottom: 20px;">
            ${this.escapeHtml(relic.significance || "Bảo vật quốc gia là di sản vô giá khẳng định truyền thống văn hiến và bản sắc độc lập tự chủ của dân tộc Việt Nam.")}
          </p>
        </div>

        <div class="dossier-section" style="background: rgba(18, 24, 38, 0.5); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <h4 class="dossier-section-title"><span>🛡</span> Giá Trị Tinh Thần & Di Sản Văn Hóa</h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">
            Hiện vật không chỉ là bằng chứng vật chất cho trình độ chế tác bậc thầy mà còn phản ánh thế giới quan nhân sinh, tâm thức hướng về cội nguồn và ý chí quật cường bảo vệ chủ quyền non sông đất nước của các bậc tiền nhân.
          </p>
        </div>
      </div>

      <!-- TAB 4: THÔNG SỐ PHÁP LÝ & KHOA HỌC -->
      <div class="tab-pane" id="paneSpecs">
        <div class="dossier-section">
          <h4 class="dossier-section-title"><span>⚖️</span> Hồ Sơ Pháp Lý & Thông Số Kỹ Thuật</h4>
          <table class="specs-table">
            <tbody>
              <tr>
                <td class="spec-name">Tên Bảo vật:</td>
                <td class="spec-data"><strong>${this.escapeHtml(relic.title)}</strong></td>
              </tr>
              <tr>
                <td class="spec-name">Văn bản Pháp lý:</td>
                <td class="spec-data"><span style="color: var(--gold-light); font-weight: 600;">${this.escapeHtml(relic.badge)}</span></td>
              </tr>
              <tr>
                <td class="spec-name">Niên đại:</td>
                <td class="spec-data">${this.escapeHtml(relic.era)}</td>
              </tr>
              <tr>
                <td class="spec-name">Chất liệu:</td>
                <td class="spec-data">${this.escapeHtml(relic.material)}</td>
              </tr>
              <tr>
                <td class="spec-name">Quy cách & Kích thước:</td>
                <td class="spec-data">${this.escapeHtml(relic.dims)}</td>
              </tr>
              <tr>
                <td class="spec-name">Địa điểm lưu giữ hiện tại:</td>
                <td class="spec-data">${this.escapeHtml(relic.location)}</td>
              </tr>
              <tr>
                <td class="spec-name">Tình trạng bảo tồn:</td>
                <td class="spec-data"><span style="color: #4ade80;">● Nguyên vẹn – Được bảo quản theo quy chế đặc biệt cấp Quốc gia</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  nextRelic() {
    this.openDossier(this.currentRelicIndex + 1);
  }

  prevRelic() {
    this.openDossier(this.currentRelicIndex - 1);
  }

  // Zoom controls for photo
  zoomIn() {
    this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
    this.updateZoom();
  }

  zoomOut() {
    this.zoomLevel = Math.max(0.75, this.zoomLevel - 0.25);
    this.updateZoom();
  }

  zoomReset() {
    this.zoomLevel = 1;
    this.updateZoom();
  }

  updateZoom() {
    if (this.modalImg) {
      this.modalImg.style.transform = `scale(${this.zoomLevel})`;
    }
  }

  // Audio Guide Voice Reader (Web Speech API)
  toggleAudioGuide() {
    if (this.isSpeaking) {
      this.stopAudio();
      return;
    }

    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt của bạn không hỗ trợ tính năng thuyết minh giọng nói tự động.");
      return;
    }

    const relic = this.relics[this.currentRelicIndex];
    if (!relic) return;

    const speechText = `${relic.title}. Niên đại: ${relic.era}. ${relic.desc}. Bối cảnh: ${relic.discovery || ""}. Ý nghĩa: ${relic.significance || ""}`;

    window.speechSynthesis.cancel();
    this.audioSpeech = new SpeechSynthesisUtterance(speechText);
    this.audioSpeech.lang = "vi-VN";
    this.audioSpeech.rate = 0.95;

    this.audioSpeech.onstart = () => {
      this.isSpeaking = true;
      this.btnAudio.classList.add("playing");
      this.btnAudio.innerHTML = `<span>⏹</span> <span>ĐANG PHÁT THUYẾT MINH…</span>`;
    };

    this.audioSpeech.onend = this.audioSpeech.onerror = () => {
      this.stopAudio();
    };

    window.speechSynthesis.speak(this.audioSpeech);
  }

  stopAudio() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    if (this.btnAudio) {
      this.btnAudio.classList.remove("playing");
      this.btnAudio.innerHTML = `<span>🔊</span> <span>NGHE THUYẾT MINH AUDIO</span>`;
    }
  }

  bindEvents() {
    // Search input
    this.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.renderExhibits();
    });

    // Filter Buttons
    this.filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentFilter = btn.dataset.filter;
        this.renderExhibits();
      });
    });

    // View mode switchers
    this.viewBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.viewBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.viewMode = btn.dataset.view;
        this.renderExhibits();
      });
    });

    // Modal tabs
    this.modalTabBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => this.setModalTab(i));
    });

    // Modal navigation
    this.btnPrevRelic.addEventListener("click", () => this.prevRelic());
    this.btnNextRelic.addEventListener("click", () => this.nextRelic());
    this.btnCloseModal.addEventListener("click", () => this.closeDossier());
    this.btnAudio.addEventListener("click", () => this.toggleAudioGuide());

    // Zoom buttons
    this.btnZoomIn.addEventListener("click", () => this.zoomIn());
    this.btnZoomOut.addEventListener("click", () => this.zoomOut());
    this.btnZoomReset.addEventListener("click", () => this.zoomReset());

    // Backdrop click close
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) {
        this.closeDossier();
      }
    });

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      if (!this.modalEl.classList.contains("active")) return;
      if (e.key === "Escape") this.closeDossier();
      if (e.key === "ArrowLeft") this.prevRelic();
      if (e.key === "ArrowRight") this.nextRelic();
    });

    // Scroll header styling
    window.addEventListener("scroll", () => {
      const header = document.getElementById("museumHeader");
      if (header) {
        header.classList.toggle("scrolled", window.scrollY > 40);
      }
    }, { passive: true });
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Instantiate and expose globally
document.addEventListener("DOMContentLoaded", () => {
  window.museumApp = new VietnamNationalMuseum();
});
