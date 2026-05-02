(function () {
  const ROUTES = {
    months: "/gallery/months/",
    test: "/gallery/test/",
  };

  const FILTERS = [
    { id: "all", label: "Everything" },
    { id: "picture", label: "Pictures" },
    { id: "gif", label: "GIFs" },
    { id: "movie", label: "Movies" },
  ];

  const MEDIA_LABELS = {
    all: "everything",
    picture: "pictures",
    gif: "GIFs",
    movie: "movies",
  };

  const REFRESH_STORAGE_PREFIX = "private-gallery-refresh.";

  function normalizeCollection(value) {
    return value === "test" ? "test" : "months";
  }

  function getRequestedCollection() {
    return normalizeCollection(document.body.dataset.galleryMode || "months");
  }

  function getManifestUrl() {
    const baseDomain = document.body.dataset.galleryDomain || window.__PRIVATE_GALLERY_CONFIG__?.galleryBaseUrl || "";
    return `${baseDomain.replace(/\/+$/, "")}/api/gallery/manifest`;
  }

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

  function getPhotoStem(photo) {
    if (photo?.label) {
      return String(photo.label);
    }

    const key = String(photo?.key || "");
    const filename = key.split("/").pop() || key;
    return filename.replace(/\.[^.]+$/, "");
  }

  function getMonthBucket(photo) {
    const stem = getPhotoStem(photo);
    const match = stem.match(/\d/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }

  function compareMonthsPhotos(left, right) {
    const leftBucket = getMonthBucket(left);
    const rightBucket = getMonthBucket(right);

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    const leftStem = getPhotoStem(left);
    const rightStem = getPhotoStem(right);
    const leftNumber = Number.parseInt(leftStem, 10);
    const rightNumber = Number.parseInt(rightStem, 10);
    const leftIsNumber = Number.isFinite(leftNumber);
    const rightIsNumber = Number.isFinite(rightNumber);

    if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return leftStem.localeCompare(rightStem, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function buildMonthGroups(photos) {
    const groups = new Map();

    [...photos].sort(compareMonthsPhotos).forEach((photo) => {
      const bucket = getMonthBucket(photo);

      if (!groups.has(bucket)) {
        groups.set(bucket, []);
      }

      groups.get(bucket).push(photo);
    });

    return [...groups.entries()].map(([month, items]) => ({ month, items }));
  }

  function shufflePhotos(photos) {
    const next = [...photos];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
  }

  function pickTestCardStyle(index) {
    const palette = [
      { col: 6, row: 2, tilt: -2.5, wash: "rgba(190, 140, 34, 0.18)" },
      { col: 4, row: 2, tilt: 1.8, wash: "rgba(230, 165, 54, 0.16)" },
      { col: 5, row: 1, tilt: -1.2, wash: "rgba(165, 94, 35, 0.14)" },
      { col: 3, row: 1, tilt: 2.2, wash: "rgba(223, 164, 88, 0.16)" },
      { col: 6, row: 2, tilt: -1.5, wash: "rgba(159, 97, 37, 0.16)" },
      { col: 5, row: 2, tilt: 1.1, wash: "rgba(239, 196, 116, 0.14)" },
    ];

    return palette[index % palette.length];
  }

  function isKnownMediaKind(value) {
    return value === "picture" || value === "gif" || value === "movie";
  }

  function normalizeFilterKind(value) {
    return isKnownMediaKind(value) ? value : "all";
  }

  function inferMediaKindFromKey(key) {
    if (/\.gif$/i.test(key)) {
      return "gif";
    }

    if (/\.(m4v|mov|mp4|webm)$/i.test(key)) {
      return "movie";
    }

    return "picture";
  }

  function getMediaKind(photo) {
    const explicit = String(photo?.kind || "").trim().toLowerCase();
    return isKnownMediaKind(explicit) ? explicit : inferMediaKindFromKey(photo?.key || "");
  }

  function getRefreshStorageKey(collection) {
    return `${REFRESH_STORAGE_PREFIX}${collection}`;
  }

  function sanitizeRefreshToken(value) {
    return String(value || "")
      .trim()
      .replace(/[^A-Za-z0-9._-]/g, "")
      .slice(0, 64);
  }

  function readRefreshToken(collection) {
    try {
      return sanitizeRefreshToken(localStorage.getItem(getRefreshStorageKey(collection)));
    } catch (error) {
      console.warn("Unable to read gallery refresh token from localStorage.", error);
      return "";
    }
  }

  function writeRefreshToken(collection, value) {
    const nextValue = sanitizeRefreshToken(value);

    try {
      if (nextValue) {
        localStorage.setItem(getRefreshStorageKey(collection), nextValue);
      } else {
        localStorage.removeItem(getRefreshStorageKey(collection));
      }
    } catch (error) {
      console.warn("Unable to write gallery refresh token to localStorage.", error);
    }
  }

  function createRefreshToken() {
    return `manual-${Date.now()}`;
  }

  function buildMediaCounts(photos) {
    return photos.reduce(
      (counts, photo) => {
        const kind = getMediaKind(photo);
        counts.all += 1;
        counts[kind] += 1;
        return counts;
      },
      { all: 0, picture: 0, gif: 0, movie: 0 }
    );
  }

  function ensureAvailableFilter(filter, photos) {
    const counts = buildMediaCounts(photos);
    return filter === "all" || counts[filter] > 0 ? filter : "all";
  }

  function filterPhotos(photos, filter) {
    const activeFilter = normalizeFilterKind(filter);

    if (activeFilter === "all") {
      return [...photos];
    }

    return photos.filter((photo) => getMediaKind(photo) === activeFilter);
  }

  function buildMediaMarkup(photo, title, priority) {
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

    const fetchPriority = priority ? ' fetchpriority="high"' : "";

    return `
      <div class="media-shell">
        <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async"${fetchPriority}>
      </div>
    `;
  }

  function buildPhotoCardMarkup(photo, options = {}) {
    const title = options.title || `Photo ${getPhotoStem(photo)}`;
    const caption = options.caption || photo.key;
    const showMeta = options.showMeta !== false;
    const kind = getMediaKind(photo);

    return `
      <article class="${escapeHtml(options.cardClass || "photo-card")}" style="${escapeHtml(options.style || "")}">
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
          ${buildMediaMarkup(photo, title, options.priority)}
        </a>
        ${showMeta ? `
          <div class="photo-meta">
            <p class="photo-label">${escapeHtml(title)}</p>
            <p class="photo-caption">${escapeHtml(caption)}</p>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderMonthsGallery(content, manifest, visiblePhotos) {
    const groups = buildMonthGroups(visiblePhotos);

    content.className = "months-stack";
    content.innerHTML = groups
      .map(({ month, items }, groupIndex) => {
        const cards = items
          .map((photo, photoIndex) =>
            buildPhotoCardMarkup(photo, {
              title: `Month ${month} · ${getPhotoStem(photo)}`,
              caption: photo.key,
              priority: groupIndex === 0 && photoIndex === 0,
            })
          )
          .join("");

        const plural = items.length === 1 ? "memory" : "memories";

        return `
          <section class="month-panel">
            <div class="month-header">
              <div>
                <span class="month-kicker">Calendar lane</span>
                <h2 class="month-title">Month ${escapeHtml(month)}</h2>
                <p class="month-note">Numeric names stay in your custom order, so 0 comes first, then 1, 11, and the rest of that month lane.</p>
              </div>
              <p class="month-count">${items.length} ${plural}</p>
            </div>
            <div class="month-grid">${cards}</div>
          </section>
        `;
      })
      .join("");
  }

  function renderTestGallery(content, manifest, visiblePhotos) {
    const randomized = shufflePhotos(visiblePhotos);

    content.className = "test-collage";
    content.innerHTML = randomized
      .map((photo, index) => {
        const style = pickTestCardStyle(index);

        return buildPhotoCardMarkup(photo, {
          cardClass: "test-card",
          title: `Test photo ${getPhotoStem(photo)}`,
          showMeta: false,
          style: `--col-span:${style.col}; --row-span:${style.row}; --tilt:${style.tilt}deg; --accent-wash:${style.wash};`,
          priority: index < 2,
        });
      })
      .join("");
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
              <button class="btn btn-primary" type="button" data-viewer-close>Back to gallery</button>
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
      const kind = normalizeFilterKind(trigger.dataset.photoKind);
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

  async function fetchManifest(session, options = {}) {
    const requestUrl = new URL(getManifestUrl());

    if (options.refreshToken) {
      requestUrl.searchParams.set("refresh", sanitizeRefreshToken(options.refreshToken));
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

  function renderFilters(container, photos, activeFilter) {
    if (!container) {
      return;
    }

    const counts = buildMediaCounts(photos);
    const filters = FILTERS.filter((filter) => filter.id === "all" || counts[filter.id] > 0);

    container.innerHTML = filters
      .map((filter) => `
        <button
          class="filter-chip${filter.id === activeFilter ? " is-active" : ""}"
          type="button"
          data-gallery-filter="${escapeHtml(filter.id)}"
          aria-pressed="${filter.id === activeFilter ? "true" : "false"}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <span class="filter-count">${counts[filter.id]}</span>
        </button>
      `)
      .join("");
  }

  function updateRefreshButton(button, isRefreshing) {
    if (!button) {
      return;
    }

    button.disabled = isRefreshing;
    button.textContent = isRefreshing ? "Refreshing gallery..." : "Manual refresh";
  }

  function applyCollectionCopy(collection, manifest, state) {
    const eyebrow = document.getElementById("gallery-eyebrow");
    const title = document.getElementById("gallery-title");
    const copy = document.getElementById("gallery-copy");
    const prefixPill = document.getElementById("gallery-prefix");
    const cachePill = document.getElementById("gallery-cache");

    if (collection === "test") {
      if (eyebrow) {
        eyebrow.textContent = "Creative test collection";
      }

      if (title) {
        title.textContent = "Surprise collage vault";
      }

      if (copy) {
        copy.textContent =
          "This signed-in route stays playful with a reshuffled layout while the backend still decides exactly who can see it.";
      }
    } else {
      if (eyebrow) {
        eyebrow.textContent = "Month-by-month vault";
      }

      if (title) {
        title.textContent = "Calendar memory gallery";
      }

      if (copy) {
        copy.textContent =
          "This route follows your custom month naming convention and keeps the selected memories grouped in calendar order.";
      }
    }

    if (prefixPill) {
      prefixPill.textContent = `Collection prefix: ${manifest.prefix}/`;
    }

    if (cachePill) {
      cachePill.textContent = state.refreshToken
        ? "Manual refresh active on this device"
        : "Immutable cache with manual refresh";
    }
  }

  function renderGalleryState(content, status, state) {
    dismissViewer();

    const visiblePhotos = filterPhotos(state.manifest.photos || [], state.activeFilter);
    const filterLabel = MEDIA_LABELS[state.activeFilter] || MEDIA_LABELS.all;
    const visibleSummary = state.activeFilter === "all"
      ? "everything in this view"
      : `${visiblePhotos.length} ${filterLabel}`;

    if (!visiblePhotos.length) {
      if (status) {
        status.textContent = `No ${filterLabel} were found under ${state.manifest.prefix}/ right now.`;
      }

      if (content) {
        content.className = "empty-state";
        content.textContent =
          state.actualCollection === "test"
            ? `Upload pictures, GIFs, or movies under ${state.manifest.prefix}/ and use manual refresh when you want the collage to pick them up.`
            : `Upload pictures, GIFs, or movies under ${state.manifest.prefix}/ using your flat numbering like 0.jpg, 1.jpg, or 11.mp4, then use manual refresh when you want the month view to update.`;
      }

      return;
    }

    if (status) {
      status.textContent = `Loaded ${state.manifest.photos.length} signed CloudFront items from ${state.manifest.prefix}/. Showing ${visibleSummary}.`;
    }

    if (state.actualCollection === "test") {
      renderTestGallery(content, state.manifest, visiblePhotos);
    } else {
      renderMonthsGallery(content, state.manifest, visiblePhotos);
    }
  }

  async function initGalleryPage() {
    const auth = window.PrivateGalleryAuth;
    const requestedCollection = getRequestedCollection();
    const signoutButton = document.getElementById("gallery-signout");
    const refreshButton = document.getElementById("gallery-refresh");
    const filterContainer = document.getElementById("gallery-media-filters");
    const status = document.getElementById("gallery-status");
    const content = document.getElementById("gallery-content");
    const userPill = document.getElementById("gallery-user");
    const state = {
      requestedCollection,
      actualCollection: requestedCollection,
      activeFilter: "all",
      refreshToken: readRefreshToken(requestedCollection),
      manifest: null,
    };

    if (!auth) {
      if (status) {
        status.textContent = "The secure gallery helper could not load.";
      }

      if (content) {
        content.className = "empty-state";
        content.textContent = "Please return to the home page and try again.";
      }

      return;
    }

    const session = await auth.getSession();

    if (!session) {
      window.location.replace("/");
      return;
    }

    if (signoutButton) {
      signoutButton.addEventListener("click", () => {
        auth.signOut({ logoutUri: `${window.location.origin}/` });
      });
    }

    if (userPill) {
      userPill.textContent = `Signed in as ${session.claims?.email || "your account"}`;
    }

    if (status) {
      status.textContent = "Checking your private manifest and preparing CloudFront media delivery.";
    }

    async function loadManifest() {
      updateRefreshButton(refreshButton, true);

      try {
        state.manifest = await fetchManifest(session, {
          refreshToken: state.refreshToken,
        });
      } catch (error) {
        console.error(error);

        if (status) {
          status.textContent = "The private gallery backend could not load your media.";
        }

        if (content) {
          content.className = "empty-state";
          content.textContent = error.message || "Please return to the home page and try signing in again.";
        }

        updateRefreshButton(refreshButton, false);
        return false;
      }

      const actualCollection = normalizeCollection(state.manifest.collection);

      if (state.requestedCollection !== actualCollection) {
        window.location.replace(ROUTES[actualCollection]);
        return false;
      }

      state.actualCollection = actualCollection;
      state.activeFilter = ensureAvailableFilter(state.activeFilter, state.manifest.photos || []);

      applyCollectionCopy(actualCollection, state.manifest, state);
      renderFilters(filterContainer, state.manifest.photos || [], state.activeFilter);
      renderGalleryState(content, status, state);
      if (content) {
        enableViewer(content);
      }
      updateRefreshButton(refreshButton, false);
      return true;
    }

    filterContainer?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-gallery-filter]");

      if (!button || !state.manifest) {
        return;
      }

      state.activeFilter = ensureAvailableFilter(
        normalizeFilterKind(button.dataset.galleryFilter),
        state.manifest.photos || []
      );

      applyCollectionCopy(state.actualCollection, state.manifest, state);
      renderFilters(filterContainer, state.manifest.photos || [], state.activeFilter);
      renderGalleryState(content, status, state);
    });

    refreshButton?.addEventListener("click", async () => {
      state.refreshToken = createRefreshToken();
      writeRefreshToken(state.actualCollection, state.refreshToken);

      if (status) {
        status.textContent = "Manually refreshing the gallery cache and fetching fresh CloudFront URLs.";
      }

      await loadManifest();
    });

    await loadManifest();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.galleryMode) {
      initGalleryPage();
    }
  });
})();
