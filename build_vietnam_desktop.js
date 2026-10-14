const fs = require('fs');

let js = fs.readFileSync('felix-desktop.js', 'utf8');

// 1. Prepend Imports and Global Helpers
const topImports = `// Vietnam National History & 3D Relics CRT Experience
import { VIETNAM_TAPES, VIETNAM_RELICS } from "./vietnam-history-data.js";
import { RelicRenderer } from "./relic-renderer.js";
import { HistoryFilmPlayer } from "./history-film-player.js";

let relicRenderer = null;
let relicCanvas = null;
let filmPlayer = null;
let relicDrag = false;

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
`;

js = topImports + '\n' + js;

// 2. Update PAGES and TV_BTN
js = js.replace(
  'const PAGES = ["home","about","work","posts","online"], PAGE_ALIAS={twitter:"online",github:"online",contact:"online"};',
  'const PAGES = ["home","about","work","relics","posts","online"], PAGE_ALIAS={twitter:"online",github:"online",contact:"online",relic:"relics",covat:"relics"};'
);

js = js.replace(
  'const TV_BTN=["home","work","posts","underscan","hvdelay","blueonly"], TV_LABEL=["HOME","WORK","POSTS","UNDERSCAN","H/V DELAY","BLUE ONLY"];',
  'const TV_BTN=["home","work","relics","underscan","hvdelay","blueonly"], TV_LABEL=["TRANG CHỦ","CUỘN PHIM","CỔ VẬT 3D","QUÉT RỘNG","H/V DELAY","ĐƠN SẮC"];'
);

