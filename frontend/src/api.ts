import type { Ruleset, RulesetSummary, SimulationResult } from './types';

const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  listRulesets: () => req<RulesetSummary[]>('GET', '/rulesets'),
  getRuleset: (id: string) => req<Ruleset>('GET', `/rulesets/${id}`),
  createRuleset: (body: { name: string; description?: string }) => req<Ruleset>('POST', '/rulesets', body),
  updateRuleset: (id: string, body: Partial<Ruleset>) => req<Ruleset>('PUT', `/rulesets/${id}`, body),
  publishRuleset: (id: string) => req<Ruleset>('POST', `/rulesets/${id}/publish`, {}),
  deleteRuleset: (id: string) => req<{ success: boolean }>('DELETE', `/rulesets/${id}`),
  duplicateRuleset: (id: string) => req<Ruleset>('POST', `/rulesets/${id}/duplicate`, {}),
  importRuleset: (body: Partial<Ruleset>) => req<Ruleset>('POST', '/rulesets/import', body),
  simulate: (id: string, input: unknown) => req<SimulationResult>('POST', `/rulesets/${id}/simulate`, { input }),
};
