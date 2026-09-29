/**
 * True unless the element or an ancestor is `display: none` / `visibility:
 * hidden` (how a docked tab that is not the active one is hidden). Unlike
 * `offsetParent`/`getClientRects`, this also works where there is no layout
 * engine (jsdom), so panel-scoped keyboard shortcuts stay testable.
 */
export function isElementShown(el: Element | null): boolean {
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return el !== null && el.isConnected;
}
