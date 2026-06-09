"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  imageInput: $("imageInput"),
  imageDropZone: $("imageDropZone"),
  imageEmptyState: $("imageEmptyState"),
  imagePath: $("imagePath"),
  imageInfo: $("imageInfo"),
  sourceCanvas: $("sourceCanvas"),
  previewSourceCanvas: document.createElement("canvas"),
  resultCanvas: $("resultCanvas"),
  protectCanvas: $("protectCanvas"),
  alphaCanvas: $("alphaCanvas"),
  previewBgInput: $("previewBgInput"),
  previewModeButtons: Array.from(document.querySelectorAll("[data-preview-mode]")),
  modeInput: $("modeInput"),
  bgColorInput: $("bgColorInput2"),
  sampleColorBtn: $("sampleColorBtn"),
  toleranceInput: $("toleranceInput2"),
  softnessInput: $("softnessInput2"),
  lumaThresholdInput: $("lumaThresholdInput2"),
  lumaSoftnessInput: $("lumaSoftnessInput2"),
  alphaCutInput: $("alphaCutInput2"),
  alphaGrowInput: $("alphaGrowInput2"),
  alphaFeatherInput: $("alphaFeatherInput2"),
  despillInput: $("despillInput2"),
  edgeCleanInput: $("edgeCleanInput2"),
  transparentCleanInput: $("transparentCleanInput2"),
  resetBtn: $("resetBtn"),
  fileNameInput: $("fileNameInput"),
  exportBtn: $("exportBtn"),
  downloadAlphaBtn: $("downloadAlphaBtn"),
};

const sourceCtx = els.sourceCanvas.getContext("2d", { willReadFrequently: true });
const resultCtx = els.resultCanvas.getContext("2d", { willReadFrequently: true });
const alphaCtx = els.alphaCanvas.getContext("2d", { willReadFrequently: true });

const state = {
  image: null,
  imageUrl: "",
  sourceName: "SmileMatting",
  sampling: false,
  raf: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  dragStart: null,
  dragMoved: false,
  previewMode: "checker",
  protectMask: null,
  protectCount: 0,
  processTimer: 0,
  processing: false,
  pendingProcess: false,
  outputImage: null,
  alphaImage: null,
};

const previewSourceCtx = els.previewSourceCanvas.getContext("2d", { willReadFrequently: true });
const MAX_PREVIEW_PIXELS = 900000;

