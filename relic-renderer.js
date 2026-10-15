// Vietnamese Historical Relics Archive & Historical Dossier Renderer
// Displays authentic photographs and comprehensive archaeological field records on the CRT TV

import { VIETNAM_RELICS } from "./vietnam-history-data.js";

export class RelicRenderer {
  constructor(canvas, width = 960, height = 720) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = width;
    this.height = height;

    this.relicIndex = 0;
    this.tabIndex = 0; // 0: Tổng quan, 1: Ghi chép lịch sử, 2: Ý nghĩa & Sự kiện
    this.scrollOffset = 0;
    this.maxScroll = 0;
    this.zoomPhoto = false;

    // Load authentic museum photographs
    this.images = new Map();
    this.loadImages();
  }

  loadImages() {
    VIETNAM_RELICS.forEach((relic, idx) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = relic.image;
      img.onload = () => {
        this.images.set(idx, img);
      };
      this.images.set(idx, img);
    });
  }

  nextRelic() {
    this.relicIndex = (this.relicIndex + 1) % VIETNAM_RELICS.length;
    this.scrollOffset = 0;
    this.zoomPhoto = false;
  }

  prevRelic() {
    this.relicIndex = (this.relicIndex - 1 + VIETNAM_RELICS.length) % VIETNAM_RELICS.length;
    this.scrollOffset = 0;
    this.zoomPhoto = false;
  }

  setTab(tab) {
    this.tabIndex = Math.max(0, Math.min(2, tab));
    this.scrollOffset = 0;
  }

  toggleWireframe() {
    this.zoomPhoto = !this.zoomPhoto;
  }

  toggleAutoRotate() {
    this.nextRelic();
  }

  setLightMode(mode) {
    this.setTab((this.tabIndex + 1) % 3);
  }

  handlePointerDown(x, y) {
    this.isDragging = true;
    this.dragStartY = y;
    this.dragStartScroll = this.scrollOffset;
  }

  handlePointerMove(x, y) {
    if (!this.isDragging) return;
    const dy = (this.dragStartY - y) * 1.5;
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.dragStartScroll + dy));
  }

  handlePointerUp() {
    this.isDragging = false;
  }

  handleWheel(deltaY) {
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + deltaY * 0.5));
  }

  handleClick(uvX, uvY) {
    if (typeof uvX !== "number" || typeof uvY !== "number" || isNaN(uvX) || isNaN(uvY)) {
      return false;
    }

    // Check fullscreen zoom mode first: clicking anywhere exits zoom mode
    if (this.zoomPhoto) {
      this.zoomPhoto = false;
      return true;
    }

    // Top Header: Counter area (top right) or Title area
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

    // Tab buttons on top of right panel (uvY between 0.08 and 0.20, uvX >= 0.48)
    if (uvY >= 0.08 && uvY <= 0.20 && uvX >= 0.48) {
      if (uvX < 0.65) this.setTab(0);
      else if (uvX < 0.82) this.setTab(1);
      else this.setTab(2);
      return true;
    }

    // Bottom Navigation Bar on Left Panel (Buttons: Prev, Zoom, Next)
    // Drawn at y = 579 to 613 (uvY ~ 0.75 to 0.90)
    if (uvY >= 0.75 && uvY <= 0.90 && uvX < 0.50) {
      // Prev Button: x from 0 to 0.18
      if (uvX <= 0.18) {
        this.prevRelic();
        return true;
      }
      // Zoom Button: x from 0.18 to 0.32
      if (uvX > 0.18 && uvX <= 0.32) {
        this.zoomPhoto = true;
        return true;
      }
      // Next Button: x from 0.32 to 0.50
      if (uvX > 0.32) {
        this.nextRelic();
        return true;
      }
    }

    // Bottom Status Bar across the whole screen (uvY > 0.90)
    if (uvY > 0.90) {
      if (uvX > 0.50) {
        this.nextRelic();
        return true;
      } else {
        this.prevRelic();
        return true;
      }
    }

    // Authentic Museum Photograph click strictly in photo box:
    // photoX = 36, photoY = 87, photoW = 420, photoH = 370
    // uvX: 0.03 to 0.48, uvY: 0.11 to 0.64
    if (uvX >= 0.03 && uvX <= 0.48 && uvY >= 0.11 && uvY <= 0.64) {
      this.zoomPhoto = true;
      return true;
    }

    // Right panel content click (can cycle tabs if clicked on tab content header)
    if (uvX >= 0.50 && uvY >= 0.20 && uvY <= 0.30) {
      this.setTab((this.tabIndex + 1) % 3);
      return true;
    }

    return false;
  }

  render(t, dt) {
    const g = this.ctx;
    const w = this.width;
    const h = this.height;
    const relic = VIETNAM_RELICS[this.relicIndex] || VIETNAM_RELICS[0];

    // Background: CRT Slate Navy
    g.fillStyle = "#070a12";
    g.fillRect(0, 0, w, h);

    if (this.zoomPhoto) {
      this.renderZoomedPhoto(g, w, h, relic);
      return;
    }

    // 1. Top Header Banner
    this.renderHeader(g, w, h, relic);

    // 2. Left Column: Authentic Museum Photo & Controls
    this.renderPhotoPanel(g, 24, 75, 444, 550, relic);

    // 3. Right Column: Archival Dossier & Historical Notes
    this.renderDossierPanel(g, 486, 75, 450, 550, relic);

    // 4. Bottom Navigation & Status Bar
    this.renderFooter(g, w, h);

    // CRT Scanlines overlay
    g.fillStyle = "rgba(0, 0, 0, 0.08)";
    for (let y = 0; y < h; y += 4) {
      g.fillRect(0, y, w, 1.5);
    }
  }

  renderHeader(g, w, h, relic) {
    // Header container
    g.fillStyle = "#0c1322";
    g.fillRect(0, 0, w, 64);
    g.strokeStyle = "#253450";
    g.lineWidth = 1;
    g.strokeRect(0, 0, w, 64);

    // Museum icon & badge
    g.fillStyle = "#d4a441";
    g.font = "bold 24px VT323, monospace";
    g.textAlign = "left";
    g.fillText("◆ BẢO TÀNG LỊCH SỬ VIỆT NAM", 24, 28);

    g.fillStyle = "#7ec8f8";
    g.font = "17px VT323, monospace";
    g.fillText("HỒ SƠ LƯU TRỮ CỔ VẬT & BẢO VẬT QUỐC GIA", 24, 50);

    // Current Counter
    g.fillStyle = "#ffd56b";
    g.font = "bold 22px VT323, monospace";
    g.textAlign = "right";
    g.fillText(`BẢO VẬT [ ${String(this.relicIndex + 1).padStart(2, "0")} / ${String(VIETNAM_RELICS.length).padStart(2, "0")} ]`, w - 24, 28);

    g.fillStyle = "#9eb5db";
    g.font = "16px VT323, monospace";
    g.fillText(relic.badge, w - 24, 50);
  }

  renderPhotoPanel(g, x, y, pw, ph, relic) {
    // Frame background
    g.fillStyle = "#0c111c";
    g.fillRect(x, y, pw, ph);
    g.strokeStyle = "#2d3b55";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, pw, ph);

    // Gold brass corners
    this.drawCornerDeco(g, x, y, pw, ph, "#d4a441");

    // Photo Area
    const photoX = x + 12;
    const photoY = y + 12;
    const photoW = pw - 24;
    const photoH = 370;

    g.fillStyle = "#04060a";
    g.fillRect(photoX, photoY, photoW, photoH);
    g.strokeStyle = "#1b2436";
    g.strokeRect(photoX, photoY, photoW, photoH);

    // Draw authentic relic photograph
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

      // Museum spotlight vignette
      const rad = Math.max(dw, dh) * 0.7;
      const grad = g.createRadialGradient(photoX + photoW / 2, photoY + photoH / 2, rad * 0.4, photoX + photoW / 2, photoY + photoH / 2, rad);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,4,10,0.5)");
      g.fillStyle = grad;
      g.fillRect(photoX, photoY, photoW, photoH);
    } else {
      // Loading state
      g.fillStyle = "#8ba0c2";
      g.font = "20px VT323, monospace";
      g.textAlign = "center";
      g.fillText("ĐANG TẢI ẢNH BẢO VẬT…", photoX + photoW / 2, photoY + photoH / 2);
    }

    // Photo Badge Ribbon
    g.fillStyle = "rgba(10, 16, 28, 0.88)";
    g.fillRect(photoX + 8, photoY + photoH - 32, photoW - 16, 26);
    g.fillStyle = "#f5cb6c";
    g.font = "bold 15px VT323, monospace";
    g.textAlign = "center";
    g.fillText("ẢNH HIỆN VẬT GỐC LƯU TRỮ BẢO TÀNG", photoX + photoW / 2, photoY + photoH - 14);

    // Details below photo
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

    // Navigation buttons
    const btnY = y + ph - 46;
    const btnH = 34;
    
    // Prev Button
    this.drawButton(g, x + 12, btnY, 128, btnH, "◀ TRƯỚC (A)", "#19253a", "#ffd56b");
    // Zoom Button
    this.drawButton(g, x + 148, btnY, 140, btnH, "[+] PHÓNG TO (Z)", "#22324e", "#7ec8f8");
    // Next Button
    this.drawButton(g, x + 296, btnY, 136, btnH, "TIẾP THEO ▶ (D)", "#19253a", "#ffd56b");
  }

  renderDossierPanel(g, x, y, pw, ph, relic) {
    // Panel background
    g.fillStyle = "#090d16";
    g.fillRect(x, y, pw, ph);
    g.strokeStyle = "#253450";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, pw, ph);

    // Tab Header Bar
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

    // Content container clip area
    const cx = x + 16;
    const cy = y + tabH + 16;
    const cw = pw - 32;
    const ch = ph - tabH - 32;

    g.save();
    g.beginPath();
    g.rect(cx, cy, cw, ch);
    g.clip();

    // Render Tab Content
    if (this.tabIndex === 0) {
      this.renderOverviewTab(g, cx, cy, cw, relic);
    } else if (this.tabIndex === 1) {
      this.renderNotesTab(g, cx, cy, cw, ch, relic);
    } else {
      this.renderSignificanceTab(g, cx, cy, cw, ch, relic);
    }

    g.restore();
  }

  renderOverviewTab(g, x, y, w, relic) {
    g.textAlign = "left";

    // Big Relic Title
    g.fillStyle = "#ffd56b";
    g.font = "bold 26px Archivo, sans-serif";
    g.fillText(relic.title, x, y + 24);

    // Era / Period
    g.fillStyle = "#7ec8f8";
    g.font = "18px VT323, monospace";
    g.fillText("◆ NIÊN ĐẠI: " + relic.era.toUpperCase(), x, y + 54);

    // Divider
    g.strokeStyle = "#253450";
    g.beginPath();
    g.moveTo(x, y + 66);
    g.lineTo(x + w, y + 66);
    g.stroke();

    // Archaeological specs grid
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

    // Overview paragraph
    curY += 8;
    g.fillStyle = "#ffd56b";
    g.font = "bold 16px VT323, monospace";
    g.fillText("MÔ TẢ KHẢO CỔ & TỔNG QUAN:", x, curY);
    curY += 22;

    g.fillStyle = "#cbd8eb";
    g.font = "14px Archivo, sans-serif";
    this.drawWrappedText(g, relic.desc, x, curY, w, 22);
  }

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

    // Detailed field notes
    const notes = relic.notes || [];
    notes.forEach((note, idx) => {
      // Note index badge
      g.fillStyle = "#d4a441";
      g.font = "bold 17px VT323, monospace";
      g.fillText(`[GHI CHÉP 0${idx + 1}]`, x, curY);
      curY += 20;

      // Note content
      g.fillStyle = "#dce7f5";
      g.font = "14px Archivo, sans-serif";
      const lines = this.drawWrappedText(g, note, x + 8, curY, w - 16, 21);
      curY += lines * 21 + 18;
    });

    // Calculate maximum scroll
    const totalH = curY + this.scrollOffset - y;
    this.maxScroll = Math.max(0, totalH - h);

    // Draw scroll indicator bar if content overflows
    if (this.maxScroll > 0) {
      const barH = Math.max(30, (h / totalH) * h);
      const barY = y + (this.scrollOffset / this.maxScroll) * (h - barH);
      g.fillStyle = "#1e293b";
      g.fillRect(x + w - 6, y, 4, h);
      g.fillStyle = "#d4a441";
      g.fillRect(x + w - 6, barY, 4, barH);
    }
  }

  renderSignificanceTab(g, x, y, w, h, relic) {
    g.textAlign = "left";
    let curY = y + 20;

    g.fillStyle = "#ffd56b";
    g.font = "bold 20px VT323, monospace";
    g.fillText("◆ Ý NGHĨA LỊCH SỬ & CHỦ QUYỀN DÂN TỘC", x, curY);
    curY += 28;

    // Quote Box
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

    // Highlights list
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

    // Archival footnote
    curY += 12;
    g.fillStyle = "#94a3b8";
    g.font = "13px VT323, monospace";
    g.fillText("LƯU TRỮ VÀ GIÁM ĐỊNH THEO QUY CHUẨN BẢO VẬT QUỐC GIA VIỆT NAM", x, curY);
  }

  renderZoomedPhoto(g, w, h, relic) {
    // Dim background
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

      g.strokeStyle = "#d4a441";
      g.lineWidth = 2;
      g.strokeRect(dx - 4, dy - 4, dw + 8, dh + 8);
      g.drawImage(img, dx, dy, dw, dh);
    }

    // Title overlay
    g.fillStyle = "#ffd56b";
    g.font = "bold 24px Archivo, sans-serif";
    g.textAlign = "center";
    g.fillText(relic.title + " – " + relic.era, w / 2, 36);

    // Prompt
    g.fillStyle = "#7ec8f8";
    g.font = "18px VT323, monospace";
    g.fillText("[ NHẤN PHÍM Z HOẶC CLICK VÀO MÀN HÌNH ĐỂ QUAY LẠI HỒ SƠ GHI CHÉP ]", w / 2, h - 28);
  }

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

  drawCornerDeco(g, x, y, w, h, color) {
    const s = 10;
    g.strokeStyle = color;
    g.lineWidth = 2;
    // Top-left
    g.strokeRect(x, y, s, s);
    // Top-right
    g.strokeRect(x + w - s, y, s, s);
    // Bottom-left
    g.strokeRect(x, y + h - s, s, s);
    // Bottom-right
    g.strokeRect(x + w - s, y + h - s, s, s);
  }

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
