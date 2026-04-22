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


# AI 대화 자산화 확장 방향
기능 트랙을 아래 2개로 분리해서 설계

1. 영어 AI 대화 트랙 (`A + B + C`)
   - AI와 영어 대화
   - 대화 기록 저장
   - 대화 -> 다이얼로그 연습 변환
   - 내 영어 표현 자산 저장
   - 저장된 영어 표현은 기존 테스트/복습에 합류

2. 한국어 AI 대화 트랙 (`D`)
   - AI와 한국어 대화
   - 내 한국어 발화를 한국어 자산으로 저장
   - 이후 흐름은 기존 `녹음파일 업로드 -> STT 이후`와 같은 레벨의 파이프라인으로 연결
   - 즉 `한국어 자산화 -> 영어 표현 생성 -> TTS -> 테스트 -> 복습`

핵심 원칙:
- 영어 AI 대화는 `영어 자산화 채널`
- 한국어 AI 대화는 `한국어 원천 데이터 수집 채널`
- 대화 로그와 학습 자산은 분리해서 관리
- 기존 `Expression`, `SavedSentence`, `Practice` 흐름과 반드시 통합

상세 설계 문서:
- [AI 대화 자산화 설계안](./ai_conversation_asset_plan.md)


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

-Powershell에서 실행
docker desktop start
-wsl에서 실행
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
운영 테스트가 필요할 때 사용하는 명령.
- web/api/worker 이미지를 새로 빌드해서 ECR에 푸시
- RDS가 중지 상태면 자동으로 다시 시작
- ECS, ALB, NAT Gateway 등 운영 실행 리소스를 다시 생성/활성화
- 배포 마지막에 운영 RDS로 시드 작업을 자동 실행해서 `seed.ts`에 추가한 패턴/단어를 업서트
- 배포 후 `https://chunsay.com`, `https://api.chunsay.com` 으로 접근 가능

./infrastructure/scripts/deploy-aws.sh

참고:
- Terraform provider를 아직 한 번도 받지 않은 환경이면 최초 1회는 `infrastructure/terraform`에서 `terraform init` 또는 `deploy-aws.sh` 실행 시 인터넷 연결이 필요
- 로컬 DB에만 직접 넣어둔 데이터는 자동 복사되지 않음
- 운영에 반영되는 것은 현재 코드 기준 `apps/api/prisma/seed.ts` 내용
- 시드만 다시 넣고 싶으면 아래 명령으로 단독 실행 가능

./infrastructure/scripts/seed-aws.sh

# AWS 운영 자원 중지 방법
운영 테스트를 쉬는 동안 비용 절감을 위해 사용하는 명령.
- ECS, ALB, NAT Gateway, 관련 Route53 연결 등 운영 실행 리소스를 내림
- RDS와 S3는 유지해서 데이터는 보존
- RDS는 stop 요청만 하므로 AWS 정책상 최대 7일 후 자동 재시작될 수 있음
- 다시 운영 확인이 필요하면 아래 배포 명령을 다시 실행하면 됨

./infrastructure/scripts/stop-aws.sh

참고:
- 이미 `infrastructure/terraform/.terraform` 아래 provider가 내려받아진 상태라면 스크립트가 이를 재사용해서 불필요한 registry 재조회 없이 동작

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
- 생성된 영어 문장에 대한 검증 기능 추가 : 영어를 한국어로 역으로 변역, 번역시 이 문장이 언제 사용하는지도 예시 등 표시하게해서 사용자가 영어가 정확한 표현인지 확인
- 문장 패턴 추출 및 패턴형 문제 출제 기능 설계 완료 : 복습에도 적용
- 개인 언어 데이터 export 기능 설계
- 외부 AI와 연계 가능한 데이터 구조 정리
- 모바일 앱까지 고려한 장시간 녹음/업로드 구조 정리


# 제품 방향 재정의
이 프로젝트는 단순히 영어 문장을 생성하는 앱이 아니라,
"내가 실제로 자주 하는 한국어를 기반으로 영어 말하기 패턴과 단어를 자산화하고, 반복 훈련과 진도 관리로 말하기 자동화를 만드는 시스템"을 목표로 함

핵심 목표:
- 사용자가 실제로 하는 한국어 문장을 수집
- 영어 표현으로 변환
- 한국어/영어 TTS와 복습으로 반복 훈련
- 한국어를 보고 1초 안에 영어로 반응할 수 있는 상태를 목표로 함
- 결과적으로 CEFR A1~A2 수준의 기본 일상 상호작용 출발선을 만드는 방향

