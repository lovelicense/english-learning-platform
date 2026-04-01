Terraform으로 운영용 AWS 인프라를 관리하는 디렉터리입니다.

현재 포함 리소스:
- VPC, public/private subnet, NAT Gateway
- ECS Fargate cluster
- Application Load Balancer
- ACM certificate + Route53 validation
- Route53 alias record (`root`, `api`)
- RDS PostgreSQL
- S3 audio bucket + CORS
- ECR repositories (`web`, `api`, `worker`)
- CloudWatch Logs

예시 변수 파일:
```bash
cp terraform.tfvars.example terraform.tfvars
```

빠른 시작:
```bash
cd infrastructure/terraform
terraform init
terraform plan \
  -var="web_image=ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-web:latest" \
  -var="api_image=ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-api:latest" \
  -var="worker_image=ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-worker:latest" \
  -var="db_password=CHANGE_ME" \
  -var="jwt_secret=CHANGE_ME" \
  -var="openai_api_key=sk-..."
```

주의:
- 현재는 빠른 배포를 위해 민감정보를 Terraform 변수로 전달하는 형태입니다.
- 운영 안정화를 위해 이후에는 `Secrets Manager` 또는 `SSM Parameter Store`로 옮기는 것을 권장합니다.
- `domain_name`을 넣으면 `https://도메인`, `https://api.도메인` 구조로 배포됩니다.
- Route53에 해당 도메인 hosted zone이 이미 있어야 합니다.
