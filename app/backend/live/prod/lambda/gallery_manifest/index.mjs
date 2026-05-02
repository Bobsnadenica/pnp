import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
const defaultCacheVersion = normalizeCacheVersion(process.env.GALLERY_CACHE_VERSION || "v1");
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

async function listGalleryKeys(prefix) {
  const keys = [];
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
        keys.push(item.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys.sort((left, right) => compareGalleryKeys(left, right));
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

function isHeroKey(key) {
  return key.startsWith(publicHeroPrefix);
}

function isDayKey(key) {
  return key.startsWith(`${publicDayPrefix}/`);
}

function isDayHeroKey(key) {
  return key.startsWith(publicDayHeroPrefix);
}

function selectPublicThemeKeys(keys, theme) {
  if (theme === "night") {
    return {
      regularKeys: keys.filter((key) => !isHeroKey(key) && !isDayKey(key)),
      heroKeys: keys.filter((key) => isHeroKey(key)),
    };
  }

  return {
    regularKeys: keys.filter((key) => isDayKey(key) && !isDayHeroKey(key)),
    heroKeys: keys.filter((key) => isDayHeroKey(key)),
  };
}

async function buildSignedMedia(key, expiresAtEpochSeconds, cacheVersion) {
  const signedUrl = new URL(`${publicBaseUrl}/${encodePathSegments(key)}`);

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
    key,
    label: buildLabel(key),
    kind: getMediaKind(key),
    url: signedUrl.toString(),
  };
}

function getStableExpiryEpochSeconds() {
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil(now / signedUrlTtlSeconds) * signedUrlTtlSeconds;
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
    const refreshToken = sanitizeOptionalCacheVersion(event?.queryStringParameters?.refresh || "");
    const cacheVersion = refreshToken
      ? `${defaultCacheVersion}.${refreshToken}`
      : defaultCacheVersion;

    if (!isPublicManifest && claims.token_use !== "id") {
      return json(403, {
        error: "Gallery manifest requests must use a Cognito ID token.",
      });
    }

    const prefix = isPublicManifest ? publicPrefix : extraPrefix;
    const keys = await listGalleryKeys(prefix);
    const publicThemeKeys = isPublicManifest
      ? selectPublicThemeKeys(keys, publicTheme)
      : { regularKeys: keys, heroKeys: [] };
    const regularKeys = publicThemeKeys.regularKeys;
    const heroKeys = publicThemeKeys.heroKeys;
    const pageKeys = regularKeys.slice(cursorOffset, cursorOffset + requestedLimit);
    const nextCursor = cursorOffset + pageKeys.length < regularKeys.length
      ? String(cursorOffset + pageKeys.length)
      : null;
    const expiresAtEpochSeconds = getStableExpiryEpochSeconds();
    const photos = [];
    const heroPhotos = [];

    for (const key of pageKeys) {
      photos.push(await buildSignedMedia(key, expiresAtEpochSeconds, cacheVersion));
    }

    for (const key of heroKeys) {
      heroPhotos.push(await buildSignedMedia(key, expiresAtEpochSeconds, cacheVersion));
    }

    return json(200, {
      collection: isPublicManifest ? `public-${publicTheme}` : "extra",
      prefix,
      theme: publicTheme,
      total: regularKeys.length,
      count: photos.length,
      limit: requestedLimit,
      cursor: cursorOffset ? String(cursorOffset) : null,
      nextCursor,
      heroCount: heroPhotos.length,
      expiresAt: expiresAtEpochSeconds,
      cacheTtlSeconds: signedUrlTtlSeconds,
      cacheVersion,
      user: {
        email: isPublicManifest ? null : claims.email || null,
      },
      photos,
      heroPhotos,
    });
  } catch (error) {
    console.error("Unable to build gallery manifest.", error);
    return json(500, {
      error: "Unable to load the gallery right now.",
    });
  }
};
