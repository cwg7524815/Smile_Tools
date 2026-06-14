"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  sheetInput: $("sheetInput"),
  framesInput: $("framesInput"),
  rowsInput: $("rowsInput"),
  colsInput: $("colsInput"),
  resplitBtn: $("resplitBtn"),
  playBtn: $("playBtn"),
  fpsInput: $("fpsInput"),
  previousBtn: $("previousBtn"),
  nextBtn: $("nextBtn"),
  previewStage: $("previewStage"),
  previewCanvas: $("previewCanvas"),
  emptyState: $("emptyState"),
  frameInfo: $("frameInfo"),
  offsetXInput: $("offsetXInput"),
  offsetYInput: $("offsetYInput"),
  scaleXInput: $("scaleXInput"),
  scaleYInput: $("scaleYInput"),
  rotationInput: $("rotationInput"),
  resetFrameBtn: $("resetFrameBtn"),
  resetAllBtn: $("resetAllBtn"),
  exportColsInput: $("exportColsInput"),
  exportSheetBtn: $("exportSheetBtn"),
  exportCurrentBtn: $("exportCurrentBtn"),
  canvasSizeLabel: $("canvasSizeLabel"),
  frameList: $("frameList"),
  frameCount: $("frameCount"),
};

const previewCtx = els.previewCanvas.getContext("2d");
const state = {
  frames: [],
  activeIndex: 0,
  sourceSheet: null,
  sourceName: "animation",
  playing: false,
  timer: null,
  drag: null,
  reorderFrom: null,
  drawRect: null,
  frameWidth: 0,
  frameHeight: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value) {
  let rotation = Number(value) || 0;
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  return rotation;
}

function safeName(value, fallback = "animation") {
  const name = String(value || "").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return name || fallback;
}

