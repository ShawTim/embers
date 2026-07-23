# Embers Project Status and Implementation Plan

Last reviewed: **July 23, 2026**

This document consolidates the repository review and the automated ch01–ch20
playthrough report. It defines the order of work required to make the campaign
reliably completable before further balance tuning or feature expansion.

## Progress log

### July 23, 2026 — Milestone 4 completed

Completed:

- Added durability consumption for player attacks, enemy attacks, counters,
  follow-up attacks, misses, and staff healing.
- Limited follow-up attacks and counters when a weapon does not have enough
  remaining uses.
- Removed weapons at zero uses and automatically equipped the next available
  weapon.
- Added localized weapon-break combat-log messages and exposed remaining uses
  in the unit, inventory, and equipment interfaces.
- Added a localized Victory Shop with prices, descriptions, owned quantities,
  current gold, success feedback, and insufficient-gold feedback.
- Added a convoy withdrawal/equip flow so purchased weapons are usable by
  compatible classes.
- Extended the campaign browser test to earn the ch01 reward, reject an
  unaffordable purchase, buy a Steel Sword through the UI, and preserve the
  purchase into ch02.
- Added unit and store regression tests for attack durability, misses,
  low-durability follow-ups, weapon breaking, automatic equipment, staff use,
  purchases, insufficient funds, and convoy equipment.

Verification:

- `npm test`: **91 tests passed**
- `npm run build`: **passed**
- `npm run test:e2e:campaign`: **passed**
- `npm run test:e2e:final`: **passed**
- No browser console or page errors were reported by either E2E test.

Next milestone: **Milestone 5 — Replace the playthrough with a trustworthy
campaign E2E**.

### July 23, 2026 — Milestone 3 completed

Completed:

- Upgraded persisted data to save schema version 2.
- Added gold, campaign roster, promoted class, maximum HP, per-weapon
  durability, equipped weapon, completed chapters, active dialogue, and
  one-shot victory flags to manual saves and autosaves.
- Centralized runtime-unit serialization and restored cloned weapon instances
  rather than shared static definitions.
- Added automatic version-1 migration with safe defaults for fields that did
  not previously exist.
- Restored exact battlefield HP while preserving the full-heal policy only for
  normal Next Chapter transitions.
- Added save tests for version-1 migration, invalid data, promoted classes,
  weapon uses, dead units, completed chapters, and grid hydration.
- Added store-level manual-save and autosave round-trip tests for gold,
  promotion, convoy contents, durability, stable IDs, and permadeath.

Verification:

- `npm test`: **83 tests passed**
- `npm run build`: **passed**
- `npm run test:e2e:campaign`: **passed**
- `npm run test:e2e:final`: **passed**
- No browser console or page errors were reported by either E2E test.

Next milestone: **Milestone 4 — Complete the economy and inventory**.

### July 23, 2026 — Milestone 2 completed

Completed:

- Added a campaign roster that preserves stable unit IDs, level, EXP, stats,
  maximum HP, class/promotion state, personal weapons, equipped weapon, and
  alive/dead state.
- Added separate `startNewCampaign()`, `startNextChapter()`, and fresh
  `initChapter()` paths so normal progression no longer uses static base units.
- Defined the between-chapter policy: surviving units fully heal and non-lord
  deaths remain permanent.
- Added authored recruit availability for Maren, Darius, and Yuki.
- Cloned weapon definitions when creating units and when promotion grants a
  weapon, preventing runtime inventories from sharing mutable definitions.
- Fixed the promotion UI so the player can choose an eligible unit and apply a
  Master Seal without relying on an already-selected battlefield unit.
- Added store regression coverage for progression, promotion, equipment,
  recruits, permadeath, and isolated debug initialization.
- Added `tests/e2e/campaign-transition.mjs`, which completes ch01, clicks the
  actual Next Chapter button, and verifies the preserved ch02 roster.

Verification:

- `npm test`: **80 tests passed**
- `npm run build`: **passed**
- `npm run test:e2e:campaign`: **passed**
- `npm run test:e2e:final`: **passed**
- No browser console or page errors were reported by either E2E test.

Next milestone: **Milestone 3 — Upgrade save data safely**.

### July 23, 2026 — Milestone 1 completed

Completed:

- Added Zustand-store regression tests for route, boss, defend, seize, defeat
  precedence, reward idempotency, and the complete ch20 dialogue chain.
- Added explicit boss-death completion state so the dialogue cannot reopen.
- Centralized victory resolution and made rewards idempotent per chapter run.
- Fixed the ch20 sequence from boss death to victory, credits, and epilogue.
- Connected the epilogue Return to Title action to the application screen
  state.
- Added `tests/e2e/final-flow.mjs` and the `npm run test:e2e:final` command.
- Verified the final flow in Chromium without console or page errors.

Next milestone: **Milestone 2 — Preserve campaign progression**.

## Executive summary

Embers has a substantial playable foundation:

- All 20 chapters can be initialized and rendered.
- Grid movement, combat, AI, dialogue, audio, and 3D presentation are working.
- The production build passes.
- The existing Vitest suite passes.
- A long headless browser run completed without JavaScript or page errors.

Milestones 1 and 2 have resolved the chapter-completion, final-flow,
application-navigation, and between-chapter progression blockers.

The project is **not release-ready** because full-campaign acceptance coverage
and balance validation are still incomplete:

1. The full 20-chapter automated run still bypasses real campaign navigation
   and is not a trustworthy balance benchmark.
2. Late-game balance has not yet been re-measured using preserved progression,
   shopping, and durability.

The 20-chapter E2E report also indicates a severe late-game difficulty spike,
but balance changes should wait until campaign progression is preserved and the
playthrough harness represents a real campaign.

## Current verification baseline

At the time of review:

| Check | Result |
| --- | --- |
| `npm test` | 91 tests passed |
| `npm run build` | Passed |
| Production dependency audit | No reported vulnerabilities |
| Final-flow browser test | Passed without console/page errors |
| Campaign-transition browser test | Passed without console/page errors |
| Full headless chapter initialization | ch01–ch20 rendered |
| Main production bundle | Approximately 1.49 MB / 423 KB gzip |
| Campaign definitions | 20 chapters |

The existing test suite covers pure game modules reasonably well, but it does
not adequately cover the central Zustand store, UI transitions, campaign
continuity, or full chapter completion flows.

## Consolidated findings

### P0 — Campaign blockers

#### 1. Boss-death dialogue can prevent victory

**Status: Resolved in Milestone 1.**

For boss objectives, `checkBattleEnd()` opens the boss-death dialogue and
returns. Dismissing the dialogue clears `activeDialogue`, but does not record
that the trigger has completed or continue the victory transition.

On the next battle-end check, the same boss-death dialogue opens again.

Observed behavior:

- ch01 reaches `ch01_boss_death`.
- The store remains in the `player` phase.
- Dismissing the dialogue does not produce victory.
- Rechecking the objective reopens the same dialogue.

Impact:

- Multiple boss chapters can become impossible to finish.
- Chapter rewards may never be granted.
- The final chapter cannot reliably reach credits or the epilogue.

#### 2. Player progression resets between chapters

**Status: Resolved in Milestone 2 for live chapter transitions. Save/load
support remains part of Milestone 3.**

`initChapter()` creates player units from static definitions every time a
chapter begins.

The following state is lost:

- Level and EXP
- Stat gains
- Promotion and promoted class
- Current HP
- Personal weapon inventory
- Equipped weapon
- Defeated/permadeath state

The playthrough report confirms that Kael is still level 1 in late chapters.
This is likely the primary reason the reported difficulty becomes extreme.

#### 3. Return to Title does not return to the title screen

**Status: Resolved in Milestone 1.**