const defaults = {
  modeInput: "color",
  bgColorInput: "#12c91d",
  previewBgInput: "#111827",
  toleranceInput: 28,
  softnessInput: 36,
  lumaThresholdInput: 35,
  lumaSoftnessInput: 55,
  alphaCutInput: 8,
  alphaGrowInput: 0,
  alphaFeatherInput: 1,
  despillInput: 25,
  edgeCleanInput: 35,
  transparentCleanInput: 80,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const trimExtension = (name) => name.replace(/\.[^.]+$/, "");

function safeFileName(name, fallback = "SmileMatting") {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/[. ]+$/g, "");
  return cleaned || fallback;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function settings() {
  return {
    mode: els.modeInput.value,
    bg: hexToRgb(els.bgColorInput.value),
    tolerance: Number(els.toleranceInput.value),
    softness: Number(els.softnessInput.value),
    lumaThreshold: Number(els.lumaThresholdInput.value),
    lumaSoftness: Number(els.lumaSoftnessInput.value),
    alphaCut: Number(els.alphaCutInput.value),
    alphaGrow: Number(els.alphaGrowInput.value),
    alphaFeather: Number(els.alphaFeatherInput.value),
    despill: Number(els.despillInput.value) / 100,
    edgeClean: Number(els.edgeCleanInput.value) / 100,
    transparentClean: Number(els.transparentCleanInput.value) / 100,
  };
}

function updateOutputs() {
  for (const id of [
    "tolerance",
    "softness",
    "lumaThreshold",
    "lumaSoftness",
    "alphaCut",
    "alphaGrow",
    "alphaFeather",
    "despill",
    "edgeClean",
    "transparentClean",
  ]) {
    $(`${id}Value2`).textContent = $(`${id}Input2`).value;
  }
  updateModeFields();
  scheduleProcess();
}

function updateModeFields() {
  const modeGroup = els.modeInput.value === "color" ? "color" : "luma";
  for (const label of document.querySelectorAll("[data-mode]")) {
    label.classList.toggle("is-hidden", !label.dataset.mode.split(/\s+/).includes(modeGroup));
  }
  els.sampleColorBtn.disabled = modeGroup !== "color";
  els.sampleColorBtn.classList.toggle("is-active", state.sampling);
  els.sampleColorBtn.textContent = state.sampling ? "点击预览取样" : "从图片取样";
}

function resetSettings() {
  for (const [id, value] of Object.entries(defaults)) {
    els[id].value = value;
  }
  state.sampling = false;
  setPreviewMode("checker");
  updateOutputs();
}

function setCanvasSize(width, height) {
  for (const canvas of [els.sourceCanvas, els.resultCanvas, els.protectCanvas, els.alphaCanvas]) {
    canvas.width = width;
    canvas.height = height;
  }
  const scale = Math.min(1, Math.sqrt(MAX_PREVIEW_PIXELS / Math.max(1, width * height)));
  els.previewSourceCanvas.width = Math.max(1, Math.round(width * scale));
  els.previewSourceCanvas.height = Math.max(1, Math.round(height * scale));
}

function setImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.sourceName = safeFileName(trimExtension(file.name), "SmileMatting");
    els.fileNameInput.value = `${state.sourceName}_matte`;
    els.imagePath.textContent = file.webkitRelativePath || file.name;
    els.imageInfo.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
    setCanvasSize(img.naturalWidth, img.naturalHeight);
    sourceCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    sourceCtx.drawImage(img, 0, 0);
    state.protectMask = new Uint8Array(img.naturalWidth * img.naturalHeight);
    state.protectCount = 0;
    previewSourceCtx.imageSmoothingEnabled = true;
    previewSourceCtx.clearRect(0, 0, els.previewSourceCanvas.width, els.previewSourceCanvas.height);
    previewSourceCtx.drawImage(img, 0, 0, els.previewSourceCanvas.width, els.previewSourceCanvas.height);
    els.resultCanvas.classList.remove("is-hidden");
    els.protectCanvas.classList.remove("hidden-canvas");
    els.imageEmptyState.style.display = "none";
    fitPreviewToWindow();
    scheduleProcess();
  };
  img.src = state.imageUrl;
}

function fitPreviewToWindow() {
  if (!state.image) return;
  const rect = els.imageDropZone.getBoundingClientRect();
  const fit = Math.min(
    (rect.width - 24) / els.previewSourceCanvas.width,
    (rect.height - 24) / els.previewSourceCanvas.height,
    1
  );
  state.zoom = clamp(fit || 1, 0.05, 8);
  state.panX = 0;
  state.panY = 0;
  applyPreviewZoom();
}

function applyPreviewZoom() {
  if (!state.image) return;
  els.resultCanvas.style.width = `${els.previewSourceCanvas.width}px`;
  els.resultCanvas.style.height = `${els.previewSourceCanvas.height}px`;
  els.resultCanvas.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  els.protectCanvas.style.width = `${els.previewSourceCanvas.width}px`;
  els.protectCanvas.style.height = `${els.previewSourceCanvas.height}px`;
  els.protectCanvas.style.transform = els.resultCanvas.style.transform;
}

function scheduleProcess(delay = 120) {
  state.pendingProcess = true;
  if (state.processTimer) window.clearTimeout(state.processTimer);
  state.processTimer = window.setTimeout(() => {
    state.processTimer = 0;
    if (state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      processImage();
    });
  }, delay);
}

function processImage() {
  if (!state.image) {
    clearCanvases();
    return;
  }
  if (state.processing) {
    state.pendingProcess = true;
    return;
  }
  state.processing = true;
  state.pendingProcess = false;
  const image = makeMattedImage({ preview: true });
  els.resultCanvas.width = image.width;
  els.resultCanvas.height = image.height;
  els.protectCanvas.width = image.width;
  els.protectCanvas.height = image.height;
  els.alphaCanvas.width = image.width;
  els.alphaCanvas.height = image.height;
  applyPreviewZoom();
  state.outputImage = image;
  state.alphaImage = makeAlphaImage(image);
  alphaCtx.putImageData(state.alphaImage, 0, 0);
  drawPreview();
  drawProtectOverlay();
  state.processing = false;
  if (state.pendingProcess) scheduleProcess(60);
}

