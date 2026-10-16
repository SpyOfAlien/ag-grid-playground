// Angular-compiled public consumer example for the shared editor host.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { EditorHostService, EditorRef, type HostedEditor } from '@grid-cells';

interface EditorData {
  readonly label: string;
}

@Component({
  selector: 'example-hosted-editor',
  template: '<p>{{ data().label }}</p><button (click)="close()">Close</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleEditor implements HostedEditor<EditorData> {
  private readonly ref = inject(EditorRef);

  readonly data = input.required<EditorData>();

  close(): void {
    this.ref.close();
  }
}

@Component({
  selector: 'example-editor-owner',
  template: '<button #trigger (click)="open()">Open editor</button>',
  providers: [EditorHostService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleOwner {
  private readonly editorHost = inject(EditorHostService);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly gridContext = { editorHost: this.editorHost };

  open(): void {
    this.editorHost.open(
      { component: ExampleEditor, data: { label: 'Edit details' } },
      { kind: 'popover', options: { width: 320 } },
      { trigger: this.trigger().nativeElement },
    );
  }
}