The store's `returnToTitle()` action clears the grid, but the application-level
screen state in `App.tsx` remains `game`.

The application then detects a missing grid and immediately initializes
chapter 1.

Observed result:

- The epilogue Return to Title button closes the epilogue.
- The title screen does not appear.
- A fresh ch01 starts automatically.

#### 4. Chapter 20 ending flow is not reliable

**Status: Resolved in Milestone 1 and covered by
`tests/e2e/final-flow.mjs`.**

The intended sequence is:

```text
Defeat Zethar
→ boss-death dialogue
→ victory
→ ch20 victory dialogue
→ credits dialogue
→ epilogue
→ return to title or play again
```

The boss-death state-machine issue prevents this sequence from being reliable.
The E2E artifact named `ch20_epilogue.png` is still a defeat screen; the raw
report records the final phase as `defeat`.

### P1 — Campaign persistence and economy

#### 5. Gold is missing from the save format

**Status: Resolved in Milestone 3. Save schema version 2 persists gold and the
complete campaign roster, and version-1 saves migrate with safe defaults.**

Gold exists in the Zustand state but is absent from:

- `SavePayload`
- Manual save serialization
- Autosave serialization
- Save hydration

Loading a save therefore retains an unrelated in-memory value instead of the
saved balance.

#### 6. Shop logic is inaccessible

**Status: Resolved in Milestone 4. The Victory Shop displays gold and stock,
reports failed purchases, and lets compatible units equip purchased convoy
weapons.**

The repository contains:

- Shop inventory and prices
- `buyItem()`
- Gold state
- Shop localization strings

No UI component currently:

- Displays the player's gold
- Lists shop stock
- Calls `buyItem()`
- Reports insufficient gold

The feature exists only as backend state.

#### 7. Reward and completion transitions need idempotency

**Status: Resolved for the current in-memory chapter flow in Milestone 1.
Victory-save and replay policies remain part of later persistence work.**

Chapter completion should be safe if objective evaluation runs more than once.
Gold and weapon rewards must not be granted repeatedly due to duplicate state
checks, dialogue callbacks, React rerenders, or save restoration.

#### 8. Weapon inventory instances are incomplete

**Status: Resolved across Milestones 2–4. Runtime weapons are cloned,
durability is consumed by attacks and healing, broken weapons are removed, and
remaining uses round-trip through save data.**

Weapon definitions contain `uses`, and the UI displays remaining uses, but
combat does not currently consume weapon durability.

Static weapon definitions are also reused by unit creation instead of always
creating per-unit inventory instances. Any future durability mutation must not
mutate shared definitions.

### P1 — E2E harness reliability

#### 9. The current full playthrough is not a real campaign

The playthrough directly invokes `window.__initChapter(i)` for every chapter.
It does not test:

- The Next Chapter button
- Persistent roster progression
- Permadeath continuity
- Chapter reward continuity
- Gold and shopping
- Save/load continuity
- Real final-chapter navigation

It is useful as a chapter initialization and stress test, but not yet as a
campaign acceptance test.

#### 10. Turn counts are approximately doubled

The script increments its `turns` counter for both player-phase and enemy-phase
iterations.

Examples:

- ch01 report: 21 turns; HUD screenshot: Turn 11
- ch14 report: 80 turns; HUD screenshot: Turn 42

Future reports should use the store's `turn` value.

#### 11. Some E2E artifacts are mislabeled

`00_title.png` is captured after Start Game is clicked, so it shows ch01 rather
than the title screen.

`ch20_epilogue.png` is captured regardless of whether the phase actually
reached `epilogue`.

Artifacts should be written only after an explicit state assertion succeeds.

#### 12. Global timer patching changes application behavior

The full playthrough replaces global timeout and interval durations. This makes
the run faster, but it also changes:

- Combat animation timing
- Dialogue typewriter timing
- Cinematic timing
- Outro transitions
- Screenshot capture state

A test-specific animation-speed setting is safer than monkey-patching browser
timers globally.

