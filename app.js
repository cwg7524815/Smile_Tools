"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  videoInput: $("videoInput"),
  sourceVideo: $("sourceVideo"),
  previewCanvas: $("previewCanvas"),
  mattePreviewCanvas: $("mattePreviewCanvas"),
  workCanvas: $("workCanvas"),
  cellCanvas: $("cellCanvas"),
  dropZone: $("dropZone"),
  emptyState: $("emptyState"),
  playBtn: $("playBtn"),
  seekRange: $("seekRange"),
  timeLabel: $("timeLabel"),
  rowsInput: $("rowsInput"),
  colsInput: $("colsInput"),
  fpsInput: $("fpsInput"),
  maxSecondsInput: $("maxSecondsInput"),
  resetGridBtn: $("resetGridBtn"),
  extractBtn: $("extractBtn"),
  resultsList: $("resultsList"),
  frameEditor: $("frameEditor"),
  frameEditorCanvas: $("frameEditorCanvas"),
  frameEditorInfo: $("frameEditorInfo"),
  framePlayBtn: $("framePlayBtn"),
  frameOffsetXInput: $("frameOffsetXInput"),
  frameOffsetYInput: $("frameOffsetYInput"),
  resetFrameOffsetBtn: $("resetFrameOffsetBtn"),
  frameStrip: $("frameStrip"),
  resultCount: $("resultCount"),
  previewInfo: $("previewInfo"),
  floatPreviewBtn: $("floatPreviewBtn"),
  previewModal: $("previewModal"),
  previewModalHeader: $("previewModalHeader"),
  closePreviewModalBtn: $("closePreviewModalBtn"),
  zoomOutPreviewBtn: $("zoomOutPreviewBtn"),
  zoomResetPreviewBtn: $("zoomResetPreviewBtn"),
  zoomInPreviewBtn: $("zoomInPreviewBtn"),
  largePreviewViewport: $("largePreviewViewport"),
  largePreviewCanvas: $("largePreviewCanvas"),
  previewRowInput: $("previewRowInput"),
  previewColInput: $("previewColInput"),
  folderStatus: $("folderStatus"),
  selectAllBtn: $("selectAllBtn"),
  pickFolderBtn: $("pickFolderBtn"),
  exportFolderBtn: $("exportFolderBtn"),
  matteEnabled: $("matteEnabled"),
  resetMatteBtn: $("resetMatteBtn"),
  keyModeInput: $("keyModeInput"),
  bgColorInput: $("bgColorInput"),
  toleranceInput: $("toleranceInput"),
  softnessInput: $("softnessInput"),
  alphaCutInput: $("alphaCutInput"),
  despillInput: $("despillInput"),
  spillTargetInput: $("spillTargetInput"),
  spillColorInput: $("spillColorInput"),
  sampleSpillBtn: $("sampleSpillBtn"),
  spillDesaturateInput: $("spillDesaturateInput"),
  spillHueRangeInput: $("spillHueRangeInput"),
  edgeShrinkInput: $("edgeShrinkInput"),
  lumaThresholdInput: $("lumaThresholdInput"),
  lumaSoftnessInput: $("lumaSoftnessInput"),
  lumaStrengthInput: $("lumaStrengthInput"),
  lumaGlowInput: $("lumaGlowInput"),
  edgeCleanInput: $("edgeCleanInput"),
  alphaGrowInput: $("alphaGrowInput"),
  alphaFeatherInput: $("alphaFeatherInput"),
  transparentCleanInput: $("transparentCleanInput"),
  advancedMatteBtn: $("advancedMatteBtn"),
  centerEnabled: $("centerEnabled"),
  paddingInput: $("paddingInput"),
  offsetXInput: $("offsetXInput"),
  offsetYInput: $("offsetYInput"),
  sheetColsInput: $("sheetColsInput"),
  exportModeInput: $("exportModeInput"),
  clearMasksBtn: $("clearMasksBtn"),
  brushSizeInput: $("brushSizeInput"),
};

const ctx = els.previewCanvas.getContext("2d", { willReadFrequently: true });
const mattePreviewCtx = els.mattePreviewCanvas.getContext("2d", { willReadFrequently: true });
const largePreviewCtx = els.largePreviewCanvas.getContext("2d", { willReadFrequently: true });
const frameEditorCtx = els.frameEditorCanvas.getContext("2d", { willReadFrequently: true });
const workCtx = els.workCanvas.getContext("2d", { willReadFrequently: true });
const cellCtx = els.cellCanvas.getContext("2d", { willReadFrequently: true });

const state = {
  videoUrl: "",
  display: { x: 0, y: 0, w: 0, h: 0 },
  cols: 3,
  rows: 3,
  xLines: [],
  yLines: [],
  drag: null,
  sampleMode: false,
  results: [],
  selected: new Set(),
  outputDir: null,
  maskTool: "none",
  maskPainting: false,
  lastMaskPoint: null,
  editor: {
    itemId: null,
    frameIndex: 0,
    playing: false,
    timer: null,
    dragging: false,
    dragStart: null,
    dragBase: null,
    drawRect: { x: 0, y: 0, w: 0, h: 0, scale: 1 },
  },
  floatingPreview: {
    zoom: 1,
    dragging: false,
    dragStart: null,
    origin: { x: 28, y: 28 },
  },
  advancedMatte: false,
};

const masks = {
  erase: document.createElement("canvas"),
  protect: document.createElement("canvas"),
};
const maskCtx = {
  erase: masks.erase.getContext("2d", { willReadFrequently: true }),
  protect: masks.protect.getContext("2d", { willReadFrequently: true }),
};
let mattePreviewRaf = 0;
let mattePreviewTimer = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pad2 = (n) => String(n).padStart(2, "0");

const MATTE_DEFAULTS = {
  color: {
    bgColorInput: "#12c91d",
    toleranceInput: 50,
    softnessInput: 20,
    alphaCutInput: 0,
    despillInput: 0,
    spillTargetInput: "sample",
    spillColorInput: "#12c91d",
    spillDesaturateInput: 0,
    edgeShrinkInput: 0,
    spillHueRangeInput: 8,
    edgeCleanInput: 0,
    alphaGrowInput: 0,
    alphaFeatherInput: 1,
    transparentCleanInput: 0,
  },
  luma: {
    alphaCutInput: 0,
    edgeShrinkInput: 0,
    lumaThresholdInput: 35,
    lumaSoftnessInput: 55,
    lumaStrengthInput: 100,
    lumaGlowInput: 100,
    edgeCleanInput: 0,
    alphaGrowInput: 0,
    alphaFeatherInput: 1,
    transparentCleanInput: 0,
  },
};

function updateOutputs() {
  for (const id of [
    "tolerance",
    "softness",
    "alphaCut",
    "despill",
    "spillDesaturate",
    "spillHueRange",
    "edgeShrink",
    "lumaThreshold",
    "lumaSoftness",
    "lumaStrength",
    "lumaGlow",
    "edgeClean",
    "alphaGrow",
    "alphaFeather",
    "transparentClean",
    "padding",
    "offsetX",
    "offsetY",
    "brushSize",
  ]) {
    $(`${id}Value`).textContent = $(`${id}Input`).value;
  }
  updateModeFields();
  scheduleMattePreview();
}

