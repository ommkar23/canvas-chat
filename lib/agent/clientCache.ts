// RpcClient is not re-exported from the main index — import from the dist subpath directly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: deep dist import required because package.json exports map omits RpcClient
import { RpcClient } from '@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-client.js';
import { mkdir } from 'fs/promises';
import path from 'path';
import { SYSTEM_PROMPT } from './systemPrompt';

const CLI_PATH = path.resolve(process.cwd(), 'node_modules/@mariozechner/pi-coding-agent/dist/cli.js');
export const SESSIONS_DIR = path.resolve(process.cwd(), 'sessions');

interface SessionEntry {
  client: RpcClient;
  versionCount: number;
  cwd: string;
}

const cache = new Map<string, SessionEntry>();

export async function getOrCreateClient(sessionId: string): Promise<SessionEntry> {
  if (cache.has(sessionId)) return cache.get(sessionId)!;

  const cwd = path.join(SESSIONS_DIR, sessionId);
  await mkdir(cwd, { recursive: true });

  const client = new RpcClient({
    cliPath: CLI_PATH,
    cwd,
    args: ['--system-prompt', SYSTEM_PROMPT],
  });

  await client.start();
  await client.newSession();

  const entry: SessionEntry = { client, versionCount: 0, cwd };
  cache.set(sessionId, entry);
  return entry;
}
