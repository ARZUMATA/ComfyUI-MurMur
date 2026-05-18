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
  RECENT_COLORS_KEY: "murmur_recent_colors",
  LAST_PICKED_KEY: "murmur_last_picked_hex",
});

const PALETTES = {
  DEFAULT: [
    { color: "#f94144", name: "Crimson" },
    { color: "#f3722c", name: "Vermilion" },
    { color: "#f8961e", name: "Amber" },
    { color: "#f9c74f", name: "Gold" },
    { color: "#90be6d", name: "Lime" },
    { color: "#43aa8b", name: "Jade" },
    { color: "#4d908e", name: "Teal" },
    { color: "#577590", name: "Steel" },
    { color: "#277da1", name: "Cobalt" },
    { color: "#4f86f7", name: "Azure" },
    { color: "#7b61ff", name: "Violet" },
    { color: "#c77dff", name: "Orchid" },
    { color: "#ff4fa3", name: "Rose" },
    { color: "#c4c4c4", name: "Silver" },
    { color: "#7a7a7a", name: "Gray" },
    { color: "#232323", name: "Charcoal" },
    { color: "#0f2a66", name: "Navy" },
    { color: "#233b8b", name: "Indigo" },
    { color: "#4a1d6f", name: "Plum" },
    { color: "#5b1232", name: "Burgundy" },
  ]
};

/** @type {Record<string, Array<{color:string, name:string}>>} External palettes loaded at runtime */
const EXTERNAL_PALETTES = {};

async function loadExternalPaletteFiles() {
  try {
    // Fetch palettes from the server as JSON files.
    // Each file should be at /extensions/ComfyUI-MurMur/js/palettes/<name>.json
    // Format: { "name": "Palette Name", "colors": [{ color: "#hex", name: "ColorName" }] }
    const baseUrl = window.location.origin + '/extensions/ComfyUI-MurMur/palettes/';
    
    // Load manifest.json which lists all available palette files
    const manifestResp = await fetch(baseUrl + 'manifest.json');

    if (!manifestResp.ok) {
      console.warn("[MurMur] Failed to load manifest, skipping external palettes");
      return;
    }
    
    const manifest = await manifestResp.json();
    const paletteFiles = manifest.files || [];

    for (const file of paletteFiles) {
      try {
        const resp = await fetch(baseUrl + file);
        if (!resp.ok) continue;
        const data = await resp.json();
        
        if (!data?.name || !Array.isArray(data.colors)) continue;
        
        EXTERNAL_PALETTES[data.name] = data.colors;
      } catch (_) {}
    }
  } catch (err) {
    console.warn("[MurMur] Failed to load external palette files:", err);
  }
}

/**
 * Load ComfyUI node colors from LGraphCanvas.node_colors into a dynamic palette.
 */