중요한 기준:
- CEFR는 "무엇을 할 수 있는가"를 설명하는 기능 기준이며, 패턴 수나 단어 수를 공식 고정하지 않음
- 따라서 서비스에서는 "CEFR A1~A2 기능 기준을 참고한 앱 내부 목표 자산"을 정의해서 사용
- 사용자에게는 국제 기준을 참고한 목표 구조와, 현재 나의 위치/진도율을 함께 보여주는 방향


# 영어 문장 패턴 자산화 설계
핵심 개념:
- 문장 모음보다 "재사용 가능한 패턴 템플릿"이 중요
- 저장 개수보다 "유형별 커버리지"가 중요
- 공부했다보다 "자동화됐다"를 보여주는 것이 중요


# 2026-04-14 작업 메모

## 최근 결정한 방향
- 영어 학습 목표를 `내가 실제로 하는 한국어를 영어 말하기 패턴과 단어 자산으로 바꾸는 시스템`으로 재정의
- CEFR A1~A2는 `공식 숫자`가 아니라 `기능 기준`으로 참고하고, 패턴/단어 목표치는 앱 내부 자산으로 운영
- 패턴은 `문장 예시`가 아니라 `재사용 가능한 템플릿`으로 관리
- 단어도 별도 자산 DB로 관리하고, 표현/패턴과 연결해서 현재 보유량과 학습 가능량을 보여주는 방식으로 운영
- 패턴/단어 진도는 `수집률`, `자동화율`, `1초 응답 통과율` 같은 KPI로 시각화
- 수집률은 `활성 표현 기준`으로 계산
- 자동화율은 학습 이력 기준으로 유지
- 표현을 삭제해도 이미 쌓인 패턴/단어 학습 이력은 유지

## 현재 구현된 자산 구조
- `PatternCategory`, `PatternTemplate`, `ExpressionPatternMatch`, `UserPatternProgress`
- `VocabularyCategory`, `VocabularyItem`, `VocabularyVariant`, `ExpressionVocabularyMatch`, `UserVocabularyProgress`
- 대시보드에서 패턴/단어 자산을 조회하고, 각 항목별로 매핑된 내 표현도 함께 확인 가능
- 패턴/단어 자산 화면은 기본 접힘 상태로 두고, 필요할 때만 펼쳐서 보는 UI로 운영
- 패턴/단어 자산과 진도 카드에는 전체 건수, 카테고리별 건수, 수집 수, 자동화 수를 함께 표시

## 말하기 테스트 / 복습 흐름
- 말하기 테스트 기본 모드는 `음성 답변`
- `오늘의 복습`은 카드 하나씩 수동 진행이 아니라 연속 진행이 가능하도록 개선
- 복습에는 `한국어 문제 읽기` 옵션을 추가
- 복습 질문은 브라우저 TTS로 읽고, 읽기 종료 후 답변을 시작하는 흐름으로 운영
- 답변 속도는 `종료 시간`이 아니라 `답변 시작 시점` 기준으로 판정
- 텍스트 답변은 `첫 타이핑 시작 시간` 기준
- 음성 답변은 `녹음 시작 시간` 기준
- 3초 안에 답변 시작을 못 하면 오답으로 간주

## 최근 UI 정리
- PC와 모바일 네비게이션에 `개인 인물 사전`, `패턴 / 단어 진도`, `패턴 / 단어 DB 보기`, `패턴 자산`, `단어 자산`을 포함
- `패턴 / 단어 DB 보기`, `패턴 / 단어 진도`, `개인 인물 사전`은 기본 접기 상태
- 패턴 자산과 단어 자산은 각각 별도 접기/펼치기 가능
- 통계 영역에는 `?` 도움말 아이콘을 붙여 각 KPI의 계산 기준을 설명

## 앞으로 이어갈 작업
- 패턴/단어 자산 시드 확장
- 패턴/단어 자동 매칭 규칙 고도화
- 대시보드 KPI 계산식과 문구 정제
- 복습 자동 진행을 더 안정적으로 다듬기
- 패턴/단어 export 구조 설계

