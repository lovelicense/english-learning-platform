import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

type ExportAssetType = 'korean' | 'english';
type ExportFormat = 'json' | 'csv';

type ExportPayload = {
  schemaVersion: string;
  assetType: ExportAssetType;
  exportedAt: string;
  itemCount: number;
  items: Array<Record<string, string | number | boolean | null>>;
};

const EXPORT_SCHEMA_VERSION = '2026-04-20.1';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAssets(userId: string, assetType: ExportAssetType, format: ExportFormat) {
    const items = assetType === 'korean'
      ? await this.buildKoreanAssets(userId)
      : await this.buildEnglishAssets(userId);

    const payload: ExportPayload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      assetType,
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    };

    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: `english-learning-${assetType}-assets-${this.buildDateStamp()}.csv`,
        body: `\uFEFF${this.toCsv(items)}`,
      };
    }

    return {
      contentType: 'application/json; charset=utf-8',
      fileName: `english-learning-${assetType}-assets-${this.buildDateStamp()}.json`,
      body: payload,
    };
  }

  private async buildKoreanAssets(userId: string): Promise<Array<Record<string, string | number | boolean | null>>> {
    const [utterances, savedSentences] = await Promise.all([
      (this.prisma as any).utterance.findMany({
        where: { recording: { userId } },
        orderBy: [{ recording: { createdAt: 'desc' } }, { startMs: 'asc' }],
        include: {
          expressions: {
            select: {
              id: true,
              englishBase: true,
              englishEasy: true,
              englishNatural: true,
            },
          },
          recording: {
            select: {
              id: true,
              fileName: true,
              audioKey: true,
              diarization: true,
              analysisSummary: true,
              analysisRelationship: true,
              analysisSituation: true,
              analysisTone: true,
              createdAt: true,
              updatedAt: true,
              participants: {
                include: {
                  personProfile: true,
                },
              },
              speakerProfiles: {
                include: {
                  personProfile: true,
                },
              },
            },
          },
        },
      }),
      (this.prisma as any).savedSentence.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          expressions: {
            select: {
              id: true,
              englishBase: true,
              englishEasy: true,
              englishNatural: true,
            },
          },
          participants: {
            include: {
              personProfile: true,
            },
          },
        },
      }),
    ]);

    const utteranceAssets = (utterances as any[]).map((utterance) => {
      const participantNames = ((utterance.recording?.participants ?? []) as any[])
        .map((item) => item.personProfile?.name)
        .filter(Boolean)
        .join(' | ');
      const speakerMappings = ((utterance.recording?.speakerProfiles ?? []) as any[])
        .map((item) => `${item.speakerLabel}:${item.personProfile?.name ?? ''}`)
        .join(' | ');
      const linkedExpressions = ((utterance.expressions ?? []) as any[])
        .map((expression) => expression.englishBase)
        .join(' | ');

      return {
        assetId: `utterance:${utterance.id}`,
        assetType: 'korean',
        sourceType: 'recording_utterance',
        sourceId: utterance.id,
        koreanText: utterance.koreanText,
        contextNote: utterance.contextNote ?? null,
        speakerLabel: utterance.speakerLabel,
        isMine: Boolean(utterance.isMine),
        startMs: utterance.startMs,
        endMs: utterance.endMs,
        analysisIntent: utterance.analysisIntent ?? null,
        conversationSummary: utterance.recording?.analysisSummary ?? null,
        relationship: utterance.recording?.analysisRelationship ?? null,
        situation: utterance.recording?.analysisSituation ?? null,
        tone: utterance.recording?.analysisTone ?? null,
        participantNames: participantNames || null,
        speakerMappings: speakerMappings || null,
        linkedExpressionCount: (utterance.expressions ?? []).length,
        linkedEnglishExpressions: linkedExpressions || null,
        recordingId: utterance.recording?.id ?? null,
        recordingFileName: utterance.recording?.fileName ?? null,
        recordingAudioKey: utterance.recording?.audioKey ?? null,
        diarizationEnabled: Boolean(utterance.recording?.diarization),
        createdAt: utterance.createdAt instanceof Date ? utterance.createdAt.toISOString() : null,
        sourceCreatedAt: utterance.recording?.createdAt instanceof Date ? utterance.recording.createdAt.toISOString() : null,
        sourceUpdatedAt: utterance.recording?.updatedAt instanceof Date ? utterance.recording.updatedAt.toISOString() : null,
      };
    });

    const savedSentenceAssets = (savedSentences as any[]).map((sentence) => {
      const participantNames = ((sentence.participants ?? []) as any[])
        .map((item) => item.personProfile?.name)
        .filter(Boolean)
        .join(' | ');
      const linkedExpressions = ((sentence.expressions ?? []) as any[])
        .map((expression) => expression.englishBase)
        .join(' | ');

      return {
        assetId: `saved_sentence:${sentence.id}`,
        assetType: 'korean',
        sourceType: 'saved_sentence',
        sourceId: sentence.id,
        koreanText: sentence.koreanText,
        contextNote: sentence.contextNote ?? null,
        speakerLabel: null,
        isMine: true,
        startMs: null,
        endMs: null,
        analysisIntent: sentence.analysisIntent ?? null,
        conversationSummary: sentence.analysisSummary ?? null,
        relationship: sentence.relationship ?? null,
        situation: sentence.situation ?? null,
        tone: sentence.tone ?? null,
        participantNames: participantNames || null,
        speakerMappings: null,
        linkedExpressionCount: (sentence.expressions ?? []).length,
        linkedEnglishExpressions: linkedExpressions || null,
        recordingId: null,
        recordingFileName: null,
        recordingAudioKey: null,
        diarizationEnabled: false,
        createdAt: sentence.createdAt instanceof Date ? sentence.createdAt.toISOString() : null,
        sourceCreatedAt: sentence.createdAt instanceof Date ? sentence.createdAt.toISOString() : null,
        sourceUpdatedAt: sentence.updatedAt instanceof Date ? sentence.updatedAt.toISOString() : null,
      };
    });

    return [...utteranceAssets, ...savedSentenceAssets];
  }

  private async buildEnglishAssets(userId: string): Promise<Array<Record<string, string | number | boolean | null>>> {
    const expressions = await (this.prisma as any).expression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        practiceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            score: true,
            createdAt: true,
            testType: true,
          },
        },
        _count: {
          select: {
            practiceLogs: true,
          },
        },
        patternMatches: {
          include: {
            patternTemplate: {
              include: {
                category: true,
              },
            },
          },
        },
        vocabularyMatches: {
          include: {
            vocabularyItem: {
              include: {
                category: true,
              },
            },
          },
        },
        utterance: {
          include: {
            recording: {
              include: {
                participants: {
                  include: {
                    personProfile: true,
                  },
                },
                speakerProfiles: {
                  include: {
                    personProfile: true,
                  },
                },
              },
            },
          },
        },
        savedSentence: {
          include: {
            participants: {
              include: {
                personProfile: true,
              },
            },
          },
        },
      },
    });

    return (expressions as any[]).map((expression) => {
      const source = expression.utterance ?? expression.savedSentence;
      const sourceType = expression.utterance ? 'recording_utterance' : 'saved_sentence';
      const participantNames = expression.utterance
        ? ((expression.utterance.recording?.participants ?? []) as any[]).map((item) => item.personProfile?.name).filter(Boolean).join(' | ')
        : ((expression.savedSentence?.participants ?? []) as any[]).map((item) => item.personProfile?.name).filter(Boolean).join(' | ');
      const patternLabels = ((expression.patternMatches ?? []) as any[])
        .map((match) => `${match.patternTemplate?.category?.code ?? ''}:${match.patternTemplate?.templateText ?? ''}`)
        .join(' | ');
      const vocabularyLabels = ((expression.vocabularyMatches ?? []) as any[])
        .map((match) => match.vocabularyItem?.lemma ?? '')
        .filter(Boolean)
        .join(' | ');
      const latestPractice = ((expression.practiceLogs ?? []) as any[])[0];

      return {
        assetId: `expression:${expression.id}`,
        assetType: 'english',
        sourceType,
        sourceId: source?.id ?? null,
        expressionId: expression.id,
        koreanText: expression.koreanText,
        englishBase: expression.englishBase,
        englishEasy: expression.englishEasy,
        englishNatural: expression.englishNatural,
        thinkInEnglish: expression.thinkInEnglish ?? null,
        note: expression.note ?? null,
        userMemo: expression.userMemo ?? null,
        sourceContextNote: expression.utterance?.contextNote ?? expression.savedSentence?.contextNote ?? null,
        analysisIntent: expression.utterance?.analysisIntent ?? expression.savedSentence?.analysisIntent ?? null,
        conversationSummary: expression.utterance?.recording?.analysisSummary ?? expression.savedSentence?.analysisSummary ?? null,
        relationship: expression.utterance?.recording?.analysisRelationship ?? expression.savedSentence?.relationship ?? null,
        situation: expression.utterance?.recording?.analysisSituation ?? expression.savedSentence?.situation ?? null,
        tone: expression.utterance?.recording?.analysisTone ?? expression.savedSentence?.tone ?? null,
        participantNames: participantNames || null,
        speakerLabel: expression.utterance?.speakerLabel ?? null,
        isMine: expression.utterance ? Boolean(expression.utterance.isMine) : true,
        recordingId: expression.utterance?.recording?.id ?? null,
        recordingFileName: expression.utterance?.recording?.fileName ?? null,
        utteranceStartMs: expression.utterance?.startMs ?? null,
        utteranceEndMs: expression.utterance?.endMs ?? null,
        ttsKey: expression.ttsKey ?? null,
        koreanTtsKey: expression.koreanTtsKey ?? null,
        practiceCount: expression._count?.practiceLogs ?? 0,
        latestPracticeScore: latestPractice?.score ?? null,
        latestPracticeTestType: latestPractice?.testType ?? null,
        latestPracticedAt: latestPractice?.createdAt instanceof Date ? latestPractice.createdAt.toISOString() : null,
        situationPromptKorean: expression.situationPromptKorean ?? null,
        situationPromptContext: expression.situationPromptContext ?? null,
        situationPromptTips: expression.situationPromptTips ?? null,
        patternMatchCount: (expression.patternMatches ?? []).length,
        patternMatches: patternLabels || null,
        vocabularyMatchCount: (expression.vocabularyMatches ?? []).length,
        vocabularyMatches: vocabularyLabels || null,
        createdAt: expression.createdAt instanceof Date ? expression.createdAt.toISOString() : null,
        updatedAt: expression.updatedAt instanceof Date ? expression.updatedAt.toISOString() : null,
      };
    });
  }

  private toCsv(rows: Array<Record<string, string | number | boolean | null>>) {
    if (rows.length === 0) {
      return '';
    }

    const columns = Array.from(
      rows.reduce<Set<string>>((acc, row) => {
        Object.keys(row).forEach((key) => acc.add(key));
        return acc;
      }, new Set<string>()),
    );

    const header = columns.map((column) => this.escapeCsv(column)).join(',');
    const body = rows
      .map((row) =>
        columns
          .map((column) => this.escapeCsv(row[column] ?? ''))
          .join(','),
      )
      .join('\n');

    return `${header}\n${body}`;
  }

  private escapeCsv(value: string | number | boolean | null) {
    const normalized = value === null ? '' : String(value);
    if (!/[",\n]/.test(normalized)) {
      return normalized;
    }
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  private buildDateStamp() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
