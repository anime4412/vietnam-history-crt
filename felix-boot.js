// ==============================================================================
// felix-boot.js - BỘ ĐIỀU PHỐI KHỞI ĐỘNG OSD VÀ ĐO LƯỜNG TẢI TRANG BẢO TÀNG 3D
// Dự án: Vietnam History CRT Experience (Không gian Bảo tàng Lịch sử CRT 3D)
// ==============================================================================
// [KIẾN THỨC HIỆU NĂNG WEB & TOÁN HỌC ĐỒ HỌA THUYẾT MINH VỚI THẦY CÔ]:
// 1. Giám sát tài nguyên tải về bằng PerformanceObserver API:
//    - Sử dụng chuẩn `PerformanceObserver({ entryTypes: ['resource'] })` của W3C.
//    - Tự động bắt độ lớn byte thực tế (`entry.decodedBodySize`) của các mô hình 3D (.glb) và kết cấu (.jpg/.png)
//      đang tải ngầm, tính toán phần trăm thanh tiến trình chuẩn xác theo băng thông mạng của người dùng.
// 2. Phép biến đổi đồng dạng phối cảnh (Perspective Homography / CSS `matrix3d`):
//    - Màn hình TV CRT trong bức ảnh tĩnh được nhìn ở góc nghiêng từ trên xuống và lệch sang trái (không phải hình chữ nhật phẳng).
//    - Hàm `warp()` sử dụng giải thuật chiếu xạ Heckbert: tính toán ma trận chuyển đổi 4x4 từ 4 điểm góc thực tế
//      để uốn cong thanh tiến trình OSD bám khít chính xác vào mặt kính cong của bóng đèn hình CRT.
// 3. Sinh hoa tuyết nhiễu sóng TV (Procedural CRT Static Noise via LCG):
//    - Sử dụng giải thuật sinh số giả ngẫu nhiên LCG (Linear Congruential Generator: `s = s * 16807 % 2147483647`).
//    - Tạo mảng pixel 128x128 trong Canvas rồi xuất ra Base64 gán vào biến CSS `var(--noise)`,
//      tạo hiệu ứng hạt tuyết CRT cổ điển mà không cần tải tệp video/GIF ngoài.
// 4. Cơ chế tự phục hồi chống kẹt (Watchdog Stall Recovery):
//    - Nếu đường truyền mạng chập chờn, bộ đếm thời gian thực `performance.now()` sẽ tự kích hoạt các mốc
//      chuyển tiếp sau 10s, 14s, 18s và 22s để đảm bảo người dùng luôn vào được phòng 3D mà không bị treo.
// ==============================================================================

