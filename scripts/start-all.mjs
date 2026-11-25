// Starts the API (backend-nest) and the web app (frontend) together from one command.
// Output from each process is prefixed with its name. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const services = [
  { name: 'api', color: '\x1b[36m', cwd: resolve(root, 'backend-nest'), cmd: 'npm', args: ['run', 'dev'] },
  { name: 'web', color: '\x1b[35m', cwd: resolve(root, 'frontend'), cmd: 'corepack', args: ['pnpm', 'dev'] },
];

const children = [];

function pipe(stream, name, color) {
  let buffer = '';
  stream.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
    }
  });
}

function start({ name, color, cwd, cmd, args }) {
  const child = spawn(cmd, args, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  pipe(child.stdout, name, color);
  pipe(child.stderr, name, color);
  child.on('exit', code => {
    process.stdout.write(`${color}[${name}]\x1b[0m exited with code ${code}\n`);
    stopAll();
    process.exitCode = code ?? 0;
  });
  children.push(child);
}

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    // On Windows, kill the whole process tree (npm -> node), not just the shell.
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });

process.stdout.write('Starting API (http://localhost:8100) and web app (http://localhost:8443)...\n');
services.forEach(start);
