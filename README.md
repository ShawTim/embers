# Embers

**A browser-based tactical SRPG built with React, TypeScript, and Three.js.**

[Play Embers](https://shawt.im/embers/) ·
[Repository](https://github.com/ShawTim/embers)

![Embers key art](public/og.png)

Lead Kael, the Black Knight of Ashwood, and his companions across Aetheria as
they confront the Cult of Endless Night. Embers combines grid-based tactical
combat, character progression, dialogue, and cinematic 3D presentation in a
game that runs directly in the browser.

> **Development status:** Embers is under active development. The project has a
> complete 20-chapter campaign structure with working chapter progression and
> end-game flow, save migration, weapon durability, and a victory shop.
> Full-campaign browser coverage and balance validation continue to be refined.
>
> See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the consolidated project review,
> verified issues, and prioritized implementation plan.

## Features

- 20 campaign chapters across a prologue and four acts
- Turn-based grid movement and tactical positioning
- Route, boss, defend, and seize objectives
- Terrain movement costs, defense bonuses, and avoidance bonuses
- Sword, lance, axe, bow, magic, and staff combat
- Weapon and magic triangle systems
- Enemy AI, bosses, reinforcements, and combat previews
- EXP, level-ups, stat growth, and class promotion
- Unit inventories, convoy items, weapon rewards, and gold economy
- Per-attack weapon and staff durability with weapon breaking
- A localized between-chapter shop with convoy equipment
- Manual save slots and autosave through `localStorage`
- English and Traditional Chinese localization
- 3D characters, environments, animations, particles, shaders, and effects
- Procedural music and sound effects
- Responsive mouse, touch, and camera controls
- Installable web-app metadata and offline asset caching

## Controls

| Input | Action |
| --- | --- |
| Click / tap | Select a unit, tile, target, or menu action |
| Drag | Rotate the battlefield camera |
| Mouse wheel / pinch | Zoom the camera |
| End Turn | Finish the player phase and begin the enemy phase |

Battlefield colors:

- **Blue:** player units
- **Red:** enemy units
- **Gold star:** boss units

## Getting started

### Requirements

- Node.js 22 recommended
- npm
- A browser with WebGL support

### Installation

```bash
git clone git@github.com:ShawTim/embers.git
cd embers
npm install
```

### Start the development server

```bash
npm run dev
```

Vite serves the game at `http://localhost:3000` by default.

To expose the development server explicitly on localhost:

```bash
npm run dev -- --host 127.0.0.1
```

### Production build

```bash
npm run build
```

The generated site is written to `dist/`.

Preview the production build locally:

```bash
npm run preview
```

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Typecheck and create a production build |
| `npm run preview` | Serve the production build on port 3000 |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e:final` | Verify the ch20 victory, epilogue, replay, and title flow against the development server |
| `npm run test:e2e:campaign` | Verify that the real Next Chapter UI preserves unit progression |
| `npm run test:e2e:full` | Run the reusable ch01–ch20 campaign acceptance driver |
| `npm run test:e2e:validate -- <dir>` | Validate an existing full-campaign artifact directory |

## Project structure

```text
.
├── src/
│   ├── App.tsx              Loading, title screen, and game shell
│   ├── audio/               Procedural audio engine
│   ├── data/                Game definitions, chapters, and dialogue
│   ├── game/                Grid, combat, AI, save system, and Zustand store
│   ├── three/               Battlefield, characters, shaders, and 3D effects
│   ├── ui/                  HUD, menus, panels, dialogue, and overlays
│   ├── i18n.ts              English and Traditional Chinese strings
│   └── types/               Shared TypeScript domain types
├── public/
│   ├── models/              Runtime GLB and glTF assets
│   ├── textures/            Runtime textures
│   └── sw.js                Service worker and asset cache
├── _unused_assets/          Assets excluded from the runtime build
├── .github/workflows/       Test and GitHub Pages deployment workflow
├── AGENTS.md                Canonical contributor and agent guide
├── CLAUDE.md                Directs Claude-based agents to AGENTS.md
├── E2E_PLAYTHROUGH_GUIDE.md Strict full-campaign E2E acceptance procedure
└── *.mjs                    Manual Playwright and visual verification scripts
```

For detailed architecture, coding conventions, save compatibility rules, and
testing expectations, read [`AGENTS.md`](AGENTS.md).

For a genuine chapter 1 through chapter 20 browser playthrough, including
anti-shortcut rules, retry behavior, evidence, and reporting requirements, read
[`E2E_PLAYTHROUGH_GUIDE.md`](E2E_PLAYTHROUGH_GUIDE.md).

## Architecture

### Game data

Static definitions are stored in `src/data/gameData.ts`, including:

- Weapons and items
- Classes and promotions
- Unit definitions
- Chapter maps, enemies, objectives, and reinforcements

Story scripts live in `src/data/dialogues.ts`.

### Runtime state

The Zustand store in `src/game/store.ts` coordinates:

- Chapter initialization
- Unit selection and movement
- Player and enemy phases
- Combat animation sequencing
- Objective completion
- Rewards, convoy, and gold
- Dialogue and cinematic state
- Save and load actions

Deterministic gameplay rules are separated into modules such as
`src/game/grid.ts`, `src/game/combat.ts`, and `src/game/ai.ts`. Persistent
between-chapter unit state and deployment live in `src/game/campaign.ts`.

Normal play uses `startNewCampaign()` and `startNextChapter()` so surviving
units retain their level, EXP, stats, promotion, equipment, and stable IDs.
Survivors fully heal between chapters, while non-lord deaths remain permanent.
The development-only `initChapter()` hook intentionally creates a fresh,
isolated chapter for debugging.

### Rendering

React Three Fiber renders the battlefield and title scene. Character models,
animation rigs, effects, terrain, decals, particles, lighting, and post
processing live under `src/three/`.

The regular React UI under `src/ui/` is layered over the 3D scene.

### Persistence

Manual saves and autosaves are stored in browser `localStorage`. Save schema
version 2 persists the campaign roster, gold, promoted classes, weapon uses,
convoy, chapter state, and completed chapters. Version-1 saves are migrated
with safe defaults when loaded.

## Testing

Run the standard checks before submitting a change:

```bash
npm test
npm run build
```

The Vitest suite covers game data, grid movement, combat, AI, save/load, audio,
and act theming.

Browser-facing changes should also be verified with Playwright:

```bash
npm run dev -- --host 127.0.0.1
npm run test:e2e:final
npm run test:e2e:campaign
```

Playwright checks should capture both browser console errors and uncaught page
errors.

The two npm E2E commands are focused regression checks. They do not replace a
real full-campaign acceptance run. See
[`E2E_PLAYTHROUGH_GUIDE.md`](E2E_PLAYTHROUGH_GUIDE.md) before delegating or
running a complete campaign playthrough.

Run the reusable full-campaign driver while the development server is active:

```bash
npm run test:e2e:full
```

The driver writes screenshots, `run.json`, `REPORT.md`, and browser errors to a
unique `/tmp/embers-e2e-*` directory. Use `E2E_MAX_CHAPTERS=1` for a limited
runner smoke check; limited runs are reported as `limited-pass`, never as a
full acceptance pass.

Useful runner options include `E2E_MAX_ATTEMPTS`, `E2E_MAX_TURNS`,
`E2E_SPEED`, `E2E_HEADLESS`, `E2E_OUTPUT_DIR`, and `BASE_URL`. The runner
creates a visible manual checkpoint at each chapter start, uses autosave for
tactical defeat retries, and uses the manual checkpoint when a critical
support casualty requires a full chapter retry.

## Localization

Embers supports:

- English
- Traditional Chinese

Player-visible strings should be added to `src/i18n.ts` in both languages.
Chapter dialogue belongs in `src/data/dialogues.ts`.

## Deployment

Pushes to `main` trigger the GitHub Actions workflow in
`.github/workflows/deploy.yml`.

The workflow:

1. Installs dependencies
2. Typechecks the project
3. Runs the Vitest suite
4. Builds the Vite application
5. Deploys `dist/` to GitHub Pages

The Vite build uses a relative base path so assets work correctly from a
GitHub Pages subdirectory.

## Contributing

Before making changes:

1. Read [`AGENTS.md`](AGENTS.md).
2. Check the current Git status.
3. Keep changes focused and avoid unrelated refactors.
4. Add tests for new deterministic gameplay behavior.
5. Test complete user flows for UI, chapter, save, and dialogue changes.
6. Run `npm test` and `npm run build`.

Do not commit generated `dist/` output, `node_modules/`, screenshots, logs, or
temporary debug files.
