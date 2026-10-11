#!/usr/bin/env node
// Troca a base do site (domínio) em todos os arquivos que a escrevem por extenso.
// Uso manual, sem dependências: node scripts/set-site-url.mjs https://espacodecora.com.br
// A base atual é lida do <link rel="canonical"> de index.html, então o script
// pode ser rodado de novo a cada mudança de domínio.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivos = ['index.html', 'robots.txt', 'sitemap.xml', '404.html'];

const nova = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(nova)) {
  console.error('Uso: node scripts/set-site-url.mjs https://exemplo.com.br (https, sem caminho e sem barra final)');
  process.exit(1);
}

const index = readFileSync(join(raiz, 'index.html'), 'utf8');
const achada = index.match(/<link rel="canonical" href="(https?:\/\/[^"/]+)\/?">/);
if (!achada) {
  console.error('Não achei o <link rel="canonical"> em index.html para descobrir a base atual.');
  process.exit(1);
}
const antiga = achada[1];
if (antiga === nova) {
  console.log(`A base já é ${nova}. Nada a fazer.`);
  process.exit(0);
}

for (const nome of arquivos) {
  const caminho = join(raiz, nome);
  if (!existsSync(caminho)) continue;
  const texto = readFileSync(caminho, 'utf8');
  const trocas = texto.split(antiga).length - 1;
  if (trocas) writeFileSync(caminho, texto.split(antiga).join(nova));
  console.log(`${nome}: ${trocas} troca(s)`);
}
console.log(`Base trocada: ${antiga} -> ${nova}`);
