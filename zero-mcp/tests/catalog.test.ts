import { describe, expect, it } from 'vitest';
import { loadCatalog, renderMcpJson } from '../src/modules/catalog.js';
import { lintMcpServers } from '../src/modules/security.js';

describe('vetted catalog', () => {
  const c = loadCatalog();
  it('parses and has unique ids', () => {
    const ids = c.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('passes ZERO\'s own linter: pinned, no literal secrets, no unsafe launch', () => {
    const rendered = renderMcpJson(c.entries).mcpServers;
    const issues = lintMcpServers(rendered).filter((i) => i.severity !== 'low');
    expect(issues).toEqual([]);
  });
  it('every non-rejected entry documents a reason and its secrets by name only', () => {
    for (const e of c.entries) {
      expect(e.reason.length).toBeGreaterThan(20);
      for (const s of e.secrets) expect(s.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
