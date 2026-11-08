import React from 'react';
import { Search } from 'lucide-react';
import { FilterState, QueueStatus } from '../../types/queue';

export interface QueueCounts {
  total: number;
  queued: number;
  ready?: number;
  generating?: number;
  needs_references?: number;
  copied?: number;
  submitted?: number;
  awaiting_review: number;
  approved: number;
  regeneration_required: number;
  failed?: number;
}

interface QueueFilterBarProps {
  filter: FilterState;
  onChange: (updated: FilterState) => void;
  projects?: string[];
  episodes?: string[];
  counts: QueueCounts;
}

export const QueueFilterBar: React.FC<QueueFilterBarProps> = ({
  filter,
  onChange,
  counts,
}) => {
  const statuses: Array<{ id: 'all' | QueueStatus; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'ready', label: 'Ready', count: counts.ready || 0 },
    { id: 'generating', label: 'Active', count: counts.generating || 0 },
    { id: 'awaiting_review', label: 'Review', count: counts.awaiting_review },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'regeneration_required', label: 'Regen', count: counts.regeneration_required },
    { id: 'needs_references', label: 'Needs Ref', count: counts.needs_references || 0 },
    { id: 'failed', label: 'Failed', count: counts.failed || 0 },
    { id: 'queued', label: 'Queued', count: counts.queued },
  ];

  return (
    <div className="flex flex-col gap-2 p-2.5 bg-zinc-900/80 border-b border-zinc-800">
      {/* Search and Sort row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={(e) => onChange({ ...filter, searchQuery: e.target.value })}
            placeholder="Search scene (e.g. 68AD), char, title..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
          />
        </div>

        <select
          value={filter.sortBy}
          onChange={(e) => onChange({ ...filter, sortBy: e.target.value as any })}
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 font-mono"
        >
          <option value="scene_asc">Scene # ↑</option>
          <option value="scene_desc">Scene # ↓</option>
          <option value="status">Status</option>
          <option value="updated_desc">Recent</option>
        </select>
      </div>

      {/* Clean Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {statuses
          .filter((s) => s.id === 'all' || s.count > 0 || ['ready', 'awaiting_review', 'approved'].includes(s.id))
          .map((s) => {
            const isActive = filter.statusFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChange({ ...filter, statusFilter: s.id })}
                className={`shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`text-[10px] font-mono ${
                    isActive ? 'text-zinc-950/70' : 'text-zinc-600'
                  }`}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
};