async function loadComfyUIDynamicPalette() {
  try {
    if (typeof LGraphCanvas === 'undefined') {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (typeof LGraphCanvas !== 'undefined') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    if (typeof LGraphCanvas === 'undefined' || !LGraphCanvas.node_colors) {
      return;
    }

    const nodeColors = LGraphCanvas.node_colors;
    if (typeof nodeColors !== 'object') return;

    const paletteName = "COMFYUI";
    const entriesMap = new Map();

    // Collect the "color" property from each node color entry.
    // LGraphCanvas.node_colors has structure like:
    //   black: { bgcolor: "#000", color: "#222", groupcolor: "#444" }
    //   blue: { bgcolor: "#1e3a5f", color: "#2d5f8a", groupcolor: "#4b7eb5" }
    for (const key of Object.keys(nodeColors)) {
      const colorData = nodeColors[key];
      if (typeof colorData === 'object' && colorData !== null) {
        // Extract the "color" property specifically
        if ("color" in colorData && typeof colorData.color === 'string') {
          let hex = colorData.color;
          // Handle both 3-digit and 6-digit hex codes
          if (/^#[0-9a-f]{6}$/i.test(hex)) {
            hex = hex.toLowerCase();
          } else if (/^#[0-9a-f]{3}$/i.test(hex)) {
            // Expand 3-digit hex to 6-digit
            hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
          } else {
            continue;
          }
          if (!entriesMap.has(hex)) {
            entriesMap.set(hex, { color: hex, name: key.charAt(0).toUpperCase() + key.slice(1) });
          }
        }
      } else if (typeof colorData === 'string' && /^#[0-9a-f]{6}$/i.test(colorData)) {
        const hex = colorData.toLowerCase();
        if (!entriesMap.has(hex)) {
          entriesMap.set(hex, { color: hex, name: key.charAt(0).toUpperCase() + key.slice(1) });
        }
      }
    }

    // Deduplicate and store as array of {color, name} objects
    const uniqueEntries = [...entriesMap.values()];
    if (uniqueEntries.length > 0) {
      EXTERNAL_PALETTES[paletteName] = uniqueEntries;
    }
  } catch (err) {
    console.warn("[MurMur] Failed to load ComfyUI dynamic palette:", err);
  }
}

/**
 * Get all available palettes including external ones.
 * Order: built-in palettes first, then COMFYUI, then other external palettes.
 * @returns {{name: string, colors: string[]}[]} Array of palette objects
 */
function getAllPalettes() {
  const result = [];

  // Built-in palettes
  for (const [name, entries] of Object.entries(PALETTES)) {
    const colors = normalizePaletteEntries(entries).map(e => e.color);
    result.push({ name, colors });
  }

  // COMFYUI palette (if loaded) — always right after built-ins
  if (EXTERNAL_PALETTES["COMFYUI"]) {
    const colors = normalizePaletteEntries(EXTERNAL_PALETTES["COMFYUI"]).map(e => e.color);
    result.push({ name: "COMFYUI", colors });
  }

  // Other external palettes (everything except COMFYUI)
  for (const [name, entries] of Object.entries(EXTERNAL_PALETTES)) {
    if (name === "COMFYUI") continue;
    const colors = normalizePaletteEntries(entries).map(e => e.color);
    result.push({ name, colors });
  }

  return result;
}

/**
 * Get palette colors by name (including external palettes).
* @param {string} name
* @returns {{color: string, name: string}[]} Array of {color, name} objects
 */
function getPaletteEntries(name) {
  if (PALETTES[name]) return normalizePaletteEntries(PALETTES[name]);
  if (EXTERNAL_PALETTES[name]) return normalizePaletteEntries(EXTERNAL_PALETTES[name]);
  return [];
}

/**
 * Normalize palette entries to {color, name} format.
 * Handles both string format ["#fff"] and object format [{color: "#fff", name: "White"}].
 * @param {string[]|Array<{color:string, name?:string}>} entries
 * @returns {{color: string, name: string}[]}
 */
function normalizePaletteEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => {
    if (typeof entry === 'object' && entry !== null && typeof entry.color === 'string') {
      const hex = entry.color;
      const name = entry.name || hex.toUpperCase();
      return { color: hex, name };
    }
    if (typeof entry === 'string' && /^#[0-9a-f]{6}$/i.test(entry)) {
      return { color: entry.toLowerCase(), name: entry.toUpperCase() };
    }
    return null;
  }).filter(Boolean);
}

/**
 * Save selected palette (including external ones).
 * @param {string} name
 */
function saveSelectedPalette(name) {
  try {
    if (PALETTES[name] || EXTERNAL_PALETTES[name]) {
      localStorage.setItem("murmur_selected_palette", name);
    }
  } catch (_) {}
}

/**
 * Get current palette name from storage, validating against all available palettes.
 * @returns {string}
 */
