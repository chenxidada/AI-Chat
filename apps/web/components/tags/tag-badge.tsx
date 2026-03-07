import { cn } from '@/lib/utils';

interface TagBadgeProps {
  name: string;
  color: string;
  count?: number;
  active?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ name, color, count, active, onRemove, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
        active ? 'ring-2 ring-offset-1' : '',
        className
      )}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        ...(active ? { ringColor: color } : {}),
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
      {count !== undefined && count > 0 && (
        <span className="opacity-60">{count}</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-80"
        >
          &times;
        </button>
      )}
    </span>
  );
}
