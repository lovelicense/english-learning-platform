import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ExpressionsService } from '../expressions/expressions.service';
import { LearningAssetsService } from '../learning-assets/learning-assets.service';
import { OpenAiService } from '../openai/openai.service';
import { StorageService } from '../storage/storage.service';
import { AssistConversationReplyDto } from './dto/assist-conversation-reply.dto';
import { CreateConversationSessionDto } from './dto/create-session.dto';
import { RespondConversationDto } from './dto/respond-conversation.dto';

@Injectable()
export class AiConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
    private readonly expressionsService: ExpressionsService,
    private readonly learningAssetsService: LearningAssetsService,
  ) {}

  private normalizeSessionTitleSource(text: string) {
    return text.replace(/\s+/g, ' ').replace(/["'`]+/g, '').trim();
  }

  private truncateSessionTitle(text: string, maxLength = 44) {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  private isGenericSessionTitle(title: string | null | undefined, mode: 'ENGLISH_AI' | 'KOREAN_AI') {
    const normalized = title?.trim();
    if (!normalized) {
      return true;
    }
    return normalized === (mode === 'ENGLISH_AI' ? '영어 AI 대화' : '한국어 AI 대화');
  }

  private buildAutoSessionTitle(mode: 'ENGLISH_AI' | 'KOREAN_AI', text: string) {
    const normalized = this.normalizeSessionTitleSource(text);
    if (!normalized) {
      return mode === 'ENGLISH_AI' ? '영어 AI 대화' : '한국어 AI 대화';
    }

    if (mode === 'ENGLISH_AI') {
      return this.truncateSessionTitle(normalized.replace(/[.?!]+$/, ''));
    }

    return this.truncateSessionTitle(normalized);
  }

  private async toSessionResponse(session: any) {
    const turns = await Promise.all(
      (session.turns ?? []).map(async (turn: any) => ({
        id: turn.id,
        turnIndex: turn.turnIndex,
        speaker: turn.speaker,
        language: turn.language,
        originalText: turn.originalText,
        correctedText: turn.correctedText ?? null,
        naturalText: turn.naturalText ?? null,
        meaningKo: turn.meaningKo ?? null,
        correctionNote: turn.correctionNote ?? null,
        inputMode: turn.inputMode ?? null,
        outputMode: turn.outputMode ?? null,
        audioKey: turn.audioKey ?? null,
        ttsKey: turn.ttsKey ?? null,
        ttsUrl: turn.ttsKey ? await this.storage.createPresignedDownload(turn.ttsKey, 3600, 'audio/mpeg') : null,
        createdAt: turn.createdAt,
      })),
    );

    return {
      id: session.id,
      mode: session.mode,
      status: session.status,
      title: session.title ?? null,
      topic: session.topic ?? null,
      scenario: session.scenario ?? null,
      goal: session.goal ?? null,
      userRole: session.userRole ?? null,
      aiRole: session.aiRole ?? null,
      conversationTopic: session.conversationTopic ?? null,
      situationDescription: session.situationDescription ?? null,
      userStartText: session.userStartText ?? null,
      summary: session.summary ?? null,
      aiOutputMode: session.aiOutputMode ?? null,
      userInputMode: session.userInputMode ?? null,
      completedAt: session.completedAt ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turns,
    };
  }

  private async toDialoguePracticeSetResponse(set: any) {
    const turns = await Promise.all(
      (set.turns ?? []).map(async (turn: any) => ({
        id: turn.id,
        sequence: turn.sequence,
        aiPrompt: turn.aiPrompt,
        aiPromptTtsKey: turn.aiPromptTtsKey ?? null,
        aiPromptTtsUrl: turn.aiPromptTtsKey
          ? await this.storage.createPresignedDownload(turn.aiPromptTtsKey, 3600, 'audio/mpeg')
          : null,
        expectedUserAnswer: turn.expectedUserAnswer,
        expectedUserAnswerAlt: turn.expectedUserAnswerAlt ?? null,
        hint: turn.hint ?? null,
        explanation: turn.explanation ?? null,
        expressionId: turn.expressionId ?? null,
        sourceConversationTurnId: turn.sourceConversationTurnId ?? null,
      })),
    );

    return {
      id: set.id,
      conversationSessionId: set.conversationSessionId ?? null,
      title: set.title,
      topic: set.topic ?? null,
      scenario: set.scenario ?? null,
      userRole: set.userRole ?? null,
      aiRole: set.aiRole ?? null,
      conversationTopic: set.conversationTopic ?? null,
      situationDescription: set.situationDescription ?? null,
      userStartText: set.userStartText ?? null,
      source: set.source ?? null,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
      turns,
    };
  }

  async list(userId: string, mode?: 'ENGLISH_AI' | 'KOREAN_AI') {
    const sessions = await (this.prisma as any).conversationSession.findMany({
      where: {
        userId,
        ...(mode ? { mode } : {}),
      },
      include: {
        turns: {
          orderBy: { turnIndex: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return Promise.all(sessions.map((session: any) => this.toSessionResponse(session)));
  }

  async getOne(userId: string, id: string) {
    const session = await (this.prisma as any).conversationSession.findFirst({
      where: { id, userId },
      include: { turns: { orderBy: { turnIndex: 'asc' } } },
    });
    if (!session) throw new NotFoundException('AI 대화 세션을 찾을 수 없습니다.');
    return this.toSessionResponse(session);
  }

  async updateTitle(userId: string, id: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('세션 제목을 입력해 주세요.');
    }

    const session = await (this.prisma as any).conversationSession.findFirst({
      where: { id, userId },
    });
    if (!session) {
      throw new NotFoundException('AI 대화 세션을 찾을 수 없습니다.');
    }

    await (this.prisma as any).conversationSession.update({
      where: { id },
      data: {
        title: trimmedTitle,
      },
    });

    return this.getOne(userId, id);
  }

  async createSession(userId: string, dto: CreateConversationSessionDto) {
    const session = await (this.prisma as any).conversationSession.create({
      data: {
        userId,
        mode: dto.mode,
        title: dto.title?.trim() || null,
        topic: dto.topic?.trim() || null,
        scenario: dto.scenario?.trim() || null,
        goal: dto.goal?.trim() || null,
        userRole: dto.userRole?.trim() || null,
        aiRole: dto.aiRole?.trim() || null,
        conversationTopic: dto.conversationTopic?.trim() || dto.topic?.trim() || null,
        situationDescription: dto.situationDescription?.trim() || dto.scenario?.trim() || null,
        userStartText: dto.userStartText?.trim() || null,
        aiOutputMode: dto.aiOutputMode ?? 'text',
        userInputMode: dto.userInputMode ?? 'text',
        turns: dto.turns?.length
          ? {
              create: dto.turns.map((turn, index) => ({
                userId,
                turnIndex: index + 1,
                speaker: turn.speaker,
                language: turn.language,
                originalText: turn.text.trim(),
                inputMode: turn.inputMode ?? null,
                outputMode: turn.outputMode ?? null,
                contextNote: turn.audioFileName?.trim() ? `audio:${turn.audioFileName.trim()}` : null,
              })),
            }
          : undefined,
      },
      include: { turns: { orderBy: { turnIndex: 'asc' } } },
    });

    return this.toSessionResponse(session);
  }

  async respond(userId: string, dto: RespondConversationDto) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('보낼 대화 내용을 먼저 입력해 주세요.');

    let session =
      dto.sessionId
        ? await (this.prisma as any).conversationSession.findFirst({
            where: { id: dto.sessionId, userId },
            include: { turns: { orderBy: { turnIndex: 'asc' } } },
          })
        : null;

    if (!session) {
      const autoTitle = this.buildAutoSessionTitle(dto.mode, text);
      session = await (this.prisma as any).conversationSession.create({
        data: {
          userId,
          mode: dto.mode,
          aiOutputMode: dto.aiOutputMode,
          userInputMode: dto.userInputMode,
          title: autoTitle,
          userRole: dto.userRole?.trim() || null,
          aiRole: dto.aiRole?.trim() || null,
          conversationTopic: dto.conversationTopic?.trim() || null,
          situationDescription: dto.situationDescription?.trim() || null,
          userStartText: dto.userStartText?.trim() || text,
        },
        include: { turns: { orderBy: { turnIndex: 'asc' } } },
      });
    }

    const nextUserTurnIndex = (session.turns?.length ?? 0) + 1;
    const userTurn = await (this.prisma as any).conversationTurn.create({
      data: {
        sessionId: session.id,
        userId,
        turnIndex: nextUserTurnIndex,
        speaker: 'USER',
        language: dto.mode === 'ENGLISH_AI' ? 'EN' : 'KO',
        originalText: text,
        inputMode: dto.userInputMode,
      },
    });

    const reply = await this.openai.generateConversationReply({
      mode: dto.mode,
      history: [...(session.turns ?? []), userTurn].map((turn: any) => ({
        speaker: turn.speaker,
        text: turn.originalText,
      })),
      userText: text,
      userRole: session.userRole ?? dto.userRole?.trim() ?? null,
      aiRole: session.aiRole ?? dto.aiRole?.trim() ?? null,
      conversationTopic: session.conversationTopic ?? dto.conversationTopic?.trim() ?? null,
      situationDescription: session.situationDescription ?? dto.situationDescription?.trim() ?? null,
      userStartText: session.userStartText ?? dto.userStartText?.trim() ?? text,
    });

    let ttsKey: string | null = null;
    if (dto.aiOutputMode === 'voice') {
      const ttsAudio = await this.openai.generateTts(reply.replyText);
      ttsKey = `ai-conversations/${session.id}/${Date.now()}.mp3`;
      await this.storage.uploadBuffer(ttsKey, ttsAudio, 'audio/mpeg');
    }

    await (this.prisma as any).conversationTurn.update({
      where: { id: userTurn.id },
      data: {
        correctedText: reply.correctedUserText,
        naturalText: reply.naturalUserText,
        meaningKo: reply.userMeaningKo,
        correctionNote: reply.correctionNote,
      },
    });

    await (this.prisma as any).conversationTurn.create({
      data: {
        sessionId: session.id,
        userId,
        turnIndex: nextUserTurnIndex + 1,
        speaker: 'AI',
        language: dto.mode === 'ENGLISH_AI' ? 'EN' : 'KO',
        originalText: reply.replyText,
        meaningKo: reply.replyMeaningKo,
        outputMode: dto.aiOutputMode,
        ttsKey,
      },
    });

    await (this.prisma as any).conversationSession.update({
      where: { id: session.id },
      data: {
        aiOutputMode: dto.aiOutputMode,
        userInputMode: dto.userInputMode,
        ...(session.userStartText ? {} : { userStartText: dto.userStartText?.trim() || text }),
        ...(this.isGenericSessionTitle(session.title, dto.mode)
          ? { title: this.buildAutoSessionTitle(dto.mode, text) }
          : {}),
      },
    });

    return this.getOne(userId, session.id);
  }

  async transcribeAudio(language: 'en' | 'ko', file: { buffer: Buffer; originalname: string } | undefined) {
    if (!file) throw new BadRequestException('음성 파일이 없습니다.');
    const uploadInfo = file as { buffer: Buffer; originalname: string; mimetype?: string; size?: number };
    const headerPreview = uploadInfo.buffer.subarray(0, 16).toString('hex');
    console.info(
      `[AI Conversation STT Upload] language=${language} originalname=${uploadInfo.originalname} mimetype=${uploadInfo.mimetype ?? 'unknown'} size=${uploadInfo.size ?? uploadInfo.buffer.length} header=${headerPreview}`,
    );
    if (language === 'en') {
      const result = await this.openai.transcribeEnglishAudio(file.buffer, file.originalname);
      return { text: result.text };
    }
    const result = await this.openai.transcribeAudio(file.buffer, file.originalname, false);
    return { text: result.utterances.map((utterance) => utterance.koreanText).join(' ').trim() };
  }

  async assistReply(userId: string, dto: AssistConversationReplyDto) {
    const session = dto.sessionId
      ? await (this.prisma as any).conversationSession.findFirst({
          where: { id: dto.sessionId, userId, mode: 'ENGLISH_AI' },
          include: { turns: { orderBy: { turnIndex: 'asc' } } },
        })
      : null;

    return this.openai.generateConversationReplyAssist({
      koreanText: dto.koreanText,
      userRole: session?.userRole ?? dto.userRole?.trim() ?? null,
      aiRole: session?.aiRole ?? dto.aiRole?.trim() ?? null,
      conversationTopic: session?.conversationTopic ?? dto.conversationTopic?.trim() ?? null,
      situationDescription: session?.situationDescription ?? dto.situationDescription?.trim() ?? null,
      history: (session?.turns ?? []).map((turn: any) => ({
        speaker: turn.speaker,
        text: turn.originalText,
      })),
    });
  }

  async listDialoguePracticeSets(userId: string) {
    const sets = await (this.prisma as any).dialoguePracticeSet.findMany({
      where: { userId },
      include: {
        turns: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return Promise.all(sets.map((set: any) => this.toDialoguePracticeSetResponse(set)));
  }

  async updateDialoguePracticeSetTitle(userId: string, id: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('다이얼로그 제목을 입력해 주세요.');
    }

    const set = await (this.prisma as any).dialoguePracticeSet.findFirst({
      where: { id, userId },
      include: {
        turns: {
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!set) {
      throw new NotFoundException('다이얼로그 연습 세트를 찾을 수 없습니다.');
    }

    const updated = await (this.prisma as any).dialoguePracticeSet.update({
      where: { id },
      data: {
        title: trimmedTitle,
      },
      include: {
        turns: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    return this.toDialoguePracticeSetResponse(updated);
  }

  async createDialoguePracticeSet(userId: string, sessionId: string) {
    const session = await (this.prisma as any).conversationSession.findFirst({
      where: { id: sessionId, userId, mode: 'ENGLISH_AI' },
      include: {
        turns: {
          orderBy: { turnIndex: 'asc' },
        },
      },
    });
    if (!session) throw new NotFoundException('영어 AI 대화 세션을 찾을 수 없습니다.');

    const orderedTurns = session.turns ?? [];
    const pairs = orderedTurns
      .filter((turn: any) => turn.speaker === 'AI')
      .map((aiTurn: any) => {
        const userTurn = orderedTurns.find(
          (turn: any) => turn.turnIndex === aiTurn.turnIndex + 1 && turn.speaker === 'USER',
        );
        if (!userTurn) return null;
        return {
          aiPrompt: aiTurn.originalText,
          aiPromptTtsKey: aiTurn.ttsKey ?? null,
          aiTurnId: aiTurn.id,
          userTurn,
        };
      })
      .filter(Boolean) as Array<{
        aiPrompt: string;
        aiPromptTtsKey: string | null;
        aiTurnId: string;
        userTurn: any;
      }>;

    if (pairs.length === 0) {
      throw new BadRequestException('다이얼로그로 변환할 수 있는 AI 질문-사용자 답변 쌍이 없습니다.');
    }

    const dialogueTurns = await Promise.all(
      pairs.map(async ({ aiPrompt, aiPromptTtsKey, aiTurnId, userTurn }, index) => {
        if (!aiPromptTtsKey) {
          const audio = await this.openai.generateTts(aiPrompt);
          aiPromptTtsKey = `ai-conversations/dialogues/${session.id}-${aiTurnId}.mp3`;
          await this.storage.uploadBuffer(aiPromptTtsKey, audio, 'audio/mpeg');
        }

        return {
          sequence: index + 1,
          aiPrompt,
          aiPromptTtsKey,
          expectedUserAnswer: userTurn.correctedText?.trim() || userTurn.originalText,
          expectedUserAnswerAlt:
            userTurn.naturalText?.trim() && userTurn.naturalText.trim() !== (userTurn.correctedText?.trim() || userTurn.originalText)
              ? userTurn.naturalText.trim()
              : null,
          hint: null,
          explanation: null,
          sourceConversationTurnId: userTurn.id,
        };
      }),
    );

    const practiceSet = await (this.prisma as any).dialoguePracticeSet.create({
      data: {
        userId,
        conversationSessionId: session.id,
        title: session.title?.trim() || `영어 AI 대화 다이얼로그 ${new Date(session.createdAt).toLocaleDateString('ko-KR')}`,
        topic: session.topic ?? null,
        scenario: session.scenario ?? null,
        userRole: session.userRole ?? null,
        aiRole: session.aiRole ?? null,
        conversationTopic: session.conversationTopic ?? session.topic ?? null,
        situationDescription: session.situationDescription ?? session.scenario ?? null,
        userStartText: session.userStartText ?? null,
        turns: {
          create: dialogueTurns,
        },
      },
      include: {
        turns: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    return this.toDialoguePracticeSetResponse(practiceSet);
  }

  async saveEnglishTurnAsExpression(userId: string, turnId: string) {
    const turn = await (this.prisma as any).conversationTurn.findFirst({
      where: {
        id: turnId,
        userId,
        speaker: 'USER',
        session: { mode: 'ENGLISH_AI' },
      },
    });
    if (!turn) throw new NotFoundException('영어 AI 대화의 user turn을 찾을 수 없습니다.');

    const asset = await this.openai.generateEnglishConversationAsset({
      originalText: turn.originalText,
      correctedText: turn.correctedText ?? undefined,
      naturalText: turn.naturalText ?? undefined,
      correctionNote: [turn.meaningKo ? `의미: ${turn.meaningKo}` : null, turn.correctionNote ?? null].filter(Boolean).join('\n') || undefined,
    });
    const thinkInEnglish = await this.openai.generateThinkInEnglish({
      koreanText: asset.koreanText,
      englishBase: asset.englishBase,
      englishNatural: asset.englishNatural ?? undefined,
      note: asset.note ?? undefined,
    });
    const note = await this.openai.generateExpressionUsageNote({
      koreanText: asset.koreanText,
      englishBase: asset.englishBase,
      englishNatural: asset.englishNatural ?? undefined,
      thinkInEnglish,
    });

    const expression = await (this.prisma as any).expression.create({
      data: {
        userId,
        koreanText: asset.koreanText,
        englishBase: asset.englishBase,
        englishEasy: asset.englishEasy,
        englishNatural: asset.englishNatural,
        thinkInEnglish,
        note,
        userMemo: null,
      },
    });

    await this.learningAssetsService.syncExpressionAssets(userId, expression.id);
    return this.expressionsService.list(userId).then((items) => items.find((item) => item.id === expression.id));
  }

  async saveKoreanTurnAsSentence(userId: string, turnId: string) {
    const turn = await (this.prisma as any).conversationTurn.findFirst({
      where: {
        id: turnId,
        userId,
        speaker: 'USER',
        session: { mode: 'KOREAN_AI' },
      },
      include: {
        session: {
          include: {
            turns: {
              orderBy: { turnIndex: 'asc' },
            },
          },
        },
      },
    });
    if (!turn) throw new NotFoundException('한국어 AI 대화의 user turn을 찾을 수 없습니다.');

    const savedSentence = await (this.prisma as any).savedSentence.create({
      data: {
        userId,
        koreanText: turn.originalText,
        contextNote: null,
        analysisSummary: turn.session?.summary ?? null,
        analysisIntent: null,
      },
    });

    return savedSentence;
  }

  async saveKoreanTurnAndGenerateExpression(userId: string, turnId: string) {
    const savedSentence = await this.saveKoreanTurnAsSentence(userId, turnId);
    return this.expressionsService.generate(userId, { savedSentenceId: savedSentence.id });
  }
}
