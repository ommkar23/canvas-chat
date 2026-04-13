import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';
import path from 'path';
import { SESSIONS_DIR } from '@/lib/agent/clientCache';

export async function POST() {
  const sessionId = uuidv4();
  const cwd = path.join(SESSIONS_DIR, sessionId);
  await mkdir(cwd, { recursive: true });
  return NextResponse.json({ sessionId });
}
