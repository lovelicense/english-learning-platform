# AWS 배포 가이드

현재 프로젝트 기준 운영 배포 권장 구조입니다.

## 권장 아키텍처
- `web`: ECS Fargate, 포트 `3000`
- `api`: ECS Fargate, 포트 `4000`
- `worker`: ECS Fargate 단독 서비스
- `db`: Amazon RDS PostgreSQL
- `storage`: Amazon S3
- `ingress`: Application Load Balancer
- `dns`: Route53
- `tls`: ACM
- `image registry`: Amazon ECR

## 이번 구성에서 정리한 내용
- `apps/web/Dockerfile`
- `apps/api/Dockerfile`
- `apps/worker/Dockerfile`
- `infrastructure/terraform/*`
- `infrastructure/scripts/push-ecr-images.sh`
- `infrastructure/scripts/deploy-aws.sh`
- `.github/workflows/deploy-aws.yml`

즉, 지금 리포지토리만으로 `이미지 빌드 -> ECR 푸시 -> Terraform apply -> ECS 실행` 흐름까지 이어갈 수 있게 기본 골격을 추가했습니다.

## 1. AWS에서 먼저 준비할 것
- AWS 계정
- IAM 사용자 또는 역할
- AWS CLI 로그인
- Terraform 설치

권장 리전:
- `ap-northeast-2` (서울)

## 2. 컨테이너 이미지 빌드
루트 디렉터리에서 각각 빌드합니다.

```bash
docker build -f apps/web/Dockerfile -t elp-web:latest .
docker build -f apps/api/Dockerfile -t elp-api:latest .
docker build -f apps/worker/Dockerfile -t elp-worker:latest .
```

## 3. Terraform으로 1차 인프라 생성
먼저 ECR이 필요하므로, 가장 실무적으로는 아래 두 단계 중 하나로 진행합니다.

### 방법 A. 한 번에 진행
이미지 URI를 미리 ECR 형식으로 넣고 `terraform apply` 실행 후, 생성된 ECR로 이미지를 푸시합니다.

### 방법 B. 권장
1. `terraform apply`로 ECR/VPC/RDS/S3를 먼저 생성
2. ECR URL 확인
3. 이미지 빌드 및 푸시
4. 다시 `terraform apply` 해서 ECS 서비스 업데이트

현재 템플릿은 `방법 B`로 쓰기 가장 편합니다.

`terraform.tfvars`는 아래 예시 파일로 시작하면 됩니다.

```bash
cp infrastructure/terraform/terraform.tfvars.example infrastructure/terraform/terraform.tfvars
```

도메인을 사용할 경우 예:
```hcl
domain_name   = "chunsay.com"
api_subdomain = "api"
```

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

## 4. ECR 로그인 및 이미지 푸시
Terraform 출력값의 ECR repository URL을 사용합니다.

```bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com
docker tag elp-web:latest ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-web:latest
docker tag elp-api:latest ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-api:latest
docker tag elp-worker:latest ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-worker:latest
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-web:latest
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-api:latest
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-worker:latest
```

로컬에서 한 번에 진행하려면 아래 스크립트를 사용할 수 있습니다.

```bash
chmod +x infrastructure/scripts/push-ecr-images.sh
chmod +x infrastructure/scripts/deploy-aws.sh

./infrastructure/scripts/deploy-aws.sh
```

## 5. 운영 환경 변수 기준
`api`와 `worker`에 공통으로 중요한 값:

- `DATABASE_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `OPENAI_API_KEY`
- `OPENAI_LLM_MODEL`
- `OPENAI_STT_MODEL`
- `OPENAI_STT_DIARIZE_MODEL`
- `OPENAI_PRACTICE_STT_MODEL`
- `OPENAI_PRACTICE_STT_FALLBACK_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`

`api` 전용:
- `API_PORT=4000`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

`web` 전용:
- `NEXT_PUBLIC_API_URL=https://api.chunsay.com`

