import { db, type DB } from '../../db';
import seedCongressTypes from './congressTypes.seed';
import seedContributionItemTypes from './contributionItemTypes.seed';
import seedCountries from './countries.seed';
import seedFilingTypes from './filingTypes.seed';
import seedGovernmentEntities from './governmentEntities.seed';
import seedLobbyingActivityIssues from './lobbyingActivityIssues.seed';
import seedParties from './parties.seed';
import seedStates from './states.seed';

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function logError(msg: string) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

async function runSeed(
  label: string,
  seed: (db: DB) => Promise<void>,
): Promise<boolean> {
  log(`seed ${label} …`);
  const started = performance.now();

  try {
    await seed(db);
    log(`seed ${label} done (${Math.round(performance.now() - started)}ms)`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(
      `seed ${label} failed (${Math.round(performance.now() - started)}ms): ${message}`,
    );
    if (error instanceof Error && error.stack) {
      logError(error.stack);
    }
    return false;
  }
}

const SEEDS = [
  ['congress types', seedCongressTypes],
  ['contribution item types', seedContributionItemTypes],
  ['countries', seedCountries],
  ['filing types', seedFilingTypes],
  ['government entities', seedGovernmentEntities],
  ['lobbying activity issues', seedLobbyingActivityIssues],
  ['parties', seedParties],
  ['states', seedStates],
] as const;

async function seedAll(db: DB) {
  const started = performance.now();
  log(`seeding ${SEEDS.length} reference tables`);

  const results: boolean[] = [];
  for (const [label, seed] of SEEDS) {
    results.push(await runSeed(label, seed));
  }

  const ok = results.filter(Boolean).length;
  const failed = results.length - ok;
  const totalMs = Math.round(performance.now() - started);

  if (failed === 0) {
    log(`seeding complete: ${ok}/${results.length} ok (${totalMs}ms)`);
    return;
  }

  logError(
    `seeding complete: ${ok}/${results.length} ok, ${failed} failed (${totalMs}ms)`,
  );
  process.exitCode = 1;
}

void seedAll(db);