function getCurrentPalette() {
  try {
    const saved = localStorage.getItem("murmur_selected_palette");
    if (saved && (PALETTES[saved] || EXTERNAL_PALETTES[saved])) return saved;
  } catch (_) {}
  return DEFAULT_PALETTE_NAME;
}

const DEFAULT_PALETTE_NAME = "DEFAULT";

// Track recent colors (up to 5) - initialized from localStorage below
function loadRecentColors() {
  try {
    const raw = localStorage.getItem(MURMUR.RECENT_COLORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

let recentColors = loadRecentColors();

function saveRecentColors() {
  try {
    localStorage.setItem(MURMUR.RECENT_COLORS_KEY, JSON.stringify(recentColors));
  } catch (_) {}
}

function loadLastPickedHex() {
  try {
    const raw = localStorage.getItem(MURMUR.LAST_PICKED_KEY);
    if (raw && /^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  } catch (_) {}
  return null;
}

function saveLastPickedHex(hex) {
  try {
    localStorage.setItem(MURMUR.LAST_PICKED_KEY, hex);
  } catch (_) {}
}

function addRecentColor(hex) {
  // Remove if already exists
  recentColors = recentColors.filter(c => c !== hex);
  // Add to front
  recentColors.unshift(hex);
  // Keep only 5
  if (recentColors.length > 5) {
    recentColors.pop();
  }
  saveRecentColors();
}

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
  lastPickedHex: loadLastPickedHex() || null,
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
  renderRecentRowFn: null,
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
      .murmur-picker__controls {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding: 4px 2px;
      }
      .murmur-picker__divider-v {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.16);
        flex-shrink: 0;
      }
      .murmur-picker__palette-select {
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: #f5f7fb;
        border: 1px solid rgba(255, 255, 255, 0.16);
        outline: none;
        cursor: pointer;
        max-width: 90px;
      }
      .murmur-picker__palette-select option {
        background: #141518;
        color: #f5f7fb;
      }
      .murmur-picker__recent-label {
        font-size: 9px;
        color: rgba(245, 247, 251, 0.45);
        white-space: nowrap;
      }
      .murmur-picker__recent-swatch {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.16);
        cursor: pointer;
        padding: 0;
        outline: none;
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
      .murmur-picker__swatch--reset {
        background: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.28);
        position: relative;
      }
      .murmur-picker__swatch--last {
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
      .murmur-picker__palette-row {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        column-gap: 2px;
        row-gap: 5px;
        margin-top: 6px;
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
      <div class="murmur-picker__controls">
        <button type="button" class="murmur-picker__swatch murmur-picker__swatch--reset" data-action="reset" title="Reset color"><span style="position:absolute;inset:0;display:block;border-radius:999px;background:linear-gradient(135deg,transparent 46%,#ff5a5f 46%,#ff5a5f 54%,transparent 54%)"></span></button>
        <button type="button" class="murmur-picker__swatch murmur-picker__swatch--last" data-action="last" title="Last picked color"></button>
        <div class="murmur-picker__divider-v"></div>
        <select class="murmur-picker__palette-select" data-action="palette">
          ${(() => { const all = getAllPalettes(); return all.map(p => `<option value="${p.name}">${p.name}</option>`).join(''); })()}
        </select>
        <span class="murmur-picker__recent-label">Recent:</span>
      </div>
      <div id="murmur-picker-recent-row" style="display:flex;gap:2px;margin-top:4px;padding:0 2px;"></div>
      <div class="murmur-picker__palette-row"></div>
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

  // Control row elements
  const resetBtn = root.querySelector('.murmur-picker__swatch--reset');
  const lastBtn = root.querySelector('.murmur-picker__swatch--last');
  const paletteSelect = root.querySelector('.murmur-picker__palette-select');
  const recentRow = root.querySelector('#murmur-picker-recent-row');
  const paletteRow = root.querySelector('.murmur-picker__palette-row');

  // Set initial palette selection from storage
  paletteSelect.value = getCurrentPalette();

  // Reset button handler
  resetBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.hasPickedColor = false;
    clearColorFromTarget();

    const newTarget = detectTarget();
    if (newTarget && state.hexInput) {
      state.hexInput.value = newTarget.initialHex.toUpperCase();
      const hsv = hexToHsv(newTarget.initialHex);
      state.hue = hsv.h;
      state.saturation = hsv.s;
      state.value = hsv.v;
    }
    renderPicker();
  });

  // Last button handler - use first recent color, fallback to lastPickedHex
  lastBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pickedHex = recentColors[0] || state.lastPickedHex;
    if (!recentColors.includes(state.lastPickedHex) && state.lastPickedHex) {
      // Ensure lastPickedHex is in recent
    }
    const hsv = hexToHsv(pickedHex);
    state.hue = hsv.h;
    state.saturation = hsv.s;
    state.value = hsv.v;
    commitCurrentColor();
    renderPicker();
  });

  // Palette selector change handler
  paletteSelect.addEventListener("change", () => {
    saveSelectedPalette(paletteSelect.value);
    renderPaletteRow(getCurrentPalette());
    renderRecentRow();
  });

  // Render recent colors row
  function renderRecentRow() {
    recentRow.innerHTML = "";
    for (const hex of recentColors) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "murmur-picker__recent-swatch";
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const hsv = hexToHsv(hex);
        state.hue = hsv.h;
        state.saturation = hsv.s;
        state.value = hsv.v;
        commitCurrentColor();
        renderPicker();
      });
      recentRow.appendChild(btn);
    }
  }

  /**
  * Render palette row for a given palette name.
  * @param {string} paletteName
  */
  function renderPaletteRow(paletteName) {
    const paletteRow = state.root?.querySelector('.murmur-picker__palette-row');
    if (!paletteRow) return;

    paletteRow.innerHTML = "";
    const entries = getPaletteEntries(paletteName);

    for (const { color, name } of entries) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "murmur-picker__swatch";
      btn.style.background = color;
      btn.title = `${name} - ${color.toUpperCase()}`;
      btn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const hsv = hexToHsv(color);
        state.hue = hsv.h;
        state.saturation = hsv.s;
        state.value = hsv.v;
        commitCurrentColor();
        renderPicker();
      });
      paletteRow.appendChild(btn);
    }
  }

  // Initialize rows
  renderRecentRow();
  renderPaletteRow(getCurrentPalette());

  // Store references for external calls (async callbacks need these)
  state.renderPaletteRowFn = renderPaletteRow;
  state.renderRecentRowFn = renderRecentRow;


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

