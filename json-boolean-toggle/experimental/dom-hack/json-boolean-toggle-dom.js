(() => {
  'use strict';

  const STYLE_ID = 'json-boolean-toggle-dom-style';
  const TOGGLE_CLASS = 'json-boolean-dom-toggle';
  const STATE_ATTRIBUTE = 'data-json-boolean-toggle-state';
  const STATE_BY_LABEL = new Map([
    ['🟢 ON', 'on'],
    ['🔴 OFF', 'off'],
  ]);

  /**
   * Normalizes non-breaking spaces inserted by the Monaco inlay hint renderer.
   *
   * @param {string | null} text - Rendered node text.
   * @returns {string} Normalized label text.
   */
  function normalizeLabel(text) {
    return (text ?? '').replace(/\u00a0/g, ' ').trim();
  }

  /**
   * Adds component styling metadata to a matching inlay hint span.
   *
   * @param {Element} element - Candidate DOM element.
   * @returns {void}
   */
  function decorateElement(element) {
    if (!(element instanceof HTMLElement) || element.tagName !== 'SPAN') {
      return;
    }

    const state = STATE_BY_LABEL.get(normalizeLabel(element.textContent));

    if (state === undefined) {
      return;
    }

    element.classList.add(TOGGLE_CLASS);
    element.setAttribute(STATE_ATTRIBUTE, state);
    element.title = 'Click to toggle this JSON boolean';
  }

  /**
   * Decorates matching inlay hint spans below a DOM root.
   *
   * @param {ParentNode} root - Root node to inspect.
   * @returns {void}
   */
  function decorateTree(root) {
    if (root instanceof Element) {
      decorateElement(root);
    }

    for (const element of root.querySelectorAll('.view-line span')) {
      decorateElement(element);
    }
  }

  /**
   * Finds the smallest decorated toggle containing an event target.
   *
   * @param {EventTarget | null} target - Native event target.
   * @returns {HTMLElement | undefined} Matching toggle element when present.
   */
  function findToggle(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    const toggle = target.closest(`.${TOGGLE_CLASS}`);
    return toggle instanceof HTMLElement ? toggle : undefined;
  }

  /**
   * Converts one trusted left-button release into Monaco's native double-click gesture.
   *
   * @param {MouseEvent} event - Captured renderer mouse event.
   * @returns {void}
   */
  function handleMouseUp(event) {
    if (!event.isTrusted || event.button !== 0 || event.detail !== 1) {
      return;
    }

    const toggle = findToggle(event.target);

    if (toggle === undefined) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    toggle.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        detail: 2,
        view: window,
      }),
    );
  }

  /** Adds the unsupported renderer styles once per workbench window. */
  function installStyles() {
    if (document.getElementById(STYLE_ID) !== null) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${TOGGLE_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        min-width: 54px !important;
        margin: 0 2px !important;
        padding: 1px 8px 1px 5px !important;
        border: 1px solid color-mix(in srgb, var(--json-toggle-accent) 78%, white) !important;
        border-radius: 999px !important;
        background: color-mix(in srgb, var(--json-toggle-accent) 24%, transparent) !important;
        color: color-mix(in srgb, var(--json-toggle-accent) 55%, white) !important;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--json-toggle-accent) 18%, transparent),
          0 2px 8px color-mix(in srgb, var(--json-toggle-accent) 24%, transparent) !important;
        font-weight: 700 !important;
        letter-spacing: 0.02em !important;
        cursor: pointer !important;
        user-select: none !important;
        transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease !important;
      }

      .${TOGGLE_CLASS}[${STATE_ATTRIBUTE}='on'] {
        --json-toggle-accent: #22c55e;
      }

      .${TOGGLE_CLASS}[${STATE_ATTRIBUTE}='off'] {
        --json-toggle-accent: #ef4444;
      }

      .${TOGGLE_CLASS}:hover {
        filter: brightness(1.2) saturate(1.15) !important;
        transform: translateY(-1px) scale(1.03) !important;
      }

      .${TOGGLE_CLASS}:active {
        filter: brightness(0.95) !important;
        transform: translateY(0) scale(0.98) !important;
      }
    `;
    document.head.appendChild(style);
  }

  /** Starts DOM observation and the single-click bridge. */
  function start() {
    installStyles();
    decorateTree(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            decorateTree(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('mouseup', handleMouseUp, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
