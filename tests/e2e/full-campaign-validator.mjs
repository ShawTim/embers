import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_CHAPTERS = Array.from(
  { length: 20 },
  (_, index) => `ch${String(index + 1).padStart(2, "0")}`,
);

function artifactExists(outputDir, relativePath) {
  return typeof relativePath === "string"
    && relativePath.length > 0
    && existsSync(path.resolve(outputDir, relativePath));
}

export function validateFullCampaignRun(run, outputDir) {
  const errors = [];
  const fail = message => errors.push(message);
  const maxChapters = run?.metadata?.maxChapters ?? 20;
  const expected = EXPECTED_CHAPTERS.slice(0, maxChapters);

  if (!run || typeof run !== "object") return ["run.json is not an object"];
  if (!run.metadata?.commit) fail("metadata.commit is missing");
  if (!run.metadata?.startedAt || !run.metadata?.finishedAt) {
    fail("metadata timestamps are incomplete");
  }
  if (!run.metadata?.viewport?.width || !run.metadata?.viewport?.height) {
    fail("metadata.viewport is incomplete");
  }
  if (!Array.isArray(run.metadata?.commands)) fail("metadata.commands is missing");
  if (!run.title?.visibleBeforeStart) fail("title screen was not verified before Start Game");
  if (!artifactExists(outputDir, run.title?.screenshot)) {
    fail(`title screenshot does not exist: ${run.title?.screenshot || "<missing>"}`);
  }

  if (!Array.isArray(run.chapters)) {
    fail("chapters is not an array");
    return errors;
  }

  const attempted = run.chapters.filter(chapter => chapter.status !== "not-run");
  const attemptedIds = attempted.map(chapter => chapter.id);
  if (JSON.stringify(attemptedIds) !== JSON.stringify(expected.slice(0, attempted.length))) {
    fail(`chapters were not attempted in order: ${attemptedIds.join(", ")}`);
  }

  for (const chapter of attempted) {
    const details = Array.isArray(chapter.attemptDetails) ? chapter.attemptDetails : [];
    if (chapter.attempts !== details.length) {
      fail(`${chapter.id} attempts=${chapter.attempts} but has ${details.length} attempt records`);
    }
    if (chapter.attempts < 1) fail(`${chapter.id} was attempted but reports zero attempts`);
    if (!chapter.objectiveType || !chapter.objectiveText) {
      fail(`${chapter.id} objective metadata is incomplete`);
    }
    if (!Array.isArray(chapter.startRoster) || !Array.isArray(chapter.endRoster)) {
      fail(`${chapter.id} roster snapshots are incomplete`);
    }
    if (chapter.manualCheckpoint !== true) {
      fail(`${chapter.id} chapter-start manual checkpoint was not verified`);
    }
    if (chapter.status === "victory" && chapter.lordAlive !== true) {
      fail(`${chapter.id} reports victory without a living lord`);
    }
    for (const screenshot of chapter.screenshots || []) {
      if (!artifactExists(outputDir, screenshot)) {
        fail(`${chapter.id} screenshot does not exist: ${screenshot}`);
      }
    }
    for (const attempt of details) {
      for (const screenshot of attempt.screenshots || []) {
        if (!artifactExists(outputDir, screenshot)) {
          fail(`${chapter.id} attempt ${attempt.attempt} screenshot does not exist: ${screenshot}`);
        }
      }
    }
  }

  for (const event of run.browserEvents || []) {
    if (!event.classification) {
      fail(`unclassified browser event: ${event.kind}: ${event.text}`);
    }
  }

  if (!artifactExists(outputDir, "browser-errors.log")) {
    fail("browser-errors.log is missing");
  } else if (readFileSync(path.join(outputDir, "browser-errors.log"), "utf8").trim().length === 0) {
    fail("browser-errors.log is empty");
  }
  if (!artifactExists(outputDir, "REPORT.md")) fail("REPORT.md is missing");

  if (run.status === "passed") {
    if (maxChapters !== 20) fail("a limited run cannot be marked passed");
    if (JSON.stringify(attemptedIds) !== JSON.stringify(EXPECTED_CHAPTERS)) {
      fail("passed run did not complete ch01 through ch20");
    }
    if (attempted.some(chapter => chapter.status !== "victory")) {
      fail("passed run contains a non-victory chapter");
    }
    if (!run.ending?.reachedEpilogue || !run.ending?.returnedToTitle) {
      fail("passed run did not verify epilogue and Return to Title");
    }
    if (!artifactExists(outputDir, run.ending?.epilogueScreenshot)) {
      fail("epilogue screenshot is missing");
    }
    if (!artifactExists(outputDir, run.ending?.titleScreenshot)) {
      fail("Return to Title screenshot is missing");
    }
  }

  if (run.status === "limited-pass") {
    if (maxChapters >= 20) fail("full runs must use passed or failed-incomplete status");
    if (attempted.length !== maxChapters) fail("limited run did not reach its requested chapter count");
    if (attempted.some(chapter => chapter.status !== "victory")) {
      fail("limited-pass run contains a non-victory chapter");
    }
  }

  return errors;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("Usage: node tests/e2e/full-campaign-validator.mjs <artifact-directory>");
    process.exit(2);
  }
  const runPath = path.join(outputDir, "run.json");
  if (!existsSync(runPath)) {
    console.error(`Missing ${runPath}`);
    process.exit(1);
  }
  const run = JSON.parse(readFileSync(runPath, "utf8"));
  const errors = validateFullCampaignRun(run, outputDir);
  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(`Validated full-campaign artifacts: ${outputDir}`);
}
