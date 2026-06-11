// src/env.mjs
import { createEnv } from '@t3-oss/env-nuxt'; // or core package
import * as z from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
  },
});
