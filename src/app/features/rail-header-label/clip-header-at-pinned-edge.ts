import type { DestroyRef } from '@angular/core';

/**
 * Only for browsers without scroll-driven animations: keeps --rail-header-scroll-left on the
 * grid at the horizontal scroll offset, where rail-header-label-rails.css cuts the rails' header
 * row off at the pinned edge. A frame or so behind the scrolling: the browser moves the content
 * before the listener runs. Elsewhere the CSS does it alone and this does nothing.
 */
export function clipHeaderAtPinnedEdge(grid: HTMLElement, destroyRef: DestroyRef): void {
  if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) {
    return;
  }
  const viewport = grid.querySelector<HTMLElement>('.ag-grid-viewport');
  if (!viewport) {
    return;
  }
  const onScroll = () =>
    grid.style.setProperty('--rail-header-scroll-left', `${viewport.scrollLeft}px`);
  const listeners = new AbortController();
  viewport.addEventListener('scroll', onScroll, { passive: true, signal: listeners.signal });
  destroyRef.onDestroy(() => listeners.abort());
  onScroll();
}
