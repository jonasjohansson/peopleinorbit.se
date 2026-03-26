// --- Preload: fade in when main image is ready ---
const bgImg = document.getElementById("bgImage");
if (bgImg.complete) {
  document.body.classList.remove("loading");
} else {
  bgImg.addEventListener("load", () => document.body.classList.remove("loading"));
}

// --- Load settings ---
let settings;
try {
  const resp = await fetch("settings.json");
  settings = await resp.json();
} catch (e) {
  console.error("Failed to load settings.json", e);
}

const IMG_W = settings.image.width;
const IMG_H = settings.image.height;
const IMG_RATIO = IMG_W / IMG_H;
const fx = settings.fx;
const tvGrade = settings.tvGrade;
const SPOTIFY_ALBUMS = settings.spotify;
const YOUTUBE_VIDEO_ID = settings.youtubeVideoId;
const portalImages = settings.portalImages;

let currentAlbumIndex = 0;
function getSpotifyEmbedUrl() {
  const a = SPOTIFY_ALBUMS[currentAlbumIndex];
  return `https://open.spotify.com/embed/${a.type}/${a.id}?utm_source=generator&theme=0`;
}

// --- State ---
let isPlaying = false;

// --- Elements ---
const bgImage = document.getElementById("bgImage");
const hotspotLayer = document.getElementById("hotspotLayer");
const fxCanvas = document.getElementById("fxCanvas");
const turntableBtn = document.getElementById("turntableBtn");
const tvBtn = document.getElementById("tvBtn");
const tvStatic = document.getElementById("tvStatic");
const staticCanvas = document.getElementById("staticCanvas");
const speakerLeft = document.getElementById("speakerLeft");
const speakerRight = document.getElementById("speakerRight");
const tvInteract = document.getElementById("tvInteract");
const tvScreen = document.getElementById("tvScreen");
const scene = document.getElementById("scene");

// --- Hotspot Regions ---
const hotspots = {};
for (const [name, h] of Object.entries(settings.hotspots)) {
  hotspots[name] = { ...h };
}
hotspots.tv.el = null;
hotspots.tv.screenEl = tvScreen;
hotspots.turntable.el = turntableBtn;
hotspots.lamp.el = null;
hotspots.speakerL.el = speakerLeft;
hotspots.speakerR.el = speakerRight;

function syncHotspot(name) {
  const h = hotspots[name];
  if (h.el) {
    h.el.style.left = h.left + "%";
    h.el.style.top = h.top + "%";
    h.el.style.width = h.width + "%";
    h.el.style.height = h.height + "%";
  }
  if (h.screenEl) {
    h.screenEl.style.left = h.left + "%";
    h.screenEl.style.top = h.top + "%";
    h.screenEl.style.width = h.width + "%";
    h.screenEl.style.height = h.height + "%";
  }
  if (name === "tv") {
    tvBtn.style.left = h.left + "%";
    tvBtn.style.top = h.top + "%";
    tvBtn.style.width = h.width + "%";
    tvBtn.style.height = h.height + "%";
  }
}
Object.keys(hotspots).forEach(syncHotspot);

// --- Image Bounds ---
function getImageBounds() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewRatio = vw / vh;
  let renderedW, renderedH;
  if (viewRatio > IMG_RATIO) {
    renderedW = vw;
    renderedH = vw / IMG_RATIO;
  } else {
    renderedH = vh;
    renderedW = vh * IMG_RATIO;
  }
  return { renderedW, renderedH };
}

function syncLayout() {
  const { renderedW, renderedH } = getImageBounds();
  scene.style.setProperty("--img-w", renderedW + "px");
  scene.style.setProperty("--img-h", renderedH + "px");
  hotspotLayer.style.fontSize = (renderedW * 0.01) + "px";

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (renderedW > vw) scene.scrollLeft = (renderedW - vw) / 2;
  if (renderedH > vh) scene.scrollTop = renderedH - vh;
}

syncLayout();
window.addEventListener("resize", () => { syncLayout(); resizeGL(); });

// --- WebGL Post-Processing ---
const gl = fxCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });

