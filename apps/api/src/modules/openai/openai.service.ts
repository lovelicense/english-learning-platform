import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

function splitTranscriptChunks(text: string) {
  return text
    .split(/[\n?.!]+/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function normalizeTranscriptChunk(text: string) {
  return text.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
}

function scoreTranscriptText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return Number.NEGATIVE_INFINITY;

  const chunks = splitTranscriptChunks(trimmed);
  const normalizedChunks = chunks.map(normalizeTranscriptChunk).filter(Boolean);
  const counts = normalizedChunks.reduce<Map<string, number>>((acc, chunk) => {
    acc.set(chunk, (acc.get(chunk) ?? 0) + 1);
    return acc;
  }, new Map());

  const duplicatePenalty = Array.from(counts.values()).reduce((sum, count) => sum + Math.max(0, count - 1) * 60, 0);
  const uniqueChunkBonus = counts.size * 18;
  const chunkCountBonus = normalizedChunks.length * 8;

  return trimmed.length + uniqueChunkBonus + chunkCountBonus - duplicatePenalty;
}

function inferAudioExtensionFromBuffer(buffer?: Buffer) {
  if (!buffer) {
    return null;
  }
  if (buffer.length >= 4) {
    const header4 = buffer.subarray(0, 4).toString('hex').toLowerCase();
    if (header4 === '1a45dfa3') return '.webm';
    if (header4 === '52494646') return '.wav';
    if (header4 === '49443303' || header4 === '49443304') return '.mp3';
  }

  if (buffer.length >= 12) {
    const brand = buffer.subarray(4, 12).toString('ascii').toLowerCase();
    if (brand.includes('ftyp')) return '.m4a';
  }

  return null;
}

function ensureAudioFileName(fileName: string, buffer?: Buffer) {
  const trimmed = fileName.trim() || `audio-${Date.now()}.m4a`;
  const inferredExtension = inferAudioExtensionFromBuffer(buffer) ?? '.m4a';
  if (/\.[a-z0-9]+$/i.test(trimmed)) {
    return trimmed.replace(/\.[a-z0-9]+$/i, inferredExtension);
  }
  return `${trimmed}${inferredExtension}`;
}

function extractThinkInEnglishAnchors(koreanText: string) {
  const anchors: string[] = [];
  const quotedPattern = /["'“”‘’「」『』]([^"'“”‘’「」『』]{1,40})["'“”‘’「」『』]/g;
  for (const match of koreanText.matchAll(quotedPattern)) {
    const candidate = match[1]?.trim();
    if (candidate && !anchors.includes(candidate)) {
      anchors.push(candidate);
    }
  }

  const englishWordPattern = /([^\s,.:;!?()]+?)(?:을|를)\s*영어로/g;
  for (const match of koreanText.matchAll(englishWordPattern)) {
    const candidate = match[1]?.trim();
    if (candidate && !anchors.includes(candidate)) {
      anchors.push(candidate);
    }
  }

  return anchors;
}

function ensureThinkInEnglishAnchors(thinkInEnglish: string, koreanText: string) {
  const anchors = extractThinkInEnglishAnchors(koreanText);
  if (anchors.length === 0) {
    return thinkInEnglish.trim();
  }

  const normalized = thinkInEnglish.toLowerCase();
  const missingAnchors = anchors.filter((anchor) => !normalized.includes(anchor.toLowerCase()));
  if (missingAnchors.length === 0) {
    return thinkInEnglish.trim();
  }

  const anchorHint =
    missingAnchors.length === 1
      ? ` The key word here is '${missingAnchors[0]}'.`
      : ` The key words here are ${missingAnchors.map((anchor) => `'${anchor}'`).join(', ')}.`;

  return `${thinkInEnglish.trim()}${anchorHint}`;
}

type ExpressionContextTurn = {
  utteranceId?: string;
  speakerLabel: string;
  koreanText: string;
  isMine?: boolean;
};

type ConversationAnalysis = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
};

type GenerateExpressionInput = {
  koreanText: string;
  speakerLabel?: string;
  isMine?: boolean;
  sourceContextNote?: string;
  participantContext?: string;
  relationship?: string;
  situation?: string;
  tone?: string;
  conversationSummary?: string;
  currentIntent?: string;
  previousTurns?: ExpressionContextTurn[];
  nextTurns?: ExpressionContextTurn[];
};

type PracticeEvaluationInput = {
  koreanPrompt: string;
  targetEnglish: string;
  userAnswer: string;
  mode: 'text' | 'voice';
  testType?: 'translation' | 'situation' | 'pattern' | 'think' | 'shadowing';
  note?: string;
  easyAnswer?: string;
  naturalAnswer?: string;
  promptContext?: string;
  sourceContextNote?: string;
  conversationSummary?: string;
  currentIntent?: string;
  participantContext?: string;
};

type ThinkInEnglishInput = {
  koreanText: string;
  englishBase: string;
  englishNatural?: string;
  note?: string;
};

type ExpressionUsageNoteInput = {
  koreanText: string;
  englishBase: string;
  englishNatural?: string;
  thinkInEnglish?: string;
};

type PracticeEvaluationResult = {
  score: number;
  meaningScore: number;
  naturalnessScore: number;
  grammarScore: number;
  feedback: string;
  strengthComment: string;
  correctionComment: string;
  meaningComment: string;
  suggestedAnswer: string;
  suggestedAnswerAlt?: string;
};

type PracticePromptInput = {
  koreanText: string;
  englishBase: string;
  englishEasy?: string;
  englishNatural?: string;
  thinkInEnglish?: string;
  note?: string;
  testType: 'translation' | 'situation' | 'pattern' | 'think';
};

type PracticePromptResult = {
  testType: 'translation' | 'situation' | 'pattern' | 'think';
  promptKorean: string;
  promptContext?: string;
  target: string;
  referenceTarget?: string;
  targetAlt?: string;
  tips?: string;
  patternLabel?: string;
  patternDescription?: string;
};

type PracticePromptCandidate = {
  promptKorean: string;
  promptContext?: string;
  tips?: string;
  patternLabel?: string;
  patternDescription?: string;
  expectedAnswer?: string;
  expectedAnswerAlt?: string;
};

