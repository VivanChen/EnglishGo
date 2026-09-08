import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scripts = [
  'qa-pet-redesign.mjs',
  'qa-pet-onboarding.mjs',
  'qa-pet-account.mjs',
  'qa-pet-gacha-redesign.mjs',
  'qa-pet-playground.mjs',
  'qa-pet-expedition.mjs',
  'qa-pet-monopoly-journey.mjs',
];

for (const script of scripts) {
  console.log(`Pet world QA: ${script}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  if (exitCode !== 0) process.exit(exitCode);
}
console.log('Pet world QA completed. Reports and screenshots: .superpowers/qa/');