const vertSrc = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const fragSrc = `
  precision mediump float;
  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform float u_vignette;
  uniform float u_vignetteSize;
  uniform vec3 u_tint;
  uniform vec4 u_imageBounds;

  vec2 toImgUV(vec2 screenUV) {
    vec2 pixelPos = screenUV * u_resolution;
    return (pixelPos - u_imageBounds.xy) / u_imageBounds.zw;
  }

  void main() {
    vec2 uv = v_uv;
    vec2 screenUV = vec2(uv.x, 1.0 - uv.y);
    vec2 imgUV = toImgUV(screenUV);
    vec4 color = vec4(0.0);
    bool inImage = imgUV.x >= 0.0 && imgUV.x <= 1.0 && imgUV.y >= 0.0 && imgUV.y <= 1.0;

    if (u_vignette > 0.0) {
      vec2 vc = screenUV - 0.5;
      float vDist = length(vc);
      float vFade = smoothstep(u_vignetteSize, 0.9, vDist);
      color.rgb -= vec3(vFade * u_vignette);
      color.a = max(color.a, vFade * u_vignette);
    }

    if (inImage) {
      vec3 tintOffset = (u_tint - 1.0);
      color.rgb += tintOffset * 0.3;
      color.a = max(color.a, length(tintOffset) * 0.6);
    }

    gl_FragColor = color;
  }
`;

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const vs = compileShader(gl.VERTEX_SHADER, vertSrc);
const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, "a_pos");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, "u_resolution");
const uVignette = gl.getUniformLocation(prog, "u_vignette");
const uVignetteSize = gl.getUniformLocation(prog, "u_vignetteSize");
const uTint = gl.getUniformLocation(prog, "u_tint");
const uImageBounds = gl.getUniformLocation(prog, "u_imageBounds");

function resizeGL() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  fxCanvas.width = w;
  fxCanvas.height = h;
  gl.viewport(0, 0, w, h);
}
resizeGL();

function render() {
  bgImage.style.filter = `brightness(${fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation})`;

  const { renderedW, renderedH } = getImageBounds();
  const scrollX = scene.scrollLeft;
  const scrollY = scene.scrollTop;

  gl.uniform4f(uImageBounds, -scrollX, -scrollY, renderedW, renderedH);
  gl.uniform2f(uRes, fxCanvas.width, fxCanvas.height);
  gl.uniform1f(uVignette, fx.vignette);
  gl.uniform1f(uVignetteSize, fx.vignetteSize);
  gl.uniform3f(uTint, fx.tintR, fx.tintG, fx.tintB);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// --- TV Video Color Grading ---
function syncTVGrade() {
  const ytEl = document.getElementById("ytPlayer");
  const spotifyEl = document.getElementById("tvSpotify");
  const filter = `brightness(${tvGrade.brightness}) contrast(${tvGrade.contrast}) saturate(${tvGrade.saturation}) sepia(${tvGrade.warmth}) hue-rotate(${tvGrade.hueRotate}deg)`;
  if (ytEl) { ytEl.style.filter = filter; ytEl.style.opacity = tvGrade.opacity; }
  if (spotifyEl) { spotifyEl.style.filter = filter; spotifyEl.style.opacity = tvGrade.opacity; }
}
syncTVGrade();

// --- LEDs ---
const tvLedEl = document.getElementById("tvLed");
const hifiLedEl = document.getElementById("hifiLed");

tvLedEl.style.top = settings.leds.tv.top + "%";
tvLedEl.style.left = settings.leds.tv.left + "%";
tvLedEl.style.width = settings.leds.tv.size + "px";
tvLedEl.style.height = settings.leds.tv.size + "px";

hifiLedEl.style.top = settings.leds.hifi.top + "%";
hifiLedEl.style.left = settings.leds.hifi.left + "%";
hifiLedEl.style.width = settings.leds.hifi.size + "px";
hifiLedEl.style.height = settings.leds.hifi.size + "px";

// --- Apply styles ---
hotspotLayer.classList.add(`hotspot-style-${settings.style.hotspotStyle}`);

const nav = document.getElementById("floatingNav");
nav.style.fontFamily = settings.style.navFont;
nav.querySelectorAll("button").forEach(btn => {
  btn.style.fontFamily = settings.style.navFont;
  btn.style.textTransform = settings.style.navTransform;
});
document.querySelectorAll(".info-dot__panel").forEach(p => {
  p.style.fontFamily = settings.style.panelFont;
});

// --- TV System ---
let tvMode = "logo";
const tvLogo = document.getElementById("tvLogo");
const tvSpotify = document.getElementById("tvSpotify");
const tvTimeline = document.getElementById("tvTimeline");
const tvTimelineProgress = document.getElementById("tvTimelineProgress");
const tvVolumeEl = document.getElementById("tvVolume");
const tvVolumeBar = document.getElementById("tvVolumeBar");

let ytPlayer = null;
let ytReady = false;
let ytPlaying = false;
let ytVolume = 80;
let timelineInterval = null;
let volumeTimeout = null;

window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player("ytPlayer", {
    videoId: YOUTUBE_VIDEO_ID,
    playerVars: {
      autoplay: 0, controls: 0, modestbranding: 1, rel: 0,
      showinfo: 0, loop: 1, playlist: YOUTUBE_VIDEO_ID, playsinline: 1,
    },
    events: {
      onReady: () => { ytReady = true; ytPlayer.setVolume(ytVolume); },
      onStateChange: (e) => {
        ytPlaying = e.data === YT.PlayerState.PLAYING;
        ytPlaying ? startTimeline() : stopTimeline();
      },
    },
  });
};

