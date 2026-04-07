# 프로젝트 개요
영어 학습 웹앱 개발 중

목표:
내가 실제로 하는 한국어 말을 영어 표현으로 학습

핵심 기능:
1. 음성 녹음 또는 업로드
2. STT (한국어 → 텍스트)
3. 영어 표현 생성 (LLM)
4. TTS (영어 음성 생성)
5. 반복 학습 + 테스트


# 기술 스택
Frontend:
- Next.js (Web)

Backend:
- NestJS (API 서버)

Worker:
- 비동기 처리 (STT, TTS 등)

DB:
- PostgreSQL (Docker)

ORM:
- Prisma

Cloud:
- AWS S3 (음성 파일 저장)

AI:
- OpenAI API
  - STT: gpt-4o-transcribe / diarize
  - LLM: 영어 표현 생성
  - TTS: 음성 생성


# 시스템 구조
[Web (3000)]
   ↓
[API (4000)]
   ↓
[S3 + OpenAI + DB]
   ↓
[Worker]


# 음성 처리 흐름
1. 녹음/파일 업로드
2. S3 presigned URL 생성
3. S3 업로드
4. Worker에서 STT 수행
5. (옵션) 화자 분리 (diarization)
6. 영어 문장 생성
7. 영어 TTS 생성
8. S3 저장
9. Web에서 재생


# 화자 분리 (Diarization)
모델:
gpt-4o-transcribe-diarize

필수 옵션:
response_format: diarized_json
chunking_strategy: auto

결과:
segments 배열
→ speaker, text, start, end 포함

현재 목표:
여러 명 대화에서 "내 발화만 추출"


# 개발 환경
OS:
Windows 11 + WSL (Ubuntu)

에디터:
VS Code (WSL 연결)

패키지:
pnpm

컨테이너:
Docker (PostgreSQL)

프로젝트 위치:
~/projects/english-learning-platform


# 실행 방법
wsl
cd ~/projects/english-learning-platform

docker compose -f infrastructure/docker/docker-compose.yml up -d

pnpm dev:api
pnpm dev:web
pnpm dev:worker



# 환경 변수 (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=...

OPENAI_API_KEY=...

AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=버킷명
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...


# 현재 구현 상태
✔ 로컬 개발환경 구축 완료
✔ Docker + PostgreSQL 정상
✔ S3 업로드 성공
✔ STT 동작
✔ diarization 적용 완료
✔ 영어 변환 동작
✔ TTS 생성 동작

# AWS 생성 결과
alb_dns_name = "english-learning-prod-alb-12383440.ap-northeast-2.elb.amazonaws.com"
api_domain_name = "api.chunsay.com"
api_ecr_repository_url = "574844118613.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-api"
api_url = "https://api.chunsay.com"
audio_bucket_name = "english-learning-prod-audio"
db_endpoint = "english-learning-prod-postgres.cqvnhk955wry.ap-northeast-2.rds.amazonaws.com"
ecs_cluster_name = "english-learning-prod-cluster"
web_ecr_repository_url = "574844118613.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-web"
web_url = "https://chunsay.com"
worker_ecr_repository_url = "574844118613.dkr.ecr.ap-northeast-2.amazonaws.com/english-learning-prod-worker"


# AWS에 배포 방법
./infrastructure/scripts/deploy-aws.sh

# github 배포 방법
git status
git add .
git commit -m "Add analysis caching and expression memo support"
git push origin main


# 완료된 이슈
- tts로 s3에 생성된 mp3파일이 화면에서 tts 재생 클릭했을때 오류남(해결완료)
- stt로 텍스트 변환 한 결과에서 불명확한 변환을 수동으로 수정 후 저장하고, 수정한 텍스트를 기반으로 tts 수정하고 싶어(해결완료)
- 녹음 파일 업로드하면 STT로 변환되는데, 업로드한 음성파일을 재생해서 듣고싶어.(해결완료)
- 녹음 파일 업로드하면 STT로 변환되는데, 변환된 대화내역을 기반으로 영어표현을 생성하고 TTS를 생성하는데, 현재는 브라우져를 닫으면 이전에 녹음파일 업로드한것과 STT변환된 내용을 불러올수가 없는데, 이걸 다시 불러오고 싶어. 왜냐하면 긴 대화를 한번에 모두 영어표현과 TTS로 변경할 수가 없어.(해결완료)
- 말하기 테스트에서 직접 타이핑기능만 있는데, 마이크로 음성으로 말하는 기능(해결완료)
- AWS 서버에 배포(완료) 
- 영어포현 TTS에 한국어, 영어 복사기능(완료)
- 대화 전체를 앞뒤문맥을 고려해서 영어 문장을 생성하도록 llm에 맥락 전달 및 앞뒤 대화내용 전달(완료)
- 저장된 긴 녹음을 다시 불러온 뒤, 내 문장 기준으로 영어 표현 일괄 생성 / 남은 TTS 일괄 생성 기능 추가(완료)
- 말하기 테스트를 의미 기반 평가 + 코멘트형으로 개선(완료)
- 오늘의 복습을 최근 목록이 아니라 약점 우선 복습 구조로 개선(완료)
- 테스트 시 음성 테스트 하면 채점이 이상함 : 한국어로 STT가 이루어져 평가됨(예 : the bus is comming(O), 더버스이즈커밍(X))(완료)

# 현재 이슈
- 녹음, 변환 처리 시 worker 활용 적용 하였는데, 브라우저 녹음 시 분할 시 오류

# 다음 목표
- 문장 패턴 추출 및 패턴형 문제 출제 기능 설계 완료 : 복습에도 적용






# 새 대화 시작 문장
영어학습앱 개발 이어서 진행할게. STT + diarization + TTS까지 구현했고, 프로젝트 개발 개요 및 진행상태, 구성 등은 project_context.md  파일 참고해. 
