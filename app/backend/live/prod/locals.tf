locals {
  prefix                                   = "${var.project_slug}-${var.environment}"
  gallery_origin_id                        = "${local.prefix}-gallery-origin"
  gallery_api_origin_id                    = "${local.prefix}-gallery-api-origin"
  gallery_manifest_prefix                  = "_manifests"
  gallery_public_manifest_path             = "/api/gallery/public-manifest"
  gallery_extra_manifest_path              = "/api/gallery/extra-manifest"
  gallery_public_day_manifest_object_key   = "${local.gallery_manifest_prefix}/public/day.json"
  gallery_public_night_manifest_object_key = "${local.gallery_manifest_prefix}/public/night.json"
  gallery_extra_manifest_object_key        = "${local.gallery_manifest_prefix}/private/extra.json"
  gallery_public_day_manifest_path         = "/${local.gallery_public_day_manifest_object_key}"
  gallery_public_night_manifest_path       = "/${local.gallery_public_night_manifest_object_key}"
  tags = merge(
    {
      Project     = var.site_name
      Component   = "private-gallery-backend"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}
