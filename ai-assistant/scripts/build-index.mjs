// Builds lib/docs-index.ts from the docs pages listed in docs.json plus the OpenAPI spec.
// Run with `npm run build-index` (Vercel runs it on every deploy).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(here, '..', '..');
const OUT_FILE = path.resolve(here, '..', 'lib', 'docs-index.ts');
const SITE_URL = 'https://docs.me-cash.com';
const MAX_CHUNK_CHARS = 2400;

function navPages(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => navPages(n, out));
  else if (node && typeof node === 'object') {
    for (const key of ['tabs', 'groups', 'pages']) if (node[key]) navPages(node[key], out);
  }
  return out;
}

function parseFrontmatter(src) {
  const match = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: src };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: src.slice(match[0].length) };
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Turns MDX into plain markdown: drops imports and JSX wrappers, keeps their titles and inner text.
// Code fences are left untouched so samples like `<YOUR_API_KEY>` survive.
function mdxToMarkdown(body) {
  const parts = body.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/^\s*(import|export)\s.*$/gm, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/<(img|video|iframe)\b[^>]*\/?>/gi, '')
        .replace(/<[A-Za-z][\w.]*\b[^>]*?\btitle=["']([^"']+)["'][^>]*>/g, '\n**$1**\n')
        .replace(/<\/?[A-Za-z][\w.]*\b[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n');
    })
    .join('');
}

// Splits on paragraph boundaries, never inside a code fence.
function splitLong(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const blocks = [];
  let current = '';
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    current += line + '\n';
    if (!inFence && line.trim() === '' && current.length >= MAX_CHUNK_CHARS * 0.6) {
      blocks.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks;
}

function chunkPage(page, src) {
  const { meta, body } = parseFrontmatter(src);
  const title = meta.title || page;
  const markdown = mdxToMarkdown(body);
  const sections = [];
  let section = { heading: '', anchor: '', lines: [] };
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    const heading = !inFence && line.match(/^#{1,4}\s+(.+?)\s*#*$/);
    if (heading) {
      sections.push(section);
      section = { heading: heading[1].replace(/[*`]/g, ''), anchor: slugify(heading[1]), lines: [] };
    } else {
      section.lines.push(line);
    }
  }
  sections.push(section);

  const chunks = [];
  for (const s of sections) {
    const text = s.lines.join('\n').trim();
    if (text.length < 40) continue;
    const intro = !s.heading && meta.description ? meta.description + '\n\n' : '';
    for (const piece of splitLong(intro + text)) {
      chunks.push({
        title,
        section: s.heading,
        url: `${SITE_URL}/${page === 'index' ? '' : page.replace(/\/index$/, '')}${s.anchor ? '#' + s.anchor : ''}`,
        text: piece,
      });
    }
  }
  return { chunks, openapi: meta.openapi };
}

function resolveRef(spec, ref) {
  return ref.replace(/^#\//, '').split('/').reduce((obj, key) => obj?.[key], spec);
}

// Flattens a JSON schema into "- field (type, required): description" lines.
function describeSchema(spec, schema, prefix = '', depth = 0, lines = []) {
  if (!schema || depth > 4) return lines;
  if (schema.$ref) return describeSchema(spec, resolveRef(spec, schema.$ref), prefix, depth, lines);
  for (const variant of schema.allOf || []) describeSchema(spec, variant, prefix, depth, lines);
  for (const variant of (schema.oneOf || schema.anyOf || []).slice(0, 3)) describeSchema(spec, variant, prefix, depth, lines);
  if (schema.type === 'array' && schema.items) return describeSchema(spec, schema.items, prefix + '[]', depth + 1, lines);
  const required = new Set(schema.required || []);
  for (const [name, raw] of Object.entries(schema.properties || {})) {
    const prop = raw.$ref ? { ...resolveRef(spec, raw.$ref), ...raw } : raw;
    const field = prefix ? `${prefix}.${name}` : name;
    const bits = [prop.type, required.has(name) ? 'required' : null].filter(Boolean).join(', ');
    const enumText = prop.enum ? ` One of: ${prop.enum.join(', ')}.` : '';
    lines.push(`- ${field}${bits ? ` (${bits})` : ''}: ${(prop.description || '').trim()}${enumText}`);
    if (prop.type === 'object' || prop.properties || prop.items || raw.$ref) describeSchema(spec, prop, field, depth + 1, lines);
  }
  return lines;
}

function chunkOpenApi(spec, pageForOperation) {
  const chunks = [];
  for (const [route, ops] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op !== 'object' || !op) continue;
      const key = `${method.toUpperCase()} ${route}`;
      const page = pageForOperation.get(key.toLowerCase());
      const lines = [`${key}`, op.summary || '', (op.description || '').trim()];
      const params = (op.parameters || []).map((p) => (p.$ref ? resolveRef(spec, p.$ref) : p));
      if (params.length) {
        lines.push('Parameters:');
        for (const p of params) lines.push(`- ${p.name} (${p.in}${p.required ? ', required' : ''}): ${(p.description || '').trim()}`);
      }
      const body = op.requestBody?.$ref ? resolveRef(spec, op.requestBody.$ref) : op.requestBody;
      const bodySchema = body?.content?.['application/json']?.schema;
      if (bodySchema) {
        lines.push('Request body fields:');
        describeSchema(spec, bodySchema, '', 0, lines);
      }
      const text = lines.filter(Boolean).join('\n');
      for (const piece of splitLong(text)) {
        chunks.push({
          title: op.summary || key,
          section: `API reference: ${key}`,
          url: page ? `${SITE_URL}/${page}` : `${SITE_URL}/api-reference/introduction`,
          text: piece,
        });
      }
    }
  }
  return chunks;
}

const config = JSON.parse(fs.readFileSync(path.join(DOCS_ROOT, 'docs.json'), 'utf8'));
const pages = [...new Set(navPages(config.navigation))];
const chunks = [];
const pageForOperation = new Map();

for (const page of pages) {
  const file = path.join(DOCS_ROOT, `${page}.mdx`);
  if (!fs.existsSync(file)) {
    console.warn(`skipped missing page ${page}`);
    continue;
  }
  const result = chunkPage(page, fs.readFileSync(file, 'utf8'));
  chunks.push(...result.chunks);
  if (result.openapi) pageForOperation.set(result.openapi.toLowerCase().replace(/\s+/g, ' '), page);
}

const specPath = path.join(DOCS_ROOT, config.api?.path || 'api-reference/openapi.json');
if (fs.existsSync(specPath)) {
  chunks.push(...chunkOpenApi(JSON.parse(fs.readFileSync(specPath, 'utf8')), pageForOperation));
}

const indexed = chunks.map((c, id) => ({ id, ...c }));
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(
  OUT_FILE,
  `// Generated by scripts/build-index.mjs. Do not edit.\nimport type { DocChunk } from './search';\n\nexport const DOC_CHUNKS: DocChunk[] = ${JSON.stringify(indexed)};\n`,
);
console.log(`indexed ${indexed.length} chunks from ${pages.length} pages`);