패턴 관리 방향:
- A1/A2 + 유형별 패턴 목표 DB를 미리 정의
- 사용자가 영어 표현을 생성하거나 TTS를 만들면, 그 표현이 어떤 패턴 유형인지 분류
- 사용자가 현재까지 어떤 패턴을 얼마나 수집했고, 얼마나 자동화했는지 보여줌

예시:
- A1 요청: `Could you ~?`, `Can you ~?`, `Could you please ~?`
- A1 되묻기: `Could you say that again?`, `What do you mean?`, `Do you mean ~?`
- A1 감정표현: `I'm tired.`, `I'm worried about ~.`
- A2 의견 말하기: `I think ~.`, `In my opinion, ~.`
- A2 이유 설명: `The reason is ~.`, `It's because ~.`
- A2 제안/조율: `Why don't we ~?`, `Does ~ work for you?`

권장 카테고리:
- A1: 요청, 허가/가능 여부, 되묻기/이해 확인, 동의/비동의, 거절/보류, 감정/상태 표현, 감사/사과, 위치/가격/기본 정보 묻기
- A2: 의견 말하기, 이유 설명, 제안, 일정 조율, 비교/선호, 문제 설명, 계획/의도, 부드러운 반대/조정

권장 구조:
- `pattern_category`
- `pattern_template`
- `expression_pattern_match`
- `user_pattern_progress`

세부 모델 개념:
- `pattern_category`
  - level (`A1`, `A2`)
  - code (`request`, `clarification`, `opinion`)
  - name_ko / name_en
  - target_count
- `pattern_template`
  - template_text (`Could you ~?`)
  - meaning_ko
  - usage_note
  - example_en / example_ko
- `expression_pattern_match`
  - expression_id
  - pattern_template_id
  - confidence
  - matched_by (`rule`, `llm`, `manual`)
- `user_pattern_progress`
  - user_id
  - pattern_template_id
  - status (`collected`, `recognized`, `practicing`, `usable_in_speaking`, `automated`)


# 영어 단어 자산화 설계
핵심 개념:
- 패턴은 말하기의 틀이고, 단어는 그 틀 안에 들어가는 실제 재료
- 단어도 단순히 "본 적 있음"이 아니라 "말하기에 사용할 수 있음"까지 관리해야 함

단어 관리 방향:
- A1 핵심 단어, A2 확장 단어 목표 DB를 별도로 정의
- 각 단어는 수준, 품사, 뜻, 예문, 카테고리 정보를 가짐
- 사용자의 영어 표현 안에 포함된 단어를 추출해서 수집 현황을 누적
- 이후 테스트 결과를 통해 "인식", "말하기 사용 가능", "자동화"를 구분

권장 목표 예시:
- A1 핵심 단어 500
- A2 확장 단어 800

권장 구조:
- `vocabulary_category`
- `vocabulary_item`
- `vocabulary_variant`
- `expression_vocabulary_match`
- `user_vocabulary_progress`
- `vocabulary_goal`

세부 모델 개념:
- `vocabulary_item`
  - level (`A1`, `A2`)
  - lemma
  - part_of_speech
  - meaning_ko
  - example_en / example_ko
  - frequency_rank
  - is_core
- `expression_vocabulary_match`
  - expression_id
  - vocabulary_item_id
  - confidence
  - matched_by (`rule`, `llm`, `manual`)
- `user_vocabulary_progress`
  - user_id
  - vocabulary_item_id
  - status (`collected`, `recognized`, `practicing`, `usable_in_speaking`, `automated`)
  - success_count / fail_count
  - response_within_1s_count

단어 자산 구축 원칙:
- 외부 자료(English Vocabulary Profile, Oxford 3000, NGSL 등)를 참고하되 그대로 복제하지 않고 앱 목표에 맞게 선별
- 고빈도, 생활 회화 적합성, 패턴과의 결합 가능성을 우선
- 처음부터 전체를 완벽하게 만들기보다 A1 핵심어부터 시드 데이터를 쌓고 확장


# 진도 관리 설계
핵심 원칙:
- 단순 문장 수가 아니라 "패턴"과 "단어" 두 축으로 진도를 관리
- 사용자는 목표가 몇 개인지, 현재 몇 개를 수집했고, 그중 몇 개를 실제로 말할 수 있는지 보게 함

추천 KPI:
- 패턴 수집률
- 패턴 자동화율
- 단어 수집률
- 단어 말하기 사용 가능률
- 1초 응답 통과율
- A1 진행률 / A2 진행률

