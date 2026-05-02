import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const kms = new KMSClient({});
const s3 = new S3Client({});

const bucketName = process.env.GALLERY_BUCKET;
const publicPrefix = normalizePrefix(process.env.GALLERY_PUBLIC_PREFIX || "public");
const extraPrefix = normalizePrefix(process.env.GALLERY_EXTRA_PREFIX || "extra");
const publicDayPrefix = `${publicPrefix}/day`;
const publicHeroPrefix = `${publicPrefix}/hero/`;
const publicDayHeroPrefix = `${publicDayPrefix}/hero/`;
const publicBaseUrl = (process.env.GALLERY_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const signerKeyPairId = process.env.GALLERY_SIGNER_KEY_PAIR_ID || "";
const signerKmsKeyId = process.env.GALLERY_SIGNER_KMS_KEY_ID || "";
const manifestPrefix = normalizePrefix(process.env.GALLERY_MANIFEST_PREFIX || "_manifests");
const publicDayManifestKey = process.env.GALLERY_PUBLIC_DAY_MANIFEST_KEY || `${manifestPrefix}/public/day.json`;
const publicNightManifestKey = process.env.GALLERY_PUBLIC_NIGHT_MANIFEST_KEY || `${manifestPrefix}/public/night.json`;
const extraManifestKey = process.env.GALLERY_EXTRA_MANIFEST_KEY || `${manifestPrefix}/private/extra.json`;
const defaultCacheVersion = normalizeCacheVersion(process.env.GALLERY_CACHE_VERSION || "v1");
const publicManifestCacheTtlSeconds = parsePositiveInteger(process.env.GALLERY_PUBLIC_MANIFEST_CACHE_TTL || "60", 60);
const minimumSignedUrlTtlSeconds = 365 * 24 * 60 * 60;
const configuredSignedUrlTtlSeconds = Number.parseInt(process.env.GALLERY_SIGNED_URL_TTL || "31536000", 10);
const signedUrlTtlSeconds = Number.isFinite(configuredSignedUrlTtlSeconds)
  ? Math.max(configuredSignedUrlTtlSeconds, minimumSignedUrlTtlSeconds)
  : minimumSignedUrlTtlSeconds;
const mediaExtensionPattern = /\.(avif|gif|jpe?g|m4v|mov|mp4|png|webm|webp)$/i;
const defaultManifestLimit = 72;
const maximumManifestLimit = 100;

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

function sanitizeOptionalCacheVersion(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 64);

  return normalized || "";
}

function parseManifestLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsed)) {
    return defaultManifestLimit;
  }

  return Math.min(Math.max(parsed, 1), maximumManifestLimit);
}

function parseCursorOffset(value) {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function normalizePublicTheme(value) {
  return String(value || "").trim().toLowerCase() === "night" ? "night" : "day";
}

function shouldReturnFullManifest(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
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

function toCloudFrontSafeBase64(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/=/g, "_")
    .replace(/\//g, "~");
}

function encodePathSegments(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCannedPolicy(resourceUrl, expiresAtEpochSeconds) {
  return JSON.stringify({
    Statement: [
      {
        Resource: resourceUrl,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": expiresAtEpochSeconds,
          },
        },
      },
    ],
  });
}

async function signPolicy(policy) {
  const response = await kms.send(
    new SignCommand({
      KeyId: signerKmsKeyId,
      Message: Buffer.from(policy, "utf8"),
      MessageType: "RAW",
      SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
    })
  );

  if (!response.Signature) {
    throw new Error("KMS did not return a CloudFront signature.");
  }

  return toCloudFrontSafeBase64(response.Signature);
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
  return [defaultCacheVersion, sanitizeOptionalCacheVersion(cacheToken)]
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
    public: {
      day: publicDayManifest,
      night: publicNightManifest,
    },
    extra: extraManifest,
  };
}

async function readJsonObject(key) {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error) {
    const code = String(error?.name || error?.Code || "");

    if (code === "NoSuchKey" || code === "NotFound" || code === "NoSuchBucket") {
      return null;
    }

    throw error;
  }
}

async function getPublicManifest(theme) {
  const key = theme === "night" ? publicNightManifestKey : publicDayManifestKey;
  const manifest = await readJsonObject(key);

  if (manifest) {
    return manifest;
  }

  const rebuilt = await rebuildAndPersistManifests();
  return rebuilt.public[theme];
}

async function getExtraManifest() {
  const manifest = await readJsonObject(extraManifestKey);

  if (manifest) {
    return manifest;
  }

  const rebuilt = await rebuildAndPersistManifests();
  return rebuilt.extra;
}

function composeSignedCacheVersion(itemCacheToken, refreshToken) {
  return [
    defaultCacheVersion,
    sanitizeOptionalCacheVersion(itemCacheToken),
    sanitizeOptionalCacheVersion(refreshToken),
  ].filter(Boolean).join(".");
}

