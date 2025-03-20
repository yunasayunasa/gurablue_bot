import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TypeScriptのコンパイルと実行
const tsc = spawn('npx', ['tsc']);

tsc.stdout.on('data', (data) => {
  console.log(`${data}`);
});

tsc.stderr.on('data', (data) => {
  console.error(`${data}`);
});

tsc.on('close', (code) => {
  if (code === 0) {
    console.log('TypeScript compilation successful');
    import('./dist/start-bot.js')
      .catch(err => console.error('Error loading bot:', err));
  } else {
    console.error('TypeScript compilation failed');
  }
});