const ytScript = document.createElement("script");
ytScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytScript);

function startTimeline() {
  stopTimeline();
  timelineInterval = setInterval(() => {
    if (!ytPlayer || !ytReady) return;
    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    if (duration > 0) tvTimelineProgress.style.width = (current / duration) * 100 + "%";
  }, 250);
}

function stopTimeline() {
  clearInterval(timelineInterval);
  timelineInterval = null;
}

function setTVMode(mode) {
  tvStatic.style.display = "none";
  if (tvLogo) tvLogo.style.display = "none";
  tvSpotify.classList.remove("active");
  tvSpotify.style.height = "100%";
  tvSpotify.src = "";
  tvScreen.style.pointerEvents = "none";
  tvInteract.style.display = "";
  tvTimeline.style.display = "none";

  const ytEl = document.getElementById("ytPlayer");
  if (ytEl) ytEl.style.display = "none";

  if (mode !== "youtube" && ytReady && ytPlayer) {
    ytPlayer.pauseVideo();
    ytPlaying = false;
    stopTimeline();
  }

  tvMode = mode;
  tvLedEl.classList.toggle("on", mode !== "logo");

  switch (mode) {
    case "logo":
      tvStatic.style.display = "block";
      break;
    case "spotify":
      tvSpotify.src = getSpotifyEmbedUrl();
      tvSpotify.classList.add("active");
      tvSpotify.style.height = "152%";
      tvScreen.style.pointerEvents = "auto";
      tvInteract.style.display = "none";
      break;
    case "youtube":
      if (ytEl) { ytEl.style.display = "block"; ytEl.classList.add("active"); }
      tvTimeline.style.display = "block";
      tvScreen.style.pointerEvents = "auto";
      if (ytReady && ytPlayer) ytPlayer.playVideo();
      break;
  }
}

setTVMode("logo");

// --- TV click ---
tvBtn.addEventListener("click", () => {
  if (tvMode === "logo") {
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  } else if (tvMode === "youtube") {
    if (ytReady && ytPlayer) ytPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
  } else if (tvMode === "spotify") {
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  }
});

const tvPlayBtn = document.getElementById("tvPlayBtn");
if (tvPlayBtn) {
  tvPlayBtn.addEventListener("click", () => {
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  });
}

tvInteract.addEventListener("click", () => {
  if (tvMode === "logo") {
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  } else if (tvMode === "youtube") {
    if (ytReady && ytPlayer) ytPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
  }
});

tvTimeline.addEventListener("click", (e) => {
  if (!ytReady || !ytPlayer) return;
  const rect = tvTimeline.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  ytPlayer.seekTo(pct * ytPlayer.getDuration(), true);
});

tvScreen.addEventListener("wheel", (e) => {
  if (tvMode !== "youtube" || !ytReady || !ytPlayer) return;
  e.preventDefault();
  ytVolume = Math.max(0, Math.min(100, ytVolume - Math.sign(e.deltaY) * 5));
  ytPlayer.setVolume(ytVolume);
  tvVolumeBar.style.height = ytVolume + "%";
  tvVolumeEl.classList.add("visible");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => tvVolumeEl.classList.remove("visible"), 1200);
}, { passive: false });