type PatternPromptValidationResult = {
  isValid: boolean;
  reason: string;
};

type AiConversationMode = 'ENGLISH_AI' | 'KOREAN_AI';

type ConversationReplyInput = {
  mode: AiConversationMode;
  history: Array<{ speaker: 'USER' | 'AI'; text: string }>;
  userText: string;
  userRole?: string | null;
  aiRole?: string | null;
  conversationTopic?: string | null;
  situationDescription?: string | null;
  userStartText?: string | null;
};

type ConversationReplyResult = {
  replyText: string;
  replyMeaningKo: string;
  correctedUserText: string;
  naturalUserText: string;
  userMeaningKo: string;
  correctionNote: string;
};

type ConversationReplyAssistInput = {
  koreanText: string;
  userRole?: string | null;
  aiRole?: string | null;
  conversationTopic?: string | null;
  situationDescription?: string | null;
  history?: Array<{ speaker: 'USER' | 'AI'; text: string }>;
};

type ConversationReplyAssistResult = {
  englishEasy: string;
  englishNatural: string;
  noteKo: string;
};

type EnglishConversationAssetInput = {
  originalText: string;
  correctedText?: string;
  naturalText?: string;
  correctionNote?: string;
};

type EnglishConversationAssetResult = {
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  thinkInEnglish: string;
  note: string;
};

