import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from '@mariozechner/pi-coding-agent';
import { mkdir } from 'fs/promises';
import path from 'path';
import { SYSTEM_PROMPT } from './systemPrompt';

export const SESSIONS_DIR = path.resolve(process.cwd(), 'sessions');

interface SessionEntry {
  session: AgentSession;
  versionCount: number;
  cwd: string;
}

const cache = new Map<string, SessionEntry>();
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const DEFAULT_MODEL_PROVIDER = 'openai-codex';
const DEFAULT_MODEL_ID = 'gpt-5.4-mini';

export async function getOrCreateClient(sessionId: string): Promise<SessionEntry> {
  if (cache.has(sessionId)) return cache.get(sessionId)!;

  const cwd = path.join(SESSIONS_DIR, sessionId);
  await mkdir(cwd, { recursive: true });

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    systemPromptOverride: () => SYSTEM_PROMPT,
  });
  await resourceLoader.reload();

  const model = modelRegistry.find(DEFAULT_MODEL_PROVIDER, DEFAULT_MODEL_ID);

  const { session } = await createAgentSession({
    cwd,
    model,
    authStorage,
    modelRegistry,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  const entry: SessionEntry = { session, versionCount: 0, cwd };
  cache.set(sessionId, entry);
  return entry;
}
