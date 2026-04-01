# 말하기 테스트 / 오늘의 복습 개선 설계

## 1. 목표

현재 테스트는 "정답 문장을 얼마나 비슷하게 재현했는지" 중심이다.
앞으로는 아래 역량을 직접 훈련하는 구조로 바꾼다.

- 한국어 상황/의도를 보고 영어로 직접 말하기
- 한국어 문장을 영어로 직접 작문하기
- 생성된 문장에서 패턴을 추상화해서 응용 말하기/작문하기
- 결과에 대해 왜 어색한지, 어떻게 고치면 좋은지 코멘트 받기
- 오늘의 복습을 "최근 목록"이 아니라 "약한 것 우선"으로 전환하기


## 2. 현재 구조 요약

### 2-1. 말하기 테스트

- 문제: 선택한 표현의 `koreanText`
- 정답 기준: 선택한 표현의 `englishBase`
- 답변 방식:
  - 텍스트 입력
  - 음성 녹음 후 영어 STT
- 채점 방식:
  - `englishBase`와 정확히 같으면 100점
  - 아니면 정답 문장의 단어가 얼마나 들어갔는지로 단순 점수 계산
- 피드백:
  - 고정 문구 3종 중 하나

즉, 현재는 "표현 암기 재현 테스트"에 가깝다.

### 2-2. 오늘의 복습

- 최근 생성한 표현 10개를 보여줌
- 각 표현의 최신 practice log 1개만 읽음
- 최신 점수를 `mastery`처럼 보여줌

즉, 현재는 진짜 복습 스케줄러라기보다 "최근 표현 목록"이다.


## 3. 핵심 문제

- 의미가 맞는 다양한 정답을 허용하지 못함
- 단어가 조금만 달라도 낮은 점수를 받을 수 있음
- 말하기/작문에서 왜 틀렸는지 구체 코멘트가 부족함
- 패턴 응용 훈련이 없음
- 복습 우선순위가 "최근 생성순"이라 약점 중심 학습이 안 됨


## 4. 목표 구조

### 4-1. 테스트 유형 분리

말하기 테스트를 아래 4가지 유형으로 확장한다.

- `translation`
  - 한국어 문장 1개를 영어로 말하거나 입력
- `situation`
  - 관계/상황/의도를 짧게 설명하고 영어로 답변
- `pattern`
  - 패턴을 제시하고 새로운 한국어 문장을 영어로 만들기
- `shadowing`
  - 기존처럼 표현을 보고 따라 말하기

초기 구현은 `translation` + `situation`부터 시작하고, 이후 `pattern`을 붙인다.

### 4-2. 평가 방식 변경

단순 문자열 비교 대신 LLM 평가를 사용한다.

평가 결과는 아래를 포함한다.

- 의미 전달 점수
- 자연스러움 점수
- 문법/표현 정확도 점수
- 발화/작문 총점
- 잘한 점
- 어색한 점
- 더 자연스러운 대안 1~2개
- 짧은 코칭 코멘트

### 4-3. 패턴 학습 추가

표현 생성 시 문장별 패턴 정보를 같이 저장한다.

예시:

- 표현: `That's why you can't do this.`
- 패턴 라벨: `That's why + clause`
- 의미 설명: "그래서 네가 ~~하는 거야"
- 슬롯 설명:
  - subject
  - modal / verb phrase
  - reason relation

복습에서는 같은 패턴으로 다른 한국어 문장을 문제로 낸다.

### 4-4. 오늘의 복습 재설계

오늘의 복습은 아래 우선순위 점수로 정렬한다.

- 최근 점수가 낮음
- 최근 2~3회 연속 오답
- 최근 복습 이후 시간이 오래 지남
- 말하기/작문 중 특정 유형에서 반복 약점
- 같은 패턴군에서 자주 틀림

즉 "최근 생성한 표현"이 아니라 "오늘 다시 봐야 할 카드"를 보여준다.


## 5. DB 변경안

### 5-1. Expression 확장

`Expression`에 패턴/복습 메타데이터를 추가한다.

- `patternKey String?`
- `patternLabel String?`
- `patternDescription String?`
- `reviewIntervalDays Int @default(1)`
- `nextReviewAt DateTime?`
- `lastReviewedAt DateTime?`
- `lastScore Int?`

설명:

- `patternKey`: 내부 그룹핑용 키
- `patternLabel`: 사용자에게 보여줄 패턴명
- `patternDescription`: 언제 쓰는 패턴인지 설명
- 나머지는 복습 스케줄 계산용

### 5-2. PracticeLog 확장

`PracticeLog`에 테스트 유형과 상세 평가를 저장한다.

- `mode String`
  - `text` / `voice`
- `testType String`
  - `translation` / `situation` / `pattern` / `shadowing`
- `promptKorean String?`
- `promptContext String?`
- `recognizedAnswer String?`
- `meaningScore Int?`
- `naturalnessScore Int?`
- `grammarScore Int?`
- `strengthComment String?`
- `correctionComment String?`
- `suggestedAnswer String?`
- `suggestedAnswerAlt String?`

설명:

- `answer`: 사용자가 최종 입력/발화한 답
- `recognizedAnswer`: 음성 STT 결과 원문
- 세부 점수와 코멘트는 리뷰 품질 향상에 사용


## 6. API 변경안

### 6-1. 표현 생성 시 패턴 추출 추가

현재 `generateExpressions()` 응답에 아래 필드를 추가한다.

- `patternKey`
- `patternLabel`
- `patternDescription`
- `usageNotes`
- `exampleTransforms`

