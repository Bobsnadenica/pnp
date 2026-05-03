(function () {
  const STORAGE_KEY = "malkokote:language";

  function getInitialLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "bg" || stored === "en") {
        return stored;
      }
    } catch {}

    return String(navigator.language || "").toLowerCase().startsWith("bg") ? "bg" : "en";
  }

  function applyLanguage(language) {
    const buttons = document.querySelectorAll("[data-language-option]");
    const panels = document.querySelectorAll("[data-language-panel]");
    const translatables = document.querySelectorAll("[data-i18n-en]");

    buttons.forEach((button) => {
      const isActive = button.dataset.languageOption === language;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("is-active", isActive);
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.languagePanel !== language;
      if (panel.tagName === "SPAN" || panel.tagName === "DIV" || panel.tagName === "A") {
          panel.style.display = panel.dataset.languagePanel === language ? "" : "none";
      }
    });

    translatables.forEach((el) => {
      const text = el.getAttribute(`data-i18n-${language}`);
      if (text) {
        if (el.dataset.profileLabel !== undefined || el.querySelector("[data-profile-label]")) {
           const label = el.querySelector("[data-profile-label]") || el;
           label.textContent = text;
        } else {
           el.textContent = text;
        }
      }
      
      // Update data attributes for script.js to pick up
      const signedOut = el.getAttribute(`data-${language}-signed-out`);
      const signedIn = el.getAttribute(`data-${language}-signed-in`);
      if (signedOut) el.dataset.signedOutText = signedOut;
      if (signedIn) el.dataset.signedInText = signedIn;
    });

    document.documentElement.lang = language;

    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}

    window.dispatchEvent(new CustomEvent("malkokote:languagechange", { detail: { language } }));
  }

  function init() {
    const buttons = document.querySelectorAll("[data-language-option]");
    
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        applyLanguage(button.dataset.languageOption || "en");
      });
    });

    applyLanguage(getInitialLanguage());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MalkokoteLanguage = {
    getLanguage: () => getInitialLanguage(),
    applyLanguage
  };
})();