function scheduleMattePreview(delay = 0) {
  if (mattePreviewRaf || mattePreviewTimer) return;
  const run = () => {
    mattePreviewTimer = 0;
    mattePreviewRaf = requestAnimationFrame(() => {
      mattePreviewRaf = 0;
      drawMattePreview();
    });
  };
  if (delay > 0) {
    mattePreviewTimer = window.setTimeout(run, delay);
    return;
  }
  mattePreviewRaf = requestAnimationFrame(() => {
    mattePreviewRaf = 0;
    drawMattePreview();
  });
}

function updateModeFields() {
  const modeGroup = els.keyModeInput.value === "color" ? "color" : "luma";
  for (const label of document.querySelectorAll("[data-mode]")) {
    const modes = label.dataset.mode.split(/\s+/);
    const hiddenByMode = !modes.includes(modeGroup);
    const hiddenByAdvanced = label.dataset.advanced === "true" && !state.advancedMatte;
    label.classList.toggle("is-hidden", hiddenByMode || hiddenByAdvanced);
  }
  els.advancedMatteBtn.textContent = state.advancedMatte ? "收起高级" : "高级参数";
  els.sampleSpillBtn.classList.toggle("is-active", state.sampleMode === "desaturate");
  els.sampleSpillBtn.textContent = state.sampleMode === "desaturate" ? "点击画面" : "取样";
}

