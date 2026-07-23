# Full-Campaign E2E Playthrough Guide

This document is the execution contract for an AI agent performing a genuine
end-to-end playthrough of **Embers**. It is intentionally explicit so that a
lower-capability model can follow it without inventing shortcuts.

The run is an acceptance test, not a debug simulation. A passing run must start
at the title screen, play chapters 1 through 20 in order, use the real
between-chapter flow, reach the epilogue, and return to the title screen.

## 1. Required result

A complete run must verify all of the following:

- The title screen loads and starts a new campaign.
- Chapters `ch01` through `ch20` are reached in order.
- Every transition uses the real **Next Chapter** UI.
- Route, boss, defend, and seize objectives can be completed.
- Boss-death and victory dialogue chains finish correctly.
- Levels, EXP, promotions, surviving units, deaths, inventory, weapon uses,
  convoy contents, and gold remain coherent across chapters.
- Broken weapons are removed and replacement weapons can be equipped.
- The Victory Shop charges the correct gold and adds purchased stock.
- Chapter 20 proceeds through victory dialogue, credits, and the epilogue.
- **Return to Title** clears the active chapter and shows the title screen.
- No unclassified browser console error or uncaught page error occurs.

The run is **failed or incomplete** if any required chapter is skipped, state is
fabricated, or a prohibited shortcut is used.

## 2. Read before running

Read these files before writing the driver:

1. [`AGENTS.md`](AGENTS.md)
2. [`README.md`](README.md)
3. `src/types/index.ts`
4. `src/data/gameData.ts`
5. `src/game/store.ts`
6. `src/game/grid.ts`
7. `src/game/combat.ts`
8. `src/game/save.ts`
9. `src/ui/ActionMenu.tsx`
10. `src/ui/HUD.tsx`
11. `src/ui/ShopModal.tsx`
12. `src/ui/SaveLoadModal.tsx`
13. `src/ui/OutroOverlay.tsx`

Existing focused checks are useful as references:

- `tests/e2e/campaign-transition.mjs`
- `tests/e2e/final-flow.mjs`

Those focused checks intentionally manipulate state to isolate regressions.
They are baseline tests only and are **not** evidence of a genuine full
campaign completion.

The root-level `e2e_playthrough.mjs` is a legacy stress/reference script. Do
not copy its direct chapter initialization, state mutation, timer patching, or
artifact naming into the acceptance run.

## 3. Non-negotiable rules

### 3.1 Prohibited shortcuts

The driver and the executing agent must not:

- Call `window.__initChapter`.
- Call `initChapter()` after the new campaign has started.
- Call Zustand `setState()` or otherwise replace store state.
- Mutate a unit, grid, array, map, inventory entry, or store object obtained
  through `getState()`.
- Change HP, EXP, level, stats, class, position, turn, phase, gold, dialogue,
  inventory, weapon uses, objective state, or grid occupancy directly.
- Mark units dead, remove enemies from the grid, or force reinforcements.
- Force victory, defeat, credits, epilogue, or chapter completion.
- Skip to another chapter after a defeat.
- Globally patch `setTimeout`, `setInterval`, animation timing, random number
  generation, or browser clocks.
- Disable enemy AI, combat animation, objective checks, or save behavior.
- Modify production code to make the playthrough easier.
- Fabricate outcomes, metrics, screenshots, dialogue, or observations.
- Continue and report a pass after an assertion or baseline check fails.

Reading `window.__game.getState()` is allowed. Treat every object returned by
it as read-only.

### 3.2 Allowed controls

Use visible UI interactions wherever practical. Visible UI interaction is
required for:

- Starting the campaign.
- Advancing and dismissing dialogue.
- Opening and using save/load screens.
- Opening and using the Victory Shop.
- Pressing **Next Chapter**.
- Pressing epilogue/replay/title buttons.

The 3D battlefield is canvas-based, so the driver may invoke the same public
store actions used by the battlefield UI when reliable canvas coordinates are
not practical. Limit this to legal player input:

- `selectUnit(unit)`
- `onTileClick(position)`
- `waitUnit()`
- `endPlayerTurn()`

Only call these actions when the current phase and selection state make the
same action available to a player. Prefer `onTileClick()` to calling
`attackTarget()` or `healTarget()` directly, because `onTileClick()` exercises
the normal selection and targeting flow.

Do not call campaign, reward, shop, promotion, save, load, dialogue, or outro
actions directly merely to bypass their visible UI.

## 4. Workspace and artifact hygiene

Use a temporary Playwright driver at:

```text
tests/e2e/full-campaign-run.local.mjs
```

