import { Directive, ElementRef, OnDestroy, inject, input, output, signal } from '@angular/core';
import type { ColumnDropTarget } from './column-groups';

@Directive({
  selector: '[appColumnDragGrouping]',
  host: {
    '(pointerdown)': 'start($event)',
    '(mousedown)': 'preventMiddleClick($event)',
    '(auxclick)': 'preventMiddleClick($event)',
    '[class.column-group-hover]': '!!destination()',
  },
})
export class ColumnDragGrouping implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly middleMouseGrouping = input(false);
  readonly groupDrop = output<{ source: string; target: ColumnDropTarget }>();
  readonly groupsDrop = output<{ source: string; target: string }>();
  readonly columnDrop = output<{
    source: string;
    target: ColumnDropTarget | null;
    placement: { columnId: string; after: boolean } | null;
  }>();
  readonly movementPause = output<boolean>();

  readonly canGroup = input.required<(source: string, target: ColumnDropTarget) => boolean>();
  readonly canCombineGroups = input.required<(source: string, target: string) => boolean>();
  readonly isSourceGroup =
    input.required<
      (source: string, target: Extract<ColumnDropTarget, { kind: 'group' }>) => boolean
    >();

  protected readonly destination = signal<{
    source: ColumnDropTarget;
    target: ColumnDropTarget;
  } | null>(null);

  private listeners?: AbortController;
  private highlighted?: HTMLElement;
  private destroyed = false;
  private movementPaused = false;
  private readonly replayedEvents = new WeakSet<Event>();
  private middleDrag?: { source: HTMLElement; pointer: PointerEvent };
  private moveDirection = 1;

  protected start(start: PointerEvent): void {
    if (this.replayedEvents.has(start) || start.pointerType !== 'mouse') return;
    const middle = start.button === 1 && this.middleMouseGrouping();
    if (start.button !== 0 && !middle) return;
    const origin = start.target instanceof HTMLElement ? start.target : null;
    if (origin?.closest('.ag-header-cell-resize, .ag-header-group-cell-resize, button')) return;
    const source = origin?.closest<HTMLElement>('.ag-header-cell[col-id], .ag-header-group-cell');
    if (!source) return;
    const sourceId = source.matches('.ag-header-cell') ? source.getAttribute('col-id') : null;
    const sourceGroupId = source.matches('.ag-header-group-cell')
      ? source.querySelector('[data-column-group-target]')?.getAttribute('data-column-group-target')
      : null;
    const dragged: ColumnDropTarget | null = sourceId
      ? { kind: 'column', id: sourceId }
      : sourceGroupId
        ? { kind: 'group', id: sourceGroupId }
        : null;
    this.clear();
    const host = this.element.nativeElement;
    const document = host.ownerDocument;
    const controller = new AbortController();
    this.listeners = controller;
    const options = { capture: true, signal: controller.signal };
    let moved = false;
    let previousX = start.clientX;
    let shiftHeld = start.shiftKey;
    let lastPointer = start;
    let lastTarget: ColumnDropTarget | null = sourceId ? { kind: 'column', id: sourceId } : null;

    const update = (event: MouseEvent) => {
      moved ||= Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) >= 4;
      const hit = this.findDestination(event);
      const sourceTarget =
        !!hit &&
        (this.isSourceDestination(hit, sourceId) ||
          (hit.destination.kind === 'group' && hit.destination.id === sourceGroupId));
      // Native reordering can put the dragged header under the cursor. Keep the
      // destination seen before that move so its original group still decides the drop.
      if (!sourceTarget) lastTarget = hit?.destination ?? null;
      if ((!shiftHeld && !middle) || !moved || !dragged) {
        this.clearDestination();
        return;
      }
      const valid =
        !!hit &&
        (dragged.kind === 'column'
          ? this.canGroup()(dragged.id, hit.destination)
          : hit.destination.kind === 'group' &&
            this.canCombineGroups()(dragged.id, hit.destination.id));
      if (!hit || sourceTarget || !valid) {
        this.clearDestination();
        return;
      }
      const { target, destination } = hit;
      if (this.highlighted !== target) {
        this.clearDestination();
        this.highlighted = target;
        target.classList.add('column-group-destination');
      }
      this.destination.set({ source: dragged, target: destination });
    };
    const processPointer = (event: PointerEvent) => {
      update(event);
      // Pause native reordering only over an active grouping destination.
      this.setMovementPaused(!!this.destination());
    };
    const updateShift = (held: boolean) => {
      if (held === shiftHeld) return;
      shiftHeld = held;
      const wasPaused = this.movementPaused;
      processPointer(lastPointer);
      if (wasPaused && !this.movementPaused && moved) this.resumeMove(lastPointer, source);
    };
    document.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerId !== start.pointerId || this.replayedEvents.has(event)) return;
        if (event.clientX !== previousX) this.moveDirection = event.clientX > previousX ? 1 : -1;
        previousX = event.clientX;
        lastPointer = event;
        if (this.middleDrag) this.middleDrag.pointer = event;
        shiftHeld = event.shiftKey;
        processPointer(event);
      },
      options,
    );
    document.addEventListener(
      'pointerup',
      (event) => {
        if (event.pointerId !== start.pointerId) return;
        shiftHeld = event.shiftKey;
        update(event);
        const destination = this.destination();
        const bounds = host.getBoundingClientRect();
        const insideGrid =
          event.clientX >= bounds.left &&
          event.clientX < bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY < bounds.bottom;
        const placement = this.findPlacement(event.clientX, sourceId);
        this.clear(false);
        // Commit on this mouse release, after AG Grid disposes its native drag. No drop delay.
        if (destination)
          queueMicrotask(() => {
            if (this.destroyed) return;
            if (destination.source.kind === 'column')
              this.groupDrop.emit({ source: destination.source.id, target: destination.target });
            else if (destination.target.kind === 'group')
              this.groupsDrop.emit({
                source: destination.source.id,
                target: destination.target.id,
              });
          });
        else if ((shiftHeld || middle) && moved && sourceId && insideGrid)
          queueMicrotask(() => {
            if (!this.destroyed)
              this.columnDrop.emit({ source: sourceId, target: lastTarget, placement });
          });
      },
      options,
    );
    document.addEventListener('pointercancel', () => this.clear(), options);
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') this.clear();
        else if (event.key === 'Shift') updateShift(event.shiftKey);
      },
      options,
    );
    document.addEventListener(
      'keyup',
      (event) => {
        if (event.key === 'Shift') updateShift(event.shiftKey);
      },
      options,
    );
    document.defaultView?.addEventListener('blur', () => this.clear(), {
      signal: controller.signal,
    });
    if (middle) {
      start.preventDefault();
      this.middleDrag = { source, pointer: start };
      // AG Grid accepts only left-button starts. It then tracks moves and release
      // by pointer ID, so the physical middle-button events continue that drag.
      const nativeStart = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: start.clientX,
        clientY: start.clientY,
        pointerId: start.pointerId,
        pointerType: start.pointerType,
        isPrimary: start.isPrimary,
        button: 0,
        buttons: 1,
        shiftKey: start.shiftKey,
        ctrlKey: start.ctrlKey,
        altKey: start.altKey,
        metaKey: start.metaKey,
      });
      this.replayedEvents.add(nativeStart);
      (start.target ?? source).dispatchEvent(nativeStart);
    }
  }

  protected preventMiddleClick(event: MouseEvent): void {
    if (event.button !== 1 || !this.middleMouseGrouping()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('.ag-header-cell-resize, .ag-header-group-cell-resize, button')) return;
    if (target?.closest('.ag-header-cell[col-id], .ag-header-group-cell')) event.preventDefault();
  }

  private isSourceDestination(
    hit: { target: HTMLElement; destination: ColumnDropTarget },
    sourceId: string | null,
  ): boolean {
    if (!sourceId) return false;
    if (hit.destination.kind === 'column') return hit.destination.id === sourceId;
    // A native drag can create a split group header covering only the dragged leaf.
    // Treat that temporary header as the source, not as a new drop destination.
    return this.isSourceGroup()(sourceId, hit.destination);
  }

  private findDestination(
    pointer: MouseEvent,
  ): { target: HTMLElement; destination: ColumnDropTarget } | null {
    const host = this.element.nativeElement;
    for (const target of host.querySelectorAll<HTMLElement>(
      '.ag-header-cell[col-id], .ag-header-group-cell',
    )) {
      const targetId = target.matches('.ag-header-group-cell')
        ? target
            .querySelector('[data-column-group-target]')
            ?.getAttribute('data-column-group-target')
        : target.getAttribute('col-id');
      if (!targetId) continue;
      const bounds = target.getBoundingClientRect();
      // Use layout bounds for the full header drop area.
      const left = bounds.left + (bounds.width - target.offsetWidth) / 2;
      const top = bounds.top + (bounds.height - target.offsetHeight) / 2;
      const viewport =
        target.closest('.ag-header-viewport')?.getBoundingClientRect() ??
        host.getBoundingClientRect();
      if (
        pointer.clientX >= Math.max(left, viewport.left) &&
        pointer.clientX < Math.min(left + target.offsetWidth, viewport.right) &&
        pointer.clientY >= Math.max(top, viewport.top) &&
        pointer.clientY < Math.min(top + target.offsetHeight, viewport.bottom)
      )
        return {
          target,
          destination: target.matches('.ag-header-group-cell')
            ? {
                kind: 'group',
                id: targetId,
                partId: Number(
                  target
                    .querySelector('[data-column-group-part]')
                    ?.getAttribute('data-column-group-part'),
                ),
              }
            : { kind: 'column', id: targetId },
        };
    }
    return null;
  }

  private findPlacement(
    clientX: number,
    sourceId: string | null,
  ): { columnId: string; after: boolean } | null {
    for (const header of this.element.nativeElement.querySelectorAll<HTMLElement>(
      '.ag-header-cell[col-id]',
    )) {
      const id = header.getAttribute('col-id');
      const bounds = header.getBoundingClientRect();
      if (id && id !== sourceId && clientX >= bounds.left && clientX < bounds.right)
        return { columnId: id, after: clientX >= bounds.left + bounds.width / 2 };
    }
    return null;
  }

  private resumeMove(event: PointerEvent, source: HTMLElement): void {
    // Native tracking already saw the paused position. A small nudge lets a Shift
    // release resume reordering without requiring another physical pointer move.
    const replay = new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: event.clientX + this.moveDirection * 0.5,
      clientY: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    });
    this.replayedEvents.add(replay);
    (event.target ?? source).dispatchEvent(replay);
  }

  private setMovementPaused(paused: boolean): void {
    if (this.movementPaused === paused) return;
    this.movementPaused = paused;
    this.movementPause.emit(paused);
  }

  private clearDestination(): void {
    this.highlighted?.classList.remove('column-group-destination');
    this.highlighted = undefined;
    this.destination.set(null);
  }

  private clear(cancelNativeDrag = true): void {
    this.clearDestination();
    this.setMovementPaused(false);
    this.listeners?.abort();
    this.listeners = undefined;
    const middle = this.middleDrag;
    this.middleDrag = undefined;
    if (middle && cancelNativeDrag)
      middle.source.dispatchEvent(
        new PointerEvent('pointercancel', {
          bubbles: true,
          pointerId: middle.pointer.pointerId,
          pointerType: 'mouse',
        }),
      );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clear();
  }
}