function applyMatteDefaults() {
  const group = els.keyModeInput.value === "color" ? "color" : "luma";
  const defaults = MATTE_DEFAULTS[group];
  els.matteEnabled.checked = true;
  for (const [id, value] of Object.entries(defaults)) {
    els[id].value = value;
  }
  state.sampleMode = false;
  updateOutputs();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${pad2(s)}`;
}

function initGrid() {
  state.rows = clamp(Number(els.rowsInput.value) || 1, 1, 12);
  state.cols = clamp(Number(els.colsInput.value) || 1, 1, 12);
  els.previewRowInput.max = state.rows;
  els.previewColInput.max = state.cols;
  els.previewRowInput.value = clamp(Number(els.previewRowInput.value) || 1, 1, state.rows);
  els.previewColInput.value = clamp(Number(els.previewColInput.value) || 1, 1, state.cols);
  state.xLines = Array.from({ length: Math.max(0, state.cols - 1) }, (_, i) => (i + 1) / state.cols);
  state.yLines = Array.from({ length: Math.max(0, state.rows - 1) }, (_, i) => (i + 1) / state.rows);
  drawPreview();
  scheduleMattePreview();
}

function getBounds() {
  return {
    xs: [0, ...state.xLines, 1],
    ys: [0, ...state.yLines, 1],
  };
}

function drawPreview() {
  const canvas = els.previewCanvas;
  const video = els.sourceVideo;
  const rect = els.dropZone.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextW = Math.max(320, Math.round(rect.width * dpr));
  const nextH = Math.max(240, Math.round(rect.height * dpr));
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (video.videoWidth && video.videoHeight) {
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    state.display = { x, y, w, h };
    ctx.drawImage(video, x, y, w, h);
    drawMaskOverlay();
    drawGrid();
  }

  if (!video.videoWidth) {
    state.display = { x: 0, y: 0, w: 0, h: 0 };
  }
}

function drawMaskOverlay() {
  const d = state.display;
  if (!d.w || !masks.erase.width) return;
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(masks.erase, d.x, d.y, d.w, d.h);
  ctx.globalAlpha = 0.34;
  ctx.drawImage(masks.protect, d.x, d.y, d.w, d.h);
  ctx.restore();
}

function drawGrid() {
  const { x, y, w, h } = state.display;
  const { xs, ys } = getBounds();
  ctx.save();
  ctx.strokeStyle = "rgba(255, 66, 90, 0.82)";
  ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
  ctx.fillStyle = "#ff3858";
  ctx.font = `${14 * (window.devicePixelRatio || 1)}px Segoe UI`;
  ctx.fillText(`${state.rows}x${state.cols}`, x + 10, y + 22);

  for (const ratio of state.xLines) {
    const px = x + ratio * w;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }
  for (const ratio of state.yLines) {
    const py = y + ratio * h;
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x + w, py);
    ctx.stroke();
  }

  for (const ratioX of xs.slice(1, -1)) {
    for (const ratioY of ys.slice(1, -1)) {
      ctx.beginPath();
      ctx.arc(x + ratioX * w, y + ratioY * h, 6 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function canvasPoint(event) {
  const rect = els.previewCanvas.getBoundingClientRect();
  const sx = els.previewCanvas.width / rect.width;
  const sy = els.previewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy,
  };
}

function hitTest(point) {
  const d = state.display;
  if (!d.w || point.x < d.x || point.x > d.x + d.w || point.y < d.y || point.y > d.y + d.h) return null;
  const threshold = 12 * (window.devicePixelRatio || 1);
  let best = null;
  state.xLines.forEach((ratio, index) => {
    const dist = Math.abs(point.x - (d.x + ratio * d.w));
    if (dist <= threshold && (!best || dist < best.dist)) best = { axis: "x", index, dist };
  });
  state.yLines.forEach((ratio, index) => {
    const dist = Math.abs(point.y - (d.y + ratio * d.h));
    if (dist <= threshold && (!best || dist < best.dist)) best = { axis: "y", index, dist };
  });
  return best;
}

function pointerToRatio(point, axis) {
  const d = state.display;
  return axis === "x" ? (point.x - d.x) / d.w : (point.y - d.y) / d.h;
}

function setLine(axis, index, ratio) {
  const lines = axis === "x" ? state.xLines : state.yLines;
  const min = index === 0 ? 0.02 : lines[index - 1] + 0.02;
  const max = index === lines.length - 1 ? 0.98 : lines[index + 1] - 0.02;
  lines[index] = clamp(ratio, min, max);
  drawPreview();
  scheduleMattePreview();
}

function setVideoFile(file) {
  if (!file || !file.type.startsWith("video/")) return;
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(file);
  els.sourceVideo.src = state.videoUrl;
  els.sourceVideo.load();
  els.emptyState.style.display = "none";
  state.results = [];
  state.selected.clear();
  closeFrameEditor();
  clearMasks();
  renderResults();
  scheduleMattePreview();
}

function resizeMasks(width, height) {
  for (const key of ["erase", "protect"]) {
    masks[key].width = width;
    masks[key].height = height;
    maskCtx[key].clearRect(0, 0, width, height);
  }
}

function clearMasks() {
  for (const key of ["erase", "protect"]) {
    if (masks[key].width) maskCtx[key].clearRect(0, 0, masks[key].width, masks[key].height);
  }
  drawPreview();
  scheduleMattePreview();
}

function settings() {
  return {
    matte: els.matteEnabled.checked,
    keyMode: els.keyModeInput.value,
    bg: hexToRgb(els.bgColorInput.value),
    tolerance: Number(els.toleranceInput.value),
    softness: Number(els.softnessInput.value),
    alphaCut: Number(els.alphaCutInput.value),
    despill: Number(els.despillInput.value) / 100,
    spillTarget: els.spillTargetInput.value,
    spillColor: hexToRgb(els.spillColorInput.value),
    spillDesaturate: Number(els.spillDesaturateInput.value) / 100,
    spillHueRange: Number(els.spillHueRangeInput.value),
    edgeShrink: Number(els.edgeShrinkInput.value) / 100,
    lumaThreshold: Number(els.lumaThresholdInput.value),
    lumaSoftness: Number(els.lumaSoftnessInput.value),
    lumaStrength: Number(els.lumaStrengthInput.value) / 100,
    lumaGlow: Number(els.lumaGlowInput.value) / 100,
    edgeClean: Number(els.edgeCleanInput.value) / 100,
    alphaGrow: Number(els.alphaGrowInput.value),
    alphaFeather: Number(els.alphaFeatherInput.value),
    transparentClean: Number(els.transparentCleanInput.value) / 100,
    center: els.centerEnabled.checked,
    padding: Number(els.paddingInput.value),
    offsetX: Number(els.offsetXInput.value),
    offsetY: Number(els.offsetYInput.value),
  };
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function processCell(source, options) {
  const width = source.width;
  const height = source.height;
  const image = source.ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const eraseData = source.eraseMask ? source.eraseMask.data : null;
  const protectData = source.protectMask ? source.protectMask.data : null;

  const softEnd = options.tolerance + Math.max(1, options.softness);
  for (let i = 0; i < data.length; i += 4) {
    const protectedPixel = protectData && protectData[i + 3] > 0;
    if (options.matte && !protectedPixel) {
      let alpha = 255;
      let dist = 255;
      if (options.keyMode === "color") {
        const dr = data[i] - options.bg.r;
        const dg = data[i + 1] - options.bg.g;
        const db = data[i + 2] - options.bg.b;
        dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= options.tolerance) alpha = 0;
        else if (dist < softEnd) alpha = ((dist - options.tolerance) / Math.max(1, options.softness)) * 255;
      } else {
        alpha = lumaAlpha(data, i, options);
      }
      if (options.edgeShrink > 0 && alpha > 0 && alpha < 255) {
        alpha = Math.max(0, alpha - 255 * options.edgeShrink);
      }
      data[i + 3] = alpha < options.alphaCut ? 0 : Math.round(alpha);
      if (options.keyMode === "color" && data[i + 3] > 0 && options.despill > 0) {
        despillPixel(data, i, options, dist);
      }
      if (options.keyMode === "color" && data[i + 3] > 0 && options.spillDesaturate > 0) {
        desaturateSelectedHue(data, i, options);
      }
      if (options.keyMode !== "color" && data[i + 3] > 0 && options.lumaGlow > 0) {
        restoreLumaGlow(data, i, options);
      }
    }
    if (protectedPixel && data[i + 3] < 255) data[i + 3] = 255;
    if (eraseData && eraseData[i + 3] > 0) data[i + 3] = 0;
  }

  postProcessMatte(image, width, height, options, protectData, eraseData);

  cellCtx.canvas.width = width;
  cellCtx.canvas.height = height;
  cellCtx.putImageData(image, 0, 0);

  if (!options.center) return cloneCanvas(cellCtx.canvas);
  return centerCanvas(cellCtx.canvas, options);
}

function lumaAlpha(data, i, options) {
  const luma = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  const soft = Math.max(1, options.lumaSoftness);
  const threshold = options.lumaThreshold;
  let keep;
  if (options.keyMode === "luma-black") {
    keep = (luma - threshold) / soft;
  } else {
    keep = (255 - luma - threshold) / soft;
  }
  const alpha = clamp(keep, 0, 1) * 255;
  return alpha * options.lumaStrength + 255 * (1 - options.lumaStrength);
}

function restoreLumaGlow(data, i, options) {
  const alpha = Math.max(1, data[i + 3]) / 255;
  const strength = options.lumaGlow;
  if (options.keyMode === "luma-black") {
    for (let channel = 0; channel < 3; channel++) {
      const restored = clamp(data[i + channel] / alpha, 0, 255);
      data[i + channel] = data[i + channel] * (1 - strength) + restored * strength;
    }
    return;
  }

  for (let channel = 0; channel < 3; channel++) {
    const distanceFromWhite = 255 - data[i + channel];
    const restored = 255 - clamp(distanceFromWhite / alpha, 0, 255);
    data[i + channel] = data[i + channel] * (1 - strength) + restored * strength;
  }
}

function postProcessMatte(image, width, height, options, protectData, eraseData) {
  const data = image.data;
  if (options.alphaGrow !== 0) morphAlpha(data, width, height, options.alphaGrow);
  if (options.alphaFeather > 0) featherAlpha(data, width, height, options.alphaFeather);
  if (options.edgeClean > 0) cleanEdgeColor(data, width, height, options.edgeClean);
  if (options.transparentClean > 0) cleanTransparentPixels(data, options.alphaCut, options.transparentClean);

  for (let i = 0; i < data.length; i += 4) {
    if (protectData && protectData[i + 3] > 0) data[i + 3] = 255;
    if (eraseData && eraseData[i + 3] > 0) data[i + 3] = 0;
  }
}

function morphAlpha(data, width, height, amount) {
  const radius = Math.min(4, Math.abs(Math.round(amount)));
  if (!radius) return;
  const source = new Uint8ClampedArray(width * height);
  for (let i = 0; i < source.length; i++) source[i] = data[i * 4 + 3];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let next = amount > 0 ? 0 : 255;
      for (let oy = -radius; oy <= radius; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -radius; ox <= radius; ox++) {
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          const alpha = source[yy * width + xx];
          next = amount > 0 ? Math.max(next, alpha) : Math.min(next, alpha);
        }
      }
      data[(y * width + x) * 4 + 3] = next;
    }
  }
}

function featherAlpha(data, width, height, radiusValue) {
  const radius = Math.min(6, Math.round(radiusValue));
  if (!radius) return;
  const source = new Uint8ClampedArray(width * height);
  for (let i = 0; i < source.length; i++) source[i] = data[i * 4 + 3];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let oy = -radius; oy <= radius; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -radius; ox <= radius; ox++) {
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          sum += source[yy * width + xx];
          count++;
        }
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum / count);
    }
  }
}

function cleanEdgeColor(data, width, height, strength) {
  const source = new Uint8ClampedArray(data);
  const radius = Math.max(1, Math.round(1 + strength * 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = source[index + 3];
      if (alpha <= 0 || alpha >= 245) continue;

      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let oy = -radius; oy <= radius; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -radius; ox <= radius; ox++) {
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          const sampleIndex = (yy * width + xx) * 4;
          if (source[sampleIndex + 3] < 235) continue;
          const distance = ox * ox + oy * oy;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = sampleIndex;
          }
        }
      }

      if (bestIndex >= 0) {
        const mix = strength * (1 - alpha / 255);
        data[index] = data[index] * (1 - mix) + source[bestIndex] * mix;
        data[index + 1] = data[index + 1] * (1 - mix) + source[bestIndex + 1] * mix;
        data[index + 2] = data[index + 2] * (1 - mix) + source[bestIndex + 2] * mix;
      }
    }
  }
}

function cleanTransparentPixels(data, alphaCut, strength) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= alphaCut) {
      data[i] *= 1 - strength;
      data[i + 1] *= 1 - strength;
      data[i + 2] *= 1 - strength;
    }
  }
}

function desaturateSelectedHue(data, i, options) {
  const pixel = rgbToHsl(data[i], data[i + 1], data[i + 2]);
  const targetHue = selectedDesaturateHue(options);
  const hueMatch = 1 - clamp(hueDistance(pixel.h, targetHue) / Math.max(1, options.spillHueRange), 0, 1);
  const strength = options.spillDesaturate * hueMatch * clamp(pixel.s * 1.35, 0, 1);
  if (strength <= 0) return;
  const luma = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  data[i] = data[i] * (1 - strength) + luma * strength;
  data[i + 1] = data[i + 1] * (1 - strength) + luma * strength;
  data[i + 2] = data[i + 2] * (1 - strength) + luma * strength;
}

function selectedDesaturateHue(options) {
  if (options.spillTarget === "background") {
    return rgbToHsl(options.bg.r, options.bg.g, options.bg.b).h;
  }
  if (options.spillTarget === "sample") {
    return rgbToHsl(options.spillColor.r, options.spillColor.g, options.spillColor.b).h;
  }
  return {
    red: 0,
    yellow: 60,
    green: 120,
    cyan: 180,
    blue: 240,
    magenta: 300,
  }[options.spillTarget] ?? 120;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = 60 * (((gn - bn) / d) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function despillPixel(data, i, options, bgDistance) {
  const bg = options.bg;
  const fringe = clamp(1 - (bgDistance - options.tolerance) / Math.max(1, options.softness * 2.2), 0, 1);
  const strength = options.despill * fringe;
  if (strength <= 0) return;

  if (bg.g >= bg.r && bg.g >= bg.b) {
    const neutral = Math.max(data[i], data[i + 2]);
    if (data[i + 1] > neutral) data[i + 1] -= (data[i + 1] - neutral) * strength;
    return;
  }
  if (bg.b >= bg.r && bg.b >= bg.g) {
    const neutral = Math.max(data[i], data[i + 1]);
    if (data[i + 2] > neutral) data[i + 2] -= (data[i + 2] - neutral) * strength;
    return;
  }
  const neutral = Math.max(data[i + 1], data[i + 2]);
  if (data[i] > neutral) data[i] -= (data[i] - neutral) * strength;
}

function maskSlice(type, sx, sy, sw, sh, dw = sw, dh = sh) {
  if (!masks[type].width) return null;
  if (dw !== sw || dh !== sh) {
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
    canvasCtx.drawImage(masks[type], sx, sy, sw, sh, 0, 0, dw, dh);
    return canvasCtx.getImageData(0, 0, dw, dh);
  }
  return maskCtx[type].getImageData(sx, sy, sw, sh);
}

function cloneCanvas(canvas) {
  const next = document.createElement("canvas");
  next.width = canvas.width;
  next.height = canvas.height;
  next.getContext("2d").drawImage(canvas, 0, 0);
  return next;
}

function centerCanvas(canvas, options) {
  const srcCtx = canvas.getContext("2d", { willReadFrequently: true });
  const img = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > options.alphaCut) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const outCtx = out.getContext("2d");
  if (maxX < minX || maxY < minY) return out;

  const sw = maxX - minX + 1;
  const sh = maxY - minY + 1;
  const maxW = Math.max(1, canvas.width - options.padding * 2);
  const maxH = Math.max(1, canvas.height - options.padding * 2);
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (canvas.width - dw) / 2 + options.offsetX;
  const dy = (canvas.height - dh) / 2 + options.offsetY;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(canvas, minX, minY, sw, sh, dx, dy, dw, dh);
  return out;
}

function drawMattePreview() {
  const video = els.sourceVideo;
  const canvas = els.mattePreviewCanvas;
  resizeCanvasToCss(canvas, 220, 160);

  if (!video.videoWidth || !video.videoHeight) {
    const dpr = window.devicePixelRatio || 1;
    mattePreviewCtx.clearRect(0, 0, canvas.width, canvas.height);
    mattePreviewCtx.fillStyle = "#10203a";
    mattePreviewCtx.fillRect(0, 0, canvas.width, canvas.height);
    mattePreviewCtx.fillStyle = "#8ea8c7";
    mattePreviewCtx.font = `${13 * dpr}px Segoe UI`;
    mattePreviewCtx.textAlign = "center";
    mattePreviewCtx.fillText("选择视频后预览抠背景效果", canvas.width / 2, canvas.height / 2);
    els.previewInfo.textContent = "等待视频";
    drawLargePreview();
    return;
  }

  const preview = currentPreviewCanvas(els.previewModal.classList.contains("is-hidden") ? 520 : 900);
  drawCanvasContain(mattePreviewCtx, canvas, preview);
  els.previewInfo.textContent = preview.info;
  drawLargePreview(preview);
}

function currentPreviewCanvas(maxEdge = Infinity) {
  const video = els.sourceVideo;
  const { xs, ys } = getBounds();
  const row = clamp(Number(els.previewRowInput.value) || 1, 1, state.rows) - 1;
  const col = clamp(Number(els.previewColInput.value) || 1, 1, state.cols) - 1;
  const sx = Math.round(xs[col] * video.videoWidth);
  const sy = Math.round(ys[row] * video.videoHeight);
  const sw = Math.max(1, Math.round((xs[col + 1] - xs[col]) * video.videoWidth));
  const sh = Math.max(1, Math.round((ys[row + 1] - ys[row]) * video.videoHeight));
  const previewScale = Math.min(1, maxEdge / Math.max(sw, sh));
  const pw = Math.max(1, Math.round(sw * previewScale));
  const ph = Math.max(1, Math.round(sh * previewScale));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = pw;
  sourceCanvas.height = ph;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(video, sx, sy, sw, sh, 0, 0, pw, ph);
  const previewOptions = settings();
  previewOptions.center = false;
  const processed = processCell(
    {
      ctx: sourceCtx,
      width: pw,
      height: ph,
      eraseMask: maskSlice("erase", sx, sy, sw, sh, pw, ph),
      protectMask: maskSlice("protect", sx, sy, sw, sh, pw, ph),
    },
    previewOptions,
  );
  processed.info = `第 ${row + 1} 行 / 第 ${col + 1} 列`;
  return processed;
}

function resizeCanvasToCss(canvas, minWidth, minHeight) {
  const css = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(minWidth, Math.round((css.width || minWidth) * dpr));
  canvas.height = Math.max(minHeight, Math.round((css.height || minHeight) * dpr));
}

function drawCanvasContain(targetCtx, canvas, source) {
  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(source, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
}

function drawLargePreview(preview = null) {
  if (els.previewModal.classList.contains("is-hidden")) return;
  const canvas = els.largePreviewCanvas;
  if (!els.sourceVideo.videoWidth || !els.sourceVideo.videoHeight) {
    canvas.style.width = "520px";
    canvas.style.height = "360px";
    resizeCanvasToCss(canvas, 520, 360);
    largePreviewCtx.clearRect(0, 0, canvas.width, canvas.height);
    largePreviewCtx.fillStyle = "#10203a";
    largePreviewCtx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (!preview) preview = currentPreviewCanvas(900);
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(240, Math.round(preview.width * state.floatingPreview.zoom));
  const cssHeight = Math.max(180, Math.round(preview.height * state.floatingPreview.zoom));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  largePreviewCtx.clearRect(0, 0, canvas.width, canvas.height);
  largePreviewCtx.imageSmoothingEnabled = false;
  largePreviewCtx.drawImage(preview, 0, 0, canvas.width, canvas.height);
  els.previewInfo.textContent = preview.info;
  els.zoomResetPreviewBtn.textContent = `${Math.round(state.floatingPreview.zoom * 100)}%`;
}

function setFloatingPreviewZoom(nextZoom) {
  state.floatingPreview.zoom = clamp(nextZoom, 0.25, 6);
  drawLargePreview();
}

function openFloatingPreview() {
  els.previewModal.classList.remove("is-hidden");
  applyFloatingPreviewPosition();
  drawLargePreview();
}

function closeFloatingPreview() {
  els.previewModal.classList.add("is-hidden");
}

function applyFloatingPreviewPosition() {
  const margin = 12;
  const rect = els.previewModal.getBoundingClientRect();
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxY = Math.max(margin, window.innerHeight - 80);
  state.floatingPreview.origin.x = clamp(state.floatingPreview.origin.x, margin, maxX);
  state.floatingPreview.origin.y = clamp(state.floatingPreview.origin.y, margin, maxY);
  els.previewModal.style.left = `${state.floatingPreview.origin.x}px`;
  els.previewModal.style.top = `${state.floatingPreview.origin.y}px`;
}

async function extractFrames() {
  const video = els.sourceVideo;
  if (!video.videoWidth) {
    alert("请先选择视频。");
    return;
  }
  els.extractBtn.disabled = true;
  els.extractBtn.textContent = "提取中...";

  try {
    video.pause();
    els.workCanvas.width = video.videoWidth;
    els.workCanvas.height = video.videoHeight;
    const fps = clamp(Number(els.fpsInput.value) || 1, 1, 30);
    const maxSeconds = Number(els.maxSecondsInput.value) || 0;
    const duration = maxSeconds > 0 ? Math.min(video.duration, maxSeconds) : video.duration;
    const totalFrames = Math.max(1, Math.floor(duration * fps) + 1);
    const { xs, ys } = getBounds();
    const options = settings();
    const buckets = Array.from({ length: state.rows * state.cols }, (_, i) => ({
      id: i + 1,
      frames: [],
      offsets: [],
      kept: [],
      checked: true,
    }));

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = Math.min(duration, frame / fps);
      await seekTo(time);
      workCtx.clearRect(0, 0, els.workCanvas.width, els.workCanvas.height);
      workCtx.drawImage(video, 0, 0);

      for (let row = 0; row < state.rows; row++) {
        for (let col = 0; col < state.cols; col++) {
          const sx = Math.round(xs[col] * video.videoWidth);
          const sy = Math.round(ys[row] * video.videoHeight);
          const sw = Math.max(1, Math.round((xs[col + 1] - xs[col]) * video.videoWidth));
          const sh = Math.max(1, Math.round((ys[row + 1] - ys[row]) * video.videoHeight));
          const sourceCanvas = document.createElement("canvas");
          sourceCanvas.width = sw;
          sourceCanvas.height = sh;
          const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
          sourceCtx.drawImage(els.workCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const processed = processCell(
            {
              ctx: sourceCtx,
              width: sw,
              height: sh,
              eraseMask: maskSlice("erase", sx, sy, sw, sh),
              protectMask: maskSlice("protect", sx, sy, sw, sh),
            },
            options,
          );
          buckets[row * state.cols + col].frames.push(processed);
        }
      }
    }

    state.results = buckets;
    for (const item of state.results) {
      item.offsets = item.frames.map(() => ({ x: 0, y: 0 }));
      item.kept = item.frames.map(() => true);
    }
    state.selected = new Set(buckets.map((item) => item.id));
    closeFrameEditor();
    renderResults();
  } finally {
    els.extractBtn.disabled = false;
    els.extractBtn.textContent = "提取序列帧";
    drawPreview();
  }
}

function seekTo(time) {
  const video = els.sourceVideo;
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = clamp(time, 0, video.duration || 0);
  });
}

function renderResults() {
  els.resultsList.innerHTML = "";
  els.resultCount.textContent = `${state.results.length} 项`;

  if (!state.results.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "上传视频后点击“提取序列帧”。";
    els.resultsList.append(empty);
    return;
  }

  for (const item of state.results) {
    const card = document.createElement("div");
    card.className = "result-card";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = state.selected.has(item.id);
    check.addEventListener("change", () => {
      if (check.checked) state.selected.add(item.id);
      else state.selected.delete(item.id);
    });
    const img = document.createElement("img");
    img.src = adjustedCanvas(item, 0).toDataURL("image/png");
    const text = document.createElement("div");
    text.innerHTML = `<strong>人物 ${item.id}</strong><span>${item.frames.length} 帧</span>`;
    const adjust = document.createElement("button");
    adjust.type = "button";
    adjust.className = "adjust-frame-btn";
    adjust.textContent = "帧调整";
    adjust.addEventListener("click", () => openFrameEditor(item.id));
    card.append(check, img, text, adjust);
    els.resultsList.append(card);
  }
}

function selectedResults() {
  return state.results.filter((item) => state.selected.has(item.id));
}

function adjustedCanvas(item, frameIndex) {
  const source = item.frames[frameIndex];
  const offset = item.offsets?.[frameIndex] || { x: 0, y: 0 };
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const canvasCtx = canvas.getContext("2d");
  canvasCtx.imageSmoothingEnabled = false;
  canvasCtx.drawImage(source, offset.x, offset.y);
  return canvas;
}

function keptFrameIndexes(item) {
  const indexes = [];
  for (let index = 0; index < item.frames.length; index++) {
    if (!item.kept || item.kept[index] !== false) indexes.push(index);
  }
  return indexes;
}

function adjustedFrames(item) {
  return keptFrameIndexes(item).map((index) => adjustedCanvas(item, index));
}

function editorItem() {
  return state.results.find((item) => item.id === state.editor.itemId) || null;
}

function closeFrameEditor() {
  stopFramePlayback();
  state.editor.itemId = null;
  state.editor.frameIndex = 0;
  state.editor.dragging = false;
  if (els.frameEditor) els.frameEditor.classList.add("is-empty");
  if (els.frameStrip) els.frameStrip.innerHTML = "";
}

function openFrameEditor(itemId) {
  const item = state.results.find((entry) => entry.id === itemId);
  if (!item) return;
  if (!item.offsets || item.offsets.length !== item.frames.length) {
    item.offsets = item.frames.map(() => ({ x: 0, y: 0 }));
  }
  state.editor.itemId = itemId;
  state.editor.frameIndex = clamp(state.editor.frameIndex, 0, item.frames.length - 1);
  els.frameEditor.classList.remove("is-empty");
  renderFrameStrip();
  syncFrameOffsetInputs();
  drawFrameEditor();
  els.frameEditor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  startFramePlayback();
}

function setEditorFrame(index, stopPlayback = true) {
  const item = editorItem();
  if (!item) return;
  if (stopPlayback && state.editor.playing) stopFramePlayback();
  state.editor.frameIndex = clamp(index, 0, item.frames.length - 1);
  syncFrameOffsetInputs();
  renderFrameStrip();
  drawFrameEditor();
}

function syncFrameOffsetInputs() {
  const item = editorItem();
  if (!item) return;
  const offset = item.offsets[state.editor.frameIndex] || { x: 0, y: 0 };
  els.frameOffsetXInput.value = Math.round(offset.x);
  els.frameOffsetYInput.value = Math.round(offset.y);
  els.frameEditorInfo.textContent = `人物 ${item.id} / 第 ${state.editor.frameIndex + 1} 帧`;
}

function setFrameKept(index, kept) {
  const item = editorItem();
  if (!item) return;
  if (!item.kept || item.kept.length !== item.frames.length) item.kept = item.frames.map(() => true);
  item.kept[index] = kept;
  renderFrameStrip();
  syncFrameOffsetInputs();
}

function setCurrentFrameOffset(x, y) {
  const item = editorItem();
  if (!item) return;
  item.offsets[state.editor.frameIndex] = { x: Math.round(x), y: Math.round(y) };
  syncFrameOffsetInputs();
  drawFrameEditor();
  updateResultThumb(item);
  updateActiveFrameThumb();
}

function resetCurrentFrameOffset() {
  setCurrentFrameOffset(0, 0);
}

function drawFrameEditor() {
  const item = editorItem();
  const canvas = els.frameEditorCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(360, Math.round((rect.width || 520) * dpr));
  canvas.height = Math.max(220, Math.round((rect.height || 310) * dpr));
  frameEditorCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (!item) return;
  const frame = adjustedCanvas(item, state.editor.frameIndex);
  const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
  const w = frame.width * scale;
  const h = frame.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  state.editor.drawRect = { x, y, w, h, scale };
  frameEditorCtx.imageSmoothingEnabled = false;
  frameEditorCtx.drawImage(frame, x, y, w, h);
  frameEditorCtx.save();
  frameEditorCtx.strokeStyle = "#27b8ff";
  frameEditorCtx.lineWidth = Math.max(1, dpr);
  frameEditorCtx.strokeRect(x, y, w, h);
  frameEditorCtx.restore();
}

function renderFrameStrip() {
  const item = editorItem();
  els.frameStrip.innerHTML = "";
  if (!item) return;
  for (let index = 0; index < item.frames.length; index++) {
    const button = document.createElement("button");
    button.type = "button";
    const kept = !item.kept || item.kept[index] !== false;
    button.className = `frame-thumb${index === state.editor.frameIndex ? " is-active" : ""}${kept ? "" : " is-skipped"}`;
    button.dataset.index = String(index);
    button.addEventListener("click", () => setEditorFrame(index, true));
    const img = document.createElement("img");
    img.src = adjustedCanvas(item, index).toDataURL("image/png");
    const offset = item.offsets[index] || { x: 0, y: 0 };
    const text = document.createElement("div");
    text.innerHTML = `<strong>第 ${index + 1} 帧</strong><span>${kept ? "保留" : "跳过"} · x ${Math.round(offset.x)} / y ${Math.round(offset.y)}</span>`;
    const keep = document.createElement("input");
    keep.type = "checkbox";
    keep.className = "frame-keep-checkbox";
    keep.checked = kept;
    keep.title = "保留该帧";
    keep.addEventListener("click", (event) => event.stopPropagation());
    keep.addEventListener("change", () => setFrameKept(index, keep.checked));
    button.append(img, text, keep);
    els.frameStrip.append(button);
  }
}

function updateActiveFrameThumb() {
  const item = editorItem();
  if (!item) return;
  const button = els.frameStrip.querySelector(`[data-index="${state.editor.frameIndex}"]`);
  if (!button) return;
  const img = button.querySelector("img");
  const span = button.querySelector("span");
  const offset = item.offsets[state.editor.frameIndex] || { x: 0, y: 0 };
  const kept = !item.kept || item.kept[state.editor.frameIndex] !== false;
  img.src = adjustedCanvas(item, state.editor.frameIndex).toDataURL("image/png");
  span.textContent = `${kept ? "保留" : "跳过"} · x ${Math.round(offset.x)} / y ${Math.round(offset.y)}`;
  button.classList.toggle("is-skipped", !kept);
}

function updateResultThumb(item) {
  const cards = [...els.resultsList.querySelectorAll(".result-card")];
  const index = state.results.findIndex((entry) => entry.id === item.id);
  const card = cards[index];
  if (!card) return;
  const img = card.querySelector("img");
  if (img) img.src = adjustedCanvas(item, 0).toDataURL("image/png");
}

function startFramePlayback() {
  const item = editorItem();
  if (!item || state.editor.playing) return;
  state.editor.playing = true;
  els.framePlayBtn.textContent = "暂停";
  const fps = clamp(Number(els.fpsInput.value) || 5, 1, 30);
  state.editor.timer = setInterval(() => {
    const current = editorItem();
    if (!current) {
      stopFramePlayback();
      return;
    }
    setEditorFrame(nextKeptFrameIndex(current), false);
  }, 1000 / fps);
}

function nextKeptFrameIndex(item) {
  const kept = keptFrameIndexes(item);
  if (!kept.length) return (state.editor.frameIndex + 1) % item.frames.length;
  const next = kept.find((index) => index > state.editor.frameIndex);
  return next ?? kept[0];
}

function stopFramePlayback() {
  state.editor.playing = false;
  if (state.editor.timer) clearInterval(state.editor.timer);
  state.editor.timer = null;
  if (els.framePlayBtn) els.framePlayBtn.textContent = "播放";
}

function toggleFramePlayback() {
  if (state.editor.playing) stopFramePlayback();
  else startFramePlayback();
}

function editorPoint(event) {
  const rect = els.frameEditorCanvas.getBoundingClientRect();
  const sx = els.frameEditorCanvas.width / rect.width;
  const sy = els.frameEditorCanvas.height / rect.height;
  return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
}

function handleFrameEditorKey(event) {
  if (els.frameEditor.classList.contains("is-empty")) return;
  const item = editorItem();
  if (!item) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

  const active = document.activeElement;
  if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;

  event.preventDefault();
  stopFramePlayback();
  const step = event.shiftKey ? 10 : 1;
  const offset = item.offsets[state.editor.frameIndex] || { x: 0, y: 0 };
  let x = offset.x;
  let y = offset.y;
  if (event.key === "ArrowLeft") x -= step;
  if (event.key === "ArrowRight") x += step;
  if (event.key === "ArrowUp") y -= step;
  if (event.key === "ArrowDown") y += step;
  setCurrentFrameOffset(x, y);
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function makeSheet(canvases, cols) {
  const first = canvases[0];
  const rows = Math.ceil(canvases.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = first.width * cols;
  sheet.height = first.height * rows;
  const sheetCtx = sheet.getContext("2d");
  sheetCtx.imageSmoothingEnabled = false;
  canvases.forEach((canvas, index) => {
    const x = (index % cols) * first.width;
    const y = Math.floor(index / cols) * first.height;
    sheetCtx.drawImage(canvas, x, y);
  });
  return sheet;
}

async function pickOutputFolder() {
  if (!window.showDirectoryPicker) {
    alert("当前浏览器不支持直接选择文件夹写入。请用 Chrome 或 Edge 打开 localhost 页面。");
    return null;
  }
  state.outputDir = await window.showDirectoryPicker({ mode: "readwrite" });
  els.folderStatus.textContent = `已选择：${state.outputDir.name}`;
  return state.outputDir;
}

async function ensureOutputFolder() {
  if (!state.outputDir) await pickOutputFolder();
  if (!state.outputDir) return null;
  const folderName = `SmileVideoFrames_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  return state.outputDir.getDirectoryHandle(folderName, { create: true });
}

