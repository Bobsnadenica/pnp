document.addEventListener("DOMContentLoaded", async () => {
  const shell = document.querySelector(".ambient-background");
  const target = document.querySelector("[data-ambient-background]");
  const config = window.__PRIVATE_GALLERY_CONFIG__ || {};
  const siteLabel = config.projectSlug || "malkokote-gallery";
  const publicGalleryCacheKey = `${siteLabel}:public-gallery-cache`;
  const ambientBackgroundCacheKey = `${siteLabel}:ambient-background-cache`;

  if (!shell || !target) {
    return;
  }

  const galleryBaseUrl = String(config.galleryBaseUrl || "").replace(/\/+$/, "");

  if (!galleryBaseUrl) {
    return;
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
    const expiresAt = Number.parseInt(String(cache?.expiresAt || "0"), 10);
    return Array.isArray(cache?.photos) && expiresAt * 1000 > Date.now();
  }

  function saveCache(manifest) {
    try {
      localStorage.setItem(ambientBackgroundCacheKey, JSON.stringify({
        photos: manifest?.photos || [],
        heroPhotos: manifest?.heroPhotos || [],
        expiresAt: manifest?.expiresAt || 0,
      }));
    } catch {}
  }

  async function fetchManifestPage(limit, cursor = null) {
    const requestUrl = new URL(`${galleryBaseUrl}/api/gallery/public-manifest`);
    requestUrl.searchParams.set("limit", String(limit));

    if (cursor !== null) {
      requestUrl.searchParams.set("cursor", String(cursor));
    }

    const response = await fetch(requestUrl.toString(), { cache: "no-store" });
    const manifest = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(manifest?.error || "Unable to load background media.");
    }

    return manifest;
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

  try {
    const cachedPublicManifest = readCache(publicGalleryCacheKey);
    const cachedAmbientManifest = readCache(ambientBackgroundCacheKey);
    const cachedManifest = isCacheFresh(cachedPublicManifest)
      ? cachedPublicManifest
      : isCacheFresh(cachedAmbientManifest)
        ? cachedAmbientManifest
        : null;

    if (cachedManifest && applyBackground(selectImageCandidate(cachedManifest))) {
      return;
    }

    const manifest = await fetchManifestPage(18);
    saveCache(manifest);
    const selected = selectImageCandidate(manifest);

    applyBackground(selected);
  } catch (error) {
    console.error(error);
  }
});
