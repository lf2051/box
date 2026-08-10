import { spawnSync } from 'node:child_process';

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

// Etapa opcional: gerar artefatos auxiliares.
// Se falhar, seguimos o build do frontend mesmo assim.
const llms = run('node', ['tools/generate-llms.js']);
if (llms.status !== 0) {
  console.warn('[build] Aviso: generate-llms falhou, seguindo com vite build.');
}

const viteBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const vite = run(viteBin, ['vite', 'build']);
process.exit(vite.status ?? 1);
