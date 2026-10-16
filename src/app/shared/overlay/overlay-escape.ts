interface EscapeStack {
  readonly handlers: (() => void)[];
  readonly listener: (event: KeyboardEvent) => void;
}

const stacks = new WeakMap<Document, EscapeStack>();

/** Capture Escape once per document and dismiss only the latest registered overlay. */
export function registerOverlayEscape(document: Document, close: () => void): () => void {
  let stack = stacks.get(document);
  if (!stack) {
    const handlers: (() => void)[] = [];
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handlers.at(-1)?.();
    };
    stack = { handlers, listener };
    stacks.set(document, stack);
    document.addEventListener('keydown', listener, true);
  }
  stack.handlers.push(close);
  return () => {
    const index = stack.handlers.indexOf(close);
    if (index < 0) return;
    stack.handlers.splice(index, 1);
    if (!stack.handlers.length) {
      document.removeEventListener('keydown', stack.listener, true);
      stacks.delete(document);
    }
  };
}
