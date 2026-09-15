(() => {
  'use strict';

  const STYLE_ID = 'json-boolean-toggle-dom-style';
  const TOGGLE_CLASS = 'json-boolean-dom-toggle';
  const PRESSED_CLASS = 'json-boolean-dom-toggle-pressed';
  const HOVERING_BODY_CLASS = 'json-boolean-dom-toggle-hovering';
  const STATE_ATTRIBUTE = 'data-json-boolean-toggle-state';
  const STATE_BY_LABEL = new Map([
    ['🟢 ON', 'on'],
    ['🔴 OFF', 'off'],
  ]);

  /** Pointer identifiers whose initial press was consumed by a toggle. */
  const activePointerIds = new Set();

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
    element.removeAttribute('title');
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
   * Applies a component edit immediately, before Monaco can replace its DOM node.
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

    activePointerIds.add(event.pointerId);
    toggle.classList.add(PRESSED_CLASS);
    stopNativeEvent(event);
    dispatchToggleEdit(toggle, event);
  }

  /**
   * Resolves a reliable edit point over the ON or OFF text instead of the emoji.
   *
   * @param {HTMLElement} toggle - Rendered toggle element.
   * @param {PointerEvent} event - Original pointer event used as a fallback.
   * @returns {{ clientX: number, clientY: number, screenX: number, screenY: number }} Reliable event coordinates.
   */
  function getEditPoint(toggle, event) {
    const rawText = toggle.textContent ?? '';
    const stateLabel = toggle.getAttribute(STATE_ATTRIBUTE) === 'on' ? 'ON' : 'OFF';
    const labelOffset = rawText.lastIndexOf(stateLabel);
    const textNode = toggle.firstChild;

    if (textNode === null || textNode.nodeType !== window.Node.TEXT_NODE || labelOffset < 0) {
      return {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      };
    }

    const labelRange = document.createRange();
    labelRange.setStart(textNode, labelOffset);
    labelRange.setEnd(textNode, labelOffset + stateLabel.length);
    const bounds = labelRange.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
      return {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      };
    }

    const clientX = bounds.left + bounds.width / 2;
    const clientY = bounds.top + bounds.height / 2;
    return {
      clientX,
      clientY,
      screenX: event.screenX + clientX - event.clientX,
      screenY: event.screenY + clientY - event.clientY,
    };
  }

  /**
   * Dispatches the native inlay-hint edit gesture for one completed component press.
   *
   * @param {HTMLElement} toggle - Pressed toggle element.
   * @param {PointerEvent} event - Pointer release used for event coordinates.
   * @returns {void}
   */
  function dispatchToggleEdit(toggle, event) {
    const point = getEditPoint(toggle, event);

    toggle.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        buttons: 0,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY,
        detail: 2,
        screenX: point.screenX,
        screenY: point.screenY,
        view: window,
      }),
    );
  }

  /**
   * Consumes the release that belongs to an already handled toggle press.
   *
   * @param {PointerEvent} event - Captured pointer event.
   * @returns {void}
   */
  function handlePointerEnd(event) {
    if (!activePointerIds.delete(event.pointerId)) {
      return;
    }

    stopNativeEvent(event);
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
   * Blocks hover processing that would resolve hints and replace their DOM nodes.
   *
   * @param {Event} event - Captured pointer or mouse hover event.
   * @returns {void}
   */
  function blockToggleHover(event) {
    if (findToggle(event.target) === undefined) {
      return;
    }

    event.stopImmediatePropagation();
  }

  /**
   * Hides the Visual Studio Code hover widget while a toggle is hovered.
   *
   * @param {PointerEvent} event - Captured pointer entry event.
   * @returns {void}
   */
  function handleTogglePointerOver(event) {
    if (findToggle(event.target) === undefined) {
      return;
    }

    document.body.classList.add(HOVERING_BODY_CLASS);
    event.stopImmediatePropagation();
  }

  /**
   * Restores regular hover widgets after the pointer leaves a toggle.
   *
   * @param {PointerEvent} event - Captured pointer exit event.
   * @returns {void}
   */
  function handleTogglePointerOut(event) {
    if (findToggle(event.target) === undefined || findToggle(event.relatedTarget) !== undefined) {
      return;
    }

    document.body.classList.remove(HOVERING_BODY_CLASS);
    event.stopImmediatePropagation();
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
        justify-content: center !important;
        box-sizing: border-box !important;
        min-width: 54px !important;
        height: 18px !important;
        margin: 0 2px !important;
        padding: 0 6px !important;
        border: 1px solid color-mix(in srgb, var(--json-toggle-accent) 78%, white) !important;
        border-radius: 999px !important;
        background: color-mix(in srgb, var(--json-toggle-accent) 24%, transparent) !important;
        color: color-mix(in srgb, var(--json-toggle-accent) 55%, white) !important;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--json-toggle-accent) 18%, transparent),
          0 1px 5px color-mix(in srgb, var(--json-toggle-accent) 22%, transparent) !important;
        font-weight: 700 !important;
        line-height: 16px !important;
        letter-spacing: 0.02em !important;
        vertical-align: middle !important;
        cursor: pointer !important;
        pointer-events: auto !important;
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
      }

      .${TOGGLE_CLASS}.${PRESSED_CLASS} {
        filter: brightness(0.95) !important;
        transform: translateY(0) scale(0.98) !important;
      }

      body.${HOVERING_BODY_CLASS} .monaco-hover {
        display: none !important;
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
    document.addEventListener('pointerup', handlePointerEnd, true);
    document.addEventListener('pointercancel', handlePointerEnd, true);
    document.addEventListener('pointerover', handleTogglePointerOver, true);
    document.addEventListener('pointerout', handleTogglePointerOut, true);
    document.addEventListener('pointermove', blockToggleHover, true);
    document.addEventListener('mousedown', blockNativeMouseEvent, true);
    document.addEventListener('mouseup', blockNativeMouseEvent, true);
    document.addEventListener('mouseover', blockToggleHover, true);
    document.addEventListener('mousemove', blockToggleHover, true);
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