function refreshLastSwatch(hex) {
  // Update last swatch and recent row
  const lastBtn = state.panel?.querySelector('[data-action="last"]');
  if (lastBtn && hex) {
    lastBtn.style.background = hex;
    lastBtn.title = `Last picked: ${hex}`;
  }
  state.renderRecentRowFn?.();
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

/**
 * Check if a node is an rgthree-comfy Label virtual node.
 * These have a custom draw method and use properties["fontColor"] for text color.
 * @param {*} node
 * @returns {boolean}
 */
function isRgthreeLabel(node) {
  return node && typeof node.draw === "function" && node.properties && typeof node.properties.fontColor === "string";
}

/**
 * Get the primary color property for a node (handles rgthree Label specially).
 * @param {*} node
 * @returns {string|null}
 */
function getNodePrimaryColor(node) {
  if (isRgthreeLabel(node)) {
    return normalizeHex(node.properties?.fontColor);
  }
  return normalizeHex(node.bgcolor || node.color);
}

/**
 * Set the primary color property for a node (handles rgthree Label specially).
 * @param {*} node
 * @param {string} hex
 */
function setNodePrimaryColor(node, hex) {
  if (isRgthreeLabel(node)) {
    node.properties = node.properties || {};
    node.properties.fontColor = hex;
  } else {
    node.color = hex;
    node.bgcolor = hex;
  }
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

  // Check if all selected nodes are rgthree Labels (special handling)
  const allLabels = nodes.every(isRgthreeLabel);
  const hasLabels = nodes.some(isRgthreeLabel);

  const label = nodes.length === 1
    ? `Node: ${nodes[0]?.title || nodes[0]?.type || "Untitled"}`
    : `Nodes: ${nodes.length}`;

  return {
    kind: allLabels ? "rgthree_labels" : "nodes",
    items: nodes,
    label,
    initialHex: getNodePrimaryColor(nodes[0]) || MURMUR.DEFAULT_HEX,
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
    }
  } else if (state.target.kind === "rgthree_labels") {
    for (const node of state.target.items) {
      if (isRgthreeLabel(node)) {
        try { delete node.properties.fontColor; } catch (_) {}
      } else {
        try { delete node.color; } catch (_) { node.color = undefined; }
        try { delete node.bgcolor; } catch (_) { node.bgcolor = undefined; }
      }
      node.setDirtyCanvas?.(true, true);
    }
  } else {
    for (const node of state.target.items) {
      if (isRgthreeLabel(node)) {
        try { delete node.properties.fontColor; } catch (_) {}
      } else {
        try { delete node.color; } catch (_) { node.color = undefined; }
        try { delete node.bgcolor; } catch (_) { node.bgcolor = undefined; }
      }
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
    }
  } else if (state.target.kind === "rgthree_labels") {
    for (const node of state.target.items) {
      setNodePrimaryColor(node, hex);
      node.setDirtyCanvas?.(true, true);
    }
  } else {
    for (const node of state.target.items) {
      setNodePrimaryColor(node, hex);
      node.setDirtyCanvas?.(true, true);
    }
  }

  const canvas = app?.canvas;
  canvas?.graph?.setDirtyCanvas?.(true, true);
  canvas?.setDirty?.(true, true);
}