async function buildSignedMedia(item, expiresAtEpochSeconds, refreshToken) {
  const signedUrl = new URL(`${publicBaseUrl}/${encodePathSegments(item.key)}`);
  const cacheVersion = composeSignedCacheVersion(item.cacheToken, refreshToken);

  if (cacheVersion) {
    signedUrl.searchParams.set("v", cacheVersion);
  }

  const policy = buildCannedPolicy(signedUrl.toString(), expiresAtEpochSeconds);
  const signature = await signPolicy(policy);

  signedUrl.searchParams.set("Expires", String(expiresAtEpochSeconds));
  signedUrl.searchParams.set("Signature", signature);
  signedUrl.searchParams.set("Key-Pair-Id", signerKeyPairId);
  signedUrl.searchParams.set("Hash-Algorithm", "SHA256");

  return {
    ...item,
    url: signedUrl.toString(),
  };
}

function getStableExpiryEpochSeconds() {
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil(now / signedUrlTtlSeconds) * signedUrlTtlSeconds;
}

function paginatePhotos(photos, limit, cursorOffset) {
  const pagePhotos = photos.slice(cursorOffset, cursorOffset + limit);
  const nextCursor = cursorOffset + pagePhotos.length < photos.length
    ? String(cursorOffset + pagePhotos.length)
    : null;

  return {
    pagePhotos,
    nextCursor,
  };
}

export const handler = async (event) => {
  try {
    if (!bucketName || !publicBaseUrl || !signerKeyPairId || !signerKmsKeyId) {
      return json(500, {
        error: "Gallery manifest backend is missing required configuration.",
      });
    }

    const path = event?.requestContext?.http?.path || event?.rawPath || "";
    const isPublicManifest = path.endsWith("/public-manifest");
    const claims = event?.requestContext?.authorizer?.jwt?.claims || {};
    const requestedLimit = parseManifestLimit(event?.queryStringParameters?.limit);
    const cursorOffset = parseCursorOffset(event?.queryStringParameters?.cursor);
    const publicTheme = isPublicManifest
      ? normalizePublicTheme(event?.queryStringParameters?.theme)
      : null;
    const returnFullManifest = isPublicManifest
      ? shouldReturnFullManifest(event?.queryStringParameters?.full)
      : false;
    const refreshToken = sanitizeOptionalCacheVersion(event?.queryStringParameters?.refresh || "");

    if (!isPublicManifest && claims.token_use !== "id") {
      return json(403, {
        error: "Gallery manifest requests must use a Cognito ID token.",
      });
    }

    if (isPublicManifest) {
      const manifest = await getPublicManifest(publicTheme);
      const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
      const heroPhotos = Array.isArray(manifest?.heroPhotos) ? manifest.heroPhotos : [];

      if (returnFullManifest) {
        return json(200, {
          collection: manifest?.collection || `public-${publicTheme}`,
          prefix: manifest?.prefix || publicPrefix,
          theme: publicTheme,
          total: photos.length,
          count: photos.length,
          limit: photos.length,
          cursor: null,
          nextCursor: null,
          heroCount: heroPhotos.length,
          generatedAt: manifest?.generatedAt || null,
          cacheVersion: manifest?.cacheVersion || defaultCacheVersion,
          photos,
          heroPhotos,
        });
      }

      const { pagePhotos, nextCursor } = paginatePhotos(photos, requestedLimit, cursorOffset);

      return json(200, {
        collection: manifest?.collection || `public-${publicTheme}`,
        prefix: manifest?.prefix || publicPrefix,
        theme: publicTheme,
        total: photos.length,
        count: pagePhotos.length,
        limit: requestedLimit,
        cursor: cursorOffset ? String(cursorOffset) : null,
        nextCursor,
        heroCount: heroPhotos.length,
        generatedAt: manifest?.generatedAt || null,
        cacheVersion: manifest?.cacheVersion || defaultCacheVersion,
        photos: pagePhotos,
        heroPhotos,
      });
    }

    const manifest = await getExtraManifest();
    const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
    const { pagePhotos, nextCursor } = paginatePhotos(photos, requestedLimit, cursorOffset);
    const expiresAtEpochSeconds = getStableExpiryEpochSeconds();
    const signedPhotos = [];

    for (const item of pagePhotos) {
      signedPhotos.push(await buildSignedMedia(item, expiresAtEpochSeconds, refreshToken));
    }

    return json(200, {
      collection: manifest?.collection || "extra",
      prefix: manifest?.prefix || extraPrefix,
      total: photos.length,
      count: signedPhotos.length,
      limit: requestedLimit,
      cursor: cursorOffset ? String(cursorOffset) : null,
      nextCursor,
      generatedAt: manifest?.generatedAt || null,
      expiresAt: expiresAtEpochSeconds,
      cacheTtlSeconds: signedUrlTtlSeconds,
      cacheVersion: manifest?.cacheVersion || defaultCacheVersion,
      user: {
        email: claims.email || null,
      },
      photos: signedPhotos,
      heroPhotos: [],
    });
  } catch (error) {
    console.error("Unable to build gallery manifest.", error);
    return json(500, {
      error: "Unable to load the gallery right now.",
    });
  }
};
