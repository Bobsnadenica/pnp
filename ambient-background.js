document.addEventListener("DOMContentLoaded", async () => {
  const shell = document.querySelector(".ambient-background");
  const target = document.querySelector("[data-ambient-background]");
  const config = window.__PRIVATE_GALLERY_CONFIG__ || {};
  const siteLabel = config.projectSlug || "malkokote-gallery";
  const publicGalleryThemeStorageKey = `${siteLabel}:gallery-theme`;
  const publicGalleryManifestCacheTtlMs = 5 * 60 * 1000;

  if (!shell || !target) {
    return;
  }

  const galleryBaseUrl = String(config.galleryBaseUrl || "").replace(/\/+$/, "");

  if (!galleryBaseUrl) {
    return;
  }

  function normalizePublicTheme(value) {
    return String(value || "").trim().toLowerCase() === "night" ? "night" : "day";
  }

  function getPublicGalleryCacheKey(theme) {
    return `${siteLabel}:public-gallery-cache:${normalizePublicTheme(theme)}`;
  }

  function getAmbientBackgroundCacheKey(theme) {
    return `${siteLabel}:ambient-background-cache:${normalizePublicTheme(theme)}`;
  }

  function getCurrentTheme() {
    return "day";
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

  function pickRandomItem(items) {
    if (!items.length) {
      return null;
    }

    return items[Math.floor(Math.random() * items.length)] || null;
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isCacheFresh(cache) {
    return Array.isArray(cache?.photos)
      && Number.isFinite(Number(cache?.fetchedAt))
      && Number(cache.fetchedAt) + publicGalleryManifestCacheTtlMs > Date.now();
  }

  function saveCache(theme, manifest, fetchedAt = Date.now()) {
    try {
      localStorage.setItem(getAmbientBackgroundCacheKey(theme), JSON.stringify({
        theme: normalizePublicTheme(theme),
        photos: manifest?.photos || [],
        heroPhotos: manifest?.heroPhotos || [],
        fetchedAt,
      }));
    } catch {}
  }

  function buildPublicManifestStaticUrl(theme) {
    return `${galleryBaseUrl}/_manifests/public/${normalizePublicTheme(theme)}.json`;
  }

  function buildPublicManifestFallbackUrl(theme) {
    const requestUrl = new URL(`${galleryBaseUrl}/api/gallery/public-manifest`);
    requestUrl.searchParams.set("theme", normalizePublicTheme(theme));
    requestUrl.searchParams.set("full", "1");
    return requestUrl.toString();
  }

  async function fetchManifest(theme) {
    try {
      const staticResponse = await fetch(buildPublicManifestStaticUrl(theme), { cache: "default" });

      if (staticResponse.ok) {
        const manifest = await staticResponse.json().catch(() => null);

        if (!manifest) {
          throw new Error("Unable to parse background media.");
        }

        return manifest;
      }
    } catch (error) {
      console.warn("Static ambient manifest fetch failed, falling back to API.", error);
    }

    const fallbackResponse = await fetch(buildPublicManifestFallbackUrl(theme), { cache: "no-store" });
    const fallbackManifest = await fallbackResponse.json().catch(() => null);

    if (!fallbackResponse.ok) {
      throw new Error(fallbackManifest?.error || "Unable to load background media.");
    }

    return fallbackManifest;
  }

  function selectImageCandidate(manifest) {
    const candidates = [...(manifest?.photos || []), ...(manifest?.heroPhotos || [])]
      .filter((photo) => getMediaKind(photo) === "picture");

    return pickRandomItem(candidates);
  }

  function applyBackground(photo) {
    if (!photo?.url) {
      return false;
    }

    target.style.setProperty("--ambient-image", `url("${String(photo.url).replace(/"/g, '\\"')}")`);
    shell.classList.add("is-loaded");
    return true;
  }

  async function loadAmbientBackground(theme) {
    const normalizedTheme = normalizePublicTheme(theme);

    document.body.dataset.galleryTheme = normalizedTheme;
    shell.classList.remove("is-loaded");

    const cachedPublicManifest = readCache(getPublicGalleryCacheKey(normalizedTheme));
    const cachedAmbientManifest = readCache(getAmbientBackgroundCacheKey(normalizedTheme));
    const cachedManifest = isCacheFresh(cachedPublicManifest)
      ? cachedPublicManifest
      : isCacheFresh(cachedAmbientManifest)
        ? cachedAmbientManifest
        : null;

    if (cachedManifest && applyBackground(selectImageCandidate(cachedManifest))) {
      return;
    }

    const fetchedAt = Date.now();
    const manifest = await fetchManifest(normalizedTheme);
    saveCache(normalizedTheme, manifest, fetchedAt);
    applyBackground(selectImageCandidate(manifest));
  }

  try {
    await loadAmbientBackground(getCurrentTheme());
  } catch (error) {
    console.error(error);
  }

  window.addEventListener("malkokote:themechange", async (event) => {
    try {
      await loadAmbientBackground(normalizePublicTheme(event.detail?.theme));
    } catch (error) {
      console.error(error);
    }
  });
});
