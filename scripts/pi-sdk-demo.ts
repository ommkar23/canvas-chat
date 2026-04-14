import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent';

async function main() {
  const prompt = process.argv.slice(2).join(' ') || 'In one sentence, say hello from pi SDK mode.';

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const { session } = await createAgentSession({
    cwd: process.cwd(),
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
  });

  let sawText = false;

  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      sawText = true;
      process.stdout.write(event.assistantMessageEvent.delta);
    }

    if (event.type === 'tool_execution_start') {
      process.stderr.write(`\n[tool:start] ${event.toolName}\n`);
    }

    if (event.type === 'tool_execution_end') {
      process.stderr.write(`[tool:end] ${event.toolName} ${event.isError ? 'error' : 'ok'}\n`);
    }
  });

  try {
    await session.prompt(prompt);
    if (!sawText) {
      console.log('\n[no text output received]');
    } else {
      console.log();
    }
  } finally {
    unsubscribe();
    session.dispose();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
