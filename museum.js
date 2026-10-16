// ==========================================================================
// BẢO TÀNG BẢO VẬT QUỐC GIA VIỆT NAM - KHUNG ĐIỀU KHIỂN TRIỂN LÃM (EXHIBITION ENGINE)
// Chức năng: Bộ lọc thời kỳ, tìm kiếm tức thời, hiển thị gallery/danh mục,
// xem hồ sơ giám định chuyên sâu (Deep Inspection Modal), kính lúp thu phóng ảnh,
// niên biểu lịch sử và thuyết minh giọng đọc tiếng Việt tự động (Audio Guide).
// ==========================================================================

import { VIETNAM_RELICS } from "./vietnam-history-data.js";

// ==========================================================================
// 1. TẬP HỢP CÁC BIỂU TƯỢNG VECTOR SVG ĐƠN SẮC (MONOCHROMATIC ICONS)
// Toàn bộ icon sử dụng stroke="currentColor" để đồng bộ màu sắc tự nhiên theo CSS,
// không sử dụng emoji màu mè để đảm bảo tính mỹ thuật bảo tàng sang trọng.
// ==========================================================================
const ICONS = {
  // Kính lúp tìm kiếm trong ô tìm kiếm
  search: `<svg class="mono-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  
  // Icon kính lúp thu nhỏ trên góc ảnh thẻ hiện vật
  zoomHint: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`,
  
  // Cột bảo tàng cổ điển đại diện cho thời kỳ / niên đại
  museum: `<svg class="mono-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 2 7 22 7 12 2"></polygon></svg>`,
  
  // Mũi tên điều hướng sang phải
  arrowRight: `<svg class="mono-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  
  // Loa phát thanh cho nút nghe thuyết minh Audio Guide
  audioPlay: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
  
  // Nút dừng thuyết minh (hình vuông đơn sắc)
  audioStop: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`,
  
  // La bàn / Vị trí khai quật khảo cổ học
  excavation: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
  
  // Ngôi sao / Điểm nhấn di sản tiêu biểu
  star: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  
  // Hồ sơ văn bản / Ghi chép nhật ký khảo cổ
  document: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  
  // Khiên bảo vệ đại diện cho giá trị tinh thần và di sản văn hóa
  shield: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  
  // Cán cân công lý đại diện cho hồ sơ pháp lý & Quyết định công nhận
  legal: `<svg class="mono-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h18"></path></svg>`
};

// ==========================================================================
// 2. LỚP ĐIỀU KHIỂN BẢO TÀNG CHÍNH (CLASS VIETNAM NATIONAL MUSEUM)
// Quản lý trạng thái, nạp DOM, bắt sự kiện chuột/bàn phím và tương tác người dùng
// ==========================================================================
class VietnamNationalMuseum {
  constructor() {
    // Nạp danh sách 7 bảo vật quốc gia từ kho dữ liệu
    this.relics = VIETNAM_RELICS || [];
    // Vị trí bảo vật đang được xem trong modal (0 đến 6)
    this.currentRelicIndex = 0;
    // Bộ lọc thời kỳ đang áp dụng ('all', 'dongson', 'lytran', 'lamson', 'nguyen', 'modern')
    this.currentFilter = "all";
    // Chuỗi từ khóa tìm kiếm người dùng đang gõ
    this.searchQuery = "";
    // Chế độ xem: 'grid' (Trưng bày gallery dạng thẻ lớn) hoặc 'list' (Hồ sơ danh mục ngang)
    this.viewMode = "grid";
    // Tỉ lệ thu phóng ảnh hiện vật gốc (1 = 100%, tối đa 3 = 300%)
    this.zoomLevel = 1;
    // Đối tượng giọng nói Web Speech Synthesis Utterance
    this.audioSpeech = null;
    // Trạng thái đang phát âm thanh thuyết minh
    this.isSpeaking = false;

    // Khởi tạo các phần tử DOM, render giao diện và gán sự kiện
    this.initDOM();
    this.renderExhibits();
    this.renderTimeline();
    this.bindEvents();
  }

