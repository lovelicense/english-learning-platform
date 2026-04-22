#!/usr/bin/env bash
set -euo pipefail

TF_DIR="${1:-}"

if [[ -z "${TF_DIR}" ]]; then
  echo "Usage: $0 <terraform-directory>"
  exit 1
fi

if [[ ! -d "${TF_DIR}" ]]; then
  echo "Terraform directory not found: ${TF_DIR}"
  exit 1
fi

LOCK_FILE="${TF_DIR}/.terraform.lock.hcl"
PROVIDER_DIR="${TF_DIR}/.terraform/providers"

if [[ -f "${LOCK_FILE}" && -d "${PROVIDER_DIR}" ]] && find "${PROVIDER_DIR}" -type f | grep -q .; then
  echo "Using existing Terraform provider cache in ${TF_DIR}/.terraform"
  exit 0
fi

echo "Initializing Terraform providers in ${TF_DIR}"
terraform -chdir="${TF_DIR}" init
