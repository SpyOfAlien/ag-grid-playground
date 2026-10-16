import { TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { EditorRef } from '../editor-host/editor-ref';
import { provideGridCellLabels } from '../../core/labels';
import { InputEditor } from './input-editor';
import { TextareaEditor } from './textarea-editor';
import type { InputEditorData } from './input-editor';
import type { TextareaEditorData } from './textarea-editor';

describe('Built-in field editors', () => {
  function setupRef() {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: EditorRef, useValue: { close } }] });
    return close;
  }

  it('initializes a typed draft and validators, submits its value, and closes after commit', async () => {
    const close = setupRef();
    const fixture = TestBed.createComponent<InputEditor<string>>(InputEditor);
    const save = vi.fn<(value: string | null) => Promise<void>>().mockResolvedValue();
    fixture.componentRef.setInput('data', {
      initialValue: 'Original',
      config: { label: 'Name', mode: 'text', validators: [Validators.required] },
      save,
    } satisfies InputEditorData<string>);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.control.value).toBe('Original');
    expect(editor.dirty()).toBe(false);
    editor.control.setValue('');
    await editor.save();
    expect(save).not.toHaveBeenCalled();
    expect(editor.invalid()).toBe(true);
    editor.control.setValue('Next');
    expect(editor.dirty()).toBe(true);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(save).toHaveBeenCalledWith('Next');
    expect(close).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('input').getAttribute('aria-label')).toBe('Name');
  });

  it('keeps failed drafts for retry and reports business authorization errors from save', async () => {
    const close = setupRef();
    const fixture = TestBed.createComponent<InputEditor<string>>(InputEditor);
    const save = vi
      .fn<(value: string | null) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Failed save'))
      .mockRejectedValueOnce(new Error('Locked'))
      .mockResolvedValue();
    fixture.componentRef.setInput('data', {
      initialValue: 'Old',
      config: { label: 'Name', mode: 'text' },
      save,
    } satisfies InputEditorData<string>);
    await fixture.whenStable();
    fixture.componentInstance.control.setValue('Draft');
    await fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Failed save');
    expect(fixture.componentInstance.control.value).toBe('Draft');
    expect(close).not.toHaveBeenCalled();
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toBe('Locked');
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledOnce();
  });

  it('preserves zero and nullable numbers, rejecting non-finite numeric values', async () => {
    setupRef();
    const fixture = TestBed.createComponent<InputEditor<number>>(InputEditor);
    const save = vi.fn<(value: number | null) => Promise<void>>().mockResolvedValue();
    fixture.componentRef.setInput('data', {
      initialValue: 0,
      config: { label: 'Amount', mode: 'number' },
      save,
    } satisfies InputEditorData<number>);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.control.value).toBe(0);
    expect(editor.dirty()).toBe(false);
    await editor.save();
    expect(save).toHaveBeenLastCalledWith(0);
    editor.control.setValue(NaN);
    await editor.save();
    expect(editor.invalid()).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    editor.control.setValue(null);
    await editor.save();
    expect(save).toHaveBeenLastCalledWith(null);
  });

  it('waits for async validation, guards duplicate saves and allows dismissal while saving', async () => {
    const close = setupRef();
    const validation = new Subject<null>();
    let finish!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const fixture = TestBed.createComponent<InputEditor<string>>(InputEditor);
    fixture.componentRef.setInput('data', {
      initialValue: 'Valid',
      config: { label: 'Name', mode: 'text', asyncValidators: [() => validation] },
      save,
    } satisfies InputEditorData<string>);
    await fixture.whenStable();
    expect(fixture.componentInstance.canSave()).toBe(false);
    await fixture.componentInstance.save();
    expect(save).not.toHaveBeenCalled();
    validation.next(null);
    validation.complete();
    await fixture.whenStable();
    const pending = fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').readOnly).toBe(true);
    fixture.nativeElement.querySelector('button[type="button"]').click();
    expect(close).toHaveBeenCalledOnce();
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledOnce();
    finish();
    await pending;
  });

  it('textarea preserves line breaks, applies length limits, and cancels without saving', async () => {
    const close = setupRef();
    const fixture = TestBed.createComponent(TextareaEditor);
    const save = vi.fn<(value: string) => Promise<void>>().mockResolvedValue();
    fixture.componentRef.setInput('data', {
      initialValue: 'Line one\nLine two',
      config: { label: 'Notes', rows: 6, placeholder: 'Notes', maxLength: 30 },
      save,
    } satisfies TextareaEditorData);
    await fixture.whenStable();
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(6);
    expect(textarea.value).toBe('Line one\nLine two');
    expect(textarea.maxLength).toBe(30);
    fixture.componentInstance.control.setValue('x'.repeat(31));
    await fixture.componentInstance.save();
    expect(save).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button[type="button"]').click();
    expect(close).toHaveBeenCalledOnce();
    fixture.componentInstance.control.setValue('Edited\nNotes');
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith('Edited\nNotes');
  });

  it('uses provided labels for its actions and validation message', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: EditorRef, useValue: { close: vi.fn() } },
        provideGridCellLabels({
          save: 'Enregistrer',
          cancel: 'Annuler',
          invalid: 'Valeur invalide',
        }),
      ],
    });
    const fixture = TestBed.createComponent<InputEditor<string>>(InputEditor);
    fixture.componentRef.setInput('data', {
      initialValue: 'A',
      config: { label: 'Nom', mode: 'text' },
      save: async () => undefined,
    } satisfies InputEditorData<string>);
    await fixture.whenStable();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      (button) => button.textContent?.trim(),
    );
    expect(buttons).toEqual(['Enregistrer', 'Annuler']);
  });
});
