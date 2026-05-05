(function () {
  const STORAGE_KEY = "malkokote.age-gate.acceptedAt";
  const LEAVE_URL = "https://www.google.com";
  const ACCEPTANCE_TTL_MS = 12 * 60 * 60 * 1000;

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
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (error) {
      console.warn("Unable to persist age gate preference.", error);
    }
  }

  function hasAccepted() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      const acceptedAt = Number.parseInt(rawValue || "", 10);

      if (!Number.isFinite(acceptedAt)) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      if (acceptedAt + ACCEPTANCE_TTL_MS <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      return true;
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

  function createChallenge() {
    const left = Math.floor(Math.random() * 7) + 2;
    const right = Math.floor(Math.random() * 7) + 2;

    return {
      prompt: `${left} + ${right}`,
      answer: String(left + right),
    };
  }

  function setupHumanCheck(gate, enterButton) {
    const card = gate.querySelector(".age-gate-card");
    const actions = gate.querySelector(".age-gate-actions");

    if (!card || !actions || !enterButton) {
      return;
    }

    gate.querySelector("[data-age-human-check]")?.remove();

    const challenge = createChallenge();
    const translate = window.MalkokoteLanguage?.translate || ((k) => k);
    const challengeBlock = document.createElement("div");
    challengeBlock.className = "age-gate-human-check";
    challengeBlock.dataset.ageHumanCheck = "true";
    challengeBlock.innerHTML = `
      <label class="age-gate-human-check-label" for="age-gate-human-answer">${translate("humanCheck")}: ${challenge.prompt} = ?</label>
      <input id="age-gate-human-answer" class="age-gate-human-check-input" type="text" inputmode="numeric" autocomplete="off" aria-describedby="age-gate-human-feedback">
      <p id="age-gate-human-feedback" class="age-gate-human-check-feedback" aria-live="polite">${translate("solveToContinue")}</p>
    `;

    card.insertBefore(challengeBlock, actions);

    const input = challengeBlock.querySelector(".age-gate-human-check-input");
    const feedback = challengeBlock.querySelector(".age-gate-human-check-feedback");
    enterButton.disabled = true;

    function updateState() {
      const solved = input?.value?.trim() === challenge.answer;

      enterButton.disabled = !solved;

      if (!feedback) {
        return;
      }

      feedback.textContent = solved ? translate("checkComplete") : translate("solveToContinue");
      feedback.classList.toggle("is-valid", solved);
    }

    input?.addEventListener("input", updateState);
    updateState();
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
    setupHumanCheck(gate, enterButton);

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
