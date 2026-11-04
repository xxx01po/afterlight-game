import { describe, expect, it } from 'vitest';
import { findSecrets, maskValue, redactDeep, redactText } from '../src/core/secrets.js';
import { FAKE } from './fixtures.js';

describe('secret detection', () => {
  it('finds high-confidence tokens and never returns the full value', () => {
    const text = `a=${FAKE.github}\nb=${FAKE.anthropic}\nc=${FAKE.aws}\n${FAKE.privateKey}`;
    const found = findSecrets(text);
    expect(found.map((f) => f.rule)).toEqual(expect.arrayContaining(['github-token', 'anthropic-key', 'aws-access-key', 'private-key']));
    for (const f of found) expect(f.redacted).not.toContain(FAKE.github.slice(8));
  });
  it('flags hard-coded password assignment as medium', () => {
    const f = findSecrets('const password = "hunter2hunter2";');
    expect(f[0]?.confidence).toBe('medium');
  });
  it('does not flag env references', () => {
    expect(findSecrets('const token = process.env.GITHUB_TOKEN;')).toHaveLength(0);
    expect(findSecrets('"Authorization": "Bearer ${GITHUB_PAT}"')).toHaveLength(0);
  });
  it('masks and redacts', () => {
    expect(maskValue('short')).toBe('****');
    expect(redactText(`x ${FAKE.stripe} y`)).not.toContain(FAKE.stripe);
  });
  it('deep-redacts sensitive keys and nested strings', () => {
    const out = redactDeep({ token: 'abcdefghijkl', nested: { note: `use ${FAKE.github}` }, n: 3 }) as Record<string, any>;
    expect(out.token).not.toBe('abcdefghijkl');
    expect(JSON.stringify(out)).not.toContain(FAKE.github);
    expect(out.n).toBe(3);
  });
});
