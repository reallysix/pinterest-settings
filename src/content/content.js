(function initializePinterestColumns() {
  "use strict";

  const api = globalThis.PinterestColumns;
  const STYLE_ID = "pinterest-columns-extension-style";
  const POSITION_STYLE_ID = "pinterest-columns-extension-position-style";
  const CONTAINER_ATTRIBUTE = "data-pinterest-columns-container";
  const READY_ATTRIBUTE = "data-pinterest-columns-ready";
  const ITEM_ATTRIBUTE = "data-pinterest-columns-item";
  const ITEM_KEY_ATTRIBUTE = "data-pinterest-columns-key";
  const POSITIONED_ATTRIBUTE = "data-pinterest-columns-positioned";
  const GAP = 16;
  const SIDE_PADDING = 8;

  let settings = api.DEFAULT_SETTINGS;
  let activeContainer = null;
  let layoutTimer = null;
  let settleTimer = null;
  let layoutVersion = 0;
  let itemKey = 0;
  let currentUrl = location.href;
  let observedContents = new Set();

  function getStyleElement(id) {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.documentElement.append(style);
    }
    return style;
  }

  function clearLayout() {
    layoutVersion += 1;
    clearTimeout(settleTimer);

    for (const id of [STYLE_ID, POSITION_STYLE_ID]) {
      const style = document.getElementById(id);
      if (style) {
        style.textContent = "";
      }
    }

    if (activeContainer) {
      activeContainer.removeAttribute(CONTAINER_ATTRIBUTE);
      activeContainer.removeAttribute(READY_ATTRIBUTE);
      for (const item of activeContainer.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)) {
        item.removeAttribute(ITEM_ATTRIBUTE);
        item.removeAttribute(ITEM_KEY_ATTRIBUTE);
        item.removeAttribute(POSITIONED_ATTRIBUTE);
      }
    }

    activeContainer = null;
    contentResizeObserver.disconnect();
    observedContents = new Set();
  }

  function directPinChildCount(element) {
    let count = 0;
    for (const child of element.children) {
      if (
        child.querySelector('[data-test-id="pin"], a[href*="/pin/"]')
      ) {
        count += 1;
      }
    }
    return count;
  }

  function findLayoutContainer() {
    const roots = document.querySelectorAll(
      '[data-test-id="masonry-container"], .masonryContainer'
    );
    let bestCandidate = null;
    let bestScore = 0;

    for (const root of roots) {
      const pins = root.querySelectorAll('[data-test-id="pin"]');
      for (const pin of Array.from(pins).slice(0, 8)) {
        let node = pin.parentElement;
        while (node && node !== root) {
          const parent = node.parentElement;
          if (!parent) {
            break;
          }

          const directPins = directPinChildCount(parent);
          const width = parent.clientWidth;
          const score = directPins * 10000 + width;
          if (directPins >= 2 && score > bestScore) {
            bestCandidate = parent;
            bestScore = score;
          }

          node = parent;
        }
      }
    }

    return bestCandidate;
  }

  function getLayoutItems(container) {
    return Array.from(container.children).filter((item) =>
      item.querySelector('[data-test-id="pin"], a[href*="/pin/"]')
    );
  }

  function getHeightTarget(item) {
    const pins = item.querySelectorAll('[data-test-id="pin"]');
    return pins.length === 1 ? pins[0] : item.firstElementChild;
  }

  function getRenderedHeight(item) {
    const target = getHeightTarget(item);
    return target ? target.getBoundingClientRect().height : 0;
  }

  function syncObservedContents(items) {
    const nextContents = new Set();

    for (const item of items) {
      const content = getHeightTarget(item);
      if (content) {
        nextContents.add(content);
        if (!observedContents.has(content)) {
          contentResizeObserver.observe(content);
        }
      }
    }

    for (const content of observedContents) {
      if (!nextContents.has(content)) {
        contentResizeObserver.unobserve(content);
      }
    }

    observedContents = nextContents;
  }

  function applyFinalLayout(container, items, columnWidth, version) {
    if (version !== layoutVersion || container !== activeContainer) {
      return;
    }

    const renderedItems = [];
    for (const item of items) {
      const height = getRenderedHeight(item);
      if (height > 1) {
        renderedItems.push({ item, height });
      }
    }

    if (renderedItems.length === 0) {
      return;
    }

    const renderedItemSet = new Set(renderedItems.map(({ item }) => item));
    for (const item of items) {
      if (!renderedItemSet.has(item)) {
        item.removeAttribute(POSITIONED_ATTRIBUTE);
      }
    }

    const plan = api.planMasonry(
      renderedItems.map(({ height }) => height),
      settings.columns,
      columnWidth,
      GAP,
      SIDE_PADDING
    );

    const rules = [
      `[${CONTAINER_ATTRIBUTE}="active"] { height: ${plan.height}px !important; }`,
    ];

    renderedItems.forEach(({ item, height }, index) => {
      let key = item.getAttribute(ITEM_KEY_ATTRIBUTE);
      if (!key) {
        itemKey += 1;
        key = String(itemKey);
        item.setAttribute(ITEM_KEY_ATTRIBUTE, key);
      }

      const position = plan.positions[index];
      rules.push(
        `[${ITEM_KEY_ATTRIBUTE}="${key}"] { height: ${height}px !important; transform: translate3d(${position.x}px, ${position.y}px, 0) !important; }`
      );
    });

    getStyleElement(POSITION_STYLE_ID).textContent = rules.join("\n");
    for (const { item } of renderedItems) {
      item.setAttribute(POSITIONED_ATTRIBUTE, "");
    }
    container.setAttribute(READY_ATTRIBUTE, "");
  }

  function performLayout(allowSettlePass) {
    if (!settings.enabled || settings.columns === 0) {
      clearLayout();
      return;
    }

    const container = findLayoutContainer();
    if (!container) {
      return;
    }

    if (activeContainer && activeContainer !== container) {
      clearLayout();
    }

    if (!activeContainer) {
      container.removeAttribute(READY_ATTRIBUTE);
    }
    activeContainer = container;
    container.setAttribute(CONTAINER_ATTRIBUTE, "active");

    const items = getLayoutItems(container);
    if (items.length === 0) {
      return;
    }
    syncObservedContents(items);

    const containerWidth = container.clientWidth || container.parentElement.clientWidth;
    const columnWidth = api.computeColumnWidth(
      containerWidth,
      settings.columns,
      GAP,
      SIDE_PADDING
    );
    if (columnWidth <= 0) {
      return;
    }

    for (const item of items) {
      item.setAttribute(ITEM_ATTRIBUTE, "");
    }

    layoutVersion += 1;
    const version = layoutVersion;
    getStyleElement(STYLE_ID).textContent = `
      [${CONTAINER_ATTRIBUTE}="active"] {
        position: relative !important;
        transition: none !important;
      }
      [${CONTAINER_ATTRIBUTE}="active"]:not([${READY_ATTRIBUTE}]) {
        visibility: hidden !important;
      }
      [${CONTAINER_ATTRIBUTE}="active"] > [${ITEM_ATTRIBUTE}] {
        box-sizing: border-box !important;
        left: 0 !important;
        position: absolute !important;
        top: 0 !important;
        transition: none !important;
        transform-origin: left top !important;
        width: ${columnWidth}px !important;
      }
      [${CONTAINER_ATTRIBUTE}="active"] > [${ITEM_ATTRIBUTE}]:not([${POSITIONED_ATTRIBUTE}]) {
        visibility: hidden !important;
      }
    `;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyFinalLayout(container, items, columnWidth, version);
      });
    });

    if (allowSettlePass) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => performLayout(false), 350);
    }
  }

  function scheduleLayout(delay = 80) {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => performLayout(true), delay);
  }

  function nodeContainsLayoutContent(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    return (
      node.matches(
        '[data-test-id="masonry-container"], .masonryContainer, [data-test-id="pin"]'
      ) ||
      Boolean(
        node.querySelector(
          '[data-test-id="masonry-container"], .masonryContainer, [data-test-id="pin"]'
        )
      )
    );
  }

  function mutationNeedsLayout(records) {
    for (const record of records) {
      if (record.target === activeContainer) {
        return true;
      }

      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        if (nodeContainsLayoutContent(node)) {
          return true;
        }
      }
    }

    return false;
  }

  const mutationObserver = new MutationObserver((records) => {
    if (mutationNeedsLayout(records)) {
      scheduleLayout();
    }
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const contentResizeObserver = new ResizeObserver(() => scheduleLayout(60));

  window.addEventListener("resize", () => scheduleLayout(120), { passive: true });
  document.addEventListener(
    "load",
    (event) => {
      if (event.target instanceof HTMLImageElement) {
        scheduleLayout(60);
      }
    },
    true
  );

  setInterval(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      clearLayout();
      scheduleLayout(150);
    }
  }, 750);

  chrome.storage.sync.get(api.DEFAULT_SETTINGS, (storedSettings) => {
    settings = api.normalizeSettings(storedSettings);
    scheduleLayout(0);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    const nextSettings = {
      enabled: changes.enabled ? changes.enabled.newValue : settings.enabled,
      columns: changes.columns ? changes.columns.newValue : settings.columns,
    };
    settings = api.normalizeSettings(nextSettings);

    if (!settings.enabled || settings.columns === 0) {
      clearLayout();
    } else {
      scheduleLayout(0);
    }
  });
})();
