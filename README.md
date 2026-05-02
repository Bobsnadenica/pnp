# [NEW_SITE_NAME]

Isolated private gallery website and backend stack modeled after the existing Everyday Lilly implementation.

This repo now contains:

- a static marketing site with a Cognito Hosted UI popup login
- a callback page that closes the popup and restores the session in the main window
- private gallery routes backed by a Cognito-protected manifest API
- Terraform for a separate S3, CloudFront, Cognito, API Gateway, Lambda, and WAF stack
- a cleanup script that destroys only this repo's Terraform-managed infrastructure

## Structure

```text
.
├── CNAME
├── README.md
├── cleanup.sh
├── config/
│   └── site-config.js
├── auth/
│   ├── auth.js
│   └── callback.html
├── gallery/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   ├── months/
│   │   └── index.html
│   └── test/
│       └── index.html
├── app/
│   └── backend/
│       ├── README.md
│       └── live/
│           └── prod/
│               ├── gallery_api.tf
│               ├── lambda/
│               │   └── gallery_manifest/
│               │       └── index.mjs
│               ├── locals.tf
│               ├── main.tf
│               ├── outputs.tf
│               ├── providers.tf
│               ├── terraform.tfvars.example
│               ├── variables.tf
│               ├── versions.tf
│               └── waf.tf
├── index.html
├── script.js
└── style.css
```

## Website Flow

The site follows the same architecture and user experience as the Everyday Lilly reference:

1. Visitors open the sign-in modal from the public site.
2. The browser launches Cognito Hosted UI in a popup with PKCE.
3. Cognito redirects to `/auth/callback.html`.
4. The callback exchanges the code for tokens, posts the session back to the opener, and closes itself.
5. The main site restores the session and routes the user to `/gallery/`.
6. The gallery calls the backend manifest API with the Cognito ID token.
7. The backend decides the allowed prefix, lists objects, and returns signed CloudFront URLs.

The gallery supports:

- pictures
- GIFs
- movies
- filter chips by media type
- a manual refresh button for cache busting
- long-lived immutable caching otherwise
- optional `test/` routing for test users

## Configure The Site

Terraform creates the backend values, but the static website also needs them.

After `terraform apply`, update [config/site-config.js](/Users/privileged/Projects/malkokote/pnp/config/site-config.js) with:

- `siteName`: `[NEW_SITE_NAME]`
- `projectSlug`: `[NEW_PROJECT_SLUG]`
- `environment`: `prod`
- `websiteBaseUrl`: `[https://YOURDOMAIN.com]`
- `localBaseUrl`: `http://localhost:8000`
- `authBaseUrl`: Terraform output `cognito_hosted_ui_base_url`
- `authClientId`: Terraform output `cognito_app_client_id`
- `galleryBaseUrl`: `https://` + Terraform output `gallery_cloudfront_domain_name`
- `testUserRoutingEnabled`: `true` if the input was `yes`, otherwise `false`
- `galleryMonthPrefix`: `[months or another folder]`
- `galleryTestPrefix`: `[test or another folder]`

If this repo will own the production domain, also update [CNAME](/Users/privileged/Projects/malkokote/pnp/CNAME) to match your real host.

## Terraform Inputs

Create [app/backend/live/prod/terraform.tfvars](/Users/privileged/Projects/malkokote/pnp/app/backend/live/prod/terraform.tfvars) from the example and set:

- `site_name = "[NEW_SITE_NAME]"`
- `project_slug = "[NEW_PROJECT_SLUG]"`
- `environment = "prod"`
- `aws_region = "[AWS_REGION]"`
- `website_base_url = "[https://YOURDOMAIN.com]"`
- `local_callback_url = "[http://localhost:8000/auth/callback.html]"`
- `cognito_domain_prefix = "[UNIQUE_COGNITO_PREFIX]"`
- `gallery_month_prefix = "[months or another folder]"`
- `gallery_test_prefix = "[test or another folder]"`
- `enable_test_user_routing = true` when the input is `yes`, else `false`

You will also set the callback and logout lists exactly as shown in the backend README.

## Commands

```bash
cd /Users/privileged/Projects/malkokote/pnp/app/backend/live/prod
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Then update [config/site-config.js](/Users/privileged/Projects/malkokote/pnp/config/site-config.js), and preview the site locally:

```bash
cd /Users/privileged/Projects/malkokote/pnp
python3 -m http.server 8000
```

To destroy only this stack later:

```bash
cd /Users/privileged/Projects/malkokote/pnp
./cleanup.sh
```

Use `./cleanup.sh --yes` for non-interactive cleanup.