  // ------------------------------------------------------------------------
  // Khởi tạo và lưu trữ tham chiếu đến các phần tử DOM trên trang
  // ------------------------------------------------------------------------
  initDOM() {
    // Vùng lưới chứa các thẻ hiện vật bảo tàng
    this.gridEl = document.getElementById("exhibitsGrid");
    // Nhãn hiển thị số lượng hiện vật (Ví dụ: HIỂN THỊ [ 07 / 07 BẢO VẬT ])
    this.counterEl = document.getElementById("exhibitsCounter");
    // Ô nhập từ khóa tìm kiếm
    this.searchInput = document.getElementById("relicSearch");
    // Các nút tab lọc thời kỳ
    this.filterBtns = document.querySelectorAll(".filter-btn");
    // Các nút chuyển đổi chế độ xem Grid / List
    this.viewBtns = document.querySelectorAll(".view-btn");
    
    // Cửa sổ modal hồ sơ chuyên sâu
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
    
    // Công cụ thu phóng ảnh trong modal
    this.btnZoomIn = document.getElementById("btnZoomIn");
    this.btnZoomOut = document.getElementById("btnZoomOut");
    this.btnZoomReset = document.getElementById("btnZoomReset");
  }

  // ------------------------------------------------------------------------
  // Lọc danh sách hiện vật theo thời kỳ lịch sử và từ khóa tìm kiếm
  // ------------------------------------------------------------------------
  getFilteredRelics() {
    return this.relics.filter(relic => {
      // 1. Kiểm tra khớp thời kỳ lịch sử
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

      // 2. Kiểm tra khớp từ khóa tìm kiếm (Tên, niên đại, chất liệu, bảo tàng, mô tả, ghi chú)
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

  // ------------------------------------------------------------------------
  // Kết xuất danh sách thẻ hiện vật ra màn hình
  // ------------------------------------------------------------------------
  renderExhibits() {
    const list = this.getFilteredRelics();
    // Cập nhật bộ đếm số lượng hiện vật
    this.counterEl.textContent = `HIỂN THỊ [ ${String(list.length).padStart(2, "0")} / ${String(this.relics.length).padStart(2, "0")} BẢO VẬT ]`;

    // Nếu không có hiện vật nào khớp với từ khóa tìm kiếm
    if (list.length === 0) {
      this.gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="margin-bottom: 16px; color: var(--gold-primary); opacity: 0.6;">
            <svg class="mono-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3 style="color: var(--text-secondary); margin-bottom: 8px;">Không tìm thấy bảo vật phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả bảo vật".</p>
        </div>
      `;
      return;
    }

    // Đổi kiểu hiển thị theo viewMode (Grid hoặc List)
    this.gridEl.className = this.viewMode === "grid" ? "exhibits-grid" : "exhibits-list-mode";

    // Tạo HTML cho từng thẻ bảo vật
    this.gridEl.innerHTML = list.map((relic) => {
      const idx = this.relics.findIndex(r => r.id === relic.id);
      // Tạo danh sách tag điểm nhấn tiêu biểu
      const highlightsHtml = (relic.highlights || []).slice(0, 3).map(h => `<span class="highlight-tag"><span class="mono-bullet">◆</span> ${this.escapeHtml(h)}</span>`).join("");

      return `
        <article class="exhibit-card" data-index="${idx}">
          <!-- Khung ảnh hiện vật với hiệu ứng đèn rọi spotlight -->
          <div class="card-media" onclick="window.museumApp.openDossier(${idx})">
            <img src="${this.escapeHtml(relic.image)}" alt="${this.escapeHtml(relic.title)}" class="card-img" loading="lazy">
            <div class="card-badges">
              <span class="badge-national">BẢO VẬT QUỐC GIA</span>
              <span class="badge-era-chip">${this.escapeHtml(relic.era.split("(")[0].trim())}</span>
            </div>
            <!-- Nút gợi ý bấm xem chi tiết ảnh gốc -->
            <div class="card-zoom-hint" title="Xem ảnh gốc & hồ sơ">${ICONS.zoomHint}</div>
          </div>

          <!-- Phần nội dung thẻ hiện vật -->
          <div class="card-body">
            <h3 class="card-title">${this.escapeHtml(relic.title)}</h3>
            <div class="card-period">
              ${ICONS.museum}
              <span>${this.escapeHtml(relic.era)}</span>
            </div>

            <p class="card-desc">${this.escapeHtml(relic.desc)}</p>

            <!-- Bảng tóm tắt chất liệu và nơi lưu giữ -->
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

            <!-- Các điểm nhấn lịch sử độc đáo -->
            <div class="card-highlights">
              ${highlightsHtml}
            </div>

            <!-- Nút bấm mở hồ sơ giám định -->
            <button type="button" class="btn-open-dossier" onclick="window.museumApp.openDossier(${idx})">
              <span>KHÁM PHÁ HỒ SƠ DI SẢN</span>
              ${ICONS.arrowRight}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  // ------------------------------------------------------------------------
  // Kết xuất trục Niên biểu dòng chảy lịch sử Việt Nam
  // ------------------------------------------------------------------------
  renderTimeline() {
    const timelineEl = document.getElementById("timelineTrack");
    if (!timelineEl) return;

    timelineEl.innerHTML = this.relics.map((relic, idx) => `
      <div class="timeline-event">
        <!-- Điểm đánh dấu mốc son trên đường nối -->
        <div class="timeline-marker"></div>
        <!-- Thẻ thông tin niên biểu bấm vào để xem hồ sơ -->
        <div class="timeline-card" onclick="window.museumApp.openDossier(${idx})">
          <div class="timeline-era">${this.escapeHtml(relic.era)}</div>
          <h4 class="timeline-title">${this.escapeHtml(relic.title)}</h4>
          <p class="timeline-summary">${this.escapeHtml(relic.desc.slice(0, 140))}…</p>
        </div>
      </div>
    `).join("");
  }

  // ------------------------------------------------------------------------
  // Mở cửa sổ Modal Hồ Sơ Giám Định Khảo Cổ Chuyên Sâu
  // ------------------------------------------------------------------------
  openDossier(index) {
    this.currentRelicIndex = (index + this.relics.length) % this.relics.length;
    const relic = this.relics[this.currentRelicIndex];
    if (!relic) return;

    // Dừng âm thanh thuyết minh nếu đang phát
    this.stopAudio();
    // Đặt lại tỉ lệ thu phóng ảnh về 100%
    this.zoomLevel = 1;
    this.updateZoom();

    // Điền dữ liệu vào tiêu đề và ảnh hiện vật
    this.modalImg.src = relic.image;
    this.modalImg.alt = relic.title;
    this.modalTitle.textContent = relic.title;
    this.modalBadge.textContent = relic.badge;
    this.modalEra.textContent = relic.era;

    // Luôn mở Tab 1 đầu tiên khi vừa mở modal
    this.setModalTab(0);
    this.renderModalContent(relic);

    // Bật hiển thị modal và chặn cuộn trang web bên dưới
    this.modalEl.classList.add("active");
    this.modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // ------------------------------------------------------------------------
  // Đóng cửa sổ Modal Hồ Sơ
  // ------------------------------------------------------------------------
  closeDossier() {
    this.stopAudio();
    this.modalEl.classList.remove("active");
    this.modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ------------------------------------------------------------------------
  // Chuyển đổi giữa 4 Tab tài liệu khoa học trong Modal
  // ------------------------------------------------------------------------
  setModalTab(tabIndex) {
    this.modalTabBtns.forEach((btn, i) => {
      btn.classList.toggle("active", i === tabIndex);
    });

    const panes = this.tabContentArea.querySelectorAll(".tab-pane");
    panes.forEach((pane, i) => {
      pane.classList.toggle("active", i === tabIndex);
    });
  }

  // ------------------------------------------------------------------------
  // Tạo nội dung chi tiết cho 4 Tab nghiên cứu của bảo vật
  // ------------------------------------------------------------------------
  renderModalContent(relic) {
    // Tạo danh sách ghi chép hiện trường khảo cổ học
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
          <h4 class="dossier-section-title">${ICONS.excavation} <span>Bối Cảnh Phát Hiện & Khảo Cổ Học</span></h4>
          <p style="color: #cbd5e1; margin-bottom: 16px;">${this.escapeHtml(relic.discovery || "Hiện vật được sưu tầm và gìn giữ theo hồ sơ di sản quốc gia.")}</p>
        </div>

        <div class="dossier-section">
          <h4 class="dossier-section-title">${ICONS.museum} <span>Đặc Điểm Nổi Bật</span></h4>
          <div class="card-highlights">
            ${(relic.highlights || []).map(h => `<span class="highlight-tag" style="font-size: 0.85rem; padding: 5px 12px;"><span class="mono-bullet">◆</span> ${this.escapeHtml(h)}</span>`).join("")}
          </div>
        </div>
      </div>

      <!-- TAB 2: GHI CHÉP KHẢO CỔ & GIÁM ĐỊNH -->
      <div class="tab-pane" id="paneNotes">
        <div class="dossier-section">
          <h4 class="dossier-section-title">${ICONS.document} <span>Nhật Ký Hiện Trường & Giám Định Chuyên Sâu</span></h4>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.88rem;">
            Dữ liệu đối sánh từ hồ sơ khoa học Bảo tàng Lịch sử Quốc gia và Hội đồng Di sản Văn hóa Quốc gia:
          </p>
          <ul class="dossier-notes-list">
            ${notesListHtml}
          </ul>
        </div>
      </div>

      <!-- TAB 3: Ý NGHĨA LỊCH SỬ & BIỂU TƯỢNG VĂN HÓA -->
      <div class="tab-pane" id="paneSignificance">
        <div class="dossier-section">
          <h4 class="dossier-section-title">${ICONS.star} <span>Ý Nghĩa Lịch Sử & Chủ Quyền Dân Tộc</span></h4>
          <p style="color: #f1f5f9; font-size: 1.05rem; line-height: 1.8; margin-bottom: 20px;">
            ${this.escapeHtml(relic.significance || "Bảo vật quốc gia là di sản vô giá khẳng định truyền thống văn hiến và bản sắc độc lập tự chủ của dân tộc Việt Nam.")}
          </p>
        </div>

        <div class="dossier-section" style="background: rgba(18, 24, 38, 0.5); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <h4 class="dossier-section-title">${ICONS.shield} <span>Giá Trị Tinh Thần & Di Sản Văn Hóa</span></h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">
            Hiện vật không chỉ là bằng chứng vật chất cho trình độ chế tác bậc thầy mà còn phản ánh thế giới quan nhân sinh, tâm thức hướng về cội nguồn và ý chí quật cường bảo vệ chủ quyền non sông đất nước của các bậc tiền nhân.
          </p>
        </div>
      </div>

      <!-- TAB 4: THÔNG SỐ PHÁP LÝ & KHOA HỌC -->
      <div class="tab-pane" id="paneSpecs">
        <div class="dossier-section">
          <h4 class="dossier-section-title">${ICONS.legal} <span>Hồ Sơ Pháp Lý & Thông Số Kỹ Thuật</span></h4>
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

  // ------------------------------------------------------------------------
  // Điều hướng chuyển sang bảo vật kế tiếp hoặc bảo vật trước đó
  // ------------------------------------------------------------------------
  nextRelic() {
    this.openDossier(this.currentRelicIndex + 1);
  }

  prevRelic() {
    this.openDossier(this.currentRelicIndex - 1);
  }

  // ------------------------------------------------------------------------
  // Các hàm điều khiển thu phóng ảnh hiện vật (Zoom Tools)
  // ------------------------------------------------------------------------
  zoomIn() {
    // Phóng to thêm 25%, tối đa gấp 3 lần (300%)
    this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
    this.updateZoom();
  }

  zoomOut() {
    // Thu nhỏ lại 25%, tối thiểu 75%
    this.zoomLevel = Math.max(0.75, this.zoomLevel - 0.25);
    this.updateZoom();
  }

  zoomReset() {
    // Đặt lại kích thước gốc 100%
    this.zoomLevel = 1;
    this.updateZoom();
  }

  updateZoom() {
    if (this.modalImg) {
      this.modalImg.style.transform = `scale(${this.zoomLevel})`;
    }
  }

  // ------------------------------------------------------------------------
  // Tính năng Thuyết minh Audio Guide (Web Speech Synthesis API)
  // Đọc to thuyết minh giới thiệu bảo vật bằng giọng tiếng Việt
  // ------------------------------------------------------------------------
  toggleAudioGuide() {
    // Nếu đang phát, bấm vào sẽ dừng lại
    if (this.isSpeaking) {
      this.stopAudio();
      return;
    }

    // Kiểm tra trình duyệt có hỗ trợ SpeechSynthesis hay không
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt của bạn không hỗ trợ tính năng thuyết minh giọng nói tự động.");
      return;
    }

    const relic = this.relics[this.currentRelicIndex];
    if (!relic) return;

    // Tổng hợp nội dung thuyết minh
    const speechText = `${relic.title}. Niên đại: ${relic.era}. ${relic.desc}. Bối cảnh: ${relic.discovery || ""}. Ý nghĩa: ${relic.significance || ""}`;

    window.speechSynthesis.cancel();
    this.audioSpeech = new SpeechSynthesisUtterance(speechText);
    this.audioSpeech.lang = "vi-VN"; // Thiết lập giọng đọc tiếng Việt
    this.audioSpeech.rate = 0.95;    // Tốc độ đọc diễn cảm tự nhiên

    // Sự kiện khi giọng đọc bắt đầu phát
    this.audioSpeech.onstart = () => {
      this.isSpeaking = true;
      this.btnAudio.classList.add("playing");
      this.btnAudio.innerHTML = `${ICONS.audioStop} <span>ĐANG PHÁT THUYẾT MINH…</span>`;
    };

    // Sự kiện khi đọc xong hoặc xảy ra lỗi
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
      this.btnAudio.innerHTML = `${ICONS.audioPlay} <span>NGHE THUYẾT MINH AUDIO</span>`;
    }
  }

  // ------------------------------------------------------------------------
  // Lắng nghe và xử lý toàn bộ sự kiện người dùng (Bàn phím, Chuột, Cuộn trang)
  // ------------------------------------------------------------------------
  bindEvents() {
    // 1. Tìm kiếm tức thời khi người dùng gõ vào ô tìm kiếm
    this.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.renderExhibits();
    });

    // 2. Lọc theo thời kỳ lịch sử khi bấm các nút thời kỳ
    this.filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentFilter = btn.dataset.filter;
        this.renderExhibits();
      });
    });

    // 3. Chuyển đổi giữa chế độ Trưng bày (Grid) và Danh mục hồ sơ (List)
    this.viewBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.viewBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.viewMode = btn.dataset.view;
        this.renderExhibits();
      });
    });

    // 4. Chuyển đổi 4 Tab trong cửa sổ modal
    this.modalTabBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => this.setModalTab(i));
    });

    // 5. Các nút điều hướng trong Modal (Trước, Kế tiếp, Đóng, Audio Guide)
    this.btnPrevRelic.addEventListener("click", () => this.prevRelic());
    this.btnNextRelic.addEventListener("click", () => this.nextRelic());
    this.btnCloseModal.addEventListener("click", () => this.closeDossier());
    this.btnAudio.addEventListener("click", () => this.toggleAudioGuide());

    // 6. Các nút công cụ thu phóng ảnh
    this.btnZoomIn.addEventListener("click", () => this.zoomIn());
    this.btnZoomOut.addEventListener("click", () => this.zoomOut());
    this.btnZoomReset.addEventListener("click", () => this.zoomReset());

    // 7. Nhấp chuột ra vùng mờ bên ngoài modal để đóng
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) {
        this.closeDossier();
      }
    });

    // 8. Hỗ trợ phím tắt bàn phím:
    // - Escape: Đóng modal
    // - Phím mũi tên Trái (ArrowLeft): Bảo vật trước
    // - Phím mũi tên Phải (ArrowRight): Bảo vật tiếp theo
    window.addEventListener("keydown", (e) => {
      if (!this.modalEl.classList.contains("active")) return;
      if (e.key === "Escape") this.closeDossier();
      if (e.key === "ArrowLeft") this.prevRelic();
      if (e.key === "ArrowRight") this.nextRelic();
    });

    // 9. Hiệu ứng làm mờ và đổ bóng thanh header khi cuộn trang
    window.addEventListener("scroll", () => {
      const header = document.getElementById("museumHeader");
      if (header) {
        header.classList.toggle("scrolled", window.scrollY > 40);
      }
    }, { passive: true });
  }

  // ------------------------------------------------------------------------
  // Hàm bảo mật chống tấn công XSS (Cross-Site Scripting) khi chèn dữ liệu
  // ------------------------------------------------------------------------
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

// ==========================================================================
// 3. KHỞI TẠO ỨNG DỤNG BẢO TÀNG KHI TRÌNH DUYỆT TẢI XONG DOM
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  window.museumApp = new VietnamNationalMuseum();
});
