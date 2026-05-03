# Backend Infrastructure

Terraform for the Malkokote production gallery backend lives here.

## What This Stack Creates

- private gallery S3 bucket
- CloudFront distribution in front of the gallery bucket
- Cognito user pool, app client, and Hosted UI domain
- public static manifest JSON files rebuilt on S3 upload and delete
- JWT-protected gallery manifest API through API Gateway for the extra gallery
- Lambda that reads prebuilt manifest metadata and mints signed CloudFront URLs

## Access Model

1. The browser signs in with Cognito Hosted UI in a popup.
2. The callback page exchanges the code for tokens and closes the popup.
3. The homepage downloads `/_manifests/public/day.json` or `/_manifests/public/night.json` through CloudFront.
4. S3 upload and delete events rebuild the public and extra manifest files automatically.
5. The private gallery calls `GET /api/gallery/extra-manifest` through CloudFront with the Cognito ID token.
6. API Gateway validates the JWT for the private route.
7. Lambda reads the prebuilt extra manifest metadata and returns signed CloudFront URLs.
8. CloudFront serves `/public/*` without signing and `/extra/*` only when the signature is valid.

## Gallery Layout

This stack is built around two prefixes in the same private gallery bucket:

- `public/` for the public showcase shown on the main website
- `extra/` for the paid member gallery behind Cognito

## Required tfvars Values

Current production values:

```hcl
site_name              = "Malkokote"
project_slug           = "malkokote-gallery"
environment            = "prod"
aws_region             = "eu-central-1"
website_base_url       = "https://www.malkokote.com"
local_callback_url     = "http://localhost:8000/auth/callback.html"
cognito_domain_prefix  = "malkokote-gallery-prod"
gallery_public_prefix  = "public"
gallery_extra_prefix   = "extra"

auth_callback_urls = [
  "https://www.malkokote.com/auth/callback.html",
  "http://localhost:8000/auth/callback.html"
]

auth_logout_urls = [
  "https://www.malkokote.com/",
  "http://localhost:8000/"
]

gallery_api_allowed_origins = [
  "https://www.malkokote.com",
  "http://localhost:8000"
]

gallery_cache_version                    = "v1"
gallery_public_manifest_cache_ttl_seconds = 60
gallery_signed_url_ttl_seconds           = 31536000
price_class                              = "PriceClass_100"

tags = {
  Site  = "malkokote.com"
  Stack = "gallery"
}
```

Important:

- `gallery_public_base_url` must stay as the viewer-facing CloudFront URL
- you do not know that URL until after the first apply
- for the first apply, leave the placeholder from the example and then replace it with the actual output and apply a second time

Current command flow:

```bash
cd /Users/privileged/Projects/malkokote/pnp/app/backend/live/prod
terraform init
terraform apply
terraform apply
```

## After Apply

Copy these Terraform outputs into [config/site-config.js](/Users/privileged/Projects/malkokote/pnp/config/site-config.js):

- `cognito_hosted_ui_base_url` -> `authBaseUrl`
- `cognito_app_client_id` -> `authClientId`
- `gallery_cloudfront_domain_name` -> `galleryBaseUrl` as `https://<output>`

Those are already set in the live site config now.

## Media Layout

Public gallery:

```text
public/
  0.jpg
  1.jpg
  11.jpg
  clip.mp4
  animation.gif
  hero/
    ad-1.mp4
  day/
    0.jpg
    1.jpg
    hero/
      promo.jpg
```

Paid gallery:

```text
extra/
  0.jpg
  1.webm
  2.gif
```

The Lambda automatically supports:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.avif`
- `.gif`
- `.mp4`
- `.mov`
- `.m4v`
- `.webm`

## Static Manifest Paths

- `/_manifests/public/day.json`
- `/_manifests/public/night.json`

Those files are generated automatically by the S3-triggered manifest builder and are cached briefly at CloudFront. Public media under `/public/*` is served directly from CloudFront with long-lived immutable caching.

## Cleanup

From the repo root:

```bash
cd /Users/privileged/Projects/malkokote/pnp
./cleanup.sh
```

Use `./cleanup.sh --yes` to skip the prompt.
