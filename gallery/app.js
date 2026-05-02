(function () {
  const REFRESH_STORAGE_KEY = "private-gallery-refresh.extra";

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

  function sanitizeRefreshToken(value) {
    return String(value || "")
      .trim()
      .replace(/[^A-Za-z0-9._-]/g, "")
      .slice(0, 64);
  }

  function readRefreshToken() {
    try {
      return sanitizeRefreshToken(localStorage.getItem(REFRESH_STORAGE_KEY));
    } catch (error) {
      console.warn("Unable to read gallery refresh token.", error);
      return "";
    }
  }

  function writeRefreshToken(value) {
    const nextValue = sanitizeRefreshToken(value);

    try {
      if (nextValue) {
        localStorage.setItem(REFRESH_STORAGE_KEY, nextValue);
      } else {
        localStorage.removeItem(REFRESH_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("Unable to write gallery refresh token.", error);
    }
  }

  function createRefreshToken() {
    return `manual-${Date.now()}`;
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

  function buildMediaMarkup(photo, title) {
    const kind = getMediaKind(photo);

    if (kind === "movie") {
      return `
        <div class="media-shell media-shell-video">
          <video
            src="${escapeHtml(photo.url)}"
            muted
            loop
            autoplay
            playsinline
            preload="metadata"
            aria-label="${escapeHtml(title)}"
          ></video>
          <span class="photo-play" aria-hidden="true">&#9654;</span>
        </div>
      `;
    }

    const badge = kind === "gif" ? '<span class="photo-play" aria-hidden="true">GIF</span>' : "";

    return `
      <div class="media-shell">
        <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
        ${badge}
      </div>
    `;
  }

  function buildCard(photo) {
    const title = photo.label || photo.key || "Gallery item";
    const kind = getMediaKind(photo);

    return `
      <article class="photo-card">
        <a
          class="photo-link"
          href="${escapeHtml(photo.url)}"
          data-photo-trigger
          data-photo-kind="${escapeHtml(kind)}"
          data-photo-label="${escapeHtml(title)}"
          data-photo-key="${escapeHtml(photo.key)}"
          data-photo-src="${escapeHtml(photo.url)}"
          data-photo-backdrop="${escapeHtml(kind === "movie" ? "" : photo.url)}"
          aria-label="${escapeHtml(`Open ${title}`)}"
        >
          ${buildMediaMarkup(photo, title)}
        </a>
      </article>
    `;
  }

  function ensureViewer() {
    let viewer = document.getElementById("gallery-viewer");

    if (viewer) {
      return viewer;
    }

    viewer = document.createElement("div");
    viewer.id = "gallery-viewer";
    viewer.className = "viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-labelledby", "viewer-title");
    viewer.innerHTML = `
      <div class="viewer-backdrop" data-viewer-close></div>
      <div class="viewer-card">
        <button class="viewer-close" type="button" aria-label="Close media viewer" data-viewer-close>&times;</button>
        <button class="viewer-nav viewer-nav-prev" type="button" aria-label="Previous item" data-viewer-nav="-1">&#10094;</button>
        <button class="viewer-nav viewer-nav-next" type="button" aria-label="Next item" data-viewer-nav="1">&#10095;</button>
        <div class="viewer-frame">
          <div class="viewer-stage" id="viewer-stage">
            <div class="viewer-media">
              <img id="viewer-image" alt="" hidden>
              <video id="viewer-video" playsinline controls preload="metadata" hidden></video>
            </div>
          </div>
          <div class="viewer-meta">
            <div>
              <p id="viewer-title" class="viewer-title"></p>
              <p id="viewer-key" class="viewer-key"></p>
            </div>
            <div class="viewer-actions">
              <a id="viewer-open-link" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Open original</a>
              <button class="btn btn-primary" type="button" data-viewer-close>Back</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);
    return viewer;
  }

  function dismissViewer() {
    const viewer = document.getElementById("gallery-viewer");

    if (!viewer) {
      return;
    }

    const viewerImage = viewer.querySelector("#viewer-image");
    const viewerVideo = viewer.querySelector("#viewer-video");
    const viewerStage = viewer.querySelector("#viewer-stage");

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

  function enableViewer(content) {
    if (content.dataset.viewerEnabled === "true") {
      return;
    }

    content.dataset.viewerEnabled = "true";

    const viewer = ensureViewer();
    const viewerStage = viewer.querySelector("#viewer-stage");
    const viewerImage = viewer.querySelector("#viewer-image");
    const viewerVideo = viewer.querySelector("#viewer-video");
    const viewerTitle = viewer.querySelector("#viewer-title");
    const viewerKey = viewer.querySelector("#viewer-key");
    const viewerOpenLink = viewer.querySelector("#viewer-open-link");
    const viewerFrame = viewer.querySelector(".viewer-frame");
    const viewerPrev = viewer.querySelector(".viewer-nav-prev");
    const viewerNext = viewer.querySelector(".viewer-nav-next");
    let lastTrigger = null;
    let currentIndex = -1;
    let touchStartX = 0;
    let touchStartY = 0;

    function getTriggers() {
      return [...content.querySelectorAll("[data-photo-trigger]")];
    }

    function updateViewerNavigation(total) {
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

    function renderViewerAt(index) {
      const triggers = getTriggers();

      if (!triggers.length) {
        return;
      }

      currentIndex = Math.max(0, Math.min(index, triggers.length - 1));
      const trigger = triggers[currentIndex];
      const kind = trigger.dataset.photoKind || "picture";
      const src = trigger.dataset.photoSrc || trigger.href;
      const label = trigger.dataset.photoLabel || "Gallery item";
      const key = trigger.dataset.photoKey || "";
      const backdrop = trigger.dataset.photoBackdrop || src;
      lastTrigger = trigger;

      if (viewerTitle) {
        viewerTitle.textContent = label;
      }

      if (viewerKey) {
        viewerKey.textContent = key;
      }

      if (viewerOpenLink) {
        viewerOpenLink.href = src;
        viewerOpenLink.textContent = kind === "movie" ? "Open movie" : "Open original";
      }

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

      updateViewerNavigation(triggers.length);
    }

    function moveViewer(direction) {
      const triggers = getTriggers();
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= triggers.length) {
        return;
      }

      renderViewerAt(nextIndex);
    }

    function closeViewer() {
      dismissViewer();
      currentIndex = -1;
      lastTrigger?.focus?.();
    }

    function openViewer(trigger) {
      const triggers = getTriggers();
      const index = triggers.indexOf(trigger);
      renderViewerAt(index >= 0 ? index : 0);
      viewer.hidden = false;
      document.body.style.overflow = "hidden";
      viewer.querySelector(".viewer-close")?.focus();
    }

    content.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-photo-trigger]");

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

    viewerFrame?.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    viewerFrame?.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
        return;
      }

      moveViewer(deltaX < 0 ? 1 : -1);
    }, { passive: true });

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

  async function fetchManifest(session, refreshToken) {
    const baseUrl = String(window.__PRIVATE_GALLERY_CONFIG__?.galleryBaseUrl || "").replace(/\/+$/, "");
    const requestUrl = new URL(`${baseUrl}/api/gallery/extra-manifest`);

    if (refreshToken) {
      requestUrl.searchParams.set("refresh", sanitizeRefreshToken(refreshToken));
    }

    const response = await fetch(requestUrl.toString(), {
      headers: {
        Authorization: `Bearer ${session.tokens?.id_token || ""}`,
      },
      cache: "no-store",
    });

    const manifest = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(manifest?.error || "The gallery backend rejected this session.");
    }

    return manifest;
  }

  function updateRefreshButton(button, isRefreshing) {
    if (!button) {
      return;
    }

    button.disabled = isRefreshing;
    button.textContent = isRefreshing ? "Refreshing..." : "Refresh";
  }

  function renderGalleryState(content, status, manifest) {
    dismissViewer();
    const photos = manifest.photos || [];

    if (!photos.length) {
      if (status) {
        status.textContent = "No media.";
      }

      if (content) {
        content.className = "empty-state";
        content.textContent = "";
      }

      return;
    }

    if (status) {
      status.textContent = "";
    }

    content.className = "month-grid";
    content.innerHTML = photos.map((photo) => buildCard(photo)).join("");
    enableViewer(content);
  }

  async function initGalleryPage() {
    const auth = window.PrivateGalleryAuth;
    const signoutButton = document.getElementById("gallery-signout");
    const refreshButton = document.getElementById("gallery-refresh");
    const status = document.getElementById("gallery-status");
    const content = document.getElementById("gallery-content");
    let refreshToken = readRefreshToken();

    if (!auth) {
      if (status) {
        status.textContent = "Unable to load.";
      }
      return;
    }

    const session = await auth.getSession();

    if (!session) {
      window.location.replace("/");
      return;
    }

    signoutButton?.addEventListener("click", () => {
      auth.signOut({ logoutUri: `${window.location.origin}/` });
    });

    async function loadManifest() {
      updateRefreshButton(refreshButton, true);

      try {
        const manifest = await fetchManifest(session, refreshToken);
        renderGalleryState(content, status, manifest);
      } catch (error) {
        console.error(error);
        if (status) {
          status.textContent = error.message || "Unable to load.";
        }
        if (content) {
          content.className = "empty-state";
          content.textContent = "";
        }
      } finally {
        updateRefreshButton(refreshButton, false);
      }
    }

    refreshButton?.addEventListener("click", async () => {
      refreshToken = createRefreshToken();
      writeRefreshToken(refreshToken);
      if (status) {
        status.textContent = "Refreshing.";
      }
      await loadManifest();
    });

    await loadManifest();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.galleryMode === "extra") {
      initGalleryPage();
    }
  });
})();
