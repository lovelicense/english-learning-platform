export async function scoreSpeakingAnswer(expected: string, answer: string) {
  const exact = expected.toLowerCase() === answer.toLowerCase();
  return {
    score: exact ? 100 : 75,
    feedback: exact ? "좋아요" : "핵심 의미는 맞지만 더 자연스럽게 말할 수 있어요.",
  };
}
