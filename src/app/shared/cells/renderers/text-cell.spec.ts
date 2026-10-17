import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { rendererParams, testSession, tooltipFor, type Item } from '../testing/cell-test-kit';
import { TextCell, type TextCellParams } from './text-cell';

async function render(config: TextCellParams<Item>, value: string | null) {
  const fixture = TestBed.createComponent(TextCell<Item>);
  fixture.componentInstance.agInit(rendererParams(testSession(), config, value));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('TextCell', () => {
  it('shows the formatted value, or the value as is', async () => {
    expect((await render({}, 'Bolt')).textContent?.trim()).toBe('Bolt');
    expect(
      (
        await render({ format: (value, cell) => `${value ?? '?'} · ${cell.row.sku}` }, null)
      ).textContent?.trim(),
    ).toBe('? · A-1');
  });

  it('draws only the highest-priority active marker with its tooltip', async () => {
    const host = await render(
      {
        markers: {
          info: { when: true, tooltip: 'Imported' },
          error: { when: () => false, tooltip: 'Broken' },
          warning: { when: ({ row }) => row.sku === 'A-1', tooltip: 'Review required' },
        },
      },
      'Bolt',
    );

    const markers = host.querySelectorAll('.cells-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0].getAttribute('data-kind')).toBe('warning');
    expect(tooltipFor(markers[0])).toBe('Review required');
  });

  it('applies tooltip, highlighted and muted rules to the content', async () => {
    const host = await render(
      { tooltip: ({ value }) => `Name: ${value}`, highlighted: true, muted: () => true },
      'Bolt',
    );

    const content = host.querySelector('.cells-text')!;
    expect(tooltipFor(content)).toBe('Name: Bolt');
    expect(content.classList).toContain('cells-highlighted');
    expect(content.classList).toContain('cells-muted');
  });

  it('follows signals read by its rules and keeps its element on refresh', async () => {
    const suffix = signal('pcs');
    const session = testSession();
    const fixture = TestBed.createComponent(TextCell<Item>);
    const config: TextCellParams<Item> = { format: (value) => `${value} ${suffix()}` };
    fixture.componentInstance.agInit(rendererParams(session, config, '5'));
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).querySelector('.cells-text')!;

    suffix.set('kg');
    await fixture.whenStable();
    expect(text.textContent).toBe('5 kg');

    expect(fixture.componentInstance.refresh(rendererParams(session, config, '6'))).toBe(true);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.cells-text')).toBe(text);
    expect(text.textContent).toBe('6 kg');
  });

  it('shows an HTML tooltip from a tooltip rule', async () => {
    const host = await render(
      { tooltip: ({ value }) => ({ html: `<b>${value}</b> in stock` }) },
      'Bolt',
    );

    const content = host.querySelector('.cells-text')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    content.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.querySelector('.cells-tooltip b')?.textContent).toBe('Bolt');
    expect(tooltipFor(content)).toBe('Bolt in stock');
  });

  it('passes the column tooltip position to the tooltip', async () => {
    const host = await render({ tooltip: 'Name', tooltipPosition: 'above' }, 'Bolt');

    const content = host.querySelector('.cells-text')!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    content.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(document.querySelector<HTMLElement>('.cells-tooltip')?.dataset['position']).toBe(
      'above',
    );
  });
});