async function writePng(directory, filename, canvas) {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await canvasToBlob(canvas));
  await writable.close();
}

async function exportToFolder() {
  const items = selectedResults();
  if (!items.length) {
    alert("请先提取并选择要导出的序列。");
    return;
  }
  const exportableItems = items.filter((item) => keptFrameIndexes(item).length > 0);
  if (!exportableItems.length) {
    alert("所有选中序列的帧都被取消保留，无法导出。");
    return;
  }
  const root = await ensureOutputFolder();
  if (!root) return;

  els.exportFolderBtn.disabled = true;
  els.exportFolderBtn.textContent = "导出中...";

  try {
    const mode = els.exportModeInput.value;
    const cols = clamp(Number(els.sheetColsInput.value) || 1, 1, 32);

    if (mode === "frames") {
      for (const item of exportableItems) {
        const personDir = await root.getDirectoryHandle(`person_${pad2(item.id)}`, { create: true });
        const indexes = keptFrameIndexes(item);
        for (let i = 0; i < indexes.length; i++) {
          await writePng(personDir, `frame_${pad2(i + 1)}.png`, adjustedCanvas(item, indexes[i]));
        }
      }
    }

    if (mode === "person-sheets") {
      for (const item of exportableItems) {
        await writePng(root, `person_${pad2(item.id)}_sheet.png`, makeSheet(adjustedFrames(item), cols));
      }
    }

    if (mode === "combined-sheet") {
      const frames = exportableItems.flatMap((item) => adjustedFrames(item));
      await writePng(root, "combined_sheet.png", makeSheet(frames, cols));
    }

    els.folderStatus.textContent = `已导出：${root.name}`;
  } finally {
    els.exportFolderBtn.disabled = false;
    els.exportFolderBtn.textContent = "导出到文件夹";
  }
}

