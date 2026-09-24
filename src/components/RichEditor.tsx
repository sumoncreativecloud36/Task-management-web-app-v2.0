import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isEmptyHtml, sanitizeHtml, toEditorHtml } from '../lib/richText';
import { Icon, type IconName } from './Icon';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Smaller toolbar for embedding (task notes). */
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}

type Block = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote';

interface ActiveState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  checklist: boolean;
  block: Block;
}

const NONE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  ul: false,
  ol: false,
  checklist: false,
  block: 'p',
};

// Typing one of these then a space at the start of a line formats it.
const SHORTCUTS: Record<string, string> = {
  '#': 'h1',
  '##': 'h2',
  '###': 'h3',
  '-': 'ul',
  '*': 'ul',
  '1.': 'ol',
  '[]': 'checklist',
  '>': 'blockquote',
};

const exec = (command: string, value?: string) => document.execCommand(command, false, value);

function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * A lightweight document editor (headings, emphasis, lists, checklists, quotes,
 * links) built on contentEditable. Output is sanitised HTML.
 */
export function RichEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  ariaLabel,
  compact,
  autoFocus,
  className,
}: RichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string>('');
  const [active, setActive] = useState<ActiveState>(NONE);
  const [empty, setEmpty] = useState(() => isEmptyHtml(value));

  // Only write into the DOM when the value changes from outside; rewriting on
  // every keystroke would reset the caret.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === lastHtml.current) return;
    el.innerHTML = toEditorHtml(value);
    lastHtml.current = el.innerHTML;
    setEmpty(isEmptyHtml(el.innerHTML));
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [autoFocus]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = isEmptyHtml(el.innerHTML) && !el.querySelector('ul,ol,hr') ? '' : el.innerHTML;
    setEmpty(html === '');
    if (html === lastHtml.current) return;
    lastHtml.current = html;
    onChange(html);
  }, [onChange]);

  const inEditor = (node: Node | null) => Boolean(node && ref.current?.contains(node));

  /**
   * Browsers type into a bare text node when the editor is empty, which makes
   * later Enter/list commands merge lines. Keep every line inside a block.
   */
  const ensureBlock = () => {
    const el = ref.current;
    if (!el) return;
    const onlyBreak = el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR';
    if (!el.firstChild || onlyBreak) {
      el.innerHTML = '<p><br></p>';
      placeCaret(el.firstChild!, 0);
      return;
    }
    const node = window.getSelection()?.anchorNode;
    if (node && node.parentNode === el && node.nodeType === Node.TEXT_NODE) exec('formatBlock', 'p');
  };

  const currentElement = (): HTMLElement | null => {
    const node = window.getSelection()?.anchorNode ?? null;
    if (!inEditor(node)) return null;
    return (node!.nodeType === Node.ELEMENT_NODE ? node : node!.parentElement) as HTMLElement | null;
  };

  const refreshActive = useCallback(() => {
    const el = currentElement();
    if (!el) return;
    const block = (document.queryCommandValue('formatBlock') || 'p').toLowerCase() as Block;
    const list = el.closest('ul,ol');
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      ul: list?.tagName === 'UL' && !list.classList.contains('checklist'),
      ol: list?.tagName === 'OL',
      checklist: Boolean(list?.classList.contains('checklist')),
      block: ['h1', 'h2', 'h3', 'blockquote'].includes(block) ? block : 'p',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, [refreshActive]);

  const setBlock = (block: Block) => {
    exec('formatBlock', active.block === block && block !== 'p' ? 'p' : block);
  };

  const toggleChecklist = () => {
    const list = currentElement()?.closest('ul,ol');
    if (list?.classList.contains('checklist')) {
      exec('insertUnorderedList'); // removes the list
    } else if (list?.tagName === 'UL') {
      list.classList.add('checklist');
    } else {
      exec('insertUnorderedList');
      currentElement()?.closest('ul')?.classList.add('checklist');
    }
  };

  const run = (action: () => void) => {
    ref.current?.focus();
    exec('defaultParagraphSeparator', 'p');
    action();
    emit();
    refreshActive();
  };

  const addLink = () => {
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) exec('insertHTML', `<a href="${encodeURI(href)}">${sanitizeHtml(url)}</a>`);
    else exec('createLink', href);
  };

  const applyShortcut = (kind: string) => {
    if (kind === 'ul') exec('insertUnorderedList');
    else if (kind === 'ol') exec('insertOrderedList');
    else if (kind === 'checklist') toggleChecklist();
    else exec('formatBlock', kind);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key.length === 1 || event.key === 'Enter') ensureBlock();
    const sel = window.getSelection();
    const node = sel?.anchorNode;

    if (event.key === ' ' && sel?.isCollapsed && node?.nodeType === Node.TEXT_NODE) {
      const before = (node.textContent ?? '').slice(0, sel.anchorOffset);
      const block = (node.parentElement?.closest('p,div,h1,h2,h3,li,blockquote') ?? null) as HTMLElement | null;
      const kind = SHORTCUTS[before];
      const atLineStart = block && block !== ref.current ? block.textContent?.startsWith(before) : true;
      if (kind && atLineStart && !node.parentElement?.closest('li')) {
        event.preventDefault();
        const rest = (node.textContent ?? '').slice(before.length);
        const parent = node.parentElement!;
        if (rest) {
          node.textContent = rest;
          placeCaret(node, 0);
        } else {
          parent.removeChild(node);
          if (!parent.textContent) parent.innerHTML = '<br>';
          placeCaret(parent, 0);
        }
        run(() => applyShortcut(kind));
        return;
      }
    }

    if (event.key === 'Tab' && currentElement()?.closest('li')) {
      event.preventDefault();
      run(() => exec(event.shiftKey ? 'outdent' : 'indent'));
      return;
    }

    if (event.key === 'Enter' && currentElement()?.closest('ul.checklist')) {
      // A new checklist item starts unticked.
      window.setTimeout(() => {
        currentElement()?.closest('li')?.removeAttribute('data-checked');
        emit();
      });
    }
  };

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const li = (event.target as HTMLElement).closest('li');
    if (!li || !li.parentElement?.classList.contains('checklist')) return;
    const x = event.clientX - li.getBoundingClientRect().left;
    if (x > 26) return;
    event.preventDefault();
    if (li.getAttribute('data-checked') === 'true') li.removeAttribute('data-checked');
    else li.setAttribute('data-checked', 'true');
    emit();
  };

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a');
    if (link && (event.ctrlKey || event.metaKey)) window.open(link.href, '_blank', 'noopener');
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (html) exec('insertHTML', sanitizeHtml(html));
    else exec('insertText', text);
    emit();
  };

  const tool = (label: string, isOn: boolean, onPress: () => void, content: ReactNode, hint?: string) => (
    <button
      type="button"
      className="rte__btn"
      aria-pressed={isOn}
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      onMouseDown={(event) => {
        event.preventDefault();
        run(onPress);
      }}
    >
      {content}
    </button>
  );
  const icon = (name: IconName) => <Icon name={name} size={compact ? 15 : 16} strokeWidth={2} />;

  return (
    <div className={`rte${compact ? ' rte--compact' : ''}${className ? ` ${className}` : ''}`}>
      <div className="rte__bar scroll" role="toolbar" aria-label="Formatting">
        {tool('Normal text', active.block === 'p' && !active.ul && !active.ol && !active.checklist, () => setBlock('p'), <span className="rte__txt">T</span>)}
        {tool('Heading 1', active.block === 'h1', () => setBlock('h1'), <span className="rte__txt">H1</span>, '# space')}
        {tool('Heading 2', active.block === 'h2', () => setBlock('h2'), <span className="rte__txt">H2</span>, '## space')}
        {!compact && tool('Heading 3', active.block === 'h3', () => setBlock('h3'), <span className="rte__txt">H3</span>, '### space')}
        <span className="rte__sep" />
        {tool('Bold', active.bold, () => exec('bold'), <b className="rte__txt">B</b>, 'Ctrl+B')}
        {tool('Italic', active.italic, () => exec('italic'), <i className="rte__txt rte__txt--i">I</i>, 'Ctrl+I')}
        {tool('Underline', active.underline, () => exec('underline'), <u className="rte__txt">U</u>, 'Ctrl+U')}
        {tool('Strikethrough', active.strike, () => exec('strikeThrough'), <s className="rte__txt">S</s>)}
        {tool('Highlight', false, () => exec('hiliteColor', '#f3d36b'), icon('highlight'))}
        <span className="rte__sep" />
        {tool('Bulleted list', active.ul, () => exec('insertUnorderedList'), icon('listBullet'), '- space')}
        {tool('Numbered list', active.ol, () => exec('insertOrderedList'), icon('listNumber'), '1. space')}
        {tool('Checklist', active.checklist, toggleChecklist, icon('checklist'), '[] space')}
        {tool('Quote', active.block === 'blockquote', () => setBlock('blockquote'), icon('quote'), '> space')}
        {tool('Link', false, addLink, icon('link'))}
        {!compact && (
          <>
            <span className="rte__sep" />
            {tool('Clear formatting', false, () => exec('removeFormat'), icon('eraser'))}
            {tool('Undo', false, () => exec('undo'), icon('undo'), 'Ctrl+Z')}
            {tool('Redo', false, () => exec('redo'), icon('redo'), 'Ctrl+Y')}
          </>
        )}
      </div>
      <div
        ref={ref}
        className="rte__content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-empty={empty ? 'true' : undefined}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onKeyDown={onKeyDown}
        onKeyUp={refreshActive}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onPaste={onPaste}
        onFocus={() => {
          exec('defaultParagraphSeparator', 'p');
          ensureBlock();
        }}
      />
    </div>
  );
}
