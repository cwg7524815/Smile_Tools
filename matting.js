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
  maskToolButtons: Array.from(document.querySelectorAll("[data-mask-tool]")),
  brushSizeInput: $("brushSizeInput2"),
  brushSizeValue: $("brushSizeValue2"),
  clearPaintMasksBtn: $("clearPaintMasksBtn"),
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
  savePresetBtn: $("savePresetBtn"),
  deletePresetBtn: $("deletePresetBtn"),
  fileNameInput: $("fileNameInput"),
  partMinPixelsInput: $("partMinPixelsInput"),
  exportBtn: $("exportBtn"),
  exportPartsBtn: $("exportPartsBtn"),
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
  maskTool: "none",
  maskPainting: false,
  lastMaskPoint: null,
  protectMask: null,
  protectCount: 0,
  eraseMask: null,
  eraseCount: 0,
  processTimer: 0,
  processing: false,
  pendingProcess: false,
  outputImage: null,
  alphaImage: null,
};

const previewSourceCtx = els.previewSourceCanvas.getContext("2d", { willReadFrequently: true });
const MAX_PREVIEW_PIXELS = 900000;
const PRESET_STORAGE_KEY = "SmileMattingUserPresetsV1";
const BUILT_IN_MODES = new Set(["color", "luma-black", "luma-white"]);
const PRESET_FIELD_IDS = [
  "modeInput",
  "bgColorInput",
  "previewBgInput",
  "toleranceInput",
  "softnessInput",
  "lumaThresholdInput",
  "lumaSoftnessInput",
  "alphaCutInput",
  "alphaGrowInput",
  "alphaFeatherInput",
  "despillInput",
  "edgeCleanInput",
  "transparentCleanInput",
  "partMinPixelsInput",
];

const PARAMETER_CONTROL_IDS = [
  "modeInput",
  "bgColorInput",
  "previewBgInput",
  "sampleColorBtn",
  "toleranceInput",
  "softnessInput",
  "lumaThresholdInput",
  "lumaSoftnessInput",
  "alphaCutInput",
  "alphaGrowInput",
  "alphaFeatherInput",
  "despillInput",
  "edgeCleanInput",
  "transparentCleanInput",
  "partMinPixelsInput",
  "resetBtn",
  "savePresetBtn",
  "deletePresetBtn",
  "fileNameInput",
  "exportBtn",
  "exportPartsBtn",
  "downloadAlphaBtn",
  "brushSizeInput",
  "clearPaintMasksBtn",
];

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
  partMinPixelsInput: 25,
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
    mode: currentMattingMode(),
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
  const modeGroup = currentMattingMode() === "color" ? "color" : "luma";
  for (const label of document.querySelectorAll("[data-mode]")) {
    label.classList.toggle("is-hidden", !label.dataset.mode.split(/\s+/).includes(modeGroup));
  }
  els.sampleColorBtn.disabled = !state.image || modeGroup !== "color";
  els.sampleColorBtn.classList.toggle("is-active", state.sampling);
  els.sampleColorBtn.textContent = state.sampling ? "点击预览取样" : "从图片取样";
  updatePresetActions();
}

function resetSettings() {
  for (const [id, value] of Object.entries(defaults)) {
    els[id].value = value;
  }
  state.sampling = false;
  setPreviewMode("checker");
  setMaskToolSelection("none");
  updateOutputs();
}

function setParameterControlsEnabled(enabled) {
  for (const id of PARAMETER_CONTROL_IDS) {
    if (!els[id]) continue;
    els[id].disabled = !enabled;
  }
  for (const button of els.previewModeButtons) button.disabled = !enabled;
  for (const button of els.maskToolButtons) button.disabled = !enabled;
  updateModeFields();
}

function currentMattingMode() {
  const option = els.modeInput.selectedOptions[0];
  return option?.dataset.mode || els.modeInput.value;
}

function selectedPresetId() {
  return els.modeInput.selectedOptions[0]?.dataset.presetId || "";
}

