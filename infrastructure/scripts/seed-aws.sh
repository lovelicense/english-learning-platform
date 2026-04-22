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

"${ROOT_DIR}/infrastructure/scripts/terraform-ensure-init.sh" "${TF_DIR}"

pushd "${TF_DIR}" >/dev/null

CLUSTER_NAME="$(terraform output -raw ecs_cluster_name)"
TASK_DEFINITION_ARN="$(terraform output -raw api_task_definition_arn)"
SUBNETS_CSV="$(terraform output -raw private_app_subnet_ids_csv)"
ECS_SECURITY_GROUP_ID="$(terraform output -raw ecs_security_group_id)"
popd >/dev/null

if [[ -z "${CLUSTER_NAME}" || -z "${TASK_DEFINITION_ARN}" || -z "${SUBNETS_CSV}" || -z "${ECS_SECURITY_GROUP_ID}" ]]; then
  echo "Failed to load Terraform outputs required for AWS seed task."
  exit 1
fi

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

RUN_TASK_JSON="$(aws ecs run-task \
  --region "${AWS_REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --launch-type FARGATE \
  --task-definition "${TASK_DEFINITION_ARN}" \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS_CSV}],securityGroups=[${ECS_SECURITY_GROUP_ID}],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["sh","-c","pnpm --filter @elp/api prisma db seed"]}]}' \
  --query '{taskArn: tasks[0].taskArn, failureReason: failures[0].reason}' \
  --output json)"

TASK_ARN="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.taskArn || '');" "${RUN_TASK_JSON}")"
FAILURE_REASON="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.failureReason || '');" "${RUN_TASK_JSON}")"

if [[ -z "${TASK_ARN}" ]]; then
  echo "Failed to start AWS seed task.${FAILURE_REASON:+ Reason: ${FAILURE_REASON}}"
  exit 1
fi

echo "Waiting for seed task to finish: ${TASK_ARN}"
aws ecs wait tasks-stopped \
  --region "${AWS_REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --tasks "${TASK_ARN}"

TASK_RESULT_JSON="$(aws ecs describe-tasks \
  --region "${AWS_REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --tasks "${TASK_ARN}" \
  --query '{exitCode: tasks[0].containers[0].exitCode, reason: tasks[0].stoppedReason, containerReason: tasks[0].containers[0].reason}' \
  --output json)"

EXIT_CODE="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode ?? ''));" "${TASK_RESULT_JSON}")"
STOPPED_REASON="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.reason || '');" "${TASK_RESULT_JSON}")"
CONTAINER_REASON="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.containerReason || '');" "${TASK_RESULT_JSON}")"

if [[ "${EXIT_CODE}" != "0" ]]; then
  echo "AWS seed task failed.${STOPPED_REASON:+ Stopped reason: ${STOPPED_REASON}}${CONTAINER_REASON:+ Container reason: ${CONTAINER_REASON}}"
  exit 1
fi

echo "AWS seed completed successfully."
