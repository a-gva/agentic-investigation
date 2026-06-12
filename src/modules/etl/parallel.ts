import os from 'node:os';

export const PARALLEL = {
  senateFiles: Math.min(4, os.cpus().length),
  houseWorkers: Math.min(16, os.cpus().length),
  pressFiles: Math.min(8, os.cpus().length),
  houseBatchSize: 1_000,
  senateBatchSize: 2_000,
} as const;
