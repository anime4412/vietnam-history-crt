// ==============================================================================
// relic-renderer.js - BỘ KẾ XUẤT HỒ SƠ LƯU TRỮ VÀ HÌNH ẢNH CỔ VẬT LỊCH SỬ VIỆT NAM
// Dự án: Vietnam History CRT Experience (Không gian Bảo tàng Lịch sử CRT 3D)
// ==============================================================================
// Chức năng:
// 1. Kết xuất đồ họa 2D trực tiếp lên Canvas độ phân giải cao (960x720) để ánh xạ
//    làm chất liệu hiển thị (CanvasTexture) trên màn hình TV CRT retro trong phòng 3D.
// 2. Trình diễn toàn bộ hình ảnh thực tế, hồ sơ giám định khảo cổ học, thông số
//    chất liệu, niên đại, địa điểm khai quật và ý nghĩa chủ quyền của 7 Bảo vật Quốc gia.
// 3. Hỗ trợ hệ thống chuyển tab (Tổng quan, Ghi chép khảo cổ, Ý nghĩa dân tộc),
//    cuộn trang mượt mà bằng chuột/kéo thả, và chế độ phóng to toàn cảnh (Zoom).
// ==============================================================================

import { VIETNAM_RELICS } from "./vietnam-history-data.js";

export class RelicRenderer {
  /**
   * Khởi tạo bộ kết xuất cổ vật trên màn hình TV CRT
   * @param {HTMLCanvasElement} canvas - Thẻ Canvas dùng để vẽ giao diện 2D
   * @param {number} width - Chiều rộng Canvas (mặc định 960px tỉ lệ chuẩn 4:3)
   * @param {number} height - Chiều cao Canvas (mặc định 720px)
   */
  constructor(canvas, width = 960, height = 720) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = width;
    this.height = height;

    // Chỉ số cổ vật hiện hành đang được trưng bày (0 đến VIETNAM_RELICS.length - 1)
    this.relicIndex = 0;

    // Chỉ số tab nội dung:
    // 0: Tổng quan & Thông số kỹ thuật
    // 1: Tư liệu ghi chép hiện trường & Khảo cổ học
    // 2: Ý nghĩa lịch sử & Điểm nhấn chủ quyền
    this.tabIndex = 0;

    // Quản lý vị trí cuộn văn bản cho các tab nội dung dài
    this.scrollOffset = 0;
    this.maxScroll = 0;

    // Trạng thái phóng to ảnh cổ vật toàn màn hình TV
    this.zoomPhoto = false;

