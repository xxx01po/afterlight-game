import { describe, it, expect } from 'vitest';
import { beats } from '@/scenes/chapter-01/beats';
import { KNOWLEDGE } from '@/data/chapter01/knowledge';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('chapter 01 content integrity', () => {
  it('beat ids are unique', () => {
    const ids = beats.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every learn("x") id used in code has a description', () => {
    const dir = (p: string): string[] => readdirSync(p, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? dir(join(p, d.name)) : [join(p, d.name)]));
    const src = dir('src').filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    const used = [...src.matchAll(/(?:learn|knows)\('([a-zA-Z0-9]+)'\)/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((k) => !KNOWLEDGE[k]);
    expect(missing).toEqual([]);
  });
});
