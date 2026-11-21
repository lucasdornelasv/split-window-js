import { RendererStyleFlags2, type Renderer2 } from '@angular/core';
import type { SplitDomWriter } from '@split-window/core';

/**
 * A `SplitDomWriter` that writes through `Renderer2`, so the styles, classes and attributes
 * of the modes (and of `SplitStyleStash`) go through Angular's renderer.
 */
export function rendererDomWriter(renderer: Renderer2): SplitDomWriter {
  return {
    setStyle: (el, property, value, priority) =>
      renderer.setStyle(
        el,
        property,
        value,
        // DashCase: dash-case names and custom properties (`--split-size`).
        RendererStyleFlags2.DashCase |
          (priority === 'important' ? RendererStyleFlags2.Important : 0),
      ),
    removeStyle: (el, property) => renderer.removeStyle(el, property, RendererStyleFlags2.DashCase),
    addClass: (el, name) => renderer.addClass(el, name),
    removeClass: (el, name) => renderer.removeClass(el, name),
    setAttribute: (el, name, value) => renderer.setAttribute(el, name, value),
    removeAttribute: (el, name) => renderer.removeAttribute(el, name),
  };
}
