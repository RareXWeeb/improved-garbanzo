import React from 'react';
import { Search } from 'lucide-react';
import { FilterState, QueueStatus } from '../../types/queue';

interface QueueFilterBarProps {
  filter: FilterState;
  onChange: (updated: FilterState) => void;
  projects?: string[];
  episodes?: string[];
  counts: {
    total: number;
    queued: number;
    copied: number;
    submitted: number;
    awaiting_review: number;
    approved: number;
    regeneration_required: number;
  };
}

export const QueueFilterBar: React.FC<QueueFilterBarProps> = ({
  filter,
  onChange,
  counts,
}) => {
  const statuses: Array<{ id: 'all' | QueueStatus; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'queued', label: 'Queued', count: counts.queued },
    { id: 'copied', label: 'Copied', count: counts.copied },
    { id: 'submitted', label: 'Submitted', count: counts.submitted },
    { id: 'awaiting_review', label: 'Review', count: counts.awaiting_review },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'regeneration_required', label: 'Regen', count: counts.regeneration_required },
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
        {statuses.map((s) => {
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
