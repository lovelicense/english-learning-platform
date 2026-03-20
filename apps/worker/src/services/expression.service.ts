export class ExpressionService {
  async generate(koreanText: string) {
    return {
      base: "I'm on my way to pick up my kid.",
      natural: "I'm heading out to pick up my kid.",
      koreanText,
    };
  }
}
