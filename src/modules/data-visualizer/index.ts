import { glob } from 'glob';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const root = 'data/congress_press';

// Single month
{
  const filePath = join(root, '2026-01.jsonl');
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const rec = JSON.parse(trimmed) as {
      member: { name: string };
      title: string;
    };
    console.log(rec.member.name, rec.title);
  }
}

// Full decompressed year
{
  const paths = (await glob(join(root, '2025', '*.jsonl'))).sort();

  for (const filePath of paths) {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const rec = JSON.parse(trimmed);
      // ...
    }
  }
}