## 6. S3 CORS
브라우저에서 presigned URL 업로드를 사용하므로, 운영 도메인을 CORS 허용 목록에 넣어야 합니다.

Terraform 변수:
- `cors_allowed_origins`

예:
```hcl
cors_allowed_origins = [
  "https://your-domain.com",
  "http://localhost:3000"
]
```

## 7. HTTPS/도메인 연결
`domain_name`을 넣으면 아래가 함께 생성됩니다.

- ACM 인증서
- Route53 DNS validation 레코드
- ALB `443` HTTPS listener
- `http -> https` 리다이렉트
- 루트 도메인 `https://chunsay.com`
- API 도메인 `https://api.chunsay.com`

전제 조건:
- `chunsay.com` hosted zone이 Route53에 이미 있어야 함

## 8. 현재 구성의 한계
- Secrets Manager 연동 미포함
- ECS autoscaling 미포함
- worker 실제 큐 소비 구조는 아직 placeholder 상태

즉, 이번 단계는 "운영 서버 1차 배포 가능한 골격"까지입니다.

## 9. 다음 단계 권장 순서
1. Terraform apply로 AWS 기본 리소스 생성
2. ECR 푸시 후 ECS 정상 기동 확인
3. `https://chunsay.com`, `https://api.chunsay.com` 접속 확인
4. S3 업로드/STT/TTS 실동작 확인
5. Secrets Manager 전환
6. GitHub Actions 기반 CI/CD 추가

## 10. GitHub Actions 배포
워크플로우 파일:
- `.github/workflows/deploy-aws.yml`

필요한 GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`
- `DB_PASSWORD`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `DOMAIN_NAME`
- `WEB_ORIGIN`

동작 방식:
- Terraform init/validate
- ECR repository 생성
- `web`, `api`, `worker` 이미지 빌드 및 푸시
- Terraform apply로 ECS 서비스 반영
## 11. 배포 체크리스트
- RDS 접속 가능

## 12. 운영 자원 중지/재시작
- 운영 테스트를 쉬는 동안에는 `RDS`, `S3` 데이터는 유지하고 `ECS`, `ALB`, `NAT Gateway` 같은 실행 비용 중심 리소스만 내릴 수 있습니다.
- 중지 명령:

```bash
./infrastructure/scripts/stop-aws.sh
```

- 재배포 명령:

```bash
./infrastructure/scripts/deploy-aws.sh
```

- `stop-aws.sh`는 Terraform에 `runtime_enabled=false`를 적용해서 운영 리소스를 내리고, 이어서 RDS 인스턴스를 `stop` 요청합니다.
- `deploy-aws.sh`는 이미지를 푸시한 뒤 RDS가 `stopped` 상태면 자동으로 다시 시작하고, 그 다음 운영 리소스를 다시 생성합니다.
- 배포 마지막에는 `seed-aws.sh`를 실행해서 운영 RDS에 `apps/api/prisma/seed.ts` 내용을 업서트합니다.
- Terraform provider를 아직 받지 않은 새 환경에서는 최초 1회 `terraform init` 또는 `deploy-aws.sh` 실행 시 인터넷 연결이 필요합니다.
- 한 번 초기화된 뒤에는 스크립트가 `infrastructure/terraform/.terraform`의 provider 캐시를 재사용해서 불필요한 registry 재접속을 피합니다.
- 로컬 DB에 수동으로 넣은 데이터는 자동 반영되지 않으며, 운영 반영 대상은 현재 코드에 들어 있는 시드 데이터입니다.
- S3 버킷과 RDS 데이터는 유지됩니다.
- RDS 중지는 AWS 정책상 최대 7일까지만 유지될 수 있어, 장기간 쉬면 자동 재시작될 수 있습니다.
- 회원가입/로그인 가능
- presigned URL 발급 가능
- S3 업로드 가능
- 녹음 상세 조회 가능
- STT 호출 가능
- TTS mp3 생성 가능
- 브라우저에서 mp3 재생 가능
