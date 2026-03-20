export type ExpressionVariant = {
  base: string;
  easy: string;
  natural: string;
  note: string;
};

export type GenerateExpressionRequest = {
  koreanText: string;
};

export type GenerateExpressionResponse = {
  koreanText: string;
  expression: ExpressionVariant;
};

export type PracticeScoreRequest = {
  target: string;
  answer: string;
};

export type PracticeScoreResponse = {
  score: number;
  feedback: string;
};

export type ReviewItem = {
  id: string;
  korean: string;
  english: string;
  mastery: number;
};