function loadUserPresets() {
  try {
    const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "[]");
    return Array.isArray(presets) ? presets.filter((preset) => preset && preset.id && preset.name && preset.values) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function renderPresetOptions(selectedValue = els.modeInput.value) {
  for (const group of Array.from(els.modeInput.querySelectorAll("[data-preset-group]"))) {
    group.remove();
  }
  const presets = loadUserPresets();
  if (presets.length) {
    const group = document.createElement("optgroup");
    group.label = "用户预设";
    group.dataset.presetGroup = "user";
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = presetOptionValue(preset.id);
      option.textContent = preset.name;
      option.dataset.presetId = preset.id;
      option.dataset.mode = preset.values.modeInput || "color";
      group.append(option);
    }
    els.modeInput.append(group);
  }
  els.modeInput.value = selectedValue;
  if (!els.modeInput.value) els.modeInput.value = "color";
  updatePresetActions();
}

function presetOptionValue(id) {
  return `preset:${id}`;
}

function capturePresetValues() {
  const values = {};
  for (const id of PRESET_FIELD_IDS) {
    if (id === "modeInput") values[id] = currentMattingMode();
    else values[id] = els[id].value;
  }
  values.previewMode = state.previewMode;
  values.maskTool = state.maskTool;
  return values;
}

function applyPresetValues(values) {
  for (const id of PRESET_FIELD_IDS) {
    if (id === "modeInput" || !(id in values) || !els[id]) continue;
    els[id].value = values[id];
  }
  setPreviewMode(values.previewMode || "checker");
  setMaskToolSelection(values.maskTool || "none");
  updateOutputs();
}

function handleModeSelection() {
  const preset = loadUserPresets().find((item) => item.id === selectedPresetId());
  if (preset) {
    const option = els.modeInput.selectedOptions[0];
    if (option) option.dataset.mode = preset.values.modeInput || "color";
    applyPresetValues(preset.values);
    return;
  }
  updateOutputs();
}

function saveCurrentPreset() {
  const activePresetId = selectedPresetId();
  const presets = loadUserPresets();
  const activePreset = presets.find((preset) => preset.id === activePresetId);
  if (activePreset) {
    if (!confirm(`覆盖预设“${activePreset.name}”？`)) return;
    const preset = {
      ...activePreset,
      values: capturePresetValues(),
    };
    saveUserPresets(presets.map((item) => (item.id === activePreset.id ? preset : item)));
    renderPresetOptions(presetOptionValue(preset.id));
    updateModeFields();
    return;
  }

  const name = prompt("填写预设名字", "我的预设");
  if (!name || !name.trim()) return;

  const trimmedName = name.trim();
  const existing = presets.find((preset) => preset.name === trimmedName);
  if (existing && !confirm(`已存在预设“${trimmedName}”，是否覆盖？`)) return;
  const preset = {
    id: existing?.id || `preset-${Date.now()}`,
    name: trimmedName,
    values: capturePresetValues(),
  };

  const nextPresets = existing
    ? presets.map((item) => (item.id === existing.id ? preset : item))
    : [...presets, preset];
  saveUserPresets(nextPresets);
  renderPresetOptions(presetOptionValue(preset.id));
  updateModeFields();
}

function deleteCurrentPreset() {
  const activePresetId = selectedPresetId();
  if (!activePresetId) return;
  const presets = loadUserPresets();
  const activePreset = presets.find((preset) => preset.id === activePresetId);
  if (!activePreset) return;
  if (!confirm(`删除预设“${activePreset.name}”？`)) return;

  saveUserPresets(presets.filter((preset) => preset.id !== activePresetId));
  renderPresetOptions(activePreset.values.modeInput && BUILT_IN_MODES.has(activePreset.values.modeInput) ? activePreset.values.modeInput : "color");
  updateOutputs();
}