async function exportSheet() {
  const items = selectedResults();
  if (!items.length) {
    alert("请先提取并选择要导出的序列。");
    return;
  }
  const frames = items.flatMap((item) => adjustedFrames(item));
  if (!frames.length) {
    alert("所有选中序列的帧都被取消保留，无法导出。");
    return;
  }
  const cols = clamp(Number(els.sheetColsInput.value) || 1, 1, 32);
  const sheet = makeSheet(frames, cols);
  downloadBlob(await canvasToBlob(sheet), `sprite-sheet-${Date.now()}.png`);
}

function sampleVideoColor(point) {
  const d = state.display;
  if (!d.w) return null;
  const videoX = Math.round(((point.x - d.x) / d.w) * els.sourceVideo.videoWidth);
  const videoY = Math.round(((point.y - d.y) / d.h) * els.sourceVideo.videoHeight);
  els.workCanvas.width = els.sourceVideo.videoWidth;
  els.workCanvas.height = els.sourceVideo.videoHeight;
  workCtx.drawImage(els.sourceVideo, 0, 0);
  const px = workCtx.getImageData(clamp(videoX, 0, els.workCanvas.width - 1), clamp(videoY, 0, els.workCanvas.height - 1), 1, 1).data;
  return rgbToHex(px[0], px[1], px[2]);
}

