import { app } from "../../../scripts/app.js";

const MURMUR = Object.freeze({
  EXT_NAME: "MURMUR.ColorPicker",
  LISTENER_GUARD: "__murmur_picker_listener_attached__",
  ROOT_ID: "murmur-picker-root",
  PANEL_ID: "murmur-picker-panel",
  DEFAULT_HEX: "#4f86f7",
  HOTKEY_CODE: "Tab",
  TITLE: "🦄MurMur",
  PANEL_WIDTH: 334,
  PANEL_HEIGHT: 312,
  SAFE_LEFT: 96,
  SAFE_TOP: 72,
  SAFE_RIGHT: 96,
  SAFE_BOTTOM: 96,
  STORAGE_KEY: "murmur_picker_position_v1",
});

const PRESETS = [
  "__RESET__",
  "__LAST__",
  "#f94144",
  "#f3722c",
  "#f8961e",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1",
  "#4f86f7",
  "#7b61ff",
  "#c77dff",
  "#ff4fa3",
  "#c4c4c4",
  "#7a7a7a",
  "#232323",
  "#0f2a66",
  "#233b8b",
  "#4a1d6f",
  "#5b1232",
];

const EMOJI_PRESETS = [
  "🔥", "🧬", "🤖", "💦", "🍭", "🔮", "🦄", "💖",
  "🐶", "🍒", "🎾", "🎛️", "🔑", "♻️", "🎉", "🥇",
  "🎟️", "🛼", "🍆", "🍉", "🌈", "🌿", "🧠", "😈",
  "🖤", "🧤", "🍄", "🍀", "☄️", "🪐",
];

const state = {
  active: false,
  target: null,
  hue: 214,
  saturation: 0.68,
  value: 0.97,
  hasPickedColor: false,
  lastPickedHex: "#0f5c4a",
  root: null,
  panel: null,
  svCanvas: null,
  hueCanvas: null,
  hexLabel: null,
  titleLabel: null,
  hintLabel: null,
  header: null,
  emojiGrid: null,
  swatchButtons: [],
  raf: 0,
  draggingSV: false,
  draggingHue: false,
  draggingPanel: false,
  dragPointerId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  panelX: null,
  panelY: null,
};

