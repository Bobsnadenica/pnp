data "archive_file" "gallery_manifest_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/gallery_manifest"
  output_path = "${path.module}/.terraform/gallery_manifest_lambda.zip"
}

data "archive_file" "gallery_manifest_builder_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/gallery_manifest_builder"
  output_path = "${path.module}/.terraform/gallery_manifest_builder_lambda.zip"
}

# --- PERMANENT SECTION: New RSA-based resources ---

resource "aws_cloudfront_public_key" "gallery_rsa" {
  comment     = "Public key for ${local.prefix} gallery signed URLs."
  encoded_key = var.gallery_signer_public_key
  name        = "${local.prefix}-gallery-signer-rsa"
}

resource "aws_cloudfront_key_group" "gallery_rsa" {
  comment = "Trusted key group for ${local.prefix} gallery signed URLs."
  items   = [aws_cloudfront_public_key.gallery_rsa.id]
  name    = "${local.prefix}-gallery-key-group-rsa"
}

# --- REST OF CONFIGURATION ---

resource "aws_cloudfront_origin_request_policy" "gallery_api" {
  comment = "Forward auth and CORS headers to the private gallery manifest API."
  name    = "${local.prefix}-gallery-api-origin-request"

  cookies_config {
    cookie_behavior = "none"
  }

  headers_config {
    header_behavior = "whitelist"

    headers {
      items = [
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
        "Authorization",
        "Origin"
      ]
    }
  }

  query_strings_config {
    query_string_behavior = "whitelist"

    query_strings {
      items = ["refresh", "theme", "full"]
    }
  }
}

resource "aws_iam_role" "gallery_manifest_lambda" {
  name = "${local.prefix}-gallery-manifest-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gallery_manifest_lambda_logs" {
  role       = aws_iam_role.gallery_manifest_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "gallery_manifest_lambda" {
  name = "${local.prefix}-gallery-manifest-inline"
  role = aws_iam_role.gallery_manifest_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = aws_s3_bucket.gallery.arn
      },
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.gallery.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role" "gallery_manifest_builder_lambda" {
  name = "${local.prefix}-gallery-manifest-builder-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gallery_manifest_builder_lambda_logs" {
  role       = aws_iam_role.gallery_manifest_builder_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "gallery_manifest_builder_lambda" {
  name = "${local.prefix}-gallery-manifest-builder-inline"
  role = aws_iam_role.gallery_manifest_builder_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = aws_s3_bucket.gallery.arn
      },
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.gallery.arn}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "gallery_manifest" {
  function_name    = "${local.prefix}-gallery-manifest"
  role             = aws_iam_role.gallery_manifest_lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.gallery_manifest_lambda.output_path
  source_code_hash = data.archive_file.gallery_manifest_lambda.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      GALLERY_BUCKET                    = aws_s3_bucket.gallery.bucket
      GALLERY_PUBLIC_PREFIX             = var.gallery_public_prefix
      GALLERY_EXTRA_PREFIX              = var.gallery_extra_prefix
      GALLERY_PUBLIC_BASE_URL           = trimsuffix(var.gallery_public_base_url, "/")
      GALLERY_CACHE_VERSION             = var.gallery_cache_version
      GALLERY_SIGNED_URL_TTL            = tostring(var.gallery_signed_url_ttl_seconds)
      GALLERY_PUBLIC_MANIFEST_CACHE_TTL = tostring(var.gallery_public_manifest_cache_ttl_seconds)
      GALLERY_SIGNER_KEY_PAIR_ID        = aws_cloudfront_public_key.gallery_rsa.id
      GALLERY_SIGNER_PRIVATE_KEY        = var.gallery_signer_private_key
      GALLERY_MANIFEST_PREFIX           = local.gallery_manifest_prefix
      GALLERY_PUBLIC_DAY_MANIFEST_KEY   = local.gallery_public_day_manifest_object_key
      GALLERY_PUBLIC_NIGHT_MANIFEST_KEY = local.gallery_public_night_manifest_object_key
      GALLERY_EXTRA_MANIFEST_KEY        = local.gallery_extra_manifest_object_key
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.gallery_manifest_lambda_logs
  ]
}

resource "aws_lambda_function" "gallery_manifest_builder" {
  function_name    = "${local.prefix}-gallery-manifest-builder"
  role             = aws_iam_role.gallery_manifest_builder_lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.gallery_manifest_builder_lambda.output_path
  source_code_hash = data.archive_file.gallery_manifest_builder_lambda.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      GALLERY_BUCKET                    = aws_s3_bucket.gallery.bucket
      GALLERY_PUBLIC_PREFIX             = var.gallery_public_prefix
      GALLERY_EXTRA_PREFIX              = var.gallery_extra_prefix
      GALLERY_PUBLIC_BASE_URL           = trimsuffix(var.gallery_public_base_url, "/")
      GALLERY_CACHE_VERSION             = var.gallery_cache_version
      GALLERY_PUBLIC_MANIFEST_CACHE_TTL = tostring(var.gallery_public_manifest_cache_ttl_seconds)
      GALLERY_MANIFEST_PREFIX           = local.gallery_manifest_prefix
      GALLERY_PUBLIC_DAY_MANIFEST_KEY   = local.gallery_public_day_manifest_object_key
      GALLERY_PUBLIC_NIGHT_MANIFEST_KEY = local.gallery_public_night_manifest_object_key
      GALLERY_EXTRA_MANIFEST_KEY        = local.gallery_extra_manifest_object_key
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.gallery_manifest_builder_lambda_logs
  ]
}

resource "aws_apigatewayv2_api" "gallery" {
  name          = "${local.prefix}-gallery-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = [
      "Authorization",
      "Content-Type"
    ]
    allow_methods = [
      "GET",
      "OPTIONS"
    ]
    allow_origins = var.gallery_api_allowed_origins
    max_age       = 600
  }
}

resource "aws_apigatewayv2_integration" "gallery_manifest" {
  api_id                 = aws_apigatewayv2_api.gallery.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.gallery_manifest.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "gallery_jwt" {
  api_id           = aws_apigatewayv2_api.gallery.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.prefix}-gallery-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.gallery.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.gallery.id}"
  }
}

resource "aws_apigatewayv2_route" "gallery_public_manifest" {
  api_id    = aws_apigatewayv2_api.gallery.id
  route_key = "GET ${local.gallery_public_manifest_path}"
  target    = "integrations/${aws_apigatewayv2_integration.gallery_manifest.id}"
}

resource "aws_apigatewayv2_route" "gallery_extra_manifest" {
  api_id             = aws_apigatewayv2_api.gallery.id
  route_key          = "GET ${local.gallery_extra_manifest_path}"
  target             = "integrations/${aws_apigatewayv2_integration.gallery_manifest.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.gallery_jwt.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_stage" "gallery" {
  api_id      = aws_apigatewayv2_api.gallery.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "gallery_manifest" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gallery_manifest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.gallery.execution_arn}/*/*"
}

resource "aws_lambda_permission" "gallery_manifest_builder_public" {
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.gallery_manifest_builder.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.gallery.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "gallery_manifest_builder" {
  bucket = aws_s3_bucket.gallery.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.gallery_manifest_builder.arn
    events              = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
    filter_prefix       = "${var.gallery_public_prefix}/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.gallery_manifest_builder.arn
    events              = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
    filter_prefix       = "${var.gallery_extra_prefix}/"
  }

  depends_on = [aws_lambda_permission.gallery_manifest_builder_public]
}
