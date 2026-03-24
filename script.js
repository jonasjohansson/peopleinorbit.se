import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";

// --- Constants ---
const IMG_W = 8192;
const IMG_H = 5464;
const IMG_RATIO = IMG_W / IMG_H;

const SPOTIFY_ALBUMS = [
  { id: "39Hqg9HOVrra5TX0mdsj4N", type: "artist", name: "All Tracks" },
  { id: "6RRIzc0xLxyFyA3TA5XZwv", type: "album", name: "Close/Away" },
  { id: "2ngfaUxYwwBPgboyQ8sdi8", type: "album", name: "Cycle 3" },
  { id: "5bKbT2mKgfnFd0QPCk8elA", type: "album", name: "Spinning Downwards" },
  { id: "5EYKwy9uGewQ6vmZvrohWv", type: "album", name: "Synchronized Whalestuff" },
  { id: "6vH855OQUkdEdJAdcNIszT", type: "album", name: "Curved Sunlight" },
  { id: "4yFyaG9UktAjKeKx2z2x1e", type: "album", name: "Close/Away (Galaxy of Wires)" },
];
let currentAlbumIndex = 0;

function getSpotifyEmbedUrl() {
  const a = SPOTIFY_ALBUMS[currentAlbumIndex];
  return `https://open.spotify.com/embed/${a.type}/${a.id}?utm_source=generator&theme=0`;
}

const YOUTUBE_VIDEO_ID = "GH_SJYrT8EM";

// --- State ---
let isPlaying = false;
let isDark = false;
let noteInterval = null;

// --- Elements ---
const bgImage = document.getElementById("bgImage");
const bgImageDusk = document.getElementById("bgImageDusk");
const hotspotLayer = document.getElementById("hotspotLayer");
const fxCanvas = document.getElementById("fxCanvas");
const turntableBtn = document.getElementById("turntableBtn");
const musicNotes = document.getElementById("musicNotes");
const tvBtn = document.getElementById("tvBtn");
const tvStatic = document.getElementById("tvStatic");
const staticCanvas = document.getElementById("staticCanvas");
const lampBtn = document.getElementById("lampBtn");
const speakerLeft = document.getElementById("speakerLeft");
const speakerRight = document.getElementById("speakerRight");
const tvScreen = document.getElementById("tvScreen");

// --- FX Parameters ---
const fx = {
  vignette: 0.4,
  vignetteSize: 0.45,
  tintR: 1.0,
  tintG: 0.95,
  tintB: 0.9,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
};

// ============================================================
// Hotspot Regions (% of image) — editable via corner anchors
// ============================================================
const hotspots = {
  tv:        { left: 14.7, top: 67.7, width: 28.0, height: 23.5, color: "#00ff00", el: null, screenEl: tvScreen },
  turntable: { left: 48.0, top: 64.0, width: 18.1, height: 6.2,  color: "#ff4444", el: turntableBtn },
  vinyl:     { left: 72.4, top: 51.8, width: 12.2, height: 14.5, color: "#4444ff", el: document.getElementById("vinylBtn") },
  lamp:      { left: 73.7, top: 29.5, width: 10.8, height: 15.5, color: "#ffaa00", el: lampBtn },
  speakerL:  { left: 47.7, top: 76.5, width: 7.3,  height: 18.1, color: "#ff66ff", el: speakerLeft },
  speakerR:  { left: 63.4, top: 76.1, width: 7.6,  height: 18.4, color: "#66ffff", el: speakerRight },
};

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
  // Also sync the TV clickable area and backlight to match the screen
  if (name === "tv") {
    tvBtn.style.left = h.left + "%";
    tvBtn.style.top = h.top + "%";
    tvBtn.style.width = h.width + "%";
    tvBtn.style.height = h.height + "%";

  }
}

// Initial sync
Object.keys(hotspots).forEach(syncHotspot);

// ============================================================
// Draggable Corner Anchors
// ============================================================
let editMode = false;
const anchors = []; // all anchor elements

