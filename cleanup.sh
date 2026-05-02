#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend/live/prod"
AUTO_APPROVE=0

if [[ "${1:-}" == "--yes" ]]; then
  AUTO_APPROVE=1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

if [[ "$AUTO_APPROVE" -ne 1 ]]; then
  echo "This will run terraform destroy in:"
  echo "  $BACKEND_DIR"
  echo
  echo "After destroy, it will remove local Terraform state files, plans, and .terraform caches from that folder."
  read -r -p "Continue? [y/N] " response

  case "$response" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Cleanup cancelled."
      exit 0
      ;;
  esac
fi

DESTROY_ARGS=()
if [[ "$AUTO_APPROVE" -eq 1 ]]; then
  DESTROY_ARGS+=("-auto-approve")
fi

echo "Running terraform destroy..."
terraform -chdir="$BACKEND_DIR" destroy "${DESTROY_ARGS[@]}"

echo "Removing local Terraform artifacts..."
find "$BACKEND_DIR" -maxdepth 1 \
  \( -name "terraform.tfstate" -o -name "terraform.tfstate.*" -o -name "*.tfplan" -o -name "plan.out" -o -name "crash.log" \) \
  -exec rm -rf {} +

rm -rf "$BACKEND_DIR/.terraform"

echo "Cleanup complete."
