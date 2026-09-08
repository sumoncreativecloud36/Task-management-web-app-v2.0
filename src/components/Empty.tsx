import { Icon, type IconName } from './Icon';

export function Empty({
  icon = 'inbox',
  text,
  actionLabel,
  onAction,
  pad,
}: {
  icon?: IconName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  pad?: boolean;
}) {
  return (
    <div className={pad ? 'empty empty--pad' : 'empty'}>
      <span className="empty__icon">
        <Icon name={icon} size={16} />
      </span>
      <p className="empty__text">{text}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onAction}>
          <Icon name="plus" size={13} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