This location allows the script to resolve the repository's local Playwright
dependency. The file is disposable:

- Do not commit it.
- Delete it after the run unless the user explicitly asks to retain it.
- Do not overwrite any existing E2E or debug script.

Create a unique output directory outside the repository:

```text
/tmp/embers-e2e-YYYYMMDD-HHMMSS/
```

Store all screenshots, JSON, Markdown, and logs there. Never write generated
artifacts to `playthrough/`, `public/`, `src/`, or another tracked repository
directory.

At minimum, the output directory must contain:

```text
run.json
REPORT.md
browser-errors.log
screenshots/
```

## 5. Preflight

From the repository root, record the commit hash and working-tree status:

```bash
git rev-parse HEAD
git status --short
```

Do not clean, reset, stash, stage, or modify unrelated files.

Run the baseline checks:

```bash
npm test
npm run build
```

Then start the development server in a separate process:

```bash
npm run dev -- --host 127.0.0.1
```

Wait for the actual URL printed by Vite. The current E2E scripts default to
`http://127.0.0.1:3000/`, but the driver must use the URL Vite actually
provides.

With the server running, execute:

```bash
npm run test:e2e:campaign
npm run test:e2e:final
```

If any preflight command fails:

1. Save the command and complete output.
2. Mark the full run `blocked-preflight`.
3. Do not start or fake the campaign playthrough.

The focused E2E scripts use direct state setup by design. Running them during
preflight does not grant permission to use those shortcuts in the full run.

## 6. Browser configuration

Use Chromium with a deterministic desktop viewport:

```js
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
```

Create a fresh browser context so an old autosave cannot replace the intended
new campaign. Do not preload or edit local storage.

Capture both browser error channels from before navigation:

```js
const browserEvents = [];

page.on("pageerror", error => {
  browserEvents.push({
    kind: "pageerror",
    text: error.message,
    timestamp: new Date().toISOString(),
  });
});

page.on("console", message => {
  if (message.type() === "error") {
    browserEvents.push({
      kind: "console-error",
      text: message.text(),
      timestamp: new Date().toISOString(),
    });
  }
});
```

Do not silently ignore WebGL messages. If a known headless SwiftShader warning
appears, record and classify it with the exact text and reason. Every other
error remains a failure until investigated.

## 7. Record raw state, not assumptions

Create a read-only snapshot helper. Copy primitive values and plain objects out
of the page; never return live unit or grid objects for mutation.

Each snapshot should include at least:

- Timestamp.
- Chapter ID and localized/displayed chapter name.
- Objective type and objective text.
- Store `turn` and `phase`.
- Active dialogue ID.
- Gold.
- Completed chapters.
- Convoy entries with IDs, types, and remaining uses.
- Every unit's stable ID, definition ID, faction, position, HP, max HP, level,
  EXP, class ID, promotion state, alive/dead state, acted state, weapons,
  equipped weapon, and remaining uses.
- Relevant UI visibility, including title, dialogue, shop, victory, defeat, and
  outro overlays.

Always use the store's actual `turn`. A local loop counter may be recorded as a
debug field, but it must never be presented as the in-game turn.

Take a before-and-after snapshot around every important action. If the observed
state does not match the intended action, stop and diagnose it rather than
continuing on an assumption.

## 8. Main campaign procedure

### 8.1 Title and new campaign

1. Navigate to the Vite URL.
2. Wait until the title screen and **Start Game** button are visible.
3. Assert that no active campaign grid is displayed.
4. Capture `screenshots/00_title.png` **before** clicking Start Game.
5. Click the visible **Start Game** button.
6. Wait until the store reports chapter ID `ch01`.
7. Assert that the chapter 1 intro/dialogue belongs to `ch01`.
8. Record the initial roster, convoy, gold, and browser errors.

Do not use an autosave or direct campaign action for this step.

### 8.2 Repeat for every chapter

For expected chapter number `01` through `20`:

1. Assert that the exact chapter ID is `chNN`. Do not rely only on visible
   chapter text.
2. Record chapter name, objective type, objective text, start turn, start
   roster, gold, convoy, equipment, promotions, and weapon uses.
3. If the chapter intro is visible, assert its chapter/dialogue identity before
   capturing `chNN_intro.png`.
4. Advance the intro through visible dialogue clicks until the gameplay state
   is available.
5. Capture `chNN_start.png`.
6. Play legal player and enemy turns until the objective completes or defeat
   occurs.
7. Record snapshots at the start and end of every in-game turn.
8. Optionally capture `chNN_turn_XX.png` only after asserting a stable store
   turn and phase.