function naturalFileSort(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片：${file.name}`));
    };
    image.src = url;
  });
}

function imageToCanvas(image, sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeFrame(source, name, transform = {}) {
  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    source,
    name,
    transform: {
      x: Math.round(transform.x || 0),
      y: Math.round(transform.y || 0),
      scaleX: Number(transform.scaleX ?? transform.scale) || 1,
      scaleY: Number(transform.scaleY ?? transform.scale) || 1,
      rotation: normalizeRotation(transform.rotation),
    },
  };
}

function activeFrame() {
  return state.frames[state.activeIndex] || null;
}

function setControlsEnabled(enabled) {
  for (const element of [
    els.playBtn, els.previousBtn, els.nextBtn, els.offsetXInput, els.offsetYInput, els.scaleXInput, els.scaleYInput, els.rotationInput,
    els.resetFrameBtn, els.resetAllBtn, els.exportSheetBtn, els.exportCurrentBtn,
  ]) element.disabled = !enabled;
  els.resplitBtn.disabled = !state.sourceSheet;
}

function stopPlayback() {
  state.playing = false;
  clearInterval(state.timer);
  state.timer = null;
  els.playBtn.textContent = "播放";
}

function startPlayback() {
  if (!state.frames.length) return;
  stopPlayback();
  state.playing = true;
  els.playBtn.textContent = "暂停";
  const fps = clamp(Number(els.fpsInput.value) || 8, 1, 60);
  state.timer = setInterval(() => selectFrame((state.activeIndex + 1) % state.frames.length, false), 1000 / fps);
}

function togglePlayback() {
  if (state.playing) stopPlayback();
  else startPlayback();
}

function setFrames(frames, width, height, sourceName) {
  stopPlayback();
  state.frames = frames;
  state.activeIndex = 0;
  state.frameWidth = width;
  state.frameHeight = height;
  state.sourceName = safeName(sourceName);
  els.exportColsInput.value = clamp(Math.min(frames.length, 8), 1, 64);
  setControlsEnabled(frames.length > 0);
  els.emptyState.classList.toggle("is-hidden", frames.length > 0);
  renderFrameList();
  syncInspector();
  drawPreview();
}

async function loadSingleSheet(file) {
  if (!file) return;
  try {
    const image = await loadImageFile(file);
    state.sourceSheet = { image, name: file.name };
    splitSourceSheet();
  } catch (error) {
    alert(error.message);
  } finally {
    els.sheetInput.value = "";
  }
}

function splitSourceSheet() {
  if (!state.sourceSheet) return;
  const rows = clamp(Number(els.rowsInput.value) || 1, 1, 64);
  const cols = clamp(Number(els.colsInput.value) || 1, 1, 64);
  els.rowsInput.value = rows;
  els.colsInput.value = cols;
  const { image, name } = state.sourceSheet;
  const cellWidth = Math.floor(image.naturalWidth / cols);
  const cellHeight = Math.floor(image.naturalHeight / rows);
  if (!cellWidth || !cellHeight) {
    alert("行列数超过图片尺寸，无法分割。");
    return;
  }
  const frames = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const source = imageToCanvas(image, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
      frames.push(makeFrame(source, `第 ${frames.length + 1} 帧`));
    }
  }
  setFrames(frames, cellWidth, cellHeight, name);
}

async function loadMultipleFrames(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("image/")).sort(naturalFileSort);
  if (!files.length) return;
  try {
    const images = await Promise.all(files.map(loadImageFile));
    const width = Math.max(...images.map((image) => image.naturalWidth));
    const height = Math.max(...images.map((image) => image.naturalHeight));
    const frames = images.map((image, index) => makeFrame(imageToCanvas(image), files[index].name));
    state.sourceSheet = null;
    setFrames(frames, width, height, files[0].name);
  } catch (error) {
    alert(error.message);
  } finally {
    els.framesInput.value = "";
  }
}

function adjustedFrameCanvas(frame) {
  const canvas = document.createElement("canvas");
  canvas.width = state.frameWidth;
  canvas.height = state.frameHeight;
  const ctx = canvas.getContext("2d");
  const transform = normalizedTransform(frame);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate((state.frameWidth / 2) + transform.x, (state.frameHeight / 2) + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.scaleX, transform.scaleY);
  ctx.drawImage(frame.source, -frame.source.width / 2, -frame.source.height / 2);
  ctx.restore();
  return canvas;
}

function normalizedTransform(frame) {
  if (!frame.transform) {
    frame.transform = {
      x: Math.round(frame.offset?.x || 0),
      y: Math.round(frame.offset?.y || 0),
      scaleX: Number(frame.transform?.scale ?? 1) || 1,
      scaleY: Number(frame.transform?.scale ?? 1) || 1,
      rotation: 0,
    };
    delete frame.offset;
  }
  frame.transform.x = Math.round(Number(frame.transform.x) || 0);
  frame.transform.y = Math.round(Number(frame.transform.y) || 0);
  const legacyScale = Number(frame.transform.scale);
  frame.transform.scaleX = clamp(Number(frame.transform.scaleX ?? legacyScale) || 1, 0.1, 4);
  frame.transform.scaleY = clamp(Number(frame.transform.scaleY ?? legacyScale) || 1, 0.1, 4);
  delete frame.transform.scale;
  frame.transform.rotation = normalizeRotation(frame.transform.rotation);
  return frame.transform;
}

function resizePreviewCanvas() {
  const rect = els.previewCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.previewCanvas.width = Math.max(480, Math.round((rect.width || 880) * dpr));
  els.previewCanvas.height = Math.max(320, Math.round((rect.height || 560) * dpr));
}

function drawPreview() {
  resizePreviewCanvas();
  previewCtx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
  const frame = activeFrame();
  if (!frame) return;
  const padding = 32 * (window.devicePixelRatio || 1);
  const scale = Math.min(
    (els.previewCanvas.width - padding * 2) / state.frameWidth,
    (els.previewCanvas.height - padding * 2) / state.frameHeight,
  );
  const width = state.frameWidth * scale;
  const height = state.frameHeight * scale;
  const x = (els.previewCanvas.width - width) / 2;
  const y = (els.previewCanvas.height - height) / 2;
  state.drawRect = { x, y, width, height, scale };
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(adjustedFrameCanvas(frame), x, y, width, height);
  drawTransformBox(frame);
}

function previewGeometry(frame) {
  if (!frame || !state.drawRect) return null;
  const transform = normalizedTransform(frame);
  const d = state.drawRect;
  const angle = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const center = {
    x: d.x + (d.width / 2) + (transform.x * d.scale),
    y: d.y + (d.height / 2) + (transform.y * d.scale),
  };
  const halfWidth = (frame.source.width * transform.scaleX * d.scale) / 2;
  const halfHeight = (frame.source.height * transform.scaleY * d.scale) / 2;
  const localPoints = [
    { name: "nw", x: -halfWidth, y: -halfHeight },
    { name: "n", x: 0, y: -halfHeight },
    { name: "ne", x: halfWidth, y: -halfHeight },
    { name: "e", x: halfWidth, y: 0 },
    { name: "se", x: halfWidth, y: halfHeight },
    { name: "s", x: 0, y: halfHeight },
    { name: "sw", x: -halfWidth, y: halfHeight },
    { name: "w", x: -halfWidth, y: 0 },
  ];
  const rotatePoint = transformLocalPoint({ x: 0, y: halfHeight + (34 * (window.devicePixelRatio || 1)) }, center, cos, sin);
  const bottomPoint = transformLocalPoint({ x: 0, y: halfHeight }, center, cos, sin);
  return {
    center,
    halfWidth,
    halfHeight,
    handles: localPoints.map((point) => ({ name: point.name, ...transformLocalPoint(point, center, cos, sin) })),
    rotatePoint,
    bottomPoint,
  };
}

function transformLocalPoint(point, center, cos, sin) {
  return {
    x: center.x + (point.x * cos) - (point.y * sin),
    y: center.y + (point.x * sin) + (point.y * cos),
  };
}

function drawTransformBox(frame) {
  const geometry = previewGeometry(frame);
  if (!geometry) return;
  const dpr = window.devicePixelRatio || 1;
  const handleSize = 10 * dpr;
  const rotateRadius = 7 * dpr;
  const handles = geometry.handles;
  const corners = ["nw", "ne", "se", "sw"].map((name) => handles.find((handle) => handle.name === name));

  previewCtx.save();
  previewCtx.strokeStyle = "#27b8ff";
  previewCtx.fillStyle = "#10203a";
  previewCtx.lineWidth = Math.max(1.5, dpr * 1.5);
  previewCtx.beginPath();
  previewCtx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) previewCtx.lineTo(corners[i].x, corners[i].y);
  previewCtx.closePath();
  previewCtx.stroke();

  previewCtx.beginPath();
  previewCtx.moveTo(geometry.bottomPoint.x, geometry.bottomPoint.y);
  previewCtx.lineTo(geometry.rotatePoint.x, geometry.rotatePoint.y);
  previewCtx.stroke();

  for (const corner of handles) {
    previewCtx.fillStyle = "#0d1c34";
    previewCtx.strokeStyle = "#8ee6ff";
    previewCtx.lineWidth = Math.max(1, dpr);
    previewCtx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    previewCtx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
  }

  previewCtx.beginPath();
  previewCtx.arc(geometry.rotatePoint.x, geometry.rotatePoint.y, rotateRadius, 0, Math.PI * 2);
  previewCtx.fillStyle = "#f0a321";
  previewCtx.strokeStyle = "#ffe0a3";
  previewCtx.fill();
  previewCtx.stroke();

  previewCtx.fillStyle = "#07101f";
  previewCtx.font = `${Math.round(11 * dpr)}px Arial`;
  previewCtx.textAlign = "center";
  previewCtx.textBaseline = "middle";
  previewCtx.fillText("↻", geometry.rotatePoint.x, geometry.rotatePoint.y + (0.5 * dpr));
  previewCtx.restore();
}

function syncInspector() {
  const frame = activeFrame();
  if (!frame) {
    els.frameInfo.textContent = "尚未载入帧";
    els.frameCount.textContent = "0 帧";
    els.canvasSizeLabel.textContent = "0 × 0";
    els.offsetXInput.value = 0;
    els.offsetYInput.value = 0;
    els.scaleXInput.value = 100;
    els.scaleYInput.value = 100;
    els.rotationInput.value = 0;
    return;
  }
  const transform = normalizedTransform(frame);
  els.offsetXInput.value = transform.x;
  els.offsetYInput.value = transform.y;
  els.scaleXInput.value = Math.round(transform.scaleX * 100);
  els.scaleYInput.value = Math.round(transform.scaleY * 100);
  els.rotationInput.value = Math.round(transform.rotation);
  els.frameInfo.textContent = `第 ${state.activeIndex + 1} / ${state.frames.length} 帧 · ${frame.name}`;
  els.frameCount.textContent = `${state.frames.length} 帧`;
  els.canvasSizeLabel.textContent = `${state.frameWidth} × ${state.frameHeight}`;
}

function frameThumbUrl(frame) {
  return adjustedFrameCanvas(frame).toDataURL("image/png");
}

function renderFrameList() {
  els.frameList.innerHTML = "";
  if (!state.frames.length) {
    const empty = document.createElement("div");
    empty.className = "frame-list-empty";
    empty.textContent = "载入图片后，帧会显示在这里。";
    els.frameList.append(empty);
    return;
  }

  state.frames.forEach((frame, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `frame-order-card${index === state.activeIndex ? " is-active" : ""}`;
    card.draggable = true;
    card.dataset.index = String(index);
    card.title = "点击选择，按住拖动调整顺序";

    const order = document.createElement("span");
    order.className = "frame-order-number";
    order.textContent = String(index + 1).padStart(2, "0");
    const image = document.createElement("img");
    image.src = frameThumbUrl(frame);
    image.alt = "";
    const name = document.createElement("span");
    name.className = "frame-order-name";
    name.textContent = frame.name;
    const offset = document.createElement("span");
    offset.className = "frame-order-offset";
    const transform = normalizedTransform(frame);
    offset.textContent = frameSummary(transform);
    const grip = document.createElement("span");
    grip.className = "frame-order-grip";
    grip.textContent = "⋮⋮";
    grip.setAttribute("aria-hidden", "true");

    card.append(order, image, name, offset, grip);
    card.addEventListener("click", () => selectFrame(index));
    card.addEventListener("dragstart", (event) => {
      state.reorderFrom = index;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.add("is-drop-target");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      reorderFrame(state.reorderFrom, index);
    });
    card.addEventListener("dragend", () => {
      state.reorderFrom = null;
      document.querySelectorAll(".frame-order-card").forEach((item) => item.classList.remove("is-dragging", "is-drop-target"));
    });
    els.frameList.append(card);
  });
}

function selectFrame(index, stop = true) {
  if (!state.frames.length) return;
  if (stop) stopPlayback();
  state.activeIndex = (index + state.frames.length) % state.frames.length;
  syncInspector();
  renderFrameList();
  drawPreview();
  const card = els.frameList.querySelector(`[data-index="${state.activeIndex}"]`);
  card?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function reorderFrame(from, to) {
  if (from === null || from === to || !state.frames[from] || !state.frames[to]) return;
  stopPlayback();
  const activeId = activeFrame()?.id;
  const [moved] = state.frames.splice(from, 1);
  state.frames.splice(to, 0, moved);
  state.activeIndex = Math.max(0, state.frames.findIndex((frame) => frame.id === activeId));
  renderFrameList();
  syncInspector();
  drawPreview();
}

function setCurrentTransform(next) {
  const frame = activeFrame();
  if (!frame) return;
  const transform = normalizedTransform(frame);
  frame.transform = {
    x: Math.round(next.x ?? transform.x),
    y: Math.round(next.y ?? transform.y),
    scaleX: clamp(Number(next.scaleX ?? transform.scaleX) || 1, 0.1, 4),
    scaleY: clamp(Number(next.scaleY ?? transform.scaleY) || 1, 0.1, 4),
    rotation: normalizeRotation(next.rotation ?? transform.rotation),
  };
  syncInspector();
  drawPreview();
  const card = els.frameList.querySelector(`[data-index="${state.activeIndex}"]`);
  if (card) {
    card.querySelector("img").src = frameThumbUrl(frame);
    const updated = normalizedTransform(frame);
    card.querySelector(".frame-order-offset").textContent = frameSummary(updated);
  }
}

function frameSummary(transform) {
  const sx = Math.round(transform.scaleX * 100);
  const sy = Math.round(transform.scaleY * 100);
  return `x ${transform.x} · y ${transform.y} · 宽 ${sx}% · 高 ${sy}% · ${Math.round(transform.rotation)}°`;
}

function resetCurrentFrame() {
  const frame = activeFrame();
  if (!frame) return;
  frame.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  syncInspector();
  drawPreview();
  renderFrameList();
}

function resetAllFrames() {
  stopPlayback();
  for (const frame of state.frames) {
    frame.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  }
  renderFrameList();
  syncInspector();
  drawPreview();
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png"));
}

async function downloadCanvas(canvas, filename) {
  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportSheet() {
  if (!state.frames.length) return;
  const cols = clamp(Number(els.exportColsInput.value) || 1, 1, Math.min(64, state.frames.length));
  els.exportColsInput.value = cols;
  const rows = Math.ceil(state.frames.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = state.frameWidth * cols;
  canvas.height = state.frameHeight * rows;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  state.frames.forEach((frame, index) => {
    ctx.drawImage(adjustedFrameCanvas(frame), (index % cols) * state.frameWidth, Math.floor(index / cols) * state.frameHeight);
  });
  await downloadCanvas(canvas, `${state.sourceName}_adjusted.png`);
}

async function exportCurrentFrame() {
  const frame = activeFrame();
  if (!frame) return;
  await downloadCanvas(adjustedFrameCanvas(frame), `${state.sourceName}_${String(state.activeIndex + 1).padStart(2, "0")}.png`);
}

function previewPoint(event) {
  const rect = els.previewCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (els.previewCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.previewCanvas.height / rect.height),
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b) {
  return (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI;
}

function localDeltaFromCenter(center, point) {
  const transform = normalizedTransform(activeFrame());
  const angle = (-transform.rotation * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: (dx * Math.cos(angle)) - (dy * Math.sin(angle)),
    y: (dx * Math.sin(angle)) + (dy * Math.cos(angle)),
  };
}

function dragScaleChange(handle, center, start, current) {
  const startLocal = localDeltaFromCenter(center, start);
  const currentLocal = localDeltaFromCenter(center, current);
  const affectsX = handle.includes("e") || handle.includes("w");
  const affectsY = handle.includes("n") || handle.includes("s");
  const directionX = handle.includes("w") ? -1 : 1;
  const directionY = handle.includes("n") ? -1 : 1;
  const minDistance = 4 * (window.devicePixelRatio || 1);
  const baseX = Math.max(minDistance, Math.abs(startLocal.x));
  const baseY = Math.max(minDistance, Math.abs(startLocal.y));
  const x = affectsX ? clamp((currentLocal.x * directionX) / baseX, 0.1, 4) : 1;
  const y = affectsY ? clamp((currentLocal.y * directionY) / baseY, 0.1, 4) : 1;
  if (affectsX && affectsY) {
    const uniform = Math.abs(x - 1) > Math.abs(y - 1) ? x : y;
    return { x: uniform, y: uniform };
  }
  return {
    x,
    y,
  };
}

function hitPreviewControl(point) {
  const geometry = previewGeometry(activeFrame());
  if (!geometry) return { mode: "move" };
  const dpr = window.devicePixelRatio || 1;
  const handleRadius = 10 * dpr;
  const rotateRadius = 13 * dpr;
  for (const handle of geometry.handles) {
    if (distance(point, handle) <= handleRadius) return { mode: "scale", handle: handle.name, geometry };
  }
  if (distance(point, geometry.rotatePoint) <= rotateRadius) return { mode: "rotate", geometry };
  return { mode: "move", geometry };
}

function cursorForHit(hit) {
  if (hit.mode === "rotate") return "grab";
  if (hit.mode !== "scale") return "grab";
  if (hit.handle === "n" || hit.handle === "s") return "ns-resize";
  if (hit.handle === "e" || hit.handle === "w") return "ew-resize";
  if (hit.handle === "ne" || hit.handle === "sw") return "nesw-resize";
  return "nwse-resize";
}

function handleArrowKey(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !activeFrame()) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  event.preventDefault();
  stopPlayback();
  const step = event.shiftKey ? 10 : 1;
  const transform = normalizedTransform(activeFrame());
  setCurrentTransform({
    x: transform.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
    y: transform.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
  });
}

els.sheetInput.addEventListener("change", (event) => loadSingleSheet(event.target.files[0]));
els.framesInput.addEventListener("change", (event) => loadMultipleFrames(event.target.files));
els.resplitBtn.addEventListener("click", splitSourceSheet);
els.playBtn.addEventListener("click", togglePlayback);
els.previousBtn.addEventListener("click", () => selectFrame(state.activeIndex - 1));
els.nextBtn.addEventListener("click", () => selectFrame(state.activeIndex + 1));
els.fpsInput.addEventListener("change", () => { if (state.playing) startPlayback(); });
els.resetFrameBtn.addEventListener("click", resetCurrentFrame);
els.resetAllBtn.addEventListener("click", resetAllFrames);
els.exportSheetBtn.addEventListener("click", exportSheet);
els.exportCurrentBtn.addEventListener("click", exportCurrentFrame);

for (const input of [els.offsetXInput, els.offsetYInput, els.scaleXInput, els.scaleYInput, els.rotationInput]) {
  input.addEventListener("input", () => setCurrentTransform({
    x: Number(els.offsetXInput.value) || 0,
    y: Number(els.offsetYInput.value) || 0,
    scaleX: clamp((Number(els.scaleXInput.value) || 100) / 100, 0.1, 4),
    scaleY: clamp((Number(els.scaleYInput.value) || 100) / 100, 0.1, 4),
    rotation: normalizeRotation(Number(els.rotationInput.value) || 0),
  }));
}

els.previewCanvas.addEventListener("pointerdown", (event) => {
  const frame = activeFrame();
  if (!frame || !state.drawRect) return;
  stopPlayback();
  const point = previewPoint(event);
  const hit = hitPreviewControl(point);
  state.drag = {
    mode: hit.mode,
    start: point,
    transform: { ...normalizedTransform(frame) },
    center: hit.geometry?.center || null,
    handle: hit.handle || "",
    startDistance: hit.geometry?.center ? distance(point, hit.geometry.center) : 0,
    startAngle: hit.geometry?.center ? angleBetween(hit.geometry.center, point) : 0,
  };
  els.previewCanvas.setPointerCapture(event.pointerId);
  els.previewCanvas.classList.add("is-dragging");
});

els.previewCanvas.addEventListener("pointermove", (event) => {
  const point = previewPoint(event);
  if (!state.drag || !state.drawRect) {
    const hit = hitPreviewControl(point);
    els.previewCanvas.style.cursor = cursorForHit(hit);
    return;
  }

  if (state.drag.mode === "scale" && state.drag.center && state.drag.startDistance > 0) {
    const scaleChange = dragScaleChange(state.drag.handle, state.drag.center, state.drag.start, point);
    setCurrentTransform({
      scaleX: state.drag.transform.scaleX * scaleChange.x,
      scaleY: state.drag.transform.scaleY * scaleChange.y,
    });
    return;
  }

  if (state.drag.mode === "rotate" && state.drag.center) {
    const delta = angleBetween(state.drag.center, point) - state.drag.startAngle;
    setCurrentTransform({ rotation: state.drag.transform.rotation + delta });
    return;
  }

  setCurrentTransform({
    x: state.drag.transform.x + (point.x - state.drag.start.x) / state.drawRect.scale,
    y: state.drag.transform.y + (point.y - state.drag.start.y) / state.drawRect.scale,
  });
});

function endPreviewDrag() {
  state.drag = null;
  els.previewCanvas.classList.remove("is-dragging");
  els.previewCanvas.style.cursor = "";
}

els.previewCanvas.addEventListener("pointerup", endPreviewDrag);
els.previewCanvas.addEventListener("pointercancel", endPreviewDrag);

els.previewStage.addEventListener("dragover", (event) => {
  if ([...event.dataTransfer.types].includes("Files")) {
    event.preventDefault();
    els.previewStage.classList.add("dragover");
  }
});
els.previewStage.addEventListener("dragleave", () => els.previewStage.classList.remove("dragover"));
els.previewStage.addEventListener("drop", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  els.previewStage.classList.remove("dragover");
  const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
  if (files.length === 1) loadSingleSheet(files[0]);
  else loadMultipleFrames(files);
});

window.addEventListener("keydown", handleArrowKey);
window.addEventListener("resize", drawPreview);
window.addEventListener("beforeunload", stopPlayback);
setControlsEnabled(false);
drawPreview();
