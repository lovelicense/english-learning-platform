#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PROJECT_NAME="${PROJECT_NAME:-english-learning}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
DB_IDENTIFIER="${DB_IDENTIFIER:-${PROJECT_NAME}-${ENVIRONMENT}-postgres}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/terraform"

if [[ ! -f "${TF_DIR}/terraform.tfvars" ]]; then
  echo "Missing ${TF_DIR}/terraform.tfvars"
  echo "Create it from terraform.tfvars.example first."
  exit 1
fi

pushd "${TF_DIR}" >/dev/null
terraform init
terraform apply -auto-approve -var="runtime_enabled=false"
popd >/dev/null

DB_STATUS="$(aws rds describe-db-instances \
  --region "${AWS_REGION}" \
  --db-instance-identifier "${DB_IDENTIFIER}" \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || true)"

if [[ "${DB_STATUS}" == "available" ]]; then
  echo "Stopping RDS instance: ${DB_IDENTIFIER}"
  aws rds stop-db-instance \
    --region "${AWS_REGION}" \
    --db-instance-identifier "${DB_IDENTIFIER}" >/dev/null
  echo "RDS stop requested. AWS may restart it automatically after up to 7 days."
elif [[ -n "${DB_STATUS}" && "${DB_STATUS}" != "None" ]]; then
  echo "RDS instance status is '${DB_STATUS}', skipping stop request."
else
  echo "RDS instance not found in AWS API response, skipping stop request."
fi

echo "Runtime resources disabled. RDS and S3 data are preserved."