function createAnchors() {
  // Remove existing
  anchors.forEach((a) => a.remove());
  anchors.length = 0;

  if (!editMode) return;

  Object.entries(hotspots).forEach(([name, h]) => {
    // 4 corners: TL, TR, BL, BR
    const corners = [
      { cx: "left", cy: "top", cursor: "nw-resize" },
      { cx: "right", cy: "top", cursor: "ne-resize" },
      { cx: "left", cy: "bottom", cursor: "sw-resize" },
      { cx: "right", cy: "bottom", cursor: "se-resize" },
    ];

    corners.forEach((corner) => {
      const dot = document.createElement("div");
      dot.className = "anchor-dot";
      dot.style.background = h.color;
      dot.style.borderColor = h.color;
      dot.dataset.hotspot = name;
      dot.dataset.cx = corner.cx;
      dot.dataset.cy = corner.cy;
      dot.style.cursor = corner.cursor;
      hotspotLayer.appendChild(dot);
      anchors.push(dot);

      positionAnchor(dot, name, corner.cx, corner.cy);

      // Drag logic
      let dragging = false;

      dot.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;

        const onMove = (e2) => {
          if (!dragging) return;
          const layerRect = hotspotLayer.getBoundingClientRect();
          const pctX = ((e2.clientX - layerRect.left) / layerRect.width) * 100;
          const pctY = ((e2.clientY - layerRect.top) / layerRect.height) * 100;

          if (corner.cx === "left") {
            const right = h.left + h.width;
            h.left = Math.max(0, Math.min(pctX, right - 1));
            h.width = right - h.left;
          } else {
            h.width = Math.max(1, pctX - h.left);
          }

          if (corner.cy === "top") {
            const bottom = h.top + h.height;
            h.top = Math.max(0, Math.min(pctY, bottom - 1));
            h.height = bottom - h.top;
          } else {
            h.height = Math.max(1, pctY - h.top);
          }

          syncHotspot(name);
          updateAllAnchors(name);
          // Update Tweakpane
          pane.refresh();
        };

        const onUp = () => {
          dragging = false;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          console.log(`${name}:`, JSON.stringify({ left: +h.left.toFixed(1), top: +h.top.toFixed(1), width: +h.width.toFixed(1), height: +h.height.toFixed(1) }));
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });
  });
}

function positionAnchor(dot, name, cx, cy) {
  const h = hotspots[name];
  const x = cx === "left" ? h.left : h.left + h.width;
  const y = cy === "top" ? h.top : h.top + h.height;
  dot.style.left = x + "%";
  dot.style.top = y + "%";
}

function updateAllAnchors(name) {
  anchors
    .filter((a) => a.dataset.hotspot === name)
    .forEach((a) => positionAnchor(a, a.dataset.hotspot, a.dataset.cx, a.dataset.cy));
}

// ============================================================
// Image Bounds (object-fit: cover)
// ============================================================
const scene = document.getElementById("scene");

function getImageBounds() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewRatio = vw / vh;
  let renderedW, renderedH, offsetX, offsetY;

  if (viewRatio > IMG_RATIO) {
    // Viewport wider — image width-fitted, overflows vertically
    renderedW = vw;
    renderedH = vw / IMG_RATIO;
  } else {
    // Viewport taller — image height-fitted, overflows horizontally
    renderedH = vh;
    renderedW = vh * IMG_RATIO;
  }

  // No negative offsets — image starts at 0,0, container scrolls
  offsetX = 0;
  offsetY = 0;
  return { renderedW, renderedH, offsetX, offsetY };
}

function syncLayout() {
  const { renderedW, renderedH } = getImageBounds();

  // Size both background images to cover
  bgImage.style.width = renderedW + "px";
  bgImage.style.height = renderedH + "px";
  bgImageDusk.style.width = renderedW + "px";
  bgImageDusk.style.height = renderedH + "px";

  // Hotspot layer matches image
  hotspotLayer.style.width = renderedW + "px";
  hotspotLayer.style.height = renderedH + "px";
  hotspotLayer.style.left = "0px";
  hotspotLayer.style.top = "0px";
  // Scale text with image (1% of image width as base font-size)
  hotspotLayer.style.fontSize = (renderedW * 0.01) + "px";


  // Center-bottom scroll position on first load
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (renderedW > vw) {
    scene.scrollLeft = (renderedW - vw) / 2;
  }
  if (renderedH > vh) {
    scene.scrollTop = renderedH - vh; // bottom
  }
}

syncLayout();
window.addEventListener("resize", () => {
  syncLayout();
  resizeGL();
});

// ============================================================
// WebGL Post-Processing
// ============================================================
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

  // Convert screen UV to image UV
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

    // --- Vignette ---
    if (u_vignette > 0.0) {
      vec2 vc = screenUV - 0.5;
      float vDist = length(vc);
      float vFade = smoothstep(u_vignetteSize, 0.9, vDist);
      color.rgb -= vec3(vFade * u_vignette);
      color.a = max(color.a, vFade * u_vignette);
    }

    // --- Tint (applied over entire image area) ---
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
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
  }
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

