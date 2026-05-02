locals {
  prefix                = "${var.project_slug}-${var.environment}"
  gallery_origin_id     = "${local.prefix}-gallery-origin"
  gallery_api_origin_id = "${local.prefix}-gallery-api-origin"
  gallery_manifest_path = "/api/gallery/manifest"
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