#### 13. The test player has tactical limitations

Known limitations include:

- Defend chapters wait in the deployment area rather than repositioning.
- Movement uses a greedy Manhattan-distance chase instead of global pathfinding.
- Attack safety is evaluated from the unit's original position rather than the
  candidate attack position.
- A healer with no wounded target can advance toward enemies instead of staying
  near the lord.

These limitations bias difficulty results, especially for ch04, ch10, and ch14.

### P2 — Map clarity and balance

#### 14. ch14 is not necessarily impossible, but its route is unclear

The lake is impassable to infantry, cavalry, and armored units. Infantry can
cross the mountain tile and use the upper or lower shore route. Armored Borin
cannot cross either the water or the blocking mountain.

The E2E bot becomes stuck because it cannot temporarily move away from the
objective to route around the lake.

Possible player-facing issues remain:

- The safe route is not visually obvious.
- One deployed unit cannot complete the crossing.
- The objective does not explain that the lake itself is impassable.

#### 15. Late-game difficulty cannot be judged yet

The report recorded:

- 4 victories
- 14 defeats
- 2 unfinished chapters

However, the run used base-level units in late chapters and a limited tactical
bot. Enemy-count or stat reductions made now could overcorrect the game once
progression is fixed.

Balance work should occur only after:

1. Campaign progression persists.
2. The E2E player uses the real chapter transition flow.
3. Turn and outcome metrics are correct.
4. At least one full campaign can reach the epilogue.

### P2 — Engineering and repository health

#### 16. Store-level coverage is insufficient

`src/game/store.ts` owns most multi-system transitions but has no dedicated
test suite.

Required coverage includes:

- Chapter initialization
- Objective completion
- Dialogue completion
- Reward idempotency
- Roster persistence
- Save/load
- Gold and shop transactions
- Epilogue and title transitions

#### 17. Browser tests are not part of CI

The workflow runs TypeScript and Vitest but does not run a deterministic browser
smoke test.

#### 18. The store should be decomposed

The central store is approaching 1,000 lines and combines:

- Campaign state
- Combat sequencing
- AI turns
- Effects
- Dialogue
- Save/load
- Economy
- Rewards

Pure and persistence-related logic should gradually move into focused modules.

#### 19. Package-manager metadata is inconsistent

The repository contains `package-lock.json`, documentation and CI use npm, but
`package.json` declares pnpm as its package manager.

One package manager should be selected and used consistently.

#### 20. Generated E2E artifacts need a repository policy

The current `playthrough/` directory contains approximately 68 MB of generated
screenshots.

Choose one approach:

- Keep generated artifacts outside the repository, such as `/tmp/playthrough`.
- Ignore `playthrough/` in Git.
- Commit only a small curated set of screenshots and summary documents.

## Implementation plan

### Milestone 1 — Make every chapter completable

Goal: all objective types transition cleanly to victory, and the final chapter
can reach the epilogue.

#### M1.1 Add store regression tests

Create focused tests before changing the state machine.

Required cases:

- Route objective becomes victory when the last enemy dies.
- Boss objective opens boss-death dialogue once.
- Closing boss-death dialogue continues to victory.
- Victory dialogue opens once.
- Rewards are granted once.
- Defend objective wins on the intended turn.
- Seize objective wins when a player occupies the target.
- Defeat takes precedence if the lord is dead.

Acceptance criteria:

- Tests reproduce the current boss-dialogue failure before the fix.
- Tests pass after the state-machine change.

#### M1.2 Replace implicit dialogue flow with explicit transitions

Recommended design:

- Introduce a dialogue completion action such as
  `completeDialogue(dialogueId)`.
- Store completed one-shot dialogue triggers for the current chapter.
- Let dialogue completion explicitly dispatch the next transition.
- Separate objective detection from reward granting.

Example final-boss transition:

```text
objective complete
→ mark boss-death trigger consumed
→ show boss-death dialogue
→ complete dialogue
→ enter victory
→ grant reward once
→ show victory dialogue
```

