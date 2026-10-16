import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { PopoverService } from './popover-service';
import { POPOVER_REF } from './popover-ref';
@Component({
  template: '<input aria-label="Value" /><button (click)="ref.close()">Close</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Content {
  readonly ref = inject(POPOVER_REF);
}
@Component({ template: '{{ value() }}', changeDetection: ChangeDetectionStrategy.OnPush })
class RequiredContent {
  readonly value = input.required<string>();
}
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Owner {
  readonly lifetime = inject(DestroyRef);
}
describe('PopoverService', () => {
  let trigger: HTMLButtonElement;
  beforeEach(() => {
    trigger = document.createElement('button');
    document.body.append(trigger);
  });
  afterEach(() => trigger.remove());
  it('creates on demand, injects its reference, closes on capture Escape, and disposes the pane', async () => {
    const service = TestBed.inject(PopoverService);
    const ref = service.open(Content, { trigger });
    expect(ref.content.instance.ref).toBe(ref);
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const target = container.querySelector('input')!;
    target.addEventListener('keydown', (event) => event.stopPropagation());
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ref.isClosed()).toBe(true);
    expect(container.querySelector('.kit-popover-pane')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('initializes required content inputs before their first render and cleans failed initialization', () => {
    const service = TestBed.inject(PopoverService);
    const ref = service.open(RequiredContent, {
      trigger,
      initialize: (content) => content.setInput('value', 'Initialized'),
    });
    expect(ref.content.instance.value()).toBe('Initialized');
    ref.close();
    expect(() =>
      service.open(RequiredContent, {
        trigger,
        initialize: () => {
          throw new Error('Failed');
        },
      }),
    ).toThrow('Failed');
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.kit-popover-pane'),
    ).toBeNull();
  });
  it('does not close on a backdrop click when disabled, but Escape still closes', () => {
    const ref = TestBed.inject(PopoverService).open(Content, {
      trigger,
      options: { backdrop: true, closeOnBackdropClick: false },
    });
    TestBed.inject(OverlayContainer)
      .getContainerElement()
      .querySelector<HTMLElement>('.kit-popover-backdrop')!
      .click();
    expect(ref.isClosed()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ref.isClosed()).toBe(true);
  });
  it('closes when its owner is destroyed', () => {
    const owner = TestBed.createComponent(Owner);
    const ref = TestBed.inject(PopoverService).open(Content, {
      trigger,
      owner: owner.componentInstance.lifetime,
    });
    owner.destroy();
    expect(ref.isClosed()).toBe(true);
  });
  it('closes when an anchor ancestor is removed, including after reparenting', async () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    first.append(trigger);
    const ref = TestBed.inject(PopoverService).open(Content, { trigger });
    const closed = vi.fn();
    ref.afterClosed.subscribe(closed);
    second.append(trigger);
    await new Promise((resolve) => setTimeout(resolve, 0));
    first.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ref.isClosed()).toBe(false);
    second.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ref.isClosed()).toBe(true);
    expect(closed).toHaveBeenCalledWith('anchor-removed');
  });
  it('cleans up when content closes the popover during initialization and replays the close reason', () => {
    const ref = TestBed.inject(PopoverService).open(Content, {
      trigger,
      initialize: (content) => content.instance.ref.close(),
    });
    const closed = vi.fn();
    ref.afterClosed.subscribe(closed);
    expect(ref.isClosed()).toBe(true);
    expect(closed).toHaveBeenCalledWith('programmatic');
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
    ).toBeNull();
    const wheel = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
  it('blocks background wheel and touch gestures by default, allows editor scrolling, and releases on close', () => {
    const ref = TestBed.inject(PopoverService).open(Content, { trigger });
    const content = ref.content.location.nativeElement as HTMLElement;
    for (const type of ['wheel', 'touchmove']) {
      const outside = new Event(type, { bubbles: true, cancelable: true });
      trigger.dispatchEvent(outside);
      expect(outside.defaultPrevented).toBe(true);
      const inside = new Event(type, { bubbles: true, cancelable: true });
      content.dispatchEvent(inside);
      expect(inside.defaultPrevented).toBe(false);
    }
    ref.close();
    const after = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
  it('allows background scrolling when configured, including with a backdrop', () => {
    const ref = TestBed.inject(PopoverService).open(Content, {
      trigger,
      options: { scrollable: true, backdrop: true },
    });
    const wheel = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    ref.close();
  });
  it('keeps background scrolling blocked until the last blocking popover closes', () => {
    const service = TestBed.inject(PopoverService);
    const first = service.open(Content, { trigger });
    const second = service.open(Content, { trigger });
    first.close();
    const during = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    second.close();
    const after = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