function updatePresetActions() {
  const customSelected = Boolean(selectedPresetId());
  els.deletePresetBtn.classList.toggle("is-hidden", !customSelected);
  els.deletePresetBtn.disabled = !state.image || !customSelected;
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
    setParameterControlsEnabled(true);
    state.sourceName = safeFileName(trimExtension(file.name), "SmileMatting");
    els.fileNameInput.value = `${state.sourceName}_matte`;
    els.imagePath.textContent = file.webkitRelativePath || file.name;
    els.imageInfo.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
    setCanvasSize(img.naturalWidth, img.naturalHeight);
    sourceCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    sourceCtx.drawImage(img, 0, 0);
    state.protectMask = new Uint8Array(img.naturalWidth * img.naturalHeight);
    state.protectCount = 0;
    state.eraseMask = new Uint8Array(img.naturalWidth * img.naturalHeight);
    state.eraseCount = 0;
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
  applyEraseMask(data, width, height, optionsOverride.preview);
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

function applyEraseMask(data, width, height, preview = false) {
  if (!state.eraseMask || !state.eraseCount) return;
  for (let p = 0; p < width * height; p++) {
    const maskIndex = preview ? previewToSourceIndex(p, width, height) : p;
    if (state.eraseMask[maskIndex]) data[p * 4 + 3] = 0;
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
  if ((!state.protectMask || !state.protectCount) && (!state.eraseMask || !state.eraseCount)) return;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let p = 0; p < canvas.width * canvas.height; p++) {
    const maskIndex = previewToSourceIndex(p, canvas.width, canvas.height);
    const i = p * 4;
    if (state.eraseMask && state.eraseMask[maskIndex]) {
      image.data[i] = 255;
      image.data[i + 1] = 62;
      image.data[i + 2] = 91;
      image.data[i + 3] = 96;
    } else if (state.protectMask && state.protectMask[maskIndex]) {
      image.data[i] = 25;
      image.data[i + 1] = 190;
      image.data[i + 2] = 255;
      image.data[i + 3] = 82;
    }
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

function setMaskTool(tool) {
  setMaskToolSelection(state.maskTool === tool ? "none" : tool);
}

function setMaskToolSelection(tool) {
  state.maskTool = ["protect", "erase"].includes(tool) ? tool : "none";
  state.maskPainting = false;
  state.lastMaskPoint = null;
  state.sampling = false;
  els.imageDropZone.classList.toggle("is-masking", state.maskTool !== "none");
  for (const button of els.maskToolButtons) {
    button.classList.toggle("is-active", button.dataset.maskTool === state.maskTool);
  }
  updateModeFields();
}

function ensurePaintMasks() {
  const size = els.sourceCanvas.width * els.sourceCanvas.height;
  if (!state.protectMask || state.protectMask.length !== size) {
    state.protectMask = new Uint8Array(size);
    state.protectCount = 0;
  }
  if (!state.eraseMask || state.eraseMask.length !== size) {
    state.eraseMask = new Uint8Array(size);
    state.eraseCount = 0;
  }
}

function paintMaskLine(point) {
  if (!point || state.maskTool === "none") return;
  ensurePaintMasks();
  const start = state.lastMaskPoint || point;
  const brushSize = Math.max(1, Number(els.brushSizeInput.value));
  const distance = Math.hypot(point.x - start.x, point.y - start.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, brushSize * 0.22)));
  for (let step = 0; step <= steps; step++) {
    const ratio = step / steps;
    stampMaskCircle(
      start.x + (point.x - start.x) * ratio,
      start.y + (point.y - start.y) * ratio,
      brushSize / 2
    );
  }
  state.lastMaskPoint = point;
  scheduleProcess(35);
}

function stampMaskCircle(centerX, centerY, radius) {
  const width = els.sourceCanvas.width;
  const height = els.sourceCanvas.height;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > radiusSquared) continue;
      const index = y * width + x;
      if (state.maskTool === "protect") {
        if (!state.protectMask[index]) state.protectCount++;
        state.protectMask[index] = 1;
        if (state.eraseMask[index]) {
          state.eraseMask[index] = 0;
          state.eraseCount--;
        }
      } else {
        if (!state.eraseMask[index]) state.eraseCount++;
        state.eraseMask[index] = 1;
        if (state.protectMask[index]) {
          state.protectMask[index] = 0;
          state.protectCount--;
        }
      }
    }
  }
}

function clearPaintMasks() {
  if (!state.image) return;
  ensurePaintMasks();
  state.protectMask.fill(0);
  state.eraseMask.fill(0);
  state.protectCount = 0;
  state.eraseCount = 0;
  scheduleProcess();
}

function toggleProtectedComponent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!state.image || state.sampling || state.maskTool !== "none") return;
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
    if (state.eraseMask && state.eraseMask[index]) {
      state.eraseMask[index] = 0;
      state.eraseCount--;
    }
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

