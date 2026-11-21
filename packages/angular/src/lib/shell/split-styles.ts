/**
 * Global styles of SplitWindow. Every color, size and layer is a CSS custom property, so an
 * application can theme the library without overriding selectors.
 */
export const SPLIT_WINDOW_STYLES = `
/* Zero specificity: an app ':root' (or any selector) wins regardless of stylesheet order. */
:where(:root) {
  --split-bg: #ffffff;
  --split-fg: #1f2328;
  --split-muted-fg: #59636e;
  --split-border: #d1d9e0;
  --split-strip-bg: #f6f8fa;
  --split-tab-bg: transparent;
  --split-tab-hover-bg: #eaeef2;
  --split-tab-active-bg: #ffffff;
  --split-tab-active-indicator: #0969da;
  --split-focus-ring: #0969da;
  --split-drop-highlight: #0969da;
  --split-drop-zone-bg: rgba(9, 105, 218, 0.08);
  --split-backdrop-bg: rgba(0, 0, 0, 0.32);
  --split-radius: 6px;
  --split-tab-height: 36px;
  --split-tab-max-width: 220px;
  --split-font: inherit;
  --split-body-z-index: 1040;
  --split-expanded-z-index: 1050;
  --split-drop-zone-z-index: 1060;
  --split-drag-preview-z-index: 1070;
  --split-overlay-z-index: 1030;
  --split-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
}

split-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--split-bg);
  color: var(--split-fg);
  font: var(--split-font);
  border: 1px solid var(--split-border);
  border-radius: var(--split-radius);
  overflow: hidden;
  outline: none;
}
split-container[hidden] { display: none; }
split-container.split-container--expanded {
  z-index: var(--split-expanded-z-index);
  box-shadow: var(--split-shadow);
}

.split-strip-row {
  display: flex;
  align-items: stretch;
  background: var(--split-strip-bg);
  border-bottom: 1px solid var(--split-border);
  min-height: var(--split-tab-height);
}
.split-strip {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.split-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: var(--split-tab-max-width);
  padding: 0 4px 0 0;
  background: var(--split-tab-bg);
  border-right: 1px solid var(--split-border);
  color: var(--split-muted-fg);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  height: var(--split-tab-height);
  position: relative;
}
.split-tab:hover { background: var(--split-tab-hover-bg); }
.split-tab__label:focus-visible { outline: 2px solid var(--split-focus-ring); outline-offset: -2px; border-radius: 4px; }
.split-tab--active {
  background: var(--split-tab-active-bg);
  color: var(--split-fg);
  box-shadow: inset 0 -2px 0 var(--split-tab-active-indicator);
}
.split-tab__label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px 0 12px;
  line-height: var(--split-tab-height);
}
.split-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}
.split-icon-button:hover:not(:disabled) { background: var(--split-tab-hover-bg); color: var(--split-fg); }
.split-icon-button:focus-visible { outline: 2px solid var(--split-focus-ring); }
.split-icon-button:disabled { opacity: 0.4; cursor: default; }
.split-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  border-left: 1px solid var(--split-border);
  color: var(--split-muted-fg);
}
.split-content {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
.split-content:empty::before {
  content: attr(data-empty-label);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--split-muted-fg);
}
.split-content .cdk-drag-placeholder { display: none; }
.split-tab-panel { height: 100%; box-sizing: border-box; }
.split-tab-panel[hidden] { display: none; }

/* Drag and drop */
.split-strip.cdk-drop-list-dragging .split-tab:not(.cdk-drag-placeholder) {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}
.split-tab.cdk-drag-placeholder { opacity: 0.35; }
.split-tab.cdk-drag-animating { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
.split-drag-preview {
  z-index: var(--split-drag-preview-z-index) !important;
  background: var(--split-tab-active-bg);
  color: var(--split-fg);
  border: 1px solid var(--split-border);
  border-radius: var(--split-radius);
  box-shadow: var(--split-shadow);
  font: var(--split-font);
}
split-container.split-drop-target {
  outline: 2px solid var(--split-drop-highlight);
  outline-offset: -2px;
}

/* Body containers */
.split-body-host {
  position: fixed;
  z-index: var(--split-body-z-index);
  box-sizing: border-box;
  --split-body-size: 420px;
}
.split-body-host[hidden] { display: none; }
.split-body-host--left { top: 0; bottom: 0; left: 0; width: var(--split-body-size); }
.split-body-host--right { top: 0; bottom: 0; right: 0; width: var(--split-body-size); }
.split-body-host--top { top: 0; left: 0; right: 0; height: var(--split-body-size); }
.split-body-host--bottom { bottom: 0; left: 0; right: 0; height: var(--split-body-size); }
.split-body-host split-container { border-radius: 0; box-shadow: var(--split-shadow); }
.split-body-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--split-body-z-index) - 1);
  background: var(--split-backdrop-bg);
}
.split-body-backdrop[hidden] { display: none; }

/* Floating drop zones of closed containers */
.split-drop-zone {
  position: fixed;
  z-index: var(--split-drop-zone-z-index);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 8px;
  border: 2px dashed var(--split-drop-highlight);
  border-radius: var(--split-radius);
  background: var(--split-bg);
  background-image: linear-gradient(var(--split-drop-zone-bg), var(--split-drop-zone-bg));
  color: var(--split-fg);
  box-shadow: var(--split-shadow);
  font: var(--split-font);
  text-align: center;
}
.split-drop-zone.cdk-drop-list-dragging { border-style: solid; }
.split-drop-zone .cdk-drag-placeholder { display: none; }

.split-expand-layer { position: static; }

/* Custom containers in push/overlay: the engine sets --split-inset/-w/-h per side. */
split-container.split-container--custom:not(.split-layout--inline) {
  position: absolute;
  inset: var(--split-inset);
  width: var(--split-w);
  height: var(--split-h);
}
split-container.split-container--custom.split-layout--overlay {
  z-index: var(--split-overlay-z-index);
  box-shadow: var(--split-shadow);
}
split-container.split-container--leaving .split-content:empty::before { content: none; }

@media (prefers-reduced-motion: reduce) {
  .split-strip.cdk-drop-list-dragging .split-tab, .split-tab.cdk-drag-animating { transition: none; }
}
`;