정의:
- 패턴 수집률
  - 목표 패턴 중 사용자가 실제 표현을 통해 확보한 패턴의 비율
- 패턴 자동화율
  - 목표 패턴 중 사용자가 한국어를 보고 거의 바로 영어로 꺼낼 수 있게 된 패턴의 비율
- 단어 수집률
  - 목표 단어 중 사용자의 표현/학습 기록에 연결된 단어의 비율
- 단어 말하기 사용 가능률
  - 목표 단어 중 실제 말하기 테스트에서 사용 가능한 상태로 확인된 단어의 비율

예시:
- A1 요청 수집 `12 / 20`
- A1 요청 자동화 `7 / 20`
- A2 의견 말하기 수집 `5 / 25`
- A1 단어 수집 `143 / 500`
- A1 단어 말하기 사용 가능 `61 / 500`
- 1초 응답 통과율 `64%`

패턴/단어 상태 단계:
- `collected`
- `recognized`
- `practicing`
- `usable_in_speaking`
- `automated`

`automated` 의미:
- 한국어 prompt를 보고 1초 안에 영어로 말 시작 가능
- 핵심 의미 전달 성공
- 최근 반복 테스트에서 안정적으로 통과
- 단순 1회 정답이 아니라, 어느 정도 반복된 자동 반응 상태

초기 MVP에서는 너무 복잡하게 가지 않고, 아래 정도로 시작 가능:
- `collected`
- `practicing`
- `usable_in_speaking`
- `automated`


# 대시보드 방향
사용자에게 보여줄 핵심은 "현재 위치"와 "목표 대비 진도율"임

권장 대시보드 카드:
- `30일 목표`
- `A1 진행률`
- `A2 진행률`
- `패턴 수집률`
- `패턴 자동화율`
- `단어 수집률`
- `말하기 사용 가능 단어 수`
- `1초 응답 통과율`
- `가장 부족한 유형 Top 3`

예시 문구:
- `30일 목표: 생활 회화 패턴 60개 자동화`
- `A1 진행률 38%`
- `A2 진행률 12%`
- `사용 가능 단어 62개`
- `부족한 유형: 거절 / 되묻기 / 의견 말하기`


# 자동 분류 및 데이터 흐름
목표 흐름:
1. 사용자가 한국어 문장을 저장
2. 영어 표현 생성
3. 영어/한국어 TTS 생성
4. 영어 표현을 패턴 템플릿과 매핑
5. 영어 표현에 포함된 핵심 단어 추출
6. 패턴/단어 수집률 갱신
7. 복습/테스트를 통해 `usable_in_speaking`, `automated` 상태 갱신
8. 대시보드에서 A1/A2별 현황과 진도율 표시

분류 방식:
- 초기에는 규칙 기반 + 수동 보정 가능 구조
- 이후 LLM 기반 분류를 추가해서 정확도 향상
- 최종적으로는 `rule + llm + manual` 혼합 구조를 목표


# 단계별 구현 우선순위
1단계:
- `pattern_category`, `pattern_template` 모델 설계
- A1/A2 패턴 시드 데이터 1차 구축
- 표현 생성 시 패턴 분류/매핑 구조 추가
- 대시보드에 패턴 수집률 표시

2단계:
- `vocabulary_item`, `user_vocabulary_progress` 모델 설계
- A1 핵심 단어 시드 데이터 구축
- 표현-단어 매칭 구조 추가
- 대시보드에 단어 수집률 표시

3단계:
- 패턴/단어 복습 결과와 테스트 결과를 progress 상태에 반영
- `usable_in_speaking`, `automated` 판정 기준 도입
- 1초 응답 통과율 집계

4단계:
- 약점 기반 복습 추천 강화
- A1/A2 유형별 부족 영역 분석
- 패턴형 문제 출제 및 진도 연동




# 2026-04-09 모바일 앱 아키텍처/작업 메모

## 결정한 모바일 아키텍처
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

## 모바일에서 작업한 내용
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

## 웹/백엔드에서 같이 반영한 관련 내용
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

## 모바일 관련 할 작업
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






# 새 대화 시작 문장
영어학습앱 개발 이어서 진행할게. STT + diarization + TTS까지 구현했고, 프로젝트 개발 개요 및 진행상태, 구성 등은 project_context.md  파일 참고해. 
