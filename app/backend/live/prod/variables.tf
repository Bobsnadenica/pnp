variable "site_name" {
  description = "Human-friendly site name used in tags and docs."
  type        = string
}

variable "aws_region" {
  description = "Primary AWS region for Cognito and S3."
  type        = string
}

variable "project_slug" {
  description = "Short slug used in resource names."
  type        = string
}

variable "environment" {
  description = "Environment suffix for resource naming."
  type        = string
  default     = "prod"
}

variable "website_base_url" {
  description = "Public website base URL."
  type        = string
}

variable "local_callback_url" {
  description = "Local callback URL used during development."
  type        = string
}

variable "auth_callback_urls" {
  description = "Allowed Cognito callback URLs."
  type        = list(string)
}

variable "auth_logout_urls" {
  description = "Allowed Cognito logout URLs."
  type        = list(string)
}

variable "cognito_domain_prefix" {
  description = "Unique Cognito hosted UI domain prefix."
  type        = string
}

variable "gallery_public_prefix" {
  description = "Prefix inside the gallery bucket for the public showcase files."
  type        = string
}

variable "gallery_extra_prefix" {
  description = "Prefix inside the gallery bucket for the paid member gallery files."
  type        = string
}

variable "gallery_public_base_url" {
  description = "Public base URL that viewers use for the CloudFront gallery distribution."
  type        = string
}

variable "gallery_cache_version" {
  description = "Stable cache version string for gallery media URLs. Change it only when you intentionally want every client to fetch fresh originals again."
  type        = string
  default     = "v1"
}

variable "gallery_signed_url_ttl_seconds" {
  description = "Lifetime in seconds for the signed gallery media URLs returned by the backend."
  type        = number
  default     = 31536000
}

variable "gallery_public_manifest_cache_ttl_seconds" {
  description = "CloudFront and browser cache lifetime in seconds for the public static manifest JSON files."
  type        = number
  default     = 60
}

variable "gallery_api_allowed_origins" {
  description = "Browser origins allowed to call the private gallery manifest API through CloudFront."
  type        = list(string)
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition = contains(
      ["PriceClass_All", "PriceClass_200", "PriceClass_100"],
      var.price_class
    )
    error_message = "price_class must be one of PriceClass_100, PriceClass_200, or PriceClass_All."
  }
}

variable "tags" {
  description = "Extra tags to add to all resources."
  type        = map(string)
  default     = {}
}
