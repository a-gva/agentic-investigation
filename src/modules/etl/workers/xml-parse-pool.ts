import { Worker } from 'node:worker_threads';
import type { NewDbRecord } from '../../../db/schema.js';

export type XmlParseResult = {
  filePath: string;
  rows: NewDbRecord[];
  error?: string;
};

type Job = {
  filePath: string;
  dataDir: string;
  resolve: (result: XmlParseResult) => void;
  reject: (err: Error) => void;
};

type WorkerSlot = {
  worker: Worker;
  busy: boolean;
  job: Job | null;
};

const WORKER_URL = new URL('./parse-xml.worker.ts', import.meta.url);

export class XmlParsePool {
  private slots: WorkerSlot[] = [];
  private queue: Job[] = [];
  private closed = false;

  constructor(private size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(WORKER_URL, {
        // Bun + Node ESM workers
        ...({ type: 'module' } as Record<string, string>),
      });
      const slot: WorkerSlot = { worker, busy: false, job: null };
      worker.on('message', (msg: XmlParseResult) => {
        const job = slot.job;
        slot.job = null;
        slot.busy = false;
        job?.resolve(msg);
        this.pump();
      });
      worker.on('error', (err: Error) => {
        const job = slot.job;
        slot.job = null;
        slot.busy = false;
        job?.reject(err);
        this.pump();
      });
      this.slots.push(slot);
    }
  }

  parse(filePath: string, dataDir: string): Promise<XmlParseResult> {
    if (this.closed) {
      return Promise.reject(new Error('XmlParsePool is closed'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ filePath, dataDir, resolve, reject });
      this.pump();
    });
  }

  parseAll(paths: string[], dataDir: string): Promise<XmlParseResult[]> {
    return Promise.all(paths.map((p) => this.parse(p, dataDir)));
  }

  private pump() {
    if (this.closed) return;
    for (const slot of this.slots) {
      if (slot.busy || this.queue.length === 0) continue;
      const job = this.queue.shift()!;
      slot.busy = true;
      slot.job = job;
      slot.worker.postMessage({
        filePath: job.filePath,
        dataDir: job.dataDir,
      } satisfies { filePath: string; dataDir: string });
    }
  }

  async close() {
    this.closed = true;
    await Promise.all(this.slots.map((s) => s.worker.terminate()));
    this.slots = [];
    this.queue = [];
  }
}