Acceptance criteria:

- Boss-death dialogue cannot reopen.
- Every boss chapter reaches `victory`.
- Rewards are granted exactly once.
- ch20 can proceed from victory dialogue to credits and epilogue.

#### M1.3 Fix application screen navigation

Move the loading/menu/game screen state into a shared navigation model, or pass
an explicit application callback to the epilogue.

Acceptance criteria:

- Return to Title displays the landing/title screen.
- It does not initialize ch01 until Start Game is selected.
- Play Again intentionally starts a fresh campaign.
- Audio switches to the correct title state.

#### M1.4 Add a final-flow browser test

Create a deterministic ch20 test that:

1. Starts ch20 through a test-safe setup.
2. Completes the boss objective.
3. Dismisses boss-death dialogue.
4. Reaches victory.
5. Dismisses victory dialogue.
6. Completes credits.
7. Asserts `phase === "epilogue"`.
8. Clicks Return to Title.
9. Asserts that the title screen is visible.

### Milestone 2 — Preserve campaign progression

**Status: Completed July 23, 2026.**

Goal: chapter transitions carry the player's actual roster and resources.

#### M2.1 Define persistent campaign state

Introduce a campaign-level roster independent of battlefield grid occupancy.

The persistent unit model must include:

- Unit definition ID
- Stable campaign UID
- Level and EXP
- Stats and maximum HP
- Current HP according to the selected healing policy
- Class/promotion state
- Weapon inventory instances
- Equipped weapon index
- Alive/dead status

Decide and document:

- Whether units fully heal between chapters.
- Whether non-lord deaths are permanent.
- How a defeated lord restarts a chapter.
- How new recruits join the roster.

Recommended default based on the current game description:

- Preserve non-lord permadeath.
- Fully heal surviving units between chapters.
- Restart the current chapter if the lord dies.
- Add recruits at their authored recruitment chapter.

#### M2.2 Separate fresh debug initialization from campaign initialization

Use different actions for different purposes:

- `startNewCampaign()`
- `startNextChapter()`
- `loadCampaign()`
- Development-only `initChapterFresh(index)`

Acceptance criteria:

- Normal UI transitions never use fresh static units after chapter 1.
- Debug scripts can still initialize an isolated chapter.
- Production builds do not expose unnecessary store mutation hooks.

#### M2.3 Deploy roster units into each chapter

When a chapter begins:

- Select eligible roster members.
- Place cloned runtime units at deployment points.
- Add new recruits when unlocked.
- Preserve stats, class, inventory, and stable IDs.
- Keep grid occupancy and roster state synchronized.

Acceptance criteria:

- A level gained in ch01 remains in ch02.
- Promotion remains active in later chapters.
- Equipped weapons remain equipped.
- Dead units do not silently return.

#### M2.4 Sync chapter results back to the roster

At chapter completion or autosave:

- Copy player runtime state into campaign state.
- Remove temporary battlefield flags.
- Preserve long-term progression.
- Apply the between-chapter healing policy.

### Milestone 3 — Upgrade save data safely

**Status: Completed July 23, 2026.**

Goal: save files restore the complete campaign.

#### M3.1 Create save schema version 2

Add:

- Gold
- Persistent roster
- Promotion/class state
- Weapon inventory instances and uses
- Campaign chapter index
- Completed chapters
- Any consumed one-shot campaign flags

#### M3.2 Add version-1 migration

Recommended migration:

- Default missing gold to `0`.
- Build the initial roster from the serialized player units.
- Infer promoted class from saved runtime data where possible.
- Preserve convoy and language.
- Continue to reject corrupt or unknown unit definitions safely.

Acceptance criteria:

- Existing version-1 saves do not crash the game.
- Version-2 manual saves and autosaves round-trip all campaign state.
- Loading a save restores the same gold, roster, class, inventory, and chapter.

