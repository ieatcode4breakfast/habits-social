import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const localPartykitHostPattern = /^(localhost|127\.0\.0\.1):([1-9]\d{0,4})$/;
const nuxtCli = resolve(process.cwd(), 'node_modules', '@nuxt', 'cli', 'bin', 'nuxi.mjs');
const partykitCli = resolve(process.cwd(), 'node_modules', 'partykit', 'dist', 'bin.mjs');

const readDotEnv = () => {
  const env = new Map();

  try {
    const contents = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const name = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      env.set(name, value);
    }
  } catch {
    return env;
  }

  return env;
};

const normalizeHost = (host) => host
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

const isLocalPartykitHost = (host) => {
  const match = localPartykitHostPattern.exec(normalizeHost(host));
  if (!match) return false;

  const port = Number(match[2]);
  return Number.isInteger(port) && port <= 65535;
};

const dotenv = readDotEnv();
const partykitHost = process.env.NUXT_PUBLIC_PARTYKIT_HOST || dotenv.get('NUXT_PUBLIC_PARTYKIT_HOST') || '';
const commands = [
  ['dev:nuxt', nuxtCli, ['dev', '--host']],
  ...(isLocalPartykitHost(partykitHost) ? [['dev:realtime', partykitCli, ['dev', '--port', '1999', '--with-env']]] : []),
];

const children = [];

const stopChildren = (except) => {
  for (const child of children) {
    if (child !== except && !child.killed) child.kill();
  }
};

for (const [label, script, args] of commands) {
  if (!existsSync(script)) {
    console.error(`[${label}] CLI not found at ${script}. Run npm install before starting dev.`);
    process.exitCode = 1;
    stopChildren();
    break;
  }

  const child = spawn(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] stopped with signal ${signal}`);
      return;
    }

    if (code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      process.exitCode = code || 1;
      stopChildren(child);
    }
  });

  children.push(child);
}

const shutdown = () => {
  stopChildren();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