function ensureDom() {
  if (state.root) return;

  const root = document.createElement("div");
  root.id = MURMUR.ROOT_ID;
  root.innerHTML = `
    <style>
      #${MURMUR.ROOT_ID} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 100000;
        font-family: Inter, "Segoe UI", sans-serif;
      }
      #${MURMUR.PANEL_ID} {
        position: fixed;
        display: none;
        width: ${MURMUR.PANEL_WIDTH}px;
        padding: 8px;
        border-radius: 12px;
        background: rgba(20, 21, 24, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(10px);
        color: #f5f7fb;
        pointer-events: auto;
        user-select: none;
      }
      .murmur-picker__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 6px;
        cursor: grab;
      }
      .murmur-picker__top:active {
        cursor: grabbing;
      }
      .murmur-picker__title {
        font-size: 18px;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .murmur-picker__hex {
        flex: 1;
        font-size: 16px;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #f5f7fb;
        font-variant-numeric: tabular-nums;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.16);
        outline: none;
        cursor: pointer;
      }
      .murmur-picker__hex:focus {
        background: rgba(255, 255, 255, 0.16);
      }
      .murmur-picker__body {
        display: grid;
        grid-template-columns: 1fr 22px;
        gap: 8px;
        align-items: stretch;
      }
      .murmur-picker__sv,
      .murmur-picker__hue {
        display: block;
        width: 100%;
        border-radius: 10px;
        cursor: crosshair;
      }
      .murmur-picker__sv {
        height: 198px;
      }
      .murmur-picker__hue {
        height: 198px;
        cursor: ns-resize;
      }
      .murmur-picker__swatches {
        display: grid;
        grid-template-columns: repeat(11, 1fr);
        column-gap: 2px;
        row-gap: 5px;
        margin-top: 10px;
      }
      .murmur-picker__swatch {
        width: 100%;
        max-width: 21px;
        justify-self: center;
        aspect-ratio: 1;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        cursor: pointer;
        padding: 0;
        outline: none;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
      }
      .murmur-picker__emoji-grid {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        column-gap: 2px;
        row-gap: 5px;
        margin-top: 8px;
      }
      .murmur-picker__divider {
        height: 1px;
        margin-top: 8px;
        background: rgba(255, 255, 255, 0.12);
      }
      .murmur-picker__emoji {
        width: 100%;
        max-width: 21px;
        justify-self: center;
        aspect-ratio: 1;
        border-radius: 0;
        border: none;
        background: transparent;
        color: #fff;
        cursor: pointer;
        padding: 0;
        font-size: 18px;
        line-height: 1;
        display: grid;
        place-items: center;
      }
      .murmur-picker__emoji:hover {
        filter: brightness(1.08);
      }
      .murmur-picker__hint {
        margin-top: 6px;
        font-size: 10px;
        color: rgba(245, 247, 251, 0.65);
      }
    </style>
      <div id="${MURMUR.PANEL_ID}">
        <div class="murmur-picker__top">
          <div class="murmur-picker__title">${MURMUR.TITLE}</div>
          <input type="text" class="murmur-picker__hex" value="#000000" readonly />
        </div>
        <div class="murmur-picker__body">
        <canvas class="murmur-picker__sv" width="286" height="198"></canvas>
        <canvas class="murmur-picker__hue" width="22" height="198"></canvas>
      </div>
      <div class="murmur-picker__swatches"></div>
      <div class="murmur-picker__divider"></div>
      <div class="murmur-picker__emoji-grid"></div>
      <div class="murmur-picker__hint">Hold Tab, move mouse, release to hide.</div>
    </div>
  `;

  document.body.appendChild(root);

  state.root = root;
  state.panel = root.querySelector(`#${MURMUR.PANEL_ID}`);
  state.svCanvas = root.querySelector(".murmur-picker__sv");
  state.hueCanvas = root.querySelector(".murmur-picker__hue");
  state.hexInput = root.querySelector(".murmur-picker__hex");
  state.titleLabel = root.querySelector(".murmur-picker__title");
  state.hintLabel = root.querySelector(".murmur-picker__hint");
  state.header = root.querySelector(".murmur-picker__top");
  state.emojiGrid = root.querySelector(".murmur-picker__emoji-grid");

  state.panel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  state.header.addEventListener("pointerdown", onHeaderPointerDown);

  // Input field for hex color entry
  state.hexInput.addEventListener("click", () => {
    if (!state.target) return;
    const current = getCurrentHex();
    state.hexInput.value = current;
    state.hexInput.readOnly = false;
    state.hexInput.select();
  });

  state.hexInput.addEventListener("blur", () => {
    validateAndApplyHexFromInput();
    state.hexInput.readOnly = true;
  });

  state.hexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      validateAndApplyHexFromInput();
      state.hexInput.blur();
    } else if (event.key === "Escape") {
      state.hexInput.readOnly = true;
      renderPicker();
    } else if (!state.hexInput.readOnly) {
      // Real-time preview while typing
      const raw = String(state.hexInput.value || "").trim();
      if (/^[0-9a-f]{1,6}$/i.test(raw)) {
        state.hexInput.style.color = "#f5f7fb";
      } else {
        state.hexInput.style.color = "rgba(245, 247, 251, 0.5)";
      }
    }
  });

  // Allow clicking and typing in the picker - prevent pointer events from blocking input
  state.hexInput.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  const swatches = root.querySelector(".murmur-picker__swatches");
  for (const hex of PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "murmur-picker__swatch";
    button.dataset.swatch = hex;
    if (hex === "__LAST__") {
      button.style.background = state.lastPickedHex;
      button.title = `Last picked: ${state.lastPickedHex}`;
    } else if (hex === "__RESET__") {
      button.style.background = "#ffffff";
      button.style.border = "1px solid rgba(255,255,255,0.28)";
      button.style.position = "relative";
      button.title = "Reset color";
      button.innerHTML = `<span style="
        position:absolute;
        inset:0;
        display:block;
        border-radius:999px;
        background:
          linear-gradient(135deg, transparent 46%, #ff5a5f 46%, #ff5a5f 54%, transparent 54%);
      "></span>`;
    } else {
      button.style.background = hex;
      button.title = hex;
    }
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (hex === "__RESET__") {
        state.hasPickedColor = false;
        clearColorFromTarget();

        // Re-detect target to get updated color after clearing
        const newTarget = detectTarget();
        if (newTarget && state.hexInput) {
          state.hexInput.value = newTarget.initialHex.toUpperCase();
          
          // Update HSV state to match the node's current color
          const hsv = hexToHsv(newTarget.initialHex);
          state.hue = hsv.h;
          state.saturation = hsv.s;
          state.value = hsv.v;
        }
        
        renderPicker();
        return;
      }
      const pickedHex = hex === "__LAST__" ? state.lastPickedHex : hex;
      const hsv = hexToHsv(pickedHex);
      state.hue = hsv.h;
      state.saturation = hsv.s;
      state.value = hsv.v;
      commitCurrentColor();
      renderPicker();
    });
    swatches.appendChild(button);
    state.swatchButtons.push(button);
  }

  for (const emoji of EMOJI_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "murmur-picker__emoji";
    button.textContent = emoji;
    button.title = emoji;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyEmojiToSelection(emoji);
    });
    state.emojiGrid.appendChild(button);
  }

  state.svCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.draggingSV = true;
    state.svCanvas.setPointerCapture?.(event.pointerId);
    updateSVFromEvent(event);
  });
  state.svCanvas.addEventListener("pointermove", (event) => {
    if (!state.draggingSV) return;
    updateSVFromEvent(event);
  });
  state.svCanvas.addEventListener("pointerup", () => {
    state.draggingSV = false;
  });

  state.hueCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.draggingHue = true;
    state.hueCanvas.setPointerCapture?.(event.pointerId);
    updateHueFromEvent(event);
  });
  state.hueCanvas.addEventListener("pointermove", (event) => {
    if (!state.draggingHue) return;
    updateHueFromEvent(event);
  });
  state.hueCanvas.addEventListener("pointerup", () => {
    state.draggingHue = false;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPanelBounds() {
  return {
    minX: MURMUR.SAFE_LEFT,
    minY: MURMUR.SAFE_TOP,
    maxX: Math.max(MURMUR.SAFE_LEFT, window.innerWidth - MURMUR.PANEL_WIDTH - MURMUR.SAFE_RIGHT),
    maxY: Math.max(MURMUR.SAFE_TOP, window.innerHeight - MURMUR.PANEL_HEIGHT - MURMUR.SAFE_BOTTOM),
  };
}

function clampPanelPosition(x, y) {
  const bounds = getPanelBounds();
  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY),
  };
}

