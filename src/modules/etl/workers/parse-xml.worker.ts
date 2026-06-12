import { parentPort } from 'node:worker_threads';
import { parseXmlFile } from '../parse-xml-file.js';

type ParseRequest = { filePath: string; dataDir: string };
type ParseResponse = {
  filePath: string;
  rows: ReturnType<typeof parseXmlFile>;
  error?: string;
};

parentPort!.on('message', (msg: ParseRequest) => {
  try {
    const rows = parseXmlFile(msg.filePath, msg.dataDir);
    const res: ParseResponse = { filePath: msg.filePath, rows };
    parentPort!.postMessage(res);
  } catch (err) {
    const res: ParseResponse = {
      filePath: msg.filePath,
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(res);
  }
});