function sampleBackground(point) {
  const color = sampleVideoColor(point);
  if (!color) return;
  els.bgColorInput.value = color;
  state.sampleMode = false;
  updateModeFields();
  scheduleMattePreview();
}

function sampleDesaturateColor(point) {
  const color = sampleVideoColor(point);
  if (!color) return;
  els.spillColorInput.value = color;
  els.spillTargetInput.value = "sample";
  state.sampleMode = false;
  updateModeFields();
  scheduleMattePreview();
}

function pointToVideo(point) {
  const d = state.display;
  if (!d.w || point.x < d.x || point.x > d.x + d.w || point.y < d.y || point.y > d.y + d.h) return null;
  return {
    x: clamp(((point.x - d.x) / d.w) * els.sourceVideo.videoWidth, 0, els.sourceVideo.videoWidth),
    y: clamp(((point.y - d.y) / d.h) * els.sourceVideo.videoHeight, 0, els.sourceVideo.videoHeight),
  };
}

function paintMask(point) {
  if (state.maskTool === "none" || !els.sourceVideo.videoWidth) return;
  const videoPoint = pointToVideo(point);
  if (!videoPoint) return;
  const brush = Number(els.brushSizeInput.value) || 28;
  const ctxTarget = maskCtx[state.maskTool];
  const other = state.maskTool === "erase" ? maskCtx.protect : maskCtx.erase;
  const color = state.maskTool === "erase" ? "rgba(255, 60, 90, 1)" : "rgba(25, 190, 255, 1)";

  for (const target of [ctxTarget, other]) {
    target.save();
    target.lineCap = "round";
    target.lineJoin = "round";
    target.lineWidth = brush;
    target.strokeStyle = target === ctxTarget ? color : "rgba(0, 0, 0, 1)";
    target.fillStyle = target === ctxTarget ? color : "rgba(0, 0, 0, 1)";
    target.globalCompositeOperation = target === ctxTarget ? "source-over" : "destination-out";
    target.beginPath();
    if (state.lastMaskPoint) {
      target.moveTo(state.lastMaskPoint.x, state.lastMaskPoint.y);
      target.lineTo(videoPoint.x, videoPoint.y);
      target.stroke();
    } else {
      target.arc(videoPoint.x, videoPoint.y, brush / 2, 0, Math.PI * 2);
      target.fill();
    }
    target.restore();
  }

  state.lastMaskPoint = videoPoint;
  drawPreview();
  scheduleMattePreview();
}