function savePanelPosition() {
  try {
    if (Number.isFinite(state.panelX) && Number.isFinite(state.panelY)) {
      localStorage.setItem(MURMUR.STORAGE_KEY, JSON.stringify({ x: state.panelX, y: state.panelY }));
    }
  } catch (_) { }
}

function loadPanelPosition() {
  try {
    const raw = localStorage.getItem(MURMUR.STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return clampPanelPosition(parsed.x, parsed.y);
  } catch (_) {
    return null;
  }
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) {
    return { h: state.hue, s: state.saturation, v: state.value };
  }

  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }

  if (h < 0) h += 360;

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

// Validate and apply hex from input field (#FFAAXX or FFAAXX format)
function validateAndApplyHexFromInput() {
  if (!state.hexInput) return;
  
  let raw = String(state.hexInput.value || "").trim();
  
  // Remove leading # if present
  if (raw.startsWith("#")) {
    raw = raw.slice(1);
  }
  
  // Validate 6-character hex
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    const hsv = hexToHsv(`#${raw}`);
    state.hue = hsv.h;
    state.saturation = hsv.s;
    state.value = hsv.v;
    commitCurrentColor();
    scheduleRender();
  } else if (raw === "") {
    // Empty input - keep current color unchanged
    const targetColor = detectTarget();
    if (targetColor && state.hexInput && targetColor.initialHex)
    {
      state.hexInput.value = targetColor.initialHex.toUpperCase();
    }
    state.hasPickedColor = false;
    return;
  }
}

