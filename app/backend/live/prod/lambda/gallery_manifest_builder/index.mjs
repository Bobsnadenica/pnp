import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

const bucketName = process.env.GALLERY_BUCKET;
const publicPrefix = normalizePrefix(process.env.GALLERY_PUBLIC_PREFIX || "public");
const extraPrefix = normalizePrefix(process.env.GALLERY_EXTRA_PREFIX || "extra");
const publicDayPrefix = `${publicPrefix}/day`;
const publicHeroPrefix = `${publicPrefix}/hero/`;
const publicDayHeroPrefix = `${publicDayPrefix}/hero/`;
const publicBaseUrl = (process.env.GALLERY_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const manifestPrefix = normalizePrefix(process.env.GALLERY_MANIFEST_PREFIX || "_manifests");
const publicDayManifestKey = process.env.GALLERY_PUBLIC_DAY_MANIFEST_KEY || `${manifestPrefix}/public/day.json`;
const publicNightManifestKey = process.env.GALLERY_PUBLIC_NIGHT_MANIFEST_KEY || `${manifestPrefix}/public/night.json`;
const extraManifestKey = process.env.GALLERY_EXTRA_MANIFEST_KEY || `${manifestPrefix}/private/extra.json`;
const defaultCacheVersion = normalizeCacheVersion(process.env.GALLERY_CACHE_VERSION || "v1");
const publicManifestCacheTtlSeconds = parsePositiveInteger(process.env.GALLERY_PUBLIC_MANIFEST_CACHE_TTL || "60", 60);
const mediaExtensionPattern = /\.(avif|gif|jpe?g|m4v|mov|mp4|png|webm|webp)$/i;

function normalizePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeCacheVersion(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 64);

  return normalized || "v1";
}

function encodePathSegments(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function compareGalleryKeys(left, right) {
  const leftName = left.split("/").pop() || left;
  const rightName = right.split("/").pop() || right;
  const leftNumber = Number.parseInt(leftName, 10);
  const rightNumber = Number.parseInt(rightName, 10);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);

  if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: "base" });
}

function buildLabel(key) {
  const filename = key.split("/").pop() || key;
  return filename.replace(/\.[^.]+$/, "");
}

function sanitizeCacheToken(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96);
}

function buildCacheToken(item) {
  const etag = String(item?.ETag || "")
    .replace(/"/g, "")
    .trim();
  const lastModified = item?.LastModified
    ? new Date(item.LastModified).getTime().toString(36)
    : "";
  const token = sanitizeCacheToken([etag, lastModified].filter(Boolean).join("-"));
  return token || "asset";
}

function getMediaKind(key) {
  if (/\.gif$/i.test(key)) {
    return "gif";
  }

  if (/\.(m4v|mov|mp4|webm)$/i.test(key)) {
    return "movie";
  }

  return "picture";
}

async function listGalleryItems(prefix) {
  const items = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of response.Contents || []) {
      if (item.Key && !item.Key.endsWith("/") && mediaExtensionPattern.test(item.Key)) {
        items.push({
          key: item.Key,
          label: buildLabel(item.Key),
          kind: getMediaKind(item.Key),
          cacheToken: buildCacheToken(item),
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return items.sort((left, right) => compareGalleryKeys(left.key, right.key));
}

function buildPublicCacheVersion(cacheToken) {
  return [defaultCacheVersion, sanitizeCacheToken(cacheToken)]
    .filter(Boolean)
    .join(".");
}

function buildPublicMediaUrl(key, cacheToken) {
  const publicUrl = new URL(`${publicBaseUrl}/${encodePathSegments(key)}`);
  const cacheVersion = buildPublicCacheVersion(cacheToken);

  if (cacheVersion) {
    publicUrl.searchParams.set("v", cacheVersion);
  }

  return publicUrl.toString();
}

function isHeroKey(key) {
  return key.startsWith(publicHeroPrefix);
}

function isDayKey(key) {
  return key.startsWith(`${publicDayPrefix}/`);
}

function isDayHeroKey(key) {
  return key.startsWith(publicDayHeroPrefix);
}

function selectPublicThemeItems(items, theme) {
  if (theme === "night") {
    return {
      regularItems: items.filter((item) => !isHeroKey(item.key) && !isDayKey(item.key)),
      heroItems: items.filter((item) => isHeroKey(item.key)),
    };
  }

  return {
    regularItems: items.filter((item) => isDayKey(item.key) && !isDayHeroKey(item.key)),
    heroItems: items.filter((item) => isDayHeroKey(item.key)),
  };
}

function buildPublicManifest(theme, items) {
  const generatedAt = new Date().toISOString();
  const selected = selectPublicThemeItems(items, theme);
  const photos = selected.regularItems.map((item) => ({
    ...item,
    url: buildPublicMediaUrl(item.key, item.cacheToken),
  }));
  const heroPhotos = selected.heroItems.map((item) => ({
    ...item,
    url: buildPublicMediaUrl(item.key, item.cacheToken),
  }));

  return {
    collection: `public-${theme}`,
    prefix: publicPrefix,
    theme,
    total: photos.length,
    heroCount: heroPhotos.length,
    generatedAt,
    cacheVersion: defaultCacheVersion,
    photos,
    heroPhotos,
  };
}

function buildExtraManifest(items) {
  return {
    collection: "extra",
    prefix: extraPrefix,
    total: items.length,
    generatedAt: new Date().toISOString(),
    cacheVersion: defaultCacheVersion,
    photos: items,
  };
}

async function writeManifestObject(key, body) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(body),
      ContentType: "application/json; charset=utf-8",
      CacheControl: `public, max-age=${publicManifestCacheTtlSeconds}, stale-while-revalidate=600`,
    })
  );
}

async function rebuildAndPersistManifests() {
  const [publicItems, extraItems] = await Promise.all([
    listGalleryItems(publicPrefix),
    listGalleryItems(extraPrefix),
  ]);
  const publicDayManifest = buildPublicManifest("day", publicItems);
  const publicNightManifest = buildPublicManifest("night", publicItems);
  const extraManifest = buildExtraManifest(extraItems);

  await Promise.all([
    writeManifestObject(publicDayManifestKey, publicDayManifest),
    writeManifestObject(publicNightManifestKey, publicNightManifest),
    writeManifestObject(extraManifestKey, extraManifest),
  ]);

  return {
    publicDay: publicDayManifest.total,
    publicNight: publicNightManifest.total,
    extra: extraManifest.total,
  };
}

export const handler = async () => {
  if (!bucketName || !publicBaseUrl) {
    throw new Error("Manifest builder is missing required configuration.");
  }

  const totals = await rebuildAndPersistManifests();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ok: true,
      totals,
    }),
  };
};
