import fs from 'node:fs';

const inputFile = process.argv[2] ?? 'input.json';
const outputFile = process.argv[3] ?? 'first50.json';
const limit = 50;

function findValueEnd(text: string, start: number): number | null {
  let i = start;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (i >= text.length) return null;

  const ch = text[i]!;

  if (ch === '{' || ch === '[') {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (; i < text.length; i++) {
      const c = text[i]!;

      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }

      if (c === '"') {
        inString = true;
        continue;
      }

      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }

    return null;
  }

  if (ch === '"') {
    let escaped = false;

    for (i++; i < text.length; i++) {
      const c = text[i]!;

      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') return i + 1;
    }

    return null;
  }

  for (; i < text.length; i++) {
    const c = text[i]!;
    if (c === ',' || c === ']') return i;
  }

  return null;
}

const results: unknown[] = [];
let buffer = '';
let pos = 0;
let arrayStarted = false;
let finished = false;

function writeResults() {
  if (finished) return;
  finished = true;

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved ${results.length} records`);
}

function consumeBuffer() {
  if (!arrayStarted) {
    const start = buffer.indexOf('[');
    if (start === -1) {
      buffer = '';
      return;
    }

    arrayStarted = true;
    pos = start + 1;
  }

  while (results.length < limit && pos < buffer.length) {
    while (pos < buffer.length && /\s/.test(buffer[pos]!)) pos++;

    if (pos < buffer.length && buffer[pos] === ']') {
      writeResults();
      stream.destroy();
      return;
    }

    const valueStart = pos;
    const valueEnd = findValueEnd(buffer, valueStart);
    if (valueEnd === null) break;

    results.push(JSON.parse(buffer.slice(valueStart, valueEnd)));
    pos = valueEnd;

    if (buffer[pos] === ',') pos++;

    if (results.length >= limit) {
      writeResults();
      stream.destroy();
      return;
    }
  }

  if (pos > 0) {
    buffer = buffer.slice(pos);
    pos = 0;
  }
}

const stream = fs.createReadStream(inputFile, { encoding: 'utf8' });

stream.on('data', (chunk) => {
  buffer += chunk;
  consumeBuffer();
});

stream.on('end', () => {
  if (!finished) writeResults();
});

stream.on('error', (err) => {
  if (finished) return;
  console.error(err);
  process.exitCode = 1;
});