9. When a boss dies, finish the complete boss-death and victory dialogue chain
   through visible clicks. Do not assume the first dialogue means victory.
10. Assert the exact result phase before capturing:
    - `chNN_victory.png`, or
    - `chNN_defeat_attempt_A.png`.
11. Record end turn, survivors, deaths, levels, promotions, broken weapons,
    gold, convoy, and dialogue sequence.
12. On victory, use the shop and transition procedure below.

Never initialize the next chapter merely because the script's local chapter
loop advanced.

At every non-defeat snapshot, assert that a living lord is present. If the game
reports victory while the lord is absent or dead, record a critical battle-end
bug and stop instead of continuing to the next chapter.

### 8.3 Dialogue handling

Dialogue is a state machine, not a delay:

1. Record the active dialogue ID before interacting.
2. Click the visible dialogue overlay once.
3. Wait for the line, dialogue ID, phase, or overlay visibility to change.
4. Record the new state.
5. Repeat with a bounded maximum number of clicks.

If the dialogue does not change, stop and report the stuck state. Do not clear
dialogue through the store.

For boss chapters, explicitly record this progression where applicable:

```text
battle -> boss-death dialogue -> victory phase/dialogue -> victory UI
```

For chapter 20, the expected progression must be observed rather than forced:

```text
ch20 boss death -> ch20 victory -> ch20 credits -> epilogue
```

### 8.4 Victory Shop and next chapter

For chapters 1 through 19:

1. Assert `phase === "victory"`.
2. Record gold and convoy before shopping.
3. Open the Victory Shop using its visible button.
4. Inspect visible stock and prices.
5. Buy only affordable, useful items.
6. After each click, assert the expected gold reduction and convoy addition.
7. Record rejected purchases as rejected; do not claim that stock was added.
8. Close the shop through its visible control.
9. Click the visible **Next Chapter** button.
10. Wait for the exact next chapter ID.
11. Assert that campaign state was preserved and survivors were restored
    according to the game's chapter-transition rules.

At transition, compare stable unit IDs and verify:

- Levels and EXP did not revert.
- Promoted classes did not revert.
- Non-lord deaths did not return unexpectedly.
- Surviving units retained inventory and remaining weapon uses.
- Broken weapons did not reappear.
- Gold and convoy reflect rewards and purchases.

Do not click **Next Chapter** before recording the victory state.

### 8.5 Chapter 20 and ending

Chapter 20 has no ordinary next-chapter transition:

1. Complete the objective legally.
2. Record the exact dialogue IDs and phase after every dismissal.
3. Assert `phase === "epilogue"` and that the epilogue UI is visible.
4. Only then capture `screenshots/ch20_epilogue.png`.
5. Record whether replay and return controls are visible.
6. Click the visible **Return to Title** control.
7. Assert:
   - `.start-screen` is visible.
   - The active chapter ID is `null`.
   - No game grid is present.
8. Capture `screenshots/99_return_to_title.png`.

If replay is also tested, do it in a separate browser context or separate
recorded ending branch so it cannot obscure the required Return to Title
result.

## 9. Tactical player requirements

The tactical controller does not need to be optimal, but it must be legal,
repeatable, and capable of finishing the campaign.

### 9.1 Unit processing

- Process every living, unacted player unit before ending the turn.
- If one unit has no useful action, wait that unit and continue with the next
  unit. Do not break the whole unit loop.
- Never attempt to act with a dead unit or a unit that has already acted.
- Re-read state after every move, attack, heal, dialogue, level-up, promotion,
  reinforcement, and enemy phase.
- Use bounded loops and emit a diagnostic snapshot if no progress is made.

### 9.2 Movement

- Use the grid's legal move-range/path results.
- Select destinations from the path endpoint, not from arbitrary coordinates.
- Route around walls, occupied tiles, terrain costs, and choke points.
- Do not rely only on greedy Manhattan distance; it can repeatedly choose an
  unreachable side of an obstacle.
- Prefer defensible terrain and avoid exposing fragile units to several enemy
  ranges at once.
- Keep the lord alive. Treat a lord death as a real defeat.

### 9.3 Attacking

- Check that a compatible equipped weapon exists and has uses remaining.
- Generate attack range from the candidate destination tile.
- Evaluate enemy counter range from that same candidate destination tile, not
  from the attacker's original tile.
- Prefer safe kills, weakened targets, dangerous ranged enemies, healers, and
  objective-critical bosses.
- Avoid attacks that expose the lord to a likely lethal counter or enemy
  phase.
- After combat, wait for combat resolution and reread state before issuing the
  next action.

### 9.4 Healing and support