function syncTime() {
  const video = els.sourceVideo;
  const duration = video.duration || 0;
  els.seekRange.value = duration ? Math.round((video.currentTime / duration) * 1000) : 0;
  els.timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  drawPreview();
  scheduleMattePreview(video.paused ? 0 : 120);
}

els.videoInput.addEventListener("change", (event) => setVideoFile(event.target.files[0]));
els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("dragover");
});
els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragover"));
els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("dragover");
  setVideoFile(event.dataTransfer.files[0]);
});

els.sourceVideo.addEventListener("loadedmetadata", () => {
  resizeMasks(els.sourceVideo.videoWidth, els.sourceVideo.videoHeight);
  els.seekRange.value = 0;
  initGrid();
  syncTime();
});
els.sourceVideo.addEventListener("timeupdate", syncTime);
els.sourceVideo.addEventListener("play", () => (els.playBtn.textContent = "Ⅱ"));
els.sourceVideo.addEventListener("pause", () => (els.playBtn.textContent = "▶"));

els.playBtn.addEventListener("click", () => {
  if (!els.sourceVideo.src) return;
  if (els.sourceVideo.paused) els.sourceVideo.play();
  else els.sourceVideo.pause();
});
els.seekRange.addEventListener("input", () => {
  if (!els.sourceVideo.duration) return;
  els.sourceVideo.currentTime = (Number(els.seekRange.value) / 1000) * els.sourceVideo.duration;
});

