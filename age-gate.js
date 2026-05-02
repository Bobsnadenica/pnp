(function () {
  const STORAGE_KEY = "malkokote.age-gate.accepted";
  const LEAVE_URL = "https://www.google.com";

  let resolver = null;
  let accessPromise = null;

  function ensureAccessPromise() {
    if (!accessPromise) {
      accessPromise = new Promise((resolve) => {
        resolver = resolve;
      });
    }

    return accessPromise;
  }

  function resolveAccess() {
    if (resolver) {
      resolver();
      resolver = null;
    }
  }

  function getGate() {
    return document.getElementById("age-gate");
  }

  function markAccepted() {
    try {
      localStorage.setItem(STORAGE_KEY, "yes");
    } catch (error) {
      console.warn("Unable to persist age gate preference.", error);
    }
  }

  function hasAccepted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "yes";
    } catch (error) {
      console.warn("Unable to read age gate preference.", error);
      return false;
    }
  }

  function unlockSite() {
    const gate = getGate();

    document.body.classList.remove("age-gate-pending");
    document.body.classList.add("age-gate-cleared");

    if (gate) {
      gate.hidden = true;
      gate.setAttribute("aria-hidden", "true");
    }

    resolveAccess();
  }

  function redirectAway() {
    window.location.replace(LEAVE_URL);
  }

  function bindGate() {
    const gate = getGate();

    if (!gate) {
      resolveAccess();
      return;
    }

    const enterButton = gate.querySelector("[data-age-enter]");
    const leaveButton = gate.querySelector("[data-age-leave]");

    if (hasAccepted()) {
      unlockSite();
      return;
    }

    gate.hidden = false;
    gate.removeAttribute("aria-hidden");

    enterButton?.addEventListener("click", () => {
      markAccepted();
      unlockSite();
    });

    leaveButton?.addEventListener("click", () => {
      redirectAway();
    });
  }

  window.MalkokoteAgeGate = {
    waitForAccess() {
      return ensureAccessPromise();
    },
  };

  ensureAccessPromise();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindGate, { once: true });
  } else {
    bindGate();
  }
})();
