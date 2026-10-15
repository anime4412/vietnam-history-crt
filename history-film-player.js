// ==============================================================================
// history-film-player.js - TRÌNH PHÁT BĂNG TƯ LIỆU VÀ PHIM LỊCH SỬ VIỆT NAM TRÊN TV CRT
// Dự án: Vietnam History CRT Experience (Không gian Bảo tàng Lịch sử CRT 3D)
// ==============================================================================
// Chức năng:
// 1. Quản lý việc phát các cuộn băng tư liệu lịch sử (VHS Tapes) trên màn hình CRT.
// 2. Tích hợp video tài liệu thật (HTML5 Video Element) đồng bộ cùng hiệu ứng màn hình
//    bóng đèn hình CRT: quét dòng (scanlines), bụi phim xước (scratches), đếm ngược 3-2-1.
// 3. Cung cấp sa bàn chiến thuật đồ họa mô phỏng (Tactical Scenarios) cho các sự kiện
//    lịch sử lớn: Trận Bạch Đằng 938, Ba lần kháng chiến Nguyên Mông, Hành quân Quang Trung,
//    Tuyên ngôn Độc lập Ba Đình 1945, Chiến dịch Điện Biên Phủ 1954, Xe tăng 390 húc cổng Dinh 1975.
// 4. Đồng bộ âm thanh, kiểm soát triệt để chống phát tiếng ngầm khi tắt TV hoặc đẩy băng ra.
// ==============================================================================

import { VIETNAM_TAPES } from "./vietnam-history-data.js";

export class HistoryFilmPlayer {
  /**
   * Khởi tạo trình phát phim tư liệu lịch sử
   * @param {HTMLCanvasElement} canvas - Canvas dùng để vẽ lên màn hình TV
   * @param {CanvasRenderingContext2D} ctx - Ngữ cảnh vẽ 2D
   * @param {number} width - Độ phân giải chiều rộng (1024px)
   * @param {number} height - Độ phân giải chiều cao (768px)
   * @param {AudioContext|null} audioCtx - Bộ máy âm thanh Web Audio API
   */
  constructor(canvas, ctx, width = 1024, height = 768, audioCtx = null) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.audioCtx = audioCtx;

    // Chỉ số cuộn băng đang phát (-1 nếu chưa lắp băng)
    this.tapeIndex = 0;

    // Thời gian phát tính bằng giây
    this.time = 0;
    this.isPlaying = true;

    // Khởi tạo các vết xước và bụi phim nhựa 35mm giả lập
    this.scratches = Array.from({ length: 14 }, () => ({
      x: Math.random() * width,
      speed: (Math.random() - 0.5) * 8,
      opacity: Math.random() * 0.4 + 0.1,
      width: Math.random() * 2 + 1
    }));

    // Bộ nhớ giây đã phát tiếng bíp đếm ngược gần nhất (tránh bíp lặp)
    this.lastBeepSec = -1;

