# VIBE ON DUTY

A browser-based first-person shooter built entirely in a single HTML file using Three.js. No install, no build step — just open and play.

**[Play in browser →](https://szefo94.github.io/VibeOnDuty/fps3d.html)**

---

## Gameplay

Survive endless waves of enemies in a tactical indoor arena. Clear each wave to face the next. Enemies get smarter and more numerous as the waves progress.

### Enemies

- **Ground soldiers** — armed infantry that patrol, chase, and shoot. They react after a random delay and take cover in rooms.
- **Drones** — aerial units with a spotlight cone. They hover, track you, and drain your health on contact.

### Energy System

Dealing and taking damage fills your **Energy** meter. At 100% energy you can throw a grenade (RMB) — a high-damage explosive with a 9-unit blast radius.

---

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `SHIFT` | Sprint |
| `CTRL` | Crouch |
| `W + CTRL` | Slide |
| `SPACE` | Jump |
| `LMB` | Shoot |
| `RMB` | Throw grenade (costs 100% energy) |
| `R` | Reload |
| `F3` | Toggle debug overlay |
| `F4` | Toggle 3rd person camera |

---

## Features

- **3D raycasted map** — 24×24 tile grid with solid walls, cracked walls (crawl-through gaps), ramps, pillars, and multi-level heightmap terrain
- **Procedural geometry** — all characters (player body, enemies, drones) built from primitive meshes at runtime, no external assets
- **Physics** — gravity, jumping, crouching, sliding, step-height traversal on ramps and ledges
- **Enemy AI** — patrol waypoints, line-of-sight detection, reaction delay, shooting with cooldown, wave-based respawn
- **Drone AI** — floating movement, spotlight tracking, proximity damage drain
- **HUD** — ammo counter, health bar, kill counter, energy meter, minimap radar, reload bar, hit flash, damage vignette
- **Visual effects** — bullet tracers, muzzle flash, torch flicker lights, ACES filmic tone mapping, exponential fog, PCF soft shadows
- **Weapons** — M4A1 with 30-round mag, 90 reserve ammo, 1.8s reload, 88ms fire rate

---

## Stack

- [Three.js r128](https://threejs.org/) — 3D rendering (loaded via CDN)
- Vanilla JS — zero dependencies beyond Three.js
- Single `.html` file — no bundler, no framework

---

## Running Locally

```bash
# Any static file server works, e.g.:
npx serve .
# then open http://localhost:3000/fps3d.html
```

Or just open `fps3d.html` directly in Chrome/Firefox — pointer lock and all features work from `file://`.
