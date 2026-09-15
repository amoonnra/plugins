(() => {
  'use strict';

  const STYLE_ID = 'json-boolean-toggle-dom-style';
  const TOGGLE_CLASS = 'json-boolean-dom-toggle';
  const PRESSED_CLASS = 'json-boolean-dom-toggle-pressed';
  const STATE_ATTRIBUTE = 'data-json-boolean-toggle-state';
  const STATE_BY_LABEL = new Map([
    ['🟢 ON', 'on'],
    ['🔴 OFF', 'off'],
  ]);

  /** @type {{ pointerId: number, toggle: HTMLElement } | undefined} */
  let activePress;

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
   * Stops a native event before Monaco can move the caret or select editor text.
   *
   * @param {Event} event - Captured renderer event.
   * @returns {void}
   */
  function stopNativeEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /**
   * Starts a component press without allowing Monaco to move the caret.
   *
   * @param {PointerEvent} event - Captured pointer event.
   * @returns {void}
   */
  function handlePointerDown(event) {
    if (!event.isTrusted || event.button !== 0 || !event.isPrimary) {
      return;
    }

    const toggle = findToggle(event.target);

    if (toggle === undefined) {
      return;
    }

    activePress?.toggle.classList.remove(PRESSED_CLASS);
    activePress = { pointerId: event.pointerId, toggle };
    toggle.classList.add(PRESSED_CLASS);
    stopNativeEvent(event);
  }

  /**
   * Dispatches the native inlay-hint edit gesture for one completed component press.
   *
   * @param {HTMLElement} toggle - Pressed toggle element.
   * @param {PointerEvent} event - Pointer release used for event coordinates.
   * @returns {void}
   */
  function dispatchToggleEdit(toggle, event) {
    toggle.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        buttons: 0,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        detail: 2,
        screenX: event.screenX,
        screenY: event.screenY,
        view: window,
      }),
    );
  }

  /**
   * Completes a component press and performs exactly one boolean edit.
   *
   * @param {PointerEvent} event - Captured pointer event.
   * @returns {void}
   */
  function handlePointerUp(event) {
    if (!event.isTrusted || event.button !== 0 || !event.isPrimary) {
      return;
    }

    const press = activePress;

    if (press === undefined || press.pointerId !== event.pointerId) {
      return;
    }

    activePress = undefined;
    press.toggle.classList.remove(PRESSED_CLASS);
    const releasedToggle = findToggle(event.target);

    if (releasedToggle !== press.toggle) {
      return;
    }

    stopNativeEvent(event);
    dispatchToggleEdit(press.toggle, event);
  }

  /**
   * Cancels the current component press.
   *
   * @param {PointerEvent} event - Captured pointer cancellation event.
   * @returns {void}
   */
  function handlePointerCancel(event) {
    if (activePress?.pointerId !== event.pointerId) {
      return;
    }

    activePress.toggle.classList.remove(PRESSED_CLASS);
    activePress = undefined;
  }

  /**
   * Blocks trusted compatibility mouse events generated after a pointer press.
   *
   * Synthetic events remain available to Visual Studio Code's inlay hint handler.
   *
   * @param {MouseEvent} event - Captured mouse event.
   * @returns {void}
   */
  function blockNativeMouseEvent(event) {
    if (!event.isTrusted || findToggle(event.target) === undefined) {
      return;
    }

    stopNativeEvent(event);
  }

  /**
   * Prevents selection from starting inside a decorated toggle.
   *
   * @param {Event} event - Captured selection event.
   * @returns {void}
   */
  function blockToggleSelection(event) {
    if (findToggle(event.target) === undefined) {
      return;
    }

    stopNativeEvent(event);
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
        -webkit-user-select: none !important;
        user-select: none !important;
        touch-action: none !important;
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

      .${TOGGLE_CLASS}.${PRESSED_CLASS} {
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
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('mousedown', blockNativeMouseEvent, true);
    document.addEventListener('mouseup', blockNativeMouseEvent, true);
    document.addEventListener('click', blockNativeMouseEvent, true);
    document.addEventListener('dblclick', blockNativeMouseEvent, true);
    document.addEventListener('selectstart', blockToggleSelection, true);
    document.addEventListener('dragstart', blockToggleSelection, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