function drawPreview() {
  const width = els.resultCanvas.width;
  const height = els.resultCanvas.height;
  resultCtx.clearRect(0, 0, width, height);

  if (state.previewMode === "alpha") {
    if (state.alphaImage) resultCtx.putImageData(state.alphaImage, 0, 0);
    return;
  }

  if (state.previewMode === "solid") {
    resultCtx.fillStyle = els.previewBgInput.value;
    resultCtx.fillRect(0, 0, width, height);
  } else {
    drawChecker(resultCtx, width, height);
  }
  if (state.outputImage) drawImageData(resultCtx, state.outputImage);
}

function drawChecker(ctx, width, height) {
  const size = 20;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 ? "#203955" : "#132941";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawImageData(ctx, image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").putImageData(image, 0, 0);
  ctx.drawImage(canvas, 0, 0);
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  for (const button of els.previewModeButtons) {
    button.classList.toggle("is-active", button.dataset.previewMode === mode);
  }
  els.previewBgInput.classList.toggle("is-hidden", mode !== "solid");
  drawPreview();
}

function makeMattedImage(optionsOverride = {}) {
  const sourceCanvas = optionsOverride.preview ? els.previewSourceCanvas : els.sourceCanvas;
  const sourceContext = optionsOverride.preview ? previewSourceCtx : sourceCtx;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const sourceImage = sourceContext.getImageData(0, 0, width, height);
  const image = sourceContext.getImageData(0, 0, width, height);
  const data = image.data;
  const sourceData = sourceImage.data;
  const options = settings();
  const softEnd = options.tolerance + Math.max(1, options.softness);

  for (let i = 0; i < data.length; i += 4) {
    let alpha = data[i + 3];
    let dist = 255;
    if (options.mode === "color") {
      const dr = data[i] - options.bg.r;
      const dg = data[i + 1] - options.bg.g;
      const db = data[i + 2] - options.bg.b;
      dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= options.tolerance) alpha = 0;
      else if (dist < softEnd) alpha = ((dist - options.tolerance) / Math.max(1, options.softness)) * 255;
    } else {
      alpha = lumaAlpha(data, i, options);
    }

    data[i + 3] = alpha < options.alphaCut ? 0 : Math.round(clamp(alpha, 0, 255));
    if (options.mode === "color" && data[i + 3] > 0 && options.despill > 0) {
      despillPixel(data, i, options, dist);
    }
  }

  if (options.alphaGrow !== 0) morphAlpha(data, width, height, options.alphaGrow);
  if (options.alphaFeather > 0) featherAlpha(data, width, height, options.alphaFeather);
  if (options.edgeClean > 0) cleanEdgeColor(data, width, height, options.edgeClean);
  if (options.transparentClean > 0) cleanTransparentPixels(data, options.alphaCut, options.transparentClean);
  applyProtectMask(data, sourceData, width, height, optionsOverride.preview);
  return image;
}

function applyProtectMask(data, sourceData, width, height, preview = false) {
  if (!state.protectMask || !state.protectCount) return;
  for (let p = 0; p < width * height; p++) {
    const maskIndex = preview ? previewToSourceIndex(p, width, height) : p;
    if (!state.protectMask[maskIndex]) continue;
    const i = p * 4;
    data[i] = sourceData[i];
    data[i + 1] = sourceData[i + 1];
    data[i + 2] = sourceData[i + 2];
    data[i + 3] = Math.max(sourceData[i + 3], 255);
  }
}

function previewToSourceIndex(index, previewWidth, previewHeight) {
  const x = index % previewWidth;
  const y = Math.floor(index / previewWidth);
  const sx = Math.min(els.sourceCanvas.width - 1, Math.floor((x / previewWidth) * els.sourceCanvas.width));
  const sy = Math.min(els.sourceCanvas.height - 1, Math.floor((y / previewHeight) * els.sourceCanvas.height));
  return sy * els.sourceCanvas.width + sx;
}

function drawProtectOverlay() {
  const canvas = els.protectCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.protectMask || !state.protectCount) return;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let p = 0; p < canvas.width * canvas.height; p++) {
    if (!state.protectMask[previewToSourceIndex(p, canvas.width, canvas.height)]) continue;
    const i = p * 4;
    image.data[i] = 25;
    image.data[i + 1] = 190;
    image.data[i + 2] = 255;
    image.data[i + 3] = 72;
  }
  ctx.putImageData(image, 0, 0);
}

function makeAlphaImage(image) {
  const alphaImage = alphaCtx.createImageData(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const a = image.data[i + 3];
    alphaImage.data[i] = a;
    alphaImage.data[i + 1] = a;
    alphaImage.data[i + 2] = a;
    alphaImage.data[i + 3] = 255;
  }
  return alphaImage;
}

