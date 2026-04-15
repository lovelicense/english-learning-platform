#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PROJECT_NAME="${PROJECT_NAME:-english-learning}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
DB_IDENTIFIER="${DB_IDENTIFIER:-${PROJECT_NAME}-${ENVIRONMENT}-postgres}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/terraform"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Using image tag: ${IMAGE_TAG}"

WEB_IMAGE="${REGISTRY}/${PROJECT_NAME}-${ENVIRONMENT}-web:${IMAGE_TAG}"
API_IMAGE="${REGISTRY}/${PROJECT_NAME}-${ENVIRONMENT}-api:${IMAGE_TAG}"
WORKER_IMAGE="${REGISTRY}/${PROJECT_NAME}-${ENVIRONMENT}-worker:${IMAGE_TAG}"

if [[ ! -f "${TF_DIR}/terraform.tfvars" ]]; then
  echo "Missing ${TF_DIR}/terraform.tfvars"
  echo "Create it from terraform.tfvars.example first."
  exit 1
fi

pushd "${TF_DIR}" >/dev/null
terraform init
terraform apply -auto-approve \
  -target=aws_ecr_repository.web \
  -target=aws_ecr_repository.api \
  -target=aws_ecr_repository.worker \
  -var="runtime_enabled=true" \
  -var="web_image=${WEB_IMAGE}" \
  -var="api_image=${API_IMAGE}" \
  -var="worker_image=${WORKER_IMAGE}"
popd >/dev/null

AWS_REGION="${AWS_REGION}" PROJECT_NAME="${PROJECT_NAME}" ENVIRONMENT="${ENVIRONMENT}" IMAGE_TAG="${IMAGE_TAG}" \
  "${ROOT_DIR}/infrastructure/scripts/push-ecr-images.sh"

DB_STATUS="$(aws rds describe-db-instances \
  --region "${AWS_REGION}" \
  --db-instance-identifier "${DB_IDENTIFIER}" \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || true)"

if [[ "${DB_STATUS}" == "stopped" ]]; then
  echo "Starting RDS instance: ${DB_IDENTIFIER}"
  aws rds start-db-instance \
    --region "${AWS_REGION}" \
    --db-instance-identifier "${DB_IDENTIFIER}" >/dev/null
fi

if [[ -n "${DB_STATUS}" && "${DB_STATUS}" != "None" ]]; then
  echo "Waiting for RDS instance to become available: ${DB_IDENTIFIER}"
  aws rds wait db-instance-available \
    --region "${AWS_REGION}" \
    --db-instance-identifier "${DB_IDENTIFIER}"
fi

pushd "${TF_DIR}" >/dev/null
terraform apply -auto-approve \
  -var="runtime_enabled=true" \
  -var="web_image=${WEB_IMAGE}" \
  -var="api_image=${API_IMAGE}" \
  -var="worker_image=${WORKER_IMAGE}"
popd >/dev/null

AWS_REGION="${AWS_REGION}" PROJECT_NAME="${PROJECT_NAME}" ENVIRONMENT="${ENVIRONMENT}" DB_IDENTIFIER="${DB_IDENTIFIER}" \
  "${ROOT_DIR}/infrastructure/scripts/seed-aws.sh"