LLM 프롬프트에서 "문장을 암기용 영어 표현으로 만들고, 재사용 가능한 패턴이 있으면 추상화해서 반환"하도록 요청한다.

### 6-2. 새 테스트 문제 생성 API

`POST /practice/prompts`

입력:

- `expressionId`
- `testType`

응답:

- `promptType`
- `promptKorean`
- `promptContext`
- `targetExpression`
- `patternLabel`
- `tips`

동작:

- `translation`: 기존 `koreanText` 기반
- `situation`: 관계/상황/의도 + 한국어 상황 설명 생성
- `pattern`: 해당 패턴으로 풀 수 있는 새 한국어 문장 생성

### 6-3. 새 평가 API

`POST /practice/evaluate`

입력:

- `expressionId`
- `testType`
- `mode`
- `answer`
- `promptKorean?`
- `promptContext?`

응답:

- `score`
- `meaningScore`
- `naturalnessScore`
- `grammarScore`
- `strengthComment`
- `correctionComment`
- `suggestedAnswer`
- `suggestedAnswerAlt`
- `target`
- `answer`

음성은 기존처럼:

- `POST /practice/voice/presign`
- `POST /practice/evaluate-voice`

로 유지하되, 내부 평가는 텍스트 평가 로직과 통합한다.

### 6-4. 리뷰 조회 API 개선

`GET /reviews/today`

응답 필드 추가:

- `reviewReason`
- `nextReviewAt`
- `patternLabel`
- `lastScore`
- `recommendedTestType`

우선순위 정렬:

- 낮은 점수
- overdue
- 최근 실패
- 패턴 약점


## 7. OpenAI 서비스 변경안

### 7-1. 표현 생성 프롬프트 확장

`generateExpressions()` 응답 스키마를 확장한다.

- `base`
- `easy`
- `natural`
- `note`
- `patternKey`
- `patternLabel`
- `patternDescription`

예:

- `patternKey`: `that_is_why_clause`
- `patternLabel`: `That's why + clause`
- `patternDescription`: "이유/결과를 연결하며 그래서 ~~하는 거라고 설명할 때"

### 7-2. 평가 전용 메서드 추가

`evaluatePracticeAnswer()`

입력:

- target expression
- test type
- korean prompt
- context
- user answer

출력:

- 총점
- 의미 점수
- 자연스러움 점수
- 문법 점수
- 잘한 점
- 수정 포인트
- 추천 답안

중요:

- 정답이 하나뿐이라고 가정하지 않는다
- 의미가 맞으면 고득점 허용
- 원어민이 실제로 쓸 표현인지 평가

### 7-3. 문제 생성 메서드 추가

`generatePracticePrompt()`

역할:

- 기존 표현을 기반으로 새 문제 생성
- 패턴형이면 다른 한국어 예문 생성
- 상황형이면 짧은 한국어 상황 설명 생성


## 8. UI 변경안

### 8-1. 말하기 테스트 영역

현재 1개 문제 -> 답변 -> 점수 구조를 아래처럼 개선한다.

- 테스트 유형 선택
  - 번역형
  - 상황형
  - 패턴형
  - 따라 말하기
- 문제 카드
  - 한국어 문장 또는 상황 설명
  - 관계/톤 힌트
  - 패턴 표시
- 답변 방식 선택
  - 텍스트
  - 음성
- 평가 결과 카드
  - 총점
  - 의미/자연스러움/문법 점수
  - 잘한 점
  - 더 자연스러운 표현
  - 다시 말해보기 버튼

### 8-2. 오늘의 복습 영역

현재 최근 리스트 -> 약점 중심 복습 카드로 변경한다.

카드 정보:

- 한국어 문제
- 영어 기준 표현
- 패턴 라벨
- 마지막 점수
- 왜 오늘 복습인지
- 추천 테스트 유형

액션:

- 번역형으로 풀기
- 상황형으로 풀기
- 패턴형으로 풀기
- TTS 듣기

### 8-3. 학습자 관점 지표

대시보드 상단에 아래 3개 지표를 추가하는 것이 좋다.

- 읽기 대비 말하기 약점 표현 수
- 최근 작문 약점 패턴 3개
- 오늘 꼭 다시 해야 할 복습 수


## 9. 구현 우선순위

### Phase 1

- Practice 평가를 LLM 기반으로 변경
- 세부 피드백 반환
- DB에 PracticeLog 상세 필드 추가

효과:

- 바로 "왜 틀렸는지" 코멘트를 줄 수 있음
- 말하기/작문 훈련 품질이 가장 먼저 좋아짐

### Phase 2

- 테스트 유형 `translation` / `situation` 추가
- 새 문제 생성 API 추가
- 오늘의 복습에 추천 테스트 유형 표시

효과:

- 단순 암기에서 상황형 산출 훈련으로 이동

### Phase 3

- 표현 생성 시 패턴 추출 저장
- 패턴형 문제 추가
- 패턴별 약점 추적

효과:

- 응용 작문/말하기 훈련 가능

### Phase 4

- 복습 우선순위 엔진 추가
- `nextReviewAt`, `reviewIntervalDays` 반영
- 진짜 spaced repetition으로 전환


## 10. 추천 시작점

다음 구현은 아래 순서가 가장 효율적이다.

1. `PracticeLog` 확장
2. `OpenAiService.evaluatePracticeAnswer()` 추가
3. `POST /practice/evaluate`, `POST /practice/evaluate-voice`로 평가 흐름 교체
4. 대시보드 평가 결과 UI 확장
5. 그 다음에 `situation` 문제 생성

이 순서면 DB/API/UI가 자연스럽게 이어지고, 사용자 체감 개선도 가장 빠르다.