function makeComponentCanvas(image, component) {
  const width = component.maxX - component.minX + 1;
  const height = component.maxY - component.minY + 1;
  const output = new ImageData(width, height);
  for (const sourceIndex of component.pixels) {
    const sx = sourceIndex % image.width;
    const sy = Math.floor(sourceIndex / image.width);
    const sourceOffset = sourceIndex * 4;
    const targetOffset = ((sy - component.minY) * width + (sx - component.minX)) * 4;
    output.data[targetOffset] = image.data[sourceOffset];
    output.data[targetOffset + 1] = image.data[sourceOffset + 1];
    output.data[targetOffset + 2] = image.data[sourceOffset + 2];
    output.data[targetOffset + 3] = image.data[sourceOffset + 3];
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(output, 0, 0);
  return canvas;
}

function findAlphaComponents(image, minAlpha = 1) {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] < minAlpha) continue;
    const stack = [start];
    const pixels = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    visited[start] = 1;

    while (stack.length) {
      const index = stack.pop();
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (x > 0) pushIfVisible(index - 1, stack);
      if (x < width - 1) pushIfVisible(index + 1, stack);
      if (y > 0) pushIfVisible(index - width, stack);
      if (y < height - 1) pushIfVisible(index + width, stack);
    }

    components.push({ pixels, minX, minY, maxX, maxY });
  }

  return sortComponentsForExport(components);

  function pushIfVisible(index, stack) {
    if (visited[index] || data[index * 4 + 3] < minAlpha) return;
    visited[index] = 1;
    stack.push(index);
  }
}

function sortComponentsForExport(components) {
  const heights = components
    .map((component) => component.maxY - component.minY + 1)
    .sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 32;
  const rowTolerance = Math.max(24, medianHeight * 0.9);
  const sortedByY = components.slice().sort((a, b) => (
    (componentCenterY(a) - componentCenterY(b)) || (a.minX - b.minX)
  ));
  const rows = [];

  for (const component of sortedByY) {
    const centerY = componentCenterY(component);
    const row = rows.find((candidate) => Math.abs(centerY - candidate.centerY) <= rowTolerance);
    if (row) {
      row.items.push(component);
      row.centerY = row.items.reduce((sum, item) => sum + componentCenterY(item), 0) / row.items.length;
    } else {
      rows.push({
        items: [component],
        centerY,
      });
    }
  }

  rows.sort((a, b) => a.centerY - b.centerY);
  return rows.flatMap((row) => row.items.sort((a, b) => (a.minX - b.minX) || (a.minY - b.minY)));
}

function componentCenterY(component) {
  return (component.minY + component.maxY) / 2;
}

function exportResult() {
  if (!state.image) return;
  downloadCanvas(makeOutputCanvas(), `${safeFileName(els.fileNameInput.value)}.png`);
}
function openExportDirectoryStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("SmileMattingExportDirectory", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredExportDirectory() {
  try {
    const db = await openExportDirectoryStore();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const request = tx.objectStore("handles").get("lastDirectory");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch (error) {
    console.warn("Read export directory failed:", error);
    return null;
  }
}

async function saveExportDirectory(handle) {
  try {
    const db = await openExportDirectoryStore();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "lastDirectory");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn("Save export directory failed:", error);
  }
}

async function getExportDirectoryHandle() {
  const storedHandle = await readStoredExportDirectory();
  const pickerOptions = { mode: "readwrite", id: "matting-parts-export" };
  if (storedHandle) pickerOptions.startIn = storedHandle;

  try {
    const selectedHandle = await window.showDirectoryPicker(pickerOptions);
    await saveExportDirectory(selectedHandle);
    return selectedHandle;
  } catch (error) {
    if (error && error.name === "AbortError") return null;
    if (storedHandle) {
      try {
        const selectedHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "matting-parts-export" });
        await saveExportDirectory(selectedHandle);
        return selectedHandle;
      } catch (retryError) {
        if (retryError && retryError.name === "AbortError") return null;
      }
    }
    setExportPartsStatus("无法打开目录");
    return null;
  }
}