function render(time) {
  bgImage.style.filter = `brightness(${fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation})`;

  const { renderedW, renderedH } = getImageBounds();
  // Account for scroll offset — FX canvas is fixed, image scrolls
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

// ============================================================
// Tweakpane GUI
// ============================================================
const pane = new Pane({ title: "Post FX", expanded: false });

// Make Tweakpane draggable
{
  const container = pane.element.parentElement;
  container.style.position = "fixed";
  container.style.cursor = "grab";
  container.style.zIndex = "200";
  let dragging = false, ox = 0, oy = 0;
  const title = container.querySelector(".tp-rotv_t");
  if (title) {
    title.style.cursor = "grab";
    title.addEventListener("mousedown", (e) => {
      dragging = true;
      ox = e.clientX - container.offsetLeft;
      oy = e.clientY - container.offsetTop;
      title.style.cursor = "grabbing";
      e.preventDefault();
    });
  }
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    container.style.left = (e.clientX - ox) + "px";
    container.style.top = (e.clientY - oy) + "px";
    container.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    dragging = false;
    if (title) title.style.cursor = "grab";
  });
}

const fVignette = pane.addFolder({ title: "Vignette", expanded: false });
fVignette.addBinding(fx, "vignette", { min: 0, max: 1, step: 0.01, label: "Intensity" });
fVignette.addBinding(fx, "vignetteSize", { min: 0.1, max: 0.8, step: 0.01, label: "Size" });

const fColor = pane.addFolder({ title: "Color", expanded: false });
fColor.addBinding(fx, "brightness", { min: 0.5, max: 1.5, step: 0.01 });
fColor.addBinding(fx, "contrast", { min: 0.5, max: 1.5, step: 0.01 });
fColor.addBinding(fx, "saturation", { min: 0, max: 2, step: 0.01 });
fColor.addBinding(fx, "tintR", { min: 0.5, max: 1.5, step: 0.01, label: "Tint R" });
fColor.addBinding(fx, "tintG", { min: 0.5, max: 1.5, step: 0.01, label: "Tint G" });
fColor.addBinding(fx, "tintB", { min: 0.5, max: 1.5, step: 0.01, label: "Tint B" });

// --- TV Video Color Grading ---
const tvGrade = {
  brightness: 1.37,
  contrast: 1.41,
  saturation: 1.04,
  warmth: 0.07,
  hueRotate: 0,
  opacity: 0.69,
};

function syncTVGrade() {
  const ytEl = document.getElementById("ytPlayer");
  const spotifyEl = document.getElementById("tvSpotify");
  const filter = `brightness(${tvGrade.brightness}) contrast(${tvGrade.contrast}) saturate(${tvGrade.saturation}) sepia(${tvGrade.warmth}) hue-rotate(${tvGrade.hueRotate}deg)`;
  if (ytEl) { ytEl.style.filter = filter; ytEl.style.opacity = tvGrade.opacity; }
  if (spotifyEl) { spotifyEl.style.filter = filter; spotifyEl.style.opacity = tvGrade.opacity; }
}

const fTVGrade = pane.addFolder({ title: "TV Color", expanded: false });
fTVGrade.addBinding(tvGrade, "brightness", { min: 0.3, max: 2.0, step: 0.01 }).on("change", syncTVGrade);
fTVGrade.addBinding(tvGrade, "contrast", { min: 0.3, max: 2.0, step: 0.01 }).on("change", syncTVGrade);
fTVGrade.addBinding(tvGrade, "saturation", { min: 0, max: 2.0, step: 0.01 }).on("change", syncTVGrade);
fTVGrade.addBinding(tvGrade, "warmth", { min: 0, max: 1.0, step: 0.01, label: "Warmth" }).on("change", syncTVGrade);
fTVGrade.addBinding(tvGrade, "hueRotate", { min: -180, max: 180, step: 1, label: "Hue Shift" }).on("change", syncTVGrade);
fTVGrade.addBinding(tvGrade, "opacity", { min: 0.3, max: 1.0, step: 0.01 }).on("change", syncTVGrade);

// Apply initial grade
syncTVGrade();

// --- TV LED Position ---
const led = { top: 92.2, left: 28.7, size: 2.5 };
const tvLedEl = document.getElementById("tvLed");

function syncLed() {
  tvLedEl.style.top = led.top + "%";
  tvLedEl.style.left = led.left + "%";
  tvLedEl.style.width = led.size + "px";
  tvLedEl.style.height = led.size + "px";
}

const fLed = pane.addFolder({ title: "LEDs", expanded: false });
fLed.addBinding(led, "left", { min: 10, max: 50, step: 0.1, label: "TV Left %" }).on("change", syncLed);
fLed.addBinding(led, "top", { min: 80, max: 98, step: 0.1, label: "TV Top %" }).on("change", syncLed);
fLed.addBinding(led, "size", { min: 2, max: 12, step: 0.1, label: "TV Size px" }).on("change", syncLed);

