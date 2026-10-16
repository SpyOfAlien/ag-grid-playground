/** Observe only anchor ancestor child lists, including ancestors after an anchor is moved. */
export function observePopoverAnchor(
  elements: readonly HTMLElement[],
  onRemoved: () => void,
): () => void {
  const observer = new MutationObserver(() => {
    if (elements.some((element) => !element.isConnected)) {
      observer.disconnect();
      onRemoved();
    } else observeAncestors();
  });
  const observeAncestors = () => {
    observer.disconnect();
    const ancestors = new Set<Node>();
    for (const element of elements) {
      let ancestor: Node | null = element.parentNode;
      while (ancestor) {
        ancestors.add(ancestor);
        ancestor = ancestor.parentNode ?? (ancestor instanceof ShadowRoot ? ancestor.host : null);
      }
    }
    for (const ancestor of ancestors) observer.observe(ancestor, { childList: true });
  };
  observeAncestors();
  return () => observer.disconnect();
}