    // Bộ nhớ đệm (Cache) lưu trữ ảnh đã tải của tất cả bảo vật để chuyển đổi tức thì
    this.images = new Map();
    this.loadImages();
  }

  /**
   * Tải trước toàn bộ hình ảnh cổ vật gốc vào bộ nhớ đệm
   * Đảm bảo khi người dùng chuyển cổ vật không bị giật lag hay nhấp nháy màn hình
   */
  loadImages() {
    VIETNAM_RELICS.forEach((relic, idx) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Cho phép tải chéo nguồn khi deploy
      img.src = relic.image;
      img.onload = () => {
        this.images.set(idx, img);
      };
      this.images.set(idx, img);
    });
  }

  /**
   * Chuyển sang xem bảo vật kế tiếp (vòng lặp vô tận từ 0 đến n-1)
   */
  nextRelic() {
    this.relicIndex = (this.relicIndex + 1) % VIETNAM_RELICS.length;
    this.scrollOffset = 0; // Đặt lại cuộn trang về đầu
    this.zoomPhoto = false; // Thoát chế độ zoom nếu đang mở
  }

  /**
   * Quay lại xem bảo vật phía trước
   */
  prevRelic() {
    this.relicIndex = (this.relicIndex - 1 + VIETNAM_RELICS.length) % VIETNAM_RELICS.length;
    this.scrollOffset = 0;
    this.zoomPhoto = false;
  }

  /**
   * Chuyển tab nội dung trực tiếp theo chỉ số (0, 1 hoặc 2)
   * @param {number} tab - Chỉ số tab mục tiêu
   */
  setTab(tab) {
    this.tabIndex = Math.max(0, Math.min(2, tab));
    this.scrollOffset = 0;
  }

  /**
   * Bật/Tắt chế độ xem ảnh toàn màn hình phóng to
   */
  toggleWireframe() {
    this.zoomPhoto = !this.zoomPhoto;
  }

  /**
   * Tự động duyệt sang cổ vật tiếp theo
   */
  toggleAutoRotate() {
    this.nextRelic();
  }

  /**
   * Xoay vòng qua 3 tab ghi chép
   */
  setLightMode(mode) {
    this.setTab((this.tabIndex + 1) % 3);
  }

  /**
   * Bắt đầu thao tác kéo chuột để cuộn văn bản
   * @param {number} x - Tọa độ X chuột
   * @param {number} y - Tọa độ Y chuột
   */
  handlePointerDown(x, y) {
    this.isDragging = true;
    this.dragStartY = y;
    this.dragStartScroll = this.scrollOffset;
  }

  /**
   * Cập nhật vị trí cuộn khi người dùng đang di chuyển chuột kéo thả
   * @param {number} x - Tọa độ X chuột hiện tại
   * @param {number} y - Tọa độ Y chuột hiện tại
   */
  handlePointerMove(x, y) {
    if (!this.isDragging) return;
    const dy = (this.dragStartY - y) * 1.5;
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.dragStartScroll + dy));
  }

  /**
   * Kết thúc thao tác kéo chuột
   */
  handlePointerUp() {
    this.isDragging = false;
  }

  /**
   * Xử lý sự kiện lăn bánh xe chuột (Mouse Wheel) để cuộn văn bản đọc hồ sơ
   * @param {number} deltaY - Độ lệch lăn chuột dọc
   */
  handleWheel(deltaY) {
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + deltaY * 0.5));
  }

  /**
   * Xử lý tương tác nhấn chuột dựa trên tọa độ UV chuẩn hóa (0.0 đến 1.0)
   * Được ánh xạ từ va chạm tia Raycaster 3D trên bề mặt cong của màn hình CRT
   * @param {number} uvX - Tọa độ UV ngang (0.0: mép trái, 1.0: mép phải)
   * @param {number} uvY - Tọa độ UV dọc (0.0: đỉnh màn hình, 1.0: đáy màn hình)
   * @returns {boolean} - Trả về true nếu sự kiện click được xử lý thành công
   */
  handleClick(uvX, uvY) {
    if (typeof uvX !== "number" || typeof uvY !== "number" || isNaN(uvX) || isNaN(uvY)) {
      return false;
    }

    // 1. Nếu đang ở chế độ xem ảnh phóng to: Click bất kỳ đâu trên màn hình sẽ quay lại hồ sơ
    if (this.zoomPhoto) {
      this.zoomPhoto = false;
      return true;
    }

    // 2. Thanh tiêu đề phía trên cùng (uvY < 0.10)
    // - Click góc trên bên phải: Chuyển sang cổ vật tiếp theo
    // - Click góc trên bên trái: Quay lại cổ vật trước đó
    if (uvY < 0.10) {
      if (uvX > 0.70) {
        this.nextRelic();
        return true;
      }
      if (uvX < 0.30) {
        this.prevRelic();
        return true;
      }
    }

    // 3. Hệ thống 3 nút Tab ở cột phải (uvY từ 0.08 đến 0.20, uvX >= 0.48)
    if (uvY >= 0.08 && uvY <= 0.20 && uvX >= 0.48) {
      if (uvX < 0.65) this.setTab(0);       // Tab 1: Tổng quan
      else if (uvX < 0.82) this.setTab(1);  // Tab 2: Ghi chép lịch sử
      else this.setTab(2);                  // Tab 3: Ý nghĩa & Sự kiện
      return true;
    }

    // 4. Thanh điều khiển phía dưới ảnh ở cột trái (Nút: Trước, Phóng to, Tiếp theo)
    // Tọa độ tương ứng: uvY ~ 0.75 đến 0.90, uvX < 0.50
    if (uvY >= 0.75 && uvY <= 0.90 && uvX < 0.50) {
      if (uvX <= 0.18) {
        this.prevRelic(); // Nút Trước
        return true;
      }
      if (uvX > 0.18 && uvX <= 0.32) {
        this.zoomPhoto = true; // Nút Phóng to
        return true;
      }
      if (uvX > 0.32) {
        this.nextRelic(); // Nút Tiếp theo
        return true;
      }
    }

    // 5. Thanh trạng thái ở đáy màn hình (uvY > 0.90)
    if (uvY > 0.90) {
      if (uvX > 0.50) {
        this.nextRelic();
        return true;
      } else {
        this.prevRelic();
        return true;
      }
    }

    // 6. Nhấp chuột trực tiếp vào khung ảnh hiện vật để phóng to toàn màn hình
    // Tọa độ khung ảnh: uvX từ 0.03 đến 0.48, uvY từ 0.11 đến 0.64
    if (uvX >= 0.03 && uvX <= 0.48 && uvY >= 0.11 && uvY <= 0.64) {
      this.zoomPhoto = true;
      return true;
    }

    // 7. Nhấp vào tiêu đề hồ sơ bên phải để chuyển nhanh qua các tab
    if (uvX >= 0.50 && uvY >= 0.20 && uvY <= 0.30) {
      this.setTab((this.tabIndex + 1) % 3);
      return true;
    }

    return false;
  }

  /**
   * Chu trình vẽ chính của Canvas mỗi khung hình (Render Loop)
   * @param {number} t - Thời gian tính bằng giây
   * @param {number} dt - Khoảng cách thời gian giữa 2 khung hình (delta time)
   */
  render(t, dt) {
    const g = this.ctx;
    const w = this.width;
    const h = this.height;
    const relic = VIETNAM_RELICS[this.relicIndex] || VIETNAM_RELICS[0];

    // Vẽ màu nền đen xanh đậm đặc trưng của màn hình CRT studio
    g.fillStyle = "#070a12";
    g.fillRect(0, 0, w, h);

    // Nếu đang ở trạng thái phóng to ảnh, ưu tiên vẽ màn hình Zoom riêng biệt
    if (this.zoomPhoto) {
      this.renderZoomedPhoto(g, w, h, relic);
      return;
    }

    // 1. Vẽ thanh tiêu đề chính (Header Banner)
    this.renderHeader(g, w, h, relic);

    // 2. Vẽ cột bên trái: Khung ảnh chụp hiện vật gốc & Các nút điều hướng
    this.renderPhotoPanel(g, 24, 75, 444, 550, relic);

    // 3. Vẽ cột bên phải: Hồ sơ giám định khảo cổ học & Ghi chép chi tiết
    this.renderDossierPanel(g, 486, 75, 450, 550, relic);

    // 4. Vẽ thanh trạng thái và hướng dẫn phím tắt ở đáy màn hình
    this.renderFooter(g, w, h);

    // 5. Hiệu ứng quét dòng quét ngang Retro Scanlines của màn hình bóng đèn CRT
    g.fillStyle = "rgba(0, 0, 0, 0.08)";
    for (let y = 0; y < h; y += 4) {
      g.fillRect(0, y, w, 1.5);
    }
  }

  /**
   * Vẽ thanh tiêu đề phía trên cùng của màn hình CRT
   */
  renderHeader(g, w, h, relic) {
    // Khung nền tiêu đề
    g.fillStyle = "#0c1322";
    g.fillRect(0, 0, w, 64);
    g.strokeStyle = "#253450";
    g.lineWidth = 1;
    g.strokeRect(0, 0, w, 64);

    // Biểu tượng và tên bảo tàng
    g.fillStyle = "#d4a441";
    g.font = "bold 24px VT323, monospace";
    g.textAlign = "left";
    g.fillText("◆ BẢO TÀNG LỊCH SỬ VIỆT NAM", 24, 28);

    g.fillStyle = "#7ec8f8";
    g.font = "17px VT323, monospace";
    g.fillText("HỒ SƠ LƯU TRỮ CỔ VẬT & BẢO VẬT QUỐC GIA", 24, 50);

    // Bộ đếm số thứ tự bảo vật [ 01 / 07 ]
    g.fillStyle = "#ffd56b";
    g.font = "bold 22px VT323, monospace";
    g.textAlign = "right";
    g.fillText(`BẢO VẬT [ ${String(this.relicIndex + 1).padStart(2, "0")} / ${String(VIETNAM_RELICS.length).padStart(2, "0")} ]`, w - 24, 28);

    // Huy hiệu pháp lý công nhận bảo vật quốc gia
    g.fillStyle = "#9eb5db";
    g.font = "16px VT323, monospace";
    g.fillText(relic.badge, w - 24, 50);
  }

  /**
   * Vẽ cột bên trái hiển thị ảnh chụp thực tế và thông tin vắn tắt
   */
  renderPhotoPanel(g, x, y, pw, ph, relic) {
    // Khung viền ngoài
    g.fillStyle = "#0c111c";
    g.fillRect(x, y, pw, ph);
    g.strokeStyle = "#2d3b55";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, pw, ph);

    // Họa tiết góc bằng đồng kim loại cổ điển
    this.drawCornerDeco(g, x, y, pw, ph, "#d4a441");

    // Vùng ảnh cổ vật
    const photoX = x + 12;
    const photoY = y + 12;
    const photoW = pw - 24;
    const photoH = 370;

    g.fillStyle = "#04060a";
    g.fillRect(photoX, photoY, photoW, photoH);
    g.strokeStyle = "#1b2436";
    g.strokeRect(photoX, photoY, photoW, photoH);

    // Vẽ ảnh chụp thật của cổ vật với tỉ lệ co giãn thích ứng hoàn hảo (Aspect Ratio Fit)
    const img = this.images.get(this.relicIndex);
    if (img && img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.min((photoW - 16) / iw, (photoH - 16) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = photoX + (photoW - dw) / 2;
      const dy = photoY + (photoH - dh) / 2;

      g.drawImage(img, dx, dy, dw, dh);

      // Hiệu ứng ánh sáng tỏa tròn (Radial Vignette Spotlight) tập trung vào cổ vật
      const rad = Math.max(dw, dh) * 0.7;
      const grad = g.createRadialGradient(photoX + photoW / 2, photoY + photoH / 2, rad * 0.4, photoX + photoW / 2, photoY + photoH / 2, rad);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,4,10,0.5)");
      g.fillStyle = grad;
      g.fillRect(photoX, photoY, photoW, photoH);
    } else {
      // Trạng thái đang tải ảnh
      g.fillStyle = "#8ba0c2";
      g.font = "20px VT323, monospace";
      g.textAlign = "center";
      g.fillText("ĐANG TẢI ẢNH BẢO VẬT…", photoX + photoW / 2, photoY + photoH / 2);
    }

    // Dải ruy băng chứng nhận ảnh hiện vật gốc
    g.fillStyle = "rgba(10, 16, 28, 0.88)";
    g.fillRect(photoX + 8, photoY + photoH - 32, photoW - 16, 26);
    g.fillStyle = "#f5cb6c";
    g.font = "bold 15px VT323, monospace";
    g.textAlign = "center";
    g.fillText("ẢNH HIỆN VẬT GỐC LƯU TRỮ BẢO TÀNG", photoX + photoW / 2, photoY + photoH - 14);

    // Thông tin chất liệu & địa điểm lưu giữ phía dưới ảnh
    const infoY = photoY + photoH + 16;
    g.textAlign = "left";
    g.fillStyle = "#ffd56b";
    g.font = "bold 16px VT323, monospace";
    g.fillText("CHẤT LIỆU:", x + 16, infoY);
    g.fillStyle = "#d2dded";
    g.font = "14px Archivo, sans-serif";
    this.drawWrappedText(g, relic.material, x + 92, infoY - 1, pw - 108, 18, 2);

    g.fillStyle = "#ffd56b";
    g.font = "bold 16px VT323, monospace";
    g.fillText("LƯU GIỮ:", x + 16, infoY + 42);
    g.fillStyle = "#a8c0e6";
    g.font = "14px Archivo, sans-serif";
    this.drawWrappedText(g, relic.location, x + 92, infoY + 41, pw - 108, 18, 1);

    // Các nút bấm điều hướng bên dưới khung ảnh
    const btnY = y + ph - 46;
    const btnH = 34;
    
    // Nút lùi về cổ vật trước
    this.drawButton(g, x + 12, btnY, 128, btnH, "◀ TRƯỚC (A)", "#19253a", "#ffd56b");
    // Nút phóng to ảnh
    this.drawButton(g, x + 148, btnY, 140, btnH, "[+] PHÓNG TO (Z)", "#22324e", "#7ec8f8");
    // Nút chuyển sang cổ vật tiếp theo
    this.drawButton(g, x + 296, btnY, 136, btnH, "TIẾP THEO ▶ (D)", "#19253a", "#ffd56b");
  }

  /**
   * Vẽ cột bên phải chứa hồ sơ khảo cổ học và các tab chi tiết
   */
  renderDossierPanel(g, x, y, pw, ph, relic) {
    // Khung nền bảng hồ sơ
    g.fillStyle = "#090d16";
    g.fillRect(x, y, pw, ph);
    g.strokeStyle = "#253450";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, pw, ph);

    // Thanh chuyển 3 Tab nội dung
    const tabH = 38;
    const tabW = (pw - 8) / 3;
    const tabs = ["1. TỔNG QUAN", "2. GHI CHÉP LỊCH SỬ", "3. Ý NGHĨA & SỰ KIỆN"];

    for (let i = 0; i < 3; i++) {
      const tx = x + 4 + i * tabW;
      const active = this.tabIndex === i;
      g.fillStyle = active ? "#d4a441" : "#111826";
      g.fillRect(tx, y + 4, tabW - 4, tabH);
      g.strokeStyle = active ? "#ffe79a" : "#223149";
      g.strokeRect(tx, y + 4, tabW - 4, tabH);

      g.fillStyle = active ? "#050912" : "#98aecf";
      g.font = "bold 16px VT323, monospace";
      g.textAlign = "center";
      g.fillText(tabs[i], tx + (tabW - 4) / 2, y + 28);
    }

    // Thiết lập vùng cắt xén (Clip Area) để nội dung cuộn không bị tràn ra ngoài khung
    const cx = x + 16;
    const cy = y + tabH + 16;
    const cw = pw - 32;
    const ch = ph - tabH - 32;

    g.save();
    g.beginPath();
    g.rect(cx, cy, cw, ch);
    g.clip();

    // Rẽ nhánh kết xuất nội dung tương ứng theo tab đang chọn
    if (this.tabIndex === 0) {
      this.renderOverviewTab(g, cx, cy, cw, relic);
    } else if (this.tabIndex === 1) {
      this.renderNotesTab(g, cx, cy, cw, ch, relic);
    } else {
      this.renderSignificanceTab(g, cx, cy, cw, ch, relic);
    }

    g.restore();
  }

  /**
   * Kết xuất Tab 0: Tổng quan cổ vật, niên đại và thông số kích thước
   */
  renderOverviewTab(g, x, y, w, relic) {
    g.textAlign = "left";

    // Tên bảo vật in lớn nổi bật
    g.fillStyle = "#ffd56b";
    g.font = "bold 26px Archivo, sans-serif";
    g.fillText(relic.title, x, y + 24);

    // Niên đại lịch sử
    g.fillStyle = "#7ec8f8";
    g.font = "18px VT323, monospace";
    g.fillText("◆ NIÊN ĐẠI: " + relic.era.toUpperCase(), x, y + 54);

    // Đường gạch ngang phân cách
    g.strokeStyle = "#253450";
    g.beginPath();
    g.moveTo(x, y + 66);
    g.lineTo(x + w, y + 66);
    g.stroke();

    // Lưới thông số khảo cổ học (Kích thước, Chất liệu, Xuất xứ)
    let curY = y + 90;
    const row = (label, val, color = "#e3ecf8") => {
      g.fillStyle = "#d4a441";
      g.font = "bold 16px VT323, monospace";
      g.fillText(label, x, curY);

      g.fillStyle = color;
      g.font = "14px Archivo, sans-serif";
      const lines = this.drawWrappedText(g, val, x + 115, curY - 1, w - 115, 20);
      curY += Math.max(26, lines * 20 + 8);
    };

    row("KÍCH THƯỚC:", relic.dims);
    row("CHẤT LIỆU:", relic.material);
    row("XUẤT XỨ:", relic.discovery);

    // Đoạn văn bản mô tả khảo cổ tổng quan
    curY += 8;
    g.fillStyle = "#ffd56b";
    g.font = "bold 16px VT323, monospace";
    g.fillText("MÔ TẢ KHẢO CỔ & TỔNG QUAN:", x, curY);
    curY += 22;

    g.fillStyle = "#cbd8eb";
    g.font = "14px Archivo, sans-serif";
    this.drawWrappedText(g, relic.desc, x, curY, w, 22);
  }

  /**
   * Kết xuất Tab 1: Tư liệu ghi chép hiện trường khảo cổ chi tiết (Hỗ trợ cuộn chuột)
   */
  renderNotesTab(g, x, y, w, h, relic) {
    g.textAlign = "left";
    let curY = y + 20 - this.scrollOffset;

    g.fillStyle = "#ffd56b";
    g.font = "bold 20px VT323, monospace";
    g.fillText("■ TƯ LIỆU GHI CHÉP HIỆN TRƯỜNG & KHẢO CỔ HỌC", x, curY);
    curY += 26;

    g.fillStyle = "#8ba0c2";
    g.font = "14px VT323, monospace";
    g.fillText("(DÙNG CUỘN CHUỘT HOẶC KÉO ĐỂ ĐỌC HẾT CÁC GHI CHÉP)", x, curY);
    curY += 18;

    g.strokeStyle = "#253450";
    g.beginPath();
    g.moveTo(x, curY);
    g.lineTo(x + w, curY);
    g.stroke();
    curY += 16;

    // Duyệt và vẽ từng mục ghi chép khảo cổ học với huy hiệu số thứ tự vàng
    const notes = relic.notes || [];
    notes.forEach((note, idx) => {
      // Huy hiệu số thứ tự [GHI CHÉP 01]
      g.fillStyle = "#d4a441";
      g.font = "bold 17px VT323, monospace";
      g.fillText(`[GHI CHÉP 0${idx + 1}]`, x, curY);
      curY += 20;

      // Nội dung đoạn ghi chép chi tiết
      g.fillStyle = "#dce7f5";
      g.font = "14px Archivo, sans-serif";
      const lines = this.drawWrappedText(g, note, x + 8, curY, w - 16, 21);
      curY += lines * 21 + 18;
    });

    // Tính toán độ cuộn tối đa cho thanh cuộn dọc
    const totalH = curY + this.scrollOffset - y;
    this.maxScroll = Math.max(0, totalH - h);

    // Vẽ thanh chỉ báo cuộn (Scrollbar) nếu nội dung vượt quá chiều cao khung nhìn
    if (this.maxScroll > 0) {
      const barH = Math.max(30, (h / totalH) * h);
      const barY = y + (this.scrollOffset / this.maxScroll) * (h - barH);
      g.fillStyle = "#1e293b";
      g.fillRect(x + w - 6, y, 4, h);
      g.fillStyle = "#d4a441";
      g.fillRect(x + w - 6, barY, 4, barH);
    }
  }

  /**
   * Kết xuất Tab 2: Ý nghĩa lịch sử, trích dẫn văn kiện và điểm nhấn chủ quyền
   */
  renderSignificanceTab(g, x, y, w, h, relic) {
    g.textAlign = "left";
    let curY = y + 20;

    g.fillStyle = "#ffd56b";
    g.font = "bold 20px VT323, monospace";
    g.fillText("◆ Ý NGHĨA LỊCH SỬ & CHỦ QUYỀN DÂN TỘC", x, curY);
    curY += 28;

    // Hộp trích dẫn nổi bật viền vàng sang trọng
    g.fillStyle = "#111827";
    g.fillRect(x, curY, w, 110);
    g.strokeStyle = "#d4a441";
    g.lineWidth = 1.5;
    g.strokeRect(x, curY, w, 110);

    g.fillStyle = "#ffd56b";
    g.font = "bold 28px VT323, monospace";
    g.fillText("“", x + 12, curY + 28);

    g.fillStyle = "#fef08a";
    g.font = "italic 15px Archivo, sans-serif";
    this.drawWrappedText(g, relic.significance, x + 28, curY + 24, w - 40, 22);
    curY += 135;

    // Danh sách các điểm nhấn lịch sử tiêu biểu
    g.fillStyle = "#7ec8f8";
    g.font = "bold 18px VT323, monospace";
    g.fillText("◆ ĐIỂM NHẤN LỊCH SỬ TIÊU BIỂU:", x, curY);
    curY += 26;

    const highlights = relic.highlights || [];
    highlights.forEach((hl) => {
      g.fillStyle = "#d4a441";
      g.font = "16px VT323, monospace";
      g.fillText("◆", x + 8, curY);

      g.fillStyle = "#e2e8f0";
      g.font = "14px Archivo, sans-serif";
      const lines = this.drawWrappedText(g, hl, x + 28, curY - 2, w - 36, 20);
      curY += lines * 20 + 8;
    });

    // Chú thích quy chuẩn giám định bảo vật quốc gia ở cuối trang
    curY += 12;
    g.fillStyle = "#94a3b8";
    g.font = "13px VT323, monospace";
    g.fillText("LƯU TRỮ VÀ GIÁM ĐỊNH THEO QUY CHUẨN BẢO VẬT QUỐC GIA VIỆT NAM", x, curY);
  }

  /**
   * Kết xuất chế độ xem ảnh toàn màn hình phóng to (Fullscreen Photo Mode)
   */
  renderZoomedPhoto(g, w, h, relic) {
    // Nền tối mờ che phủ toàn bộ màn hình TV
    g.fillStyle = "rgba(4, 7, 14, 0.96)";
    g.fillRect(0, 0, w, h);

    const img = this.images.get(this.relicIndex);
    if (img && img.complete && img.naturalWidth > 0) {
      const maxW = w - 80;
      const maxH = h - 140;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (w - dw) / 2;
      const dy = 50 + (maxH - dh) / 2;

      // Khung viền thếp vàng trang trọng quanh bức ảnh
      g.strokeStyle = "#d4a441";
      g.lineWidth = 2;
      g.strokeRect(dx - 4, dy - 4, dw + 8, dh + 8);
      g.drawImage(img, dx, dy, dw, dh);
    }

    // Tiêu đề bảo vật phía trên đỉnh ảnh
    g.fillStyle = "#ffd56b";
    g.font = "bold 24px Archivo, sans-serif";
    g.textAlign = "center";
    g.fillText(relic.title + " – " + relic.era, w / 2, 36);

    // Hướng dẫn quay lại
    g.fillStyle = "#7ec8f8";
    g.font = "18px VT323, monospace";
    g.fillText("[ NHẤN PHÍM Z HOẶC CLICK VÀO MÀN HÌNH ĐỂ QUAY LẠI HỒ SƠ GHI CHÉP ]", w / 2, h - 28);
  }

  /**
   * Vẽ thanh điều hướng và phím tắt ở chân màn hình TV
   */
  renderFooter(g, w, h) {
    g.fillStyle = "#060911";
    g.fillRect(0, h - 56, w, 56);
    g.strokeStyle = "#1e293b";
    g.beginPath();
    g.moveTo(0, h - 56);
    g.lineTo(w, h - 56);
    g.stroke();

    g.fillStyle = "#facc15";
    g.font = "bold 16px VT323, monospace";
    g.textAlign = "center";
    g.fillText("PHÍM ◀ / ▶: ĐỔI CỔ VẬT · PHÍM 1, 2, 3: ĐỔI TAB GHI CHÉP · MENU BẢO TÀNG: XEM TRƯNG BÀY CHI TIẾT", w / 2, h - 22);
  }

  /**
   * Hàm tiện ích vẽ nút bấm retro với viền sáng
   */
  drawButton(g, bx, by, bw, bh, text, bg, color) {
    g.fillStyle = bg;
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.strokeRect(bx, by, bw, bh);

    g.fillStyle = color;
    g.font = "bold 15px VT323, monospace";
    g.textAlign = "center";
    g.fillText(text, bx + bw / 2, by + bh / 2 + 5);
  }

  /**
   * Hàm tiện ích vẽ các họa tiết góc trang trí hình học
   */
  drawCornerDeco(g, x, y, w, h, color) {
    const s = 10;
    g.strokeStyle = color;
    g.lineWidth = 2;
    // Góc trên bên trái
    g.strokeRect(x, y, s, s);
    // Góc trên bên phải
    g.strokeRect(x + w - s, y, s, s);
    // Góc dưới bên trái
    g.strokeRect(x, y + h - s, s, s);
    // Góc dưới bên phải
    g.strokeRect(x + w - s, y + h - s, s, s);
  }

  /**
   * Hàm tiện ích tự động xuống dòng chữ khi vượt quá chiều rộng cho phép (Word Wrap)
   * @param {CanvasRenderingContext2D} g - Ngữ cảnh vẽ 2D
   * @param {string} text - Đoạn văn bản cần vẽ
   * @param {number} x - Tọa độ X bắt đầu
   * @param {number} y - Tọa độ Y bắt đầu
   * @param {number} maxWidth - Độ rộng tối đa của mỗi dòng
   * @param {number} lineHeight - Khoảng cách chiều cao giữa các dòng
   * @param {number} maxLines - Số dòng tối đa được phép vẽ (tránh tràn khung)
   * @returns {number} - Tổng số dòng thực tế đã vẽ
   */
  drawWrappedText(g, text, x, y, maxWidth, lineHeight, maxLines = 100) {
    const words = String(text || "").split(" ");
    let line = "";
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = g.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        g.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
        linesDrawn++;
        if (linesDrawn >= maxLines) break;
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines && line.length > 0) {
      g.fillText(line, x, y);
      linesDrawn++;
    }
    return linesDrawn;
  }
}
