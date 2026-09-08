import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface InlineAddProps {
  label: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  /** Keeps the field open after submitting so several rows can be typed in. */
  keepOpen?: boolean;
}

/** "+ Add X" that swaps into an inline input. Enter submits, Escape cancels. */
export function InlineAdd({ label, placeholder, onSubmit, keepOpen = true }: InlineAddProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    onSubmit(trimmed);
    setValue('');
    if (!keepOpen) setOpen(false);
    else inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button type="button" className="btn btn--add btn--block btn--sm" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} />
        {label}
      </button>
    );
  }

  return (
    <form
      className="inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <input
        ref={inputRef}
        className="input"
        style={{ height: 26, fontSize: 12.5 }}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setValue('');
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        aria-label={placeholder}
      />
      <button type="submit" className="btn btn--primary btn--sm" disabled={!value.trim()}>
        Add
      </button>
    </form>
  );
}
