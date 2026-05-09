import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { RulesetSummary } from '../types';

const ICONS = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
  ),
  rules: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
  ),
  dots: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Dashboard() {
  const [rulesets, setRulesets] = useState<RulesetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.listRulesets().then(r => { setRulesets(r); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const rs = await api.createRuleset({ name: newName.trim(), description: newDesc.trim() });
    setCreating(false);
    setNewName('');
    setNewDesc('');
    navigate(`/ruleset/${rs.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ruleset?')) return;
    await api.deleteRuleset(id);
    load();
  };

  const handleDuplicate = async (id: string) => {
    await api.duplicateRuleset(id);
    load();
  };

  const handleExport = async (id: string, name: string) => {
    const rs = await api.getRuleset(id);
    const blob = new Blob([JSON.stringify(rs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await api.importRuleset(data);
    load();
    e.target.value = '';
  };

  const filtered = rulesets.filter(r =>
    (r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="font-semibold text-slate-800 text-lg">BRMS</span>
          <span className="text-slate-400 text-sm">/ Rule Sets</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            ref={importRef}
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {ICONS.upload} Import
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            {ICONS.plus} New Ruleset
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Rule Sets</h1>
            <p className="text-slate-500 text-sm mt-1">Build and manage your business rule graphs</p>
          </div>
          <input
            placeholder="Search rulesets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Rulesets', value: rulesets.length },
            { label: 'Published', value: rulesets.filter(r => r.status === 'published').length },
            { label: 'Drafts', value: rulesets.filter(r => r.status === 'draft').length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-800">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-slate-300 mb-4">{ICONS.rules}</div>
            <p className="text-slate-500 font-medium">No rulesets yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first ruleset to get started</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600"
            >
              {ICONS.plus} Create Ruleset
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(rs => (
              <div
                key={rs.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group relative"
                onClick={() => navigate(`/ruleset/${rs.id}`)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500">
                      {ICONS.rules}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rs.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {rs.status}
                      </span>
                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === rs.id ? null : rs.id); }}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {ICONS.dots}
                        </button>
                        {openMenu === rs.id && (
                          <div
                            className="absolute right-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-36"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => { handleDuplicate(rs.id); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              {ICONS.copy} Duplicate
                            </button>
                            <button
                              onClick={() => { handleExport(rs.id, rs.name); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              {ICONS.download} Export JSON
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => { handleDelete(rs.id); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                            >
                              {ICONS.trash} Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-800 truncate">{rs.name}</h3>
                  {rs.description && (
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2">{rs.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                    <span>{rs.nodeCount} nodes</span>
                    <span>Updated {timeAgo(rs.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">New Ruleset</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. Credit Limit Assessment"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder="What does this ruleset do?"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <button
                  onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create & Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close menu on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
