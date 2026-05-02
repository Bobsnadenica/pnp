document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.PrivateGalleryAuth;
  const config = window.__PRIVATE_GALLERY_CONFIG__ || {};
  const profileButtons = [...document.querySelectorAll("[data-profile-trigger]")];
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginEmailInput = document.getElementById("login-email");
  const loginFeedback = document.getElementById("login-feedback");
  const loginSubmit = document.getElementById("login-submit");
  const accountPanel = document.getElementById("account-panel");
  const accountSummary = document.getElementById("account-summary");
  const accountSignout = document.getElementById("account-signout");
  const modalCloseTriggers = [...document.querySelectorAll("[data-modal-close]")];
  const status = document.getElementById("public-gallery-status");
  const grid = document.getElementById("public-gallery-grid");
  const loginSubmitIdleLabel = loginSubmit?.dataset.idleText || loginSubmit?.textContent?.trim() || "Continue";
  const loginSubmitLoadingLabel = loginSubmit?.dataset.loadingText || "Redirecting...";

  let currentSession = null;
  let lastFocus = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setFeedback(message) {
    if (!loginFeedback) {
      return;
    }

    loginFeedback.hidden = !message;
    loginFeedback.textContent = message || "";
  }

  function updateProfileButtons() {
    profileButtons.forEach((button) => {
      const label = button.querySelector("[data-profile-label]");
      if (!label) {
        return;
      }

      label.textContent = currentSession
        ? button.dataset.signedInText || "Extra"
        : button.dataset.signedOutText || "Login";
    });
  }

  function getMediaKind(photo) {
    const explicit = String(photo?.kind || "").trim().toLowerCase();
    if (explicit === "picture" || explicit === "gif" || explicit === "movie") {
      return explicit;
    }

    if (/\.gif$/i.test(photo?.key || "")) {
      return "gif";
    }

    if (/\.(m4v|mov|mp4|webm)$/i.test(photo?.key || "")) {
      return "movie";
    }

    return "picture";
  }

  function buildCard(photo) {
    const kind = getMediaKind(photo);
    const label = photo.label || photo.key || "Gallery item";

    if (kind === "movie") {
      return `
        <article class="public-card">
          <a class="public-trigger" href="${escapeHtml(photo.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">
            <div class="public-media">
              <video src="${escapeHtml(photo.url)}" muted loop autoplay playsinline preload="metadata"></video>
              <span class="media-badge" aria-hidden="true">&#9654;</span>
            </div>
          </a>
        </article>
      `;
    }

    const badge = kind === "gif" ? '<span class="media-badge" aria-hidden="true">GIF</span>' : "";

    return `
      <article class="public-card">
        <a class="public-trigger" href="${escapeHtml(photo.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">
          <div class="public-media">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async">
            ${badge}
          </div>
        </a>
      </article>
    `;
  }

  async function loadPublicGallery() {
    if (!grid) {
      return;
    }

    try {
      const manifestUrl = `${String(config.galleryBaseUrl || "").replace(/\/+$/, "")}/api/gallery/public-manifest`;
      const response = await fetch(manifestUrl, { cache: "no-store" });
      const manifest = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(manifest?.error || "Unable to load gallery.");
      }

      grid.innerHTML = (manifest.photos || []).map(buildCard).join("");
      if (status) {
        status.hidden = true;
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.hidden = false;
        status.textContent = error.message || "Unable to load gallery.";
      }
    }
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
      accountSummary.textContent = currentSession.claims?.email || "Signed in";
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
      window.location.assign("/gallery/");
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "Unable to sign in.");
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = loginSubmitIdleLabel;
    }
  }

  profileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (currentSession) {
        window.location.assign("/gallery/");
        return;
      }

      openModal();
    });
  });

  modalCloseTriggers.forEach((trigger) => {
    trigger.addEventListener("click", closeModal);
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

  await Promise.all([refreshSession(), loadPublicGallery()]);
});
