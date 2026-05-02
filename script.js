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

  const LAYOUTS = [
    "hero-portrait",
    "square",
    "landscape",
    "tall",
    "wide",
    "portrait",
    "square",
    "cinema",
    "tall",
    "wide",
    "square",
    "landscape",
  ];

  const DRIFT_CLASSES = [
    "drift-none",
    "drift-up",
    "drift-down",
    "drift-none",
    "drift-down",
    "drift-up",
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeCssUrl(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
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

  function shufflePhotos(photos) {
    const next = [...photos];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
  }

  function getLayoutClass(index) {
    return LAYOUTS[index % LAYOUTS.length];
  }

  function buildCard(photo, index) {
    const kind = getMediaKind(photo);
    const label = photo.label || photo.key || "Gallery item";
    const layoutClass = getLayoutClass(index);
    const driftClass = DRIFT_CLASSES[index % DRIFT_CLASSES.length];

    if (kind === "movie") {
      return `
        <article class="public-card public-card-${escapeHtml(layoutClass)} ${escapeHtml(driftClass)}">
          <a
            class="public-trigger"
            href="${escapeHtml(photo.url)}"
            data-public-trigger
            data-photo-kind="${escapeHtml(kind)}"
            data-photo-label="${escapeHtml(label)}"
            data-photo-key="${escapeHtml(photo.key)}"
            data-photo-src="${escapeHtml(photo.url)}"
            data-photo-backdrop=""
            aria-label="${escapeHtml(label)}"
          >
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
      <article class="public-card public-card-${escapeHtml(layoutClass)} ${escapeHtml(driftClass)}">
        <a
          class="public-trigger"
          href="${escapeHtml(photo.url)}"
          data-public-trigger
          data-photo-kind="${escapeHtml(kind)}"
          data-photo-label="${escapeHtml(label)}"
          data-photo-key="${escapeHtml(photo.key)}"
          data-photo-src="${escapeHtml(photo.url)}"
          data-photo-backdrop="${escapeHtml(photo.url)}"
          aria-label="${escapeHtml(label)}"
        >
          <div class="public-media">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async">
            ${badge}
          </div>
        </a>
      </article>
    `;
  }

  function ensureViewer() {
    let viewer = document.getElementById("public-gallery-viewer");

    if (viewer) {
      return viewer;
    }

    viewer = document.createElement("div");
    viewer.id = "public-gallery-viewer";
    viewer.className = "public-viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Gallery viewer");
    viewer.innerHTML = `
      <div class="public-viewer-backdrop" data-viewer-close></div>
      <button class="public-viewer-close" type="button" aria-label="Close viewer" data-viewer-close>&times;</button>
      <button class="public-viewer-nav public-viewer-nav-prev" type="button" aria-label="Previous item" data-viewer-nav="-1">&#10094;</button>
      <button class="public-viewer-nav public-viewer-nav-next" type="button" aria-label="Next item" data-viewer-nav="1">&#10095;</button>
      <div class="public-viewer-shell">
        <div class="public-viewer-stage" id="public-viewer-stage">
          <div class="public-viewer-media">
            <img id="public-viewer-image" alt="" hidden>
            <video id="public-viewer-video" playsinline controls preload="metadata" hidden></video>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);
    return viewer;
  }

  function dismissViewer() {
    const viewer = document.getElementById("public-gallery-viewer");

    if (!viewer) {
      return;
    }

    const viewerImage = viewer.querySelector("#public-viewer-image");
    const viewerVideo = viewer.querySelector("#public-viewer-video");
    const viewerStage = viewer.querySelector("#public-viewer-stage");

    viewer.hidden = true;
    document.body.style.overflow = "";

    if (viewerImage) {
      viewerImage.removeAttribute("src");
      viewerImage.hidden = true;
    }

    if (viewerVideo) {
      viewerVideo.pause();
      viewerVideo.removeAttribute("src");
      viewerVideo.load();
      viewerVideo.hidden = true;
    }

    viewerStage?.style.removeProperty("--viewer-backdrop-image");
  }

  function enableViewer(container) {
    if (!container || container.dataset.viewerEnabled === "true") {
      return;
    }

    container.dataset.viewerEnabled = "true";

    const viewer = ensureViewer();
    const viewerShell = viewer.querySelector(".public-viewer-shell");
    const viewerStage = viewer.querySelector("#public-viewer-stage");
    const viewerImage = viewer.querySelector("#public-viewer-image");
    const viewerVideo = viewer.querySelector("#public-viewer-video");
    const viewerPrev = viewer.querySelector(".public-viewer-nav-prev");
    const viewerNext = viewer.querySelector(".public-viewer-nav-next");
    let currentIndex = -1;
    let lastTrigger = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastWheelAt = 0;

    function getTriggers() {
      return [...container.querySelectorAll("[data-public-trigger]")];
    }

    function updateNavigation(total) {
      if (viewerPrev) {
        viewerPrev.disabled = currentIndex <= 0;
      }

      if (viewerNext) {
        viewerNext.disabled = currentIndex >= total - 1;
      }
    }

    function resetViewerVideo() {
      if (!viewerVideo) {
        return;
      }

      viewerVideo.pause();
      viewerVideo.removeAttribute("src");
      viewerVideo.load();
      viewerVideo.hidden = true;
    }

    function renderViewer(index) {
      const triggers = getTriggers();

      if (!triggers.length) {
        return;
      }

      currentIndex = Math.max(0, Math.min(index, triggers.length - 1));
      const trigger = triggers[currentIndex];
      const kind = trigger.dataset.photoKind || "picture";
      const src = trigger.dataset.photoSrc || trigger.href;
      const label = trigger.dataset.photoLabel || "Gallery item";
      const backdrop = trigger.dataset.photoBackdrop || src;
      lastTrigger = trigger;

      if (kind === "movie") {
        if (viewerImage) {
          viewerImage.hidden = true;
          viewerImage.removeAttribute("src");
        }

        viewerStage?.style.removeProperty("--viewer-backdrop-image");
        resetViewerVideo();

        if (viewerVideo) {
          viewerVideo.hidden = false;
          viewerVideo.src = src;
          viewerVideo.load();
          viewerVideo.play().catch(() => {});
        }
      } else {
        resetViewerVideo();

        if (viewerImage) {
          viewerImage.hidden = false;
          viewerImage.src = src;
          viewerImage.alt = label;
        }

        if (viewerStage) {
          viewerStage.style.setProperty("--viewer-backdrop-image", `url("${escapeCssUrl(backdrop)}")`);
        }
      }

      updateNavigation(triggers.length);
    }

    function moveViewer(direction) {
      const triggers = getTriggers();
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= triggers.length) {
        return;
      }

      renderViewer(nextIndex);
    }

    function closeViewer() {
      dismissViewer();
      currentIndex = -1;
      lastTrigger?.focus?.();
    }

    function openViewer(trigger) {
      const triggers = getTriggers();
      const index = triggers.indexOf(trigger);
      renderViewer(index >= 0 ? index : 0);
      viewer.hidden = false;
      document.body.style.overflow = "hidden";
      viewer.querySelector(".public-viewer-close")?.focus();
    }

    container.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-public-trigger]");

      if (!trigger) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }

      event.preventDefault();
      openViewer(trigger);
    });

    viewer.addEventListener("click", (event) => {
      if (event.target.closest("[data-viewer-close]")) {
        closeViewer();
        return;
      }

      const navButton = event.target.closest("[data-viewer-nav]");
      if (navButton) {
        moveViewer(Number.parseInt(navButton.dataset.viewerNav || "0", 10));
      }
    });

    viewerShell?.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    viewerShell?.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 42) {
        return;
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        moveViewer(deltaY < 0 ? 1 : -1);
        return;
      }

      moveViewer(deltaX < 0 ? 1 : -1);
    }, { passive: true });

    viewerShell?.addEventListener("wheel", (event) => {
      if (viewer.hidden) {
        return;
      }

      if (Math.abs(event.deltaY) < 30) {
        return;
      }

      const now = Date.now();
      if (now - lastWheelAt < 260) {
        event.preventDefault();
        return;
      }

      lastWheelAt = now;
      event.preventDefault();
      moveViewer(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    document.addEventListener("keydown", (event) => {
      if (viewer.hidden) {
        return;
      }

      if (event.key === "Escape") {
        closeViewer();
        return;
      }

      if (event.key === "ArrowRight") {
        moveViewer(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        moveViewer(-1);
      }
    });
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

      const photos = shufflePhotos(manifest.photos || []);
      grid.innerHTML = photos.map((photo, index) => buildCard(photo, index)).join("");
      enableViewer(grid);
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

  await window.MalkokoteAgeGate?.waitForAccess?.();
  await Promise.all([refreshSession(), loadPublicGallery()]);
});
