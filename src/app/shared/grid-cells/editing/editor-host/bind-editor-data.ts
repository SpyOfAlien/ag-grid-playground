import { isSignal, reflectComponentType, type ComponentRef } from '@angular/core';
import type { HostedEditor } from './editor-host.model';

/** Validate Angular input metadata once, then bind before the editor's first render. */
export function bindEditorData<D>(content: ComponentRef<HostedEditor<D>>, data: D): void {
  const input = reflectComponentType(content.componentType)?.inputs.find(
    (item) => item.propName === 'data',
  );
  if (!input?.isSignal || !isSignal(content.instance.data))
    throw new Error('A hosted editor must expose a signal data input.');
  content.setInput(input.templateName, data);
}
