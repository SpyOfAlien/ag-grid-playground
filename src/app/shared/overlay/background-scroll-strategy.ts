import type { Overlay, ScrollStrategy } from '@angular/cdk/overlay';

interface ScrollBlock {
  readonly strategy: ScrollStrategy;
  readonly preventBackgroundScroll: (event: Event) => void;
  users: number;
}

const blocks = new WeakMap<Document, ScrollBlock>();

/** Block page and nested background scroll gestures, allowing all editor overlays to scroll. */
export function backgroundScrollStrategy(overlay: Overlay, document: Document): ScrollStrategy {
  let enabled = false;
  return {
    attach: () => {},
    enable: () => {
      if (enabled) return;
      enabled = true;
      let block = blocks.get(document);
      if (!block) {
        const preventBackgroundScroll = (event: Event) => {
          if (
            event
              .composedPath()
              .some(
                (target) =>
                  target instanceof Element && target.classList.contains('cdk-overlay-pane'),
              )
          )
            return;
          event.preventDefault();
          event.stopPropagation();
        };
        block = { strategy: overlay.scrollStrategies.block(), preventBackgroundScroll, users: 0 };
        blocks.set(document, block);
        block.strategy.enable();
        for (const type of ['wheel', 'touchmove'])
          document.addEventListener(type, preventBackgroundScroll, {
            capture: true,
            passive: false,
          });
      }
      block.users++;
    },
    disable: () => {
      if (!enabled) return;
      enabled = false;
      const block = blocks.get(document)!;
      if (--block.users) return;
      for (const type of ['wheel', 'touchmove'])
        document.removeEventListener(type, block.preventBackgroundScroll, true);
      block.strategy.disable();
      blocks.delete(document);
    },
  };
}