    // Phần tử HTML5 Video ẩn dùng để giải mã và đọc khung hình video thật
    this.videoElement = null;
  }

  /**
   * Dừng hẳn việc phát phim, tắt hoàn toàn video và âm thanh ngầm
   * Gọi khi người dùng ấn nút Eject (Đẩy băng ra) hoặc Tắt nguồn TV
   */
  stop() {
    this.isPlaying = false;
    this.time = 0;
    this.tapeIndex = -1;
    this.lastBeepSec = -1;
    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        this.videoElement.removeAttribute("src"); // Xóa nguồn để trình duyệt giải phóng bộ nhớ
        this.videoElement.load();
      } catch (e) {}
      this.videoElement = null;
    }
  }

  /**
   * Tạm dừng phát phim (Pause)
   */
  pause() {
    this.isPlaying = false;
    if (this.videoElement && !this.videoElement.paused) {
      try {
        this.videoElement.pause();
      } catch (e) {}
    }
  }

  /**
   * Tiếp tục phát phim (Resume)
   */
  resume() {
    this.isPlaying = true;
    if (this.videoElement && this.videoElement.paused && this.videoElement.src) {
      this.videoElement.play().catch(e => {
        console.warn("Resume video failed:", e);
      });
    }
  }

  /**
   * Bắt đầu phát một cuộn băng VHS cụ thể
   * @param {number} index - Số thứ tự cuộn băng trong danh sách VIETNAM_TAPES
   */
  playTape(index) {
    this.tapeIndex = Math.max(0, Math.min(VIETNAM_TAPES.length - 1, index));
    this.time = 0;
    this.isPlaying = true;
    this.lastBeepSec = -1;

    const tape = VIETNAM_TAPES[this.tapeIndex];
    if (tape && tape.videoUrl) {
      this.loadVideo(tape.videoUrl);
    } else if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement = null;
    }
  }

  /**
   * Khởi tạo phần tử Video HTML5 và nạp đường dẫn tệp MP4
   * Áp dụng cơ chế Autoplay Muted thông minh để vượt qua giới hạn chặn phát tự động của trình duyệt
   * @param {string} url - Đường dẫn tệp video (ví dụ: videos/bachdang938.mp4)
   */
  loadVideo(url) {
    if (!this.videoElement) {
      this.videoElement = document.createElement("video");
      this.videoElement.crossOrigin = "anonymous";
      this.videoElement.loop = true;          // Lặp lại tự động khi hết đoạn
      this.videoElement.playsInline = true;   // Phát nội dòng trên di động
    }
    const soundOn = (window.__roomSoundOn !== undefined) ? window.__roomSoundOn : true;
    const tvVol = (window.__tvVolume !== undefined) ? window.__tvVolume : 0.85;

    // Bắt đầu ở chế độ tắt tiếng (Muted) để trình duyệt luôn cho phép tự động phát (Autoplay Approval)
    this.videoElement.muted = !soundOn;
    this.videoElement.volume = Math.max(0, Math.min(1, tvVol));
    this.videoElement.src = url;
    this.videoElement.currentTime = 0;
    
    this.videoElement.play().then(() => {
      // Nếu âm thanh phòng đang bật, mở tiếng video
      if (soundOn) {
        this.videoElement.muted = false;
        this.videoElement.volume = Math.max(0, Math.min(1, tvVol));
      }
      if (!this.isPlaying) {
        this.videoElement.pause();
      }
    }).catch(e => {
      console.warn("Autoplay with sound prevented, falling back to muted autoplay:", e);
      this.videoElement.muted = true;
      this.videoElement.play().then(() => {
        if (!this.isPlaying) this.videoElement.pause();
      }).catch(err => console.warn("Muted autoplay error:", err));
    });
  }

  /**
   * Cập nhật trạng thái âm thanh và âm lượng từ núm vặn TV hoặc công tắc tổng
   * @param {boolean} enabled - Trạng thái bật/tắt tiếng
   * @param {number} volume - Mức âm lượng (0.0 đến 1.0)
   */
  setAudio(enabled, volume = 0.85) {
    if (this.videoElement) {
      this.videoElement.muted = !enabled;
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
      if (enabled && this.isPlaying && this.videoElement.paused) {
        this.videoElement.play().catch(() => {});
      } else if (!enabled && !this.isPlaying) {
        this.videoElement.pause();
      }
    }
  }

  /**
   * Phát âm thanh bíp tần số cao cổ điển lúc đếm ngược bằng Web Audio API
   * @param {number} freq - Tần số âm thanh (Hz)
   * @param {number} duration - Thời lượng tiếng bíp (giây)
   */
  triggerBeep(freq = 880, duration = 0.08) {
    if (!this.audioCtx || !this.isPlaying) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  /**
   * Vẽ từng khung hình phát phim theo chu kỳ hoạt họa Canvas
   * @param {number} t - Thời gian thực (giây)
   * @param {number} dt - Độ chênh lệch thời gian (mili giây)
   */
  frame(t, dt) {
    if (this.isPlaying) {
      this.time += dt / 1000;
    }
    if (this.tapeIndex < 0) return; // Không có băng nào đang nạp

    const g = this.ctx;
    const w = this.width;
    const h = this.height;
    const tape = VIETNAM_TAPES[this.tapeIndex] || VIETNAM_TAPES[0];

    g.save();
    g.clearRect(0, 0, w, h);

    // GIAI ĐOẠN 1: ĐẦU BĂNG ĐẾM NGƯỢC 3 - 2 - 1 (TỪ 0.0s ĐẾN 3.2s)
    if (this.time < 3.2) {
      this.drawCountdownLeader(g, w, h, tape);
      if (this.videoElement && this.videoElement.currentTime > 0.1) {
        this.videoElement.currentTime = 0;
      }
    } 
    // GIAI ĐOẠN 2A: PHÁT VIDEO THẬT NẾU ĐÃ NẠP XONG KHUNG HÌNH (HTML5 MP4)
    else if (this.videoElement && this.videoElement.readyState >= 2) {
      const vw = this.videoElement.videoWidth || 16;
      const vh = this.videoElement.videoHeight || 9;
      const vRatio = vw / vh;
      const sRatio = w / h; // Tỉ lệ màn hình TV 4:3 (1024x768)

      let dw, dh, dx, dy;
      if (vRatio > sRatio) {
        dw = w;
        dh = w / vRatio;
        dx = 0;
        dy = (h - dh) / 2;
      } else {
        dh = h;
        dw = h * vRatio;
        dx = (w - dw) / 2;
        dy = 0;
      }

      // Nền đen và vẽ khung hình video căn giữa hoàn hảo
      g.fillStyle = "#020307";
      g.fillRect(0, 0, w, h);
      g.drawImage(this.videoElement, dx, dy, dw, dh);

      // Hiệu ứng ánh sáng ống phóng điện tử CRT (Phosphor Vignette Gradient)
      const grad = g.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, w / 1.35);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.35)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);

      // Hiển thị phụ đề lịch sử và trích dẫn hào hùng bên dưới
      this.drawHistoricalCaptions(g, w, h, tape, this.time - 3.2);
    } 
    // GIAI ĐOẠN 2B: SA BÀN CHIẾN THUẬT ĐỒ HỌA MÔ PHỎNG NẾU KHÔNG CÓ FILE VIDEO
    else {
      this.drawDocumentaryReel(g, w, h, tape, this.time - 3.2);
    }

    // Hiệu ứng bụi bẩn và vết xước cuộn phim nhựa 35mm
    this.drawFilmGrainAndScratches(g, w, h);

    // Bảng thông tin OSD cổ điển của đầu đọc băng VHS (▶ PLAY, SP, Bộ đếm thời gian)
    this.drawVHSHeader(g, w, h, tape);

    g.restore();
  }

  /**
   * Vẽ đầu băng phim đếm ngược chuẩn quốc tế (SMPTE Countdown Film Leader)
   */
  drawCountdownLeader(g, w, h, tape) {
    const t = this.time;
    // Nền phim màu chì đậm
    g.fillStyle = "#181816";
    g.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Đường chữ thập ngắm tâm quang học
    g.strokeStyle = "rgba(220, 215, 200, 0.4)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx, 0); g.lineTo(cx, h);
    g.moveTo(0, cy); g.lineTo(w, cy);
    g.stroke();

    // Các vòng tròn đồng tâm
    g.beginPath();
    g.arc(cx, cy, 220, 0, Math.PI * 2);
    g.arc(cx, cy, 260, 0, Math.PI * 2);
    g.stroke();

    // Cánh quạt quét tròn 360 độ theo thời gian
    const sweepAngle = ((t % 1) * Math.PI * 2) - Math.PI / 2;
    g.fillStyle = "rgba(220, 215, 200, 0.18)";
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, 220, -Math.PI / 2, sweepAngle);
    g.closePath();
    g.fill();

    // Số đếm ngược: 3, 2, 1
    const countNum = 3 - Math.floor(t);
    const secFloor = Math.floor(t);
    if (secFloor !== this.lastBeepSec && countNum > 0) {
      this.lastBeepSec = secFloor;
      this.triggerBeep(countNum === 1 ? 1200 : 880, 0.08); // Bíp cao hơn ở số 1
    }

    if (countNum > 0) {
      g.font = "900 160px Archivo, sans-serif";
      g.fillStyle = "#efe8d6";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(countNum), cx, cy);
    } else {
      g.font = "900 70px Archivo, sans-serif";
      g.fillStyle = "#ffcc33";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BẮT ĐẦU CHIẾU", cx, cy);
    }

    // Thông tin định danh lưu trữ tư liệu
    g.font = "24px VT323, monospace";
    g.fillStyle = "#9c988e";
    g.fillText("TƯ LIỆU QUỐC GIA · BĂNG GỐC 35MM", cx, cy - 300);
    g.fillText(`BĂNG SỐ ${String(this.tapeIndex + 1).padStart(2, "0")}: ${tape.t.toUpperCase()}`, cx, cy + 310);
  }

  /**
   * Kết xuất sa bàn đồ họa mô phỏng hoạt họa cho cuộn băng
   */
  drawDocumentaryReel(g, w, h, tape, relTime) {
    // Gradient nền tùy biến theo từng thời kỳ lịch sử
    const bgGrad = g.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.75);
    bgGrad.addColorStop(0, tape.bg);
    bgGrad.addColorStop(1, "#07080d");
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, w, h);

    // 1. Vẽ sa bàn chiến thuật theo loại cảnh (River battle, Mongol battle,...)
    this.drawTacticalScenario(g, w, h, tape, relTime);

    // 2. Vẽ trích dẫn lịch sử với hiệu ứng máy đánh chữ (Typewriter)
    this.drawHistoricalCaptions(g, w, h, tape, relTime);

    // 3. Thanh sóng âm thanh phát biểu tư liệu
    this.drawAudioWaveform(g, w, h, relTime);
  }

  /**
   * Phân luồng sa bàn chiến dịch dựa trên mã cảnh của cuộn băng
   */
  drawTacticalScenario(g, w, h, tape, relTime) {
    const cx = w / 2;
    const cy = h / 2 - 25;

    // Lưới tọa độ quân sự chiến thuật
    g.strokeStyle = "rgba(255, 255, 255, 0.07)";
    g.lineWidth = 1;
    for (let x = 60; x < w - 60; x += 60) {
      g.beginPath(); g.moveTo(x, 90); g.lineTo(x, h - 140); g.stroke();
    }
    for (let y = 90; y < h - 140; y += 50) {
      g.beginPath(); g.moveTo(60, y); g.lineTo(w - 60, y); g.stroke();
    }

    switch (tape.sceneType) {
      case "river_battle": // Trận thủy chiến Bạch Đằng 938
        this.drawBachDangRiver(g, cx, cy, relTime);
        break;
      case "mongol_battle": // Hào khí Đông A ba lần kháng Mông
        this.drawDongABattle(g, cx, cy, relTime);
        break;
      case "tay_son_fire": // Quang Trung thần tốc đại phá quân Thanh 1789
        this.drawTaySonMarch(g, cx, cy, relTime);
        break;
      case "ba_dinh_flag": // Ngày Quốc khánh 2/9/1945
        this.drawBaDinhScene(g, cx, cy, relTime);
        break;
      case "palace_gates": // Đại thắng mùa Xuân 30/4/1975
        this.drawTankGateScene(g, cx, cy, relTime);
        break;
      case "artillery_hills": // Chiến dịch Điện Biên Phủ 1954
        this.drawDienBienArtillery(g, cx, cy, relTime);
        break;
      default:
        this.drawGenericHistoricalMap(g, cx, cy, tape, relTime);
    }
  }

  /**
   * Sa bàn trận Bạch Đằng: Thủy triều rút để lộ bãi cọc nhọn đâm vỡ thuyền giặc
   */
  drawBachDangRiver(g, cx, cy, t) {
    // Sóng nước sông Bạch Đằng cuồn cuộn
    g.fillStyle = "rgba(20, 60, 110, 0.35)";
    g.beginPath();
    g.moveTo(100, cy + 120);
    for (let x = 100; x <= 924; x += 20) {
      g.lineTo(x, cy + 120 + Math.sin(x * 0.02 + t * 3) * 12);
    }
    g.lineTo(924, cy + 220);
    g.lineTo(100, cy + 220);
    g.closePath();
    g.fill();

    // Bãi cọc gỗ bọc sắt nhô lên khi thủy triều rút
    const tide = Math.sin(t * 0.8);
    const stakeRise = Math.max(0, tide * 45);
    g.strokeStyle = "#8b6a3e";
    g.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      const sx = 220 + i * 70 + (i % 2) * 20;
      const sy = cy + 140 - stakeRise;
      g.beginPath();
      g.moveTo(sx, cy + 190);
      g.lineTo(sx - 8, sy);
      g.lineTo(sx - 12, sy - 28); // Đầu cọc vạt nhọn
      g.stroke();

      // Ánh thép bọc sắt trên đầu cọc
      g.fillStyle = "#dce8f5";
      g.beginPath();
      g.arc(sx - 12, sy - 28, 3, 0, Math.PI * 2);
      g.fill();
    }

    // Thuyền chiến quân Nam Hán trôi dạt vào bãi cọc
    const shipX = 350 + Math.sin(t * 0.5) * 80;
    g.fillStyle = "#5c2a1a";
    g.beginPath();
    g.moveTo(shipX - 60, cy + 110);
    g.lineTo(shipX + 70, cy + 110);
    g.lineTo(shipX + 50, cy + 140);
    g.lineTo(shipX - 40, cy + 140);
    g.closePath();
    g.fill();

    // Cờ lệnh chiến trận tung bay
    g.fillStyle = "#d42828";
    g.fillRect(shipX - 10, cy + 60, 4, 50);
    g.beginPath();
    g.moveTo(shipX - 6, cy + 60);
    g.lineTo(shipX + 35 + Math.sin(t * 4) * 5, cy + 72);
    g.lineTo(shipX - 6, cy + 85);
    g.closePath();
    g.fill();

    // Trạng thái thủy triều chiến thuật
    g.font = "20px VT323, monospace";
    g.fillStyle = tide > 0 ? "#ff5252" : "#52c4ff";
    g.textAlign = "center";
    g.fillText(tide > 0 ? "TRIỀU RÚT: CỌC NGẦM ĐÂM THỦNG CHIẾN THUYỀN NAM HÁN" : "THỦY TRIỀU LÊN: DỬ ĐỊCH QUA BÃI CỌC", cx, cy + 40);
  }

  /**
   * Sa bàn Hào khí Đông A: Hội nghị Diên Hồng và 3 lần đại thắng Nguyên Mông
   */
  drawDongABattle(g, cx, cy, t) {
    const flicker = Math.sin(t * 8) * 0.1 + 0.9;
    g.fillStyle = `rgba(180, 40, 20, ${0.15 * flicker})`;
    g.beginPath();
    g.arc(cx, cy + 50, 180, 0, Math.PI * 2);
    g.fill();

    g.font = "900 68px Archivo, sans-serif";
    g.fillStyle = "#ffd9d4";
    g.textAlign = "center";
    g.fillText("HỘI NGHỊ DIÊN HỒNG: ĐÁNH!", cx, cy - 20);

    g.font = "700 28px Caveat, cursive";
    g.fillStyle = "#ffb0a3";
    g.fillText("Lời thề 'SÁT THÁT' khắc sâu vào da thịt quân dân nhà Trần", cx, cy + 30);

    // 3 mốc son đại thắng oanh liệt
    const victories = ["1258 · ĐÔNG BỘ ĐẦU", "1285 · VẠN KIẾP - HÀM TỬ", "1288 · BẠCH ĐẰNG GIANG"];
    victories.forEach((v, idx) => {
      const bx = cx - 260 + idx * 260;
      g.fillStyle = "rgba(40, 10, 15, 0.75)";
      g.strokeStyle = "#e84a5f";
      g.lineWidth = 1.5;
      g.fillRect(bx - 110, cy + 80, 220, 48);
      g.strokeRect(bx - 110, cy + 80, 220, 48);

      g.font = "bold 17px VT323, monospace";
      g.fillStyle = "#fff";
      g.fillText(v, bx, cy + 110);
    });
  }

  /**
   * Sa bàn hành quân thần tốc của Vua Quang Trung Tết Kỷ Dậu 1789
   */
  drawTaySonMarch(g, cx, cy, t) {
    g.font = "900 54px Archivo, sans-serif";
    g.fillStyle = "#ffe082";
    g.textAlign = "center";
    g.fillText("HÀNH QUÂN THẦN TỐC TẾT KỶ DẬU 1789", cx, cy - 50);

    // Tuyến đường hành quân chớp nhoáng (Phú Xuân -> Tam Điệp -> Thăng Long)
    const marchProgress = (t * 0.4) % 1;
    g.strokeStyle = "rgba(255, 180, 30, 0.4)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 300, cy + 80); // Phú Xuân (Huế)
    g.lineTo(cx - 80, cy + 40);  // Tam Điệp (Ninh Bình)
    g.lineTo(cx + 250, cy - 10); // Thăng Long
    g.stroke();

    // Điểm chỉ vị trí đoàn quân áo đỏ Tây Sơn di chuyển
    const curX = cx - 300 + marchProgress * 550;
    const curY = cy + 80 - marchProgress * 90;
    g.fillStyle = "#ff3300";
    g.beginPath();
    g.arc(curX, curY, 12, 0, Math.PI * 2);
    g.fill();

    g.font = "bold 20px VT323, monospace";
    g.fillStyle = "#fff";
    g.fillText("ĐẠO QUÂN TÂY SƠN ÁO ĐỎ THẦN TỐC", curX, curY - 22);

    const stations = [
      { name: "Phú Xuân (Huế)", x: cx - 300, y: cy + 80 },
      { name: "Tam Điệp (Ninh Bình)", x: cx - 80, y: cy + 40 },
      { name: "Ngọc Hồi - Đống Đa", x: cx + 250, y: cy - 10 }
    ];
    stations.forEach(s => {
      g.fillStyle = "#ffd54f";
      g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill();
      g.font = "18px VT323, monospace";
      g.fillText(s.name, s.x, s.y + 24);
    });
  }

  /**
   * Cảnh cờ đỏ sao vàng tung bay trên Quảng trường Ba Đình 2/9/1945
   */
  drawBaDinhScene(g, cx, cy, t) {
    const flagW = 220, flagH = 145;
    const fx = cx - flagW / 2, fy = cy - 80;

    // Lá Cờ Đỏ
    g.fillStyle = "#db141c";
    g.fillRect(fx, fy, flagW, flagH);

    // Ngôi Sao Vàng năm cánh
    g.fillStyle = "#ffde00";
    g.beginPath();
    const starR = 42;
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? starR : starR * 0.38;
      const x = cx + Math.cos(a) * r;
      const y = fy + flagH / 2 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();

    // Dòng thông tấn lịch sử
    g.font = "900 36px Archivo, sans-serif";
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.fillText("VIỆT NAM DÂN CHỦ CỘNG HÒA RA ĐỜI", cx, cy + 105);

    g.font = "24px VT323, monospace";
    g.fillStyle = "#ffea85";
    g.fillText("2 THÁNG 9 NĂM 1945 · QUẢNG TRƯỜNG BA ĐÌNH, HÀ NỘI", cx, cy + 140);
  }

  /**
   * Khoảnh khắc lịch sử Xe tăng 390 húc sập cổng Dinh Độc Lập trưa 30/4/1975
   */
  drawTankGateScene(g, cx, cy, t) {
    g.font = "900 48px Archivo, sans-serif";
    g.fillStyle = "#fff176";
    g.textAlign = "center";
    g.fillText("11H30 NGÀY 30/4/1975", cx, cy - 70);

    g.font = "bold 26px VT323, monospace";
    g.fillStyle = "#ffcdd2";
    g.fillText("XE TĂNG 390 HÚC TUNG CỔNG DINH ĐỘC LẬP", cx, cy - 30);

    // Cánh cổng sắt bị húc văng sang hai bên
    g.strokeStyle = "#8d99ae";
    g.lineWidth = 4;
    // Cánh cổng trái
    g.save();
    g.translate(cx - 160, cy + 40);
    g.rotate(-Math.PI / 4);
    g.strokeRect(-60, -40, 120, 80);
    g.restore();

    // Cánh cổng phải
    g.save();
    g.translate(cx + 160, cy + 40);
    g.rotate(Math.PI / 4);
    g.strokeRect(-60, -40, 120, 80);
    g.restore();

    // Hình bóng xe tăng 390 kiên cường tiến vào bãi cỏ
    g.fillStyle = "#2d3725";
    g.fillRect(cx - 90, cy + 30, 180, 55); // Thân xe
    g.beginPath();
    g.arc(cx, cy + 20, 45, Math.PI, 0);   // Tháp pháo
    g.fill();
    g.fillRect(cx + 25, cy + 10, 110, 12); // Nòng pháo 100mm vươn cao

    g.font = "900 24px Archivo, sans-serif";
    g.fillStyle = "#ffd54f";
    g.fillText("390", cx - 15, cy + 40);

    g.font = "24px VT323, monospace";
    g.fillStyle = "#4caf50";
    g.fillText("NON SÔNG LIỀN MỘT DẢI · ĐẠI THẮNG MÙA XUÂN", cx, cy + 125);
  }

  /**
   * Sa bàn cứ điểm Điện Biên Phủ và vòng vây pháo binh 1954
   */
  drawDienBienArtillery(g, cx, cy, t) {
    g.font = "900 46px Archivo, sans-serif";
    g.fillStyle = "#dce775";
    g.textAlign = "center";
    g.fillText("CHIẾN DỊCH ĐIỆN BIÊN PHỦ 1954", cx, cy - 60);

    // Các ngọn đồi cứ điểm then chốt (A1, Him Lam, C1, Hầm De Castries)
    const hills = [
      { name: "ĐỒI A1", x: cx - 220, y: cy + 40 },
      { name: "CỨ ĐIỂM HIM LAM", x: cx - 70, y: cy + 80 },
      { name: "ĐỒI C1", x: cx + 90, y: cy + 30 },
      { name: "HẦM DE CASTRIES", x: cx + 230, y: cy + 70 }
    ];

    hills.forEach(h => {
      g.fillStyle = "rgba(45, 65, 35, 0.85)";
      g.beginPath();
      g.arc(h.x, h.y, 45, Math.PI, 0);
      g.fill();
      g.font = "bold 17px VT323, monospace";
      g.fillStyle = "#fff";
      g.fillText(h.name, h.x, h.y - 10);
    });

    // Vòng vây chiến hào siết chặt lòng chảo Mường Thanh
    g.strokeStyle = "rgba(230, 50, 50, 0.7)";
    g.lineWidth = 2.5;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.arc(cx, cy + 50, 240 - Math.min(60, t * 8), 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);

    g.font = "24px VT323, monospace";
    g.fillStyle = "#ff8a80";
    g.fillText("VÒNG VÂY LÒNG CHẢO MƯỜNG THANH SIẾT CHẶT", cx, cy + 130);
  }

  /**
   * Sa bàn tổng quát cho các giai đoạn khác
   */
  drawGenericHistoricalMap(g, cx, cy, tape, t) {
    g.font = "900 52px Archivo, sans-serif";
    g.fillStyle = tape.ink;
    g.textAlign = "center";
    g.fillText(tape.t.toUpperCase(), cx, cy - 20);

    g.font = "700 30px Caveat, cursive";
    g.fillStyle = "#ffde8a";
    g.fillText(tape.era, cx, cy + 35);
  }

  /**
   * Hiệu ứng máy đánh chữ hiển thị câu trích dẫn và tác giả
   */
  drawHistoricalCaptions(g, w, h, tape, relTime) {
    const boxY = h - 170;
    g.fillStyle = "rgba(8, 10, 16, 0.88)";
    g.fillRect(60, boxY, w - 120, 110);
    g.strokeStyle = "rgba(255, 215, 100, 0.45)";
    g.lineWidth = 1;
    g.strokeRect(60, boxY, w - 120, 110);

    // Ký tự hiển thị dần theo tốc độ 28 ký tự/giây
    const fullQuote = tape.quote;
    const charsToShow = Math.min(fullQuote.length, Math.floor(relTime * 28));
    const dispQuote = fullQuote.substring(0, charsToShow);

    g.font = "600 24px Caveat, cursive";
    g.fillStyle = "#fff8db";
    g.textAlign = "left";
    g.fillText(`"${dispQuote}"`, 85, boxY + 38);

    g.font = "20px VT323, monospace";
    g.fillStyle = "#cbb279";
    g.fillText(`— ${tape.quoteAuthor}`, 85, boxY + 75);

    // Con trỏ nhấp nháy mô phỏng đánh máy
    if (charsToShow < fullQuote.length && Math.floor(relTime * 4) % 2 === 0) {
      g.fillStyle = "#ffcc00";
      g.fillRect(85 + g.measureText(`"${dispQuote}"`).width + 4, boxY + 22, 10, 20);
    }
  }

  /**
   * Vẽ phổ sóng âm thanh tư liệu giọng nói trực quan
   */
  drawAudioWaveform(g, w, h, relTime) {
    const rx = w - 240, ry = h - 145;
    g.fillStyle = "rgba(0, 0, 0, 0.5)";
    g.fillRect(rx, ry, 160, 45);

    g.strokeStyle = "#40ff99";
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 30; i++) {
      const bh = Math.sin(i * 0.4 + relTime * 8) * 14 * Math.cos(i * 0.2 + relTime * 5);
      const bx = rx + 6 + i * 5;
      g.moveTo(bx, ry + 22 - Math.abs(bh));
      g.lineTo(bx, ry + 22 + Math.abs(bh));
    }
    g.stroke();

    g.font = "14px VT323, monospace";
    g.fillStyle = "#40ff99";
    g.fillText("VOICE ARCHIVE ●", rx + 25, ry + 40);
  }

  /**
   * Bảng hiển thị thông số OSD Retro VHS ở mép trên màn hình
   */
  drawVHSHeader(g, w, h, tape) {
    g.font = "32px VT323, monospace";
    g.fillStyle = "#f5f6ff";
    g.textAlign = "left";
    g.fillText("▶ PLAY", 65, 52);

    const sec = Math.floor(this.time);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    g.fillText(`SP  0:${m}:${s}`, 200, 52);

    g.textAlign = "right";
    g.fillText(`REC ● 14/10/2026`, w - 65, 52);

    g.fillStyle = "#ffe082";
    g.fillText(`CH ${String(this.tapeIndex + 1).padStart(2, "0")} · ${tape.t.toUpperCase()}`, w - 65, 88);
  }

  /**
   * Hiệu ứng mô phỏng hạt nhiễu và vết xước dọc của phim nhựa lưu trữ
   */
  drawFilmGrainAndScratches(g, w, h) {
    g.strokeStyle = "rgba(240, 240, 240, 0.22)";
    this.scratches.forEach(s => {
      s.x += s.speed;
      if (s.x < 0) s.x = w;
      if (s.x > w) s.x = 0;
      g.lineWidth = s.width;
      g.beginPath();
      g.moveTo(s.x, 0);
      g.lineTo(s.x + (Math.random() - 0.5) * 6, h);
      g.stroke();
    });

    // Sợi lông bụi ngẫu nhiên dính trên thấu kính máy chiếu
    if (Math.random() < 0.25) {
      g.strokeStyle = "rgba(20, 20, 20, 0.35)";
      g.lineWidth = 1;
      const hx = Math.random() * w, hy = Math.random() * h;
      g.beginPath();
      g.arc(hx, hy, 15, 0, Math.PI + Math.random());
      g.stroke();
    }
  }
}
