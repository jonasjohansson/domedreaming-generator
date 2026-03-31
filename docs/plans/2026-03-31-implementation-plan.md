# domedreaming-generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based geodesic dome generator with 3D preview, 2D unwrap, media mapping, and high-res PNG export.

**Architecture:** Vite project with Three.js for the 3D viewport, vanilla Canvas for the 2D unwrap viewport, and Tweakpane for all controls. A core geometry module generates geodesic meshes and computes unwrap layouts. A split-view layout with draggable divider hosts both viewports.

**Tech Stack:** Vite, Three.js, Tweakpane (v4 + plugins), vanilla JS (ES modules), Canvas API

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`
- Create: `public/fonts/` (symlink or copy OffBit + OPSPastPerfect)

**Step 1: Initialize project**

```bash
cd /Users/jonas/Documents/GitHub/org/jonasjohansson/domedreaming-generator
npm init -y
npm install vite three tweakpane @tweakpane/plugin-essentials --save-dev
```

**Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
});
```

**Step 3: Create index.html with split layout**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dome Dreaming Generator</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app">
    <div id="viewport-3d"></div>
    <div id="divider"></div>
    <div id="viewport-2d">
      <canvas id="canvas-2d"></canvas>
    </div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 4: Create src/style.css**

Base styles: full-screen flex layout, resizable split, dark background (#111), OffBit font-face declarations.

**Step 5: Create src/main.js**

Minimal entry: import Three.js scene, import 2D canvas, import Tweakpane. Console log "Dome Dreaming Generator initialized".

**Step 6: Copy fonts to public/fonts/**

```bash
cp /Users/jonas/Documents/GitHub/org/jonasjohansson/domedreaming.com/assets/fonts/*.woff2 public/fonts/
```

**Step 7: Verify dev server**

```bash
npx vite --open
```

Expected: Browser opens, dark background, no errors in console.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with Vite, Three.js, Tweakpane"
```

---

### Task 2: Split view with draggable divider

**Files:**
- Create: `src/split-view.js`
- Modify: `src/style.css`
- Modify: `src/main.js`

**Step 1: Create src/split-view.js**

Module that:
- Queries `#viewport-3d`, `#divider`, `#viewport-2d`
- On mousedown/touchstart on divider, tracks drag to resize panels
- Clamps minimum width to 20% for each panel
- Dispatches a custom `resize` event so viewports can update
- Exports `initSplitView()` and `getSplitRatio()`

**Step 2: Add divider styles to src/style.css**

```css
#divider {
  width: 6px;
  cursor: col-resize;
  background: #333;
  flex-shrink: 0;
}
#divider:hover { background: #555; }
```

**Step 3: Wire up in main.js**

```js
import { initSplitView } from './split-view.js';
initSplitView();
```

**Step 4: Verify**

Drag divider left/right, both panels resize. No console errors.

**Step 5: Commit**

```bash
git add src/split-view.js src/style.css src/main.js
git commit -m "feat: resizable split view with draggable divider"
```

---

### Task 3: Three.js 3D viewport

**Files:**
- Create: `src/viewport-3d.js`
- Modify: `src/main.js`

**Step 1: Create src/viewport-3d.js**

Module that:
- Creates Three.js Scene, PerspectiveCamera, WebGLRenderer
- Mounts renderer to `#viewport-3d`
- Adds OrbitControls
- Adds a placeholder IcosahedronGeometry (wireframe) as proof of concept
- Handles resize events from split-view
- Exports `initViewport3D()` and `getScene()`

**Step 2: Wire up in main.js**

```js
import { initViewport3D } from './viewport-3d.js';
initViewport3D();
```

**Step 3: Verify**

Wireframe icosahedron visible, orbit controls work, resizes with split.

**Step 4: Commit**

```bash
git add src/viewport-3d.js src/main.js
git commit -m "feat: Three.js 3D viewport with orbit controls"
```

---

### Task 4: Geodesic dome geometry engine

**Files:**
- Create: `src/geodesic.js`

**Step 1: Create src/geodesic.js**

Core geometry module:

```js
/**
 * Generates geodesic dome geometry by subdividing an icosahedron.
 *
 * @param {Object} options
 * @param {number} options.frequency - Subdivision level (1-6)
 * @param {number} options.radius - Dome radius
 * @param {boolean} options.hemisphere - If true, only top half
 * @param {number} options.truncation - Cut-off latitude (0-1, 1 = full sphere)
 * @param {number} options.rotation - Y-axis rotation in radians
 * @returns {{ vertices: Float32Array, faces: number[][], normals: Float32Array, faceGroups: object[] }}
 */
export function generateGeodesic(options) { ... }
```

Implementation approach:
1. Start with icosahedron base vertices (12 vertices, 20 faces)
2. For each subdivision level, split each triangle into 4 by adding midpoints
3. Project all vertices onto sphere of given radius
4. If hemisphere, filter faces based on truncation threshold
5. Return vertices, face indices, normals, and face group metadata (which original icosahedron face each sub-face belongs to)

**Step 2: Verify**

Quick test: `generateGeodesic({ frequency: 2, radius: 1, hemisphere: false })` returns correct vertex/face counts.
- 1V: 12 vertices, 20 faces
- 2V: 42 vertices, 80 faces
- 3V: 92 vertices, 180 faces

**Step 3: Commit**

```bash
git add src/geodesic.js
git commit -m "feat: geodesic dome geometry engine with subdivision"
```

---

### Task 5: Render geodesic in 3D viewport

**Files:**
- Modify: `src/viewport-3d.js`
- Modify: `src/main.js`

**Step 1: Replace placeholder with geodesic**

- Import `generateGeodesic`
- Convert output to Three.js BufferGeometry
- Render as wireframe + solid faces (double-sided material)
- Each face colored by its icosahedron parent group (for debugging)
- Export `updateDome(options)` to regenerate when params change

**Step 2: Verify**

Geodesic dome visible in 3D with colored face groups, wireframe overlay.

**Step 3: Commit**

```bash
git add src/viewport-3d.js src/main.js
git commit -m "feat: render geodesic dome in 3D viewport"
```

---

### Task 6: Unwrap engine

**Files:**
- Create: `src/unwrap.js`

**Step 1: Create src/unwrap.js**

Unwrap module that takes geodesic face data and computes 2D positions:

```js
/**
 * Unwraps a geodesic mesh into a flat 2D layout.
 *
 * @param {Object} options
 * @param {object} mesh - Output from generateGeodesic()
 * @param {string} layout - 'flower' | 'strip' | 'cross'
 * @param {number} gap - Space between face clusters
 * @param {number} clusterRotation - Rotation of each cluster in radians
 * @returns {{ faces2D: { vertices: [x,y][], groupId: number }[], bounds: { width, height } }}
 */
export function unwrapMesh(options) { ... }
```

Algorithm:
1. Group faces by their icosahedron parent (20 groups for full sphere)
2. For each group, lay out sub-triangles relative to group center
3. Arrange groups according to layout pattern:
   - **flower**: radial arrangement from center pentagon (like the logo)
   - **strip**: linear horizontal strip
   - **cross**: cruciform arrangement
4. Apply gap spacing and rotation per cluster
5. Return 2D vertex positions and bounding box

**Step 2: Verify**

`unwrapMesh({ mesh, layout: 'flower', gap: 10, clusterRotation: 0 })` returns valid 2D coordinates within expected bounds.

**Step 3: Commit**

```bash
git add src/unwrap.js
git commit -m "feat: unwrap engine with flower/strip/cross layouts"
```

---

### Task 7: 2D canvas viewport

**Files:**
- Create: `src/viewport-2d.js`
- Modify: `src/main.js`

**Step 1: Create src/viewport-2d.js**

Module that:
- Gets `#canvas-2d` element
- Renders unwrapped faces as filled/stroked triangles
- Supports pan and zoom (mouse wheel + drag)
- Handles resize events from split-view
- Exports `initViewport2D()`, `render2D(unwrapData)`

**Step 2: Wire up in main.js**

Both viewports now render: 3D dome left, 2D unwrap right.

**Step 3: Verify**

2D unwrap visible, pan/zoom works, matches face groups from 3D view.

**Step 4: Commit**

```bash
git add src/viewport-2d.js src/main.js
git commit -m "feat: 2D canvas viewport with pan/zoom"
```

---

### Task 8: Tweakpane GUI

**Files:**
- Create: `src/gui.js`
- Create: `src/config.js`
- Modify: `src/main.js`

**Step 1: Create src/config.js**

Default config object:

```js
export const defaultConfig = {
  geometry: {
    frequency: 2,
    radius: 1,
    hemisphere: true,
    truncation: 0.5,
    rotation: 0,
  },
  unwrap: {
    layout: 'flower',
    gap: 10,
    clusterRotation: 0,
  },
  media: {
    source: null,
    mode: 'global',
  },
  export: {
    width: 3840,
    height: 2160,
    preset: '4K',
  },
};

export function loadConfig() { ... }  // from localStorage or file
export function saveConfig() { ... }  // to localStorage + JSON download
```

**Step 2: Create src/gui.js**

Tweakpane setup with tabbed/collapsible panels:

- **Geometry tab**: frequency (slider 1-6), radius, hemisphere toggle, truncation, rotation
- **Unwrap tab**: layout (dropdown), gap (slider), cluster rotation
- **Media tab**: source file picker, mapping mode
- **Export tab**: width/height inputs, preset dropdown (1080p/4K/Print), export button
- **Config section**: Save/Load buttons

All controls bound to config object. On change, trigger re-render of both viewports.

**Step 3: Wire up in main.js**

```js
import { initGUI } from './gui.js';
import { defaultConfig } from './config.js';

const config = { ...defaultConfig };
initGUI(config, onChange);
```

**Step 4: Verify**

Tweakpane panels visible, changing frequency regenerates dome in both views.

**Step 5: Commit**

```bash
git add src/gui.js src/config.js src/main.js
git commit -m "feat: Tweakpane GUI with tabbed controls and config"
```

---

### Task 9: Media mapping

**Files:**
- Create: `src/media.js`
- Modify: `src/viewport-3d.js`
- Modify: `src/viewport-2d.js`

**Step 1: Create src/media.js**

Module that:
- Loads an image or video element from URL/file
- Generates UV coordinates for dome faces
- Creates Three.js texture from media for 3D view
- Provides `drawFaceMedia(ctx, face2D, mediaSource)` for 2D canvas rendering
- Handles video frame updates

**Step 2: Integrate with 3D viewport**

Apply media as texture to dome mesh faces using UV mapping.

**Step 3: Integrate with 2D viewport**

For each unwrapped face, clip canvas to triangle shape and draw the corresponding media region.

**Step 4: Verify**

Load `paul-bourke-test-pattern.png` as media source. Visible on dome faces in 3D and matching in 2D unwrap.

**Step 5: Commit**

```bash
git add src/media.js src/viewport-3d.js src/viewport-2d.js
git commit -m "feat: media mapping for images and video on dome faces"
```

---

### Task 10: High-res PNG export

**Files:**
- Create: `src/export.js`
- Modify: `src/gui.js`

**Step 1: Create src/export.js**

Module that:
- Creates an offscreen canvas at target resolution
- Re-renders the 2D unwrap at that resolution (scaling all coordinates)
- Calls `canvas.toBlob('image/png')` and triggers download
- Shows progress indicator for large renders

```js
export async function exportPNG(unwrapData, mediaSource, config) {
  const canvas = document.createElement('canvas');
  canvas.width = config.export.width;
  canvas.height = config.export.height;
  // ... render at full resolution ...
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 2: Wire export button in GUI**

Connect Tweakpane export button to `exportPNG()`.

**Step 3: Verify**

Export at 4K resolution. Open file, verify faces are crisp and media is mapped correctly.

**Step 4: Commit**

```bash
git add src/export.js src/gui.js
git commit -m "feat: high-resolution PNG export"
```

---

### Task 11: Config save/load

**Files:**
- Modify: `src/config.js`
- Modify: `src/gui.js`

**Step 1: Implement save/load**

- **Save**: `JSON.stringify(config)` → download as `domedreaming-config.json`
- **Load**: File input reads JSON, merges into current config, triggers full re-render
- Also persist to `localStorage` on every change as auto-save

**Step 2: Add Save/Load buttons to Tweakpane**

**Step 3: Verify**

Save config, change settings, load config — restores previous state.

**Step 4: Commit**

```bash
git add src/config.js src/gui.js
git commit -m "feat: config save/load with JSON export"
```

---

### Task 12: Create GitHub repo

**Step 1: Create .gitignore**

```
node_modules/
dist/
.DS_Store
```

**Step 2: Create remote repo and push**

```bash
gh repo create jonasjohansson/domedreaming-generator --public --source=. --push
```

**Step 3: Verify**

Repo visible at https://github.com/jonasjohansson/domedreaming-generator

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
git push -u origin main
```

---

## Summary

| Task | Component | Key Output |
|------|-----------|------------|
| 1 | Project scaffold | Vite + deps + fonts |
| 2 | Split view | Draggable resizable divider |
| 3 | 3D viewport | Three.js scene + orbit controls |
| 4 | Geodesic engine | Icosahedron subdivision (1V-6V) |
| 5 | 3D dome render | Geodesic in Three.js |
| 6 | Unwrap engine | Flower/strip/cross layouts |
| 7 | 2D viewport | Canvas with pan/zoom |
| 8 | Tweakpane GUI | Tabbed controls + config |
| 9 | Media mapping | Image/video on faces |
| 10 | PNG export | High-res offscreen render |
| 11 | Config save/load | JSON persistence |
| 12 | GitHub repo | Remote + push |