(()=>{ const el=document.getElementById("osd"), pc=el&&el.querySelector(".pc"), bar=el&&el.querySelector(".bar i"); if(!pc||!bar) return;
  const LOAD_BYTES=31.4e6, FILE=130e3, SEGS=20, DL=.8, STEPS=[0,0,.8,.87,.94], STEP=.04, WAIT=300;
  let got=0, streamed=0, step=0, shown=0, on=false, fin=false, text="0%", waits=[], last=performance.now(); const t0=last;
  // the loading still, asked for now, next to the room's first files, and shown as soon as it's in: the page's own request
  // only goes once its scripts are in, often seconds later on a phone (the page asks for the same image then, from the
  // cache, and takes it away where the room doesn't open at home). The display waits up to WAIT_STILL for it. The page it
  // opens: the #hash, or in the Ghost theme the page its URL stands for (__BM.pageAt, as the theme's BM_HASH); the still's
  // folder: the page's, or the theme's scene files (this script is its boot.js there, next to them, or they're on another
  // host: __BM.assetBase)
  const at=location.hash.slice(1)||(window.__BM&&window.__BM.pageAt?window.__BM.pageAt(location.pathname):""), WAIT_STILL=1500,
    want=!navigator.connection?.saveData&&(at===""||at==="home"||at!=="debug"&&!matchMedia("(prefers-reduced-motion: reduce)").matches);
  if(want){ const im=new Image(), src=document.currentScript?.src; im.fetchPriority="high"; im.decoding="async";
    im.onload=()=>{ const s=document.getElementById("still"), gl=document.getElementById("gl"); if(s&&!fin&&!gl?.classList.contains("ready")){ s.style.backgroundImage=`url("${im.src}")`; s.classList.add("on"); } };
    im.src=(window.__BM?.assetBase||(src?new URL("./",src).href:"./"))+"tex/still.jpg"; }
  // the screen's grain, and its static as the room comes in: a tile of grey noise, made once
  try{ const c=document.createElement("canvas"); c.width=c.height=128; const g=c.getContext("2d"), im=g.createImageData(128,128); let s=20260928;
    for(let i=0;i<im.data.length;i+=4){ s=s*16807%2147483647; im.data[i]=im.data[i+1]=im.data[i+2]=s/2147483647*256|0; im.data[i+3]=255; }
    g.putImageData(im,0,0); el.style.setProperty("--noise",`url("${c.toDataURL()}")`); }catch(e){}
  // the screen on the TV's glass in the still, which is seen a little from the left and above, and so is no rectangle: its
  // corners (still px: top left, top right, bottom right, bottom left, where the glass's edges, fitted to it, meet, half a
  // pixel or so outside them). The screen, a box of BOX (left, top, width, height in still px, as the style's .tv-scr), is
  // drawn onto them in perspective (--warp: the box onto the unit square, then that onto the corners, Heckbert's), worked
  // out again when the window changes (one pixel of the still: the display's height/1066)
  const Q=[[1096.7,477],[1407.97,473.4],[1406.58,702.48],[1099.29,710.4]], BOX=[1098,475.2,309.3,231.2];
  let warpK=0;
  const warp=()=>{ const k=el.getBoundingClientRect().height/1066; if(!k||k===warpK) return; warpK=k; const W=BOX[2]*k, H=BOX[3]*k,
      [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=Q.map(([x,y])=>[(x-BOX[0])*k-W/2,(y-BOX[1])*k-H/2]),   // (from the box's middle, the transform's origin)
      sx=x0-x1+x2-x3, sy=y0-y1+y2-y3, dx1=x1-x2, dx2=x3-x2, dy1=y1-y2, dy2=y3-y2, den=dx1*dy2-dx2*dy1,
      g=(sx*dy2-dx2*sy)/den, h=(dx1*sy-sx*dy1)/den, a=x1-x0+g*x1, b=x3-x0+h*x3, d=y1-y0+g*y1, e=y3-y0+h*y3;
    el.style.setProperty("--warp",`matrix3d(${[a/W,d/W,0,g/W, b/H,e/H,0,h/H, 0,0,1,0, (a+b)/2+x0,(d+e)/2+y0,0,(g+h)/2+1].map(v=>+v.toFixed(9)).join(",")})`); };
  warp(); addEventListener("resize",warp);
  window.__osdFeed=n=>{ streamed+=n; };
  // (a step's promise settles in a task after the frame that drew it, or WAIT ms on, when it's shown at once)
  const settle=()=>{ const now=performance.now(); waits=waits.filter(w=>{ if(shown<w.v&&now<w.t) return true; if(shown<w.v&&!fin){ shown=w.v; show(shown); } setTimeout(w.r,0); return false; }); };
  window.__osdStep=n=>new Promise(r=>{ n=Math.max(0,Math.min(4,n|0)); step=Math.max(step,n); const h=document.hidden; waits.push({v:STEPS[n],r,t:h?0:performance.now()+WAIT}); setTimeout(settle,h?0:WAIT+5); });
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(e.startTime>=t0&&!/\/gl\/bin\d+\.json(\?|$)/.test(e.name)) got+=e.decodedBodySize||FILE; }).observe({type:"resource"}); }catch(e){}
  const show=v=>{ const t=Math.floor(v*100)+"%"; if(t===text) return; pc.textContent=text=t; bar.style.width=Math.floor(v*SEGS+1e-6)*100/SEGS+"%"; };
  (function tick(now){
    const gl=document.getElementById("gl"), err=document.getElementById("err"), done=gl&&gl.classList.contains("ready"), inside=!!gl&&gl.classList.contains("loaded"),
      still=document.getElementById("still"), lit=!!still&&still.classList.contains("on");
    if(done||err&&!err.hidden){ fin=true; if(done) show(1); for(const w of waits) setTimeout(w.r,0); waits=[]; removeEventListener("resize",warp);
      if(done&&on){ el.classList.add("out"); still?.classList.add("out"); setTimeout(()=>el.remove(),1000); } else { el.classList.remove("on"); setTimeout(()=>el.remove(),600); } return; }
    // lo: where the count and the steps put the bar; hi: as far as it may run ahead (in, and waiting for the click: 100%, at
    // once, with its CLICK TO ENTER)
    const dt=Math.min(.5,Math.max(0,now-last)/1000), lo=inside?1:Math.max(DL*Math.min(1,(streamed+got)/LOAD_BYTES),STEPS[step]),
      hi=inside?1:step>3?.99:step>1?STEPS[step+1]-.01:Math.min(DL,lo+.03); last=now;
    // Fallback tự động tăng tiến độ sau thời gian dài tránh bị kẹt ở 77% khi mạng chập chờn
    if(now-t0>10000&&step<2){ step=2; }
    if(now-t0>14000&&step<3){ step=3; }
    if(now-t0>18000&&step<4){ step=4; }
    if(now-t0>22000&&!done){ if(gl) gl.classList.add("ready"); }

    shown=inside?1:shown<lo?Math.min(lo,shown+Math.min(STEP,Math.max(.6,(lo-shown)*10)*dt)):shown+Math.max(0,hi-shown)*(1-Math.exp(-dt/1.2)); show(shown); settle();
    if(!on&&(inside||lit||now-t0>(want&&still?WAIT_STILL:1000))){ on=true; el.classList.toggle("free",!lit); el.classList.add("on"); }
    else if(on&&el.classList.contains("free")===lit){ el.classList.add("glide"); el.classList.toggle("free",!lit); }   // (the still came late, or went)
    requestAnimationFrame(tick);
  })(t0);
})();
