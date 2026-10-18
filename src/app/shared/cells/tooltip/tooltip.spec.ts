import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellsTooltip, type TooltipContent } from './tooltip';

@Component({
  imports: [CellsTooltip],
  template: `
    <button type="button" id="first" [cellsTooltip]="first()">First</button>
    <button type="button" id="second" aria-describedby="hint" [cellsTooltip]="'Second tip'">
      Second
    </button>
    <button type="button" id="plain">Plain</button>
    <button type="button" id="right" [cellsTooltip]="'Right tip'" cellsTooltipPosition="right">
      Right
    </button>
    <button type="button" id="cut" [cellsTooltip]="null" [cellsTooltipOverflow]="true">
      <span>Acme Industrial Supplies Ltd.</span>
    </button>
    <button type="button" id="fits" [cellsTooltip]="null" [cellsTooltipOverflow]="true">
      Bolt
    </button>
    <button type="button" id="own" [cellsTooltip]="'Own tip'" [cellsTooltipOverflow]="true">
      Long text
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly first = signal<TooltipContent | null>('First tip');
}

/** Stands in for a popover panel opened while the tooltip exists, with a tooltip of its own. */
@Component({
  imports: [CellsTooltip],
  template: `<button type="button" id="inside" [cellsTooltip]="'Inside tip'">Inside</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Panel {}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`)!;
  return { fixture, element };
}

const tooltip = () => document.querySelector<HTMLElement>('.cells-tooltip');

function pointer(type: 'pointerover' | 'pointerout', element: Element, related?: Element): void {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: related ?? null }));
}

function touch(type: 'pointerdown' | 'pointerup' | 'pointercancel', element: Element): void {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  element.dispatchEvent(event);
}

/** Keyboard focus: a key press, then focus, as when tabbing. */
function focus(element: HTMLElement): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  element.focus();
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

/** jsdom has no layout: make an element report that its content is wider than it is. */
function clip(element: Element): void {
  Object.defineProperty(element, 'scrollWidth', { value: 300 });
  Object.defineProperty(element, 'clientWidth', { value: 120 });
}

describe('CellsTooltip', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
  );

  it('shows cut-off text in full, and nothing when the text fits', async () => {
    const { element } = await setup();
    clip(element('cut').querySelector('span')!);

    focus(element('cut'));
    expect(tooltip()?.textContent?.trim()).toBe('Acme Industrial Supplies Ltd.');

    focus(element('fits'));
    expect(tooltip()).toBeNull();
  });

  it('prefers its own tooltip over the cut-off text', async () => {
    const { element } = await setup();
    clip(element('own'));

    focus(element('own'));

    expect(tooltip()?.textContent?.trim()).toBe('Own tip');
  });

  it('shows the text immediately when its element receives focus', async () => {
    const { element } = await setup();

    focus(element('first'));

    expect(tooltip()?.textContent?.trim()).toBe('First tip');
  });

  it('shows on pointer hover after 100 ms, not before', async () => {
    const { element } = await setup();
    vi.useFakeTimers();
    try {
      pointer('pointerover', element('first'));
      vi.advanceTimersByTime(99);
      expect(tooltip()).toBeNull();

      vi.advanceTimersByTime(1);
      expect(tooltip()?.textContent?.trim()).toBe('First tip');
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches instantly once visible, stays open over itself, and hides when the pointer leaves', async () => {
    const { element } = await setup();
    vi.useFakeTimers();
    try {
      pointer('pointerover', element('first'));
      vi.advanceTimersByTime(100);
      pointer('pointerout', element('first'), element('second'));
      pointer('pointerover', element('second'));
      expect(tooltip()?.textContent?.trim()).toBe('Second tip');

      pointer('pointerout', element('second'), tooltip()!);
      pointer('pointerover', tooltip()!);
      vi.advanceTimersByTime(500);
      expect(tooltip()?.textContent?.trim()).toBe('Second tip');

      pointer('pointerout', tooltip()!, element('plain'));
      pointer('pointerover', element('plain'));
      vi.advanceTimersByTime(500);
      expect(tooltip()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides on blur, Escape, scroll, click and when its element is removed', async () => {
    const { element, fixture } = await setup();
    const hides: [string, () => void][] = [
      ['blur', () => element('first').dispatchEvent(new FocusEvent('focusout', { bubbles: true }))],
      ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
      ['scroll', () => document.body.dispatchEvent(new Event('scroll'))],
      [
        'click',
        () => element('first').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })),
      ],
    ];
    for (const [name, hide] of hides) {
      focus(element('first'));
      expect(tooltip(), name).not.toBeNull();
      hide();
      expect(tooltip(), name).toBeNull();
    }

    focus(element('first'));
    fixture.componentInstance.first.set(null);
    element('first').remove();
    await vi.waitFor(() => expect(tooltip()).toBeNull());
  });

  it('shows nothing for an element whose content is empty', async () => {
    const { element, fixture } = await setup();
    fixture.componentInstance.first.set('');
    await fixture.whenStable();

    focus(element('first'));

    expect(tooltip()).toBeNull();
  });

  it('renders HTML content with scripts and event handlers removed', async () => {
    const { element, fixture } = await setup();
    fixture.componentInstance.first.set({
      html: '<b>Reorder</b> soon<img src="x" onerror="window.hacked = true"><script>window.hacked = true</script>',
    });
    await fixture.whenStable();

    focus(element('first'));

    const shown = tooltip()!;
    expect(shown.querySelector('b')?.textContent).toBe('Reorder');
    expect(shown.querySelector('script')).toBeNull();
    expect(shown.querySelector('[onerror]')).toBeNull();
    expect((window as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it('follows content changes while visible and hides when the content goes away', async () => {
    const { element, fixture } = await setup();
    focus(element('first'));

    fixture.componentInstance.first.set('Save failed');
    await fixture.whenStable();
    await vi.waitFor(() => expect(tooltip()?.textContent?.trim()).toBe('Save failed'));

    fixture.componentInstance.first.set(null);
    await fixture.whenStable();
    await vi.waitFor(() => expect(tooltip()).toBeNull());
  });

  it('keeps a pending hover when the page scrolls during the delay', async () => {
    const { element } = await setup();
    vi.useFakeTimers();
    try {
      pointer('pointerover', element('first'));
      document.body.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(100);

      expect(tooltip()?.textContent?.trim()).toBe('First tip');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows on focus only when the focus came from the keyboard', async () => {
    const { element } = await setup();

    element('first').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    element('first').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tooltip()).toBeNull();

    focus(element('second'));
    expect(tooltip()?.textContent?.trim()).toBe('Second tip');
  });

  it('describes only the element whose tooltip is visible, keeping its own descriptions', async () => {
    const { element } = await setup();

    focus(element('second'));
    const id = tooltip()!.id;
    expect(id).not.toBe('');
    expect(element('second').getAttribute('aria-describedby')).toBe(`hint ${id}`);
    expect(element('first').hasAttribute('aria-describedby')).toBe(false);

    focus(element('first'));
    expect(element('first').getAttribute('aria-describedby')).toBe(id);
    expect(element('second').getAttribute('aria-describedby')).toBe('hint');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(element('first').hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows above an overlay opened after it, such as a dropdown panel', async () => {
    const { element } = await setup();
    focus(element('first'));
    element('first').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    TestBed.inject(Overlay).create().attach(new ComponentPortal(Panel));

    focus(element('second'));

    const container = document.querySelector('.cdk-overlay-container')!;
    expect(container.lastElementChild!.contains(tooltip())).toBe(true);
  });

  it('shows above an overlay opened while it stayed visible', async () => {
    const { element } = await setup();
    focus(element('first'));
    TestBed.inject(Overlay)
      .create()
      .attach(new ComponentPortal(Panel))
      .changeDetectorRef.detectChanges();

    // A visible tooltip switches to the hovered element at once, without hiding first.
    pointer('pointerover', document.querySelector('#inside')!);

    expect(tooltip()?.textContent?.trim()).toBe('Inside tip');
    const container = document.querySelector('.cdk-overlay-container')!;
    expect(container.lastElementChild!.contains(tooltip())).toBe(true);
  });

  it('places the tooltip below by default, or where the element asks', async () => {
    const { element } = await setup();

    focus(element('first'));
    expect(tooltip()?.dataset['position']).toBe('below');

    focus(element('right'));
    expect(tooltip()?.dataset['position']).toBe('right');
  });

  it('shows after a 500 ms touch hold and hides 1.5 s after release; a tap shows nothing', async () => {
    const { element } = await setup();
    vi.useFakeTimers();
    try {
      touch('pointerdown', element('first'));
      vi.advanceTimersByTime(300);
      touch('pointerup', element('first'));
      vi.advanceTimersByTime(1000);
      expect(tooltip()).toBeNull();

      touch('pointerdown', element('first'));
      vi.advanceTimersByTime(500);
      expect(tooltip()?.textContent?.trim()).toBe('First tip');
      touch('pointerup', element('first'));
      vi.advanceTimersByTime(1499);
      expect(tooltip()).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(tooltip()).toBeNull();

      touch('pointerdown', element('first'));
      touch('pointercancel', element('first'));
      vi.advanceTimersByTime(500);
      expect(tooltip()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows its element when a container scrolls and hides once the element scrolls out of view', async () => {
    const { element } = await setup();
    const first = element('first');
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(first);
    const rect = (top: number) => ({
      top,
      bottom: top + 20,
      left: 0,
      right: 80,
      width: 80,
      height: 20,
    });
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0) as DOMRect);
    const inside = vi.spyOn(first, 'getBoundingClientRect');

    inside.mockReturnValue({ ...rect(5) } as DOMRect);
    focus(first);
    container.dispatchEvent(new Event('scroll'));
    expect(tooltip()?.textContent?.trim()).toBe('First tip');

    inside.mockReturnValue({ ...rect(200) } as DOMRect);
    container.dispatchEvent(new Event('scroll'));
    expect(tooltip()).toBeNull();
  });
});
