// Vietnam Historical Video & Documentary Reel Player for Retro CRT TV
// Generates authentic archival film reels, strategic battle maps, and documentary sequences

import { VIETNAM_TAPES } from "./vietnam-history-data.js";

export class HistoryFilmPlayer {
  constructor(canvas, ctx, width = 1024, height = 768, audioCtx = null) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.audioCtx = audioCtx;

    this.tapeIndex = 0;
    this.time = 0; // playback time in seconds
    this.isPlaying = true;

    // Archival Film grain / scratches seed
    this.scratches = Array.from({ length: 14 }, () => ({
      x: Math.random() * width,
      speed: (Math.random() - 0.5) * 8,
      opacity: Math.random() * 0.4 + 0.1,
      width: Math.random() * 2 + 1
    }));

    // Audio beep synthesis
    this.lastBeepSec = -1;

    // Optional HTML5 Video element support
    this.videoElement = null;
  }

  stop() {
    this.isPlaying = false;
    this.time = 0;
    this.tapeIndex = -1;
    this.lastBeepSec = -1;
    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        this.videoElement.removeAttribute("src");
        this.videoElement.load();
      } catch (e) {}
      this.videoElement = null;
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.videoElement && !this.videoElement.paused) {
      try {
        this.videoElement.pause();
      } catch (e) {}
    }
  }

  resume() {
    this.isPlaying = true;
    if (this.videoElement && this.videoElement.paused && this.videoElement.src) {
      this.videoElement.play().catch(e => {
        console.warn("Resume video failed:", e);
      });
    }
  }

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

  loadVideo(url) {
    if (!this.videoElement) {
      this.videoElement = document.createElement("video");
      this.videoElement.crossOrigin = "anonymous";
      this.videoElement.loop = true;
      this.videoElement.playsInline = true;
    }
    const soundOn = (window.__roomSoundOn !== undefined) ? window.__roomSoundOn : true;
    const tvVol = (window.__tvVolume !== undefined) ? window.__tvVolume : 0.85;

    // Start muted to guarantee autoplay approval by browser policy
    this.videoElement.muted = !soundOn;
    this.videoElement.volume = Math.max(0, Math.min(1, tvVol));
    this.videoElement.src = url;
    this.videoElement.currentTime = 0;
    
    this.videoElement.play().then(() => {
      // If room sound is on, unmute video
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

  frame(t, dt) {
    if (this.isPlaying) {
      this.time += dt / 1000;
    }
    if (this.tapeIndex < 0) return;
    const g = this.ctx;
    const w = this.width;
    const h = this.height;
    const tape = VIETNAM_TAPES[this.tapeIndex] || VIETNAM_TAPES[0];

    g.save();
    g.clearRect(0, 0, w, h);

    if (this.time < 3.2) {
      // Stage 1: Film Leader & 3-2-1 Countdown (0.0s - 3.2s)
      this.drawCountdownLeader(g, w, h, tape);
      if (this.videoElement && this.videoElement.currentTime > 0.1) {
        this.videoElement.currentTime = 0;
      }
    } else if (this.videoElement && this.videoElement.readyState >= 2) {
      // Stage 2: Real Historical Video Footage!
      const vw = this.videoElement.videoWidth || 16;
      const vh = this.videoElement.videoHeight || 9;
      const vRatio = vw / vh;
      const sRatio = w / h; // 960 / 720 = 1.333 (4:3)

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

      g.fillStyle = "#020307";
      g.fillRect(0, 0, w, h);
      g.drawImage(this.videoElement, dx, dy, dw, dh);

      // CRT phosphor vignette
      const grad = g.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, w / 1.35);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.35)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);

      this.drawHistoricalCaptions(g, w, h, tape, this.time - 3.2);
    } else {
      // Stage 2 fallback: Procedural animated tactical battle scenario
      this.drawDocumentaryReel(g, w, h, tape, this.time - 3.2);
    }

    // Archival Film Scratches & Jitter
    this.drawFilmGrainAndScratches(g, w, h);

    // Retro VHS OSD Header and Telemetry
    this.drawVHSHeader(g, w, h, tape);

    g.restore();
  }

  // --- STAGE 1: COUNTDOWN LEADER ---
  drawCountdownLeader(g, w, h, tape) {
    const t = this.time;
    // Film base
    g.fillStyle = "#181816";
    g.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Crosshairs
    g.strokeStyle = "rgba(220, 215, 200, 0.4)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx, 0); g.lineTo(cx, h);
    g.moveTo(0, cy); g.lineTo(w, cy);
    g.stroke();

    // Concentric circles
    g.beginPath();
    g.arc(cx, cy, 220, 0, Math.PI * 2);
    g.arc(cx, cy, 260, 0, Math.PI * 2);
    g.stroke();

    // Rotating sector sweep
    const sweepAngle = ((t % 1) * Math.PI * 2) - Math.PI / 2;
    g.fillStyle = "rgba(220, 215, 200, 0.18)";
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, 220, -Math.PI / 2, sweepAngle);
    g.closePath();
    g.fill();

    // Countdown Number
    const countNum = 3 - Math.floor(t);
    const secFloor = Math.floor(t);
    if (secFloor !== this.lastBeepSec && countNum > 0) {
      this.lastBeepSec = secFloor;
      this.triggerBeep(countNum === 1 ? 1200 : 880, 0.08);
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

    // Archival identification
    g.font = "24px VT323, monospace";
    g.fillStyle = "#9c988e";
    g.fillText("TƯ LIỆU QUỐC GIA · BĂNG GỐC 35MM", cx, cy - 300);
    g.fillText(`BĂNG SỐ ${String(this.tapeIndex + 1).padStart(2, "0")}: ${tape.t.toUpperCase()}`, cx, cy + 310);
  }

  // --- STAGE 2: DOCUMENTARY REEL ---
  drawDocumentaryReel(g, w, h, tape, relTime) {
    // Background color based on era
    const bgGrad = g.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.75);
    bgGrad.addColorStop(0, tape.bg);
    bgGrad.addColorStop(1, "#07080d");
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, w, h);

    // 1. Draw animated campaign tactical map or historical scenario
    this.drawTacticalScenario(g, w, h, tape, relTime);

    // 2. Draw historical quote & typewriter caption
    this.drawHistoricalCaptions(g, w, h, tape, relTime);

    // 3. Audio visualizer bar
    this.drawAudioWaveform(g, w, h, relTime);
  }

  drawTacticalScenario(g, w, h, tape, relTime) {
    const cx = w / 2;
    const cy = h / 2 - 25;

    // Strategic map grid
    g.strokeStyle = "rgba(255, 255, 255, 0.07)";
    g.lineWidth = 1;
    for (let x = 60; x < w - 60; x += 60) {
      g.beginPath(); g.moveTo(x, 90); g.lineTo(x, h - 140); g.stroke();
    }
    for (let y = 90; y < h - 140; y += 50) {
      g.beginPath(); g.moveTo(60, y); g.lineTo(w - 60, y); g.stroke();
    }

    // Scenic Animation per Tape Type
    switch (tape.sceneType) {
      case "river_battle": // Bạch Đằng
        this.drawBachDangRiver(g, cx, cy, relTime);
        break;
      case "mongol_battle": // Hào khí Đông A
        this.drawDongABattle(g, cx, cy, relTime);
        break;
      case "tay_son_fire": // Quang Trung
        this.drawTaySonMarch(g, cx, cy, relTime);
        break;
      case "ba_dinh_flag": // 2/9/1945
        this.drawBaDinhScene(g, cx, cy, relTime);
        break;
      case "palace_gates": // 30/4/1975
        this.drawTankGateScene(g, cx, cy, relTime);
        break;
      case "artillery_hills": // Điện Biên Phủ
        this.drawDienBienArtillery(g, cx, cy, relTime);
        break;
      default:
        this.drawGenericHistoricalMap(g, cx, cy, tape, relTime);
    }
  }

  // Tactical Scene: Bạch Đằng River & Stakes
  drawBachDangRiver(g, cx, cy, t) {
    // Water waves
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

    // Hidden Iron-tipped Stakes (Bãi cọc Bạch Đằng)
    const tide = Math.sin(t * 0.8);
    const stakeRise = Math.max(0, tide * 45); // Ebbing tide exposes stakes!
    g.strokeStyle = "#8b6a3e";
    g.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      const sx = 220 + i * 70 + (i % 2) * 20;
      const sy = cy + 140 - stakeRise;
      g.beginPath();
      g.moveTo(sx, cy + 190);
      g.lineTo(sx - 8, sy);
      g.lineTo(sx - 12, sy - 28); // Sharp point
      g.stroke();

      // Iron tip shine
      g.fillStyle = "#dce8f5";
      g.beginPath();
      g.arc(sx - 12, sy - 28, 3, 0, Math.PI * 2);
      g.fill();
    }

    // Warships (Thuyền chiến)
    const shipX = 350 + Math.sin(t * 0.5) * 80;
    g.fillStyle = "#5c2a1a";
    g.beginPath();
    g.moveTo(shipX - 60, cy + 110);
    g.lineTo(shipX + 70, cy + 110);
    g.lineTo(shipX + 50, cy + 140);
    g.lineTo(shipX - 40, cy + 140);
    g.closePath();
    g.fill();

    // War banner
    g.fillStyle = "#d42828";
    g.fillRect(shipX - 10, cy + 60, 4, 50);
    g.beginPath();
    g.moveTo(shipX - 6, cy + 60);
    g.lineTo(shipX + 35 + Math.sin(t * 4) * 5, cy + 72);
    g.lineTo(shipX - 6, cy + 85);
    g.closePath();
    g.fill();

    // Tactical text
    g.font = "20px VT323, monospace";
    g.fillStyle = tide > 0 ? "#ff5252" : "#52c4ff";
    g.textAlign = "center";
    g.fillText(tide > 0 ? "TRIỀU RÚT: CỌC NGẦM ĐÂM THỦNG CHIẾN THUYỀN NAM HÁN" : "THỦY TRIỀU LÊN: DỬ ĐỊCH QUA BÃI CỌC", cx, cy + 40);
  }

  // Tactical Scene: Hào khí Đông A
  drawDongABattle(g, cx, cy, t) {
    // Battle fire aura
    const flicker = Math.sin(t * 8) * 0.1 + 0.9;
    g.fillStyle = `rgba(180, 40, 20, ${0.15 * flicker})`;
    g.beginPath();
    g.arc(cx, cy + 50, 180, 0, Math.PI * 2);
    g.fill();

    // Big SÁT THÁT Emblem
    g.font = "900 68px Archivo, sans-serif";
    g.fillStyle = "#ffd9d4";
    g.textAlign = "center";
    g.fillText("HỘI NGHỊ DIÊN HỒNG: ĐÁNH!", cx, cy - 20);

    g.font = "700 28px Caveat, cursive";
    g.fillStyle = "#ffb0a3";
    g.fillText("Lời thề 'SÁT THÁT' khắc sâu vào da thịt quân dân nhà Trần", cx, cy + 30);

    // Three Victory Badges (3 Lần đại thắng)
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

  // Tactical Scene: Quang Trung Lightning March
  drawTaySonMarch(g, cx, cy, t) {
    g.font = "900 54px Archivo, sans-serif";
    g.fillStyle = "#ffe082";
    g.textAlign = "center";
    g.fillText("HÀNH QUÂN THẦN TỐC TẾT KỶ DẬU 1789", cx, cy - 50);

    // Lightning route line
    const marchProgress = (t * 0.4) % 1;
    g.strokeStyle = "rgba(255, 180, 30, 0.4)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 300, cy + 80); // Phú Xuân
    g.lineTo(cx - 80, cy + 40); // Tam Điệp
    g.lineTo(cx + 250, cy - 10); // Thăng Long
    g.stroke();

    // Moving Fire Dragon indicator
    const curX = cx - 300 + marchProgress * 550;
    const curY = cy + 80 - marchProgress * 90;
    g.fillStyle = "#ff3300";
    g.beginPath();
    g.arc(curX, curY, 12, 0, Math.PI * 2);
    g.fill();

    g.font = "bold 20px VT323, monospace";
    g.fillStyle = "#fff";
    g.fillText("ĐẠO QUÂN TÂY SƠN ÁO ĐỎ THẦN TỐC", curX, curY - 22);

    // Stations
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

  // Tactical Scene: Ba Đình Square 2/9/1945
  drawBaDinhScene(g, cx, cy, t) {
    // Red Flag with Yellow Star
    const flagW = 220, flagH = 145;
    const fx = cx - flagW / 2, fy = cy - 80;

    g.fillStyle = "#db141c";
    g.fillRect(fx, fy, flagW, flagH);

    // Gold Star
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

    // Historic Broadcast Text
    g.font = "900 36px Archivo, sans-serif";
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.fillText("VIỆT NAM DÂN CHỦ CỘNG HÒA RA ĐỜI", cx, cy + 105);

    g.font = "24px VT323, monospace";
    g.fillStyle = "#ffea85";
    g.fillText("2 THÁNG 9 NĂM 1945 · QUẢNG TRƯỜNG BA ĐÌNH, HÀ NỘI", cx, cy + 140);
  }

  // Tactical Scene: Tank 390 Independence Palace Gates
  drawTankGateScene(g, cx, cy, t) {
    g.font = "900 48px Archivo, sans-serif";
    g.fillStyle = "#fff176";
    g.textAlign = "center";
    g.fillText("11H30 NGÀY 30/4/1975", cx, cy - 70);

    g.font = "bold 26px VT323, monospace";
    g.fillStyle = "#ffcdd2";
    g.fillText("XE TĂNG 390 HÚC TUNG CỔNG DINH ĐỘC LẬP", cx, cy - 30);

    // Gates (broken open)
    g.strokeStyle = "#8d99ae";
    g.lineWidth = 4;
    // Left gate swing
    g.save();
    g.translate(cx - 160, cy + 40);
    g.rotate(-Math.PI / 4);
    g.strokeRect(-60, -40, 120, 80);
    g.restore();

    // Right gate swing
    g.save();
    g.translate(cx + 160, cy + 40);
    g.rotate(Math.PI / 4);
    g.strokeRect(-60, -40, 120, 80);
    g.restore();

    // Tank silhouette breaking through
    g.fillStyle = "#2d3725";
    g.fillRect(cx - 90, cy + 30, 180, 55); // Hull
    g.beginPath();
    g.arc(cx, cy + 20, 45, Math.PI, 0); // Turret
    g.fill();
    g.fillRect(cx + 25, cy + 10, 110, 12); // Cannon forward

    g.font = "900 24px Archivo, sans-serif";
    g.fillStyle = "#ffd54f";
    g.fillText("390", cx - 15, cy + 40);

    g.font = "24px VT323, monospace";
    g.fillStyle = "#4caf50";
    g.fillText("NON SÔNG LIỀN MỘT DẢI · ĐẠI THẮNG MÙA XUÂN", cx, cy + 125);
  }

  // Tactical Scene: Điện Biên Phủ Artillery
  drawDienBienArtillery(g, cx, cy, t) {
    g.font = "900 46px Archivo, sans-serif";
    g.fillStyle = "#dce775";
    g.textAlign = "center";
    g.fillText("CHIẾN DỊCH ĐIỆN BIÊN PHỦ 1954", cx, cy - 60);

    // Artillery Hills (A1, C1, Him Lam, Doc Lap)
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

    // Siege ring closing in
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

  // Generic Map
  drawGenericHistoricalMap(g, cx, cy, tape, t) {
    g.font = "900 52px Archivo, sans-serif";
    g.fillStyle = tape.ink;
    g.textAlign = "center";
    g.fillText(tape.t.toUpperCase(), cx, cy - 20);

    g.font = "700 30px Caveat, cursive";
    g.fillStyle = "#ffde8a";
    g.fillText(tape.era, cx, cy + 35);
  }

  // Historical Quotes & Typewriter captions
  drawHistoricalCaptions(g, w, h, tape, relTime) {
    const boxY = h - 170;
    g.fillStyle = "rgba(8, 10, 16, 0.88)";
    g.fillRect(60, boxY, w - 120, 110);
    g.strokeStyle = "rgba(255, 215, 100, 0.45)";
    g.lineWidth = 1;
    g.strokeRect(60, boxY, w - 120, 110);

    // Typewriter effect on quote
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

    // Blinking cursor
    if (charsToShow < fullQuote.length && Math.floor(relTime * 4) % 2 === 0) {
      g.fillStyle = "#ffcc00";
      g.fillRect(85 + g.measureText(`"${dispQuote}"`).width + 4, boxY + 22, 10, 20);
    }
  }

  // Audio Waveform
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

  // VHS OSD Header
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

  // Archival Film Grain & Dust Scratches
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

    // Random dust hair
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
