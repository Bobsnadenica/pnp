document.addEventListener("DOMContentLoaded", async () => {
  const shell = document.querySelector(".ambient-background");
  const target = document.querySelector("[data-ambient-background]");
  const config = window.__PRIVATE_GALLERY_CONFIG__ || {};

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
      .filter((photo) => getMediaKind(photo) !== "movie");

    return pickRandomItem(candidates);
  }

  try {
    await window.MalkokoteAgeGate?.waitForAccess?.();

    const summary = await fetchManifestPage(1);
    const total = Number.parseInt(String(summary?.total || "0"), 10) || 0;
    const windowSize = 12;
    const maxStart = Math.max(0, total - windowSize);
    const randomStart = maxStart > 0 ? Math.floor(Math.random() * (maxStart + 1)) : 0;
    const detailManifest = total > 1 ? await fetchManifestPage(windowSize, randomStart) : summary;
    const selected = selectImageCandidate(detailManifest) || selectImageCandidate(summary);

    if (!selected?.url) {
      return;
    }

    target.style.setProperty("--ambient-image", `url("${String(selected.url).replace(/"/g, '\\"')}")`);
    shell.classList.add("is-loaded");
  } catch (error) {
    console.error(error);
  }
});
