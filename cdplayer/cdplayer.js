// The CD player on the desk (Felix, 26 Sep 03:03Z): the room's music, and a close-up of it. A click on the player brings the
// camera down to it. There its four buttons work (◀◀ ▶‖ ■ ▶▶), its LCD shows the song and where it is, and a thumbwheel in
// the lid, right of the LCD, turns the music up or down: drag it, roll the mouse wheel over the player, or ↑ ↓. Esc goes back.
//
// createMusic(o): the music itself, from the page's first lines on (it doesn't need the scene):
//   o.tracks    [{id, title, loop:[start, end]}], in the disc's order; the first one plays first
//   o.url(id)   where a track's MP3 is
//   o.audio()   {ctx, bus} once the page has its sound graph (bus: the music's own gain node), else null
//   o.level     the bus's gain at the wheel's middle step (the page's level for its music)
// Each song loops on its own seamless loop points (REPEAT 1): a disc of songs, one of them playing all evening. yieldTo(true)
// holds the music while something else has music playing (the TV's film), and yieldTo(false, fade) brings it back where it was.
// A song is decoded a few seconds at a time (Felix, 28 Sep 15:31Z: the room crashing weak Firefox on small phones): decoded
// whole, a song is 35 to 55 MB of samples, and two were kept; a piece is some 3 MB, and at most KEEP are. See pieces below.
//
// createCDPlayer(THREE, c): the player in the room, or null if the scene has none:
//   c.root, c.interact (the page's pick map), c.view() (the camera as drawn), c.canvas, c.music (createMusic's),
//   c.reduce, c.audio() ({ctx, out} for its own clicks while the room has sound, else null), c.soundOn(), c.live(text),
//   c.claim(how) (the player used: how is "play" ▶‖ that plays, "skip" ◀◀ ▶▶, "turn" the wheel or "look" the LCD; the page
//   may give the CD the music, from the TV's), c.give() (■: the CD gives it back, if it took it)
// The controller: near / setNear(v) (the close-up), shot() (the close-up's {tgt, pos}), limits(controls), act(hit, heard),
// grab(hit, e) / drag(e) / release(e) for the wheel, scroll(hit, deltaY), key(k), tip(hit), frame(dt, t) once a frame, busy.
export function createMusic(o){
  const T = o.tracks, N = T.length, STEPS = 10, MID = 7, SEEK_MS = 420;
  let cur = 0, mode = "play", step = MID, started = false, loading = false;
  let seekT = -1e9, volT = -1e9, yielded = false;

  const factor = k => k <= 0 ? 0 : Math.pow(k / MID, 1.7);

  // Modern robust HTML5 Audio with Web Audio routing
  const audio = typeof Audio !== "undefined" ? new Audio() : null;
  if (audio) {
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
  }

  let mediaNode = null;
  function connectGraph(){
    const a = o.audio && o.audio();
    if (!a || !a.ctx || !audio) return;
    if (a.ctx.state !== "running") a.ctx.resume().catch(()=>{});
    if (a.bus && !mediaNode) {
      try {
        mediaNode = a.ctx.createMediaElementSource(audio);
        mediaNode.connect(a.bus);
      } catch(e) {
        // Fallback to direct output
      }
    }
    if (a.bus) {
      a.bus.gain.value = (o.level || 0.85) * factor(step);
    }
  }

  function applyVolume(){
    if (!audio) return;
    const baseLvl = (o.level !== undefined) ? o.level : 0.85;
    const v = Math.max(0, Math.min(1, baseLvl * factor(step)));
    audio.volume = v;
    const a = o.audio && o.audio();
    if (a && a.bus && a.ctx) {
      a.bus.gain.setTargetAtTime(baseLvl * factor(step), a.ctx.currentTime, 0.035);
    }
  }

  function loadAndPlay(i, playNow = true){
    cur = ((i % N) + N) % N;
    seekT = performance.now();
    loading = true;
    if (!audio) return;
    const url = o.url(T[cur].id);
    audio.src = url;
    audio.currentTime = (T[cur].loop && T[cur].loop[0]) || 0;

    if (playNow && mode === "play") {
      connectGraph();
      applyVolume();
      audio.play().then(() => {
        loading = false;
      }).catch(e => {
        console.warn("CD audio play:", e);
        loading = false;
      });
    } else {
      loading = false;
    }
  }

  if (audio) {
    audio.onended = () => {
      select(cur + 1);
    };
    audio.onerror = (e) => {
      console.warn("Audio element error on track", T[cur]?.id, e);
      loading = false;
    };
  }

  function start(){
    started = true;
    if (mode === "play" && audio && audio.paused) {
      loadAndPlay(cur, true);
    }
  }

  function play(){
    started = true;
    mode = "play";
    yielded = false;
    if (!audio) return;
    connectGraph();
    applyVolume();
    if (!audio.src || audio.src === "" || audio.ended) {
      loadAndPlay(cur, true);
    } else {
      audio.play().catch(e => {
        console.warn("CD resume error:", e);
      });
    }
  }

  function pause(){
    started = true;
    mode = "pause";
    if (audio) audio.pause();
  }

  function stop(){
    started = true;
    mode = "stop";
    if (audio) {
      audio.pause();
      audio.currentTime = (T[cur].loop && T[cur].loop[0]) || 0;
    }
  }

  function toggle(){
    if (mode === "play" && audio && !audio.paused) pause();
    else play();
  }

  function select(i){
    started = true;
    cur = ((i % N) + N) % N;
    seekT = performance.now();
    if (mode === "play") {
      yielded = false;
      loadAndPlay(cur, true);
    } else if (audio) {
      audio.src = o.url(T[cur].id);
      audio.currentTime = (T[cur].loop && T[cur].loop[0]) || 0;
    }
  }

  function vol(k){
    k = Math.max(0, Math.min(STEPS, Math.round(k)));
    volT = performance.now();
    if (k === step) return false;
    step = k;
    applyVolume();
    return true;
  }

  function pos(){
    if (mode === "stop" || !audio) return null;
    return audio.currentTime || 0;
  }

  function yieldTo(on, fade = 1.2){
    on = !!on;
    if (on === yielded) return;
    yielded = on;
    if (on) {
      if (mode === "play" && audio) audio.pause();
    } else {
      if (mode === "play" && started && audio) {
        connectGraph();
        applyVolume();
        audio.play().catch(()=>{});
      }
    }
  }

  return {
    tracks: T,
    start,
    play,
    pause,
    stop,
    toggle,
    select,
    next: () => select(cur + 1),
    prev: () => select(cur - 1),
    vol,
    pos,
    yieldTo,
    get yielded(){ return yielded; },
    fetch(i){ if (typeof Audio !== "undefined") { const a = new Audio(); a.preload = "auto"; a.src = o.url(T[i].id); } },
    get track(){ return cur; },
    get mode(){ return mode; },
    get playing(){ return mode === "play" && audio && !audio.paused; },
    get step(){ return step; },
    get steps(){ return STEPS; },
    get loading(){ return loading; },
    get sounding(){ return mode === "play" && audio && !audio.paused; },
    get started(){ return started; },
    get seekT(){ return seekT; },
    get volT(){ return volT; },
    get audio(){ return audio; },
    gain: () => factor(step),
    held(){ return { pieces: 1, bytes: 1024 }; },
    state(){ return { want: T[cur].id, paused: mode !== "play", bed: mode === "play", pos: pos(), track: cur, mode, step, loading }; }
  };
}