#### M3.3 Add save compatibility tests

Required tests:

- Version-1 migration
- Version-2 manual save round trip
- Version-2 autosave round trip
- Gold persistence
- Promotion persistence
- Dead-unit persistence
- Invalid/corrupt save handling

### Milestone 4 — Complete the economy and inventory

**Status: Completed July 23, 2026.**

Goal: rewards, gold, shopping, and equipment form a usable loop.

#### M4.1 Add a player-facing shop

Recommended placement:

- Intermission modal after victory and before Next Chapter, or
- A dedicated campaign preparation screen

Required UI:

- Current gold
- Item/weapon name
- Price
- Description
- Remaining owned quantity
- Buy button
- Insufficient-gold feedback
- English and Traditional Chinese strings

Acceptance criteria:

- A player can earn a chapter reward, open the shop, buy an item, and see the
  new convoy entry.
- Gold updates immediately.
- Purchases persist after save/load and chapter transition.

#### M4.2 Make rewards idempotent

Track chapter reward claims independently from dialogue display.

Acceptance criteria:

- Reloading a victory save does not duplicate rewards.
- Reopening a dialogue does not duplicate rewards.
- Replaying a completed chapter follows an explicitly defined reward policy.

#### M4.3 Create weapon inventory instances

Static `WEAPONS` entries should remain immutable definitions.

Runtime inventory entries should contain:

- Weapon ID
- Remaining uses
- Any future forge/modifier state

Acceptance criteria:

- Different units can own the same weapon type with different durability.
- Using one weapon never changes another unit's copy or the static definition.
- Weapon uses can be serialized safely.

#### M4.4 Implement or remove durability presentation

Choose one coherent behavior:

- Implement durability consumption and weapon breaking, or
- Remove remaining-use UI until durability is supported.

Do not display a gameplay resource that never changes.

### Milestone 5 — Replace the playthrough with a trustworthy campaign E2E

Goal: produce a repeatable report that measures the real player journey.

#### M5.1 Test real navigation

The campaign test should:

- Capture the title screen before clicking Start.
- Start a new campaign through the UI.
- Use Next Chapter instead of direct chapter initialization.
- Preserve roster, inventory, rewards, and gold.
- Assert the chapter ID after every transition.

#### M5.2 Use explicit test-speed controls

Add a development/test configuration for animation speed.

Avoid replacing global `setTimeout` and `setInterval`.

Acceptance criteria:

- Gameplay order is unchanged.
- Dialogue completion callbacks still run normally.
- Screenshots are captured only after stable state assertions.

#### M5.3 Correct metrics

Record:

- `store.turn`
- Player/enemy survivors
- Unit levels and promotions
- Gold earned/spent
- Convoy changes
- Objective completion reason
- Dialogue sequence
- Final phase

Separate:

- Raw machine-readable facts
- Subjective narrative impressions

Do not allow generated narrative to override contradictory raw state.

#### M5.4 Improve the automated player's tactics

Required fixes:

- Evaluate counter range from the candidate movement tile.
- Keep healers near allies when no heal is available.
- Use pathfinding that can route around obstacles.
- Reposition during defend chapters.
- Prefer terrain and choke points.
- Avoid ending the action loop because one unit has no valid move.

The automated player does not need to be optimal, but it must not fail due to
known implementation mistakes.

#### M5.5 Add CI browser smoke coverage

Run a short deterministic suite in CI:

- Title → start game
- One route objective
- One boss objective with dialogue
- Save/load round trip
- Next chapter progression
- ch20 epilogue transition

The full 20-chapter playthrough may remain a scheduled or manual test if it is
too slow for every push.

### Milestone 6 — Reassess maps and balance

Goal: tune difficulty using valid campaign data.

#### M6.1 Rerun the complete campaign

Do not begin broad balancing until Milestones 1–5 are complete.

Collect:

