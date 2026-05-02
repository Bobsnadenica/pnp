data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket" "gallery" {
  bucket = "${local.prefix}-gallery-${random_string.bucket_suffix.result}"
}

resource "aws_s3_bucket_versioning" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "gallery" {
  bucket = aws_s3_bucket.gallery.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "gallery" {
  name                              = "${local.prefix}-gallery-oac"
  description                       = "Origin access control for the private gallery bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "gallery_images" {
  name    = "${local.prefix}-gallery-images"
  comment = "Immutable browser caching headers for signed gallery media."

  custom_headers_config {
    items {
      header   = "Cache-Control"
      override = true
      value    = "public, max-age=31536000, immutable"
    }
  }
}

resource "aws_cloudfront_cache_policy" "gallery_media" {
  name        = "${local.prefix}-gallery-media"
  comment     = "Long-lived media cache with explicit manual busting through the v query string."
  default_ttl = var.gallery_signed_url_ttl_seconds
  max_ttl     = var.gallery_signed_url_ttl_seconds
  min_ttl     = var.gallery_signed_url_ttl_seconds

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "whitelist"

      query_strings {
        items = ["v"]
      }
    }
  }
}

resource "aws_cloudfront_distribution" "gallery" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Private gallery distribution for ${local.prefix}"
  price_class         = var.price_class
  wait_for_deployment = true

  origin {
    connection_attempts         = 3
    connection_timeout          = 10
    domain_name                 = trimprefix(aws_apigatewayv2_api.gallery.api_endpoint, "https://")
    origin_id                   = local.gallery_api_origin_id
    response_completion_timeout = 0

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_protocol_policy   = "https-only"
      origin_read_timeout      = 30
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  origin {
    connection_attempts         = 3
    connection_timeout          = 10
    domain_name                 = aws_s3_bucket.gallery.bucket_regional_domain_name
    origin_access_control_id    = aws_cloudfront_origin_access_control.gallery.id
    origin_id                   = local.gallery_origin_id
    response_completion_timeout = 0

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id           = local.gallery_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.gallery_media.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.gallery_images.id
    trusted_key_groups         = [aws_cloudfront_key_group.gallery.id]
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.gallery_api_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.gallery_api.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }
}

data "aws_iam_policy_document" "gallery_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.gallery.arn,
      "${aws_s3_bucket.gallery.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "AllowCloudFrontReadOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = ["s3:GetObject"]

    resources = [
      "${aws_s3_bucket.gallery.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.gallery.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "gallery" {
  bucket = aws_s3_bucket.gallery.id
  policy = data.aws_iam_policy_document.gallery_bucket.json
}

resource "aws_cognito_user_pool" "gallery" {
  name                = "${local.prefix}-users"
  username_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }
}

resource "aws_cognito_user_pool_client" "gallery" {
  name         = "${local.prefix}-web"
  user_pool_id = aws_cognito_user_pool.gallery.id

  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes = [
    "aws.cognito.signin.user.admin",
    "email",
    "openid",
    "profile"
  ]
  callback_urls                = var.auth_callback_urls
  logout_urls                  = var.auth_logout_urls
  supported_identity_providers = ["COGNITO"]
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
}

resource "aws_cognito_user_pool_domain" "gallery" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.gallery.id
}
