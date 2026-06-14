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
  startTimeInput: $("startTimeInput"),
  endTimeInput: $("endTimeInput"),
  resetGridBtn: $("resetGridBtn"),
  cropEnabled: $("cropEnabled"),
  drawCropBtn: $("drawCropBtn"),
  clearCropBtn: $("clearCropBtn"),
  extractBtn: $("extractBtn"),
  resultsList: $("resultsList"),
  frameEditor: $("frameEditor"),
  frameEditorCanvas: $("frameEditorCanvas"),
  frameEditorInfo: $("frameEditorInfo"),
  framePlayBtn: $("framePlayBtn"),
  frameOffsetXInput: $("frameOffsetXInput"),
  frameOffsetYInput: $("frameOffsetYInput"),
  frameScaleInput: $("frameScaleInput"),
  frameRotationInput: $("frameRotationInput"),
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
  largePreviewBgInput: $("largePreviewBgInput"),
  previewCheckerBtn: $("previewCheckerBtn"),
  largePreviewViewport: $("largePreviewViewport"),
  largePreviewCanvas: $("largePreviewCanvas"),
  previewRowInput: $("previewRowInput"),
  previewColInput: $("previewColInput"),
  folderStatus: $("folderStatus"),
  selectAllBtn: $("selectAllBtn"),
  projectNameInput: $("projectNameInput"),
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
  cols: 1,
  rows: 1,
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
  crop: {
    rect: null,
    drawing: false,
    drawMode: false,
    start: null,
    previousRect: null,
    editing: false,
    editMode: null,
    editStart: null,
    editRect: null,
  },
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
    bgColor: "",
    dragging: false,
    dragStart: null,
    origin: { x: 28, y: 28 },
  },
  mainPreview: {
    zoom: 1,
    drawRect: null,
    sourceRect: null,
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
const CROP_MIN_SIZE = 0.002;
const pad2 = (n) => String(n).padStart(2, "0");
const trimExtension = (name) => name.replace(/\.[^.]+$/, "");
const OUTPUT_DIR_DB = "smile_video_frame_tool";
const OUTPUT_DIR_STORE = "handles";
const OUTPUT_DIR_KEY = "last_output_dir";

function prepareMatteFields() {
  const labels = document.querySelectorAll(".settings-panel:first-child .settings-grid > label");
  for (const label of labels) {
    if (label.classList.contains("matte-field")) continue;
    const captionText = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
    for (const node of Array.from(label.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    }
    const caption = document.createElement("span");
    caption.className = "field-caption";
    caption.textContent = captionText;
    label.prepend(caption);
    label.classList.add("matte-field");

    const range = label.querySelector(":scope > input[type='range']");
    const output = label.querySelector(":scope > output");
    if (!range || !output) continue;
    const row = document.createElement("div");
    row.className = "range-row";
    row.append(range, output);
    label.append(row);
  }
}

function safeFileName(name, fallback = "untitled") {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/[. ]+$/g, "");
  return cleaned || fallback;
}

const MATTE_DEFAULTS = {
  color: {
    bgColorInput: "#12c91d",
    toleranceInput: 20,
    softnessInput: 20,
    alphaCutInput: 0,
    despillInput: 0,
    spillTargetInput: "sample",
    spillColorInput: "#12c91d",
    spillDesaturateInput: 0,
    edgeShrinkInput: 0,
    spillHueRangeInput: 8,
    edgeCleanInput: 0,
    alphaGrowInput: 1,
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
    alphaGrowInput: 1,
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
  const rect = canvas.getBoundingClientRect();
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
    drawCropOverlay();
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

function drawCropOverlay() {
  const d = state.display;
  const rect = normalizedCropRect();
  if (!d.w || !rect || (!els.cropEnabled.checked && !state.crop.drawMode && !state.crop.drawing)) return;
  const x = d.x + rect.x * d.w;
  const y = d.y + rect.y * d.h;
  const w = rect.w * d.w;
  const h = rect.h * d.h;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.rect(d.x, d.y, d.w, d.h);
  ctx.rect(x, y, w, h);
  ctx.fill("evenodd");
  ctx.strokeStyle = state.crop.drawMode ? "#f0a321" : "#27b8ff";
  ctx.lineWidth = Math.max(2, 2 * dpr);
  ctx.setLineDash([8 * dpr, 5 * dpr]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  if (els.cropEnabled.checked && !state.crop.drawMode) {
    const size = 9 * dpr;
    ctx.fillStyle = "#f0a321";
    ctx.strokeStyle = "#071426";
    for (const handle of cropHandlePoints({ x, y, w, h })) {
      ctx.beginPath();
      ctx.rect(handle.x - size / 2, handle.y - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `${13 * dpr}px Segoe UI`;
  ctx.fillText("裁剪区域", x + 8 * dpr, y + 18 * dpr);
  ctx.restore();
}

function normalizedCropRect() {
  const rect = state.crop.rect;
  if (!rect) return null;
  const x1 = clamp(Math.min(rect.x1, rect.x2), 0, 1);
  const y1 = clamp(Math.min(rect.y1, rect.y2), 0, 1);
  const x2 = clamp(Math.max(rect.x1, rect.x2), 0, 1);
  const y2 = clamp(Math.max(rect.y1, rect.y2), 0, 1);
  if (x2 - x1 < 0.002 || y2 - y1 < 0.002) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function cropDisplayRect() {
  const d = state.display;
  const rect = normalizedCropRect();
  if (!d.w || !rect) return null;
  return {
    x: d.x + rect.x * d.w,
    y: d.y + rect.y * d.h,
    w: rect.w * d.w,
    h: rect.h * d.h,
  };
}

function cropHandlePoints(rect) {
  const midX = rect.x + rect.w / 2;
  const midY = rect.y + rect.h / 2;
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  return [
    { mode: "nw", x: rect.x, y: rect.y },
    { mode: "n", x: midX, y: rect.y },
    { mode: "ne", x: right, y: rect.y },
    { mode: "e", x: right, y: midY },
    { mode: "se", x: right, y: bottom },
    { mode: "s", x: midX, y: bottom },
    { mode: "sw", x: rect.x, y: bottom },
    { mode: "w", x: rect.x, y: midY },
  ];
}

function cropCursor(mode) {
  return {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
    move: "move",
  }[mode] || "crosshair";
}

function hitCrop(point) {
  if (!els.cropEnabled.checked || state.sampleMode || state.maskTool !== "none") return null;
  const rect = cropDisplayRect();
  return hitCropDisplayRect(point, rect);
}

function hitCropDisplayRect(point, rect) {
  if (!rect) return null;
  const threshold = 11 * (window.devicePixelRatio || 1);
  for (const handle of cropHandlePoints(rect)) {
    if (Math.abs(point.x - handle.x) <= threshold && Math.abs(point.y - handle.y) <= threshold) {
      return { mode: handle.mode };
    }
  }
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;
  const withinX = point.x >= left - threshold && point.x <= right + threshold;
  const withinY = point.y >= top - threshold && point.y <= bottom + threshold;
  if (withinX && Math.abs(point.y - top) <= threshold) return { mode: "n" };
  if (withinX && Math.abs(point.y - bottom) <= threshold) return { mode: "s" };
  if (withinY && Math.abs(point.x - left) <= threshold) return { mode: "w" };
  if (withinY && Math.abs(point.x - right) <= threshold) return { mode: "e" };
  if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return { mode: "move" };
  return null;
}

function extractionRange(video) {
  const duration = video.duration || 0;
  const start = clamp(Number(els.startTimeInput.value) || 0, 0, duration);
  const rawEnd = Number(els.endTimeInput.value) || 0;
  const end = clamp(rawEnd || duration, 0, duration);
  els.startTimeInput.value = roundTime(start);
  els.endTimeInput.value = roundTime(end);
  if (end <= start) return null;
  return { start, end, duration: end - start };
}

function roundTime(value) {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

function normalizeRotation(value) {
  let rotation = Number(value) || 0;
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  return rotation;
}

function applyCropMask(canvas, cellRect) {
  const crop = els.cropEnabled.checked ? normalizedCropRect() : null;
  if (!crop) return canvas;
  const x1 = Math.max(cellRect.x, crop.x);
  const y1 = Math.max(cellRect.y, crop.y);
  const x2 = Math.min(cellRect.x + cellRect.w, crop.x + crop.w);
  const y2 = Math.min(cellRect.y + cellRect.h, crop.y + crop.h);
  const out = cloneCanvas(canvas);
  const outCtx = out.getContext("2d");
  if (x2 <= x1 || y2 <= y1) {
    outCtx.clearRect(0, 0, out.width, out.height);
    return out;
  }
  outCtx.save();
  outCtx.globalCompositeOperation = "destination-in";
  const rx = ((x1 - cellRect.x) / cellRect.w) * out.width;
  const ry = ((y1 - cellRect.y) / cellRect.h) * out.height;
  const rw = ((x2 - x1) / cellRect.w) * out.width;
  const rh = ((y2 - y1) / cellRect.h) * out.height;
  outCtx.fillStyle = "#fff";
  outCtx.fillRect(rx, ry, rw, rh);
  outCtx.restore();
  return out;
}

function processExtractedCell(source, options, cellRect) {
  const matteOptions = { ...options, center: false };
  let canvas = processCell(source, matteOptions);
  canvas = applyCropMask(canvas, cellRect);
  if (options.center) canvas = centerCanvas(canvas, options);
  return canvas;
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

function setCropDrawMode(active) {
  state.crop.drawMode = active;
  state.drag = null;
  state.maskPainting = false;
  state.crop.drawing = false;
  state.crop.editing = false;
  els.drawCropBtn.classList.toggle("is-active", active);
  drawPreview();
  scheduleMattePreview();
}

function pointToVideoRatio(point) {
  const d = state.display;
  if (!d.w || point.x < d.x || point.x > d.x + d.w || point.y < d.y || point.y > d.y + d.h) return null;
  return {
    x: clamp((point.x - d.x) / d.w, 0, 1),
    y: clamp((point.y - d.y) / d.h, 0, 1),
  };
}

function startCropDraw(point) {
  const ratio = pointToVideoRatio(point);
  return startCropDrawAtRatio(ratio);
}

function startCropDrawAtRatio(ratio) {
  if (!ratio) return false;
  state.crop.drawing = true;
  state.crop.start = ratio;
  state.crop.previousRect = state.crop.rect ? { ...state.crop.rect } : null;
  state.crop.rect = { x1: ratio.x, y1: ratio.y, x2: ratio.x, y2: ratio.y };
  els.cropEnabled.checked = true;
  drawPreview();
  return true;
}

function updateCropDraw(point) {
  const ratio = pointToVideoRatio(point);
  updateCropDrawAtRatio(ratio);
}

function updateCropDrawAtRatio(ratio) {
  if (!state.crop.drawing || !state.crop.start) return;
  if (!ratio) return;
  state.crop.rect = {
    x1: state.crop.start.x,
    y1: state.crop.start.y,
    x2: ratio.x,
    y2: ratio.y,
  };
  drawPreview();
  scheduleMattePreview(16);
}

function finishCropDraw() {
  if (!state.crop.drawing) return;
  state.crop.drawing = false;
  state.crop.start = null;
  if (!normalizedCropRect()) state.crop.rect = state.crop.previousRect;
  state.crop.previousRect = null;
  state.crop.drawMode = false;
  els.drawCropBtn.classList.remove("is-active");
  drawPreview();
  scheduleMattePreview();
}

function startCropEdit(point, hit) {
  const ratio = pointToVideoRatio(point);
  return startCropEditAtRatio(ratio, hit);
}

function startCropEditAtRatio(ratio, hit) {
  const rect = normalizedCropRect();
  if (!ratio || !rect) return false;
  state.crop.editing = true;
  state.crop.editMode = hit.mode;
  state.crop.editStart = ratio;
  state.crop.editRect = rect;
  state.crop.drawMode = false;
  els.drawCropBtn.classList.remove("is-active");
  return true;
}

function updateCropEdit(point) {
  const ratio = pointToVideoRatio(point);
  updateCropEditAtRatio(ratio);
}

function updateCropEditAtRatio(ratio) {
  if (!state.crop.editing || !state.crop.editStart || !state.crop.editRect) return;
  if (!ratio) return;
  const dx = ratio.x - state.crop.editStart.x;
  const dy = ratio.y - state.crop.editStart.y;
  const base = state.crop.editRect;
  let x1 = base.x;
  let y1 = base.y;
  let x2 = base.x + base.w;
  let y2 = base.y + base.h;
  const mode = state.crop.editMode || "";

  if (mode === "move") {
    const x = clamp(base.x + dx, 0, 1 - base.w);
    const y = clamp(base.y + dy, 0, 1 - base.h);
    state.crop.rect = { x1: x, y1: y, x2: x + base.w, y2: y + base.h };
  } else {
    if (mode.includes("w")) x1 = clamp(x1 + dx, 0, x2 - CROP_MIN_SIZE);
    if (mode.includes("e")) x2 = clamp(x2 + dx, x1 + CROP_MIN_SIZE, 1);
    if (mode.includes("n")) y1 = clamp(y1 + dy, 0, y2 - CROP_MIN_SIZE);
    if (mode.includes("s")) y2 = clamp(y2 + dy, y1 + CROP_MIN_SIZE, 1);
    state.crop.rect = { x1, y1, x2, y2 };
  }

  drawPreview();
  scheduleMattePreview(80);
}

function finishCropEdit() {
  if (!state.crop.editing) return;
  state.crop.editing = false;
  state.crop.editMode = null;
  state.crop.editStart = null;
  state.crop.editRect = null;
  drawPreview();
  scheduleMattePreview();
}

function clearCrop() {
  state.crop.rect = null;
  state.crop.drawing = false;
  state.crop.start = null;
  state.crop.previousRect = null;
  finishCropEdit();
  setCropDrawMode(false);
  scheduleMattePreview();
}

function setVideoFile(file) {
  if (!file || !file.type.startsWith("video/")) return;
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(file);
  els.projectNameInput.value = safeFileName(trimExtension(file.name), "SmileVideoFrames");
  els.sourceVideo.src = state.videoUrl;
  els.sourceVideo.load();
  els.emptyState.style.display = "none";
  state.results = [];
  state.selected.clear();
  state.crop.rect = null;
  state.crop.drawing = false;
  state.crop.start = null;
  state.crop.previousRect = null;
  state.crop.editing = false;
  state.crop.editMode = null;
  state.crop.editStart = null;
  state.crop.editRect = null;
  setCropDrawMode(false);
  els.cropEnabled.checked = false;
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
  const bounds = mainContentBounds(img.data, canvas.width, canvas.height, options.alphaCut);

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const outCtx = out.getContext("2d");
  if (!bounds) return out;

  const sw = bounds.maxX - bounds.minX + 1;
  const sh = bounds.maxY - bounds.minY + 1;
  const maxW = Math.max(1, canvas.width - options.padding * 2);
  const maxH = Math.max(1, canvas.height - options.padding * 2);
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (canvas.width - dw) / 2 + options.offsetX;
  const dy = (canvas.height - dh) / 2 + options.offsetY;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(canvas, bounds.minX, bounds.minY, sw, sh, dx, dy, dw, dh);
  return out;
}

function mainContentBounds(data, width, height, alphaCut) {
  const threshold = Math.max(1, alphaCut);
  const visited = new Uint8Array(width * height);
  const components = [];
  const stack = [];

  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= threshold) continue;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    visited[start] = 1;
    stack.push(start);

    while (stack.length) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      count++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let oy = -1; oy <= 1; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          const next = yy * width + xx;
          if (visited[next] || data[next * 4 + 3] <= threshold) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }

    if (count >= 8) components.push({ count, minX, minY, maxX, maxY });
  }

  if (!components.length) return null;
  components.sort((a, b) => b.count - a.count);
  const main = components[0];
  const gapLimit = Math.max(width, height) * 0.12;
  let bounds = { ...main };

  for (const component of components.slice(1)) {
    const sizeRatio = component.count / main.count;
    const closeToMain = componentGap(component, main) <= gapLimit;
    if (sizeRatio < 0.35 && !(sizeRatio >= 0.04 && closeToMain)) continue;
    bounds.minX = Math.min(bounds.minX, component.minX);
    bounds.minY = Math.min(bounds.minY, component.minY);
    bounds.maxX = Math.max(bounds.maxX, component.maxX);
    bounds.maxY = Math.max(bounds.maxY, component.maxY);
  }

  return bounds;
}

function componentGap(a, b) {
  const xGap = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX) - 1);
  const yGap = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY) - 1);
  return Math.hypot(xGap, yGap);
}

function drawMattePreview() {
  const video = els.sourceVideo;
  const canvas = els.mattePreviewCanvas;
  resizeCanvasToCss(canvas, 640, 360);
  applyMainPreviewBackground();

  if (!video.videoWidth || !video.videoHeight) {
    state.mainPreview.drawRect = null;
    state.mainPreview.sourceRect = null;
    mattePreviewCtx.clearRect(0, 0, canvas.width, canvas.height);
    mattePreviewCtx.fillStyle = "#10203a";
    mattePreviewCtx.fillRect(0, 0, canvas.width, canvas.height);
    els.previewInfo.textContent = "等待视频";
    drawLargePreview();
    return;
  }

  const preview = currentPreviewCanvas(1400);
  state.mainPreview.drawRect = drawCanvasContain(mattePreviewCtx, canvas, preview, state.mainPreview.zoom);
  state.mainPreview.sourceRect = preview.sourceRect;
  drawMainCropOverlay();
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
  const cellRect = {
    x: xs[col],
    y: ys[row],
    w: xs[col + 1] - xs[col],
    h: ys[row + 1] - ys[row],
  };
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
  const processed = processExtractedCell(
    {
      ctx: sourceCtx,
      width: pw,
      height: ph,
      eraseMask: maskSlice("erase", sx, sy, sw, sh, pw, ph),
      protectMask: maskSlice("protect", sx, sy, sw, sh, pw, ph),
    },
    previewOptions,
    cellRect,
  );
  processed.info = `第 ${row + 1} 行 / 第 ${col + 1} 列`;
  processed.sourceRect = { sx, sy, sw, sh };
  return processed;
}

function resizeCanvasToCss(canvas, minWidth, minHeight) {
  const css = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(minWidth, Math.round((css.width || minWidth) * dpr));
  canvas.height = Math.max(minHeight, Math.round((css.height || minHeight) * dpr));
}

function drawCanvasContain(targetCtx, canvas, source, zoom = 1) {
  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height) * zoom;
  const dw = source.width * scale;
  const dh = source.height * scale;
  const x = (canvas.width - dw) / 2;
  const y = (canvas.height - dh) / 2;
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(source, x, y, dw, dh);
  return { x, y, w: dw, h: dh };
}

function applyMainPreviewBackground() {
  const canvas = els.mattePreviewCanvas;
  if (state.floatingPreview.bgColor) {
    canvas.classList.add("has-solid-bg");
    canvas.style.backgroundColor = state.floatingPreview.bgColor;
    return;
  }
  canvas.classList.remove("has-solid-bg");
  canvas.style.backgroundColor = "";
}

function mainCropDisplayRect() {
  const crop = normalizedCropRect();
  const drawRect = state.mainPreview.drawRect;
  const sourceRect = state.mainPreview.sourceRect;
  const video = els.sourceVideo;
  if (!crop || !drawRect || !sourceRect || !video.videoWidth || !video.videoHeight) return null;
  const cropX = crop.x * video.videoWidth;
  const cropY = crop.y * video.videoHeight;
  const cropW = crop.w * video.videoWidth;
  const cropH = crop.h * video.videoHeight;
  return {
    x: drawRect.x + ((cropX - sourceRect.sx) / sourceRect.sw) * drawRect.w,
    y: drawRect.y + ((cropY - sourceRect.sy) / sourceRect.sh) * drawRect.h,
    w: (cropW / sourceRect.sw) * drawRect.w,
    h: (cropH / sourceRect.sh) * drawRect.h,
  };
}

function drawMainCropOverlay() {
  const drawRect = state.mainPreview.drawRect;
  const cropRect = mainCropDisplayRect();
  if (!drawRect || !cropRect || (!els.cropEnabled.checked && !state.crop.drawMode && !state.crop.drawing)) return;
  const dpr = window.devicePixelRatio || 1;
  mattePreviewCtx.save();
  mattePreviewCtx.beginPath();
  mattePreviewCtx.rect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
  mattePreviewCtx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  mattePreviewCtx.fillStyle = "rgba(0, 0, 0, 0.34)";
  mattePreviewCtx.fill("evenodd");
  mattePreviewCtx.strokeStyle = state.crop.drawMode ? "#f0a321" : "#27b8ff";
  mattePreviewCtx.lineWidth = Math.max(2, 2 * dpr);
  mattePreviewCtx.setLineDash([8 * dpr, 5 * dpr]);
  mattePreviewCtx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  mattePreviewCtx.setLineDash([]);
  if (els.cropEnabled.checked && !state.crop.drawMode) {
    const size = 9 * dpr;
    mattePreviewCtx.fillStyle = "#f0a321";
    mattePreviewCtx.strokeStyle = "#071426";
    for (const handle of cropHandlePoints(cropRect)) {
      mattePreviewCtx.beginPath();
      mattePreviewCtx.rect(handle.x - size / 2, handle.y - size / 2, size, size);
      mattePreviewCtx.fill();
      mattePreviewCtx.stroke();
    }
  }
  mattePreviewCtx.fillStyle = "#ffffff";
  mattePreviewCtx.font = `${13 * dpr}px Segoe UI`;
  mattePreviewCtx.fillText("裁剪区域", cropRect.x + 8 * dpr, cropRect.y + 18 * dpr);
  mattePreviewCtx.restore();
}

function drawLargePreview(preview = null) {
  if (els.previewModal.classList.contains("is-hidden")) return;
  const canvas = els.largePreviewCanvas;
  applyLargePreviewBackground();
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

function applyLargePreviewBackground() {
  const canvas = els.largePreviewCanvas;
  if (state.floatingPreview.bgColor) {
    canvas.classList.add("has-solid-bg");
    canvas.style.backgroundColor = state.floatingPreview.bgColor;
    return;
  }
  canvas.classList.remove("has-solid-bg");
  canvas.style.backgroundColor = "";
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
    const range = extractionRange(video);
    if (!range) {
      alert("结束秒必须大于起始秒。结束秒填 0 表示到视频结尾。");
      return;
    }
    const totalFrames = Math.max(1, Math.floor(range.duration * fps) + 1);
    const { xs, ys } = getBounds();
    const options = settings();
    const baseName = safeFileName(els.projectNameInput.value, "SmileVideoFrames");
    const buckets = Array.from({ length: state.rows * state.cols }, (_, i) => ({
      id: i + 1,
      name: `${baseName}_${pad2(i + 1)}`,
      keywords: "",
      frames: [],
      offsets: [],
      kept: [],
      checked: true,
    }));

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = Math.min(range.end, range.start + frame / fps);
      await seekTo(time);
      workCtx.clearRect(0, 0, els.workCanvas.width, els.workCanvas.height);
      workCtx.drawImage(video, 0, 0);

      for (let row = 0; row < state.rows; row++) {
        for (let col = 0; col < state.cols; col++) {
          const sx = Math.round(xs[col] * video.videoWidth);
          const sy = Math.round(ys[row] * video.videoHeight);
          const sw = Math.max(1, Math.round((xs[col + 1] - xs[col]) * video.videoWidth));
          const sh = Math.max(1, Math.round((ys[row + 1] - ys[row]) * video.videoHeight));
          const cellRect = {
            x: xs[col],
            y: ys[row],
            w: xs[col + 1] - xs[col],
            h: ys[row + 1] - ys[row],
          };
          const sourceCanvas = document.createElement("canvas");
          sourceCanvas.width = sw;
          sourceCanvas.height = sh;
          const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
          sourceCtx.drawImage(els.workCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const processed = processExtractedCell(
            {
              ctx: sourceCtx,
              width: sw,
              height: sh,
              eraseMask: maskSlice("erase", sx, sy, sw, sh),
              protectMask: maskSlice("protect", sx, sy, sw, sh),
            },
            options,
            cellRect,
          );
          buckets[row * state.cols + col].frames.push(processed);
        }
      }
    }

    state.results = buckets;
    for (const item of state.results) {
      item.offsets = item.frames.map(() => ({ x: 0, y: 0 }));
      item.transforms = item.frames.map(() => defaultFrameTransform());
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
    text.className = "result-meta";
    const nameInput = document.createElement("input");
    nameInput.className = "result-name-input";
    nameInput.value = item.name || `人物 ${item.id}`;
    nameInput.addEventListener("change", () => {
      item.name = safeFileName(nameInput.value, `person_${pad2(item.id)}`);
      nameInput.value = item.name;
    });
    const keywordInput = document.createElement("input");
    keywordInput.className = "result-keywords-input";
    keywordInput.placeholder = "关键词，如：移动，走路";
    keywordInput.value = item.keywords || "";
    keywordInput.addEventListener("change", () => {
      item.keywords = keywordInput.value.trim();
    });
    const count = document.createElement("span");
    count.className = "result-frame-count";
    count.textContent = `${item.frames.length} 帧`;
    text.append(nameInput, keywordInput);
    const adjust = document.createElement("button");
    adjust.type = "button";
    adjust.className = "adjust-frame-btn";
    adjust.textContent = "帧调整";
    adjust.addEventListener("click", () => openFrameEditor(item.id));
    const actions = document.createElement("div");
    actions.className = "result-actions";
    actions.append(adjust, count);
    card.append(check, img, text, actions);
    els.resultsList.append(card);
  }
}

function selectedResults() {
  return state.results.filter((item) => state.selected.has(item.id));
}

function resultFileName(item) {
  return safeFileName(item.name, `${safeFileName(els.projectNameInput.value, "item")}_${pad2(item.id)}`);
}

function defaultFrameTransform(offset = { x: 0, y: 0 }) {
  return {
    x: Math.round(offset.x || 0),
    y: Math.round(offset.y || 0),
    scale: 1,
    rotation: 0,
  };
}

function ensureFrameTransforms(item) {
  if (!item.transforms || item.transforms.length !== item.frames.length) {
    item.transforms = item.frames.map((_, index) => defaultFrameTransform(item.offsets?.[index]));
  }
  item.transforms = item.transforms.map((transform, index) => ({
    ...defaultFrameTransform(item.offsets?.[index]),
    ...transform,
    x: Math.round(Number(transform?.x ?? item.offsets?.[index]?.x) || 0),
    y: Math.round(Number(transform?.y ?? item.offsets?.[index]?.y) || 0),
    scale: clamp(Number(transform?.scale) || 1, 0.1, 4),
    rotation: normalizeRotation(transform?.rotation),
  }));
  item.offsets = item.transforms.map((transform) => ({ x: transform.x, y: transform.y }));
  return item.transforms;
}

function frameTransform(item, frameIndex) {
  return ensureFrameTransforms(item)[frameIndex] || defaultFrameTransform();
}

function adjustedCanvas(item, frameIndex) {
  const source = item.frames[frameIndex];
  const transform = frameTransform(item, frameIndex);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const canvasCtx = canvas.getContext("2d");
  canvasCtx.imageSmoothingEnabled = false;
  canvasCtx.save();
  canvasCtx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
  canvasCtx.rotate((transform.rotation * Math.PI) / 180);
  canvasCtx.scale(transform.scale, transform.scale);
  canvasCtx.drawImage(source, -source.width / 2, -source.height / 2);
  canvasCtx.restore();
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
  ensureFrameTransforms(item);
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
  const transform = frameTransform(item, state.editor.frameIndex);
  els.frameOffsetXInput.value = Math.round(transform.x);
  els.frameOffsetYInput.value = Math.round(transform.y);
  els.frameScaleInput.value = Math.round(transform.scale * 100);
  els.frameRotationInput.value = Math.round(transform.rotation);
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

function setCurrentFrameTransform(next) {
  const item = editorItem();
  if (!item) return;
  const current = frameTransform(item, state.editor.frameIndex);
  item.transforms[state.editor.frameIndex] = {
    x: Math.round(Number(next.x ?? current.x) || 0),
    y: Math.round(Number(next.y ?? current.y) || 0),
    scale: clamp(Number(next.scale ?? current.scale) || 1, 0.1, 4),
    rotation: normalizeRotation(next.rotation ?? current.rotation),
  };
  item.offsets[state.editor.frameIndex] = {
    x: item.transforms[state.editor.frameIndex].x,
    y: item.transforms[state.editor.frameIndex].y,
  };
  syncFrameOffsetInputs();
  drawFrameEditor();
  updateResultThumb(item);
  updateActiveFrameThumb();
}

function setCurrentFrameOffset(x, y) {
  setCurrentFrameTransform({ x, y });
}

function resetCurrentFrameOffset() {
  setCurrentFrameTransform(defaultFrameTransform());
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
    const transform = frameTransform(item, index);
    const text = document.createElement("div");
    text.innerHTML = `<strong>第 ${index + 1} 帧</strong><span>${frameTransformSummary(transform, kept)}</span>`;
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
  const transform = frameTransform(item, state.editor.frameIndex);
  const kept = !item.kept || item.kept[state.editor.frameIndex] !== false;
  img.src = adjustedCanvas(item, state.editor.frameIndex).toDataURL("image/png");
  span.textContent = frameTransformSummary(transform, kept);
  button.classList.toggle("is-skipped", !kept);
}

function frameTransformSummary(transform, kept) {
  return `${kept ? "保留" : "跳过"} · x ${Math.round(transform.x)} / y ${Math.round(transform.y)} · ${Math.round(transform.scale * 100)}% · ${Math.round(transform.rotation)}°`;
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
  const previous = state.outputDir || await loadOutputDir();
  const options = { mode: "readwrite" };
  if (previous) options.startIn = previous;
  let handle = null;
  try {
    handle = await window.showDirectoryPicker(options);
  } catch (error) {
    if (error.name === "AbortError") return null;
    if (!previous) throw error;
    handle = await window.showDirectoryPicker({ mode: "readwrite" });
  }
  await saveOutputDir(handle);
  return handle;
}

async function ensureOutputFolder() {
  const parent = await pickOutputFolder();
  if (!parent) return null;
  state.outputDir = parent;
  els.folderStatus.textContent = `已选择输出路径：${parent.name}`;
  const folderName = safeFileName(els.projectNameInput.value, "SmileVideoFrames");
  els.projectNameInput.value = folderName;
  return parent.getDirectoryHandle(folderName, { create: true });
}

async function ensureDirectoryPermission(handle) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

async function saveOutputDir(handle) {
  try {
    const db = await openOutputDirDb();
    const tx = db.transaction(OUTPUT_DIR_STORE, "readwrite");
    tx.objectStore(OUTPUT_DIR_STORE).put(handle, OUTPUT_DIR_KEY);
    await transactionDone(tx);
    db.close();
  } catch {
    // Some browsers only keep the handle in memory; export still works for this session.
  }
}

async function loadOutputDir() {
  try {
    const db = await openOutputDirDb();
    const tx = db.transaction(OUTPUT_DIR_STORE, "readonly");
    const request = tx.objectStore(OUTPUT_DIR_STORE).get(OUTPUT_DIR_KEY);
    const handle = await requestResult(request);
    await transactionDone(tx);
    db.close();
    return handle || null;
  } catch {
    return null;
  }
}

function openOutputDirDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OUTPUT_DIR_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(OUTPUT_DIR_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function createExportBatchFolder(root, base, mode) {
  const suffix = {
    frames: "frames",
    "person-sheets": "sheets",
    "combined-sheet": "combined",
  }[mode] || "export";
  const baseName = `${safeFileName(base, "export")}_${suffix}`;
  const dirName = await uniqueDirectoryName(root, baseName);
  return {
    name: dirName,
    handle: await root.getDirectoryHandle(dirName, { create: true }),
  };
}

async function writePng(directory, filename, canvas) {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await canvasToBlob(canvas));
  await writable.close();
}

async function uniqueFileName(directory, filename) {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  let candidate = filename;
  let index = 2;
  while (await fileExists(directory, candidate)) {
    candidate = `${base}_${index}${ext}`;
    index++;
  }
  return candidate;
}

async function uniqueDirectoryName(directory, name) {
  let candidate = name;
  let index = 2;
  while (await directoryExists(directory, candidate)) {
    candidate = `${name}_${index}`;
    index++;
  }
  return candidate;
}

async function fileExists(directory, filename) {
  try {
    await directory.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(directory, name) {
  try {
    await directory.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeTextFile(directory, filename, text) {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([text], { type: "text/plain;charset=utf-8" }));
  await writable.close();
}

function splitKeywords(value) {
  return String(value || "")
    .split(/[,\uff0c;；、\s]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function buildActionRecord(item, name, frameOrder) {
  const firstFrame = item.frames[0];
  return {
    id: item.id,
    name,
    godotAnimationName: safeFileName(name, `animation_${pad2(item.id)}`).toLowerCase(),
    keywords: splitKeywords(item.keywords),
    frameCount: frameOrder.length,
    frameSize: {
      width: firstFrame ? firstFrame.width : 0,
      height: firstFrame ? firstFrame.height : 0,
    },
    frameOrder,
  };
}

function buildExportIndex(records, mode, cols, batchName) {
  const projectName = safeFileName(els.projectNameInput.value, "SmileVideoFrames");
  const fps = clamp(Number(els.fpsInput.value) || 1, 1, 30);
  return {
    schemaVersion: 1,
    tool: "Smile Video Frame Tool",
    projectName,
    batchName,
    exportMode: mode,
    manifestFile: "export_index.json",
    isSingleSourceOfTruth: true,
    fps,
    frameDurationSeconds: 1 / fps,
    sheetColumns: cols,
    godot: {
      targetNode: "AnimatedSprite2D",
      resource: "SpriteFrames",
      animationNameField: "actions[].godotAnimationName",
      frameOrderField: "actions[].frameOrder",
      frameSizeField: "actions[].frameSize",
      note: "For frames mode, add each frameOrder file as one SpriteFrames frame. For sheet modes, slice sheet by frameSize and frameOrder/combinedOrder.",
    },
    note: "Each action contains its own Godot animation name, keywords, frame size, files, and frameOrder. Play frames by frameOrder order.",
    actions: records,
  };
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
    const actionRecords = [];
    let exportedPath = root.name;

    if (mode === "frames") {
      for (const item of exportableItems) {
        const itemName = resultFileName(item);
        const batch = await createExportBatchFolder(root, itemName, mode);
        const indexes = keptFrameIndexes(item);
        const frameOrder = [];
        for (let i = 0; i < indexes.length; i++) {
          const frameName = await uniqueFileName(batch.handle, `${itemName}_${pad2(i + 1)}.png`);
          await writePng(batch.handle, frameName, adjustedCanvas(item, indexes[i]));
          frameOrder.push({ order: i + 1, sourceFrameIndex: indexes[i] + 1, file: frameName });
        }
        const record = buildActionRecord(item, itemName, frameOrder);
        record.directory = ".";
        const index = buildExportIndex([record], mode, cols, batch.name);
        await writeTextFile(batch.handle, "export_index.json", JSON.stringify(index, null, 2));
        actionRecords.push({ ...record, directory: batch.name });
        exportedPath = `${root.name}/${batch.name}`;
      }
    }

    if (mode === "person-sheets") {
      for (const item of exportableItems) {
        const itemName = resultFileName(item);
        const batch = await createExportBatchFolder(root, itemName, mode);
        const indexes = keptFrameIndexes(item);
        const sheetName = await uniqueFileName(batch.handle, `${itemName}.png`);
        await writePng(batch.handle, sheetName, makeSheet(adjustedFrames(item), cols));
        const record = buildActionRecord(item, itemName, indexes.map((frameIndex, index) => ({
          order: index + 1,
          sourceFrameIndex: frameIndex + 1,
          file: sheetName,
        })));
        record.sheet = {
          file: sheetName,
          columns: cols,
          rows: Math.ceil(indexes.length / cols),
          cellWidth: record.frameSize.width,
          cellHeight: record.frameSize.height,
          order: "left-to-right, top-to-bottom",
        };
        const index = buildExportIndex([record], mode, cols, batch.name);
        await writeTextFile(batch.handle, "export_index.json", JSON.stringify(index, null, 2));
        actionRecords.push({ ...record, directory: batch.name });
        exportedPath = `${root.name}/${batch.name}`;
      }
    }

    if (mode === "combined-sheet") {
      const batch = await createExportBatchFolder(root, safeFileName(els.projectNameInput.value, "combined_sheet"), mode);
      const exportRoot = batch.handle;
      const frames = exportableItems.flatMap((item) => adjustedFrames(item));
      const combinedName = await uniqueFileName(exportRoot, `${safeFileName(els.projectNameInput.value, "combined_sheet")}.png`);
      await writePng(exportRoot, combinedName, makeSheet(frames, cols));
      let startOrder = 1;
      for (const item of exportableItems) {
        const itemName = resultFileName(item);
        const indexes = keptFrameIndexes(item);
        const frameOrder = indexes.map((frameIndex, index) => ({
          order: index + 1,
          sourceFrameIndex: frameIndex + 1,
          file: combinedName,
          combinedOrder: startOrder + index,
        }));
        const record = buildActionRecord(item, itemName, frameOrder);
        record.sheet = {
          file: combinedName,
          columns: cols,
          cellWidth: record.frameSize.width,
          cellHeight: record.frameSize.height,
          order: "left-to-right, top-to-bottom",
        };
        record.combinedRange = { startOrder, endOrder: startOrder + indexes.length - 1 };
        actionRecords.push(record);
        startOrder += indexes.length;
      }
      const index = buildExportIndex(actionRecords, mode, cols, batch.name);
      await writeTextFile(exportRoot, "export_index.json", JSON.stringify(index, null, 2));
      exportedPath = `${root.name}/${batch.name}`;
    }

    els.folderStatus.textContent = `已导出：${exportedPath}`;
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

function mainPreviewPoint(event) {
  const rect = els.mattePreviewCanvas.getBoundingClientRect();
  const sx = els.mattePreviewCanvas.width / rect.width;
  const sy = els.mattePreviewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy,
  };
}

function mainPreviewPointToVideoRatio(point) {
  const drawRect = state.mainPreview.drawRect;
  const sourceRect = state.mainPreview.sourceRect;
  const video = els.sourceVideo;
  if (!drawRect || !sourceRect || !video.videoWidth || !video.videoHeight) return null;
  if (point.x < drawRect.x || point.x > drawRect.x + drawRect.w || point.y < drawRect.y || point.y > drawRect.y + drawRect.h) {
    return null;
  }
  const sourceX = sourceRect.sx + ((point.x - drawRect.x) / drawRect.w) * sourceRect.sw;
  const sourceY = sourceRect.sy + ((point.y - drawRect.y) / drawRect.h) * sourceRect.sh;
  return {
    x: clamp(sourceX / video.videoWidth, 0, 1),
    y: clamp(sourceY / video.videoHeight, 0, 1),
  };
}

function hitMainCrop(point) {
  if (!els.cropEnabled.checked || state.sampleMode || state.maskTool !== "none") return null;
  return hitCropDisplayRect(point, mainCropDisplayRect());
}

function sampleMainPreviewColor(point) {
  const drawRect = state.mainPreview.drawRect;
  const sourceRect = state.mainPreview.sourceRect;
  if (!drawRect || !sourceRect || !els.sourceVideo.videoWidth) return null;
  if (point.x < drawRect.x || point.x > drawRect.x + drawRect.w || point.y < drawRect.y || point.y > drawRect.y + drawRect.h) {
    return null;
  }
  const ratioX = (point.x - drawRect.x) / drawRect.w;
  const ratioY = (point.y - drawRect.y) / drawRect.h;
  const videoX = Math.round(sourceRect.sx + ratioX * sourceRect.sw);
  const videoY = Math.round(sourceRect.sy + ratioY * sourceRect.sh);
  els.workCanvas.width = els.sourceVideo.videoWidth;
  els.workCanvas.height = els.sourceVideo.videoHeight;
  workCtx.drawImage(els.sourceVideo, 0, 0);
  const px = workCtx.getImageData(clamp(videoX, 0, els.workCanvas.width - 1), clamp(videoY, 0, els.workCanvas.height - 1), 1, 1).data;
  return rgbToHex(px[0], px[1], px[2]);
}

function applySampledColor(color) {
  if (!color) return;
  if (state.sampleMode === "desaturate") {
    els.spillColorInput.value = color;
    els.spillTargetInput.value = "sample";
  } else {
    els.bgColorInput.value = color;
  }
  state.sampleMode = false;
  updateModeFields();
  scheduleMattePreview();
}

function sampleBackground(point) {
  const color = sampleVideoColor(point);
  applySampledColor(color);
}

function sampleDesaturateColor(point) {
  const color = sampleVideoColor(point);
  applySampledColor(color);
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
  els.startTimeInput.value = roundTime(0);
  els.endTimeInput.value = roundTime(els.sourceVideo.duration || 0);
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
els.drawCropBtn.addEventListener("click", () => setCropDrawMode(!state.crop.drawMode));
els.clearCropBtn.addEventListener("click", clearCrop);
els.cropEnabled.addEventListener("change", () => {
  drawPreview();
  scheduleMattePreview();
});
for (const input of [els.startTimeInput, els.endTimeInput]) {
  input.addEventListener("change", () => {
    if (els.sourceVideo.duration) extractionRange(els.sourceVideo);
    drawPreview();
    scheduleMattePreview();
  });
}
els.clearMasksBtn.addEventListener("click", clearMasks);
els.extractBtn.addEventListener("click", extractFrames);
els.exportFolderBtn.addEventListener("click", exportToFolder);
els.resetMatteBtn.addEventListener("click", applyMatteDefaults);
els.advancedMatteBtn.addEventListener("click", () => {
  state.advancedMatte = !state.advancedMatte;
  updateOutputs();
});
els.sampleSpillBtn.addEventListener("click", () => {
  setCropDrawMode(false);
  state.sampleMode = "desaturate";
  updateModeFields();
});
els.floatPreviewBtn.addEventListener("click", openFloatingPreview);
els.closePreviewModalBtn.addEventListener("click", closeFloatingPreview);
els.zoomOutPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(state.floatingPreview.zoom - 0.25));
els.zoomInPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(state.floatingPreview.zoom + 0.25));
els.zoomResetPreviewBtn.addEventListener("click", () => setFloatingPreviewZoom(1));
els.largePreviewBgInput.addEventListener("input", () => {
  state.floatingPreview.bgColor = els.largePreviewBgInput.value;
  applyMainPreviewBackground();
  applyLargePreviewBackground();
});
els.previewCheckerBtn.addEventListener("click", () => {
  state.floatingPreview.bgColor = "";
  applyMainPreviewBackground();
  applyLargePreviewBackground();
});
els.mattePreviewCanvas.addEventListener("pointerdown", (event) => {
  const point = mainPreviewPoint(event);
  const cropHit = hitMainCrop(point);
  if (cropHit && !state.crop.drawMode) {
    if (startCropEditAtRatio(mainPreviewPointToVideoRatio(point), cropHit)) {
      els.mattePreviewCanvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  if (state.crop.drawMode) {
    if (startCropDrawAtRatio(mainPreviewPointToVideoRatio(point))) {
      els.mattePreviewCanvas.setPointerCapture(event.pointerId);
      scheduleMattePreview();
    }
  }
});
els.mattePreviewCanvas.addEventListener("pointermove", (event) => {
  const point = mainPreviewPoint(event);
  if (state.crop.editing) {
    updateCropEditAtRatio(mainPreviewPointToVideoRatio(point));
    return;
  }
  if (state.crop.drawing) {
    updateCropDrawAtRatio(mainPreviewPointToVideoRatio(point));
    return;
  }
  const cropHit = hitMainCrop(point);
  els.mattePreviewCanvas.style.cursor = cropHit
    ? cropCursor(cropHit.mode)
    : state.crop.drawMode
      ? "crosshair"
      : state.sampleMode
        ? "copy"
        : "zoom-in";
});
els.mattePreviewCanvas.addEventListener("pointerup", () => {
  finishCropDraw();
  finishCropEdit();
});
els.mattePreviewCanvas.addEventListener("pointercancel", () => {
  finishCropDraw();
  finishCropEdit();
});
els.mattePreviewCanvas.addEventListener("click", (event) => {
  if (!state.sampleMode) return;
  applySampledColor(sampleMainPreviewColor(mainPreviewPoint(event)));
});
els.mattePreviewCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  state.mainPreview.zoom = clamp(state.mainPreview.zoom + (event.deltaY < 0 ? 0.1 : -0.1), 0.25, 6);
  drawMattePreview();
});
els.largePreviewViewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  setFloatingPreviewZoom(state.floatingPreview.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
});
els.previewModalHeader.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".preview-zoom-controls")) return;
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
for (const input of [els.frameOffsetXInput, els.frameOffsetYInput, els.frameScaleInput, els.frameRotationInput]) {
  input.addEventListener("change", () => {
    const item = editorItem();
    if (!item) return;
    setCurrentFrameTransform({
      x: Number(els.frameOffsetXInput.value) || 0,
      y: Number(els.frameOffsetYInput.value) || 0,
      scale: (Number(els.frameScaleInput.value) || 100) / 100,
      rotation: Number(els.frameRotationInput.value) || 0,
    });
  });
}
els.selectAllBtn.addEventListener("click", () => {
  const allSelected = state.results.every((item) => state.selected.has(item.id));
  state.selected = new Set(allSelected ? [] : state.results.map((item) => item.id));
  renderResults();
});
for (const input of document.querySelectorAll('input[name="maskTool"]')) {
  input.addEventListener("change", () => {
    setCropDrawMode(false);
    state.maskTool = input.value;
    state.drag = null;
    state.maskPainting = false;
    state.lastMaskPoint = null;
  });
}

els.previewCanvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const cropHit = hitCrop(point);
  if (cropHit && !state.crop.drawMode) {
    if (startCropEdit(point, cropHit)) els.previewCanvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.crop.drawMode) {
    if (startCropDraw(point)) els.previewCanvas.setPointerCapture(event.pointerId);
    return;
  }
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
  if (state.crop.editing) {
    updateCropEdit(point);
    return;
  }
  if (state.crop.drawing) {
    updateCropDraw(point);
    return;
  }
  if (state.maskPainting) {
    paintMask(point);
    return;
  }
  if (state.drag) {
    setLine(state.drag.axis, state.drag.index, pointerToRatio(point, state.drag.axis));
    return;
  }
  const cropHit = hitCrop(point);
  els.previewCanvas.style.cursor =
    cropHit ? cropCursor(cropHit.mode) : state.crop.drawMode ? "crosshair" : state.maskTool !== "none" ? "cell" : hitTest(point) ? "grab" : state.sampleMode ? "copy" : "crosshair";
});
els.previewCanvas.addEventListener("pointerup", () => {
  finishCropDraw();
  finishCropEdit();
  state.drag = null;
  state.maskPainting = false;
  state.lastMaskPoint = null;
});
els.previewCanvas.addEventListener("pointercancel", () => {
  finishCropDraw();
  finishCropEdit();
  state.drag = null;
  state.maskPainting = false;
  state.lastMaskPoint = null;
});

els.frameEditorCanvas.addEventListener("pointerdown", (event) => {
  const item = editorItem();
  if (!item) return;
  stopFramePlayback();
  const transform = frameTransform(item, state.editor.frameIndex);
  state.editor.dragging = true;
  state.editor.dragStart = editorPoint(event);
  state.editor.dragBase = { x: transform.x, y: transform.y };
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
prepareMatteFields();
updateOutputs();
initGrid();
renderResults();