function getCurrentHex() {
  return rgbToHex(hsvToRgb(state.hue, state.saturation, state.value));
}

function refreshLastSwatch() {
  const button = state.swatchButtons.find((item) => item?.dataset?.swatch === "__LAST__");
  if (!button) return;
  button.style.background = state.lastPickedHex;
  button.title = `Last picked: ${state.lastPickedHex}`;
}

function getSelectedNodes() {
  const canvas = app?.canvas;
  if (!canvas) return [];

  const selected = Object.values(canvas.selected_nodes || {});
  if (selected.length) return selected;
  if (canvas.selected_node) return [canvas.selected_node];
  return [];
}

function getSelectedGroup() {
  const canvas = app?.canvas;
  if (!canvas) return null;

  for (const key of [
    "selected_group",
    "selected_group_moving",
    "selected_group_resizing",
    "current_group",
    "group_over",
  ]) {
    if (canvas[key]) return canvas[key];
  }

  return null;
}

function detectTarget() {
  const group = getSelectedGroup();
  if (group) {
    return {
      kind: "group",
      items: [group],
      label: `Group: ${group.title || "Untitled"}`,
      initialHex: normalizeHex(group.color || group.bgcolor || MURMUR.DEFAULT_HEX),
    };
  }

  const nodes = getSelectedNodes();
  if (!nodes.length) return null;

  const label = nodes.length === 1
    ? `Node: ${nodes[0]?.title || nodes[0]?.type || "Untitled"}`
    : `Nodes: ${nodes.length}`;

  return {
    kind: "nodes",
    items: nodes,
    label,
    initialHex: normalizeHex(nodes[0]?.bgcolor || nodes[0]?.color || MURMUR.DEFAULT_HEX),
  };
}

