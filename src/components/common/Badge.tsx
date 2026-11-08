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
          bg: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40',
          dot: 'bg-emerald-400',
        };
      case 'generating':
        return {
          label: 'Generating',
          bg: 'bg-zinc-800 text-zinc-100 border-zinc-600',
          dot: 'bg-white animate-pulse',
        };
      case 'needs_references':
        return {
          label: 'Needs Ref',
          bg: 'bg-amber-950/30 text-amber-400 border-amber-800/40',
          dot: 'bg-amber-400',
        };
      case 'awaiting_review':
        return {
          label: 'Review',
          bg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
          dot: 'bg-zinc-400',
        };
      case 'approved':
        return {
          label: 'Approved',
          bg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50',
          dot: 'bg-emerald-400',
        };
      case 'regeneration_required':
        return {
          label: 'Regen',
          bg: 'bg-rose-950/30 text-rose-400 border-rose-800/40',
          dot: 'bg-rose-400',
        };
      case 'failed':
        return {
          label: 'Failed',
          bg: 'bg-rose-950/40 text-rose-300 border-rose-800/50',
          dot: 'bg-rose-500',
        };
      case 'paused':
        return {
          label: 'Paused',
          bg: 'bg-zinc-850 text-zinc-400 border-zinc-750',
          dot: 'bg-zinc-500',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-zinc-900 text-zinc-500 border-zinc-800',
          dot: 'bg-zinc-600',
        };
      case 'copied':
        return {
          label: 'Copied',
          bg: 'bg-zinc-850 text-zinc-300 border-zinc-700',
          dot: 'bg-zinc-400',
        };
      case 'submitted':
        return {
          label: 'Submitted',
          bg: 'bg-zinc-800 text-zinc-200 border-zinc-700',
          dot: 'bg-zinc-300',
        };
      case 'queued':
      default:
        return {
          label: 'Queued',
          bg: 'bg-zinc-900 text-zinc-400 border-zinc-800',
          dot: 'bg-zinc-500',
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses =
    size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5 gap-1'
      : 'text-[11px] px-2 py-0.5 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${config.bg} ${sizeClasses} select-none ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="truncate">{config.label}</span>
    </span>
  );
};
