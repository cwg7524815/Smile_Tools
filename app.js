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
  resultCount: $("resultCount"),
  previewInfo: $("previewInfo"),
  previewRowInput: $("previewRowInput"),
  previewColInput: $("previewColInput"),
  folderStatus: $("folderStatus"),
  selectAllBtn: $("selectAllBtn"),
  pickFolderBtn: $("pickFolderBtn"),
  exportFolderBtn: $("exportFolderBtn"),
  matteEnabled: $("matteEnabled"),
  bgColorInput: $("bgColorInput"),
  toleranceInput: $("toleranceInput"),
  softnessInput: $("softnessInput"),
  alphaCutInput: $("alphaCutInput"),
  despillInput: $("despillInput"),
  edgeShrinkInput: $("edgeShrinkInput"),
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
};

const masks = {
  erase: document.createElement("canvas"),
  protect: document.createElement("canvas"),
};
const maskCtx = {
  erase: masks.erase.getContext("2d", { willReadFrequently: true }),
  protect: masks.protect.getContext("2d", { willReadFrequently: true }),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pad2 = (n) => String(n).padStart(2, "0");

function updateOutputs() {
  for (const id of [
    "tolerance",
    "softness",
    "alphaCut",
    "despill",
    "edgeShrink",
    "padding",
    "offsetX",
    "offsetY",
    "brushSize",
  ]) {
    $(`${id}Value`).textContent = $(`${id}Input`).value;
  }
  drawMattePreview();
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
  drawMattePreview();
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
  drawMattePreview();
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
  clearMasks();
  renderResults();
  drawMattePreview();
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
  drawMattePreview();
}

function settings() {
  return {
    matte: els.matteEnabled.checked,
    bg: hexToRgb(els.bgColorInput.value),
    tolerance: Number(els.toleranceInput.value),
    softness: Number(els.softnessInput.value),
    alphaCut: Number(els.alphaCutInput.value),
    despill: Number(els.despillInput.value) / 100,
    edgeShrink: Number(els.edgeShrinkInput.value) / 100,
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
      const dr = data[i] - options.bg.r;
      const dg = data[i + 1] - options.bg.g;
      const db = data[i + 2] - options.bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      let alpha = 255;
      if (dist <= options.tolerance) alpha = 0;
      else if (dist < softEnd) alpha = ((dist - options.tolerance) / Math.max(1, options.softness)) * 255;
      if (options.edgeShrink > 0 && alpha > 0 && alpha < 255) {
        alpha = Math.max(0, alpha - 255 * options.edgeShrink);
      }
      data[i + 3] = alpha < options.alphaCut ? 0 : Math.round(alpha);
      if (data[i + 3] > 0 && options.despill > 0) {
        despillPixel(data, i, options, dist);
      }
    }
    if (protectedPixel && data[i + 3] < 255) data[i + 3] = 255;
    if (eraseData && eraseData[i + 3] > 0) data[i + 3] = 0;
  }

  cellCtx.canvas.width = width;
  cellCtx.canvas.height = height;
  cellCtx.putImageData(image, 0, 0);

  if (!options.center) return cloneCanvas(cellCtx.canvas);
  return centerCanvas(cellCtx.canvas, options);
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

function maskSlice(type, sx, sy, sw, sh) {
  if (!masks[type].width) return null;
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
  const css = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(220, Math.round((css.width || 260) * dpr));
  canvas.height = Math.max(160, Math.round((css.height || 180) * dpr));
  mattePreviewCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (!video.videoWidth || !video.videoHeight) {
    mattePreviewCtx.fillStyle = "#10203a";
    mattePreviewCtx.fillRect(0, 0, canvas.width, canvas.height);
    mattePreviewCtx.fillStyle = "#8ea8c7";
    mattePreviewCtx.font = `${13 * dpr}px Segoe UI`;
    mattePreviewCtx.textAlign = "center";
    mattePreviewCtx.fillText("选择视频后预览抠背景效果", canvas.width / 2, canvas.height / 2);
    els.previewInfo.textContent = "等待视频";
    return;
  }

  const { xs, ys } = getBounds();
  const row = clamp(Number(els.previewRowInput.value) || 1, 1, state.rows) - 1;
  const col = clamp(Number(els.previewColInput.value) || 1, 1, state.cols) - 1;
  const sx = Math.round(xs[col] * video.videoWidth);
  const sy = Math.round(ys[row] * video.videoHeight);
  const sw = Math.max(1, Math.round((xs[col + 1] - xs[col]) * video.videoWidth));
  const sh = Math.max(1, Math.round((ys[row + 1] - ys[row]) * video.videoHeight));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sw;
  sourceCanvas.height = sh;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  const processed = processCell(
    {
      ctx: sourceCtx,
      width: sw,
      height: sh,
      eraseMask: maskSlice("erase", sx, sy, sw, sh),
      protectMask: maskSlice("protect", sx, sy, sw, sh),
    },
    settings(),
  );
  const scale = Math.min(canvas.width / processed.width, canvas.height / processed.height);
  const dw = processed.width * scale;
  const dh = processed.height * scale;
  mattePreviewCtx.imageSmoothingEnabled = false;
  mattePreviewCtx.drawImage(processed, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  els.previewInfo.textContent = `第 ${row + 1} 行 / 第 ${col + 1} 列`;
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
    state.selected = new Set(buckets.map((item) => item.id));
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
    const card = document.createElement("label");
    card.className = "result-card";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = state.selected.has(item.id);
    check.addEventListener("change", () => {
      if (check.checked) state.selected.add(item.id);
      else state.selected.delete(item.id);
    });
    const img = document.createElement("img");
    img.src = item.frames[0].toDataURL("image/png");
    const text = document.createElement("div");
    text.innerHTML = `<strong>人物 ${item.id}</strong><span>${item.frames.length} 帧</span>`;
    card.append(check, img, text);
    els.resultsList.append(card);
  }
}

function selectedResults() {
  return state.results.filter((item) => state.selected.has(item.id));
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
  const root = await ensureOutputFolder();
  if (!root) return;

  els.exportFolderBtn.disabled = true;
  els.exportFolderBtn.textContent = "导出中...";

  try {
    const mode = els.exportModeInput.value;
    const cols = clamp(Number(els.sheetColsInput.value) || 1, 1, 32);

    if (mode === "frames") {
      for (const item of items) {
        const personDir = await root.getDirectoryHandle(`person_${pad2(item.id)}`, { create: true });
        for (let i = 0; i < item.frames.length; i++) {
          await writePng(personDir, `frame_${pad2(i + 1)}.png`, item.frames[i]);
        }
      }
    }

    if (mode === "person-sheets") {
      for (const item of items) {
        await writePng(root, `person_${pad2(item.id)}_sheet.png`, makeSheet(item.frames, cols));
      }
    }

    if (mode === "combined-sheet") {
      const frames = items.flatMap((item) => item.frames.map((canvas) => canvas));
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
  const frames = items.flatMap((item) => item.frames.map((canvas) => canvas));
  const cols = clamp(Number(els.sheetColsInput.value) || 1, 1, 32);
  const sheet = makeSheet(frames, cols);
  downloadBlob(await canvasToBlob(sheet), `sprite-sheet-${Date.now()}.png`);
}

function sampleBackground(point) {
  const d = state.display;
  if (!d.w) return;
  const videoX = Math.round(((point.x - d.x) / d.w) * els.sourceVideo.videoWidth);
  const videoY = Math.round(((point.y - d.y) / d.h) * els.sourceVideo.videoHeight);
  els.workCanvas.width = els.sourceVideo.videoWidth;
  els.workCanvas.height = els.sourceVideo.videoHeight;
  workCtx.drawImage(els.sourceVideo, 0, 0);
  const px = workCtx.getImageData(clamp(videoX, 0, els.workCanvas.width - 1), clamp(videoY, 0, els.workCanvas.height - 1), 1, 1).data;
  els.bgColorInput.value = rgbToHex(px[0], px[1], px[2]);
  state.sampleMode = false;
  drawMattePreview();
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
  drawMattePreview();
}

function syncTime() {
  const video = els.sourceVideo;
  const duration = video.duration || 0;
  els.seekRange.value = duration ? Math.round((video.currentTime / duration) * 1000) : 0;
  els.timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  drawPreview();
  drawMattePreview();
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
for (const input of [els.previewRowInput, els.previewColInput]) input.addEventListener("change", drawMattePreview);
els.resetGridBtn.addEventListener("click", initGrid);
els.clearMasksBtn.addEventListener("click", clearMasks);
els.extractBtn.addEventListener("click", extractFrames);
els.pickFolderBtn.addEventListener("click", pickOutputFolder);
els.exportFolderBtn.addEventListener("click", exportToFolder);
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
    sampleBackground(point);
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

for (const input of [
  els.bgColorInput,
  els.toleranceInput,
  els.softnessInput,
  els.alphaCutInput,
  els.despillInput,
  els.edgeShrinkInput,
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
  drawMattePreview();
});
updateOutputs();
initGrid();
renderResults();
