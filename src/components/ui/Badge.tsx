import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'live' | 'ai' | 'high' | 'med' | 'low';
  className?: string;
  id?: string;
}

export function Badge({ children, className, id }: BadgeProps) {
  return (
    <span
      id={id}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border border-border text-ice-dim whitespace-nowrap bg-[#f8fafc]',
        className
      )}
    >
      {children}
    </span>
  );
}
