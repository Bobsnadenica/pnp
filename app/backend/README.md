# Backend Infrastructure

Terraform for the Malkokote production gallery backend lives here.

## What This Stack Creates

- private gallery S3 bucket
- CloudFront distribution in front of the gallery bucket
- Cognito user pool, app client, and Hosted UI domain
- JWT-protected gallery manifest API through API Gateway
- Lambda that lists allowed objects and mints signed CloudFront URLs
- WAF rules attached to Cognito for burst protection and hidden CAPTCHA

## Access Model

1. The browser signs in with Cognito Hosted UI in a popup.
2. The callback page exchanges the code for tokens and closes the popup.
3. The homepage calls `GET /api/gallery/public-manifest` through CloudFront.
4. The private gallery calls `GET /api/gallery/extra-manifest` through CloudFront with the Cognito ID token.
5. API Gateway validates the JWT for the private route.
6. Lambda lists media under the correct prefix and returns signed CloudFront URLs.
7. CloudFront serves objects only when the signature is valid.

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
gallery_signed_url_ttl_seconds           = 31536000
cognito_login_captcha_rate_limit         = 10
cognito_login_captcha_evaluation_window_sec = 60
cognito_login_captcha_immunity_time_sec  = 900
cognito_login_timeout_rate_limit         = 25
cognito_login_timeout_evaluation_window_sec = 300
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

## Cleanup

From the repo root:

```bash
cd /Users/privileged/Projects/malkokote/pnp
./cleanup.sh
```

Use `./cleanup.sh --yes` to skip the prompt.
