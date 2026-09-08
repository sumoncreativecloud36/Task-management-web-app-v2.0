import { Icon } from './Icon';

interface TickProps {
  done: boolean;
  label: string;
  onToggle: () => void;
  /** Not a scheduled day for this task — shown, but not togglable. */
  disabled?: boolean;
  today?: boolean;
  future?: boolean;
}

/** The Sat→Fri completion checkbox: ○ empty, ✓ green when done. */
export function Tick({ done, label, onToggle, disabled, today, future }: TickProps) {
  const classes = [
    'tick',
    done ? 'tick--done' : '',
    today ? 'tick--today' : '',
    future ? 'tick--future' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      className={classes}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (!disabled) onToggle();
        }
      }}
    >
      {done && <Icon name="check" size={12} strokeWidth={3} />}
    </button>
  );
}
