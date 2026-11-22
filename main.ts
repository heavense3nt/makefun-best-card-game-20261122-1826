// Ember Clash — the entry program (Node 22, standard library only). It hands the
// game in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The copy is a plain recursive copy, so what the grader runs
// is byte for byte what this repository holds. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate refuses more than 4 screenshots, so check the count up front and
// fail loudly instead of handing in an entry the scorer would reject.
const shots = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')) : [];
if (shots.length === 0 || shots.length > 4) {
  throw new Error(`expected 1 to 4 screenshots, found ${shots.length}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
