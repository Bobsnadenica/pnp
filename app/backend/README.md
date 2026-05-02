# Backend Infrastructure

Terraform for the isolated [NEW_SITE_NAME] private gallery backend lives here.

This stack is intentionally separate from Everyday Lilly. It reuses the same architecture, but uses new resource names, a new Cognito domain prefix, its own buckets, its own CloudFront distribution, and its own Lambda/API/WAF resources.

## What This Stack Creates

- archive S3 bucket for long-term storage
- private gallery S3 bucket
- CloudFront distribution in front of the gallery bucket
- Cognito user pool, app client, and Hosted UI domain
- JWT-protected gallery manifest API through API Gateway
- Lambda that lists allowed objects and mints signed CloudFront URLs
- WAF rules attached to Cognito for burst protection and hidden CAPTCHA

## Access Model

1. The browser signs in with Cognito Hosted UI in a popup.
2. The callback page exchanges the code for tokens and closes the popup.
3. The gallery page calls `GET /api/gallery/manifest` through CloudFront with the Cognito ID token.
4. API Gateway validates the JWT.
5. Lambda decides which prefix the user is allowed to access.
6. Lambda lists media under that prefix and returns signed CloudFront URLs.
7. CloudFront serves objects only when the signature is valid.

## Gallery Layout

This stack is built around two prefixes in the same private gallery bucket:

- `public/` for the public showcase shown on the main website
- `extra/` for the paid member gallery behind Cognito

## Required tfvars Values

Create [terraform.tfvars](/Users/privileged/Projects/malkokote/pnp/app/backend/live/prod/terraform.tfvars) from [terraform.tfvars.example](/Users/privileged/Projects/malkokote/pnp/app/backend/live/prod/terraform.tfvars.example) and set these values:

```hcl
site_name              = "[NEW_SITE_NAME]"
project_slug           = "[NEW_PROJECT_SLUG]"
environment            = "prod"
aws_region             = "[AWS_REGION]"
website_base_url       = "[https://YOURDOMAIN.com]"
local_callback_url     = "[http://localhost:8000/auth/callback.html]"
cognito_domain_prefix  = "[UNIQUE_COGNITO_PREFIX]"
gallery_public_prefix  = "public"
gallery_extra_prefix   = "extra"

auth_callback_urls = [
  "[https://YOURDOMAIN.com]/auth/callback.html",
  "[http://localhost:8000/auth/callback.html]"
]

auth_logout_urls = [
  "[https://YOURDOMAIN.com]/",
  "http://localhost:8000/"
]

gallery_api_allowed_origins = [
  "[https://YOURDOMAIN.com]",
  "http://localhost:8000"
]

archive_transition_days                  = 7
gallery_cache_version                    = "v1"
gallery_signed_url_ttl_seconds           = 31536000
cognito_login_captcha_rate_limit         = 10
cognito_login_captcha_evaluation_window_sec = 60
cognito_login_captcha_immunity_time_sec  = 900
cognito_login_timeout_rate_limit         = 25
cognito_login_timeout_evaluation_window_sec = 300
price_class                              = "PriceClass_100"

tags = {
  Owner = "your-name"
}
```

Important:

- `gallery_public_base_url` must stay as the viewer-facing CloudFront URL
- you do not know that URL until after the first apply
- for the first apply, leave the placeholder from the example and then replace it with the actual output and apply a second time

That means the command flow is:

```bash
cd /Users/privileged/Projects/malkokote/pnp/app/backend/live/prod
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars with your real values
terraform init
terraform apply
# copy the gallery_cloudfront_domain_name output into gallery_public_base_url as https://<domain>
terraform apply
```

## After Apply

Copy these Terraform outputs into [config/site-config.js](/Users/privileged/Projects/malkokote/pnp/config/site-config.js):

- `cognito_hosted_ui_base_url` -> `authBaseUrl`
- `cognito_app_client_id` -> `authClientId`
- `gallery_cloudfront_domain_name` -> `galleryBaseUrl` as `https://<output>`

Also set:

- `siteName = "[NEW_SITE_NAME]"`
- `projectSlug = "[NEW_PROJECT_SLUG]"`
- `websiteBaseUrl = "[https://YOURDOMAIN.com]"`
- `galleryPublicPrefix = "public"`
- `galleryExtraPrefix = "extra"`

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
