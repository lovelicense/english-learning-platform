#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PROJECT_NAME="${PROJECT_NAME:-english-learning}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_VARS_FILE="${ROOT_DIR}/infrastructure/terraform/terraform.tfvars"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Building and pushing images with tag: ${IMAGE_TAG}"

WEB_REPO="${PROJECT_NAME}-${ENVIRONMENT}-web"
API_REPO="${PROJECT_NAME}-${ENVIRONMENT}-api"
WORKER_REPO="${PROJECT_NAME}-${ENVIRONMENT}-worker"

if [[ -z "${DOMAIN_NAME:-}" && -f "${TF_VARS_FILE}" ]]; then
  DOMAIN_NAME="$(sed -n 's/^domain_name[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "${TF_VARS_FILE}" | head -n 1)"
fi

if [[ -z "${API_SUBDOMAIN:-}" && -f "${TF_VARS_FILE}" ]]; then
  API_SUBDOMAIN="$(sed -n 's/^api_subdomain[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "${TF_VARS_FILE}" | head -n 1)"
fi

API_SUBDOMAIN="${API_SUBDOMAIN:-api}"
WEB_API_URL="${WEB_API_URL:-}"

if [[ -z "${WEB_API_URL}" && -n "${DOMAIN_NAME:-}" ]]; then
  WEB_API_URL="https://${API_SUBDOMAIN}.${DOMAIN_NAME}"
fi

echo "Using NEXT_PUBLIC_API_URL=${WEB_API_URL:-http://localhost:4000}"

docker build \
  --build-arg "NEXT_PUBLIC_API_URL=${WEB_API_URL:-http://localhost:4000}" \
  -f "${ROOT_DIR}/apps/web/Dockerfile" \
  -t "elp-web:${IMAGE_TAG}" \
  "${ROOT_DIR}"
docker build -f "${ROOT_DIR}/apps/api/Dockerfile" -t "elp-api:${IMAGE_TAG}" "${ROOT_DIR}"
docker build -f "${ROOT_DIR}/apps/worker/Dockerfile" -t "elp-worker:${IMAGE_TAG}" "${ROOT_DIR}"

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}"

docker tag "elp-web:${IMAGE_TAG}" "${REGISTRY}/${WEB_REPO}:${IMAGE_TAG}"
docker tag "elp-api:${IMAGE_TAG}" "${REGISTRY}/${API_REPO}:${IMAGE_TAG}"
docker tag "elp-worker:${IMAGE_TAG}" "${REGISTRY}/${WORKER_REPO}:${IMAGE_TAG}"

docker push "${REGISTRY}/${WEB_REPO}:${IMAGE_TAG}"
docker push "${REGISTRY}/${API_REPO}:${IMAGE_TAG}"
docker push "${REGISTRY}/${WORKER_REPO}:${IMAGE_TAG}"

cat <<EOF
web_image=${REGISTRY}/${WEB_REPO}:${IMAGE_TAG}
api_image=${REGISTRY}/${API_REPO}:${IMAGE_TAG}
worker_image=${REGISTRY}/${WORKER_REPO}:${IMAGE_TAG}
EOF
