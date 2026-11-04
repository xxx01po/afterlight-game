import * as z from 'zod';
import { toZeroError, ZeroError } from '../core/errors.js';
import type { ToolContext, ZeroModule } from '../core/module.js';

export interface RepoData {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  created_at: string;
  archived: boolean;
  disabled?: boolean;
  fork: boolean;
  license: { spdx_id: string | null } | null;
  topics?: string[];
  language: string | null;
  default_branch: string;
}

export interface HealthInput {
  repo: RepoData;
  latestReleaseAt?: string | null;
  communityHealth?: number | null;
  now?: number;
}

const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', '0BSD', 'Unlicense']);
const COPYLEFT = /^(A?GPL|LGPL)/;

/**
 * Transparent, explainable score (0–100). Popularity is deliberately a minor factor:
 * stars can be bought and say nothing about maintenance. Every point is explained.
 */
export function scoreRepo({ repo, latestReleaseAt, communityHealth, now = Date.now() }: HealthInput) {
  const notes: string[] = [];
  const parts: Record<string, number> = {};
  const days = (iso: string) => Math.floor((now - Date.parse(iso)) / 86_400_000);

  const pushedDays = days(repo.pushed_at);
  parts.activity = pushedDays <= 30 ? 25 : pushedDays <= 90 ? 18 : pushedDays <= 180 ? 10 : pushedDays <= 365 ? 5 : 0;
  notes.push(`last push ${pushedDays}d ago → activity ${parts.activity}/25`);

  const spdx = repo.license?.spdx_id ?? null;
  if (spdx && PERMISSIVE.has(spdx)) parts.license = 15;
  else if (spdx && COPYLEFT.test(spdx)) {
    parts.license = 8;
    notes.push(`${spdx} is copyleft: fine to run as a separate MCP process, do not copy code into ZERO`);
  } else {
    parts.license = 0;
    notes.push(`license ${spdx ?? 'missing'}: read LICENSE manually — custom riders exist (e.g. clauses excluding specific companies)`);
  }

  const issueRatio = repo.open_issues_count / Math.max(repo.stargazers_count, 1);
  parts.issues = repo.open_issues_count < 50 || issueRatio < 0.01 ? 10 : issueRatio < 0.05 ? 5 : 0;
  notes.push(`${repo.open_issues_count} open issues+PRs (ratio ${(issueRatio * 100).toFixed(2)}% of stars) → ${parts.issues}/10`);

  if (latestReleaseAt) {
    const rd = days(latestReleaseAt);
    parts.releases = rd <= 180 ? 10 : 5;
    notes.push(`latest release ${rd}d ago → ${parts.releases}/10`);
  } else {
    parts.releases = 0;
    notes.push('no GitHub releases (may publish to npm/PyPI only — verify there)');
  }

  parts.docs = communityHealth != null ? Math.round((communityHealth / 100) * 15) : 5;
  notes.push(communityHealth != null ? `community profile ${communityHealth}% → docs ${parts.docs}/15` : 'community profile unavailable → docs 5/15 (neutral)');

  parts.popularity = Math.min(15, Math.round(Math.log10(repo.stargazers_count + 1) * 3.75));
  notes.push(`${repo.stargazers_count} stars → popularity ${parts.popularity}/15 (low weight on purpose)`);

  let raw = Object.values(parts).reduce((a, b) => a + b, 0);
  if (repo.fork) {
    raw -= 5;
    notes.push('repository is a fork (−5): prefer upstream');
  }
  let score = Math.max(0, Math.round((raw / 90) * 100));
  const flags: string[] = [];
  if (repo.archived || repo.disabled) {
    score = Math.min(score, 10);
    flags.push('ARCHIVED — no fixes, including security fixes');
  }
  if (pushedDays > 365) flags.push('STALE — no push for over a year');
  if (!spdx || spdx === 'NOASSERTION') flags.push('LICENSE UNCLEAR');

  const recommendation = flags.some((f) => f.startsWith('ARCHIVED')) ? 'reject' : score >= 70 ? 'integrate-candidate' : score >= 45 ? 'defer' : 'reject';
  return { score, recommendation, breakdown: parts, flags, notes };
}

async function fetchHealth(owner: string, repo: string, ctx: ToolContext) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { data } = await ctx.http.getJson<RepoData>(base);
  if (!data) throw new ZeroError('NOT_FOUND', `Repository ${owner}/${repo} not found`);
  const [release, community] = await Promise.all([
    ctx.http.getJson<{ published_at?: string }>(`${base}/releases/latest`, { allow404: true }).catch(() => ({ data: null })),
    ctx.http.getJson<{ health_percentage?: number }>(`${base}/community/profile`, { allow404: true }).catch(() => ({ data: null })),
  ]);
  const scored = scoreRepo({ repo: data, latestReleaseAt: release.data?.published_at ?? null, communityHealth: community.data?.health_percentage ?? null });
  return {
    repo: data.full_name,
    url: data.html_url,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    openIssuesAndPRs: data.open_issues_count,
    pushedAt: data.pushed_at,
    license: data.license?.spdx_id ?? null,
    archived: data.archived,
    topics: data.topics ?? [],
    ...scored,
    caveat: 'Metadata score only. Before integrating, read the source, the install scripts and the LICENSE file.',
  };
}

const repoSlug = z.string().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, 'Use "owner/repo"');

export const githubModule: ZeroModule = {
  name: 'github',
  description: 'Read-only public GitHub intelligence: repository health scoring and comparison.',
  defaultEnabled: true,
  requires: {
    env: [{ name: 'GITHUB_TOKEN', optional: true, purpose: 'raises GitHub API limit from 60 to 5000 req/h; a token with NO scopes is enough for public repos' }],
    hosts: ['api.github.com'],
  },
  tools: [
    {
      name: 'github_repo_health',
      title: 'Score a GitHub repository',
      description:
        'Fetch public metadata for one GitHub repository and return an explainable 0–100 health score (activity, license, issue pressure, releases, community docs, popularity with low weight), red flags (archived, stale, unclear license) and a recommendation (integrate-candidate | defer | reject). Use when evaluating an MCP server, library or tool before adopting it.',
      input: z.object({ repo: repoSlug.describe('owner/repo, e.g. microsoft/playwright-mcp') }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      async handler({ repo }, ctx) {
        const [owner, name] = repo.split('/') as [string, string];
        return fetchHealth(owner, name, ctx);
      },
    },
    {
      name: 'github_compare_repos',
      title: 'Compare GitHub repositories',
      description:
        'Score up to 8 repositories with the same rubric as github_repo_health and return them ranked best-first. Failed lookups are reported individually instead of failing the whole call. Use to choose between alternatives (e.g. several browser-automation MCP servers).',
      input: z.object({ repos: z.array(repoSlug).min(2).max(8) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      async handler({ repos }, ctx) {
        const results: unknown[] = [];
        const errors: { repo: string; error: string }[] = [];
        for (const r of repos) {
          const [owner, name] = r.split('/') as [string, string];
          try {
            results.push(await fetchHealth(owner, name, ctx));
          } catch (e) {
            const err = toZeroError(e);
            errors.push({ repo: r, error: `[${err.code}] ${err.message}` });
            if (err.code === 'RATE_LIMITED') break;
          }
        }
        (results as { score: number }[]).sort((a, b) => b.score - a.score);
        return { ranked: results, errors };
      },
    },
  ],
};
