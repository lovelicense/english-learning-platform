import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  PrismaClient,
  RecordingJobStatus,
  RecordingPartStatus,
  RecordingSessionStatus,
  RecordingStatus,
} from '@prisma/client';
import OpenAI, { toFile } from 'openai';

const prisma = new PrismaClient();
const bucket = process.env.AWS_S3_BUCKET ?? 'dev-bucket';
const region = process.env.AWS_REGION ?? 'ap-northeast-2';
const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const workerName = process.env.WORKER_NAME ?? `worker-${process.pid}`;
const retryDelaysMs = [15_000, 60_000, 180_000];

const s3 = new S3Client({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

let shuttingDown = false;
let running = false;

async function getObjectBuffer(key: string) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function transcribeAudio(buffer: Buffer, fileName: string, diarization = true) {
  if (!openai) {
    return {
      utterances: [
        { speakerLabel: 'speaker_1', startMs: 0, endMs: 1800, koreanText: '샘플 전사 결과입니다.' },
      ],
    };
  }

  const file = await toFile(buffer, fileName);
  try {
    const createTranscription = async (useDiarization: boolean) =>
      openai.audio.transcriptions.create({
        file,
        model: useDiarization
          ? process.env.OPENAI_STT_DIARIZE_MODEL ?? 'gpt-4o-transcribe-diarize'
          : process.env.OPENAI_STT_MODEL ?? 'gpt-4o-mini-transcribe',
        language: 'ko',
        response_format: useDiarization ? 'diarized_json' : 'json',
        ...(useDiarization ? { chunking_strategy: 'auto' } : {}),
      } as any);

    let result = await createTranscription(diarization);

    if (diarization) {
      const segments = ((result as any).segments ?? []) as Array<{
        speaker?: string;
        text?: string;
        start?: number;
        end?: number;
      }>;

      let utterances = segments
        .filter((segment) => segment.text && segment.text.trim().length > 0)
        .map((segment, index) => ({
          speakerLabel: segment.speaker?.toLowerCase() ?? `speaker_${index + 1}`,
          startMs: Math.round((segment.start ?? 0) * 1000),
          endMs: Math.round((segment.end ?? 0) * 1000),
          koreanText: segment.text!.trim(),
        }));

      if (utterances.length === 0) {
        result = await createTranscription(false);
        const fallbackText = ((result as any).text ?? '').trim();
        if (fallbackText) {
          utterances = [
            {
              speakerLabel: 'speaker_1',
              startMs: 0,
              endMs: 2000,
              koreanText: fallbackText,
            },
          ];
        }
      }

      return { utterances };
    }

    return {
      utterances: [
        {
          speakerLabel: 'speaker_1',
          startMs: 0,
          endMs: 2000,
          koreanText: ((result as any).text ?? '').trim(),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/audio duration .* longer than .* maximum/i.test(message)) {
      throw new Error(
        '오디오 길이가 너무 깁니다. 현재 모델은 약 23분까지만 처리할 수 있어요. 파일을 더 짧게 나눠 업로드해 주세요.',
      );
    }
    throw error;
  }
}

function isRetryableTranscriptionError(message: string) {
  return (
    /\b500\b/.test(message) ||
    /\b502\b/.test(message) ||
    /\b503\b/.test(message) ||
    /\b504\b/.test(message) ||
    /\b429\b/.test(message) ||
    /bad gateway/i.test(message) ||
    /rate limit/i.test(message) ||
    /timeout/i.test(message) ||
    /network/i.test(message) ||
    /connection/i.test(message)
  );
}

async function recomputeSessionStatus(sessionId: string) {
  const jobs = await prisma.recordingJob.findMany({
    where: { sessionId },
    select: { status: true, runAfter: true },
  });

  let nextStatus: RecordingSessionStatus = RecordingSessionStatus.UPLOADED;
  if (jobs.some((job) => job.status === RecordingJobStatus.PROCESSING)) {
    nextStatus = RecordingSessionStatus.PROCESSING;
  } else if (jobs.some((job) => job.status === RecordingJobStatus.QUEUED)) {
    nextStatus = RecordingSessionStatus.QUEUED;
  } else if (jobs.some((job) => job.status === RecordingJobStatus.FAILED)) {
    nextStatus = RecordingSessionStatus.FAILED;
  } else if (jobs.length > 0 && jobs.every((job) => job.status === RecordingJobStatus.COMPLETED)) {
    nextStatus = RecordingSessionStatus.PROCESSED;
  }

  await prisma.recordingSession.update({
    where: { id: sessionId },
    data: {
      status: nextStatus,
      errorMessage: nextStatus === RecordingSessionStatus.FAILED ? '일부 파트 처리에 실패했습니다.' : null,
    },
  });
}

async function claimNextJob() {
  const candidate = await prisma.recordingJob.findFirst({
    where: {
      status: RecordingJobStatus.QUEUED,
      type: 'TRANSCRIBE_PART',
      OR: [{ runAfter: null }, { runAfter: { lte: new Date() } }],
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  if (!candidate) return null;

  const claimed = await prisma.recordingJob.updateMany({
    where: { id: candidate.id, status: RecordingJobStatus.QUEUED },
    data: {
      status: RecordingJobStatus.PROCESSING,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) return null;

  return prisma.recordingJob.findUnique({
    where: { id: candidate.id },
    include: {
      part: {
        include: {
          session: true,
          recording: true,
        },
      },
      session: true,
    },
  });
}

async function processTranscribePartJob(job: Awaited<ReturnType<typeof claimNextJob>>) {
  if (!job?.part || !job.session) return;

  const diarization = Boolean((job.payload as any)?.diarization ?? true);
  const part = job.part;
  const session = job.session;

  await prisma.recordingPart.update({
    where: { id: part.id },
    data: { status: RecordingPartStatus.PROCESSING, errorMessage: null },
  });
  await prisma.recordingSession.update({
    where: { id: session.id },
    data: { status: RecordingSessionStatus.PROCESSING, errorMessage: null },
  });
  console.log(
    `[worker] started job=${job.id} session=${session.id} part=${part.partNumber} attempt=${job.attempts}/${job.maxAttempts}`,
  );

  try {
    const buffer = await getObjectBuffer(part.audioKey);
    const transcription = await transcribeAudio(buffer, part.fileName, diarization);
    const recording =
      part.recordingId && part.recording
        ? await prisma.recording.update({
            where: { id: part.recordingId },
            data: {
              audioKey: part.audioKey,
              fileName: part.fileName,
              diarization,
              status: RecordingStatus.PROCESSING,
            },
          })
        : await prisma.recording.create({
            data: {
              userId: session.userId,
              audioKey: part.audioKey,
              fileName: part.fileName,
              diarization,
              status: RecordingStatus.PROCESSING,
            },
          });

    await prisma.$transaction([
      prisma.utterance.deleteMany({ where: { recordingId: recording.id } }),
      ...transcription.utterances.map((utterance) =>
        prisma.utterance.create({
          data: {
            recordingId: recording.id,
            speakerLabel: utterance.speakerLabel,
            koreanText: utterance.koreanText,
            startMs: utterance.startMs,
            endMs: utterance.endMs,
            isMine: utterance.speakerLabel === 'speaker_1',
          },
        }),
      ),
      prisma.recording.update({
        where: { id: recording.id },
        data: { status: RecordingStatus.PROCESSED },
      }),
      prisma.recordingPart.update({
        where: { id: part.id },
        data: {
          recordingId: recording.id,
          status: RecordingPartStatus.PROCESSED,
          errorMessage: null,
        },
      }),
      prisma.recordingJob.update({
        where: { id: job.id },
        data: {
          status: RecordingJobStatus.COMPLETED,
          completedAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);

    await recomputeSessionStatus(session.id);
    console.log(`[worker] completed job=${job.id} session=${session.id} part=${part.partNumber}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = isRetryableTranscriptionError(message);
    const hasAttemptsLeft = job.attempts < job.maxAttempts;

    if (retryable && hasAttemptsLeft) {
      const delayMs = retryDelaysMs[Math.min(job.attempts - 1, retryDelaysMs.length - 1)] ?? retryDelaysMs[retryDelaysMs.length - 1];
      const runAfter = new Date(Date.now() + delayMs);
      await prisma.$transaction([
        prisma.recordingPart.update({
          where: { id: part.id },
          data: { status: RecordingPartStatus.UPLOADED, errorMessage: `재시도 예정: ${message}` },
        }),
        prisma.recordingJob.update({
          where: { id: job.id },
          data: {
            status: RecordingJobStatus.QUEUED,
            errorMessage: message,
            runAfter,
          },
        }),
      ]);
      await recomputeSessionStatus(session.id);
      console.warn(
        `[worker] retry scheduled job=${job.id} session=${session.id} part=${part.partNumber} next_attempt=${job.attempts + 1}/${job.maxAttempts} delay_ms=${delayMs} error=${message}`,
      );
      return;
    }

    await prisma.$transaction([
      prisma.recordingPart.update({
        where: { id: part.id },
        data: { status: RecordingPartStatus.FAILED, errorMessage: message },
      }),
      prisma.recordingJob.update({
        where: { id: job.id },
        data: {
          status: RecordingJobStatus.FAILED,
          errorMessage: message,
        },
      }),
    ]);
    await recomputeSessionStatus(session.id);
    console.error(`[worker] failed job=${job.id} session=${session.id} part=${part.partNumber} error=${message}`);
  }
}

async function tick() {
  if (running || shuttingDown) return;
  running = true;
  try {
    const job = await claimNextJob();
    if (job) {
      await processTranscribePartJob(job);
    }
  } finally {
    running = false;
  }
}

async function shutdown() {
  shuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  await prisma.$connect();
  console.log(`[worker] started ${workerName}`);
  await tick();
  const timer = setInterval(() => void tick(), pollIntervalMs);

  process.on('SIGINT', async () => {
    clearInterval(timer);
    await shutdown();
  });
  process.on('SIGTERM', async () => {
    clearInterval(timer);
    await shutdown();
  });
}

void main().catch(async (error) => {
  console.error('[worker] fatal', error);
  await prisma.$disconnect();
  process.exit(1);
});