function clearCanvases() {
  for (const canvas of [els.resultCanvas, els.alphaCanvas]) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }
}

function lumaAlpha(data, i, options) {
  const luma = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  const soft = Math.max(1, options.lumaSoftness);
  const keep = options.mode === "luma-black"
    ? (luma - options.lumaThreshold) / soft
    : (255 - luma - options.lumaThreshold) / soft;
  return clamp(keep, 0, 1) * 255;
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

function sampleCanvasColor(event) {
  if (!state.image || !state.sampling) return;
  const point = eventToImagePoint(event);
  if (!point) return;
  const pixel = sourceCtx.getImageData(
    point.x,
    point.y,
    1,
    1
  ).data;
  els.bgColorInput.value = rgbToHex(pixel[0], pixel[1], pixel[2]);
  state.sampling = false;
  updateOutputs();
}

function eventToImagePoint(event) {
  if (!state.image) return null;
  const rect = els.resultCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * els.sourceCanvas.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * els.sourceCanvas.height);
  if (x < 0 || y < 0 || x >= els.sourceCanvas.width || y >= els.sourceCanvas.height) return null;
  return { x, y };
}

function toggleProtectedComponent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!state.image || state.sampling) return;
  const point = eventToImagePoint(event);
  if (!point) return;
  const width = els.sourceCanvas.width;
  const height = els.sourceCanvas.height;
  const start = point.y * width + point.x;
  if (!state.protectMask || state.protectMask.length !== width * height) {
    state.protectMask = new Uint8Array(width * height);
    state.protectCount = 0;
  }

  if (state.protectMask[start]) {
    removeProtectedComponent(start, width, height);
    scheduleProcess();
    return;
  }

  const probe = makeMattedImage();
  let region = connectedAlphaRegion(probe.data, width, height, start, Math.max(1, Number(els.alphaCutInput.value)));
  if (!region.length) {
    region = connectedSourceRegion(width, height, start);
  }
  if (!region.length) return;
  for (const index of fillRegionHoles(region, width, height)) {
    if (!state.protectMask[index]) state.protectCount++;
    state.protectMask[index] = 1;
  }
  scheduleProcess();
}

function connectedSourceRegion(width, height, start) {
  const source = sourceCtx.getImageData(0, 0, width, height).data;
  const startIndex = start * 4;
  const sr = source[startIndex];
  const sg = source[startIndex + 1];
  const sb = source[startIndex + 2];
  const visited = new Uint8Array(width * height);
  const region = [];
  const stack = [start];
  visited[start] = 1;
  const tolerance = 38;

  while (stack.length) {
    const index = stack.pop();
    region.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    for (const next of neighborIndexes(x, y, width, height)) {
      if (visited[next]) continue;
      const i = next * 4;
      const dr = source[i] - sr;
      const dg = source[i + 1] - sg;
      const db = source[i + 2] - sb;
      if (Math.sqrt(dr * dr + dg * dg + db * db) > tolerance) continue;
      visited[next] = 1;
      stack.push(next);
    }
  }
  return region.length >= 2 ? region : [];
}

function removeProtectedComponent(start, width, height) {
  const stack = [start];
  state.protectMask[start] = 0;
  state.protectCount = Math.max(0, state.protectCount - 1);
  while (stack.length) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    for (const next of neighborIndexes(x, y, width, height)) {
      if (!state.protectMask[next]) continue;
      state.protectMask[next] = 0;
      state.protectCount = Math.max(0, state.protectCount - 1);
      stack.push(next);
    }
  }
}

function connectedAlphaRegion(data, width, height, start, alphaCut) {
  if (data[start * 4 + 3] <= alphaCut) return [];
  const visited = new Uint8Array(width * height);
  const region = [];
  const stack = [start];
  visited[start] = 1;

  while (stack.length) {
    const index = stack.pop();
    region.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    for (const next of neighborIndexes(x, y, width, height)) {
      if (visited[next] || data[next * 4 + 3] <= alphaCut) continue;
      visited[next] = 1;
      stack.push(next);
    }
  }
  return region;
}

