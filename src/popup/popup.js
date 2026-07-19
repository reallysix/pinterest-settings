(function initializePopup() {
  "use strict";

  const api = globalThis.PinterestColumns;
  const enabledInput = document.getElementById("enabled");
  const buttons = Array.from(document.querySelectorAll("[data-columns]"));
  const selection = document.getElementById("selection");
  const status = document.getElementById("status");
  let settings = api.DEFAULT_SETTINGS;

  function render() {
    enabledInput.checked = settings.enabled;
    selection.textContent = settings.columns === 0 ? "自动" : `${settings.columns} 列`;
    status.textContent = settings.enabled
      ? settings.columns === 0
        ? "当前使用 Pinterest 原始自动布局"
        : `Pinterest 页面将固定显示为 ${settings.columns} 列`
      : "扩展已暂停，Pinterest 将使用原始布局";

    for (const button of buttons) {
      const selected = Number(button.dataset.columns) === settings.columns;
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !settings.enabled;
    }
  }

  function save(nextSettings) {
    settings = api.normalizeSettings(nextSettings);
    chrome.storage.sync.set(settings, render);
  }

  enabledInput.addEventListener("change", () => {
    save({ ...settings, enabled: enabledInput.checked });
  });

  for (const button of buttons) {
    button.addEventListener("click", () => {
      save({ ...settings, columns: Number(button.dataset.columns) });
    });
  }

  chrome.storage.sync.get(api.DEFAULT_SETTINGS, (storedSettings) => {
    settings = api.normalizeSettings(storedSettings);
    render();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    settings = api.normalizeSettings({
      enabled: changes.enabled ? changes.enabled.newValue : settings.enabled,
      columns: changes.columns ? changes.columns.newValue : settings.columns,
    });
    render();
  });
})();