function commitCurrentColor() {
  state.hasPickedColor = true;
  state.lastPickedHex = getCurrentHex();
  saveLastPickedHex(state.lastPickedHex);
  if (state.hexInput) {
    state.hexInput.value = state.lastPickedHex.toUpperCase();
  }
  applyColorToTarget(state.lastPickedHex);
  refreshLastSwatch(state.lastPickedHex);
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

/** @type {boolean} */
let _comfyUIPaletteInitialized = false;

async function ensureComfyUIPaletteLoaded() {
  if (_comfyUIPaletteInitialized) return;
  _comfyUIPaletteInitialized = true;
  await loadComfyUIDynamicPalette();
}

// Load external palette files at startup
loadExternalPaletteFiles();

function showPanel() {
  ensureDom();
  // Load ComfyUI palette on first panel open (ensures all extensions have registered their colors)
  ensureComfyUIPaletteLoaded().then(() => {
    // Re-render palette row with updated options if COMFYUI palette was added
    const paletteRow = state.root?.querySelector('.murmur-picker__palette-row');
    const paletteSelect = state.root?.querySelector('.murmur-picker__palette-select');
    if (paletteSelect) {
      // Update dropdown options to include newly loaded palettes
      const all = getAllPalettes();
      paletteSelect.innerHTML = all.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
      // Restore current selection
      paletteSelect.value = getCurrentPalette();
    }
    if (paletteRow) {
      state.renderPaletteRowFn?.(getCurrentPalette());
    }
  });
  positionPanel();
  state.panel.style.display = "block";
  // Defer rendering until next animation frame to ensure panel is fully visible first
  requestAnimationFrame(renderPicker);
}

function hidePanel() {
  // Add current color to recents only when closing, and only if not already there
  if (state.hasPickedColor && state.lastPickedHex) {
    if (!recentColors.includes(state.lastPickedHex)) {
      addRecentColor(state.lastPickedHex);
      state.renderRecentRowFn?.();
    }
  }
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