function fillRegionHoles(region, width, height) {
  const inRegion = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const index of region) {
    inRegion[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(width - 1, maxX + 1);
  maxY = Math.min(height - 1, maxY + 1);

  const outside = new Uint8Array(width * height);
  const stack = [];
  for (let x = minX; x <= maxX; x++) {
    stackBoundary(x, minY);
    stackBoundary(x, maxY);
  }
  for (let y = minY; y <= maxY; y++) {
    stackBoundary(minX, y);
    stackBoundary(maxX, y);
  }

  function stackBoundary(x, y) {
    const index = y * width + x;
    if (inRegion[index] || outside[index]) return;
    outside[index] = 1;
    stack.push(index);
  }

  while (stack.length) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    for (const next of neighborIndexes(x, y, width, height)) {
      const nx = next % width;
      const ny = Math.floor(next / width);
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      if (inRegion[next] || outside[next]) continue;
      outside[next] = 1;
      stack.push(next);
    }
  }

  const filled = region.slice();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const index = y * width + x;
      if (!inRegion[index] && !outside[index]) filled.push(index);
    }
  }
  return filled;
}

function neighborIndexes(x, y, width, height) {
  const indexes = [];
  if (x > 0) indexes.push(y * width + x - 1);
  if (x < width - 1) indexes.push(y * width + x + 1);
  if (y > 0) indexes.push((y - 1) * width + x);
  if (y < height - 1) indexes.push((y + 1) * width + x);
  return indexes;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function downloadCanvas(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function makeOutputCanvas() {
  const image = makeMattedImage();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas;
}

function makeAlphaCanvas() {
  const image = makeAlphaImage(makeMattedImage());
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas;
}

function exportResult() {
  if (!state.image) return;
  downloadCanvas(makeOutputCanvas(), `${safeFileName(els.fileNameInput.value)}.png`);
}

function exportAlpha() {
  if (!state.image) return;
  downloadCanvas(makeAlphaCanvas(), `${safeFileName(els.fileNameInput.value)}_alpha.png`);
}

els.imageInput.addEventListener("change", (event) => setImageFile(event.target.files[0]));
els.imageDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.imageDropZone.classList.add("dragover");
});
els.imageDropZone.addEventListener("dragleave", () => els.imageDropZone.classList.remove("dragover"));
els.imageDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.imageDropZone.classList.remove("dragover");
  setImageFile(event.dataTransfer.files[0]);
});
els.resultCanvas.addEventListener("click", sampleCanvasColor);
els.resultCanvas.addEventListener("dblclick", toggleProtectedComponent);
els.imageDropZone.addEventListener("dblclick", toggleProtectedComponent);
els.imageDropZone.addEventListener("wheel", (event) => {
  if (!state.image) return;
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  state.zoom = clamp(state.zoom * (direction > 0 ? 1.12 : 0.88), 0.05, 8);
  applyPreviewZoom();
}, { passive: false });
els.imageDropZone.addEventListener("pointerdown", (event) => {
  if (!state.image || state.sampling || event.detail >= 2) return;
  state.dragging = true;
  state.dragMoved = false;
  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    panX: state.panX,
    panY: state.panY,
  };
  els.imageDropZone.setPointerCapture(event.pointerId);
  els.imageDropZone.classList.add("is-panning");
});
els.imageDropZone.addEventListener("pointermove", (event) => {
  if (!state.dragging || !state.dragStart) return;
  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  if (!state.dragMoved && Math.hypot(dx, dy) < 5) return;
  state.dragMoved = true;
  state.panX = state.dragStart.panX + dx;
  state.panY = state.dragStart.panY + dy;
  applyPreviewZoom();
});
els.imageDropZone.addEventListener("pointerup", (event) => {
  if (!state.dragging) return;
  state.dragging = false;
  state.dragStart = null;
  els.imageDropZone.releasePointerCapture(event.pointerId);
  els.imageDropZone.classList.remove("is-panning");
});
els.imageDropZone.addEventListener("pointercancel", () => {
  state.dragging = false;
  state.dragStart = null;
  els.imageDropZone.classList.remove("is-panning");
});
els.sampleColorBtn.addEventListener("click", () => {
  state.sampling = !state.sampling;
  updateModeFields();
});
els.resetBtn.addEventListener("click", resetSettings);
els.exportBtn.addEventListener("click", exportResult);
els.downloadAlphaBtn.addEventListener("click", exportAlpha);
for (const button of els.previewModeButtons) {
  button.addEventListener("click", () => setPreviewMode(button.dataset.previewMode));
}

for (const input of document.querySelectorAll("input, select")) {
  if (input.type === "file" || input.id === "fileNameInput") continue;
  input.addEventListener("input", updateOutputs);
}

resetSettings();
