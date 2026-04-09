# 프로젝트 개요
내가 실제로 말한 언어를 수집하고, 정제하고, 학습하고, 다양한 AI와 다시 연결해 활용하는 개인 언어 데이터 플랫폼 개발 중

서비스 정의:
일상에서 내가 말한 음성과 문장을 모아 텍스트로 정리하고, 상황과 의도까지 구조화해 학습과 다양한 AI 활용으로 이어주는 서비스

현재 핵심 목표:
내가 실제로 하는 한국어 말을 영어 표현으로 학습하면서, 그 과정을 개인 언어 데이터로 계속 축적

서비스 핵심 축:
1. 수집
   - 브라우저 녹음
   - 파일 업로드
   - 향후 모바일 앱 녹음
2. 정제
   - STT (한국어 → 텍스트)
   - 화자 분리 (diarization)
   - 문장 수정 / 메모 / 맥락 입력
3. 구조화
   - 문장, 화자, 시간축, 대화요약, 발화 의도, 영어 표현, TTS 메타데이터 저장
4. 학습
   - 영어 표현 생성
   - TTS
   - 말하기 테스트
   - 반복 복습
5. 재활용
   - 향후 JSON / CSV / Markdown export
   - 다양한 AI 서비스와 연계 가능한 데이터 자산화

현재 제품 포지션:
영어 학습 기능을 포함한 개인 언어 데이터 관리 서비스

핵심 데이터 관점:
- 가장 중요한 원천 데이터는 한국어 표현과 그 표현이 나온 맥락/상황
- 영어 표현, 영어 음성(TTS), 테스트 문제는 이 원천 데이터를 바탕으로 다시 생성 가능한 파생 데이터
- 따라서 서비스의 핵심 자산은 "내가 실제로 말한 한국어 문장 + 화자 + 상황 + 의도 + 시간축" 데이터

데이터 우선순위:
1. 원천 데이터
   - 한국어 문장
   - 원본 오디오
   - 화자
   - 시간축
   - 관계 / 상황 / 톤
   - 발화 의도
2. 정제 데이터
   - 수정된 문장
   - 대화요약
   - 메모
   - 태그
   - 세션/녹음 단위 구조
3. 파생 데이터
   - 영어 표현
   - 영어 쉬운형 / 자연형
   - 영어 음성(TTS)
   - 말하기 테스트 프롬프트
   - 복습 데이터

Export 방향:
- 가장 우선적으로 export해야 하는 것은 영어 결과물보다 한국어 원문 + 맥락 + 정제 데이터
- 향후 JSON / CSV / Markdown / ZIP 형태 export 지원 목표
- 다른 AI 서비스나 개인 워크플로우에서 다시 활용할 수 있는 구조를 목표로 함


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


#개발 시 고려사항
향후 모바일앱(iOS, 안드로이드) 확장 고려해서 설계, 개발

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
✔ 저장된 녹음 다시 불러오기
✔ STT 문장 수정 후 표현 생성
✔ 말하기 테스트(텍스트/음성)
✔ 오늘의 복습
✔ worker 기반 비동기 처리 구조 도입
✔ 긴 수동 업로드 분할 처리

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
- 영어음성 생성되어 있으면 'TTS생성'을 'TTS재생성'으로 버튼명 변경(완료)
- 브라우저 녹음 시 녹음 시간 표시(완료)
# 현재 이슈


# 다음 목표
- TTS 완료 표현 모아보기에서 전체를 연속 재생, 한문장 3번 반복재생+전체 연속재생
- 생성된 영어 문장에 대한 검증 기능 추가 : 영어를 한국어로 역으로 변역, 번역시 이 문장이 언제 사용하는지도 예시 등 표시하게해서 사용자가 영어가 정확한 표현인지 확인
- 문장 패턴 추출 및 패턴형 문제 출제 기능 설계 완료 : 복습에도 적용
- 개인 언어 데이터 export 기능 설계
- 외부 AI와 연계 가능한 데이터 구조 정리
- 모바일 앱까지 고려한 장시간 녹음/업로드 구조 정리






# 새 대화 시작 문장
영어학습앱 개발 이어서 진행할게. STT + diarization + TTS까지 구현했고, 프로젝트 개발 개요 및 진행상태, 구성 등은 project_context.md  파일 참고해. 


# 2026-04-09 모바일 앱 아키텍처/작업 메모

