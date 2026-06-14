import os from 'node:os';

const availableParallelism = os.availableParallelism();

const WEIGHTED_PARALLELISM = {
  senate: 0.2,
  house: 0.8,
  press: 0.1,
};

export const PARALLEL = {
  senateFiles: Math.round(availableParallelism * WEIGHTED_PARALLELISM.senate),
  houseWorkers: Math.round(availableParallelism * WEIGHTED_PARALLELISM.house),
  pressFiles: Math.round(availableParallelism * WEIGHTED_PARALLELISM.press),
  houseBatchSize: 1_000,
  senateBatchSize: 2_000,
} as const;