- Heal wounded allies when a legal heal is available.
- Prioritize the lord and units at immediate risk.
- If no heal is available, keep the healer near the lord or the main group;
  do not send the healer toward enemies as if it were an attacker.
- Check staff uses before healing and record the staff if it breaks.

### 9.5 Objective behavior

**Route**

- Defeat every required enemy.
- Account for reinforcements before declaring the map clear.

**Boss**

- Advance toward the boss without ignoring lethal enemy coverage.
- Defeat the required boss; do not assume unrelated enemies are the objective.
- Finish the boss-death dialogue chain.

**Defend**

- Record the required turn limit from chapter data/state.
- Move toward safe terrain, choke points, and mutually supporting positions.
- Heal and rotate damaged front-line units.
- Do not blindly leave all units at their spawn tiles.
- Continue until the game itself declares victory.

**Seize**

- Identify the exact seize tile.
- Keep a legal seizing unit alive and path it to that tile.
- Explicitly perform the normal move/action flow required by the game.
- Assert that the game, rather than the driver, changed to victory.

## 10. Durability, convoy, promotion, and economy

Weapon durability is part of the acceptance test:

- Record uses before and after every attack or heal.
- Record the weapon ID and unit when uses reach zero.
- Assert that a broken weapon is removed and is no longer equipped.
- Do not directly add uses or restore a broken weapon.
- If a unit lacks a usable weapon, open its real action/equipment UI and equip
  a compatible carried or convoy weapon.
- If no compatible weapon exists, record the soft-lock risk and use a prior
  autosave retry with a better shop plan.

Use the Victory Shop to reduce avoidable campaign soft locks:

- Maintain stock of basic weapon types used by surviving units.
- Maintain at least one usable staff when a staff user survives.
- Consider buying a Master Seal for an eligible level 10+ unit.
- Never spend more gold than the store reports.
- Record every purchase, price, gold before/after, and resulting convoy entry.

Promotions must occur only through the normal visible item/action flow. Record
the unit, old class, new class, level, and the consumed seal.

## 11. Defeat and retry policy

A genuine campaign must not silently continue after defeat.

For each chapter:

1. Capture the defeat state and `chNN_defeat_attempt_A.png`.
2. Record the cause, turn, roster, inventory, and browser errors.
3. Retry the same chapter using the visible autosave load flow.
4. Assert that the loaded chapter ID is still `chNN`.
5. Assert that the loaded state is a player-turn checkpoint with at least one
   living, unacted player unit.
6. Adjust legal tactics from that checkpoint or an earlier shop decision.

Autosave is intended to represent the beginning of a player turn, before that
turn's actions are committed. A load that restores defeat, enemy phase, no
living lord, or zero unacted player units is an invalid retry checkpoint:

- Do not count repeatedly replaying that state as additional tactical attempts.
- Capture the invalid checkpoint once.
- Stop and report an autosave/retry bug if no earlier usable manual save exists.

Maximum attempts per chapter: **3**.

After three failed attempts:

- Stop the playthrough.
- Mark the run `failed-incomplete`.
- Report the last completed chapter and all attempt details.
- Do not call chapter initialization or advance to the next chapter.

If no usable autosave exists, stop and report that fact. Do not synthesize one.

## 12. Screenshot contract

Screenshots are evidence and must be state-labelled accurately.

Required:

```text
screenshots/00_title.png
screenshots/ch01_intro.png       # only when asserted
screenshots/ch01_start.png
screenshots/ch01_victory.png     # or defeat attempt image
...
screenshots/ch20_intro.png       # only when asserted
screenshots/ch20_start.png
screenshots/ch20_victory.png
screenshots/ch20_epilogue.png
screenshots/99_return_to_title.png
```

Rules:

- Capture the title before Start Game.
- Capture an intro only after checking the current chapter and dialogue.
- Capture start after pre-battle dialogue has been dismissed.
- Name mid-chapter screenshots with the actual store turn.
- Capture result only after asserting exact `victory` or `defeat`.
- Capture `ch20_epilogue.png` only when `phase === "epilogue"`.
- Never copy, rename, or reuse an older screenshot as current evidence.

## 13. Required machine-readable output

Write `/tmp/embers-e2e-<timestamp>/run.json`. Suggested minimum shape:

