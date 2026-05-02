# Malkokote

Production gallery site for `www.malkokote.com` with:

- a public gallery served from `public/`
- a paid member gallery served from `extra/`
- Cognito Hosted UI popup login
- CloudFront-signed media URLs minted by the backend
- Terraform for S3, CloudFront, Cognito, API Gateway, Lambda, and WAF

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
├── app/
│   └── backend/
│       ├── README.md
│       └── live/
│           └── prod/
│               ├── gallery_api.tf
│               ├── lambda/
│               │   ├── gallery_manifest/
│               │   │   └── index.mjs
│               │   └── gallery_manifest_builder/
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

1. Visitors open the sign-in modal from the public site.
2. The browser launches Cognito Hosted UI in a popup with PKCE.
3. Cognito redirects to `/auth/callback.html`.
4. The callback exchanges the code for tokens, posts the session back to the opener, and closes itself.
5. The main site restores the session and routes the user to `/gallery/`.
6. The homepage loads a static public manifest from `/_manifests/public/day.json` or `/_manifests/public/night.json`.
7. S3 upload and delete events rebuild those public manifests automatically.
8. The private gallery loads the extra manifest from `/api/gallery/extra-manifest` with the Cognito ID token.
9. The backend reads the prebuilt extra manifest metadata and returns signed CloudFront URLs for the paid gallery.

## Configure The Site

Terraform creates the backend values, but the static website also needs them.

The live site config already points at:

- `siteName = "Malkokote"`
- `projectSlug = "malkokote-gallery"`
- `websiteBaseUrl = "https://www.malkokote.com"`
- `galleryBaseUrl = "https://d9yvi8gvtdxu6.cloudfront.net"`

The remaining live auth values are also already filled in [config/site-config.js](/Users/privileged/Projects/malkokote/pnp/config/site-config.js).

## Terraform Inputs

The live Terraform vars already use:

- `site_name = "Malkokote"`
- `project_slug = "malkokote-gallery"`
- `environment = "prod"`
- `aws_region = "eu-central-1"`
- `website_base_url = "https://www.malkokote.com"`
- `cognito_domain_prefix = "malkokote-gallery-prod"`
- `gallery_public_prefix = "public"`
- `gallery_extra_prefix = "extra"`

## Commands

```bash
cd /Users/privileged/Projects/malkokote/pnp/app/backend/live/prod
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

To preview the site locally:

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