async function exportParts() {
  if (!state.image) return;
  if (!("showDirectoryPicker" in window)) {
    setExportPartsStatus("当前浏览器不支持目录导出");
    return;
  }

  const baseName = safeFileName(els.fileNameInput.value);
  const originalLabel = els.exportPartsBtn.textContent;
  els.exportPartsBtn.disabled = true;

  try {
    const selectedDirectory = await getExportDirectoryHandle();
    if (!selectedDirectory) return;
    const outputDirectory = await selectedDirectory.getDirectoryHandle(baseName, { create: true });
    const image = makeMattedImage();
    const minPixels = Math.max(0, Math.floor(Number(els.partMinPixelsInput.value) || 0));
    const components = findAlphaComponents(image, 1).filter((component) => component.pixels.length >= minPixels);
    if (!components.length) {
      setExportPartsStatus("没有可导出的单图", originalLabel);
      return;
    }

    for (let i = 0; i < components.length; i++) {
      els.exportPartsBtn.textContent = `正在导出 ${i + 1}/${components.length}`;
      const number = String(i + 1).padStart(3, "0");
      const filename = `${baseName}_part_${number}.png`;
      const blob = await canvasToBlob(makeComponentCanvas(image, components[i]));
      if (!blob) continue;
      const fileHandle = await outputDirectory.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }

    setExportPartsStatus(`已导出 ${components.length} 张`, originalLabel);
  } catch (error) {
    console.error("Export parts failed:", error);
    setExportPartsStatus("导出失败", originalLabel);
  } finally {
    els.exportPartsBtn.disabled = false;
  }
}

function setExportPartsStatus(message, restoreLabel = "导出单图") {
  clearTimeout(setExportPartsStatus.timer);
  els.exportPartsBtn.textContent = message;
  setExportPartsStatus.timer = setTimeout(() => {
    els.exportPartsBtn.textContent = restoreLabel;
  }, 2200);
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
  if (state.maskTool !== "none") {
    event.preventDefault();
    state.maskPainting = true;
    state.lastMaskPoint = null;
    els.imageDropZone.setPointerCapture(event.pointerId);
    paintMaskLine(eventToImagePoint(event));
    return;
  }
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
  if (state.maskPainting) {
    paintMaskLine(eventToImagePoint(event));
    return;
  }
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
  if (state.maskPainting) {
    state.maskPainting = false;
    state.lastMaskPoint = null;
    if (els.imageDropZone.hasPointerCapture(event.pointerId)) {
      els.imageDropZone.releasePointerCapture(event.pointerId);
    }
    scheduleProcess(0);
    return;
  }
  if (!state.dragging) return;
  state.dragging = false;
  state.dragStart = null;
  els.imageDropZone.releasePointerCapture(event.pointerId);
  els.imageDropZone.classList.remove("is-panning");
});
els.imageDropZone.addEventListener("pointercancel", () => {
  state.maskPainting = false;
  state.lastMaskPoint = null;
  state.dragging = false;
  state.dragStart = null;
  els.imageDropZone.classList.remove("is-panning");
});
els.sampleColorBtn.addEventListener("click", () => {
  if (state.maskTool !== "none") setMaskTool(state.maskTool);
  state.sampling = !state.sampling;
  updateModeFields();
});
for (const button of els.maskToolButtons) {
  button.addEventListener("click", () => setMaskTool(button.dataset.maskTool));
}
els.brushSizeInput.addEventListener("input", () => {
  els.brushSizeValue.textContent = els.brushSizeInput.value;
});
els.clearPaintMasksBtn.addEventListener("click", clearPaintMasks);
els.modeInput.addEventListener("change", handleModeSelection);
els.savePresetBtn.addEventListener("click", saveCurrentPreset);
els.deletePresetBtn.addEventListener("click", deleteCurrentPreset);
els.resetBtn.addEventListener("click", resetSettings);
els.exportBtn.addEventListener("click", exportResult);
els.exportPartsBtn.addEventListener("click", exportParts);
els.downloadAlphaBtn.addEventListener("click", exportAlpha);
for (const button of els.previewModeButtons) {
  button.addEventListener("click", () => setPreviewMode(button.dataset.previewMode));
}

for (const input of document.querySelectorAll("input, select")) {
  if (
    input.type === "file" ||
    input.id === "modeInput" ||
    input.id === "fileNameInput" ||
    input.id === "partMinPixelsInput" ||
    input.id === "brushSizeInput2"
  ) continue;
  input.addEventListener("input", updateOutputs);
}

renderPresetOptions();
resetSettings();
setParameterControlsEnabled(false);
