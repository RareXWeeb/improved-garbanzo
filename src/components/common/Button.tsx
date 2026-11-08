import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors duration-100 rounded-md disabled:opacity-40 disabled:cursor-not-allowed select-none focus:outline-none';

  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1.5 h-7',
    md: 'text-xs px-3 py-1.5 gap-2 h-8',
    lg: 'text-sm px-4 py-2 gap-2 h-9',
  };

  const variants = {
    primary:
      'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 font-semibold border border-transparent',
    accent:
      'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 font-semibold border border-transparent',
    secondary:
      'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white border border-zinc-800 active:bg-zinc-850',
    danger:
      'bg-rose-950/30 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100 border border-rose-900/50',
    ghost:
      'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850',
    outline:
      'bg-transparent text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