let touchStartY = 0;
tvScreen.addEventListener("touchstart", (e) => {
  if (tvMode !== "youtube") return;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

tvScreen.addEventListener("touchmove", (e) => {
  if (tvMode !== "youtube" || !ytReady || !ytPlayer) return;
  const deltaY = touchStartY - e.touches[0].clientY;
  touchStartY = e.touches[0].clientY;
  ytVolume = Math.max(0, Math.min(100, ytVolume + deltaY * 0.5));
  ytPlayer.setVolume(ytVolume);
  tvVolumeBar.style.height = ytVolume + "%";
  tvVolumeEl.classList.add("visible");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => tvVolumeEl.classList.remove("visible"), 1200);
}, { passive: true });

// --- Turntable ---
turntableBtn.addEventListener("click", () => {
  if (!isPlaying) {
    isPlaying = true;
    currentAlbumIndex = 0;
    setTVMode("spotify");
    turntableBtn.classList.add("playing");
    hifiLedEl.classList.add("on");
  } else {
    currentAlbumIndex = (currentAlbumIndex + 1) % SPOTIFY_ALBUMS.length;
    setTVMode("spotify");
  }
});

function stopPlaying() {
  isPlaying = false;
  setTVMode("youtube");
  turntableBtn.classList.remove("playing");
  hifiLedEl.classList.remove("on");
}

// --- TV Static ---
function drawStatic() {
  const ctx = staticCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const w = (staticCanvas.width = 480);
  const h = (staticCanvas.height = 360);
  let globalFlicker = 1.0;

  function renderFrame() {
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    if (Math.random() < 0.04) globalFlicker = 0.92 + Math.random() * 0.16;
    const bandY = Math.random() < 0.02 ? Math.floor(Math.random() * h) : -1;
    const bandH = 1 + Math.floor(Math.random() * 2);
    const bandBright = 0.85 + Math.random() * 0.3;

    for (let y = 0; y < h; y++) {
      const scanlineBias = 0.9 + Math.random() * 0.2;
      const inBand = bandY >= 0 && y >= bandY && y < bandY + bandH;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let v = Math.random();
        v = v < 0.5 ? v * 0.7 : 0.3 + v * 0.7;
        v = v * 255 * scanlineBias * globalFlicker;
        if (inBand) v *= bandBright;
        v = Math.min(255, Math.max(0, v));
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 190;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(renderFrame);
  }
  renderFrame();
}
drawStatic();

// --- ESC ---
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPlaying) stopPlaying();
});

// --- Portal ---
const portalBg = document.getElementById("portalBg");
let portalIdx = Math.floor(Math.random() * portalImages.length);

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    portalIdx = (portalIdx - 1 + portalImages.length) % portalImages.length;
    portalBg.src = portalImages[portalIdx];
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    portalIdx = (portalIdx + 1) % portalImages.length;
    portalBg.src = portalImages[portalIdx];
  }
});

scene.addEventListener("click", () => {
  portalIdx = (portalIdx + 1) % portalImages.length;
  portalBg.src = portalImages[portalIdx];
});

// --- Info Dots ---
const infoDots = {};
for (const [name, pos] of Object.entries(settings.infoDots)) {
  infoDots[name] = { ...pos, el: document.getElementById("info" + name.charAt(0).toUpperCase() + name.slice(1)) };
}
// Fix casing for special IDs
infoDots.closeaway.el = document.getElementById("infoCloseAway");

function syncInfoDots() {
  Object.values(infoDots).forEach((d) => {
    d.el.style.left = d.left + "%";
    d.el.style.top = d.top + "%";
  });
}
syncInfoDots();

document.querySelectorAll(".info-dot__panel").forEach((panel) => {
  panel.addEventListener("click", (e) => e.stopPropagation());
});

const navTargets = {
  band:    { get left() { return infoDots.band.left; },    get top() { return infoDots.band.top; },    dot: "infoBand" },
  contact: { get left() { return infoDots.contact.left; }, get top() { return infoDots.contact.top; }, dot: "infoContact" },
  vinyl:   { get left() { return infoDots.vinyl.left; },   get top() { return infoDots.vinyl.top; },   dot: "infoVinyl" },
  listen:  { get left() { return infoDots.listen.left; },  get top() { return infoDots.listen.top; },  dot: "infoListen" },
  watch:   { get left() { return infoDots.watch.left; },   get top() { return infoDots.watch.top; },   dot: "infoWatch" },
};

