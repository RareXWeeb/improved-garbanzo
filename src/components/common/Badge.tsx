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
      case 'queued':
        return {
          label: 'Queued',
          bg: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
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
      case 'awaiting_review':
        return {
          label: 'In Review',
          bg: 'bg-purple-950/40 text-purple-300/90 border-purple-800/40',
          dot: 'bg-purple-400',
        };
      case 'approved':
        return {
          label: 'Approved',
          bg: 'bg-emerald-950/40 text-emerald-300/90 border-emerald-800/40',
          dot: 'bg-emerald-400',
        };
      case 'regeneration_required':
        return {
          label: 'Regen Needed',
          bg: 'bg-rose-950/40 text-rose-300/90 border-rose-800/40',
          dot: 'bg-rose-400',
        };
      default:
        return {
          label: status,
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
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
