# Architecture

## Request flow
1. 웹앱이 presigned URL을 요청한다.
2. 오디오를 S3에 직접 업로드한다.
3. API는 transcription job을 큐에 넣는다.
4. Worker가 STT/화자분리/표현생성/TTS를 수행한다.
5. 결과는 PostgreSQL과 S3에 저장된다.
6. 웹앱은 polling 또는 websocket으로 상태를 반영한다.

## Key principles
- API는 빠른 응답만 담당하고 무거운 작업은 워커로 보낸다.
- OpenAI 연동은 `packages/ai`에 모은다.
- 비즈니스 규칙은 `packages/domain`에 둔다.
- DB 접근은 `packages/db` 저장소를 통해서만 수행한다.
