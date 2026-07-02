document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.PrivateGalleryAuth;
  const config = window.__PRIVATE_GALLERY_CONFIG__ || {};
  const profileButtons = [...document.querySelectorAll("[data-profile-trigger]")];
  const galleryThemeButtons = [...document.querySelectorAll("[data-gallery-theme-toggle]")];
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginEmailInput = document.getElementById("login-email");
  const loginFeedback = document.getElementById("login-feedback");
  const loginSubmit = document.getElementById("login-submit");
  const modalCloseTriggers = [...document.querySelectorAll("[data-modal-close]")];
  const status = document.getElementById("public-gallery-status");
  const grid = document.getElementById("public-gallery-grid");
  const publicCarousel = document.getElementById("public-carousel");
  const publicCarouselTrack = document.getElementById("public-carousel-track");
  const publicGallerySentinel = document.getElementById("public-gallery-sentinel");
  const publicGalleryActions = document.getElementById("public-gallery-actions");
  const publicGalleryLoadMore = document.getElementById("public-gallery-load-more");
  const galleryFilterButtons = [...document.querySelectorAll("[data-gallery-filter]")];
  const galleryToolbarSummary = document.getElementById("gallery-toolbar-summary");
  const publicGalleryPageSize = 36;
  const publicCarouselPhotoCount = 12;
  const siteLabel = config.projectSlug || "malkokote-gallery";
  const publicGalleryThemeStorageKey = `${siteLabel}:gallery-theme`;
  const publicGalleryFavoritesStorageKey = `${siteLabel}:public-gallery-favorites`;
  const publicGalleryManifestCacheTtlMs = 5 * 60 * 1000;
  const publicGalleryAutoloadMarginPx = 1200;
  const themeInviteVisibleMs = 9000;

  let currentSession = null;
  let lastFocus = null;
  let themeInviteTimer = null;
  let publicGalleryLoading = false;
  let publicGalleryObserver = null;
  const publicGalleryState = {
    theme: "day",
    allPhotos: [],
    photos: [],
    heroPhotos: [],
    userAdPhotos: [],
    renderedCount: 0,
    fetchedAt: 0,
    nextCursor: null,
    filter: "all",
    favoriteKeys: new Set(),
  };
  const publicAspectRatioCache = new Map();

  const DRIFT_CLASSES = [
    "drift-none",
    "drift-up",
    "drift-down",
    "drift-none",
    "drift-down",
    "drift-up",
  ];

  const WALL_PATTERN = [
    ["hero-portrait", "portrait", "square"],
    ["landscape", "cinema", "square"],
    ["portrait", "square", "landscape"],
    ["cinema", "landscape", "square"],
    ["portrait", "hero-portrait", "square"],
    ["square", "portrait", "landscape"],
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

  function normalizePublicTheme(value) {
    return String(value || "").trim().toLowerCase() === "night" ? "night" : "day";
  }

  function getOppositePublicTheme(theme) {
    return normalizePublicTheme(theme) === "night" ? "day" : "night";
  }

  function getPublicGalleryCacheKey(theme = publicGalleryState.theme) {
    return `${siteLabel}:public-gallery-cache:${normalizePublicTheme(theme)}`;
  }

  function readStoredPublicTheme() {
    try {
      return normalizePublicTheme(localStorage.getItem(publicGalleryThemeStorageKey));
    } catch (error) {
      console.warn("Unable to read gallery theme.", error);
      return "day";
    }
  }

  function writeStoredPublicTheme(theme) {
    try {
      localStorage.setItem(publicGalleryThemeStorageKey, normalizePublicTheme(theme));
    } catch (error) {
      console.warn("Unable to persist gallery theme.", error);
    }
  }

  function updateThemeButtons() {
    const nextTheme = getOppositePublicTheme(publicGalleryState.theme);

    galleryThemeButtons.forEach((button) => {
      button.dataset.targetTheme = nextTheme;
      button.setAttribute("aria-pressed", String(publicGalleryState.theme === "night"));
    });
  }

  function getThemeInviteElement() {
    let hint = document.getElementById("theme-open-hint");

    if (!hint) {
      hint = document.createElement("div");
      hint.id = "theme-open-hint";
      hint.className = "theme-open-hint";
      hint.setAttribute("aria-hidden", "true");
      document.body.appendChild(hint);
    }

    const translate = window.MalkokoteLanguage?.translate || ((k) => k);
    hint.textContent = translate("dayThinking") || "Open night gallery";
    return hint;
  }

  function getVisibleThemeButton() {
    return galleryThemeButtons.find((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || galleryThemeButtons[0] || null;
  }

  function positionThemeInvite() {
    const hint = document.getElementById("theme-open-hint");
    const button = getVisibleThemeButton();

    if (!hint || !button) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const margin = 12;
    const gap = viewportWidth <= 720 ? 10 : 14;
    const buttonCenter = buttonRect.left + (buttonRect.width / 2);
    const hintWidth = Math.min(hint.offsetWidth || 272, Math.max(0, viewportWidth - (margin * 2)));
    const minLeft = margin + (hintWidth / 2);
    const maxLeft = viewportWidth - margin - (hintWidth / 2);
    const hintLeft = Math.min(Math.max(buttonCenter, minLeft), maxLeft);
    const arrowLeft = Math.min(
      Math.max(buttonCenter - (hintLeft - (hintWidth / 2)), 18),
      Math.max(18, hintWidth - 18)
    );

    hint.style.setProperty("--theme-invite-left", `${hintLeft}px`);
    hint.style.setProperty("--theme-invite-top", `${buttonRect.bottom + gap}px`);
    hint.style.setProperty("--theme-invite-arrow-left", `${arrowLeft}px`);
  }

  function dismissThemeInvite() {
    if (themeInviteTimer) {
      window.clearTimeout(themeInviteTimer);
      themeInviteTimer = null;
    }

    document.body.classList.remove("theme-invite-active");

    galleryThemeButtons.forEach((button) => {
      button.classList.remove("theme-invite-visible");
    });
  }

  function showThemeInvite() {
    if (publicGalleryState.theme === "night" || !galleryThemeButtons.length) {
      return;
    }

    getThemeInviteElement();
    positionThemeInvite();
    document.body.classList.add("theme-invite-active");

    galleryThemeButtons.forEach((button) => {
      const dayText = button.querySelector(".thinking-text-day");
      const translate = window.MalkokoteLanguage?.translate || ((k) => k);

      if (dayText) {
        dayText.textContent = translate("dayThinking") || "Open night gallery";
      }

      button.classList.add("theme-invite-visible");
    });

    themeInviteTimer = window.setTimeout(dismissThemeInvite, themeInviteVisibleMs);
  }

  function applyPublicTheme(theme, options = {}) {
    const normalizedTheme = normalizePublicTheme(theme);
    const previousTheme = publicGalleryState.theme;

    publicGalleryState.theme = normalizedTheme;
    document.body.dataset.galleryTheme = normalizedTheme;
    updateThemeButtons();

    if (options.persist !== false) {
      writeStoredPublicTheme(normalizedTheme);
    }

    if (previousTheme !== normalizedTheme) {
      window.dispatchEvent(new CustomEvent("malkokote:themechange", {
        detail: { theme: normalizedTheme },
      }));
    }
  }

  function setFeedback(message) {
    if (!loginFeedback) {
      return;
    }

    loginFeedback.hidden = !message;
    loginFeedback.textContent = message || "";
  }

  function translateText(key, fallback = "") {
    return window.MalkokoteLanguage?.translate?.(key, fallback) || fallback || key;
  }

  function getButtonStateLabel(button, state, fallback) {
    const key = state === "loading" ? "loadingText" : "idleText";
    return button?.dataset?.[key] || fallback;
  }

  function updateProfileButtons() {
    profileButtons.forEach((button) => {
      const label = button.querySelector("[data-profile-label]");
      if (!label) {
        return;
      }

      label.textContent = currentSession
        ? button.dataset.signedInText || button.dataset.signedOutText || "Login"
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

  function getPhotoIdentity(photo) {
    return String(photo?.key || photo?.url || "").trim();
  }

  function readFavoriteKeys() {
    try {
      const parsed = JSON.parse(localStorage.getItem(publicGalleryFavoritesStorageKey) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
    } catch (error) {
      console.warn("Unable to read gallery favorites.", error);
      return new Set();
    }
  }

  function saveFavoriteKeys() {
    try {
      localStorage.setItem(
        publicGalleryFavoritesStorageKey,
        JSON.stringify([...publicGalleryState.favoriteKeys])
      );
    } catch (error) {
      console.warn("Unable to persist gallery favorites.", error);
    }
  }

  function isFavoritePhoto(photo) {
    const identity = getPhotoIdentity(photo);
    return Boolean(identity && publicGalleryState.favoriteKeys.has(identity));
  }

  function filterPhotosForCurrentView(photos) {
    const activeFilter = publicGalleryState.filter;

    if (activeFilter === "favorites") {
      return photos.filter((photo) => isFavoritePhoto(photo));
    }

    return photos;
  }

  function updateGalleryFilterButtons() {
    galleryFilterButtons.forEach((button) => {
      const isActive = button.dataset.galleryFilter === publicGalleryState.filter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function getFilterLabel(filter) {
    const labels = {
      all: ["galleryFilterAll", "All"],
      favorites: ["galleryFilterFavorites", "Favorites"],
    };
    const [key, fallback] = labels[filter] || labels.all;

    return translateText(key, fallback);
  }

  function updateGalleryOverview(visibleCount = null) {
    const favorites = publicGalleryState.favoriteKeys.size;

    if (galleryToolbarSummary) {
      galleryToolbarSummary.textContent = publicGalleryState.filter === "favorites"
        ? favorites
          ? translateText("galleryEmptyFavoritesCopy", "Use the heart button on a preview to save it here.")
          : translateText("galleryEmptyFavoritesTitle", "No favorites yet.")
        : translateText("galleryToolbarSummaryNew", "New media appears here as it is curated.");
    }
  }

  function shufflePhotos(photos) {
    const next = [...photos];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
  }

  function uniquePhotosByKey(photos) {
    const seen = new Set();
    const next = [];

    for (const photo of photos || []) {
      const key = String(photo?.key || "").trim();

      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      next.push(photo);
    }

    return next;
  }

  function classifyWallClass(kind, aspectRatio) {
    const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

    if (kind === "movie") {
      return ratio >= 1.7 ? "cinema" : "landscape";
    }

    if (ratio < 0.72) {
      return "hero-portrait";
    }

    if (ratio < 0.92) {
      return "portrait";
    }

    if (ratio < 1.12) {
      return "square";
    }

    if (ratio < 1.55) {
      return "landscape";
    }

    return "cinema";
  }

  function measureImageAspectRatio(url) {
    if (publicAspectRatioCache.has(url)) {
      return Promise.resolve(publicAspectRatioCache.get(url));
    }

    return new Promise((resolve) => {
      const image = new Image();
      const finish = (ratio) => {
        const normalized = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
        publicAspectRatioCache.set(url, normalized);
        resolve(normalized);
      };

      image.decoding = "async";
      image.onload = () => finish(image.naturalWidth / image.naturalHeight);
      image.onerror = () => finish(1);
      image.src = url;
    });
  }

  function measureVideoAspectRatio(url) {
    if (publicAspectRatioCache.has(url)) {
      return Promise.resolve(publicAspectRatioCache.get(url));
    }

    return new Promise((resolve) => {
      const video = document.createElement("video");
      let settled = false;

      const finish = (ratio) => {
        if (settled) {
          return;
        }

        settled = true;
        video.removeAttribute("src");
        video.load();
        const normalized = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.65;
        publicAspectRatioCache.set(url, normalized);
        resolve(normalized);
      };

      const timer = window.setTimeout(() => finish(1.65), 2600);

      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        finish(video.videoWidth / video.videoHeight);
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        finish(1.65);
      };
      video.src = url;
    });
  }

  async function enrichPhoto(photo) {
    const kind = getMediaKind(photo);
    if (Number.isFinite(photo?.aspectRatio) && photo?.wallClass) {
      return {
        ...photo,
        kind,
      };
    }

    const aspectRatio = kind === "movie"
      ? await measureVideoAspectRatio(photo.url)
      : await measureImageAspectRatio(photo.url);

    return {
      ...photo,
      kind,
      aspectRatio,
      wallClass: classifyWallClass(kind, aspectRatio),
    };
  }

  function pickFromBuckets(buckets, preferences) {
    for (const bucketName of preferences) {
      const bucket = buckets[bucketName];
      if (bucket?.length) {
        return bucket.shift();
      }
    }

    return null;
  }

  function pickRemainingPhoto(buckets) {
    const bucketNames = Object.keys(buckets)
      .filter((bucketName) => buckets[bucketName].length)
      .sort((left, right) => buckets[right].length - buckets[left].length);

    if (!bucketNames.length) {
      return null;
    }

    return buckets[bucketNames[0]].shift();
  }

  function weaveWallPhotos(photos) {
    const buckets = {
      "hero-portrait": [],
      portrait: [],
      square: [],
      landscape: [],
      cinema: [],
    };

    photos.forEach((photo) => {
      const bucketName = buckets[photo.wallClass] ? photo.wallClass : "square";
      buckets[bucketName].push(photo);
    });

    const ordered = [];

    while (ordered.length < photos.length) {
      let inserted = false;

      for (const preferences of WALL_PATTERN) {
        const selected = pickFromBuckets(buckets, preferences) || pickRemainingPhoto(buckets);

        if (!selected) {
          continue;
        }

        ordered.push(selected);
        inserted = true;
      }

      if (!inserted) {
        break;
      }
    }

    return ordered;
  }

  function applyDriftClasses(photos, startIndex = 0) {
    return photos.map((photo, index) => ({
      ...photo,
      driftClass: DRIFT_CLASSES[(startIndex + index) % DRIFT_CLASSES.length],
    }));
  }

async function prepareWallPhotos(photos, options = {}) {
    const uniquePhotos = uniquePhotosByKey(photos);
    const orderedPhotos = options.shuffle === false
      ? uniquePhotos
      : shufflePhotos(uniquePhotos);
    const enriched = await Promise.all(orderedPhotos.map((photo) => enrichPhoto(photo)));
    return weaveWallPhotos(enriched);
  }

  function getPublicGalleryCache() {
    try {
      const raw = localStorage.getItem(getPublicGalleryCacheKey());
      const parsed = raw ? JSON.parse(raw) : null;

      if (!parsed || !Array.isArray(parsed.photos)) {
        return null;
      }

      if (!Number.isFinite(Number(parsed.fetchedAt)) || Number(parsed.fetchedAt) + publicGalleryManifestCacheTtlMs <= Date.now()) {
        localStorage.removeItem(getPublicGalleryCacheKey());
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn("Unable to read public gallery cache.", error);
      return null;
    }
  }

  function savePublicGalleryCache() {
    try {
      localStorage.setItem(getPublicGalleryCacheKey(), JSON.stringify({
        theme: publicGalleryState.theme,
        photos: publicGalleryState.allPhotos,
        heroPhotos: publicGalleryState.heroPhotos,
        fetchedAt: publicGalleryState.fetchedAt,
      }));
    } catch (error) {
      console.warn("Unable to persist public gallery cache.", error);
    }
  }

  function buildPublicManifestStaticUrl(theme) {
    const normalizedTheme = normalizePublicTheme(theme);
    const baseUrl = String(config.galleryBaseUrl || "").replace(/\/+$/, "");
    return `${baseUrl}/_manifests/public/${normalizedTheme}.json`;
  }

  function buildPublicManifestFallbackUrl(theme) {
    const requestUrl = new URL(`${String(config.galleryBaseUrl || "").replace(/\/+$/, "")}/api/gallery/public-manifest`);
    requestUrl.searchParams.set("theme", normalizePublicTheme(theme));
    requestUrl.searchParams.set("full", "1");
    return requestUrl.toString();
  }

  async function fetchPublicManifest(theme) {
    try {
      const staticResponse = await fetch(buildPublicManifestStaticUrl(theme), { cache: "default" });

      if (staticResponse.ok) {
        const manifest = await staticResponse.json().catch(() => null);

        if (!manifest) {
          throw new Error("Unable to parse gallery manifest.");
        }

        return manifest;
      }
    } catch (error) {
      console.warn("Static public manifest fetch failed, falling back to API.", error);
    }

    const fallbackResponse = await fetch(buildPublicManifestFallbackUrl(theme), { cache: "no-store" });
    const fallbackManifest = await fallbackResponse.json().catch(() => null);

    if (!fallbackResponse.ok) {
      throw new Error(fallbackManifest?.error || "Unable to load gallery.");
    }

    return fallbackManifest;
  }

  function resetPublicGalleryState() {
    publicGalleryState.allPhotos = [];
    publicGalleryState.photos = [];
    publicGalleryState.heroPhotos = [];
    publicGalleryState.renderedCount = 0;
    publicGalleryState.fetchedAt = 0;
    publicGalleryState.nextCursor = null;

    if (publicCarousel) {
      publicCarousel.hidden = true;
    }

    if (publicCarouselTrack) {
      publicCarouselTrack.innerHTML = "";
    }
  }

  const GIRL_NAMES = [
    { en: "Alexandra", bg: "Александра", ru: "Александра" },
    { en: "Beatris", bg: "Беатрис", ru: "Беатрис" },
    { en: "Celine", bg: "Селин", ru: "Селин" },
    { en: "Desislava", bg: "Десислава", ru: "Десислава" },
    { en: "Elena", bg: "Елена", ru: "Елена" },
    { en: "Gabriela", bg: "Габриела", ru: "Габриэла" },
    { en: "Isabella", bg: "Изабела", ru: "Изабелла" },
    { en: "Gergana", bg: "Гергана", ru: "Гергана" },
    { en: "Kamelia", bg: "Камелия", ru: "Камелия" },
    { en: "Lora", bg: "Лора", ru: "Лора" },
    { en: "Maria", bg: "Мария", ru: "Мария" },
    { en: "Natalia", bg: "Наталия", ru: "Наталия" },
    { en: "Olivia", bg: "Оливия", ru: "Оливия" },
    { en: "Polina", bg: "Полина", ru: "Полина" },
    { en: "Ralitsa", bg: "Ралица", ru: "Ралица" },
    { en: "Simona", bg: "Симона", ru: "Симона" },
    { en: "Teodora", bg: "Теодора", ru: "Теодора" },
    { en: "Victoria", bg: "Виктория", ru: "Виктория" },
    { en: "Yana", bg: "Яна", ru: "Яна" },
    { en: "Zornitsa", bg: "Зорница", ru: "Зорница" },
    { en: "Chloe", bg: "Клои", ru: "Хлоя" },
    { en: "Sophie", bg: "Софи", ru: "Софи" },
    { en: "Emma", bg: "Ема", ru: "Эмма" },
    { en: "Nicole", bg: "Никол", ru: "Николь" },
    { en: "Vanessa", bg: "Ванеса", ru: "Ванесса" },
    { en: "Raya", bg: "Рая", ru: "Рая" },
    { en: "Daria", bg: "Дария", ru: "Дарья" },
    { en: "Svetlana", bg: "Светлана", ru: "Светлана" },
    { en: "Maya", bg: "Мая", ru: "Майя" },
    { en: "Jessica", bg: "Джесика", ru: "Джессика" }
  ];

  function getRandomGirlName() {
    return GIRL_NAMES[Math.floor(Math.random() * GIRL_NAMES.length)];
  }

  const MOCK_DESCRIPTIONS = [
    { en: "Private member preview", bg: "Преглед за членове" },
    { en: "Editorial set available", bg: "Редакционна серия" },
    { en: "Private gallery sample", bg: "Пример от частната галерия" },
    { en: "Curated feature", bg: "Подбрана селекция" },
    { en: "Studio collection", bg: "Студийна колекция" },
    { en: "New gallery preview", bg: "Нов преглед от галерията" },
    { en: "Member gallery sample", bg: "Пример от галерията" },
    { en: "Featured collaboration", bg: "Избрана колаборация" }
  ];

  function getRandomMockDescription() {
    return MOCK_DESCRIPTIONS[Math.floor(Math.random() * MOCK_DESCRIPTIONS.length)];
  }

  function setPublicGalleryManifest(manifest, fetchedAt = Date.now()) {
    publicGalleryState.allPhotos = shufflePhotos(uniquePhotosByKey(manifest?.photos || []));
    publicGalleryState.photos = [];
    publicGalleryState.heroPhotos = uniquePhotosByKey(manifest?.heroPhotos || []);
    publicGalleryState.userAdPhotos = shufflePhotos(
      publicGalleryState.allPhotos.filter((p) => getMediaKind(p) === "picture")
    ).slice(0, 10).map(photo => ({
      ...photo,
      userNames: getRandomGirlName(),
      userDesc: getRandomMockDescription()
    }));
    publicGalleryState.renderedCount = 0;
    publicGalleryState.fetchedAt = fetchedAt;
    publicGalleryState.nextCursor = publicGalleryState.allPhotos.length ? "0" : null;
    updateGalleryOverview();
  }

  function buildDisplayPhotos() {
    const basePhotos = [...uniquePhotosByKey(publicGalleryState.photos)];
    const heroPhotos = shufflePhotos(uniquePhotosByKey(publicGalleryState.heroPhotos));
    const userAdPhotos = publicGalleryState.userAdPhotos;

    if (!basePhotos.length) {
      return basePhotos;
    }

    // 1. Inject Top Signed In User Ad at index 0
    if (userAdPhotos.length > 0) {
      const replaced = basePhotos[0];
      basePhotos[0] = {
        ...userAdPhotos[0],
        wallClass: replaced.wallClass,
        driftClass: replaced.driftClass,
        isUserAd: true,
      };
    }

    // 2. Inject Hero Ad at index 1 (shifted from index 0)
    if (heroPhotos.length > 0 && basePhotos.length > 1) {
      const replaced = basePhotos[1];
      basePhotos[1] = {
        ...heroPhotos[0],
        wallClass: replaced.wallClass,
        driftClass: replaced.driftClass,
        isHeroAd: true,
      };
    }

    // 3. Inject User Ads every 24 items
    if (userAdPhotos.length > 0) {
      for (let i = 24; i < basePhotos.length; i += 24) {
        const adIndex = (Math.floor(i / 24)) % userAdPhotos.length;
        const replaced = basePhotos[i];
        basePhotos[i] = {
          ...userAdPhotos[adIndex],
          wallClass: replaced.wallClass,
          driftClass: replaced.driftClass,
          isUserAd: true,
        };
      }
    }

    return basePhotos;
  }

  function buildCarouselPhotos() {
    return shufflePhotos(
      uniquePhotosByKey([...publicGalleryState.heroPhotos, ...publicGalleryState.allPhotos])
        .filter((photo) => getMediaKind(photo) !== "movie")
    ).slice(0, publicCarouselPhotoCount);
  }

  function buildCarouselGroupMarkup(photos, duplicate = false) {
    const slides = photos.map((photo, index) => {
      const ratio = Number.isFinite(photo.aspectRatio) && photo.aspectRatio > 0
        ? Math.min(Math.max(photo.aspectRatio, 0.62), 2.3)
        : 1.18;
      const loading = duplicate ? "lazy" : index < 6 ? "eager" : "lazy";
      const fetchPriority = duplicate ? "low" : index < 4 ? "high" : "low";

      return `
        <div class="public-carousel-slide" style="--slide-ratio:${ratio.toFixed(3)}">
          <img src="${escapeHtml(photo.url)}" alt="" loading="${loading}" fetchpriority="${escapeHtml(fetchPriority)}" decoding="async">
        </div>
      `;
    }).join("");

    return `<div class="public-carousel-group"${duplicate ? ' aria-hidden="true"' : ""}>${slides}</div>`;
  }

  async function renderPublicCarousel() {
    if (!publicCarousel || !publicCarouselTrack) {
      return;
    }

    const selectedPhotos = buildCarouselPhotos();

    if (selectedPhotos.length < 5) {
      publicCarousel.hidden = true;
      publicCarouselTrack.innerHTML = "";
      return;
    }

    const enrichedPhotos = await Promise.all(selectedPhotos.map(async (photo) => ({
      ...photo,
      aspectRatio: await measureImageAspectRatio(photo.url),
    })));

    publicCarouselTrack.innerHTML = [
      buildCarouselGroupMarkup(enrichedPhotos, false),
      buildCarouselGroupMarkup(enrichedPhotos, true),
    ].join("");
    publicCarousel.hidden = false;
  }

  function updateLoadMoreButton() {
    if (!publicGalleryActions || !publicGalleryLoadMore) {
      return;
    }

    publicGalleryActions.hidden = true;
    publicGalleryLoadMore.disabled = publicGalleryLoading;
    publicGalleryLoadMore.textContent = publicGalleryLoading
      ? getButtonStateLabel(publicGalleryLoadMore, "loading", "Loading...")
      : getButtonStateLabel(publicGalleryLoadMore, "idle", "Load more");

    if (grid) {
      grid.setAttribute("aria-busy", String(publicGalleryLoading));
    }
  }

  function buildGalleryEmptyState() {
    const isFavorites = publicGalleryState.filter === "favorites";
    const title = isFavorites
      ? translateText("galleryEmptyFavoritesTitle", "No favorites yet.")
      : translateText("galleryEmptyDefaultTitle", "Nothing here yet.");
    const copy = isFavorites
      ? translateText("galleryEmptyFavoritesCopy", "Use the heart button on a preview to save it here.")
      : translateText("galleryEmptyDefaultCopy", "More media may appear as the gallery preview loads.");

    return `
      <div class="gallery-empty-state">
        <p><strong>${escapeHtml(title)}</strong>${escapeHtml(copy)}</p>
      </div>
    `;
  }

  async function renderPublicGallery(photos = [], options = {}) {
    if (!grid) {
      return;
    }

    if (options.append) {
      const fragment = document.createDocumentFragment();
      const startIndex = publicGalleryState.renderedCount - photos.length;

      const visiblePhotos = filterPhotosForCurrentView(photos);
      visiblePhotos.forEach((photo, i) => {
        const temp = document.createElement("div");
        temp.innerHTML = buildCard(photo, startIndex + i);
        const card = temp.firstElementChild;
        if (card) {
          fragment.appendChild(card);
        }
      });
      
      grid.appendChild(fragment);
      updateGalleryOverview(grid.querySelectorAll(".public-card").length);
    } else {
      const displayPhotos = filterPhotosForCurrentView(buildDisplayPhotos());
      grid.innerHTML = displayPhotos.length
        ? displayPhotos.map((photo, index) => buildCard(photo, index)).join("")
        : buildGalleryEmptyState();
      updateGalleryOverview(displayPhotos.length);
    }
    
    enableViewer(grid);

    if (status) {
      status.hidden = true;
      status.textContent = "";
    }

    updateLoadMoreButton();
  }

  function canAutoloadPublicGallery() {
    return publicGalleryState.renderedCount < publicGalleryState.allPhotos.length && !publicGalleryLoading;
  }

  async function loadNextPublicGalleryPage() {
    if (!canAutoloadPublicGallery()) {
      return;
    }

    publicGalleryLoading = true;
    updateLoadMoreButton();

    try {
      const activeTheme = publicGalleryState.theme;
      const start = publicGalleryState.renderedCount;
      const end = Math.min(start + publicGalleryPageSize, publicGalleryState.allPhotos.length);
      const slice = publicGalleryState.allPhotos.slice(start, end);
      const preparedPhotos = await prepareWallPhotos(slice, { shuffle: false });

      if (publicGalleryState.theme !== activeTheme) {
        return;
      }

      const driftApplied = applyDriftClasses(preparedPhotos, start);
      publicGalleryState.photos = [...publicGalleryState.photos, ...driftApplied];
      publicGalleryState.renderedCount = end;
      publicGalleryState.nextCursor = end < publicGalleryState.allPhotos.length ? String(end) : null;
      
      // If it's the first page, we do a full render to handle ads correctly at the top
      // Otherwise we append for smoothness
      if (start === 0 || publicGalleryState.filter !== "all") {
        await renderPublicGallery();
      } else {
        await renderPublicGallery(driftApplied, { append: true });
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.hidden = false;
        status.textContent = error.message || "Unable to load more.";
      }
    } finally {
      publicGalleryLoading = false;
      updateLoadMoreButton();
      maybeAutoloadPublicGallery();
    }
  }

  function isNearPublicGalleryEnd() {
    const scrollRoot = document.documentElement;
    const remaining = scrollRoot.scrollHeight - (window.scrollY + window.innerHeight);
    return remaining <= publicGalleryAutoloadMarginPx;
  }

  function maybeAutoloadPublicGallery() {
    if (!canAutoloadPublicGallery()) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (!canAutoloadPublicGallery()) {
        return;
      }

      if (isNearPublicGalleryEnd()) {
        void loadNextPublicGalleryPage();
      }
    });
  }

  function bindPublicGalleryAutoload() {
    if (!grid) {
      return;
    }

    if (publicGallerySentinel && "IntersectionObserver" in window && !publicGalleryObserver) {
      publicGalleryObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPublicGalleryPage();
        }
      }, {
        root: null,
        rootMargin: `0px 0px ${publicGalleryAutoloadMarginPx}px 0px`,
        threshold: 0,
      });

      publicGalleryObserver.observe(publicGallerySentinel);
    }

    let scrollTimeout;
    const debouncedAutoload = () => {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
      }
      scrollTimeout = window.requestAnimationFrame(maybeAutoloadPublicGallery);
    };

    window.addEventListener("scroll", debouncedAutoload, { passive: true });
    window.addEventListener("resize", debouncedAutoload);
  }

  function buildCard(photo, index) {
    const kind = photo.kind || getMediaKind(photo);
    const layoutClass = photo.wallClass || "square";
    const driftClass = photo.driftClass || DRIFT_CLASSES[index % DRIFT_CLASSES.length];
    const fetchPriority = index < 4 ? "high" : "low";

    const isUserAd = !!photo.isUserAd;
    const isHeroAd = !!photo.isHeroAd;
    const lang = window.MalkokoteLanguage?.getLanguage?.() || "en";
    const userAdLabel = translateText("topKitty", "Top kitty");
    const userName = isUserAd ? (photo.userNames?.[lang] || photo.userNames?.en || "") : "";
    const userDesc = isUserAd ? (photo.userDesc?.[lang] || photo.userDesc?.en || "") : "";
    const label = isUserAd ? `${userAdLabel} ${userName}` : (photo.label || photo.key || translateText("galleryItem", "Gallery item"));
    const favoriteKey = getPhotoIdentity(photo);
    const favoriteMarkup = (!isUserAd && favoriteKey)
      ? `
        <button class="favorite-toggle" type="button" data-favorite-toggle data-favorite-key="${escapeHtml(favoriteKey)}" aria-label="${escapeHtml(`${translateText("saveItem", "Save")} ${label}`)}" aria-pressed="${String(publicGalleryState.favoriteKeys.has(favoriteKey))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.2-9.4-8.2C.5 9.8 1.2 5.6 4.5 4.2 7 3.1 9.4 4.1 12 6.8c2.6-2.7 5-3.7 7.5-2.6 3.3 1.4 4 5.6 1.9 8.6C18.7 16.8 12 21 12 21z"/></svg>
        </button>
      `
      : "";

    if (kind === "movie") {
      return `
        <article class="public-card public-card-${escapeHtml(layoutClass)} ${escapeHtml(driftClass)}${isUserAd ? " user-ad-card" : ""}${isHeroAd ? " is-hero-ad" : ""}">
          <a
            class="public-trigger"
            href="${escapeHtml(photo.url)}"
            ${isUserAd ? 'data-user-ad="true"' : `data-public-trigger
            data-photo-kind="${escapeHtml(kind)}"
            data-photo-label="${escapeHtml(label)}"
            data-photo-key="${escapeHtml(photo.key)}"
            data-photo-src="${escapeHtml(photo.url)}"
            data-photo-backdrop=""`}
            aria-label="${escapeHtml(label)}"
          >
            <div class="public-media">
              <video src="${escapeHtml(photo.url)}" muted loop autoplay playsinline preload="metadata"${isUserAd ? ' style="filter: blur(15px); opacity: 0.8;"' : ""}></video>
              ${isUserAd ? `
                <div class="user-ad-badge" aria-hidden="true">
                  <span class="user-ad-kicker">${escapeHtml(userAdLabel)}</span>
                </div>
                <div class="user-ad-info-container">
                  <span class="user-ad-corner-name">${escapeHtml(userName)}</span>
                  <span class="user-ad-description">${escapeHtml(userDesc)}</span>
                </div>
              ` : '<span class="media-badge" aria-hidden="true">&#9654;</span>'}
            </div>
          </a>
          ${favoriteMarkup}
        </article>
      `;
    }

    const badge = isUserAd 
      ? `
        <div class="user-ad-badge" aria-hidden="true">
          <span class="user-ad-kicker">${escapeHtml(userAdLabel)}</span>
        </div>
        <div class="user-ad-info-container">
          <span class="user-ad-corner-name">${escapeHtml(userName)}</span>
          <span class="user-ad-description">${escapeHtml(userDesc)}</span>
        </div>
      ` 
      : (kind === "gif" ? '<span class="media-badge" aria-hidden="true">GIF</span>' : "");

    return `
      <article class="public-card public-card-${escapeHtml(layoutClass)} ${escapeHtml(driftClass)}${isUserAd ? " user-ad-card" : ""}${isHeroAd ? " is-hero-ad" : ""}">
        <a
          class="public-trigger"
          href="${escapeHtml(photo.url)}"
          ${isUserAd ? 'data-user-ad="true"' : `data-public-trigger
          data-photo-kind="${escapeHtml(kind)}"
          data-photo-label="${escapeHtml(label)}"
          data-photo-key="${escapeHtml(photo.key)}"
          data-photo-src="${escapeHtml(photo.url)}"
          data-photo-backdrop="${escapeHtml(photo.url)}"`}
          aria-label="${escapeHtml(label)}"
        >
          <div class="public-media">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(label)}" loading="${fetchPriority === "high" ? "eager" : "lazy"}" fetchpriority="${escapeHtml(fetchPriority)}" decoding="async"${isUserAd ? ' style="filter: blur(15px); opacity: 0.8;"' : ""}>
            ${badge}
          </div>
        </a>
        ${favoriteMarkup}
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
    const translate = window.MalkokoteLanguage?.translate || ((k) => k);
    viewer.setAttribute("aria-label", translate("galleryViewer") || "Gallery viewer");
    viewer.innerHTML = `
      <div class="public-viewer-backdrop" data-viewer-close></div>
      <button class="public-viewer-close" type="button" aria-label="${escapeHtml(translate("closeViewer") || "Close viewer")}" data-viewer-close>&times;</button>
      <button class="public-viewer-nav public-viewer-nav-prev" type="button" aria-label="${escapeHtml(translate("prevItem") || "Previous item")}" data-viewer-nav="-1">&#10094;</button>
      <button class="public-viewer-nav public-viewer-nav-next" type="button" aria-label="${escapeHtml(translate("nextItem") || "Next item")}" data-viewer-nav="1">&#10095;</button>
      <div class="public-viewer-shell">
        <div class="public-viewer-stage" id="public-viewer-stage">
          <div class="public-viewer-media">
            <img id="public-viewer-image" alt="" hidden>
            <video id="public-viewer-video" playsinline controls muted preload="metadata" hidden></video>
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
          viewerVideo.muted = true;
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
      const trigger = event.target.closest("[data-public-trigger], [data-user-ad]");

      if (!trigger) {
        return;
      }

      if (trigger.dataset.userAd === "true") {
        event.preventDefault();
        openModal();
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
      const activeTheme = publicGalleryState.theme;
      const cachedManifest = getPublicGalleryCache();

      if (cachedManifest) {
        if (publicGalleryState.theme !== activeTheme) {
          return;
        }
        setPublicGalleryManifest(cachedManifest, Number(cachedManifest.fetchedAt) || Date.now());
        await renderPublicCarousel();
        await loadNextPublicGalleryPage();
        maybeAutoloadPublicGallery();
        return;
      }

      const manifest = await fetchPublicManifest(activeTheme);

      if (publicGalleryState.theme !== activeTheme) {
        return;
      }

      setPublicGalleryManifest(manifest, Date.now());
      savePublicGalleryCache();
      await renderPublicCarousel();
      await loadNextPublicGalleryPage();
    } catch (error) {
      console.error(error);
      if (status) {
        status.hidden = false;
        const translate = window.MalkokoteLanguage?.translate || ((k) => k);
        status.textContent = error.message || translate("unableToLoadGallery");
      }
    }
  }

  function openModal() {
    if (!loginModal) {
      return;
    }

    if (window.MalkokoteLanguage?.getLanguage) {
      window.MalkokoteLanguage.applyLanguage(window.MalkokoteLanguage.getLanguage());
    }

    lastFocus = document.activeElement;
    loginModal.setAttribute("aria-hidden", "false");
    setFeedback("");
    loginForm.hidden = false;
    window.setTimeout(() => loginEmailInput?.focus(), 30);
  }

  function closeModal() {
    if (!loginModal) {
      return;
    }

    loginModal.setAttribute("aria-hidden", "true");
    setFeedback("");
    loginSubmit.disabled = false;
    loginSubmit.textContent = getButtonStateLabel(loginSubmit, "idle", "Continue");
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
    loginSubmit.textContent = getButtonStateLabel(loginSubmit, "loading", "Redirecting...");

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
      const galleryWindow = window.open("/gallery/", "_blank", "noopener");
      if (!galleryWindow) {
        window.location.assign("/gallery/");
      }
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "Unable to sign in.");
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = getButtonStateLabel(loginSubmit, "idle", "Continue");
    }
  }

  profileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (currentSession) {
        const galleryWindow = window.open("/gallery/", "_blank", "noopener");
        if (!galleryWindow) {
          window.location.assign("/gallery/");
        }
        return;
      }

      openModal();
    });
  });

  galleryThemeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      dismissThemeInvite();

      const nextTheme = normalizePublicTheme(
        button.dataset.targetTheme || getOppositePublicTheme(publicGalleryState.theme)
      );

      if (nextTheme === publicGalleryState.theme) {
        return;
      }

      applyPublicTheme(nextTheme);

      if (!grid) {
        return;
      }

      dismissViewer();
      resetPublicGalleryState();

      if (status) {
        status.hidden = false;
        const translate = window.MalkokoteLanguage?.translate || ((k) => k);
        status.textContent = nextTheme === "night" ? translate("loadingNight") : translate("loadingDay");
      }

      grid.innerHTML = "";
      await loadPublicGallery();
    });
  });

  modalCloseTriggers.forEach((trigger) => {
    trigger.addEventListener("click", closeModal);
  });

  publicGalleryLoadMore?.addEventListener("click", () => {
    void loadNextPublicGalleryPage();
  });

  galleryFilterButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const nextFilter = button.dataset.galleryFilter || "all";

      if (nextFilter === publicGalleryState.filter) {
        return;
      }

      publicGalleryState.filter = nextFilter;
      updateGalleryFilterButtons();
      await renderPublicGallery();

      if (!grid?.querySelector(".public-card") && canAutoloadPublicGallery() && nextFilter !== "favorites") {
        await loadNextPublicGalleryPage();
      }
    });
  });

  grid?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-favorite-toggle]");

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const favoriteKey = String(button.dataset.favoriteKey || "").trim();

    if (!favoriteKey) {
      return;
    }

    if (publicGalleryState.favoriteKeys.has(favoriteKey)) {
      publicGalleryState.favoriteKeys.delete(favoriteKey);
    } else {
      publicGalleryState.favoriteKeys.add(favoriteKey);
    }

    saveFavoriteKeys();

    grid.querySelectorAll("[data-favorite-key]").forEach((toggle) => {
      if (toggle.dataset.favoriteKey === favoriteKey) {
        toggle.setAttribute("aria-pressed", String(publicGalleryState.favoriteKeys.has(favoriteKey)));
      }
    });

    if (publicGalleryState.filter === "favorites") {
      await renderPublicGallery();
    } else {
      updateGalleryOverview(grid.querySelectorAll(".public-card").length);
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

  applyPublicTheme("day", { persist: false });
  publicGalleryState.favoriteKeys = readFavoriteKeys();
  updateGalleryFilterButtons();
  updateGalleryOverview();
  
  // Scroll To Top Button logic
  const scrollToTopBtn = document.createElement("button");
  scrollToTopBtn.className = "scroll-to-top";
  scrollToTopBtn.setAttribute("aria-label", translateText("scrollToTop", "Scroll to top"));
  scrollToTopBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
  document.body.appendChild(scrollToTopBtn);

  window.addEventListener("malkokote:languagechange", () => {
    scrollToTopBtn.setAttribute("aria-label", translateText("scrollToTop", "Scroll to top"));
    updateProfileButtons();
    updateGalleryOverview(grid?.querySelectorAll(".public-card").length ?? null);

    if (grid?.querySelector(".public-card")) {
      void renderPublicGallery();
    }
  });

  window.addEventListener("scroll", () => {
    if (window.scrollY > 450) {
      scrollToTopBtn.classList.add("is-visible");
    } else {
      scrollToTopBtn.classList.remove("is-visible");
    }
  }, { passive: true });

  window.addEventListener("resize", positionThemeInvite, { passive: true });

  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  await window.MalkokoteAgeGate?.waitForAccess?.();
  showThemeInvite();
  bindPublicGalleryAutoload();
  await Promise.all([refreshSession(), loadPublicGallery()]);
});