## 오늘 결정한 모바일 아키텍처
- 프로젝트 분리 없이 기존 monorepo 안에 `apps/mobile` 추가
- 모바일 기술 스택은 `React Native + Expo + Expo Router` 기준으로 진행
- 기존 `apps/api`, `apps/worker`, `packages/*`를 최대 재사용
- 모바일은 웹을 그대로 옮기기보다, 모바일 전용 UX로 별도 화면 구조 설계
- 우선순위는 `장시간 녹음 안정성 -> 세션 업로드 -> STT 결과 확인`
- 모바일 녹음은 웹과 동일하게 `recording session` 기반으로 처리
- 핵심 흐름:
  1. 모바일 앱에서 녹음 세션 생성
  2. 오디오를 파트 단위로 업로드
  3. 세션 finalize
  4. process enqueue
  5. worker가 STT/diarization 처리
  6. 모바일에서 상태 polling 및 결과 확인
- 모바일 확인 시 기본 실행 조합:
  - `pnpm dev:mobile`
  - `pnpm dev:api`
  - `pnpm dev:worker`
- `dev:web`은 모바일 기능 확인에는 필수 아님

## 오늘 모바일에서 작업한 내용
- `docs/android_mobile_plan.md` 문서 추가
- `apps/mobile` 스캐폴딩 추가
- Expo Router 기반 기본 탭 구조 추가
- 로그인 화면, 홈 화면, 녹음/표현/복습/설정 placeholder 화면 추가
- 모바일용 API base URL, auth 저장 로직 추가
- 로그인 시 기존 `/auth/login`, `/auth/me` API 재사용하도록 연결
- 토큰 저장은 네이티브에서는 `expo-secure-store`, 웹 preview에서는 `localStorage` fallback 사용
- Expo SDK 52 기준으로 모바일 의존성 버전 조정
- `babel.config.js`에서 deprecated 설정 제거
- `react-native-web`, `@babel/runtime` 등 실행에 필요한 패키지 정리
- `pnpm dev:mobile`로 Expo 앱 구동 확인
- 모바일 홈 화면에서 세션 상태 확인 가능하게 구현
- 모바일 `record` 화면에서 아래 기능 구현
  - `MOBILE` source 기준 녹음 세션 생성
  - 세션 상태 조회
  - 권장 파트 길이 / 최대 길이 표시
  - `Finalize`, `Process`, `상태 새로고침` 버튼 추가
  - 세션 상태 polling
  - 업로드 파트 목록 표시
  - 작업(job) 큐 목록 표시
- 타입 체크 확인:
  - `pnpm --filter @elp/mobile exec tsc --noEmit` 통과

## 오늘 웹/백엔드에서 같이 반영한 관련 내용
- 분석 모드 기본값을 `수동`으로 변경
- `대화요약`, `문장의도`는 값이 없어도 화면에 항상 보이도록 수정
- 맥락 힌트 `저장` 버튼 및 분석 상태 표시 추가
- 문장 수정/삭제 후 자동 분석 시 intent가 사라지는 문제 보완
- `TTS생성` -> `TTS재생성` 버튼명 변경
- 브라우저 녹음/원클릭 녹음 시 녹음 시간 표시 강화
- 브라우저 녹음 업로드 전 WAV 정규화 처리 추가
- `TTS 완료 표현 모아보기`에 전체 연속 재생 / 문장 반복 / 반복 간 텀 옵션 추가
- 영어표현 생성 시 `base/easy/natural/note` 의미 일관성 강화
- 말하기 테스트 채점 시 한국어 원문 우선, 대화 요약/발화 의도까지 참고하도록 개선

## 내일 할 작업
- 모바일에서 실제 Expo 오디오 녹음 붙이기
- 녹음 파일을 파트 단위로 `presign -> upload -> complete` 연결
- 모바일에서 `finalize -> process -> polling`을 실제 업로드 결과와 연결
- 세션 처리 완료 후 STT 결과 목록/상세 화면 설계
- 모바일 로그인 UX 다듬기
- 안드로이드 실기기 기준으로 녹음/업로드 안정성 확인
- 필요 시 모바일 업로드 실패 재시도 정책 설계

## 참고 메모
- 모바일 로그인은 별도 모바일 계정이 아니라 기존 웹/서비스 계정 사용
- 웹 로그인 화면 기본 입력값은 `demo@example.com / password123`
- 이 값은 기본 입력값일 뿐, 실제 DB 계정이 없으면 회원가입 필요
