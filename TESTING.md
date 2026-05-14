# Map Editor v2 — Manual Test Checklist

Open the editor via **[ MAP EDITOR ]** on the main menu before starting each section.

---

## 1. Scroll-to-zoom

- [ ] Hover over the grid and scroll **up** — grid tiles should grow larger
- [ ] Scroll **down** — grid tiles should shrink
- [ ] Zoom stops at minimum (tiny tiles, ~8 px each) — cannot scroll smaller
- [ ] Zoom stops at maximum (large tiles, ~40 px each) — cannot scroll larger
- [ ] When canvas is larger than the visible area, **scrollbars appear** on the right / bottom
- [ ] Scrollbars can be dragged to pan around the canvas
- [ ] After zooming, **painting still works** at the correct cell (no offset bug)
- [ ] After zooming, **hover status bar** shows correct col/row coordinates

---

## 2. Fill (bucket) tool

- [ ] Press **F** — the `⌀ Fill [F]` button highlights gold (active mode indicator)
- [ ] Click the button directly — same highlight result
- [ ] Press **F** again — button returns to normal (toggle off)
- [ ] With Fill active, paint a few wall tiles manually, then **click inside a floor region** — all connected floor tiles fill with the current tile type
- [ ] Fill **respects tile boundaries** — stops at walls or different tile types, does not bleed through
- [ ] Fill with **right-click** erases the connected region (fills with floor 0)
- [ ] Fill action can be **undone** with Ctrl+Z (single undo step, not cell-by-cell)
- [ ] Enabling Fill **disables Rect mode** automatically (they are mutually exclusive)
- [ ] Fill does **not activate** for height tools or marker tools (those still paint single cells)

---

## 3. Rectangle (rect) tool

- [ ] Press **X** — the `▭ Rect [X]` button highlights gold
- [ ] Click the button directly — same result
- [ ] Press **X** again — toggle off
- [ ] With Rect active, **click-drag** across the grid — a gold preview rectangle appears while dragging
- [ ] Release mouse — rectangle is filled with the current tile type
- [ ] **Right-click-drag** erases a rectangle (fills with floor 0)
- [ ] Rect action can be **undone** with Ctrl+Z (single undo step for the entire rectangle)
- [ ] Enabling Rect **disables Fill mode** automatically
- [ ] Dragging in any direction (top-left, top-right, bottom-left, bottom-right) works correctly
- [ ] Preview rect disappears if you drag off the canvas edge (snap applies)
- [ ] Rect does **not activate** for height tools or marker tools

---

## 4. Mirror mode

- [ ] Press **M** — button label changes to `Mirror: ↔ [M]` (Horizontal mirror)
- [ ] Press **M** again — `Mirror: ↕ [M]` (Vertical mirror)
- [ ] Press **M** again — `Mirror: ↔↕ [M]` (Both axes)
- [ ] Press **M** again — `Mirror: OFF [M]` (back to normal)
- [ ] Click the button directly — same cycle
- [ ] With **Mirror: ↔** active, paint a tile on the left half — a mirrored tile appears on the right half at the same row
- [ ] With **Mirror: ↕** active, paint a tile on the top half — a mirrored tile appears on the bottom half at the same column
- [ ] With **Mirror: ↔↕** active, painting one tile places tiles in all four symmetric positions
- [ ] Mirror works for: **walls, floor, cracks, ramps, columns, side walls**
- [ ] Mirror does **not** apply to marker tools (spawn points, bomb sites) — they remain single placement
- [ ] Mirror + Fill: fill ignores mirror (fill is already region-based)
- [ ] Mirrored paints can be **undone** (Ctrl+Z undoes all mirrored strokes as one step per drag, not one step per mirrored cell)

---

## 5. Map name

- [ ] The **Map name…** input field appears at the top of the toolbar
- [ ] Type a name (e.g. `Dust III`) — name is visible in the field
- [ ] Click **Export Map** — the exported base-64 string encodes the name
- [ ] Copy the base-64 string, paste into the import field, click **Import** — map reloads with the correct name in the input field
- [ ] Name survives a 3D **Preview** (P key) and return — still shown after exiting preview
- [ ] Empty name: export/import still works; on import the name field is blank
- [ ] Name is included in URL `?map=…` param — reload the page with the URL and name appears

---

## 6. Save slots

- [ ] Five slot buttons appear: `1: [ empty ]` through `5: [ empty ]`
- [ ] **Ctrl+S** saves current map to slot 1 (first time) — button label updates to show the map name
- [ ] **Ctrl+1** saves to slot 1, **Ctrl+2** to slot 2, etc.
- [ ] **Double-click** a slot button saves to that slot — label updates
- [ ] **Single-click** a slot that has data — map loads, name field updates, slot highlights blue
- [ ] **Single-click** an empty slot — shows `Slot is empty` message in the export area for 2 s
- [ ] Saved slots **persist across page reloads** (stored in localStorage)
- [ ] After reloading the page, slot labels still show the saved map names
- [ ] Loading a slot updates the **map name field** with the saved name
- [ ] **Ctrl+S** after selecting a slot (it highlights blue) saves to that slot
- [ ] Saving to a slot updates the label immediately without requiring a reload

---

## 7. Regression — existing editor features still work

- [ ] **Floor tabs** (Ground / F1 / F2) switch floors correctly
- [ ] **Wall / Floor / Ramp / Crack / Column** tools all paint normally
- [ ] **Rotate (R)** cycles ramp direction
- [ ] **Undo (Ctrl+Z)** still works for single-cell paints
- [ ] **Clear Grid** resets all tiles
- [ ] **3D Preview (P)** loads the map in first-person; **Esc** returns to editor
- [ ] **Export Map** copies base-64 to clipboard and shows URL param
- [ ] **Import** loads a pasted base-64 string
- [ ] **[ BACK TO MENU ]** returns to the main menu overlay
- [ ] **Marker tools** (Spawn, Site A/B) still place correctly
- [ ] **Height tools** still set heightmap values; height labels appear on tiles
- [ ] **Side Wall bitmask** painting still works

---

## 8. Edge cases

- [ ] Paint while zoom is at minimum — cells are small but painting works
- [ ] Paint while zoom is at maximum — cells are large, painting works, no coord offset
- [ ] Fill an entirely-wall map with floor — fills nothing (source = target type check)
- [ ] Rect from corner to corner — entire grid painted
- [ ] Mirror mode with column tool — column appears symmetrically
- [ ] Save slot 5, then reload page, then load slot 5 — full map restores
- [ ] Type a 32-character name (maxlength) — input does not accept more characters