export function createCDPlayer(THREE, c){
  const V3=THREE.Vector3;
  const g=c.root.getObjectByName("gear_discman"); if(!g) return null;
  const M=c.music, parts=g.children.filter(o=>o.isMesh&&o.geometry?.attributes?.position);
  g.updateWorldMatrix(true,true);
  const bbox=o=>{ o.geometry.computeBoundingBox(); return o.geometry.boundingBox; };
  // The player as gear90s.py builds it, in its own frame (x right, y up, z toward the room): a rounded-square shell
  // (superellipse, 13.2 by 13.6 cm, exponent 2.7) under a silver lid whose top is 2.65 cm up; on the lid's front third
  // the LCD (22 by 6.5 mm) and under it the four buttons (11 by 5.5 mm, 17 mm apart), their glyphs printed above them.
  const A=.066, B=.068, P=2.7, TOP=.0265;
  const BTN_X=[-.0255,-.0085,.0085,.0255], BTN_Z=.0535;
  const glass=parts.find(o=>{ const b=bbox(o); return Math.abs(b.max.x-.011)<.0015&&Math.abs(b.min.x+.011)<.0015&&Math.abs((b.min.z+b.max.z)/2-.0385)<.002&&b.max.y-b.min.y<.001; });
  const digits=parts.find(o=>o!==glass&&(()=>{ const b=bbox(o); return b.max.y-b.min.y<.0002&&b.min.y>.0268&&Math.abs((b.min.z+b.max.z)/2-.039)<.003&&b.max.x-b.min.x<.02; })());
  if(!glass) return null;

  // ---- the buttons: their triangles come out of the shell's mesh into four of their own, so they can go down when pressed
  const btns=[];
  { const src=parts.find(o=>{ const p=o.geometry.attributes.position; for(let i=0;i<p.count;i++) if(Math.abs(p.getX(i)-BTN_X[0])<.006&&Math.abs(p.getZ(i)-BTN_Z)<.003&&p.getY(i)>TOP+.0005) return true; return false; });
    if(src){ const geo=src.geometry, p=geo.attributes.position, ix=geo.index?Array.from(geo.index.array):[...Array(p.count).keys()];
      const inBtn=v=>{ const x=p.getX(v), y=p.getY(v), z=p.getZ(v); if(y<.0253||y>.0277||Math.abs(z-BTN_Z)>.0031) return -1;
        for(let i=0;i<4;i++) if(Math.abs(x-BTN_X[i])<.0059) return i; return -1; };
      const keep=[], take=[[],[],[],[]];
      for(let t=0;t+2<ix.length;t+=3){ const a=inBtn(ix[t]); if(a>=0&&inBtn(ix[t+1])===a&&inBtn(ix[t+2])===a) take[a].push(ix[t],ix[t+1],ix[t+2]); else keep.push(ix[t],ix[t+1],ix[t+2]); }
      if(take.every(t=>t.length)){
        geo.setIndex(keep);
        take.forEach((tri,i)=>{ const bg=new THREE.BufferGeometry(); for(const [k,a] of Object.entries(geo.attributes)) bg.setAttribute(k,a); bg.setIndex(tri);
          const m=new THREE.Mesh(bg,src.material); m.name="gear_discman_btn"+i; m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
          m.castShadow=src.castShadow; m.receiveShadow=src.receiveShadow; m.renderOrder=src.renderOrder; g.add(m);
          btns.push({mesh:m,y0:m.position.y,press:-1}); }); } } }

  // ---- the volume wheel: a knurled thumbwheel in a slot in the lid, right of the LCD, standing 2.2 mm proud of it; you roll
  // it back to turn the music up. VOL is printed in front of it. (Blender, next time: gear90s.py should model it, and the
  // bake would light it.)
  const WR=.0065, WW=.0046, WX=.046, WZ=.034, WOUT=.0022, CHORD=2*Math.sqrt(WR*WR-(WR-WOUT)**2);
  const wAxis=new V3(1,0,0), wC=new V3(WX,TOP+WOUT-WR,WZ);
  const wheel=new THREE.Group(), spin=new THREE.Group(); wheel.name="gear_discman_wheel"; wheel.add(spin);
  { const sh=new THREE.Shape(), NT=40;
    for(let i=0;i<NT;i++){ const a0=i/NT*Math.PI*2, da=Math.PI*2/NT;
      for(const [f,r] of [[0,WR],[.42,WR],[.55,WR-.00045],[.92,WR-.00045]]){ const a=a0+da*f; if(i===0&&f===0) sh.moveTo(Math.cos(a)*r,Math.sin(a)*r); else sh.lineTo(Math.cos(a)*r,Math.sin(a)*r); } }
    sh.closePath();
    const eg=new THREE.ExtrudeGeometry(sh,{depth:WW-.0006,bevelEnabled:true,bevelThickness:.0003,bevelSize:.00018,bevelSegments:1,curveSegments:1});
    eg.translate(0,0,-(WW-.0006)/2); eg.computeVertexNormals();
    const rim=new THREE.Mesh(eg,new THREE.MeshStandardMaterial({color:"#4a4d53",roughness:.36,metalness:0})); rim.name="gear_discman_wheel_rim"; spin.add(rim);
    // its faces: a ring pressed into each, catching a little light on the side you see
    const hub=new THREE.Mesh(new THREE.RingGeometry(.0011,WR-.0011,40),new THREE.MeshStandardMaterial({color:"#2a2c30",roughness:.38,metalness:0,side:THREE.DoubleSide}));
    hub.position.z=WW/2+.00002; spin.add(hub); const hub2=hub.clone(); hub2.position.z=-hub.position.z; spin.add(hub2);
    // (the extrusion's axis is its z: turned onto the wheel's)
    wheel.quaternion.setFromUnitVectors(new V3(0,0,1),wAxis); wheel.position.copy(wC);
    // the slot in the lid it comes out of, and the print in front of it
    const slot=new THREE.Mesh(new THREE.PlaneGeometry(WW+.0014,CHORD+.0014).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:"#0b0c0e"}));
    slot.position.set(WX,TOP+.00005,WZ); slot.name="gear_discman_slot"; g.add(slot);
    const pc=document.createElement("canvas"); pc.width=256; pc.height=128; const pg=pc.getContext("2d");
    pg.fillStyle="#fff"; pg.font='700 74px "Helvetica Neue",Arial,sans-serif'; pg.textAlign="center"; pg.textBaseline="middle"; pg.fillText("VOL",128,70);
    const ptex=new THREE.CanvasTexture(pc);
    const print=new THREE.Mesh(new THREE.PlaneGeometry(.008,.004).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#2e2f31",roughness:.6,alphaMap:ptex,transparent:true,depthWrite:false}));
    print.position.set(WX,TOP+.00005,WZ+CHORD/2+.0032); print.name="gear_discman_volprint"; g.add(print); }
  g.add(wheel);
  let wAng=0, wAngTo=0;

  // ---- the LCD: a canvas over the glass, lit by the bake like the glass it covers, with its backlight as its glow
  const LW=.022, LH=.0065, LZ=.0385, LY=.027+.00004;
  const CW=704, CH=208, cv=document.createElement("canvas"); cv.width=CW; cv.height=CH; const lg=cv.getContext("2d");
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8; tex.channel=0;
  const lcdGeo=new THREE.PlaneGeometry(LW,LH).rotateX(-Math.PI/2); lcdGeo.translate(0,LY,LZ);
  { // the glass's light map coordinates, corner by corner, for the canvas's corners
    const gp=glass.geometry.attributes.position, gn=glass.geometry.attributes.normal, gu=glass.geometry.attributes.uv1||glass.geometry.attributes.uv, lp=lcdGeo.attributes.position, u1=new Float32Array(lp.count*2);
    for(let i=0;i<lp.count;i++){ let best=-1, bd=1e9; for(let j=0;j<gp.count;j++){ if(gn&&gn.getY(j)<.9) continue;   // the top face's corners (not the sides' that share them)
        const d=Math.hypot(gp.getX(j)-lp.getX(i),gp.getY(j)-.027,gp.getZ(j)-lp.getZ(i)); if(d<bd){ bd=d; best=j; } }
      u1[i*2]=best>=0?gu.getX(best):0; u1[i*2+1]=best>=0?gu.getY(best):0; }
    lcdGeo.setAttribute("uv1",new THREE.BufferAttribute(u1,2)); }
  const lcdMat=glass.material.clone(); lcdMat.onBeforeCompile=glass.material.onBeforeCompile; lcdMat.customProgramCacheKey=glass.material.customProgramCacheKey;
  Object.assign(lcdMat,{map:tex,emissiveMap:tex,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  lcdMat.color.set("#ffffff"); lcdMat.emissive.set("#4fe3a1"); lcdMat.emissiveIntensity=0;
  const lcd=new THREE.Mesh(lcdGeo,lcdMat); lcd.name="gear_discman_lcd"; lcd.position.copy(glass.position); lcd.quaternion.copy(glass.quaternion); g.add(lcd);
  if(digits) digits.visible=false;   // the bake's digits ("07 3:41"): the canvas shows what plays

  // segments, drawn as an LCD's are: all of them faintly there, the lit ones dark, leaning a little
  const BG="#8d9676", ON="rgba(30,37,29,.92)", GHOST="rgba(30,37,29,.075)", LEAN=.1;
  let skewY0=0;
  const sk=(x,y)=>[x+(skewY0-y)*LEAN,y];
  function poly(pts,style){ lg.fillStyle=style; lg.beginPath(); pts.forEach(([x,y],i)=>{ const [a,b]=sk(x,y); i?lg.lineTo(a,b):lg.moveTo(a,b); }); lg.closePath(); lg.fill(); }
  function hbar(x0,x1,y,s,st){ poly([[x0,y],[x0+s/2,y-s/2],[x1-s/2,y-s/2],[x1,y],[x1-s/2,y+s/2],[x0+s/2,y+s/2]],st); }
  function vbar(x,y0,y1,s,st){ poly([[x,y0],[x+s/2,y0+s/2],[x+s/2,y1-s/2],[x,y1],[x-s/2,y1-s/2],[x-s/2,y0+s/2]],st); }
  function dbar(x0,y0,x1,y1,s,st){ const dx=x1-x0, dy=y1-y0, l=Math.hypot(dx,dy), nx=-dy/l*s/2, ny=dx/l*s/2; poly([[x0+nx,y0+ny],[x1+nx,y1+ny],[x1-nx,y1-ny],[x0-nx,y0-ny]],st); }
  // a 14-segment cell: a b c d e f (the 7-segment ring), G H (the middle's halves), i j k (upper diagonal, spine, diagonal), l m n (lower)
  const F14={" ":"","0":"abcdef","1":"bc","2":"abdeGH","3":"abcdGH","4":"bcfGH","5":"acdfGH","6":"acdefGH","7":"abc","8":"abcdefGH","9":"abcdfGH","-":"GH",
    A:"abcefGH",B:"abcdjmH",C:"adef",D:"abcdjm",E:"adefG",F:"aefG",G:"acdefH",H:"bcefGH",I:"adjm",J:"bcde",K:"efGkn",L:"def",M:"bcefik",N:"bcefin",O:"abcdef",
    P:"abefGH",Q:"abcdefn",R:"abefGHn",S:"acdfGH",T:"ajm",U:"bcdef",V:"efkl",W:"bcefln",X:"ikln",Y:"ikm",Z:"adkl"};
  const F7={"0":"abcdef","1":"bc","2":"abdeGH","3":"abcdGH","4":"bcfGH","5":"acdfGH","6":"acdefGH","7":"abc","8":"abcdefGH","9":"abcdfGH","-":"GH"," ":""};
  function cell(ch,X,Y,w,h,s,fourteen){
    const on=(fourteen?F14:F7)[ch]??"", all=fourteen?"abcdefGHijklmn":"abcdefg", q=s*.16, mx=X+w/2, my=Y+h/2;
    skewY0=Y+h;
    for(const seg of all){ const st=(seg==="g"?/[GH]/.test(on):on.includes(seg))?ON:GHOST;
      if(seg==="a") hbar(X+q,X+w-q,Y+s/2,s,st);
      else if(seg==="d") hbar(X+q,X+w-q,Y+h-s/2,s,st);
      else if(seg==="g") hbar(X+q,X+w-q,my,s,st);   // (seven segments: one middle bar)
      else if(seg==="G") hbar(X+q,mx-q*.6,my,s,st);
      else if(seg==="H") hbar(mx+q*.6,X+w-q,my,s,st);
      else if(seg==="f") vbar(X+s/2,Y+q,my-q*.6,s,st);
      else if(seg==="e") vbar(X+s/2,my+q*.6,Y+h-q,s,st);
      else if(seg==="b") vbar(X+w-s/2,Y+q,my-q*.6,s,st);
      else if(seg==="c") vbar(X+w-s/2,my+q*.6,Y+h-q,s,st);
      else if(seg==="j") vbar(mx,Y+s+q,my-s/2-q*.4,s*.8,st);
      else if(seg==="m") vbar(mx,my+s/2+q*.4,Y+h-s-q,s*.8,st);
      else if(seg==="i") dbar(X+s+q*1.5,Y+s+q*1.5,mx-s*.55,my-s*.6,s*.72,st);
      else if(seg==="k") dbar(X+w-s-q*1.5,Y+s+q*1.5,mx+s*.55,my-s*.6,s*.72,st);
      else if(seg==="l") dbar(X+s+q*1.5,Y+h-s-q*1.5,mx-s*.55,my+s*.6,s*.72,st);
      else if(seg==="n") dbar(X+w-s-q*1.5,Y+h-s-q*1.5,mx+s*.55,my+s*.6,s*.72,st); }
  }
  function dot(x,y,r,on){ skewY0=y; const [a,b]=sk(x,y); lg.fillStyle=on?ON:GHOST; lg.beginPath(); lg.arc(a,b,r,0,Math.PI*2); lg.fill(); }
  function icon(kind,x,y,sz,on){   // ▶ ‖ ■ on the strip over the digits
    skewY0=y+sz; const st=on?ON:GHOST;
    if(kind==="play") poly([[x,y],[x+sz*.9,y+sz/2],[x,y+sz]],st);
    else if(kind==="pause"){ poly([[x,y],[x+sz*.3,y],[x+sz*.3,y+sz],[x,y+sz]],st); poly([[x+sz*.55,y],[x+sz*.85,y],[x+sz*.85,y+sz],[x+sz*.55,y+sz]],st); }
    else if(kind==="stop") poly([[x,y],[x+sz*.85,y],[x+sz*.85,y+sz*.85],[x,y+sz*.85]],st);
  }
  function small(text,x,y,px,on,align="left"){ lg.save(); lg.font=`700 ${px}px "Helvetica Neue",Arial,sans-serif`; lg.textAlign=align; lg.textBaseline="alphabetic";
    lg.fillStyle=on?ON:GHOST; lg.setTransform(1,0,-LEAN,1,LEAN*y,0); lg.fillText(text,x,y); lg.restore(); }
  function battery(x,y,on){ skewY0=y+22; poly([[x,y],[x+46,y],[x+46,y+22],[x,y+22]],on?ON:GHOST); lg.fillStyle=BG; poly([[x+4,y+4],[x+42,y+4],[x+42,y+18],[x+4,y+18]],BG);
    for(let k=0;k<3;k++) poly([[x+7+k*12,y+7],[x+16+k*12,y+7],[x+16+k*12,y+15],[x+7+k*12,y+15]],on?ON:GHOST); poly([[x+46,y+7],[x+51,y+7],[x+51,y+15],[x+46,y+15]],on?ON:GHOST); }

  // what the LCD shows: the song's number and time (blinking while paused), its name after a skip, or the volume's bars
  let near=false, nameT=-1e9, actT=-1e9, drawn="", light=0;
  const NAME_MS=2300, VOL_MS=1600, SCROLL_MS=240;   // a name longer than the LCD's ten cells scrolls through them, a cell at a time
  const nameMs=()=>NAME_MS+Math.max(0,M.tracks[M.track].title.length-10)*SCROLL_MS;
  const nameOff=now=>{ const over=M.tracks[M.track].title.length-10; return over<=0?0:Math.max(0,Math.min(over,Math.floor((now-Math.max(nameT,M.seekT)-700)/SCROLL_MS))); };
  const held=()=>M.mode==="pause"||(M.mode==="play"&&M.yielded);   // (held: while the TV's film plays its music)
  const mmss=s=>{ s=Math.max(0,Math.floor(s)); return [String(Math.floor(s/60)%10),String(s%60).padStart(2,"0")]; };
  function screen(now){ if(now-M.volT<VOL_MS) return "vol"; if(now-Math.max(nameT,M.seekT)<nameMs()) return "name"; return "time"; }
  function lcdKey(now){ const sc=screen(now), t=M.pos(), tr=M.tracks[M.track];
    const secs=M.mode==="stop"||t==null?-1:Math.floor(t-tr.loop[0]);
    const blink=held()&&(now%1000)>620;
    return [sc,M.track,M.mode,M.loading?1:0,sc==="time"?secs:sc==="name"?nameOff(now):0,blink?1:0,M.step,M.yielded?1:0].join("|"); }
  function drawLCD(now){
    const sc=screen(now), tr=M.tracks[M.track], playing=M.mode==="play", t=M.pos();
    lg.setTransform(1,0,0,1,0,0); lg.fillStyle=BG; lg.fillRect(0,0,CW,CH);
    // the small print along the top: what the disc is doing, repeat one, the battery
    icon("play",250,16,24,playing&&!M.loading&&!M.yielded); icon("pause",286,16,24,held()); icon("stop",322,17,22,M.mode==="stop");
    if(sc==="name"){
      const rawTitle = tr.lcdTitle || tr.title;
      const clean = rawTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toUpperCase();
      const s = clean.slice(nameOff(now)).padEnd(10).slice(0,10);
      for(let i=0;i<10;i++) cell(s[i],26+i*66,58,54,130,11,true);
    }
    else if(sc==="vol"){
      for(let i=0;i<3;i++) cell("VOL"[i],26+i*66,58,54,130,11,true);
      for(let i=0;i<10;i++){ const h=36+i*10.4, x=248+i*44; skewY0=188; poly([[x,188-h],[x+32,188-h],[x+32,188],[x,188]],i<M.step?ON:GHOST); }
    }
    else {
      const n=String(M.track+1).padStart(2,"0"); cell(n[0],26,58,74,130,15,false); cell(n[1],114,58,74,130,15,false);
      const secs=M.mode==="stop"||t==null?0:t-tr.loop[0], [m,ss]=mmss(secs), hide=held()&&(now%1000)>620, dash=M.loading&&playing;
      const d=dash?["-","-","-"]:hide?[" "," "," "]:[m,ss[0],ss[1]];
      cell(d[0],334,58,74,130,15,false); dot(430,98,8,!hide); dot(424,150,8,!hide); cell(d[1],454,58,74,130,15,false); cell(d[2],542,58,74,130,15,false);
    }
    tex.needsUpdate=true;
  }

  // ---- the parts you can press: boxes a little bigger than the buttons (their glyphs included) and than the wheel, never drawn
  const pick=new Map(), hidden=new THREE.MeshBasicMaterial({visible:false});
  const proxy=(geo,part,i)=>{ const m=new THREE.Mesh(geo,hidden); m.name="gear_discman_hit_"+part+(i??""); m.visible=false; g.add(m); c.interact.set(m,{kind:"cd",label:"CD PLAYER",part,i}); pick.set(m,{part,i}); return m; };
  BTN_X.forEach((x,i)=>{ const m=proxy(new THREE.BoxGeometry(.0145,.0034,.0118),"btn",i); m.position.set(x,TOP+.0012,.0512); });
  { const m=proxy(new THREE.BoxGeometry(.0115,.006,CHORD+.0105),"wheel"); m.position.set(WX,TOP+.0012,WZ+.0022); }
  const partOf=h=>pick.get(h)||(h===glass||h===digits?{part:"lcd"}:{part:"body"});
  g.updateWorldMatrix(true,true);

  // ---- sounds of its own: a small plastic click, the laser seeking, the wheel's detents
  let noise=null;
  function snd(kind){
    const a=c.audio&&c.audio(); if(!a) return; const ac=a.ctx, t=ac.currentTime+.005;
    if(!noise){ noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const burst=(dt,f,q,amp,dur,type="bandpass")=>{ const s=ac.createBufferSource(), fl=ac.createBiquadFilter(), gg=ac.createGain();
      s.buffer=noise; fl.type=type; fl.frequency.value=f; fl.Q.value=q; gg.gain.setValueAtTime(.0001,t+dt); gg.gain.exponentialRampToValueAtTime(amp,t+dt+.0008); gg.gain.exponentialRampToValueAtTime(.0001,t+dt+.0008+dur);
      s.connect(fl).connect(gg).connect(a.out); s.start(t+dt,Math.random()*.5); s.stop(t+dt+dur+.03); };
    if(kind==="press"){ burst(0,3900,3,.22,.006); burst(0,520,1,.1,.012,"lowpass"); burst(.075,4600,4,.08,.004); }
    else if(kind==="seek"){ for(let k=0;k<5;k++) burst(.05+k*(.045+Math.random()*.02),6800+Math.random()*1500,6,.035,.003); burst(.02,1100,2.2,.018,.32); }
    else if(kind==="tick") burst(0,5600,7,.07,.003);
    else if(kind==="end") burst(0,2600,5,.06,.004);
  }

  // ---- what the parts do
  function light_(){ actT=performance.now(); }
  // heard: the room's sound was on before this press (a press in a silent room brings the sound and the music)
  // the player used (Felix, 27 Sep 21:32Z: "if the user interacts with the discman, we should mute the home video music and
  // play whatever the discman is playing"): the page may give the CD the music, from the TV's (c.claim); held for it, ▶‖ plays
  const claim=how=>{ if(c.claim) c.claim(how); };
  function press(i,heard=!!(c.audio&&c.audio())){
    const b=btns[i]; if(b) b.press=performance.now(); snd("press"); light_();
    if(i===1){ if(M.yielded||!heard||!M.playing){ claim("play"); c.soundOn&&c.soundOn(); M.play(); } else M.pause(); }
    else if(i===2){ M.stop(); c.give&&c.give(); }   // (and gives the music back, if it took it)
    else { claim("skip"); c.soundOn&&c.soundOn(); if(i===0) M.prev(); else M.next(); if(M.playing) snd("seek"); }
    say(i===2?"Stopped":i===1?(M.playing?"Playing ":"Paused, ")+title():title());
  }
  function turn(d){ claim("turn"); const was=M.step; if(!M.vol(M.step+d)){ snd("end"); return false; } wAngTo-=(M.step-was)*Math.PI*2/24; snd("tick"); light_(); say("Volume "+M.step+" of "+M.steps,true); return true; }
  let sayT=0;
  function say(text,soft){ if(!c.live) return; const now=performance.now(); if(soft&&now-sayT<700) return; sayT=now; c.live(text); }
  const title=()=>M.tracks[M.track].title;
  function act(h,heard){ const p=partOf(h); if(!near) return;
    if(p.part==="btn") press(p.i,heard);
    else if(p.part==="wheel") turn(1);
    else if(p.part==="lcd"){ claim("look"); nameT=performance.now(); light_(); snd("press"); } }
  // the wheel: a drag up turns it up, a tap above its middle a step up, below a step down
  let hold=null, acc=0, accT=0;
  function grab(h,e){ const p=partOf(h); if(!near||p.part!=="wheel") return false; hold={y:e.clientY,x:e.clientX,s:M.step,moved:false}; light_(); return true; }
  function drag(e){ if(!hold) return; const dy=hold.y-e.clientY; if(Math.abs(dy)>4) hold.moved=true; if(!hold.moved) return;
    const want=Math.max(0,Math.min(M.steps,hold.s+Math.round(dy/14))); if(want!==M.step) turn(want-M.step); }
  function release(e){ const h=hold; hold=null; if(!h||h.moved||!e) return;
    const s=wC.clone().applyMatrix4(g.matrixWorld).project(c.view()), cy=(-s.y*.5+.5)*innerHeight; turn(e.clientY<cy?1:-1); }
  // the mouse wheel over the player: a notch a step (up louder); a trackpad's small deltas add up, 50 px a step
  function wheelIn(h,dy){ if(!near) return false; const now=performance.now(); if(now-accT>350) acc=0; accT=now;
    if(Math.abs(dy)>=50){ acc=0; turn(dy<0?1:-1); return true; }
    acc+=dy; if(Math.abs(acc)>=50){ turn(acc<0?1:-1); acc=0; } return true; }
  function key(k){ if(!near) return false;
    if(k==="arrowleft") press(0); else if(k==="arrowright") press(3); else if(k===" "||k==="spacebar") press(1);
    else if(k==="arrowup") turn(1); else if(k==="arrowdown") turn(-1); else return false; return true; }
  function tip(h){ const p=partOf(h), tr=title().toUpperCase();
    if(c.canvas) c.canvas.style.cursor=near&&p.part==="wheel"?"ns-resize":"pointer";
    if(!near) return "CD PLAYER · "+(M.mode==="stop"?"STOPPED":tr);
    if(p.part==="btn") return ["PREVIOUS SONG",M.playing&&!M.yielded?"PAUSE":"PLAY","STOP","NEXT SONG"][p.i];
    if(p.part==="wheel") return "VOLUME · "+M.step;
    return tr+" · "+(M.mode==="stop"?"STOPPED":held()?"PAUSED":"PLAYING"); }

  // ---- the close-up: looking down at the lid from its front right, the whole player in the picture
  const EL=THREE.MathUtils.degToRad(57), AZ=THREE.MathUtils.degToRad(11);
  const LOOK=new V3(.003,.018,.006);
  const outline=[]; for(let k=0;k<48;k++){ const t=k/48*Math.PI*2, cx=Math.cos(t), sz=Math.sin(t);
    const x=A*Math.sign(cx)*Math.pow(Math.abs(cx),2/P), z=B*Math.sign(sz)*Math.pow(Math.abs(sz),2/P); outline.push(new V3(x,0,z),new V3(x,TOP,z)); }
  function shot(){
    g.updateWorldMatrix(true,false);
    const cam=c.view(), tv=Math.tan(THREE.MathUtils.degToRad(cam.fov/2)), asp=innerWidth/innerHeight, th=tv*asp;
    const q=new THREE.Quaternion(); g.getWorldQuaternion(q);
    const dir=new V3(Math.sin(AZ)*Math.cos(EL),Math.sin(EL),Math.cos(AZ)*Math.cos(EL)).applyQuaternion(q).normalize();
    const tgt=LOOK.clone().applyMatrix4(g.matrixWorld);
    // the camera's own axes, looking along -dir with the world's up
    const right=new V3().crossVectors(new V3(0,1,0),dir).normalize(), up=new V3().crossVectors(dir,right).normalize();
    // how far back it stands for every point of the outline to fall inside 84% of the width and 74% of the height (the page's
    // bar along the top and its buttons at the bottom keep clear)
    let d=.12; const w=new V3();
    for(const p of outline){ w.copy(p).applyMatrix4(g.matrixWorld).sub(tgt);
      const f=w.dot(dir), r=Math.abs(w.dot(right)), u=w.dot(up);
      d=Math.max(d,f+r/(th*.84),f+(u>0?u/(tv*.7):-u/(tv*.78))); }
    return {tgt,pos:tgt.clone().addScaledVector(dir,d)};
  }
  function limits(ctl){ const s=shot(), o=s.pos.clone().sub(s.tgt), az=Math.atan2(o.x,o.z), po=Math.acos(o.y/o.length()), d=o.length();
    ctl.minAzimuthAngle=az-.6; ctl.maxAzimuthAngle=az+.6; ctl.minPolarAngle=Math.max(.12,po-.45); ctl.maxPolarAngle=Math.min(1.32,po+.5);
    ctl.minDistance=Math.min(.12,d*.6); ctl.maxDistance=Math.max(.7,d*1.8); }
  function setNear(v){ if(near===v) return; near=v; if(v){ nameT=performance.now(); light_(); M.tracks.forEach((_,i)=>M.fetch(i)); } else { hold=null; acc=0; } }

  // ---- once a frame
  const PRESS=.0007;
  function frame(dt){
    const now=performance.now();
    for(const b of btns){ if(b.press<0) continue; const k=(now-b.press)/1000, e=k<.04?k/.04:k<.13?1:Math.max(0,1-(k-.13)/.09);
      b.mesh.position.y=b.y0-e*PRESS; if(k>.25){ b.press=-1; b.mesh.position.y=b.y0; } }
    if(wAng!==wAngTo){ wAng+=(wAngTo-wAng)*Math.min(1,dt*(c.reduce?60:18)); if(Math.abs(wAngTo-wAng)<1e-4) wAng=wAngTo; spin.rotation.z=wAng; }
    // the backlight: on in the close-up, and for a few seconds after a press anywhere; it comes up and fades like an EL panel
    const want=near||now-actT<5000?1:0; if(light!==want){ light+=(want-light)*Math.min(1,dt*(want>light?7:2.2)); if(Math.abs(want-light)<.004) light=want; lcdMat.emissiveIntensity=1.1*light; }
    const k=lcdKey(now); if(k!==drawn){ drawn=k; drawLCD(now); }
  }
  drawLCD(performance.now());

  return {group:g,buttons:btns.map(b=>b.mesh),wheel,lcd,canvas:cv,
    get near(){ return near; }, setNear, shot, limits, act, grab, drag, release, scroll:wheelIn, key, tip, frame, press, turn, title,
    get screen(){ return screen(performance.now()); }, get light(){ return light; },
    get busy(){ return btns.some(b=>b.press>=0)||wAng!==wAngTo||(light>0&&light<1); },
    // where a point of the player (its own frame, metres) is on the screen, for tests
    toScreen(x,y,z){ const v=new V3(x,y,z).applyMatrix4(g.matrixWorld).project(c.view()); return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}; },
    parts:{btn:BTN_X.map((x,i)=>[x,TOP+.0009,BTN_Z]),wheel:[WX,TOP+WOUT,WZ],lcd:[0,LY,LZ]}};
}