// --- Hifi LED Position ---
const hifi = { top: 83.6, left: 57.5, size: 4 };
const hifiLedEl = document.getElementById("hifiLed");

function syncHifiLed() {
  hifiLedEl.style.top = hifi.top + "%";
  hifiLedEl.style.left = hifi.left + "%";
  hifiLedEl.style.width = hifi.size + "px";
  hifiLedEl.style.height = hifi.size + "px";
}

fLed.addBinding(hifi, "left", { min: 40, max: 80, step: 0.1, label: "Hifi Left %" }).on("change", syncHifiLed);
fLed.addBinding(hifi, "top", { min: 60, max: 95, step: 0.1, label: "Hifi Top %" }).on("change", syncHifiLed);
fLed.addBinding(hifi, "size", { min: 2, max: 12, step: 0.1, label: "Hifi Size px" }).on("change", syncHifiLed);


const fontOptions = {
  "Permanent Marker": "'Permanent Marker', cursive",
  "Caveat": "'Caveat', cursive",
  "Rock Salt": "'Rock Salt', cursive",
  "Northwell": "'Northwell', cursive",
  "Amatic SC": "'Amatic SC', cursive",
  "Kalam": "'Kalam', cursive",
  "Londrina Shadow": "'Londrina Shadow', cursive",
  "Bungee Shade": "'Bungee Shade', cursive",
  "Fredericka": "'Fredericka the Great', cursive",
  "Rubik Doodle Shadow": "'Rubik Doodle Shadow', cursive",
  "Sacramento": "'Sacramento', cursive",
  "Shadows Into Light": "'Shadows Into Light', cursive",
  "Rollerscript Rough": "'Rollerscript Rough', cursive",
  "DK Cool Crayon": "'DK Cool Crayon', cursive",
  "DK Crayon Crumble": "'DK Crayon Crumble', cursive",
  "Eraser": "'Eraser', cursive",
  "Colored Crayons": "'Colored Crayons', cursive",
  "Clouds of Despair": "'Clouds of Despair LSF', cursive",
  "Analo Grotesk": "'Analo Grotesk-Trial', sans-serif",
  "ABC Connect": "'ABC Connect Unlicensed Trial', sans-serif",
  "ABC Connect Mono": "'ABC Connect Mono Unlicensed Trial', monospace",
  "ABC Favorit": "'ABC Favorit Unlicensed Trial', sans-serif",
  "ABC Favorit Mono": "'ABC Favorit Mono Unlicensed Trial', monospace",
  "ABC Ginto Normal": "'ABC Ginto Normal Unlicensed Trial', sans-serif",
  "ABC Ginto Nord": "'ABC Ginto Nord Unlicensed Trial', sans-serif",
  "Agipo": "'Agipo', sans-serif",
  "Ames Roman": "'Ames\\' Roman', serif",
  "Avara": "'Avara', serif",
  "Cukier": "'Cukier', sans-serif",
  "Fugue": "'Fugue', sans-serif",
  "Moderat": "'Moderat Regular', sans-serif",
  "Mondwest": "'Mondwest', sans-serif",
  "PP Mondwest": "'PP Mondwest', sans-serif",
  "Monitor Display": "'Monitor Display', sans-serif",
  "Morion": "'Morion', serif",
  "Matrice": "'Matrice', sans-serif",
  "OffBit": "'OffBit', sans-serif",
  "PP Neue Bit": "'PP Neue Bit', sans-serif",
  "Saol Text": "'SaolText-Regular', serif",
  "Trinite": "'TriniteNo1', serif",
  "Redaction": "'Redaction', serif",
  "Redaction 10": "'Redaction 10', serif",
  "Redaction 50": "'Redaction 50', serif",
  "Redaction 100": "'Redaction 100', serif",
  "Sneak": "'Sneak', sans-serif",
  "Trash": "'Trash', sans-serif",
  "Random": "'Random', sans-serif",
  "Trim Poster": "'Trim Poster', sans-serif",
  "Monorama": "'Monorama', monospace",
  "Necto Mono": "'Necto Mono', monospace",
  "System85": "'System85 Pro', monospace",
  "Synchro": "'SynchroDOT', monospace",
  "GlyphWorld": "'GlyphWorld', sans-serif",
  "System": "system-ui, sans-serif",
};

const fontNames = Object.keys(fontOptions);
const fontOpts = Object.fromEntries(fontNames.map(f => [f, f]));

// --- Hotspot Layout Editor ---
const fLayout = pane.addFolder({ title: "Layout Editor", expanded: false });
const editState = { editMode: false };
fLayout.addBinding(editState, "editMode", { label: "Edit Hotspots" }).on("change", (e) => {
  editMode = e.value;
  createAnchors();
});