@Injectable()
export class OpenAiService {
  private readonly client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  async analyzeConversation(input: {
    relationship?: string;
    situation?: string;
    tone?: string;
    participantContext?: string;
    turns: ExpressionContextTurn[];
  }): Promise<ConversationAnalysis> {
    if (!this.client) {
      return {
        summary: '일상적인 대화 상황에서 화자들이 각자 입장을 설명하고 조율하는 흐름입니다.',
        intents: input.turns.map((turn) => ({
          utteranceId: turn.utteranceId,
          speakerLabel: turn.speakerLabel,
          koreanText: turn.koreanText,
          intent: turn.isMine ? '자신의 상황이나 의사를 설명함' : '상대에게 설명하거나 설득함',
        })),
      };
    }

    const conversationBlock = input.turns
      .map(
        (turn, index) =>
          `- turn_${index + 1}${turn.utteranceId ? ` (${turn.utteranceId})` : ''} [${turn.speakerLabel}] ${turn.koreanText}`,
      )
      .join('\n');

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You analyze Korean conversation for English speaking practice.',
            'Summarize the overall conversation briefly.',
            'For each utterance, infer the speaker intent in Korean.',
            'Intent should capture the communicative goal, not a literal paraphrase.',
            'Return JSON with summary and intents.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            input.relationship ? `대화 관계: ${input.relationship}` : null,
            input.situation ? `대화 상황: ${input.situation}` : null,
            input.tone ? `원하는 영어 톤: ${input.tone}` : null,
            input.participantContext ? input.participantContext : null,
            `대화 전체:\n${conversationBlock}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'conversation_analysis',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              intents: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    utteranceId: { type: 'string' },
                    speakerLabel: { type: 'string' },
                    koreanText: { type: 'string' },
                    intent: { type: 'string' },
                  },
                  required: ['utteranceId', 'speakerLabel', 'koreanText', 'intent'],
                },
              },
            },
            required: ['summary', 'intents'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  async generateExpressions(input: GenerateExpressionInput | string) {
    const payload = typeof input === 'string' ? { koreanText: input } : input;

    if (!this.client) {
      return this.mockExpression(payload.koreanText);
    }

    const contextBlock = [
      payload.speakerLabel ? `현재 화자: ${payload.speakerLabel}` : null,
      typeof payload.isMine === 'boolean' ? `내 발화 여부: ${payload.isMine ? 'yes' : 'no'}` : null,
      payload.relationship ? `대화 관계: ${payload.relationship}` : null,
      payload.situation ? `대화 상황: ${payload.situation}` : null,
      payload.tone ? `원하는 영어 톤: ${payload.tone}` : null,
      payload.participantContext ? payload.participantContext : null,
      payload.sourceContextNote ? `문장별 맥락 메모: ${payload.sourceContextNote}` : null,
      payload.conversationSummary ? `대화 전체 요약: ${payload.conversationSummary}` : null,
      payload.currentIntent ? `현재 발화 의도: ${payload.currentIntent}` : null,
      payload.previousTurns?.length
        ? `이전 대화:\n${payload.previousTurns
            .map((turn, index) => `- prev_${index + 1} [${turn.speakerLabel}] ${turn.koreanText}`)
            .join('\n')}`
        : '이전 대화: 없음',
      `현재 문장:\n- current${payload.speakerLabel ? ` [${payload.speakerLabel}]` : ''} ${payload.koreanText}`,
      payload.nextTurns?.length
        ? `다음 대화:\n${payload.nextTurns
            .map((turn, index) => `- next_${index + 1} [${turn.speakerLabel}] ${turn.koreanText}`)
            .join('\n')}`
        : '다음 대화: 없음',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You convert Korean conversational speech into context-aware natural English for speaking practice.',
            'Do not translate literally when that would miss the speaker intent.',
            'Use the surrounding conversation, speaker relationship, and implied meaning to choose the best spoken English.',
            'Prefer what a native speaker would actually say in that situation.',
            'If the Korean line implies a reason or constraint from context, reflect that meaning naturally.',
            'If relationship, situation, or desired tone are provided, incorporate them.',
            'If conversation summary and current intent are provided, use them as high-priority guidance.',
            'The Korean source meaning is the top priority. Do not change semantic direction or viewpoint.',
            'base, easy, natural, thinkInEnglish, and note must all preserve the same core meaning and direction.',
            'All outputs must be mutually consistent. They must not disagree about who moves, who receives, or direction of action.',
            'Pay special attention to directional/confusable pairs such as take/bring, come/go, give/take, lend/borrow, and here/there.',
            'If the Korean is ambiguous, choose the most likely meaning from context, then keep all outputs consistent with that one choice.',
            'Return JSON with base, easy, natural, thinkInEnglish, note.',
            'base: the best core sentence for memorizing and speaking.',
            'easy: simpler and easier spoken English with the same meaning.',
            'natural: the most natural conversational phrasing.',
            'thinkInEnglish: explain in simple natural English when this sentence is used and what kind of situation or feeling it fits.',
            'thinkInEnglish should help the learner infer the target sentence from meaning, usage, and key anchors.',
            'Include the concrete topic, object, or keyword from the Korean source when that anchor is necessary to infer the answer.',
            'For example, if the sentence asks how to say a specific Korean word in English, mention that Korean word explicitly in thinkInEnglish.',
            'For requests about names, items, places, or quoted words, include that specific item as a clue.',
            'Avoid copying the full target sentence verbatim in thinkInEnglish unless necessary.',
            'note: explain the nuance and explicitly mention the key intent and context used in the interpretation.',
            'note must describe the same meaning used in base, easy, and natural, and must not introduce a different verb or direction.',
            'Keep note concise but concrete.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `다음 대화를 참고해서 현재 문장을 영어 말하기 표현으로 만들어줘.\n\n${contextBlock}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'expression_result',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              base: { type: 'string' },
              easy: { type: 'string' },
              natural: { type: 'string' },
              thinkInEnglish: { type: 'string' },
              note: { type: 'string' },
            },
            required: ['base', 'easy', 'natural', 'thinkInEnglish', 'note'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      thinkInEnglish: ensureThinkInEnglishAnchors(parsed.thinkInEnglish, payload.koreanText),
    };
  }

  async evaluatePracticeAnswer(input: PracticeEvaluationInput): Promise<PracticeEvaluationResult> {
    if (!this.client) {
      return this.mockPracticeEvaluation(input);
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You evaluate English speaking/writing answers from a Korean learner.',
            'Do not require exact sentence match if the meaning is preserved.',
            'Score meaning delivery, naturalness, and grammar separately from 0 to 100.',
            'Then produce an overall score from 0 to 100.',
            'The Korean prompt is the highest-priority ground truth for meaning.',
            'Treat targetEnglish, easyAnswer, naturalAnswer, and note as references, not absolute truth.',
            'If any reference expression conflicts with the Korean prompt, follow the Korean prompt and do not copy the conflicting wording into suggested answers.',
            'Pay special attention to directional/confusable pairs such as take/bring, come/go, give/take, lend/borrow, and here/there.',
            'Provide concise Korean feedback.',
            'strengthComment: what the learner did well.',
            'correctionComment: feedback based on the reference expression. Explain how the learner answer differs from the stored targetEnglish pattern and what to change if the learner wants to match that exact study expression more closely.',
            'meaningComment: feedback based on meaning only. Explain whether the learner preserved the Korean prompt meaning, regardless of whether it exactly matches the stored reference expression.',
            'suggestedAnswer: a strong recommended answer that matches the Korean prompt meaning first.',
            'suggestedAnswerAlt: an alternative natural answer with the same meaning as the Korean prompt.',
            'If the provided reference expression appears semantically wrong, you may correct it in suggestedAnswer and mention the mismatch briefly in correctionComment.',
            'Be encouraging and practical.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `문제 유형: ${input.testType ?? 'translation'}`,
            `답변 방식: ${input.mode}`,
            `연습 문제: ${input.koreanPrompt}`,
            input.promptContext ? `문제 상황 설명: ${input.promptContext}` : null,
            input.participantContext ? input.participantContext : null,
            input.sourceContextNote ? `문장별 맥락 메모: ${input.sourceContextNote}` : null,
            input.conversationSummary ? `대화 요약: ${input.conversationSummary}` : null,
            input.currentIntent ? `현재 발화 의도: ${input.currentIntent}` : null,
            `기준 영어 표현: ${input.targetEnglish}`,
            input.easyAnswer ? `쉬운 대안 표현: ${input.easyAnswer}` : null,
            input.naturalAnswer ? `자연스러운 대안 표현: ${input.naturalAnswer}` : null,
            input.note ? `표현 설명: ${input.note}` : null,
            `학습자 답변: ${input.userAnswer}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'practice_evaluation',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              score: { type: 'integer' },
              meaningScore: { type: 'integer' },
              naturalnessScore: { type: 'integer' },
              grammarScore: { type: 'integer' },
              feedback: { type: 'string' },
              strengthComment: { type: 'string' },
              correctionComment: { type: 'string' },
              meaningComment: { type: 'string' },
              suggestedAnswer: { type: 'string' },
              suggestedAnswerAlt: { type: 'string' },
            },
            required: [
              'score',
              'meaningScore',
              'naturalnessScore',
              'grammarScore',
              'feedback',
              'strengthComment',
              'correctionComment',
              'meaningComment',
              'suggestedAnswer',
              'suggestedAnswerAlt',
            ],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  async generateConversationReply(input: ConversationReplyInput): Promise<ConversationReplyResult> {
    if (!this.client) {
      if (input.mode === 'ENGLISH_AI') {
        return {
          replyText: 'That sounds good. What happened next?',
          replyMeaningKo: '좋네요. 그 다음에는 무슨 일이 있었나요?',
          correctedUserText: input.userText,
          naturalUserText: input.userText,
          userMeaningKo: `사용자가 "${input.userText}"라고 말하려는 의미입니다.`,
          correctionNote: 'OPENAI_API_KEY가 없어 목업 대화 응답을 반환했습니다.',
        };
      }
      return {
        replyText: '그랬구나. 그때 기분이 어땠는지 조금 더 말해줘.',
        replyMeaningKo: '그랬구나. 그때 기분이 어땠는지 조금 더 말해줘.',
        correctedUserText: input.userText,
        naturalUserText: input.userText,
        userMeaningKo: `사용자가 "${input.userText}"라고 말하려는 의미입니다.`,
        correctionNote: 'OPENAI_API_KEY가 없어 목업 대화 응답을 반환했습니다.',
      };
    }

    const historyBlock = input.history
      .slice(-8)
      .map((turn, index) => `- turn_${index + 1} [${turn.speaker}] ${turn.text}`)
      .join('\n');
    const contextBlock = [
      input.userRole ? `사용자 역할: ${input.userRole}` : null,
      input.aiRole ? `AI 역할: ${input.aiRole}` : null,
      input.conversationTopic ? `대화 주제: ${input.conversationTopic}` : null,
      input.situationDescription ? `상황 설명: ${input.situationDescription}` : null,
      input.userStartText ? `사용자 시작문: ${input.userStartText}` : null,
    ].filter(Boolean).join('\n');

    const systemPrompt =
      input.mode === 'ENGLISH_AI'
        ? [
            'You are a friendly English conversation partner and speaking coach.',
            'If roles, topic, and situation are provided, stay in that role-play context.',
            'Reply in natural spoken English and keep the conversation moving.',
            'correctedUserText: grammar-correct version of the learner English.',
            'naturalUserText: more natural conversational version with the same meaning.',
            'userMeaningKo: natural Korean direct-speech translation of the learner utterance after correction.',
            'For userMeaningKo, preserve the utterance force: commands stay commands, requests stay requests, questions stay questions.',
            'For userMeaningKo, do not use reported speech or explanatory endings such as "~라고 하셨다", "~라는 뜻입니다", or "~하라고 했다".',
            'replyMeaningKo: concise Korean meaning of your replyText.',
            'correctionNote: short Korean note about the main correction point.',
            'replyText: your next reply in English.',
            'Return JSON only.',
          ].join(' ')
        : [
            'You are a warm Korean conversation partner.',
            'Reply in natural Korean and keep the conversation moving.',
            'correctedUserText: cleaned-up Korean phrasing that preserves the meaning.',
            'naturalUserText: more natural spoken Korean with the same meaning.',
            'userMeaningKo: concise Korean meaning of the user utterance.',
            'replyMeaningKo: concise Korean meaning of your replyText.',
            'correctionNote: short Korean note about clarity or naturalness.',
            'replyText: your next reply in Korean.',
            'Return JSON only.',
          ].join(' ');

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            contextBlock ? `세션 문맥:\n${contextBlock}` : '세션 문맥: 없음',
            historyBlock ? `대화 기록:\n${historyBlock}` : '대화 기록: 없음',
            `사용자 최신 발화: ${input.userText}`,
          ].join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'conversation_reply',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              replyText: { type: 'string' },
              replyMeaningKo: { type: 'string' },
              correctedUserText: { type: 'string' },
              naturalUserText: { type: 'string' },
              userMeaningKo: { type: 'string' },
              correctionNote: { type: 'string' },
            },
            required: ['replyText', 'replyMeaningKo', 'correctedUserText', 'naturalUserText', 'userMeaningKo', 'correctionNote'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  async generateConversationReplyAssist(input: ConversationReplyAssistInput): Promise<ConversationReplyAssistResult> {
    const koreanText = input.koreanText.trim();
    if (!koreanText) {
      throw new BadRequestException('도움 요청 내용을 입력해 주세요.');
    }

    if (!this.client) {
      return {
        englishEasy: 'Please hurry up and get ready.',
        englishNatural: 'Come on, hurry up and get ready.',
        noteKo: 'OPENAI_API_KEY가 없어 목업 영어 표현을 반환했습니다.',
      };
    }

    const contextBlock = [
      input.userRole ? `사용자 역할: ${input.userRole}` : null,
      input.aiRole ? `AI 역할: ${input.aiRole}` : null,
      input.conversationTopic ? `대화 주제: ${input.conversationTopic}` : null,
      input.situationDescription ? `상황 설명: ${input.situationDescription}` : null,
    ].filter(Boolean).join('\n');
    const historyBlock = (input.history ?? [])
      .slice(-8)
      .map((turn, index) => `- turn_${index + 1} [${turn.speaker}] ${turn.text}`)
      .join('\n');

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You help a Korean learner write an English reply for an ongoing role-play conversation.',
            'Use the provided roles, topic, situation, and recent turns.',
            'englishEasy should be simple and safe.',
            'englishNatural should be the best natural spoken reply.',
            'noteKo should briefly explain nuance or usage in Korean.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            contextBlock ? `세션 문맥:\n${contextBlock}` : '세션 문맥: 없음',
            historyBlock ? `최근 대화:\n${historyBlock}` : '최근 대화: 없음',
            `한국어로 말하고 싶은 내용: ${koreanText}`,
          ].join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'conversation_reply_assist',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              englishEasy: { type: 'string' },
              englishNatural: { type: 'string' },
              noteKo: { type: 'string' },
            },
            required: ['englishEasy', 'englishNatural', 'noteKo'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  async generateEnglishConversationAsset(input: EnglishConversationAssetInput): Promise<EnglishConversationAssetResult> {
    const englishBase = input.correctedText?.trim() || input.originalText.trim();
    const englishNatural = input.naturalText?.trim() || englishBase;
    const englishEasy = input.originalText.trim() || englishBase;

    if (!this.client) {
      return {
        koreanText: '영어 AI 대화에서 저장한 표현',
        englishBase,
        englishEasy,
        englishNatural,
        thinkInEnglish: `This is used when you want to say "${englishBase}" in a natural conversation.`,
        note: '영어 AI 대화에서 나온 표현을 복습용 자산으로 정리한 설명입니다.',
      };
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You convert an English learner utterance into a reusable English expression asset.',
            'Create a short Korean meaning label that preserves the speaker meaning.',
            'base, easy, natural must stay semantically aligned.',
            'thinkInEnglish should explain in simple English when this expression is used so the learner can recall it later.',
            'note should be a concise Korean explanation of the saved expression usage, nuance, and when it fits.',
            'note is for studying the final expression, not for listing the learner mistakes.',
            'Do not copy the correctionNote directly into note.',
            'If correctionNote exists, use it only as background context to understand the learner intent and the better final phrasing.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `원래 영어: ${input.originalText}`,
            input.correctedText ? `교정 영어: ${input.correctedText}` : null,
            input.naturalText ? `자연형 영어: ${input.naturalText}` : null,
            input.correctionNote ? `교정 메모: ${input.correctionNote}` : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'english_conversation_asset',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              koreanText: { type: 'string' },
              englishBase: { type: 'string' },
              englishEasy: { type: 'string' },
              englishNatural: { type: 'string' },
              thinkInEnglish: { type: 'string' },
              note: { type: 'string' },
            },
            required: ['koreanText', 'englishBase', 'englishEasy', 'englishNatural', 'thinkInEnglish', 'note'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  async generateThinkInEnglish(input: ThinkInEnglishInput): Promise<string> {
    if (!this.client) {
      return `Use this when you want to express the same idea in English. Include the key topic from the original Korean, so the target sentence is easier to infer.`;
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You write a short "think in English" cue for an English learning app.',
            'Explain in simple English when the target sentence is used and what nuance it carries.',
            'Help the learner infer and recall the target expression from meaning, situation, and key anchors.',
            'Include the concrete topic, object, or keyword from the Korean source when that anchor is needed to infer the answer.',
            'If the sentence is about how to say a specific Korean word in English, mention that Korean word explicitly.',
            'If a person, item, place, or quoted term is central to the sentence, include it as a clue.',
            'Do not write in Korean.',
            'Keep it to 1-3 sentences.',
            'Avoid repeating the full target sentence verbatim unless necessary.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `한국어 의미: ${input.koreanText}`,
            `기준 영어 표현: ${input.englishBase}`,
            input.englishNatural ? `자연형: ${input.englishNatural}` : null,
            input.note ? `표현 설명: ${input.note}` : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'think_in_english',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              thinkInEnglish: { type: 'string' },
            },
            required: ['thinkInEnglish'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    const parsed = JSON.parse(raw);
    return ensureThinkInEnglishAnchors(parsed.thinkInEnglish, input.koreanText);
  }

  async generateExpressionUsageNote(input: ExpressionUsageNoteInput): Promise<string> {
    if (!this.client) {
      return '이 표현이 실제로 언제, 어떤 의도로 쓰이는지 이해하기 쉽게 정리한 설명입니다.';
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You write a short Korean study note for an English expression.',
            'Focus on when the final expression is used, what nuance it has, and why it sounds natural.',
            'Do not talk about learner mistakes or correction history.',
            'Do not mention source tracking or metadata.',
            'Keep it concise, practical, and study-friendly.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `한국어 의미: ${input.koreanText}`,
            `기준 영어 표현: ${input.englishBase}`,
            input.englishNatural ? `자연형: ${input.englishNatural}` : null,
            input.thinkInEnglish ? `Think in English: ${input.thinkInEnglish}` : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'expression_usage_note',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              note: { type: 'string' },
            },
            required: ['note'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    const parsed = JSON.parse(raw);
    return parsed.note;
  }

  async generatePracticePrompt(input: PracticePromptInput): Promise<PracticePromptResult> {
    if (!this.client) {
      return this.mockPracticePrompt(input);
    }

    if (input.testType === 'translation') {
      return {
        testType: 'translation',
        promptKorean: input.koreanText,
        target: input.englishBase,
        tips: '핵심 의미를 살려 자연스럽게 영어로 말해보세요.',
      };
    }

    if (input.testType === 'think') {
      return {
        testType: 'think',
        promptKorean:
          input.thinkInEnglish?.trim() ||
          `This is used when you want to say "${input.englishBase}" in a real conversation.`,
        promptContext: '영어 설명을 읽고, 떠오르는 핵심 영어 문장을 그대로 말해보세요.',
        target: input.englishBase,
        targetAlt: input.englishNatural ?? input.englishEasy ?? input.englishBase,
        tips: '설명 속 상황과 뉘앙스를 보고, 가장 어울리는 영어 문장을 떠올려 보세요.',
      };
    }

    const isPatternPrompt = input.testType === 'pattern';
    if (!isPatternPrompt) {
      const parsed = await this.createPracticePromptCandidate(input, false);
      return {
        testType: input.testType,
        promptKorean: parsed.promptKorean,
        promptContext: parsed.promptContext,
        tips: parsed.tips,
        target: input.englishBase,
      };
    }

    const maxAttempts = 3;
    let lastCandidate: PracticePromptCandidate | null = null;
    let lastValidationReason = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidate = await this.createPracticePromptCandidate(input, true);
      lastCandidate = candidate;

      const expectedAnswer = candidate.expectedAnswer?.trim();
      if (!expectedAnswer) {
        lastValidationReason = 'expectedAnswer missing';
        continue;
      }

      const validation = await this.validatePatternPromptCandidate(input, {
        promptKorean: candidate.promptKorean,
        expectedAnswer,
        expectedAnswerAlt: candidate.expectedAnswerAlt?.trim(),
      });
      if (validation.isValid) {
        return {
          testType: input.testType,
          promptKorean: candidate.promptKorean,
          promptContext: candidate.promptContext,
          tips: candidate.tips,
          patternLabel: candidate.patternLabel,
          patternDescription: candidate.patternDescription,
          target: expectedAnswer,
          targetAlt: candidate.expectedAnswerAlt,
          referenceTarget: input.englishBase,
        };
      }

      lastValidationReason = validation.reason;
      console.warn(
        `[Pattern Prompt Retry] rejected pattern prompt attempt=${attempt} reason=${validation.reason} source=${JSON.stringify(input.koreanText)} target=${JSON.stringify(input.englishBase)} prompt=${JSON.stringify(candidate.promptKorean)} expected=${JSON.stringify(expectedAnswer)}`,
      );
    }

    console.warn(
      `[Pattern Prompt Fallback] using safe fallback after validation failures reason=${lastValidationReason} source=${JSON.stringify(input.koreanText)} target=${JSON.stringify(input.englishBase)} last_prompt=${JSON.stringify(lastCandidate?.promptKorean ?? '')} last_expected=${JSON.stringify(lastCandidate?.expectedAnswer ?? '')}`,
    );
    return this.buildSafePatternFallback(input);
  }

  private async createPracticePromptCandidate(
    input: PracticePromptInput,
    isPatternPrompt: boolean,
  ): Promise<PracticePromptCandidate> {
    const response = await this.client!.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You create Korean practice prompts for English speaking practice.',
            'Given a Korean source sentence and its English target, generate either a short Korean situation description or a pattern drill prompt.',
            'If testType is situation, create a short Korean situation description that helps the learner produce the target meaning, but do not reveal the exact answer.',
            'For situation prompts, never include the exact target English, a near-copy of it, or a pattern label that reveals the answer.',
            'For situation prompts, keep hints abstract and useful, but do not mention the exact target phrase or sentence structure verbatim.',
            'If testType is pattern, extract the reusable English pattern, explain it in Korean, and generate a NEW Korean prompt that can be answered with the same pattern.',
            'For pattern prompts, promptKorean and expectedAnswer must describe the exact same event and meaning.',
            'For pattern prompts, keep question type, tense, polarity, subject role, verb meaning, and object meaning aligned between Korean and English.',
            'For pattern prompts, never drift between close but different verbs such as buy/prepare, bring/take, lend/borrow, give/take, come/go.',
            'For pattern prompts, expectedAnswer must be a direct natural answer to promptKorean, not just another sentence with a similar grammar frame.',
            'For pattern prompts, expectedAnswerAlt must preserve the same meaning as expectedAnswer.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `문제 유형: ${input.testType}`,
            `한국어 원문: ${input.koreanText}`,
            `기준 영어 표현: ${input.englishBase}`,
            input.englishNatural ? `자연형: ${input.englishNatural}` : null,
            input.note ? `설명: ${input.note}` : null,
            isPatternPrompt
              ? '중요: 새로 만드는 한국어 문제와 expectedAnswer는 반드시 같은 뜻이어야 합니다. 의미가 조금이라도 다르면 안 됩니다.'
              : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'practice_prompt',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              promptKorean: { type: 'string' },
              promptContext: { type: 'string' },
              tips: { type: 'string' },
              ...(isPatternPrompt
                ? {
                    patternLabel: { type: 'string' },
                    patternDescription: { type: 'string' },
                    expectedAnswer: { type: 'string' },
                    expectedAnswerAlt: { type: 'string' },
                  }
                : {}),
            },
            required: isPatternPrompt
              ? ['promptKorean', 'promptContext', 'tips', 'patternLabel', 'patternDescription', 'expectedAnswer', 'expectedAnswerAlt']
              : ['promptKorean', 'promptContext', 'tips'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  private async validatePatternPromptCandidate(
    input: PracticePromptInput,
    candidate: { promptKorean: string; expectedAnswer: string; expectedAnswerAlt?: string },
  ): Promise<PatternPromptValidationResult> {
    if (!this.client) {
      return { isValid: true, reason: 'client unavailable' };
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You validate whether a Korean practice question and an English answer express the same meaning.',
            'Be strict.',
            'Reject when event meaning differs even if grammar pattern is similar.',
            'Check verb meaning, object meaning, tense, polarity, question type, and participant role.',
            'Examples of mismatch: prepare vs buy, bring vs take, lend vs borrow, give vs take, who did it vs did they do it.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `원래 한국어 문장: ${input.koreanText}`,
            `원래 기준 영어 표현: ${input.englishBase}`,
            `새 한국어 문제: ${candidate.promptKorean}`,
            `새 영어 정답: ${candidate.expectedAnswer}`,
            candidate.expectedAnswerAlt ? `새 영어 대안 정답: ${candidate.expectedAnswerAlt}` : null,
            '판정 기준: 새 한국어 문제를 보고 새 영어 정답을 말했을 때, 의미상 정확한 정답으로 볼 수 있는지 판단하세요.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'pattern_prompt_validation',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              isValid: { type: 'boolean' },
              reason: { type: 'string' },
            },
            required: ['isValid', 'reason'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
  }

  private buildSafePatternFallback(input: PracticePromptInput): PracticePromptResult {
    return {
      testType: 'pattern',
      promptKorean: `${input.koreanText}와 비슷한 영어 틀로 다시 말해보세요.`,
      promptContext: '새 패턴형 문제 생성 결과의 의미 일치가 불안정해서, 원래 문장의 의미를 유지하는 안전한 패턴 연습 문제로 바꿨습니다.',
      target: input.englishBase,
      targetAlt: input.englishNatural ?? input.englishEasy ?? input.englishBase,
      referenceTarget: input.englishBase,
      tips: '원래 문장의 핵심 의미를 유지하면서, 같은 문장 틀을 다시 말해보세요.',
      patternLabel: '원문 기반 패턴 연습',
      patternDescription: '새 변형 문제 대신 원래 문장의 의미를 유지한 채 핵심 영어 틀을 연습합니다.',
    };
  }

  async transcribeAudio(buffer: Buffer, fileName: string, diarization = false) {
    if (!this.client) {
      return {
        utterances: [
          { speakerLabel: 'speaker_1', startMs: 0, endMs: 1800, koreanText: '나 지금 애 데리러 가는 중이야' },
        ],
      };
    }

    const normalizedFileName = ensureAudioFileName(fileName, buffer);
    const file = await OpenAI.toFile(buffer, normalizedFileName);
    const nonDiarizationModels = Array.from(
      new Set([
        process.env.OPENAI_STT_MODEL ?? 'gpt-4o-mini-transcribe',
        process.env.OPENAI_STT_FALLBACK_MODEL ?? 'gpt-4o-transcribe',
        'whisper-1',
      ]),
    );
    const createTranscription = async (useDiarization: boolean) => {
      try {
        return await this.client!.audio.transcriptions.create({
          file,
          model: useDiarization
            ? process.env.OPENAI_STT_DIARIZE_MODEL ?? 'gpt-4o-transcribe-diarize'
            : nonDiarizationModels[0],
          language: 'ko',
          response_format: useDiarization ? 'diarized_json' : 'json',
          ...(useDiarization ? { chunking_strategy: 'auto' } : {}),
        } as any);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/audio duration .* longer than .* maximum/i.test(message)) {
          throw new BadRequestException(
            '오디오 길이가 너무 깁니다. 현재 모델은 약 23분까지만 처리할 수 있어요. 파일을 더 짧게 나눠 업로드해 주세요.',
          );
        }
        throw error;
      }
    };
    const createPlainTranscription = async (model: string) => {
      try {
        return await this.client!.audio.transcriptions.create({
          file,
          model,
          language: 'ko',
          response_format: 'json',
        } as any);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/audio duration .* longer than .* maximum/i.test(message)) {
          throw new BadRequestException(
            '오디오 길이가 너무 깁니다. 현재 모델은 약 23분까지만 처리할 수 있어요. 파일을 더 짧게 나눠 업로드해 주세요.',
          );
        }
        throw error;
      }
    };

    let result: any = await createTranscription(diarization);

    if (diarization) {
      const segments = ((result as any).segments ?? []) as Array<{
        speaker?: string;
        text?: string;
        start?: number;
        end?: number;
      }>;

      let utterances = segments
        .filter((s) => s.text && s.text.trim().length > 0)
        .map((s, index) => ({
          speakerLabel: s.speaker?.toLowerCase() ?? `speaker_${index + 1}`,
          startMs: Math.round((s.start ?? 0) * 1000),
          endMs: Math.round((s.end ?? 0) * 1000),
          koreanText: s.text!.trim(),
        }));

      if (utterances.length === 0) {
        const candidates: Array<{ model: string; text: string; score: number }> = [];

        for (const model of nonDiarizationModels) {
          const fallbackResult = await createPlainTranscription(model);
          const text = ((fallbackResult as any).text ?? '').trim();
          candidates.push({
            model,
            text,
            score: scoreTranscriptText(text),
          });
        }

        const bestCandidate = candidates.sort((left, right) => right.score - left.score)[0];
        console.info(
          `[STT fallback] file=${normalizedFileName} candidates=${JSON.stringify(
            candidates.map((candidate) => ({
              model: candidate.model,
              score: candidate.score,
              preview: candidate.text.slice(0, 80),
            })),
          )}`,
        );

        if (bestCandidate?.text) {
          utterances = [
            {
              speakerLabel: 'speaker_1',
              startMs: 0,
              endMs: 2000,
              koreanText: bestCandidate.text,
            },
          ];
        }
      }

      const speakerCounts = utterances.reduce<Record<string, number>>((acc, utterance) => {
        acc[utterance.speakerLabel] = (acc[utterance.speakerLabel] ?? 0) + 1;
        return acc;
      }, {});
      const firstUtterancesPreview = utterances.slice(0, 3).map((utterance) => ({
        speakerLabel: utterance.speakerLabel,
        startMs: utterance.startMs,
        endMs: utterance.endMs,
        koreanText: utterance.koreanText.slice(0, 60),
      }));
      const lastUtterancesPreview = utterances.slice(-3).map((utterance) => ({
        speakerLabel: utterance.speakerLabel,
        startMs: utterance.startMs,
        endMs: utterance.endMs,
        koreanText: utterance.koreanText.slice(0, 60),
      }));
      const firstStartMs = utterances[0]?.startMs ?? 0;
      const lastEndMs = utterances[utterances.length - 1]?.endMs ?? 0;
      const emptySegmentCount = segments.filter((segment) => !segment.text || !segment.text.trim()).length;
      console.info(
        `[STT diarization] file=${normalizedFileName} raw_segments=${segments.length} empty_segments=${emptySegmentCount} saved_utterances=${utterances.length} speakers=${Object.keys(
          speakerCounts,
        ).length} first_start_ms=${firstStartMs} last_end_ms=${lastEndMs} speaker_counts=${JSON.stringify(speakerCounts)}`,
      );
      console.info(`[STT diarization preview:first] file=${normalizedFileName} ${JSON.stringify(firstUtterancesPreview)}`);
      console.info(`[STT diarization preview:last] file=${normalizedFileName} ${JSON.stringify(lastUtterancesPreview)}`);

      return { utterances };
    }

    const text = ((result as any).text ?? '').trim();
    return {
      utterances: [
        { speakerLabel: 'speaker_1', startMs: 0, endMs: 2000, koreanText: text },
      ],
    };
  }

  async transcribeEnglishAudio(buffer: Buffer, fileName: string) {
    if (!this.client) {
      return { text: 'I am on my way to pick up my kid.' };
    }

    const normalizedFileName = ensureAudioFileName(fileName, buffer);
    const file = await OpenAI.toFile(buffer, normalizedFileName);
    try {
      const primaryModel = process.env.OPENAI_PRACTICE_STT_MODEL ?? process.env.OPENAI_STT_MODEL ?? 'gpt-4o-mini-transcribe';
      const fallbackModel = process.env.OPENAI_PRACTICE_STT_FALLBACK_MODEL ?? 'gpt-4o-transcribe';
      const prompt = 'Transcribe spoken English only. Output the recognized English text exactly as spoken.';

      const result = await this.client.audio.transcriptions.create({
        file,
        model: primaryModel,
        language: 'en',
        prompt,
        response_format: 'json',
      } as any);

      const primaryText = ((result as any).text ?? '').trim();
      if (!this.containsHangul(primaryText) || primaryModel === fallbackModel) {
        return { text: primaryText };
      }

      console.warn(
        `[Practice STT] Hangul detected from primary model. Retrying with fallback model. file=${fileName} primary_model=${primaryModel} fallback_model=${fallbackModel} primary_text=${JSON.stringify(primaryText.slice(0, 120))}`,
      );

      const retryFile = await OpenAI.toFile(buffer, fileName);
      const fallbackResult = await this.client.audio.transcriptions.create({
        file: retryFile,
        model: fallbackModel,
        language: 'en',
        prompt,
        response_format: 'json',
      } as any);

      const fallbackText = ((fallbackResult as any).text ?? '').trim();
      return { text: fallbackText || primaryText };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/audio duration .* longer than .* maximum/i.test(message)) {
        throw new BadRequestException(
          '오디오 길이가 너무 깁니다. 더 짧은 음성 파일로 다시 시도해 주세요.',
        );
      }
      throw error;
    }
  }


  async generateTts(text: string) {
    if (!this.client) {
      return Buffer.from(`MOCK_TTS:${text}`, 'utf-8');
    }
    const speech = await this.client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE ?? 'alloy',
      input: text,
    });
    const arrayBuffer = await speech.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private mockExpression(koreanText: string) {
    if (koreanText.includes('혼자 집에 있을 수 없어')) {
      return {
        base: "You're too young to stay home alone.",
        easy: "You can't stay home by yourself yet.",
        natural: "You're not old enough to stay home alone.",
        thinkInEnglish:
          "This is used when someone is still too young to stay home without an adult. It sounds like care and protection, not just a hard rule.",
        note: '아이와 보호자 대화 맥락을 반영해, 단순 금지보다 아직 어려서 안 된다는 의미로 풀었습니다.',
      };
    }
    if (koreanText.includes('데리러') || koreanText.includes('애')) {
      return {
        base: "I'm on my way to pick up my kid.",
        easy: "I'm going to pick up my child now.",
        natural: "I'm heading out to pick up my kid.",
        thinkInEnglish:
          'This is often used when you are already moving to get your child. It sounds natural in a quick everyday update.',
        note: 'on my way와 pick up은 일상회화에서 자주 쓰는 표현입니다.',
      };
    }
    return {
      base: 'Here is a natural English version of your sentence.',
      easy: 'This is an easier spoken version.',
      natural: 'This is a more natural conversational version.',
      thinkInEnglish: 'This is used when you want to express the same idea in a natural everyday conversation.',
      note: 'OPENAI_API_KEY가 없어서 목업 응답을 반환했습니다.',
    };
  }

  private mockPracticeEvaluation(input: PracticeEvaluationInput): PracticeEvaluationResult {
    const cleanTarget = input.targetEnglish.trim().toLowerCase();
    const cleanAnswer = input.userAnswer.trim().toLowerCase();
    const words = cleanTarget.split(/\s+/).filter(Boolean);
    const overlap = words.filter((word) => cleanAnswer.includes(word)).length;
    const meaningScore = cleanAnswer === cleanTarget ? 100 : Math.min(95, Math.max(30, overlap * 20));
    const naturalnessScore = cleanAnswer === cleanTarget ? 95 : Math.min(90, Math.max(25, overlap * 16));
    const grammarScore = cleanAnswer === cleanTarget ? 95 : Math.min(90, Math.max(25, overlap * 16));
    const score = Math.round((meaningScore + naturalnessScore + grammarScore) / 3);

    return {
      score,
      meaningScore,
      naturalnessScore,
      grammarScore,
      feedback:
        score >= 90
          ? '의미 전달이 정확하고 자연스러워요.'
          : score >= 70
          ? '핵심 의미는 잘 전달됐어요. 표현을 조금 더 다듬으면 더 자연스러워집니다.'
          : '의미 전달은 일부 되었지만, 핵심 표현을 다시 정리해보면 좋아요.',
      strengthComment:
        score >= 70
          ? '핵심 의미를 살리려는 시도가 잘 보입니다.'
          : '답변을 끝까지 영어로 만들려는 시도가 좋습니다.',
      correctionComment:
        score >= 90
          ? `기준 표현 "${input.targetEnglish}"과 거의 같거나 매우 가깝습니다. 같은 패턴으로 반복해 익히면 좋아요.`
          : `정답 기준 "${input.targetEnglish}"에 더 가깝게 맞추려면 핵심 패턴과 동작 표현을 그대로 살려 보세요.`,
      meaningComment:
        score >= 90
          ? '한국어 문제의 핵심 의미가 정확하게 전달되었습니다.'
          : score >= 70
          ? '한국어 문제의 핵심 의미는 대체로 전달됐습니다. 다만 일부 뉘앙스를 더 선명하게 다듬을 수 있어요.'
          : '한국어 문제의 핵심 의미가 일부만 전달됐습니다. 말하려는 대상, 동작, 상황을 더 분명하게 넣어보세요.',
      suggestedAnswer: input.targetEnglish,
      suggestedAnswerAlt: input.naturalAnswer ?? input.easyAnswer ?? input.targetEnglish,
    };
  }

  private mockPracticePrompt(input: PracticePromptInput): PracticePromptResult {
    if (input.testType === 'translation') {
      return {
        testType: 'translation',
        promptKorean: input.koreanText,
        target: input.englishBase,
        tips: '핵심 의미를 살려 자연스럽게 영어로 말해보세요.',
      };
    }

    if (input.testType === 'think') {
      return {
        testType: 'think',
        promptKorean:
          input.thinkInEnglish?.trim() ||
          `This is used when you want to say "${input.englishBase}" in a natural conversation.`,
        promptContext: '영어 설명을 읽고 해당 영어 문장을 떠올려 말해보세요.',
        target: input.englishBase,
        targetAlt: input.englishNatural ?? input.englishEasy ?? input.englishBase,
        tips: '설명만 보고 영어 표현을 복원하는 연습입니다.',
      };
    }

    if (input.testType === 'pattern') {
      return {
        testType: 'pattern',
        promptKorean: '같은 영어 패턴으로 말할 수 있는 새로운 상황입니다. 영어로 답해보세요.',
        promptContext: `패턴 응용 상황: ${input.koreanText}와 비슷한 의미를 다른 장면에 맞게 영어로 표현해 보세요.`,
        target: input.englishBase,
        targetAlt: input.englishNatural ?? input.englishEasy ?? input.englishBase,
        referenceTarget: input.englishBase,
        tips: '문장 전체를 외우기보다 반복되는 틀을 잡아서 말해보세요.',
        patternLabel: '핵심 패턴 응용',
        patternDescription: '원래 문장의 영어 틀을 유지하면서 핵심 내용만 바꿔 말하는 연습입니다.',
      };
    }

    return {
      testType: 'situation',
      promptKorean: '이 말을 해야 하는 상황을 보고 영어로 답해보세요.',
      promptContext: `상황: ${input.koreanText}와 같은 의미를 상대에게 자연스럽게 전달하는 장면입니다.`,
      target: input.englishBase,
      tips: '직역보다 실제 대화처럼 자연스럽게 말해보세요.',
    };
  }

  private containsHangul(text: string) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
  }

}