function normalizeHex(hex) {
  const value = String(hex || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return MURMUR.DEFAULT_HEX;
}

function clearColorFromTarget() {
  if (!state.target) return;

  if (state.target.kind === "group") {
    for (const group of state.target.items) {
      try { delete group.color; } catch (_) { group.color = undefined; }
      if ("bgcolor" in group) {
        try { delete group.bgcolor; } catch (_) { group.bgcolor = undefined; }
      }
    }
  } else {
    for (const node of state.target.items) {
      try { delete node.color; } catch (_) { node.color = undefined; }
      try { delete node.bgcolor; } catch (_) { node.bgcolor = undefined; }
      node.setDirtyCanvas?.(true, true);
    }
  }

  const canvas = app?.canvas;
  canvas?.graph?.setDirtyCanvas?.(true, true);
  canvas?.setDirty?.(true, true);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyEmojiToSelection(emoji) {
  const nodes = getSelectedNodes();
  if (!nodes.length) return;

  const emojiPattern = new RegExp(`^(?:${EMOJI_PRESETS.map(escapeRegExp).join("|")})\\s*`, "u");

  for (const node of nodes) {
    const baseTitle = String(node?.title || node?.type || "").replace(emojiPattern, "").trimStart();
    const nextTitle = `${emoji} ${baseTitle || node?.type || ""}`.trim();
    node.title = nextTitle;
    node.setDirtyCanvas?.(true, true);
  }

  const canvas = app?.canvas;
  canvas?.graph?.setDirtyCanvas?.(true, true);
  canvas?.setDirty?.(true, true);
}

function applyColorToTarget(hex) {
  if (!state.target) return;

  if (state.target.kind === "group") {
    for (const group of state.target.items) {
      group.color = hex;
      if ("bgcolor" in group) group.bgcolor = hex;
    }
  } else {
    for (const node of state.target.items) {
      node.color = hex;
      node.bgcolor = hex;
      node.setDirtyCanvas?.(true, true);
    }
  }

  const canvas = app?.canvas;
  canvas?.graph?.setDirtyCanvas?.(true, true);
  canvas?.setDirty?.(true, true);
}

function commitCurrentColor() {
  state.hasPickedColor = true;
  const hex = getCurrentHex();
  state.lastPickedHex = hex;
  refreshLastSwatch();
  if (state.hexInput) {
    state.hexInput.value = hex.toUpperCase();
  }
  applyColorToTarget(hex);
}

function renderSVCanvas() {
  const canvas = state.svCanvas;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = `hsl(${state.hue} 100% 50%)`;
  ctx.fillRect(0, 0, width, height);

  const white = ctx.createLinearGradient(0, 0, width, 0);
  white.addColorStop(0, "#ffffff");
  white.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, width, height);

  const black = ctx.createLinearGradient(0, 0, 0, height);
  black.addColorStop(0, "rgba(0,0,0,0)");
  black.addColorStop(1, "#000000");
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, width, height);

  if (state.hasPickedColor) {
    const x = state.saturation * width;
    const y = (1 - state.value) * height;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
  }
}

function renderHueCanvas() {
  const canvas = state.hueCanvas;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);

  gradient.addColorStop(0.0, "#ff0000");
  gradient.addColorStop(0.16, "#ffff00");
  gradient.addColorStop(0.33, "#00ff00");
  gradient.addColorStop(0.5, "#00ffff");
  gradient.addColorStop(0.66, "#0000ff");
  gradient.addColorStop(0.83, "#ff00ff");
  gradient.addColorStop(1.0, "#ff0000");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (state.hasPickedColor) {
    const y = (state.hue / 360) * height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y - 2, width, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeRect(0.5, y - 2.5, width - 1, 5);
  }
}

function renderPicker() {
  if (!state.panel || !state.active) return;
  renderSVCanvas();
  renderHueCanvas();
  
  // Always show current computed color (from HSV state set in beginPicker)
  const hexValue = getCurrentHex().toUpperCase();
  
  if (state.hexInput && state.hexInput.value !== hexValue) {
    state.hexInput.value = hexValue;
  }
  state.titleLabel.textContent = MURMUR.TITLE;
  state.hintLabel.textContent = "Click outside picker to close.";
}

function scheduleRender() {
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(renderPicker);
}

function positionPanel() {
  const stored = loadPanelPosition();
  const pos = stored || clampPanelPosition(MURMUR.SAFE_LEFT, MURMUR.SAFE_TOP);
  state.panelX = pos.x;
  state.panelY = pos.y;
  state.panel.style.left = `${pos.x}px`;
  state.panel.style.top = `${pos.y}px`;
}

function applyPanelPosition(x, y, persist = false) {
  const pos = clampPanelPosition(x, y);
  state.panelX = pos.x;
  state.panelY = pos.y;
  state.panel.style.left = `${pos.x}px`;
  state.panel.style.top = `${pos.y}px`;
  if (persist) savePanelPosition();
}

function showPanel() {
  ensureDom();
  positionPanel();
  state.panel.style.display = "block";
  // Defer rendering until next animation frame to ensure panel is fully visible first
  requestAnimationFrame(renderPicker);
}