// Add per-hotspot folders with numeric inputs
Object.entries(hotspots).forEach(([name, h]) => {
  const f = fLayout.addFolder({ title: name, expanded: false });
  f.addBinding(h, "left",   { min: 0, max: 100, step: 0.1, label: "Left %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "top",    { min: 0, max: 100, step: 0.1, label: "Top %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "width",  { min: 1, max: 100, step: 0.1, label: "Width %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "height", { min: 1, max: 100, step: 0.1, label: "Height %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
});

// Export button — logs all values to console
fLayout.addButton({ title: "Log All Positions" }).on("click", () => {
  const out = {};
  Object.entries(hotspots).forEach(([name, h]) => {
    out[name] = { left: +h.left.toFixed(1), top: +h.top.toFixed(1), width: +h.width.toFixed(1), height: +h.height.toFixed(1) };
  });
  console.log("Hotspot positions:", JSON.stringify(out, null, 2));
});

// ============================================================
// Interactive Features
// ============================================================

// ============================================================
// TV System — YouTube Player API + Spotify iframe
// ============================================================
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

// YouTube API — load dynamically and set up player
window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player("ytPlayer", {
    videoId: YOUTUBE_VIDEO_ID,
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      loop: 1,
      playlist: YOUTUBE_VIDEO_ID,
      playsinline: 1,
    },
    events: {
      onReady: () => {
        ytReady = true;
        ytPlayer.setVolume(ytVolume);
      },
      onStateChange: (e) => {
        ytPlaying = e.data === YT.PlayerState.PLAYING;
        if (ytPlaying) {
          startTimeline();
        } else {
          stopTimeline();
        }
      },
    },
  });

};

// Load YouTube IFrame API script
const ytScript = document.createElement("script");
ytScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytScript);