- Completion rate per chapter
- Actual in-game turns
- Unit levels at chapter start/end
- Player deaths
- Damage and hit-rate distributions
- Healing usage
- Promotion timing
- Gold and shop usage

#### M6.2 Improve ch14 route communication

Possible changes:

- Add visible bridge or cracked-ice route tiles.
- Add dialogue explaining that the lake cannot be crossed normally.
- Mark the upper/lower route more clearly.
- Deploy at least one unit capable of demonstrating the intended traversal.
- Reconsider deploying Borin if he has no meaningful route or defensive role.

Acceptance criteria:

- A new player can identify a valid route without trial-and-error over dozens of
  turns.
- The objective remains completable by at least one deployed unit.

#### M6.3 Tune only after progression is working

Candidate chapters for review after the rerun:

- ch02–ch04 onboarding difficulty
- ch09–ch12 transition into the late game
- ch15 enemy density
- ch18 and ch20 opening pressure
- Serra's hit rate and damage contribution

Avoid assuming enemy count alone is the problem. Review:

- Deployment
- Terrain
- Aggro ranges
- Enemy AI type
- Weapon matchups
- Player level curve
- Available shop inventory
- Promotion timing

#### M6.4 Review pacing

Enemy turns and repeated combat animations can feel slow.

Measure first, then consider:

- Optional animation speed controls
- Skip/fast-forward after the first presentation
- Faster non-critical enemy movement
- Reduced delay between AI actions

### Milestone 7 — Engineering cleanup

Goal: reduce future regression risk without delaying campaign fixes.

#### M7.1 Decompose the store incrementally

Candidate modules:

- `campaign.ts`
- `objectives.ts`
- `dialogueFlow.ts`
- `economy.ts`
- `inventory.ts`
- `enemyTurn.ts`

Extract pure functions first and preserve existing behavior with tests.

#### M7.2 Standardize npm metadata

Because CI and the lockfile use npm:

- Remove or correct the pnpm `packageManager` declaration.
- Use `npm ci` in CI once the lockfile is stable.

#### M7.3 Add linting

Introduce a minimal TypeScript/React lint configuration only after the critical
campaign fixes, and avoid combining lint-wide rewrites with gameplay changes.

#### M7.4 Review asset loading

Measure whether the custom preload system parses GLB files that Drei later
parses again.

Potential improvements:

- Share the same loader cache.
- Split title-screen and battlefield asset groups.
- Lazy-load later content.
- Keep the service-worker pre-cache list synchronized.

#### M7.5 Define artifact and unused-asset policy

- Ignore generated full-playthrough output by default.
- Keep only curated screenshots required for documentation.
- Decide whether `_unused_assets/` should remain in the main repository or move
  to external storage.

## Recommended execution order

```text
1. Store regression tests
2. Boss dialogue and victory state machine
3. ch20 epilogue and Return to Title
4. Persistent campaign roster
5. Save schema v2 and migration
6. Shop UI and reward idempotency
7. Real campaign E2E harness
8. Full campaign rerun
9. Map and difficulty tuning
10. Store decomposition, tooling, and performance cleanup
```

## Release-readiness checklist

Embers should not be considered campaign-complete until all of the following
are true:

- [x] Every objective type can reach victory.
- [x] Boss-death dialogue plays once and continues to victory.
- [x] Chapter rewards are granted once per chapter run.
- [ ] Levels, EXP, stats, promotions, and weapons persist between chapters.
- [ ] Permadeath behavior is defined and persisted.
- [ ] Gold persists through manual save and autosave.
- [ ] The shop is accessible and purchases persist.
- [x] ch20 reaches victory, credits, and epilogue after objective completion.
- [x] Return to Title shows the title screen.
- [ ] A real Next Chapter E2E reaches at least ch02 with preserved progression.
- [x] A deterministic final-flow E2E reaches the epilogue.
- [ ] Unit tests and production build pass.
- [ ] Browser tests report no uncaught errors.
- [ ] Balance is reassessed using corrected campaign data.
