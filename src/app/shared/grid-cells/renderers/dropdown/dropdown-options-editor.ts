import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { EditorRef, type HostedEditor } from '../../editing/editor-host/public-api';
import type { DropdownEditorData } from './dropdown-editor-data.model';
import { DropdownOptions } from './dropdown-options';

@Component({
  selector: 'app-dropdown-options-editor',
  imports: [DropdownOptions],
  template: `
    <app-dropdown-options
      [options]="data().options"
      [value]="data().initialValue"
      [equals]="data().equals ?? defaultEquals"
      [placeholder]="data().placeholder ?? 'Choose a value'"
      [disabled]="saving()"
      (selected)="choose($event)"
    />
    <p role="alert">{{ error() }}</p>
  `,
  styleUrl: './dropdown-options-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownOptionsEditor<V> implements HostedEditor<DropdownEditorData<V>> {
  private readonly editorRef = inject(EditorRef);
  readonly data = input.required<DropdownEditorData<V>>();

  readonly saving = signal(false);
  readonly error = signal('');

  readonly dirty = computed(() => false);

  readonly defaultEquals = Object.is;

  async choose(value: V): Promise<void> {
    const data = this.data();
    const equals = data.equals ?? Object.is;

    if (
      this.saving() ||
      !data.options.some((option) => !option.disabled && equals(option.value, value))
    )
      return;
    if (data.initialValue != null && equals(data.initialValue, value)) return;

    this.saving.set(true);
    this.error.set('');
    try {
      await data.save(value);
      this.editorRef.close();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
