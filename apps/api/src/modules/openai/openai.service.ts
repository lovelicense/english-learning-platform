import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  async generateExpressions(koreanText: string) {
    if (!this.client) {
      return this.mockExpression(koreanText);
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: 'You convert Korean daily speech into natural English. Return JSON with base, easy, natural, note.',
        },
        {
          role: 'user',
          content: `한국어: ${koreanText}`,
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

  async transcribeAudio(buffer: Buffer, fileName: string, diarization = false) {
    if (!this.client) {
      return {
        utterances: [
          { speakerLabel: 'speaker_1', startMs: 0, endMs: 1800, koreanText: '나 지금 애 데리러 가는 중이야' },
        ],
      };
    }

    const file = await OpenAI.toFile(buffer, fileName);
    const result = await this.client.audio.transcriptions.create({
      file,
      model: diarization
        ? process.env.OPENAI_STT_DIARIZE_MODEL ?? 'gpt-4o-transcribe'
        : process.env.OPENAI_STT_MODEL ?? 'gpt-4o-mini-transcribe',
      language: 'ko',
      response_format: 'verbose_json' as any,
    } as any);

    const text = (result as any).text ?? '';
    return {
      utterances: [
        { speakerLabel: 'speaker_1', startMs: 0, endMs: 2000, koreanText: text },
      ],
    };
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
}
