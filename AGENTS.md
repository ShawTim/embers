# AGENTS.md

This file is the primary working guide for AI coding agents contributing to
this repository. Read it before inspecting or changing the project.

## Project overview

**Embers** is a browser-based, turn-based strategy RPG inspired by classic
tactical RPGs. It is implemented with React, TypeScript, Three.js, React Three
Fiber, Zustand, and Vite.

The game currently contains:

- A 20-chapter campaign
- Grid movement and terrain effects
- Player and enemy turns
- Melee, ranged, magic, and staff combat
- Enemy AI and reinforcements
- EXP, level-ups, promotion, and inventory systems
- Dialogue, chapter introductions, boss cinematics, and an epilogue
- Manual save slots and autosave
- English and Traditional Chinese localization
- 3D characters, animation, effects, audio, and environment theming
- GitHub Pages deployment

## Technology

- React 19
- TypeScript
- Zustand
- Three.js
- React Three Fiber / Drei
- Vite
- Vitest
- Playwright for browser verification scripts

Use the existing stack. Do not introduce a new framework, state manager, test
runner, or styling system unless the task explicitly requires it.

## Repository structure

```text
.
├── src/
│   ├── App.tsx                 Application loading/menu/game shell
│   ├── main.tsx                React entry point
│   ├── index.css               Global UI styling
│   ├── i18n.ts                 UI and chapter localization
│   ├── audio/
│   │   ├── engine.ts           Procedural music and sound engine
│   │   └── engine.test.ts
│   ├── data/
│   │   ├── gameData.ts         Weapons, items, classes, units, chapters
│   │   ├── dialogues.ts        Dialogue scripts
│   │   ├── unitFactory.ts      Runtime unit creation and progression
│   │   └── gameData.test.ts
│   ├── game/
│   │   ├── store.ts            Central Zustand game state and orchestration
│   │   ├── grid.ts             Grid, movement, and attack-range logic
│   │   ├── combat.ts           Combat preview and resolution
│   │   ├── ai.ts               Enemy decision-making
│   │   ├── save.ts             localStorage save/load format
│   │   ├── actTheme.ts         Per-act visual themes
│   │   └── *.test.ts
│   ├── three/
│   │   ├── Scene.tsx           Main battlefield scene
│   │   ├── Unit3D.tsx          Runtime unit rendering and animation
│   │   ├── TileMap.tsx         Terrain rendering
│   │   ├── LandingScene.tsx    Title-screen 3D scene
│   │   ├── *Effects.tsx        Combat and environmental effects
│   │   └── shared/             Shared shaders, assets, and 3D helpers
│   ├── ui/                     HUD, menus, dialogue, save/load, overlays
│   └── types/index.ts          Shared domain types
├── public/
│   ├── models/                 Runtime 3D assets
│   ├── textures/               Runtime textures
│   ├── sw.js                   Service worker
│   └── manifest/SEO files
├── _unused_assets/             Assets intentionally excluded from runtime
├── .github/workflows/
│   └── deploy.yml              Test and GitHub Pages deployment
├── *.mjs                       Manual Playwright/debug verification scripts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Source-of-truth rules

- `src/data/gameData.ts` is the source of truth for game definitions.
- `src/data/dialogues.ts` is the source of truth for story dialogue.
- `src/types/index.ts` defines shared domain shapes.
- `src/game/store.ts` coordinates runtime state and multi-system flows.
- `src/game/save.ts` owns the persisted save schema and storage keys.
- `src/i18n.ts` owns player-visible UI and chapter translations.
- `public/` contains files served directly by Vite.

Do not duplicate definitions across files when an existing source of truth can
be imported.

## Important architectural guidance

### Application state

The project currently has two levels of state:

1. Application screen state in `App.tsx` (`loading`, `menu`, or `game`)
2. Gameplay state in the Zustand store (`player`, `enemy`, `combat`,
   `victory`, `defeat`, or `epilogue`)

Be careful when a feature crosses this boundary. A store reset alone does not
change the application screen state.

### Game store

`src/game/store.ts` is already large. When adding substantial self-contained
logic, prefer extracting pure helpers or focused modules rather than continuing
to grow the store.

Keep store actions responsible for orchestration. Put deterministic rules in
testable modules such as `combat.ts`, `grid.ts`, `ai.ts`, or a new focused
module.

### Runtime objects

`RuntimeUnit` instances are mutable and are also referenced by `GameGrid`.
When mutating units or the grid:

- Keep the unit array and grid occupancy consistent.
- Trigger a Zustand update after mutation so React rerenders.
- Do not leave dead units occupying grid cells.
- Preserve stable unit IDs when loading saves.
- Clone static data definitions before mutating values that belong to a
  particular unit or inventory entry.

### Campaign progression

Changes involving chapter transitions must preserve intended campaign state,
including:

- Unit level and EXP
- Stats and promotion
- HP where appropriate
- Unit weapon inventories and equipped weapon
- Convoy contents and remaining uses
- Gold
- Completed chapters

Do not silently recreate progressed player units from base definitions unless
the task explicitly requests a fresh chapter/debug reset.

### Dialogue and battle completion

Dialogue triggers and objective completion form a state machine. When adding or
changing a dialogue:

- Define what happens after the final line is dismissed.
- Ensure boss-death dialogue can transition into chapter victory.
- Prevent a completed trigger from reopening indefinitely.
- Ensure chapter rewards are granted only at the intended time.
- Test the complete sequence, not only the first dialogue appearing.

### Save compatibility

Save data is player data. Treat schema changes carefully.

When adding persistent state:

1. Add it to `SavePayload`.
2. Write it in manual saves and autosaves.
3. Restore it in load hydration.
4. Update tests.
5. Increment or migrate the save version when compatibility requires it.
6. Provide safe defaults for older saves when practical.

Never add a gameplay currency, progression field, or inventory field without
considering save/load behavior.

### Localization

Player-visible text should use `src/i18n.ts`.

- Add both English (`en`) and Traditional Chinese (`zh`) strings.
- Use the existing `t()` and chapter/unit/item naming helpers.
- Avoid embedding English-only messages in store actions or components.
- Keep interpolation parameters explicit and typed where possible.

Developer-facing logs, comments, and test descriptions may remain in English.

### 3D assets and loading

- Runtime models belong under `public/models/`.
- Assets not used by the shipped game belong under `_unused_assets/`.
- Use `import.meta.env.BASE_URL` or the existing asset path helpers.
- Keep GitHub Pages' relative `base: "./"` behavior working.
- Update the application preload list and `public/sw.js` together when runtime
  assets change.
- Avoid loading or parsing the same large GLB multiple times without a measured
  reason.
- Do not commit generated `dist/` output.

### Performance

The main bundle and 3D assets are significant. For rendering changes:

- Avoid per-frame React state updates.
- Reuse geometries, materials, textures, and parsed assets where safe.
- Dispose of Three.js resources created dynamically.
- Use `useMemo`, refs, instancing, or level-of-detail techniques where they
  materially reduce work.
- Test both initial loading and in-battle rendering.

## Coding conventions

- TypeScript strict mode must continue to pass.
- Prefer explicit domain types over `any`.
- Do not add new `as any` casts unless integration constraints genuinely
  require them.
- Use functional Zustand updates when deriving new state from current state.
- Keep functions focused and give gameplay transitions descriptive names.
- Preserve existing formatting: double quotes, semicolons, and two-space
  indentation.
- Avoid unrelated refactors while fixing a targeted issue.
- Comments should explain why or describe a non-obvious invariant, not restate
  the code.
- Do not swallow errors silently in new code unless failure is intentionally
  non-fatal; provide a useful fallback or diagnostic.

## Testing requirements

Run these before considering a change complete:

```bash
npm test
npm run build
```

For browser/game-flow changes, also run a relevant Playwright check against the
Vite development server:

```bash
npm run dev -- --host 127.0.0.1
node <relevant-script>.mjs
```

When adding behavior:

- Add unit tests for deterministic logic.
- Add store-level regression coverage for state transitions.
- Use browser tests for UI, dialogue, chapter flow, loading, and 3D integration.
- Capture console errors and `pageerror` events in Playwright scripts.
- Test the full user-visible result, not merely that an internal action exists.

High-priority flows that should remain covered include:

- Starting a new game
- Completing route, boss, defend, and seize objectives
- Boss-death dialogue followed by victory
- Moving from one chapter to the next without losing progression
- Manual save and autosave round trips
- Promotion and inventory persistence
- Gold earning, spending, and persistence
- Chapter 20 victory, credits, epilogue, replay, and return to title

### Full-campaign E2E acceptance

For a genuine chapter 1 through chapter 20 playthrough, follow
[`E2E_PLAYTHROUGH_GUIDE.md`](E2E_PLAYTHROUGH_GUIDE.md). It defines the allowed
driver controls, prohibited state shortcuts, retry policy, tactical
requirements, screenshots, machine-readable results, and pass criteria.

Focused E2E scripts that directly arrange store state are regression checks;
they do not count as evidence that the full campaign is playable end to end.

## Git and workspace hygiene

- Check `git status` before and after work.
- Do not modify unrelated untracked debug files.
- Do not commit `node_modules/`, `dist/`, screenshots, logs, or temporary files.
- Put disposable scripts and output under `/tmp` where practical.
- If a verification script is worth keeping, make it deterministic and add it
  intentionally rather than leaving another ad-hoc debug script.
- Follow the repository's existing commit style, such as:

```text
feat: ...
fix(save): ...
test: ...
perf(load): ...
```

## Dependency and package-manager guidance

The repository currently uses `package-lock.json`, and CI runs npm commands.
Use npm unless the project is deliberately migrated in a dedicated change.
Keep `package.json`, the lockfile, local commands, and CI consistent.

Do not add a dependency when a small, clear implementation using the existing
stack is sufficient.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`:

1. Install dependencies
2. Typecheck
3. Run Vitest
4. Build with Vite
5. Deploy `dist/` to GitHub Pages

Changes must continue to work under a relative GitHub Pages path. Avoid
root-absolute asset URLs.

## Definition of done

A task is complete when:

- The requested behavior works through the actual user flow.
- Relevant state survives transitions and save/load when expected.
- English and Traditional Chinese UI are both handled.
- Unit tests and production build pass.
- Browser-facing changes have been smoke-tested without console errors.
- No unrelated files or generated artifacts were added.
- Documentation is updated if architecture or contributor workflow changed.