function startTimeline() {
  stopTimeline();
  timelineInterval = setInterval(() => {
    if (!ytPlayer || !ytReady) return;
    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    if (duration > 0) {
      tvTimelineProgress.style.width = (current / duration) * 100 + "%";
    }
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
  tvTimeline.style.display = "none";

  // Hide YouTube player div
  const ytEl = document.getElementById("ytPlayer");
  if (ytEl) ytEl.style.display = "none";

  // Pause YouTube if switching away
  if (mode !== "youtube" && ytReady && ytPlayer) {
    ytPlayer.pauseVideo();
    ytPlaying = false;
    stopTimeline();
  }


  tvMode = mode;

  // Toggle power LED
  const tvLed = document.getElementById("tvLed");
  if (tvLed) tvLed.classList.toggle("on", mode !== "logo");


  switch (mode) {
    case "logo":
      tvStatic.style.display = "block";
      break;
    case "spotify":
      tvSpotify.src = getSpotifyEmbedUrl();
      tvSpotify.classList.add("active");
      tvSpotify.style.height = "152%";
      tvScreen.style.pointerEvents = "auto";
      break;
    case "youtube":
      if (ytEl) {
        ytEl.style.display = "block";
        ytEl.classList.add("active");
      }
      tvTimeline.style.display = "block";
      tvScreen.style.pointerEvents = "auto";
      if (ytReady && ytPlayer) {
        ytPlayer.playVideo();
      }
      break;
  }
}

// Start with logo
setTVMode("logo");

// --- TV click: play/pause YouTube ---
tvBtn.addEventListener("click", () => {
  if (editMode) return;

  if (tvMode === "logo") {
    // First click: start YouTube
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  } else if (tvMode === "youtube") {
    // Toggle play/pause
    if (ytReady && ytPlayer) {
      if (ytPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  } else if (tvMode === "spotify") {
    // Switch back to YouTube
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  }
});

// --- Play button above TV ---
const tvPlayBtn = document.getElementById("tvPlayBtn");
if (tvPlayBtn) {
  tvPlayBtn.addEventListener("click", () => {
    if (editMode) return;
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  });
}

// --- TV screen overlay: click to play/pause YouTube ---
const tvInteract = document.getElementById("tvInteract");
tvInteract.addEventListener("click", () => {
  if (editMode) return;
  if (tvMode === "logo") {
    if (isPlaying) stopPlaying();
    setTVMode("youtube");
  } else if (tvMode === "youtube") {
    if (ytReady && ytPlayer) {
      if (ytPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  }
});

// --- Timeline: click to seek ---
tvTimeline.addEventListener("click", (e) => {
  if (!ytReady || !ytPlayer) return;
  const rect = tvTimeline.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const duration = ytPlayer.getDuration();
  ytPlayer.seekTo(pct * duration, true);
});

// --- Volume: scroll/swipe on TV screen ---
tvScreen.addEventListener("wheel", (e) => {
  if (tvMode !== "youtube" || !ytReady || !ytPlayer) return;
  e.preventDefault();
  ytVolume = Math.max(0, Math.min(100, ytVolume - Math.sign(e.deltaY) * 5));
  ytPlayer.setVolume(ytVolume);

  // Show volume indicator
  tvVolumeBar.style.height = ytVolume + "%";
  tvVolumeEl.classList.add("visible");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => tvVolumeEl.classList.remove("visible"), 1200);
}, { passive: false });

// Touch swipe for volume (mobile)
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

// --- Turntable: cycle through albums in TV ---
turntableBtn.addEventListener("click", () => {
  if (editMode) return;

  if (!isPlaying) {
    // First click: start playing, show first album
    isPlaying = true;
    currentAlbumIndex = 0;
    setTVMode("spotify");
    turntableBtn.classList.add("playing");
    speakerLeft.classList.add("pulsing");
    speakerRight.classList.add("pulsing");
    document.getElementById("hifiLed").classList.add("on");
    spawnNote();
    noteInterval = setInterval(spawnNote, 800);
  } else {
    // Subsequent clicks: cycle to next album
    currentAlbumIndex = (currentAlbumIndex + 1) % SPOTIFY_ALBUMS.length;
    setTVMode("spotify"); // reload with new album
    spawnNote(); // visual feedback
  }
});

function stopPlaying() {
  isPlaying = false;
  setTVMode("youtube");
  turntableBtn.classList.remove("playing");
  speakerLeft.classList.remove("pulsing");
  speakerRight.classList.remove("pulsing");
  document.getElementById("hifiLed").classList.remove("on");
  clearInterval(noteInterval);
  noteInterval = null;
}

// --- Music Notes ---
const noteChars = ["♪", "♫", "♩", "♬"];
function spawnNote() {
  const note = document.createElement("span");
  note.className = "music-note";
  note.textContent = noteChars[Math.floor(Math.random() * noteChars.length)];
  note.style.left = Math.random() * 80 + 10 + "%";
  note.style.setProperty("--drift", (Math.random() - 0.5) * 40 + "px");
  note.style.setProperty("--rotate", (Math.random() - 0.5) * 60 + "deg");
  note.style.animationDelay = Math.random() * 0.3 + "s";
  musicNotes.appendChild(note);
  note.addEventListener("animationend", () => note.remove());
}

// --- Lamp: crossfade to dusk photo ---
lampBtn.addEventListener("click", () => {
  if (editMode) return;
  isDark = !isDark;
  bgImageDusk.classList.toggle("active", isDark);
});

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

    // Very gentle global flicker
    if (Math.random() < 0.04) {
      globalFlicker = 0.92 + Math.random() * 0.16;
    }

    // Rare faint horizontal band
    const bandY = Math.random() < 0.02 ? Math.floor(Math.random() * h) : -1;
    const bandH = 1 + Math.floor(Math.random() * 2);
    const bandBright = 0.85 + Math.random() * 0.3;

    for (let y = 0; y < h; y++) {
      const scanlineBias = 0.9 + Math.random() * 0.2;
      const inBand = bandY >= 0 && y >= bandY && y < bandY + bandH;

      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;

        // Gentle contrast push
        let v = Math.random();
        v = v < 0.5 ? v * 0.7 : 0.3 + v * 0.7;
        v = v * 255 * scanlineBias * globalFlicker;

        if (inBand) v *= bandBright;

        v = Math.min(255, Math.max(0, v));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 190;
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


// ============================================================
// Portal — Generated image behind the wall, mouse-following mask
// ============================================================
const portal = { size: 12 };
const portalBg = document.getElementById("portalBg");

// Random portal background on each page load
const portalImages = [
  "assets/portal-2.png",
  "assets/portal-3.png",
  "assets/portal-5.png",
  "assets/portal-6.png",
  "assets/portal-23.png",
  "assets/portal-25.png",
  "assets/portal-27.png",
  "assets/portal-28.png",
  "assets/portal-30.png",
  "assets/portal-31.png",
  "assets/portal-32.png",
  "assets/portal-34.png",
  "assets/portal-35.png",
  "assets/portal-36.png",
  "assets/portal-39.png",
  "assets/portal-40.png",
  "assets/portal-41.png",
];
let portalIdx = Math.floor(Math.random() * portalImages.length);
portalBg.src = portalImages[portalIdx];

let portalActive = true;

// Arrow up/down to cycle portal images
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

// Size portal bg to match the main image
function syncPortalSize() {
  const { renderedW, renderedH } = getImageBounds();
  portalBg.style.width = renderedW + "px";
  portalBg.style.height = renderedH + "px";
}

// Mouse-following circular mask
let portalMouseX = 50, portalMouseY = 50;

function syncPortalMask() {
  const r = portal.size;
  const mask = `radial-gradient(circle ${r}vw at ${portalMouseX}% ${portalMouseY}%, transparent 0%, transparent 20%, black 100%)`;
  bgImage.style.webkitMaskImage = mask;
  bgImage.style.maskImage = mask;
  bgImageDusk.style.webkitMaskImage = mask;
  bgImageDusk.style.maskImage = mask;
}

document.addEventListener("mousemove", (e) => {
  const { renderedW, renderedH } = getImageBounds();
  portalMouseX = ((e.clientX + scene.scrollLeft) / renderedW) * 100;
  portalMouseY = ((e.clientY + scene.scrollTop) / renderedH) * 100;
  if (portalActive) syncPortalMask();
});

// Click to cycle portal image
scene.addEventListener("click", () => {
  portalIdx = (portalIdx + 1) % portalImages.length;
  portalBg.src = portalImages[portalIdx];
});

syncPortalSize();
window.addEventListener("resize", () => { syncPortalSize(); syncPortalMask(); });

const fPortal = pane.addFolder({ title: "Portal", expanded: false });
fPortal.addBinding(portal, "size", { min: 2, max: 30, step: 0.1, label: "Size (vw)" }).on("change", syncPortalMask);

// ============================================================
// IKEA-style Info Dots
// ============================================================
const infoDots = {
  band:    { left: 56.8, top: 28.8, el: document.getElementById("infoBand") },
  contact: { left: 22, top: 35.5, el: document.getElementById("infoContact") },
  vinyl:     { left: 78.3, top: 51.5, el: document.getElementById("infoVinyl") },
  closeaway: { left: 82.6, top: 68.5, el: document.getElementById("infoCloseAway") },
  listen:    { left: 54.5, top: 68, el: document.getElementById("infoListen") },
  watch:   { left: 28.8, top: 66.6, el: document.getElementById("infoWatch") },
};

function syncInfoDots() {
  Object.values(infoDots).forEach((d) => {
    d.el.style.left = d.left + "%";
    d.el.style.top = d.top + "%";
  });
}
syncInfoDots();

document.querySelectorAll(".info-dot").forEach((dot) => {
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasActive = dot.classList.contains("active");
    document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
    if (!wasActive) {
      dot.classList.add("active");

      // Position panel based on proximity to edges
      const panel = dot.querySelector(".info-dot__panel");
      if (panel) {
        const dotTop = parseFloat(dot.style.top);
        const dotLeft = parseFloat(dot.style.left);
        // Reset positioning
        panel.style.bottom = "";
        panel.style.top = "";
        panel.style.left = "";
        panel.style.right = "";
        panel.style.transform = "";
        // Flip below if dot is near top edge
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
        // Shift if near left/right edge
        if (dotLeft < 20) {
          panel.style.left = "0";
          panel.style.transform = dotTop < 35 ? "none" : "none";
        } else if (dotLeft > 80) {
          panel.style.left = "auto";
          panel.style.right = "0";
          panel.style.transform = "none";
        }
      }

      // Scroll to center this dot in the viewport
      const { renderedW, renderedH } = getImageBounds();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dotLeft = parseFloat(dot.style.left) / 100 * renderedW;
      const dotTop = parseFloat(dot.style.top) / 100 * renderedH;
      const scrollX = Math.max(0, Math.min(dotLeft - vw / 2, renderedW - vw));
      const scrollY = Math.max(0, Math.min(dotTop - vh / 2, renderedH - vh));
      scene.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });
    }
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
});

// Hotspot style switcher
const textTransforms = { "none": "none", "uppercase": "uppercase", "lowercase": "lowercase", "capitalize": "capitalize" };
const hotspotStyles = {
  style: "dot",
  navFont: "Analo Grotesk", navFontSize: 0.95, navTransform: "uppercase",
  navTextColor: "#ffab41", navBgColor: "#4e4e4e", navBgOpacity: 0.0,
  panelFont: "Analo Grotesk", panelHeadingFont: "Analo Grotesk",
};
const styleOptions = {
  "Dot (minimal)": "dot",
  "Pin (thumbtack)": "pin",
  "Pencil (hand-drawn)": "pencil",
  "Glow (light leak)": "glow",
  "Asterisk (chalk)": "asterisk",
  "Leaf (botanical)": "leaf",
};

function applyHotspotStyle() {
  const el = document.getElementById("hotspotLayer");
  el.className = el.className.replace(/hotspot-style-\S+/g, "").trim();
  el.classList.add(`hotspot-style-${hotspotStyles.style}`);
}

function applyUIFonts() {
  const nav = document.getElementById("floatingNav");
  const panels = document.querySelectorAll(".info-dot__panel");
  const headings = document.querySelectorAll(".info-dot__panel h3");

  if (nav) {
    const ff = fontOptions[hotspotStyles.navFont] || "system-ui, sans-serif";
    const bg = hotspotStyles.navBgColor;
    const r = parseInt(bg.slice(1,3), 16);
    const g = parseInt(bg.slice(3,5), 16);
    const b = parseInt(bg.slice(5,7), 16);
    nav.style.setProperty("--nav-bg", `rgba(${r},${g},${b},${hotspotStyles.navBgOpacity})`);
    nav.style.setProperty("--nav-text", hotspotStyles.navTextColor);
    nav.style.setProperty("--nav-text-hover", hotspotStyles.navTextColor);
    nav.style.setProperty("--nav-font-size", hotspotStyles.navFontSize + "rem");
    nav.style.fontFamily = ff;
    nav.querySelectorAll("button").forEach(btn => {
      btn.style.fontFamily = ff;
      btn.style.textTransform = hotspotStyles.navTransform;
      btn.style.color = hotspotStyles.navTextColor;
    });
  }
  panels.forEach(p => { p.style.fontFamily = fontOptions[hotspotStyles.panelFont]; });
  headings.forEach(h => { h.style.fontFamily = fontOptions[hotspotStyles.panelHeadingFont]; });
}

applyHotspotStyle();
applyUIFonts();

// GUI for positioning info dots
const fInfoDots = pane.addFolder({ title: "Info Dots", expanded: false });
fInfoDots.addBinding(hotspotStyles, "style", { options: styleOptions, label: "Hotspot Style" }).on("change", applyHotspotStyle);
fInfoDots.addBinding(hotspotStyles, "navFont", { options: fontOpts, label: "Nav Font" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "navFontSize", { min: 0.4, max: 2.0, step: 0.05, label: "Nav Size" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "navTransform", { options: textTransforms, label: "Nav Transform" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "navTextColor", { label: "Nav Text Color" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "navBgColor", { label: "Nav Bg Color" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "navBgOpacity", { min: 0, max: 1, step: 0.05, label: "Nav Bg Opacity" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "panelFont", { options: fontOpts, label: "Panel Font" }).on("change", applyUIFonts);
fInfoDots.addBinding(hotspotStyles, "panelHeadingFont", { options: fontOpts, label: "Heading Font" }).on("change", applyUIFonts);
Object.entries(infoDots).forEach(([name, d]) => {
  const f = fInfoDots.addFolder({ title: name, expanded: false });
  f.addBinding(d, "left", { min: 0, max: 100, step: 0.1, label: "Left %" }).on("change", syncInfoDots);
  f.addBinding(d, "top",  { min: 0, max: 100, step: 0.1, label: "Top %" }).on("change", syncInfoDots);
});

// ============================================================
// Floating Navigation — scroll & zoom to targets
// ============================================================
// Nav targets reference infoDots directly
const navTargets = {
  band:    { get left() { return infoDots.band.left; },    get top() { return infoDots.band.top; },    dot: "infoBand" },
  contact: { get left() { return infoDots.contact.left; }, get top() { return infoDots.contact.top; }, dot: "infoContact" },
  vinyl:   { get left() { return infoDots.vinyl.left; },   get top() { return infoDots.vinyl.top; },   dot: "infoVinyl" },
  listen:  { get left() { return infoDots.listen.left; },  get top() { return infoDots.listen.top; },  dot: "infoListen" },
  watch:   { get left() { return infoDots.watch.left; },   get top() { return infoDots.watch.top; },   dot: "infoWatch" },
};

function navigateTo(target) {
  const t = navTargets[target];
  if (!t) return;

  const { renderedW, renderedH } = getImageBounds();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Target pixel position in the image
  const targetX = (t.left / 100) * renderedW;
  const targetY = (t.top / 100) * renderedH;

  // Scroll so target is centered in viewport
  const scrollX = Math.max(0, Math.min(targetX - vw / 2, renderedW - vw));
  const scrollY = Math.max(0, Math.min(targetY - vh / 2, renderedH - vh));

  scene.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });

  // Open the corresponding info dot if it has one
  if (t.dot) {
    // Small delay so scroll starts first
    setTimeout(() => {
      document.querySelectorAll(".info-dot.active").forEach((d) => d.classList.remove("active"));
      const dotEl = document.getElementById(t.dot);
      if (dotEl) dotEl.classList.add("active");
    }, 400);
  }

  // Highlight active nav button
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
