import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

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
  testType?: 'translation' | 'situation' | 'pattern' | 'shadowing';
  note?: string;
  easyAnswer?: string;
  naturalAnswer?: string;
  promptContext?: string;
};

type PracticeEvaluationResult = {
  score: number;
  meaningScore: number;
  naturalnessScore: number;
  grammarScore: number;
  feedback: string;
  strengthComment: string;
  correctionComment: string;
  suggestedAnswer: string;
  suggestedAnswerAlt?: string;
};

type PracticePromptInput = {
  koreanText: string;
  englishBase: string;
  englishEasy?: string;
  englishNatural?: string;
  note?: string;
  testType: 'translation' | 'situation' | 'pattern';
};

type PracticePromptResult = {
  testType: 'translation' | 'situation' | 'pattern';
  promptKorean: string;
  promptContext?: string;
  target: string;
  tips?: string;
  patternLabel?: string;
  patternDescription?: string;
};

@Injectable()
export class OpenAiService {
  private readonly client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  async analyzeConversation(input: {
    relationship?: string;
    situation?: string;
    tone?: string;
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
            'Return JSON with base, easy, natural, note.',
            'base: the best core sentence for memorizing and speaking.',
            'easy: simpler and easier spoken English with the same meaning.',
            'natural: the most natural conversational phrasing.',
            'note: explain the nuance and explicitly mention the key intent and context used in the interpretation.',
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
              note: { type: 'string' },
            },
            required: ['base', 'easy', 'natural', 'note'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    return JSON.parse(raw);
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
            'Provide concise Korean feedback.',
            'strengthComment: what the learner did well.',
            'correctionComment: what to improve and why.',
            'suggestedAnswer: a strong recommended answer.',
            'suggestedAnswerAlt: an alternative natural answer if relevant.',
            'Be encouraging and practical.',
            'Return JSON only.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `문제 유형: ${input.testType ?? 'translation'}`,
            `답변 방식: ${input.mode}`,
            `한국어 문제: ${input.koreanPrompt}`,
            input.promptContext ? `문제 상황 설명: ${input.promptContext}` : null,
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

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            'You create Korean situation prompts for English speaking practice.',
            'Given a Korean source sentence and its English target, generate either a short Korean situation description or a pattern drill prompt.',
            'If testType is situation, create a short Korean situation description that helps the learner produce the target meaning, but do not reveal the exact answer.',
            'If testType is pattern, extract the reusable English pattern, explain it in Korean, and generate a new Korean prompt that can be answered with the same pattern.',
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
              patternLabel: { type: 'string' },
              patternDescription: { type: 'string' },
            },
            required: ['promptKorean', 'promptContext', 'tips', 'patternLabel', 'patternDescription'],
          },
        },
      },
    } as any);

    const raw = (response as any).output_text ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      testType: input.testType,
      promptKorean: parsed.promptKorean,
      promptContext: parsed.promptContext,
      tips: parsed.tips,
      patternLabel: parsed.patternLabel,
      patternDescription: parsed.patternDescription,
      target: input.englishBase,
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

  const file = await OpenAI.toFile(buffer, fileName);

  let result: any;
  try {
    result = await this.client.audio.transcriptions.create({
      file,
      model: diarization
        ? process.env.OPENAI_STT_DIARIZE_MODEL ?? 'gpt-4o-transcribe-diarize'
        : process.env.OPENAI_STT_MODEL ?? 'gpt-4o-mini-transcribe',
      language: 'ko',
      response_format: diarization ? 'diarized_json' : 'json',
      ...(diarization ? { chunking_strategy: 'auto' } : {}),
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

  if (diarization) {
    const segments = ((result as any).segments ?? []) as Array<{
      speaker?: string;
      text?: string;
      start?: number;
      end?: number;
    }>;

    const utterances = segments
      .filter((s) => s.text && s.text.trim().length > 0)
      .map((s, index) => ({
        speakerLabel: s.speaker?.toLowerCase() ?? `speaker_${index + 1}`,
        startMs: Math.round((s.start ?? 0) * 1000),
        endMs: Math.round((s.end ?? 0) * 1000),
        koreanText: s.text!.trim(),
      }));

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
      `[STT diarization] file=${fileName} raw_segments=${segments.length} empty_segments=${emptySegmentCount} saved_utterances=${utterances.length} speakers=${Object.keys(
        speakerCounts,
      ).length} first_start_ms=${firstStartMs} last_end_ms=${lastEndMs} speaker_counts=${JSON.stringify(speakerCounts)}`,
    );
    console.info(`[STT diarization preview:first] file=${fileName} ${JSON.stringify(firstUtterancesPreview)}`);
    console.info(`[STT diarization preview:last] file=${fileName} ${JSON.stringify(lastUtterancesPreview)}`);

    return { utterances };
  }

  const text = (result as any).text ?? '';
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

    const file = await OpenAI.toFile(buffer, fileName);
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
        note: '아이와 보호자 대화 맥락을 반영해, 단순 금지보다 아직 어려서 안 된다는 의미로 풀었습니다.',
      };
    }
    if (koreanText.includes('데리러') || koreanText.includes('애')) {
      return {
        base: "I'm on my way to pick up my kid.",
        easy: "I'm going to pick up my child now.",
        natural: "I'm heading out to pick up my kid.",
        note: 'on my way와 pick up은 일상회화에서 자주 쓰는 표현입니다.',
      };
    }
    return {
      base: 'Here is a natural English version of your sentence.',
      easy: 'This is an easier spoken version.',
      natural: 'This is a more natural conversational version.',
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
          ? '지금 답변도 충분히 좋습니다. 더 다양한 말투로도 연습해 보세요.'
          : `기준 표현 "${input.targetEnglish}"를 중심으로 이유, 대상, 동작을 더 선명하게 넣어보세요.`,
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

    if (input.testType === 'pattern') {
      return {
        testType: 'pattern',
        promptKorean: '같은 영어 패턴으로 말할 수 있는 새로운 상황입니다. 영어로 답해보세요.',
        promptContext: `패턴 응용 상황: ${input.koreanText}와 비슷한 의미를 다른 장면에 맞게 영어로 표현해 보세요.`,
        target: input.englishBase,
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
      patternLabel: '상황형 응용',
      patternDescription: '문맥을 보고 가장 자연스러운 영어 표현을 떠올리는 연습입니다.',
    };
  }

  private containsHangul(text: string) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
  }

}
