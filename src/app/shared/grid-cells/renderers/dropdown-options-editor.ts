import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DropdownEditorData } from '../capabilities/dropdown';
import { trackSave } from '../capabilities/save';
import { EditorRef } from '../editing/editor-host/editor-ref';
import type { HostedEditor } from '../editing/editor-host/editor-host.model';
import { DropdownOptions } from './dropdown-options';

@Component({
  selector: 'app-dropdown-options-editor',
  imports: [DropdownOptions],
  template: `
    <app-dropdown-options
      [options]="data().options"
      [value]="data().initialValue"
      [equals]="data().equals ?? defaultEquals"
      [placeholder]="data().placeholder"
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

  private readonly submission = trackSave();
  readonly saving = computed(() => this.submission.state().pending);
  readonly error = computed(() => this.submission.state().error);

  readonly defaultEquals = Object.is;

  async choose(value: V): Promise<void> {
    const data = this.data();
    const equals = data.equals ?? Object.is;
    if (
      this.saving() ||
      !data.options.some((option) => !option.disabled && equals(option.value, value))
    )
      return;
    // Choosing the committed value confirms it without a save.
    if (data.initialValue != null && equals(data.initialValue, value)) {
      this.editorRef.close();
      return;
    }
    if ((await this.submission.run(() => data.save(value))) === 'saved') this.editorRef.close();
  }
}
