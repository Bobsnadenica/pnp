resource "aws_wafv2_regex_pattern_set" "cognito_auth_paths" {
  name        = "${local.prefix}-cognito-auth-paths"
  description = "Managed login endpoints that should receive hidden anti-bot protection."
  scope       = "REGIONAL"

  regular_expression {
    regex_string = "^/(login|signup|forgotPassword|confirmForgotPassword|oauth2/authorize)$"
  }
}

resource "aws_wafv2_web_acl" "cognito_login" {
  name        = "${local.prefix}-cognito-login"
  description = "Hidden CAPTCHA and timeout protection for Cognito managed login."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "cognito-login-timeout-block"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type    = "IP"
        evaluation_window_sec = var.cognito_login_timeout_evaluation_window_sec
        limit                 = var.cognito_login_timeout_rate_limit

        scope_down_statement {
          regex_pattern_set_reference_statement {
            arn = aws_wafv2_regex_pattern_set.cognito_auth_paths.arn

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${replace(local.prefix, "-", "")}CognitoLoginTimeoutBlock"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "cognito-login-captcha"
    priority = 20

    action {
      captcha {}
    }

    captcha_config {
      immunity_time_property {
        immunity_time = var.cognito_login_captcha_immunity_time_sec
      }
    }

    statement {
      rate_based_statement {
        aggregate_key_type    = "IP"
        evaluation_window_sec = var.cognito_login_captcha_evaluation_window_sec
        limit                 = var.cognito_login_captcha_rate_limit

        scope_down_statement {
          regex_pattern_set_reference_statement {
            arn = aws_wafv2_regex_pattern_set.cognito_auth_paths.arn

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${replace(local.prefix, "-", "")}CognitoLoginCaptcha"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${replace(local.prefix, "-", "")}CognitoLoginAcl"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "cognito_login" {
  resource_arn = aws_cognito_user_pool.gallery.arn
  web_acl_arn  = aws_wafv2_web_acl.cognito_login.arn
}