for (const input of [els.rowsInput, els.colsInput]) input.addEventListener("change", initGrid);
for (const input of [els.previewRowInput, els.previewColInput]) input.addEventListener("change", scheduleMattePreview);
els.resetGridBtn.addEventListener("click", initGrid);
els.clearMasksBtn.addEventListener("click", clearMasks);
els.extractBtn.addEventListener("click", extractFrames);
els.pickFolderBtn.addEventListener("click", pickOutputFolder);
els.exportFolderBtn.addEventListener("click", exportToFolder);
els.resetMatteBtn.addEventListener("click", applyMatteDefaults);
els.advancedMatteBtn.addEventListener("click", () => {
  state.advancedMatte = !state.advancedMatte;
  updateOutputs();
});
els.sampleSpillBtn.addEventListener("click", () => {
  state.sampleMode = "desaturate";
  updateModeFields();
});
els.floatPreviewBtn.addEventListener("click", openFloatingPreview);
els.closePreviewModalBtn.addEventListener("click", closeFloatingPreview);
els.zoomOutPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(state.floatingPreview.zoom - 0.25));
els.zoomInPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(state.floatingPreview.zoom + 0.25));
els.zoomResetPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(1));
els.largePreviewViewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  setFloatingPreviewZoom(state.floatingPreview.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
});
els.previewModalHeader.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  state.floatingPreview.dragging = true;
  state.floatingPreview.dragStart = { x: event.clientX, y: event.clientY };
  state.floatingPreview.dragOrigin = { ...state.floatingPreview.origin };
  els.previewModalHeader.setPointerCapture(event.pointerId);
});
els.previewModalHeader.addEventListener("pointermove", (event) => {
  if (!state.floatingPreview.dragging) return;
  state.floatingPreview.origin.x = state.floatingPreview.dragOrigin.x + event.clientX - state.floatingPreview.dragStart.x;
  state.floatingPreview.origin.y = state.floatingPreview.dragOrigin.y + event.clientY - state.floatingPreview.dragStart.y;
  applyFloatingPreviewPosition();
});
els.previewModalHeader.addEventListener("pointerup", () => {
  state.floatingPreview.dragging = false;
});
els.previewModalHeader.addEventListener("pointercancel", () => {
  state.floatingPreview.dragging = false;
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFloatingPreview();
  handleFrameEditorKey(event);
});
els.framePlayBtn.addEventListener("click", toggleFramePlayback);
els.resetFrameOffsetBtn.addEventListener("click", resetCurrentFrameOffset);
for (const input of [els.frameOffsetXInput, els.frameOffsetYInput]) {
  input.addEventListener("change", () => {
    const item = editorItem();
    if (!item) return;
    setCurrentFrameOffset(Number(els.frameOffsetXInput.value) || 0, Number(els.frameOffsetYInput.value) || 0);
  });
}
els.selectAllBtn.addEventListener("click", () => {
  const allSelected = state.results.every((item) => state.selected.has(item.id));
  state.selected = new Set(allSelected ? [] : state.results.map((item) => item.id));
  renderResults();
});
for (const input of document.querySelectorAll('input[name="maskTool"]')) {
  input.addEventListener("change", () => {
    state.maskTool = input.value;
    state.drag = null;
    state.maskPainting = false;
    state.lastMaskPoint = null;
  });
}

els.previewCanvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  if (state.sampleMode) {
    if (state.sampleMode === "desaturate") sampleDesaturateColor(point);
    else sampleBackground(point);
    return;
  }
  if (state.maskTool !== "none") {
    state.maskPainting = true;
    state.lastMaskPoint = null;
    els.previewCanvas.setPointerCapture(event.pointerId);
    paintMask(point);
    return;
  }
  const hit = hitTest(point);
  if (hit) {
    state.drag = hit;
    els.previewCanvas.setPointerCapture(event.pointerId);
  }
});
els.previewCanvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  if (state.maskPainting) {
    paintMask(point);
    return;
  }
  if (state.drag) {
    setLine(state.drag.axis, state.drag.index, pointerToRatio(point, state.drag.axis));
    return;
  }
  els.previewCanvas.style.cursor =
    state.maskTool !== "none" ? "cell" : hitTest(point) ? "grab" : state.sampleMode ? "copy" : "crosshair";
});
els.previewCanvas.addEventListener("pointerup", () => {
  state.drag = null;
  state.maskPainting = false;
  state.lastMaskPoint = null;
});
els.previewCanvas.addEventListener("pointercancel", () => {
  state.drag = null;
  state.maskPainting = false;
  state.lastMaskPoint = null;
});

els.frameEditorCanvas.addEventListener("pointerdown", (event) => {
  const item = editorItem();
  if (!item) return;
  stopFramePlayback();
  const offset = item.offsets[state.editor.frameIndex] || { x: 0, y: 0 };
  state.editor.dragging = true;
  state.editor.dragStart = editorPoint(event);
  state.editor.dragBase = { x: offset.x, y: offset.y };
  els.frameEditorCanvas.setPointerCapture(event.pointerId);
});

els.frameEditorCanvas.addEventListener("pointermove", (event) => {
  const item = editorItem();
  if (!item || !state.editor.dragging) return;
  const point = editorPoint(event);
  const scale = state.editor.drawRect.scale || 1;
  const dx = (point.x - state.editor.dragStart.x) / scale;
  const dy = (point.y - state.editor.dragStart.y) / scale;
  setCurrentFrameOffset(state.editor.dragBase.x + dx, state.editor.dragBase.y + dy);
});

els.frameEditorCanvas.addEventListener("pointerup", () => {
  state.editor.dragging = false;
});

els.frameEditorCanvas.addEventListener("pointercancel", () => {
  state.editor.dragging = false;
});

for (const input of [
  els.bgColorInput,
  els.keyModeInput,
  els.toleranceInput,
  els.softnessInput,
  els.alphaCutInput,
  els.despillInput,
  els.spillTargetInput,
  els.spillColorInput,
  els.spillDesaturateInput,
  els.spillHueRangeInput,
  els.edgeShrinkInput,
  els.lumaThresholdInput,
  els.lumaSoftnessInput,
  els.lumaStrengthInput,
  els.lumaGlowInput,
  els.edgeCleanInput,
  els.alphaGrowInput,
  els.alphaFeatherInput,
  els.transparentCleanInput,
  els.matteEnabled,
  els.centerEnabled,
  els.paddingInput,
  els.offsetXInput,
  els.offsetYInput,
  els.brushSizeInput,
]) {
  input.addEventListener("input", updateOutputs);
  input.addEventListener("change", updateOutputs);
}

window.addEventListener("resize", () => {
  drawPreview();
  scheduleMattePreview();
  drawFrameEditor();
  applyFloatingPreviewPosition();
  drawLargePreview();
});
updateOutputs();
initGrid();
renderResults();