// 3. Replace TAPES definition with VIETNAM_TAPES
const tapesRegex = /const TAPES = \[\s*\{[\s\S]*?\n\];/;
js = js.replace(tapesRegex, 'const TAPES = VIETNAM_TAPES;');

// 4. Update ANCHOR for relics
js = js.replace(
  'ANCHOR.online=ANCHOR.about;',
  'ANCHOR.online=ANCHOR.about; ANCHOR.relics={re:/^(tv_|screen$|vcr_body)/,dir:[-.02,.08,1],fit:1.22};'
);

js = js.replace(
  'paneled=page!=="home"&&!atPC(page)&&!(page==="work"&&workHidden);',
  'paneled=page!=="home"&&page!=="relics"&&!atPC(page)&&!(page==="work"&&workHidden);'
);


// 5. Replace spineTex and topLabel with Vietnamese Historical Cassette dressing
const oldSpineAndTop = `function topLabel(i){
  const c=tapeInfo(i);
  return canvasTex(1024,222,(g,w,h)=>{
    g.fillStyle="#efe8d6";g.fillRect(0,0,w,h);
    g.strokeStyle="rgba(60,80,140,.3)";g.lineWidth=2;for(let y=70;y<h;y+=44){g.beginPath();g.moveTo(30,y);g.lineTo(w-30,y);g.stroke()}
    g.fillStyle="#b8402f";g.fillRect(0,0,w,14);
    g.font="600 104px Caveat, cursive";g.fillStyle="#1b2a5a";g.fillText(c.t,40,150);
    g.font="40px VT323, monospace";g.fillStyle="#444";g.textAlign="right";g.fillText(c.y.toUpperCase(),w-40,196);g.textAlign="left";
  });
}
// Spine labels are redrawn whenever a late web font lands, so a channel's own typeface replaces the fallback.
const labelDraws=[];
function spineTex(i){
  const ch=channels[i]; if(!ch?.cassette?.drawLabel) return tapeLabel(i);
  const draw=(g,w,h)=>{ try{ g.save(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h); ch.cassette.drawLabel(g,w,h); g.restore(); }catch(e){ console.warn(e); } };
  const tx=canvasTex(1024,160,draw); tx.repeat.set(1,136/160); tx.offset.set(0,12/160);
  labelDraws.push(()=>{ draw(tx.userData.canvas.getContext("2d"),1024,160); tx.needsUpdate=true; });
  return tx;
}`;

const newSpineAndTop = `function topLabel(i){
  const c = VIETNAM_TAPES[i] || VIETNAM_TAPES[0];
  return canvasTex(1024, 222, (g, w, h) => {
    g.fillStyle = "#f6f2e8";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(60, 80, 140, 0.25)";
    g.lineWidth = 2;
    for (let y = 70; y < h; y += 44) {
      g.beginPath(); g.moveTo(30, y); g.lineTo(w - 30, y); g.stroke();
    }
    g.fillStyle = c.bg || "#8b0000";
    g.fillRect(0, 0, w, 16);

    g.font = "900 60px Archivo, sans-serif";
    g.fillStyle = "#16203a";
    g.fillText(String(i + 1).padStart(2, "0") + " · " + c.t.toUpperCase(), 40, 95);

    g.font = "700 34px Caveat, cursive";
    g.fillStyle = "#8b1818";
    g.fillText(c.y + " — " + c.era, 40, 150);

    g.font = "26px VT323, monospace";
    g.fillStyle = "#4b5563";
    g.textAlign = "right";
    g.fillText("PHIM TƯ LIỆU LỊCH SỬ VIỆT NAM · BAN TUYÊN GIÁO", w - 40, 200);
    g.textAlign = "left";
  });
}

const labelDraws = [];
function spineTex(i){
  const c = VIETNAM_TAPES[i] || VIETNAM_TAPES[0];
  const draw = (g, w, h) => {
    try {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);

      // Spine background
      g.fillStyle = c.bg || "#1c2b4e";
      g.fillRect(0, 0, w, h);

      // Gold metallic borders
      g.fillStyle = "#d4af37";
      g.fillRect(0, 0, 18, h);
      g.fillRect(w - 18, 0, 18, h);
      g.fillRect(0, 0, w, 5);
      g.fillRect(0, h - 5, w, 5);

      // VHS badge box
      g.fillStyle = "rgba(0, 0, 0, 0.45)";
      g.fillRect(28, 18, 100, h - 36);
      g.strokeStyle = "rgba(255, 255, 255, 0.4)";
      g.lineWidth = 1.5;
      g.strokeRect(28, 18, 100, h - 36);

      g.font = "900 24px Archivo, sans-serif";
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      g.fillText("VHS", 78, 55);

      g.font = "bold 18px VT323, monospace";
      g.fillStyle = "#ffd24d";
      g.fillText("HI-FI", 78, 85);
      g.fillText("HQ", 78, 110);

      // Main title plaque
      g.fillStyle = "#ffffff";
      g.fillRect(145, 18, 650, h - 36);

      // Dynastic color stripe
      g.fillStyle = c.bg || "#8b0000";
      g.fillRect(145, 18, 16, h - 36);

      g.font = "900 34px Archivo, sans-serif";
      g.fillStyle = "#111827";
      g.textAlign = "left";
      g.fillText(String(i + 1).padStart(2, "0") + ". " + c.t.toUpperCase(), 175, 62);

      g.font = "600 26px Caveat, cursive";
      g.fillStyle = "#991b1b";
      g.fillText(c.y + " · TƯ LIỆU LỊCH SỬ QUỐC GIA", 175, 106);

      // Right spec badge
      g.fillStyle = "rgba(0, 0, 0, 0.55)";
      g.fillRect(810, 18, 180, h - 36);
      g.strokeStyle = "rgba(212, 175, 55, 0.5)";
      g.strokeRect(810, 18, 180, h - 36);

      g.font = "bold 20px VT323, monospace";
      g.fillStyle = "#ffd700";
      g.textAlign = "center";
      g.fillText("SP 120 MIN", 900, 52);
      g.fillStyle = "#6ee7b7";
      g.fillText("PAL / SECAM", 900, 80);
      g.fillStyle = "#e5e7eb";
      g.font = "16px monospace";
      g.fillText("BẢO VẬT QG", 900, 110);

      g.restore();
    } catch(e) { console.warn(e); }
  };
  const tx = canvasTex(1024, 160, draw);
  tx.repeat.set(1, 136 / 160);
  tx.offset.set(0, 12 / 160);
  labelDraws.push(() => { draw(tx.userData.canvas.getContext("2d"), 1024, 160); tx.needsUpdate = true; });
  return tx;
}`;

js = js.replace(oldSpineAndTop, newSpineAndTop);

// 6. Update dressTapes to set Vietnamese shell plastics and labels
js = js.replace(
  'if(/^tape_shell_/.test(o.material.name||"")){ o.material=shells[i]||(shells[i]=shellMat(channels[i]?.cassette?.shell)); o.castShadow=!o.material.transparent; }',
  'if(/^tape_shell_/.test(o.material.name||"")){ const sh = ["clear-red","clear-blue","clear-orange","clear-green","smoke","clear-yellow","clear-purple"][i%7]; o.material=shells[i]||(shells[i]=shellMat(sh)); o.castShadow=!o.material.transparent; }'
);
js = js.replace(
  'if(interact.has(o)) interact.get(o).label="TAPE · "+tapeInfo(i).t.toUpperCase();',
  'if(interact.has(o)) interact.get(o).label="BĂNG "+String(i+1).padStart(2,"0")+": "+tapeInfo(i).t.toUpperCase();'
);

// Disable auto-popup of notepad on tape insertion
js = js.replace(
  'if(state.page==="work"&&padOn()&&workHidden&&!zoomed&&!PHONE()) workCard(true);',
  '/* notepad stays down so video is fully visible */'
);

// 7. Replace PAINT object with comprehensive Vietnamese History and 3D Relics
const paintOld = `PAINT = {
  home(t){ if(homeOnTV()&&homeFrame(t)){ rasterFill=!!homeMod?.fill; sx.setTransform(K,0,0,K,0,0); if(!CYC.tv&&t-Math.max(pageT,homeStartT)<2500){ osd("▶ PLAY",60,82); osd("CH 00",900,82,"right"); } return homeAvg; }
    const s=stipple("home",{bg:"#1c2bd4",ink:"#f3f1ff",big:["FELIX","RIESEBERG"],sub:"I BUILD THINGS  ·  CH 00"}); sx.drawImage(s,0,0); sx.setTransform(K,0,0,K,0,0); orbits(s.ink,t);
    if(userT<Infinity||t-revealT<HOME_DELAY) osd("▶ PLAY",60,82); else if(reduce||Math.floor(t/600)%2===0) osd("PRESS PLAY",60,82);   // the film waits for a click or a key
    osd("CH 00",900,82,"right"); return s.avg; },
  work(t){
    if(homeCarry) return PAINT.home(t);   // come from home, and no tape has started yet: the home program plays on
    if(state.tape>=0&&state.tapeState==="playing"&&chInst&&chIdx===state.tape){
      const dt=chLastT?Math.min(100,t-chLastT):16; chLastT=t;
      try{ chCtx.save(); chInst.frame(t-chT0,dt); chCtx.restore(); }catch(e){ console.error(e); chStop(); }
      if(chInst&&cycTape(dt)){ sx.fillStyle="#000"; sx.fillRect(0,0,SRC_W,SRC_H); return CYC_BLACK; }   // played through: the next program's turn (tapecycle)
      sx.drawImage(chCanvas,0,0); rasterFill=!!channels[chIdx]?.fill; sx.setTransform(K,0,0,K,0,0);   // (a film fills the tube)
      if(t-pageT<2500) osd(state.osd||"▶ PLAY",60,82);
      if((chAvgN++&15)===0){ tvAvg(chCanvas,chAvg); }
      return chAvg;
    }
    if(state.tape>=0&&state.tapeState==="playing"){
      const c=TAPES[state.tape]; const s=stipple("tape"+state.tape,{bg:c.bg,ink:c.ink,big:c.big,sub:c.y.toUpperCase()+"  ·  "+c.t.toUpperCase(),seed:state.tape+11});
      sx.drawImage(s,0,0); sx.setTransform(K,0,0,K,0,0); orbits(s.ink,t); osd(state.osd||"▶ PLAY",60,82); osd("TAPE "+String(state.tape+1).padStart(2,"0"),900,82,"right");
      const sec=Math.floor((t-pageT)/1000); osd(\`SP  0:\${String(Math.floor(sec/60)%60).padStart(2,"0")}:\${String(sec%60).padStart(2,"0")}\`,900,668,"right"); return s.avg;
    }
    // the VCR's blue screen
    sx.setTransform(K,0,0,K,0,0); sx.fillStyle="#1733b5"; sx.fillRect(0,0,960,720);
    const held=state.tape>=0&&state.tapeState==="stopped";
    osd(state.tapeState==="loading"?"LOADING…":"■ STOP",60,82); osd(held?"TAPE "+String(state.tape+1).padStart(2,"0"):"VIDEO",900,82,"right");
    if(held){ osd(tapeInfo(state.tape).t.toUpperCase(),480,380,"center",64); osd("PRESS PLAY",480,440,"center",34); }
    else { if(Math.floor(t/700)%2||state.tapeState==="loading") osd(state.tapeState==="loading"?"":"INSERT TAPE",480,380,"center",64);
      osd("PICK A TAPE FROM THE DESK",480,440,"center",34); }
    return new THREE.Color("#1733b5");
  },
  posts(t){ return teletext(t); },
};`;

const paintNew = `PAINT = {
  home(t){
    sx.setTransform(K, 0, 0, K, 0, 0);
    const bgGrad = sx.createRadialGradient(480, 360, 50, 480, 360, 600);
    bgGrad.addColorStop(0, "#192452");
    bgGrad.addColorStop(1, "#070b1c");
    sx.fillStyle = bgGrad;
    sx.fillRect(0, 0, 960, 720);

    // Rotating Dong Son Sun Rays in background
    sx.save();
    sx.translate(480, 300);
    sx.rotate(t * 0.0003);
    sx.strokeStyle = "rgba(235, 195, 110, 0.16)";
    sx.lineWidth = 2.5;
    for (let r = 50; r <= 380; r += 38) {
      sx.beginPath(); sx.arc(0, 0, r, 0, Math.PI * 2); sx.stroke();
    }
    for (let a = 0; a < 14; a++) {
      const ang = (a * Math.PI) / 7;
      sx.beginPath(); sx.moveTo(-Math.cos(ang) * 380, -Math.sin(ang) * 380); sx.lineTo(Math.cos(ang) * 380, Math.sin(ang) * 380); sx.stroke();
    }
    sx.restore();

    // Title Typography
    sx.font = "900 64px Archivo, sans-serif";
    sx.fillStyle = "#ffde8a";
    sx.textAlign = "center";
    sx.fillText("LỊCH SỬ VIỆT NAM", 480, 245);

    sx.font = "700 32px Caveat, cursive";
    sx.fillStyle = "#ffffff";
    sx.fillText("NGÀN NĂM VĂN HIẾN · HÀO KHÍ NON SÔNG", 480, 305);

    sx.font = "24px VT323, monospace";
    sx.fillStyle = "#a8c0ff";
    sx.fillText("CH 00 · PHÒNG CHIẾU RETRO BẢO TÀNG LỊCH SỬ QUỐC GIA", 480, 360);

    // Prompt to select tape or relic
    const blink = Math.floor(t / 600) % 2 === 0;
    if (blink) {
      sx.fillStyle = "#ffcc00";
      sx.font = "bold 28px VT323, monospace";
      sx.fillText("▶ HÃY CHỌN 1 CUỘN PHIM TRÊN BÀN HOẶC BẤM CỔ VẬT 3D", 480, 455);
    }

    // Secondary hint
    sx.fillStyle = "rgba(255,255,255,0.75)";
    sx.font = "22px VT323, monospace";
    sx.fillText("11 CUỘN PHIM TƯ LIỆU · 7 BẢO VẬT QUỐC GIA 3D", 480, 505);

    osd("▶ CH 00: TỔNG QUAN", 60, 82);
    osd("VIETNAM RETRO TV", 900, 82, "right");
    return new THREE.Color("#192452");
  },

  work(t){
    if (homeCarry) return PAINT.home(t);
    if (state.tape >= 0 && state.tapeState === "playing") {
      if (!filmPlayer) {
        filmPlayer = new HistoryFilmPlayer(src, sx, 960, 720, A.ctx);
      }
      if (filmPlayer.tapeIndex !== state.tape) {
        filmPlayer.playTape(state.tape);
      }
      sx.setTransform(K, 0, 0, K, 0, 0);
      const dt = chLastT ? Math.min(100, t - chLastT) : 16;
      chLastT = t;
      filmPlayer.frame(t - chT0, dt);

      const tape = VIETNAM_TAPES[state.tape] || VIETNAM_TAPES[0];
      return new THREE.Color(tape.bg);
    }

    // Stopped or inserting state
    sx.setTransform(K, 0, 0, K, 0, 0);
    sx.fillStyle = "#12204a";
    sx.fillRect(0, 0, 960, 720);
    const held = state.tape >= 0 && state.tapeState === "stopped";
    osd(state.tapeState === "loading" ? "ĐANG TẢI CUỘN PHIM…" : "■ STOP", 60, 82);
    osd(held ? "BĂNG SỐ " + String(state.tape + 1).padStart(2, "0") : "VIDEO TAPE", 900, 82, "right");
    if (held) {
      osd(tapeInfo(state.tape).t.toUpperCase(), 480, 360, "center", 58);
      osd("BẤM PLAY ĐỂ XEM PHIM TƯ LIỆU", 480, 430, "center", 32);
    } else {
      if (Math.floor(t / 700) % 2 || state.tapeState === "loading") {
        osd(state.tapeState === "loading" ? "" : "HÃY CHỌN 1 CUỘN PHIM TRÊN BÀN", 480, 360, "center", 52);
      }
      osd("MỖI CUỘN PHIM LÀ 1 THỜI KỲ LỊCH SỬ HÀO HÙNG", 480, 430, "center", 30);
    }
    return new THREE.Color("#12204a");
  },

  relics(t){
    if (!relicRenderer) {
      if (!relicCanvas) {
        relicCanvas = document.createElement("canvas");
        relicCanvas.width = 960;
        relicCanvas.height = 720;
      }
      relicRenderer = new RelicRenderer(relicCanvas, 960, 720);
    }

    const dt = chLastT ? Math.min(100, t - chLastT) : 16;
    chLastT = t;
    relicRenderer.render(t, dt);

    sx.setTransform(K, 0, 0, K, 0, 0);
    sx.drawImage(relicCanvas, 0, 0);

    const relic = VIETNAM_RELICS[relicRenderer.relicIndex];
    osd("BẢO VẬT 3D · " + (relicRenderer.relicIndex + 1) + "/" + VIETNAM_RELICS.length, 60, 68);
    osd(relic.badge, 900, 68, "right");

    // Right Telemetry Panel
    sx.fillStyle = "rgba(10, 14, 22, 0.88)";
    sx.strokeStyle = "rgba(200, 160, 80, 0.4)";
    sx.lineWidth = 1;
    sx.fillRect(520, 95, 410, 525);
    sx.strokeRect(520, 95, 410, 525);

    sx.font = "900 27px Archivo, sans-serif";
    sx.fillStyle = "#ffdd80";
    sx.textAlign = "left";
    sx.fillText(relic.title, 540, 138);

    sx.font = "700 18px Caveat, cursive";
    sx.fillStyle = "#a2d2ff";
    sx.fillText(relic.era, 540, 172);

    sx.font = "18px VT323, monospace";
    sx.fillStyle = "#8bd4a0";
    sx.fillText("NIÊN ĐẠI: " + relic.era, 540, 210);
    sx.fillText("CHẤT LIỆU: " + relic.material, 540, 240);
    sx.fillText("KÍCH THƯỚC: " + relic.dims, 540, 270);
    sx.fillText("LƯU GIỮ: " + relic.location, 540, 300);

    sx.fillStyle = "#e2ded2";
    sx.font = "15px monospace";
    wrapText(sx, relic.desc, 540, 335, 370, 22);

    // Bottom Navigation Bar
    sx.fillStyle = "rgba(10, 14, 22, 0.92)";
    sx.fillRect(60, 640, 840, 50);
    sx.strokeStyle = "rgba(100, 160, 255, 0.35)";
    sx.strokeRect(60, 640, 840, 50);

    sx.font = "19px VT323, monospace";
    sx.fillStyle = "#ffcc33";
    sx.textAlign = "center";
    sx.fillText("◀ [← TRƯỚC]  ·  [XOAY 360° CHUỘT / CHẠM]  ·  [M: DÂY/HOLOGRAM]  ·  [L: ÁNH SÁNG]  ·  [TIẾP →] ▶", 480, 672);

    return new THREE.Color("#1a2b1f");
  },

  posts(t){ return teletext(t); },
};`;

js = js.replace(paintOld, paintNew);

// 8. Auto-zoom to TV on chooseTape and go("relics")
js = js.replace(
  'function chooseTape(i){\n  if(state.page!=="work") go("work");',
  `function chooseTape(i){
  if(state.page!=="work") go("work");
  padAway();
  setTimeout(() => { if (!zoomed) { setZoomed(true); flyTo(tvZoomFrame()); } }, 1200);`
);

js = js.replace(
  'if(changed&&!atPC(page)) homeCarry=page==="work"&&!silent&&!entry&&wasHome&&state.tapeState!=="playing";',
  `if(changed&&!atPC(page)) homeCarry=page==="work"&&!silent&&!entry&&wasHome&&state.tapeState!=="playing";
  if (page === "relics") {
    padAway();
    if (!zoomed) {
      setTimeout(() => {
        setZoomed(true);
        flyTo(tvZoomFrame());
      }, 150);
    }
  }`
);

// 9. Pointer Drag & Wheel for 3D Relic Rotation
const oldPointerDown = `  const info=down.hit&&interact.get(down.hit);
  if(info&&info.kind==="cd"&&cd?.near&&cd.grab(down.hit,e)){ controls.enabled=false; cdDrag=true; gesture(); }
  if(info&&info.kind==="knob"){ controls.enabled=false; dragKnob={i:info.i,y:e.clientY,v:[state.volume,state.tracking,state.chroma][info.i]}; gesture(); }`;

const newPointerDown = `  const info=down.hit&&interact.get(down.hit);
  if(info&&info.kind==="screen"&&state.page==="relics"){
    controls.enabled=false;
    relicDrag=true;
    relicRenderer?.handlePointerDown(e.clientX, e.clientY);
    try{ canvas.setPointerCapture(e.pointerId); }catch{}
  }
  if(info&&info.kind==="cd"&&cd?.near&&cd.grab(down.hit,e)){ controls.enabled=false; cdDrag=true; gesture(); }
  if(info&&info.kind==="knob"){ controls.enabled=false; dragKnob={i:info.i,y:e.clientY,v:[state.volume,state.tracking,state.chroma][info.i]}; gesture(); }`;

js = js.replace(oldPointerDown, newPointerDown);

const oldPointerUp = `  if(PC.press===e.pointerId) return pcRelease(e,"pointerup");
  if(cdDrag){ cdDrag=false; controls.enabled=true; cd.release(e); down=null; return; }`;

const newPointerUp = `  if(PC.press===e.pointerId) return pcRelease(e,"pointerup");
  if(relicDrag){
    relicDrag=false;
    controls.enabled=true;
    relicRenderer?.handlePointerUp();
    try{ canvas.releasePointerCapture(e.pointerId); }catch{}
  }
  if(cdDrag){ cdDrag=false; controls.enabled=true; cd.release(e); down=null; return; }`;

js = js.replace(oldPointerUp, newPointerUp);

const oldPointerMove = `  if(PC.press===e.pointerId){ const uv=pcRayUV(e); if(uv&&PC.inst) PC.inst.input({type:"pointermove",buttons:e.buttons,...pcUV(uv)}); return; }
  if(cdDrag){ cd.drag(e); return; }`;

const newPointerMove = `  if(PC.press===e.pointerId){ const uv=pcRayUV(e); if(uv&&PC.inst) PC.inst.input({type:"pointermove",buttons:e.buttons,...pcUV(uv)}); return; }
  if(relicDrag){ relicRenderer?.handlePointerMove(e.clientX, e.clientY); return; }
  if(cdDrag){ cd.drag(e); return; }`;

js = js.replace(oldPointerMove, newPointerMove);

// 10. Wheel handler for 3D Relic Zoom
const oldWheel = `canvas.addEventListener("wheel",e=>{ if(DBG.on||!PC.inst||!PC.hover) return;`;
const newWheel = `canvas.addEventListener("wheel",e=>{
  if(state.page==="relics"&&down?.hit===tvScreen){
    relicRenderer?.handleWheel(e.deltaY);
    e.preventDefault();
    return;
  }
  if(DBG.on||!PC.inst||!PC.hover) return;`;

js = js.replace(oldWheel, newWheel);

// 11. Hook screen clicks for Relics mode
const screenClickHook = `  else if(info.kind==="screen"){
    if(state.page==="relics"){
      if(!zoomed){ setZoomed(true); flyTo(tvZoomFrame()); return; }
      if(pickUV.x < 0.28){ relicRenderer?.prevRelic(); click("button"); live("Hiện vật: "+VIETNAM_RELICS[relicRenderer.relicIndex].title); return; }
      if(pickUV.x > 0.72 && pickUV.y > 0.85){ relicRenderer?.nextRelic(); click("button"); live("Hiện vật: "+VIETNAM_RELICS[relicRenderer.relicIndex].title); return; }
      if(pickUV.y > 0.85){ relicRenderer?.toggleWireframe(); click("button"); return; }
      if(pickUV.x > 0.88 && pickUV.y < 0.15){ toggleZoom(); return; }
      relicRenderer?.toggleAutoRotate(); click("button"); return;
    }`;

js = js.replace('  else if(info.kind==="screen"){ if(state.page==="posts"){', screenClickHook + '\n    if(state.page==="posts"){');

// 12. Add keyboard shortcuts for Relic controls & Navigation
const kbdHook = `
addEventListener("keydown", e => {
  if (state.page === "relics") {
    if (e.key === "ArrowLeft") { relicRenderer?.prevRelic(); click("button"); e.preventDefault(); }
    if (e.key === "ArrowRight") { relicRenderer?.nextRelic(); click("button"); e.preventDefault(); }
    if (e.key.toLowerCase() === "m") { relicRenderer?.toggleWireframe(); click("button"); }
    if (e.key.toLowerCase() === "l") { relicRenderer?.setLightMode((relicRenderer.lightMode + 1) % 3); click("button"); }
    if (e.key === " ") { relicRenderer?.toggleAutoRotate(); click("button"); e.preventDefault(); }
  }
  if (e.key.toLowerCase() === "r") {
    go("relics");
  }
});
`;

js += '\n' + kbdHook;

// 13. Add Relics Panel & Work Panel in renderPanel
const relicsPanelCode = `
function relicsPanel(){
  const row = (r, i) => \`<li><button data-relic="\${i}" aria-pressed="\${relicRenderer&&relicRenderer.relicIndex===i}"><span class="n">\${String(i+1).padStart(2,"0")}</span><span class="t">\${esc(r.title)}</span><span class="m">\${esc(r.era)}</span></button></li>\`;
  const cur = VIETNAM_RELICS[relicRenderer ? relicRenderer.relicIndex : 0];
  return \`<div class="sec">7 BẢO VẬT QUỐC GIA 3D</div>
  <ul class="list">\${VIETNAM_RELICS.map(row).join("")}</ul>
  <div class="detail"><div class="m">HỒ SƠ BẢO VẬT · \${esc(cur.badge)}</div>
  <h3>\${esc(cur.title)}</h3>
  <div class="m">\${esc(cur.era)} · \${esc(cur.material)}</div>
  <p class="am">\${esc(cur.desc)}</p>
  <p><strong>Địa điểm lưu giữ:</strong> \${esc(cur.location)}</p>
  <p><strong>Quy cách:</strong> \${esc(cur.dims)}</p></div>\`;
}
`;

js = js.replace('function workPanel(){', relicsPanelCode + '\nfunction workPanel(){');

js = js.replace(
  'if(page==="work") pBody.innerHTML=workPanel();',
  'if(page==="work") pBody.innerHTML=workPanel(); else if(page==="relics") pBody.innerHTML=relicsPanel();'
);

js = js.replace(
  '<div class="sec">COMPANIES</div><ul class="list">${ids.slice(0,JOBS).map(row).join("")}</ul><div class="sec">PROJECTS</div><ul class="list">${ids.slice(JOBS).map(row).join("")}</ul>',
  '<div class="sec">KHỞI NGUYÊN & ĐỘC LẬP TỰ CHỦ</div><ul class="list">${ids.slice(0,6).map(row).join("")}</ul><div class="sec">CẬN HIỆN ĐẠI & THỐNG NHẤT NON SÔNG</div><ul class="list">${ids.slice(6).map(row).join("")}</ul>'
);

// 14. Wire up clicks on data-relic buttons in panel
const relicClickHook = `
panel.addEventListener("click", e => {
  const btn = e.target.closest("button[data-relic]");
  if (!btn) return;
  const idx = +btn.dataset.relic;
  if (relicRenderer) {
    relicRenderer.relicIndex = idx;
    relicRenderer.buildCurrentRelic();
  }
  click("tape", 0.3);
  go("relics");
  renderPanel("relics");
});
`;

js += '\n' + relicClickHook;

// 15. Wire up bottom button btn-relics and expose global API on window.__BM
const hudBtnHook = `
window.__BM = window.__BM || {};
window.__BM.chooseTape = chooseTape;
window.__BM.go = go;
window.__BM.relicRenderer = () => relicRenderer;
window.__BM.filmPlayer = () => filmPlayer;
window.__BM.toggleZoom = toggleZoom;
window.__BM.setZoomed = setZoomed;
window.__BM.tvZoomFrame = tvZoomFrame;
window.__BM.state = state;
window.__BM.enter = enter;
window.__BM.tapes = VIETNAM_TAPES;
window.__BM.relics = VIETNAM_RELICS;

document.addEventListener("DOMContentLoaded", () => {
  const relicBtn = document.getElementById("btn-relics");
  if (relicBtn) relicBtn.addEventListener("click", () => go("relics"));
});
`;

js += '\n' + hudBtnHook;

fs.writeFileSync('vietnam-desktop.js', js);
console.log('Successfully generated vietnam-desktop.js! Size:', js.length);
