import fs from 'node:fs';
import yaml from 'js-yaml';

const p = 'C:/Users/DATA/.kombai/design-systems/artifacts/new-roelix.ds';
const raw = fs.readFileSync(p, 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
if (!m) { console.log('NO FRONTMATTER'); process.exit(1); }
let data;
try { data = yaml.load(m[1]); } catch (e) { console.log('YAML ERROR:', e.message); process.exit(1); }

const flat = (o, pre = '') => Object.entries(o || {}).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, pre + k + '.') : [[pre + k, v]]);
const keySet = new Set(flat(data).map(([k]) => k));

const refs = new Set();
const walk = (v) => {
  if (typeof v === 'string') { for (const r of v.matchAll(/\{([a-zA-Z0-9_.]+)\}/g)) refs.add(r[1]); }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(data);
const bad = [...refs].filter((r) => !keySet.has(r));
console.log('name:', data.name, '| modes:', JSON.stringify(data.modes));
console.log('palette:', Object.keys(data.color?.palette || {}).length, '| semantic:', Object.keys(data.color?.semantic || {}).length);
console.log('refs:', refs.size, '| unresolved:', bad.length ? bad : 'none');
console.log('textStyles:', Object.keys(data.typography?.textStyle || {}).length, '| components:', Object.keys(data.components || {}).length, '| motion:', Object.keys(data.motionPatterns || {}).length);
console.log('body sections:', [...raw.matchAll(/^## (.+)$/gm)].map((x) => x[1]).join(' | '));
console.log('OK');