document.querySelectorAll(".info-dot").forEach((dot) => {
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasActive = dot.classList.contains("active");
    document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
    if (!wasActive) {
      dot.classList.add("active");
      const dotId = dot.id;
      const navTarget = Object.keys(navTargets).find((k) => navTargets[k].dot === dotId);
      document.querySelectorAll(".floating-nav button").forEach((b) => {
        b.classList.toggle("active", b.dataset.target === navTarget);
      });

      const panel = dot.querySelector(".info-dot__panel");
      if (panel) {
        const dotTop = parseFloat(dot.style.top);
        const dotLeft = parseFloat(dot.style.left);
        panel.style.bottom = "";
        panel.style.top = "";
        panel.style.left = "";
        panel.style.right = "";
        panel.style.transform = "";
        if (dotTop < 35) {
          panel.style.top = "calc(100% + 1.2em)";
          panel.style.bottom = "auto";
          panel.style.left = "50%";
          panel.style.transform = "translateX(-50%)";
        } else {
          panel.style.bottom = "calc(100% + 1.2em)";
          panel.style.top = "auto";
          panel.style.left = "50%";
          panel.style.transform = "translateX(-50%)";
        }
        // Always keep panel horizontally centered on the dot
      }

      // Scroll to center the dot+panel combo after panel renders
      requestAnimationFrame(() => {
        const { renderedW, renderedH } = getImageBounds();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dotLeftPx = parseFloat(dot.style.left) / 100 * renderedW;
        const dotTopPx = parseFloat(dot.style.top) / 100 * renderedH;
        let centerY = dotTopPx;
        if (panel) {
          const panelRect = panel.getBoundingClientRect();
          const dotRect = dot.getBoundingClientRect();
          // Find the midpoint of the combined dot+panel area in viewport, then map to scroll coords
          const comboTop = Math.min(dotRect.top, panelRect.top);
          const comboBottom = Math.max(dotRect.bottom, panelRect.bottom);
          const comboMidViewport = (comboTop + comboBottom) / 2;
          // Convert viewport midpoint to document position
          centerY = comboMidViewport + scene.scrollTop;
        }
        const scrollX = Math.max(0, Math.min(dotLeftPx - vw / 2, renderedW - vw));
        const scrollY = Math.max(0, Math.min(centerY - vh / 2, renderedH - vh));
        scene.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });
      });
    }
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
  document.querySelectorAll(".floating-nav button.active").forEach((b) => b.classList.remove("active"));
});

// --- Navigation ---
function navigateTo(target) {
  const t = navTargets[target];
  if (!t) return;

  const { renderedW, renderedH } = getImageBounds();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetX = (t.left / 100) * renderedW;
  const targetY = (t.top / 100) * renderedH;
  // Offset scroll to center the panel area, not the hotspot
  let panelOffsetY = 0;
  if (t.dot) {
    const dotEl = document.getElementById(t.dot);
    if (dotEl) {
      const panel = dotEl.querySelector(".info-dot__panel");
      const panelH = (panel && panel.offsetHeight) || 120;
      panelOffsetY = t.top < 35 ? panelH / 2 : -(panelH / 2);
    }
  }
  const scrollX = Math.max(0, Math.min(targetX - vw / 2, renderedW - vw));
  const scrollY = Math.max(0, Math.min(targetY + panelOffsetY - vh / 2, renderedH - vh));
  const needsScroll = Math.abs(scene.scrollLeft - scrollX) > 5 || Math.abs(scene.scrollTop - scrollY) > 5;

  if (needsScroll) scene.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });

  if (t.dot) {
    const openDot = () => {
      document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
      const dotEl = document.getElementById(t.dot);
      if (dotEl) dotEl.click();
    };
    needsScroll ? setTimeout(openDot, 400) : openDot();
  }

  document.querySelectorAll(".floating-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.target === target);
  });
}

document.querySelectorAll(".floating-nav button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateTo(btn.dataset.target);
  });
});
