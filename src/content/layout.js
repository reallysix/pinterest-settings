(function initializeLayoutApi(globalScope) {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    columns: 3,
  });

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const columns = Number(source.columns);

    return {
      enabled:
        typeof source.enabled === "boolean"
          ? source.enabled
          : DEFAULT_SETTINGS.enabled,
      columns:
        columns === 0 || (Number.isInteger(columns) && columns >= 2 && columns <= 6)
          ? columns
          : DEFAULT_SETTINGS.columns,
    };
  }

  function computeColumnWidth(containerWidth, columns, gap, sidePadding) {
    if (columns < 1 || containerWidth <= 0) {
      return 0;
    }

    const availableWidth =
      containerWidth - sidePadding * 2 - gap * Math.max(0, columns - 1);
    return Math.max(0, availableWidth / columns);
  }

  function planMasonry(heights, columns, columnWidth, gap, sidePadding) {
    const columnHeights = Array.from({ length: columns }, () => 0);
    const positions = [];

    for (const height of heights) {
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      const x = sidePadding + column * (columnWidth + gap);
      const y = columnHeights[column];

      positions.push({ x, y, column });
      columnHeights[column] += Math.max(0, height) + gap;
    }

    return {
      positions,
      height: Math.max(0, ...columnHeights) - (heights.length > 0 ? gap : 0),
      columnHeights,
    };
  }

  const api = Object.freeze({
    DEFAULT_SETTINGS,
    normalizeSettings,
    computeColumnWidth,
    planMasonry,
  });

  globalScope.PinterestColumns = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
