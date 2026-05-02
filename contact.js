document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-language-root]");

  if (!root) {
    return;
  }

  const storageKey = root.dataset.languageStorageKey || "malkokote:language";
  const buttons = [...root.querySelectorAll("[data-language-option]")];
  const panels = [...root.querySelectorAll("[data-language-panel]")];

  function applyLanguage(language) {
    buttons.forEach((button) => {
      const isActive = button.dataset.languageOption === language;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("is-active", isActive);
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.languagePanel !== language;
    });

    try {
      localStorage.setItem(storageKey, language);
    } catch {}
  }

  function getInitialLanguage() {
    try {
      const stored = localStorage.getItem(storageKey);

      if (stored === "bg" || stored === "en") {
        return stored;
      }
    } catch {}

    return String(navigator.language || "").toLowerCase().startsWith("bg") ? "bg" : "en";
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.languageOption || "en");
    });
  });

  applyLanguage(getInitialLanguage());
});
