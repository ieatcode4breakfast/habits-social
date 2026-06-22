import { spawn } from 'node:child_process';

// ponytail: zero-dep env wrapper replaces cross-env for Windows/Unix parity. Ceiling: trimming the env list later requires editing this file. Upgrade path: keep here.
process.env.HABITS_BUILD = 'native';
process.env.NUXT_PUBLIC_API_BASE_URL = 'https://www.habitssocial.com';
process.env.NUXT_PUBLIC_PARTYKIT_HOST = 'habits-social-realtime-production.ieatcode4breakfast.partykit.dev';
process.env.NUXT_PUBLIC_REALTIME_ENABLED = 'true';

const child = spawn('nuxt', ['build'], { stdio: 'inherit', shell: true });

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