```json
{
  "status": "passed | failed-incomplete | blocked-preflight",
  "metadata": {
    "commit": "",
    "startedAt": "",
    "finishedAt": "",
    "baseUrl": "",
    "browser": "chromium",
    "viewport": { "width": 1280, "height": 720 },
    "commands": []
  },
  "title": {
    "visibleBeforeStart": false,
    "screenshot": ""
  },
  "chapters": [
    {
      "id": "ch01",
      "name": "",
      "objectiveType": "",
      "objectiveText": "",
      "attempts": 1,
      "startTurn": 1,
      "endTurn": 0,
      "outcome": "victory | defeat | incomplete",
      "dialogueSequence": [],
      "startRoster": [],
      "endRoster": [],
      "deaths": [],
      "levelChanges": [],
      "promotions": [],
      "goldBefore": 0,
      "goldAfter": 0,
      "convoyBefore": [],
      "convoyAfter": [],
      "purchases": [],
      "brokenWeapons": [],
      "screenshots": [],
      "errors": []
    }
  ],
  "ending": {
    "reachedEpilogue": false,
    "returnedToTitle": false
  },
  "browserEvents": []
}
```

Use arrays or additional fields when needed, but do not omit raw facts because
the run was unsuccessful.

Write browser events to `browser-errors.log` as well as `run.json`. If there
are no events, write an explicit `No browser errors captured.` line.

Before finalizing `run.json`, validate its internal counts:

- Each chapter's `attempts` must equal the number of attempt-detail records.
- A chapter attempted once must report `attempts: 1`, not zero.
- A failed chapter must not report more attempts than were actually executed.
- Screenshot paths must point to files that exist.
- A passing run must not contain skipped chapters.

## 14. Required human-readable report

Write `/tmp/embers-e2e-<timestamp>/REPORT.md` with these sections:

1. **Executive Result**
   - Passed, failed-incomplete, or blocked-preflight.
   - Last completed chapter.
   - Whether epilogue and Return to Title were reached.
2. **Chapter Results**
   - One table row per chapter with attempts, objective, result, store turn,
     deaths, promotions, and screenshot paths.
3. **Campaign Progression**
   - Level/EXP growth, promotions, stable IDs, permanent deaths, and transition
     persistence.
4. **Economy and Durability**
   - Rewards, purchases, gold, convoy changes, remaining uses, breaks, and
     replacement equipment.
5. **Dialogue and Ending**
   - Boss-death/victory sequences and the exact chapter 20 ending sequence.
6. **Bugs**
   - Severity, chapter, exact reproduction steps, expected result, actual
     result, and supporting artifacts.
7. **Balance Observations**
   - Clearly labelled subjective observations, separate from bugs.
8. **Artifacts**
   - Absolute paths to `run.json`, logs, and screenshot directory.

Do not let narrative impressions contradict `run.json`. Raw store facts are the
source of truth; impressions must be labelled as interpretation.

## 15. Pass/fail criteria

Mark the run `passed` only if all conditions are true:

- `ch01` through `ch20` were reached in order.
- Start Game and every chapter transition used visible UI.
- No direct initialization, state mutation, timer patch, or forced result was
  used.
- All required objectives completed through legal game actions.
- Campaign progression, economy, inventory, and durability remained coherent.
- The chapter 20 dialogue chain reached `phase === "epilogue"`.
- Return to Title showed the title screen with no active chapter/grid.
- Every browser/page error was either resolved or explicitly classified as a
  verified harmless environment warning.
- `run.json`, `REPORT.md`, logs, and required screenshots exist and agree.

Anything else is `failed-incomplete` or `blocked-preflight`, never a partial
pass.

## 16. Final cleanup and handoff

After writing all artifacts:

1. Close the browser.
2. Stop only the Vite process started for this run.
3. Delete `tests/e2e/full-campaign-run.local.mjs` unless retention was
   requested.
4. Run `git status --short`.
5. Confirm that no generated screenshot, log, or build output was added to the
   repository.
6. Verify every path listed in `REPORT.md` exists.
7. Verify the required screenshots, `run.json`, `REPORT.md`, and
   `browser-errors.log` exist and are non-empty.
8. Return the absolute artifact directory and a concise result summary.

## Copyable assignment for an execution agent

Use this prompt when delegating the run:

> Read `AGENTS.md` and `E2E_PLAYTHROUGH_GUIDE.md` completely. Perform one
> genuine full-campaign E2E acceptance run exactly as specified. Do not call
> direct chapter initialization, mutate Zustand state, patch timers, skip a
> defeat, or modify production code. Use visible UI for campaign/dialogue/shop/
> save/outro flows and only the permitted public battlefield actions when
> canvas input is impractical. Store every artifact under a unique
> `/tmp/embers-e2e-<timestamp>/` directory, produce both `run.json` and
> `REPORT.md`, clean up the temporary driver, and report the absolute artifact
> path. A partial run must be reported as failed-incomplete, not passed.
