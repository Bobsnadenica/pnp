output "archive_bucket_name" {
  description = "Bucket for the full long-term photo library."
  value       = aws_s3_bucket.archive.bucket
}

output "gallery_bucket_name" {
  description = "Private bucket that holds the selected gallery photos."
  value       = aws_s3_bucket.gallery.bucket
}

output "gallery_cloudfront_domain_name" {
  description = "CloudFront domain for the private gallery."
  value       = aws_cloudfront_distribution.gallery.domain_name
}

output "gallery_manifest_url" {
  description = "JWT-protected gallery manifest endpoint exposed through CloudFront."
  value       = "${var.gallery_public_base_url}${local.gallery_manifest_path}"
}

output "gallery_manifest_api_direct_url" {
  description = "Direct API Gateway URL for the gallery manifest endpoint."
  value       = "${aws_apigatewayv2_stage.gallery.invoke_url}${local.gallery_manifest_path}"
}

output "gallery_cache_version" {
  description = "Stable gallery cache version string used in signed CloudFront media URLs."
  value       = var.gallery_cache_version
}

output "gallery_month_prefix" {
  description = "Prefix used for the standard gallery collection."
  value       = var.gallery_month_prefix
}

output "gallery_test_prefix" {
  description = "Prefix used for the test gallery collection."
  value       = var.gallery_test_prefix
}

output "gallery_month_example_object_key" {
  description = "Example gallery object key under the standard flat naming convention."
  value       = "${var.gallery_month_prefix}/0.jpg"
}

output "gallery_month_extra_example_object_key" {
  description = "Example extra gallery object key for the same custom month grouping."
  value       = "${var.gallery_month_prefix}/11.jpg"
}

output "test_user_routing_enabled" {
  description = "Whether test-user routing is enabled in the backend."
  value       = var.enable_test_user_routing
}

output "cognito_waf_web_acl_arn" {
  description = "Regional AWS WAF web ACL that protects Cognito managed login from bursts and bot spam."
  value       = aws_wafv2_web_acl.cognito_login.arn
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id."
  value       = aws_cognito_user_pool.gallery.id
}

output "cognito_app_client_id" {
  description = "Cognito web app client id."
  value       = aws_cognito_user_pool_client.gallery.id
}

output "cognito_hosted_ui_base_url" {
  description = "Base URL for Cognito hosted UI."
  value       = "https://${aws_cognito_user_pool_domain.gallery.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_hosted_ui_login_url" {
  description = "Direct login URL for the hosted UI."
  value       = "https://${aws_cognito_user_pool_domain.gallery.domain}.auth.${var.aws_region}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.gallery.id}&response_type=code&scope=openid+email+profile+aws.cognito.signin.user.admin&redirect_uri=${urlencode(var.auth_callback_urls[0])}"
}
