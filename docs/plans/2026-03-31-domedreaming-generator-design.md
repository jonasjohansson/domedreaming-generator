# domedreaming-generator — Design

## Core concept

A browser-based tool with a resizable split view: 3D geodesic dome preview (Three.js) on the left, 2D unwrapped pattern (Canvas) on the right. Media (images/video) is mapped onto dome faces and visible in both views simultaneously.

## Geometry engine

- Geodesic dome generation from icosahedron subdivision (1V–6V frequency)
- Parametric controls: frequency, radius, hemisphere/full sphere, truncation, rotation
- Architected with a generic `Mesh → unwrap` pipeline so arbitrary 3D models can replace the geodesic source later

## Unwrap system

- Multiple net layouts (flower, strip, cross, custom)
- Adjustable gap size, cluster rotation, overall arrangement
- All controlled via Tweakpane

## Media mapping

- Load images/videos from the domedreaming asset folders
- UV-map source media across dome faces in 3D, reflected in the 2D unwrap
- Per-face or global media assignment

## GUI (Tweakpane)

- Tabbed, collapsible panels: Geometry, Unwrap, Media, Export
- Global config as JSON — save/load via GUI buttons
- Resizable split divider between 3D and 2D views

## Export

- PNG at configurable resolution (presets: 1080p, 4K, print 4000x4000+)
- Canvas-based rendering for high-res output

## Tech stack

- **Three.js** — 3D dome preview with orbit controls
- **Vanilla JS + Canvas** — 2D unwrap rendering and export
- **Tweakpane** — GUI
- **OffBit font family** — for any text overlays
- Vite for dev server and bundling

## Fonts

- OffBit family (woff2) + OPSPastPerfect-Regular

## Future considerations

- Support arbitrary 3D models (not just geodesic domes)
- Tabbed view mode as alternative to split view
- SVG export
- Video frame-by-frame mapping