function hidePanel() {
  state.active = false;
  state.target = null;
  state.draggingSV = false;
  state.draggingHue = false;
  state.draggingPanel = false;
  state.dragPointerId = null;
  if (state.panel) state.panel.style.display = "none";
}

function beginPicker() {
  if (state.active) return;

  const target = detectTarget();
  if (!target) return;

  state.active = true;
  state.target = target;
  
  // Fill input with current node/group color and mark as picked so it shows immediately
  const initialHex = target.initialHex || MURMUR.DEFAULT_HEX;
  if (state.hexInput) {
    state.hexInput.value = initialHex.toUpperCase();
  }

  const hsv = hexToHsv(initialHex);
  state.hue = hsv.h;
  state.saturation = hsv.s;
  state.value = hsv.v;
  
  // Mark as picked so renderPicker shows the color instead
  state.hasPickedColor = true;

  showPanel();
}

function updateSVFromEvent(event) {
  const rect = state.svCanvas.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const y = clamp(event.clientY - rect.top, 0, rect.height);
  state.saturation = rect.width ? x / rect.width : 0;
  state.value = rect.height ? 1 - (y / rect.height) : 0;
  commitCurrentColor();
  scheduleRender();
}

function updateHueFromEvent(event) {
  const rect = state.hueCanvas.getBoundingClientRect();
  const y = clamp(event.clientY - rect.top, 0, rect.height);
  state.hue = rect.height ? (y / rect.height) * 360 : 0;
  commitCurrentColor();
  scheduleRender();
}

function onHeaderPointerDown(event) {
  if (!state.active || event.button !== 0) return;
  if (!state.panel) return;

  event.preventDefault();
  event.stopPropagation();

  const rect = state.panel.getBoundingClientRect();
  state.draggingPanel = true;
  state.dragPointerId = event.pointerId;
  state.dragOffsetX = event.clientX - rect.left;
  state.dragOffsetY = event.clientY - rect.top;
  state.header.setPointerCapture?.(event.pointerId);
}

function onWindowPointerMove(event) {
  if (!state.draggingPanel) return;
  if (state.dragPointerId != null && event.pointerId !== state.dragPointerId) return;
  applyPanelPosition(event.clientX - state.dragOffsetX, event.clientY - state.dragOffsetY, false);
}

function onWindowPointerUp(event) {
  if (!state.draggingPanel) return;
  if (state.dragPointerId != null && event.pointerId !== state.dragPointerId) return;
  state.draggingPanel = false;
  state.dragPointerId = null;
  savePanelPosition();
}

function shouldIgnoreKeyEvent(event) {
  const tag = String(event?.target?.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || event?.target?.isContentEditable;
}

function onKeyDown(event) {
  if (event.code !== MURMUR.HOTKEY_CODE) return;

  event.preventDefault();
  event.stopPropagation();
  if (state.active || shouldIgnoreKeyEvent(event) || event.repeat) return;
  beginPicker();
}

function onWindowBlur() {
  if (state.active) hidePanel();
}

function onDocumentPointerDown(event) {
  if (!state.active) return;
  if (state.panel?.contains(event.target)) return;
  hidePanel();
}

function attachListenerOnce() {
  if (globalThis[MURMUR.LISTENER_GUARD]) return;
  globalThis[MURMUR.LISTENER_GUARD] = true;

  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("pointermove", onWindowPointerMove, { capture: true });
  window.addEventListener("pointerup", onWindowPointerUp, { capture: true });
  window.addEventListener("resize", () => {
    if (!state.panel || state.panelX == null || state.panelY == null) return;
    applyPanelPosition(state.panelX, state.panelY, true);
  });
  document.addEventListener("pointerdown", onDocumentPointerDown, { capture: true });
}

app.registerExtension({
  name: MURMUR.EXT_NAME,
  async setup() {
    attachListenerOnce();
  },
});
