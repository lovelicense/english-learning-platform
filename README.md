# English Learning Platform

실행 가능한 스타트업형 영어학습 플랫폼 모노레포입니다.

## 이번 버전에 포함된 것
- JWT 회원가입 / 로그인
- PostgreSQL + Prisma 스키마
- S3 Presigned Upload
- OpenAI LLM 표현 생성
- OpenAI STT 오디오 전사
- OpenAI TTS 음성 생성
- 사용자별 표현/연습 로그 저장

## 빠른 시작
```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev:api
pnpm dev:web
```

PostgreSQL이 필요하면 아래를 먼저 실행하세요.
```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## 주요 API
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /recordings/presign`
- `POST /recordings/:id/process`
- `GET /recordings/:id`
- `POST /expressions/generate`
- `POST /expressions/:id/tts`
- `GET /expressions`
- `POST /practice/score`
- `GET /reviews/today`

## 동작 방식
### 1. 회원가입 / 로그인
JWT 토큰 발급 후 Bearer 토큰으로 API 호출

### 2. 녹음 업로드
`/recordings/presign` 호출 → S3에 직접 업로드 → `recordings/:id/process` 호출

### 3. STT
녹음 파일을 S3에서 읽어 OpenAI STT 호출 후 발화문 저장

### 4. LLM
발화문 또는 직접 입력한 한국어 문장을 영어 표현으로 생성해 DB 저장

### 5. TTS
표현의 기본 영어 문장을 음성으로 생성하고 S3에 저장

## 주의
- `OPENAI_API_KEY`가 없으면 표현/STT/TTS는 목업 응답으로 동작합니다.
- 실제 diarization 응답 파싱은 계정/모델 지원 상태에 맞게 추가 조정이 필요합니다.
- S3 버킷 정책과 CORS는 직접 설정해야 합니다.
