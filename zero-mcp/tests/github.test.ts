import { describe, expect, it } from 'vitest';
import { scoreRepo, type RepoData } from '../src/modules/github.js';

const NOW = Date.parse('2026-11-04T00:00:00Z');
const repo = (o: Partial<RepoData> = {}): RepoData => ({
  full_name: 'a/b', description: 'x', html_url: 'https://github.com/a/b', stargazers_count: 10_000, forks_count: 10, open_issues_count: 20,
  pushed_at: '2026-11-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z', archived: false, fork: false, license: { spdx_id: 'Apache-2.0' },
  language: 'TypeScript', default_branch: 'main', ...o,
});

describe('scoreRepo', () => {
  it('rates an active, permissive, released repo highly', () => {
    const s = scoreRepo({ repo: repo(), latestReleaseAt: '2026-10-20T00:00:00Z', communityHealth: 100, now: NOW });
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.recommendation).toBe('integrate-candidate');
  });
  it('caps archived repos and recommends reject', () => {
    const s = scoreRepo({ repo: repo({ archived: true }), latestReleaseAt: '2026-10-20T00:00:00Z', communityHealth: 100, now: NOW });
    expect(s.score).toBeLessThanOrEqual(10);
    expect(s.recommendation).toBe('reject');
    expect(s.flags[0]).toMatch(/ARCHIVED/);
  });
  it('popularity cannot rescue an abandoned repo', () => {
    const s = scoreRepo({ repo: repo({ stargazers_count: 300_000, pushed_at: '2024-06-01T00:00:00Z', license: { spdx_id: 'NOASSERTION' } }), now: NOW });
    expect(s.recommendation).toBe('reject');
    expect(s.flags).toEqual(expect.arrayContaining(['STALE — no push for over a year', 'LICENSE UNCLEAR']));
  });
  it('notes copyleft licenses', () => {
    const s = scoreRepo({ repo: repo({ license: { spdx_id: 'GPL-3.0' } }), now: NOW });
    expect(s.notes.join(' ')).toMatch(/copyleft/);
  });
});
