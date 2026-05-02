document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.PrivateGalleryAuth;
  const profileButtons = [...document.querySelectorAll("[data-profile-trigger]")];
  const openLoginButton = document.getElementById("open-login");
  const heroLoginButton = document.getElementById("hero-login");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginEmailInput = document.getElementById("login-email");
  const loginFeedback = document.getElementById("login-feedback");
  const loginSubmit = document.getElementById("login-submit");
  const accountPanel = document.getElementById("account-panel");
  const accountSummary = document.getElementById("account-summary");
  const accountSignout = document.getElementById("account-signout");
  const modalCloseTriggers = [...document.querySelectorAll("[data-modal-close]")];
  const loginSubmitIdleLabel =
    loginSubmit?.dataset.idleText || loginSubmit?.textContent?.trim() || "Continue to Secure Sign In";
  const loginSubmitLoadingLabel =
    loginSubmit?.dataset.loadingText || "Redirecting...";

  let currentSession = null;
  let lastFocus = null;

  function updateProfileButtons() {
    profileButtons.forEach((button) => {
      const label = button.querySelector("[data-profile-label]");
      if (!label) {
        return;
      }

      label.textContent = currentSession
        ? button.dataset.signedInText || "Open Vault"
        : button.dataset.signedOutText || "Member Login";
    });
  }

  function setFeedback(message) {
    if (!loginFeedback) {
      return;
    }

    if (!message) {
      loginFeedback.hidden = true;
      loginFeedback.textContent = "";
      return;
    }

    loginFeedback.hidden = false;
    loginFeedback.textContent = message;
  }

  function openModal() {
    if (!loginModal) {
      return;
    }

    lastFocus = document.activeElement;
    loginModal.setAttribute("aria-hidden", "false");
    setFeedback("");

    if (currentSession) {
      loginForm.hidden = true;
      accountPanel.hidden = false;
      accountSummary.textContent = `Signed in as ${currentSession.claims?.email || "your account"}.`;
    } else {
      loginForm.hidden = false;
      accountPanel.hidden = true;
      window.setTimeout(() => loginEmailInput?.focus(), 30);
    }
  }

  function closeModal() {
    if (!loginModal) {
      return;
    }

    loginModal.setAttribute("aria-hidden", "true");
    setFeedback("");
    loginSubmit.disabled = false;
    loginSubmit.textContent = loginSubmitIdleLabel;
    lastFocus?.focus?.();
  }

  async function refreshSession() {
    if (!auth) {
      return;
    }

    currentSession = await auth.getSession();
    updateProfileButtons();
  }

  async function beginLogin() {
    if (!auth || !loginSubmit) {
      return;
    }

    setFeedback("");
    loginSubmit.disabled = true;
    loginSubmit.textContent = loginSubmitLoadingLabel;

    try {
      const result = await auth.startLogin({
        popup: true,
        remember: true,
        loginHint: loginEmailInput?.value?.trim() || "",
        returnTo: "/gallery/",
      });

      currentSession = auth.completePopupLogin(result);
      updateProfileButtons();
      closeModal();
      window.location.assign(auth.getGalleryDestination(currentSession));
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "We could not start secure sign-in.");
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = loginSubmitIdleLabel;
    }
  }

  profileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (currentSession && auth) {
        window.location.assign(auth.getGalleryDestination(currentSession));
        return;
      }

      openModal();
    });
  });

  openLoginButton?.addEventListener("click", openModal);
  heroLoginButton?.addEventListener("click", openModal);

  modalCloseTriggers.forEach((trigger) => {
    trigger.addEventListener("click", closeModal);
  });

  loginModal?.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (loginModal?.getAttribute("aria-hidden") === "false" && event.key === "Escape") {
      closeModal();
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await beginLogin();
  });

  accountSignout?.addEventListener("click", () => {
    auth?.signOut({ logoutUri: `${window.location.origin}/` });
  });

  await refreshSession();
});
