import React from 'react';
import { QueueStatus } from '../../types/queue';

interface StatusBadgeProps {
  status: QueueStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'ready':
        return {
          label: 'Ready',
          bg: 'bg-emerald-950/40 text-emerald-300/90 border-emerald-800/40',
          dot: 'bg-emerald-400',
        };
      case 'generating':
        return {
          label: 'Generating',
          bg: 'bg-orange-950/50 text-orange-300 border-orange-800/60 shadow-sm shadow-orange-900/30',
          dot: 'bg-orange-400 animate-ping',
        };
      case 'needs_references':
        return {
          label: 'Needs References',
          bg: 'bg-amber-950/40 text-amber-300/90 border-amber-800/40',
          dot: 'bg-amber-400',
        };
      case 'awaiting_review':
        return {
          label: 'In Review',
          bg: 'bg-purple-950/40 text-purple-300/90 border-purple-800/40',
          dot: 'bg-purple-400',
        };
      case 'approved':
        return {
          label: 'Approved',
          bg: 'bg-emerald-950/50 text-emerald-200 border-emerald-700/60',
          dot: 'bg-emerald-400',
        };
      case 'regeneration_required':
        return {
          label: 'Regen Needed',
          bg: 'bg-rose-950/40 text-rose-300/90 border-rose-800/40',
          dot: 'bg-rose-400',
        };
      case 'failed':
        return {
          label: 'Failed',
          bg: 'bg-rose-950/60 text-rose-200 border-rose-700/70',
          dot: 'bg-rose-500',
        };
      case 'paused':
        return {
          label: 'Paused',
          bg: 'bg-yellow-950/40 text-yellow-300/90 border-yellow-800/40',
          dot: 'bg-yellow-400',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-zinc-850 text-zinc-400 border-zinc-700/50',
          dot: 'bg-zinc-500',
        };
      case 'copied':
        return {
          label: 'Copied',
          bg: 'bg-amber-950/40 text-amber-300/90 border-amber-800/40',
          dot: 'bg-amber-400',
        };
      case 'submitted':
        return {
          label: 'Submitted',
          bg: 'bg-blue-950/40 text-blue-300/90 border-blue-800/40',
          dot: 'bg-blue-400',
        };
      case 'queued':
      default:
        return {
          label: 'Queued',
          bg: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
          dot: 'bg-zinc-500',
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-[11px] px-2 py-0.5 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${config.bg} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="truncate">{config.label}</span>
    </span>
  );
};
