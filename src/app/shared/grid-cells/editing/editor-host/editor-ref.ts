/** Injected into an editor regardless of its popover or dialog presentation. */
export abstract class EditorRef {
  abstract close(): void;
}
