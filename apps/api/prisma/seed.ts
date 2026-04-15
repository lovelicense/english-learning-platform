import {
  PrismaClient,
  Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();
const Level = {
  A1: 'A1',
  A2: 'A2',
} as const;
const Progress = {
  COLLECTED: 'COLLECTED',
  RECOGNIZED: 'RECOGNIZED',
  PRACTICING: 'PRACTICING',
  USABLE_IN_SPEAKING: 'USABLE_IN_SPEAKING',
  AUTOMATED: 'AUTOMATED',
} as const;
const Match = {
  RULE: 'RULE',
  LLM: 'LLM',
  MANUAL: 'MANUAL',
} as const;
const PartOfSpeech = {
  NOUN: 'NOUN',
  VERB: 'VERB',
  ADJECTIVE: 'ADJECTIVE',
  ADVERB: 'ADVERB',
  PRONOUN: 'PRONOUN',
  PREPOSITION: 'PREPOSITION',
  CONJUNCTION: 'CONJUNCTION',
  INTERJECTION: 'INTERJECTION',
  PHRASE: 'PHRASE',
  OTHER: 'OTHER',
} as const;

type PatternCategorySeed = {
  level: Prisma.CefrLevel;
  code: string;
  nameKo: string;
  nameEn: string;
  description?: string;
  targetCount: number;
  sortOrder: number;
};

type PatternTemplateSeed = {
  categoryCode: string;
  templateText: string;
  meaningKo: string;
  usageNote?: string;
  difficulty?: number;
  exampleEn?: string;
  exampleKo?: string;
};

type VocabularyCategorySeed = {
  code: string;
  nameKo: string;
  nameEn: string;
  description?: string;
  sortOrder: number;
};

type VocabularyItemSeed = {
  categoryCode?: string;
  level: Prisma.CefrLevel;
  lemma: string;
  partOfSpeech: Prisma.VocabularyPartOfSpeech;
  meaningKo: string;
  exampleEn?: string;
  exampleKo?: string;
  frequencyRank?: number;
  isCore?: boolean;
};

const patternCategories: PatternCategorySeed[] = [
  { level: Level.A1, code: 'request', nameKo: '요청', nameEn: 'Request', targetCount: 20, sortOrder: 1 },
  { level: Level.A1, code: 'clarification', nameKo: '되묻기', nameEn: 'Clarification', targetCount: 15, sortOrder: 2 },
  { level: Level.A1, code: 'feelings', nameKo: '감정/상태', nameEn: 'Feelings & States', targetCount: 12, sortOrder: 3 },
  { level: Level.A1, code: 'agreement', nameKo: '동의/비동의', nameEn: 'Agreement', targetCount: 10, sortOrder: 4 },
  { level: Level.A1, code: 'refusal', nameKo: '거절/보류', nameEn: 'Refusal', targetCount: 10, sortOrder: 5 },
  { level: Level.A1, code: 'permission', nameKo: '허가/가능 여부', nameEn: 'Permission', targetCount: 10, sortOrder: 6 },
  { level: Level.A1, code: 'thanks_apology', nameKo: '감사/사과', nameEn: 'Thanks & Apology', targetCount: 8, sortOrder: 7 },
  { level: Level.A1, code: 'basic_info', nameKo: '기본 정보 묻기', nameEn: 'Basic Information', targetCount: 12, sortOrder: 8 },
  { level: Level.A2, code: 'opinion', nameKo: '의견 말하기', nameEn: 'Opinion', targetCount: 25, sortOrder: 9 },
  { level: Level.A2, code: 'reason', nameKo: '이유 설명', nameEn: 'Reasoning', targetCount: 20, sortOrder: 10 },
  { level: Level.A2, code: 'suggestion', nameKo: '제안', nameEn: 'Suggestion', targetCount: 20, sortOrder: 11 },
  { level: Level.A2, code: 'scheduling', nameKo: '일정 조율', nameEn: 'Scheduling', targetCount: 20, sortOrder: 12 },
  { level: Level.A2, code: 'compare_preference', nameKo: '비교/선호', nameEn: 'Comparison & Preference', targetCount: 15, sortOrder: 13 },
  { level: Level.A2, code: 'problem_explain', nameKo: '문제 설명', nameEn: 'Problem Explanation', targetCount: 20, sortOrder: 14 },
  { level: Level.A2, code: 'intention_plan', nameKo: '의도/계획', nameEn: 'Intention & Plan', targetCount: 15, sortOrder: 15 },
  { level: Level.A2, code: 'soft_disagreement', nameKo: '부드러운 반대', nameEn: 'Soft Disagreement', targetCount: 15, sortOrder: 16 },
];

const patternTemplates: PatternTemplateSeed[] = [
  { categoryCode: 'request', templateText: 'Could you ~?', meaningKo: '~해 주실 수 있나요?', usageNote: '가장 범용적인 부탁 표현', exampleEn: 'Could you help me?', exampleKo: '저 좀 도와주실 수 있나요?' },
  { categoryCode: 'request', templateText: 'Can you ~?', meaningKo: '너 ~할 수 있어?', usageNote: '친근하고 직접적인 요청', exampleEn: 'Can you call me later?', exampleKo: '나중에 전화해줄래?' },
  { categoryCode: 'request', templateText: 'Could you please ~?', meaningKo: '부탁인데 ~해 주실 수 있나요?', usageNote: '조금 더 공손한 요청', exampleEn: 'Could you please wait a minute?', exampleKo: '잠깐만 기다려 주실 수 있나요?' },
  { categoryCode: 'request', templateText: 'Can I have ~?', meaningKo: '저 ~ 받을 수 있나요?', usageNote: '물건/서비스 요청', exampleEn: 'Can I have a coffee?', exampleKo: '커피 한 잔 받을 수 있을까요?' },
  { categoryCode: 'request', templateText: "I'd like ~.", meaningKo: '저는 ~을/를 원합니다.', usageNote: '주문/원함 표현', exampleEn: "I'd like some water.", exampleKo: '물 좀 주세요.' },
  { categoryCode: 'request', templateText: 'Please ~.', meaningKo: '부디 ~해 주세요.', usageNote: '짧고 직접적인 요청', exampleEn: 'Please wait here.', exampleKo: '여기서 기다려 주세요.' },
  { categoryCode: 'request', templateText: 'Can you help me with ~?', meaningKo: '저 ~ 좀 도와줄래?', usageNote: '도움 요청', exampleEn: 'Can you help me with this?', exampleKo: '이거 좀 도와줄래?' },
  { categoryCode: 'request', templateText: 'Could you get me ~?', meaningKo: '저 ~ 좀 가져다주실 수 있나요?', usageNote: '전달/가져오기 요청', exampleEn: 'Could you get me a chair?', exampleKo: '의자 하나 가져다주실 수 있나요?' },

  { categoryCode: 'clarification', templateText: 'Could you say that again?', meaningKo: '다시 말해 주실 수 있나요?', usageNote: '되묻기 기본형', exampleEn: 'Could you say that again, please?', exampleKo: '다시 말해 주시겠어요?' },
  { categoryCode: 'clarification', templateText: 'What do you mean?', meaningKo: '무슨 뜻이야?', usageNote: '의도 확인', exampleEn: 'What do you mean by that?', exampleKo: '그게 무슨 뜻이야?' },
  { categoryCode: 'clarification', templateText: 'Do you mean ~?', meaningKo: '네 말은 ~라는 뜻이야?', usageNote: '의미 재확인', exampleEn: 'Do you mean tomorrow?', exampleKo: '내일이라는 뜻이야?' },
  { categoryCode: 'clarification', templateText: "Sorry, I didn't catch that.", meaningKo: '죄송한데 못 들었어요.', usageNote: '잘 못 들었을 때', exampleEn: "Sorry, I didn't catch that. Could you repeat it?", exampleKo: '죄송한데 못 들었어요. 다시 말해 주실래요?' },
  { categoryCode: 'clarification', templateText: 'Can you speak more slowly?', meaningKo: '좀 더 천천히 말해 줄래?', usageNote: '속도 조절 요청', exampleEn: 'Can you speak more slowly, please?', exampleKo: '좀 더 천천히 말해 주실래요?' },
  { categoryCode: 'clarification', templateText: 'What does that mean?', meaningKo: '그게 무슨 뜻이야?', usageNote: '단어/표현 뜻 묻기', exampleEn: 'What does that mean in English?', exampleKo: '그게 영어로 무슨 뜻이야?' },
  { categoryCode: 'clarification', templateText: 'Can you repeat that?', meaningKo: '그거 다시 말해 줄래?', usageNote: '반복 요청', exampleEn: 'Can you repeat that one more time?', exampleKo: '한 번 더 말해 줄래?' },
  { categoryCode: 'clarification', templateText: 'How do you say ~ in English?', meaningKo: '영어로 ~를 어떻게 말해?', usageNote: '표현 확인', exampleEn: 'How do you say this in English?', exampleKo: '이걸 영어로 어떻게 말해?' },

  { categoryCode: 'feelings', templateText: "I'm tired.", meaningKo: '나 피곤해.', usageNote: '상태 표현', exampleEn: "I'm tired after work.", exampleKo: '일 끝나고 피곤해.' },
  { categoryCode: 'feelings', templateText: "I'm hungry.", meaningKo: '나 배고파.', usageNote: '기본 상태', exampleEn: "I'm hungry now.", exampleKo: '지금 배고파.' },
  { categoryCode: 'feelings', templateText: "I'm worried about ~.", meaningKo: '~가 걱정돼.', usageNote: '걱정 표현', exampleEn: "I'm worried about the meeting.", exampleKo: '회의가 걱정돼.' },
  { categoryCode: 'feelings', templateText: "I'm excited about ~.", meaningKo: '~가 기대돼.', usageNote: '기대감 표현', exampleEn: "I'm excited about the trip.", exampleKo: '여행이 기대돼.' },
  { categoryCode: 'feelings', templateText: "I'm okay.", meaningKo: '괜찮아.', usageNote: '무난한 상태', exampleEn: "I'm okay for now.", exampleKo: '지금은 괜찮아.' },
  { categoryCode: 'feelings', templateText: 'I feel better now.', meaningKo: '지금은 좀 나아졌어.', usageNote: '회복/개선 표현', exampleEn: 'I feel better now than before.', exampleKo: '전보다 지금은 좀 나아졌어.' },

  { categoryCode: 'agreement', templateText: 'I think so too.', meaningKo: '나도 그렇게 생각해.', usageNote: '동의', exampleEn: 'I think so too.', exampleKo: '나도 그렇게 생각해.' },
  { categoryCode: 'agreement', templateText: 'Me too.', meaningKo: '나도.', usageNote: '짧은 동의', exampleEn: 'I like it. Me too.', exampleKo: '난 좋아. 나도.' },
  { categoryCode: 'agreement', templateText: 'I agree.', meaningKo: '동의해.', usageNote: '명확한 동의', exampleEn: 'I agree with you.', exampleKo: '네 말에 동의해.' },
  { categoryCode: 'agreement', templateText: "You're right.", meaningKo: '네 말이 맞아.', usageNote: '상대 인정', exampleEn: "You're right about that.", exampleKo: '그건 네 말이 맞아.' },
  { categoryCode: 'agreement', templateText: "I don't think so.", meaningKo: '난 그렇게 생각 안 해.', usageNote: '비동의', exampleEn: "I don't think so, actually.", exampleKo: '사실 나는 그렇게 생각 안 해.' },
  { categoryCode: 'agreement', templateText: 'Not really.', meaningKo: '별로야 / 꼭 그렇진 않아.', usageNote: '부드러운 비동의', exampleEn: 'Not really.', exampleKo: '꼭 그렇진 않아.' },

  { categoryCode: 'refusal', templateText: "I can't right now.", meaningKo: '지금은 못 해.', usageNote: '즉시 거절', exampleEn: "I can't right now, sorry.", exampleKo: '지금은 못 해, 미안.' },
  { categoryCode: 'refusal', templateText: 'Maybe later.', meaningKo: '나중에 할게.', usageNote: '보류', exampleEn: 'Maybe later today.', exampleKo: '오늘은 나중에 할게.' },
  { categoryCode: 'refusal', templateText: 'Not now.', meaningKo: '지금은 아니야.', usageNote: '짧은 거절', exampleEn: 'Not now, please.', exampleKo: '지금은 아니야.' },
  { categoryCode: 'refusal', templateText: "Sorry, I can't.", meaningKo: '미안하지만 못 해.', usageNote: '정중한 거절', exampleEn: "Sorry, I can't help you now.", exampleKo: '미안하지만 지금은 도와줄 수 없어.' },
  { categoryCode: 'refusal', templateText: "That won't work for me.", meaningKo: '그건 나한텐 안 맞아.', usageNote: '대안 필요', exampleEn: "That won't work for me today.", exampleKo: '오늘은 그건 나한테 안 맞아.' },
  { categoryCode: 'refusal', templateText: "I'm busy right now.", meaningKo: '지금은 바빠.', usageNote: '상황 설명형 거절', exampleEn: "I'm busy right now, can we talk later?", exampleKo: '지금 바빠. 나중에 얘기할까?' },

  { categoryCode: 'permission', templateText: 'Can I ~?', meaningKo: '내가 ~해도 돼?', usageNote: '기본 허가 요청', exampleEn: 'Can I sit here?', exampleKo: '여기 앉아도 돼?' },
  { categoryCode: 'permission', templateText: 'Is it okay if I ~?', meaningKo: '내가 ~해도 괜찮을까?', usageNote: '조금 부드러운 허가 요청', exampleEn: 'Is it okay if I leave early?', exampleKo: '일찍 가도 괜찮을까요?' },
  { categoryCode: 'permission', templateText: 'Am I allowed to ~?', meaningKo: '내가 ~해도 되는 거야?', usageNote: '규칙/허용 여부', exampleEn: 'Am I allowed to park here?', exampleKo: '여기 주차해도 되는 거야?' },
  { categoryCode: 'permission', templateText: 'Can we ~?', meaningKo: '우리 ~해도 돼?', usageNote: '함께 진행 허가', exampleEn: 'Can we start now?', exampleKo: '이제 시작해도 돼?' },
  { categoryCode: 'permission', templateText: 'Can I use ~?', meaningKo: '내가 ~ 써도 돼?', usageNote: '물건/도구 사용', exampleEn: 'Can I use your phone?', exampleKo: '네 전화 써도 돼?' },
  { categoryCode: 'permission', templateText: 'Could I ~?', meaningKo: '제가 ~해도 될까요?', usageNote: '조금 더 공손한 허가 요청', exampleEn: 'Could I borrow this?', exampleKo: '이거 빌려도 될까요?' },

  { categoryCode: 'thanks_apology', templateText: 'Thank you.', meaningKo: '고마워요.', usageNote: '기본 감사', exampleEn: 'Thank you for your help.', exampleKo: '도와줘서 고마워요.' },
  { categoryCode: 'thanks_apology', templateText: 'Thanks a lot.', meaningKo: '정말 고마워.', usageNote: '강한 감사', exampleEn: 'Thanks a lot for coming.', exampleKo: '와줘서 정말 고마워.' },
  { categoryCode: 'thanks_apology', templateText: 'Sorry about that.', meaningKo: '그건 미안해.', usageNote: '가벼운 사과', exampleEn: 'Sorry about that mistake.', exampleKo: '그 실수는 미안해.' },
  { categoryCode: 'thanks_apology', templateText: 'I appreciate it.', meaningKo: '정말 고마워.', usageNote: '감사 강조', exampleEn: 'I appreciate it very much.', exampleKo: '정말 감사해.' },
  { categoryCode: 'thanks_apology', templateText: 'My bad.', meaningKo: '내 잘못이야.', usageNote: '가벼운 사과', exampleEn: 'My bad. I forgot.', exampleKo: '내 잘못이야. 내가 깜빡했어.' },

  { categoryCode: 'basic_info', templateText: 'How much is it?', meaningKo: '얼마예요?', usageNote: '가격 묻기', exampleEn: 'How much is it in total?', exampleKo: '총 얼마예요?' },
  { categoryCode: 'basic_info', templateText: 'Where is ~?', meaningKo: '~는 어디예요?', usageNote: '위치 묻기', exampleEn: 'Where is the station?', exampleKo: '역이 어디예요?' },
  { categoryCode: 'basic_info', templateText: 'What time is it?', meaningKo: '지금 몇 시예요?', usageNote: '시간 묻기', exampleEn: 'What time is it now?', exampleKo: '지금 몇 시예요?' },
  { categoryCode: 'basic_info', templateText: 'When does it start?', meaningKo: '언제 시작해요?', usageNote: '시작 시점 묻기', exampleEn: 'When does the meeting start?', exampleKo: '회의는 언제 시작해요?' },
  { categoryCode: 'basic_info', templateText: 'Who is that?', meaningKo: '저 사람 누구예요?', usageNote: '사람 확인', exampleEn: 'Who is that person?', exampleKo: '저 사람 누구예요?' },
  { categoryCode: 'basic_info', templateText: 'What is this?', meaningKo: '이게 뭐예요?', usageNote: '대상 확인', exampleEn: 'What is this called?', exampleKo: '이거 뭐라고 해요?' },
  { categoryCode: 'basic_info', templateText: 'How far is ~?', meaningKo: '~가 얼마나 멀어요?', usageNote: '거리 묻기', exampleEn: 'How far is the station?', exampleKo: '역이 얼마나 멀어요?' },
  { categoryCode: 'basic_info', templateText: 'How long does it take?', meaningKo: '얼마나 걸려요?', usageNote: '소요 시간 묻기', exampleEn: 'How long does it take by bus?', exampleKo: '버스로 얼마나 걸려요?' },
  { categoryCode: 'basic_info', templateText: 'Which one is ~?', meaningKo: '어느 것이 ~예요?', usageNote: '선택지 확인', exampleEn: 'Which one is mine?', exampleKo: '어느 게 제 거예요?' },

  { categoryCode: 'opinion', templateText: 'I think ~.', meaningKo: '나는 ~라고 생각해.', usageNote: '가장 기본 의견 말하기', exampleEn: 'I think it is a good idea.', exampleKo: '좋은 생각이라고 봐.' },
  { categoryCode: 'opinion', templateText: "I don't think ~.", meaningKo: '나는 ~라고 생각하지 않아.', usageNote: '부정 의견', exampleEn: "I don't think that will work.", exampleKo: '그건 안 될 것 같아.' },
  { categoryCode: 'opinion', templateText: 'In my opinion, ~.', meaningKo: '내 의견으로는 ~.', usageNote: '명시적 의견', exampleEn: 'In my opinion, we should wait.', exampleKo: '내 생각엔 기다려야 해.' },
  { categoryCode: 'opinion', templateText: 'From my point of view, ~.', meaningKo: '내 관점에서는 ~.', usageNote: '조금 더 공식적인 의견', exampleEn: 'From my point of view, this is better.', exampleKo: '내 관점에서는 이게 더 좋아.' },
  { categoryCode: 'opinion', templateText: 'It seems to me that ~.', meaningKo: '내가 보기엔 ~인 것 같아.', usageNote: '완곡한 의견', exampleEn: 'It seems to me that he is busy.', exampleKo: '내가 보기엔 그가 바쁜 것 같아.' },
  { categoryCode: 'opinion', templateText: 'I feel like ~.', meaningKo: '왠지 ~인 것 같아.', usageNote: '감각적 판단', exampleEn: 'I feel like we should leave now.', exampleKo: '지금 나가야 할 것 같아.' },
  { categoryCode: 'opinion', templateText: 'Personally, ~.', meaningKo: '개인적으로는 ~.', usageNote: '부드러운 자기 의견', exampleEn: 'Personally, I like this one.', exampleKo: '개인적으로는 이게 좋아.' },
  { categoryCode: 'opinion', templateText: 'I guess ~.', meaningKo: '아마 ~인 것 같아.', usageNote: '가벼운 추측형 의견', exampleEn: 'I guess we can try that.', exampleKo: '아마 그걸 해봐도 될 것 같아.' },
  { categoryCode: 'opinion', templateText: 'To me, ~.', meaningKo: '내게는 ~하게 느껴져.', usageNote: '짧은 의견 표현', exampleEn: 'To me, this feels too risky.', exampleKo: '내겐 이게 너무 위험해 보여.' },
  { categoryCode: 'opinion', templateText: 'If you ask me, ~.', meaningKo: '내 생각엔 ~.', usageNote: '강조된 의견 시작', exampleEn: 'If you ask me, we should wait.', exampleKo: '내 생각엔 기다려야 해.' },

  { categoryCode: 'reason', templateText: 'because ~', meaningKo: '왜냐하면 ~', usageNote: '이유를 붙이는 기본형', exampleEn: 'I stayed because it was raining.', exampleKo: '비가 와서 남았어.' },
  { categoryCode: 'reason', templateText: 'The reason is that ~.', meaningKo: '이유는 ~야.', usageNote: '이유 설명', exampleEn: 'The reason is that I was tired.', exampleKo: '이유는 내가 피곤했기 때문이야.' },
  { categoryCode: 'reason', templateText: "It's because ~.", meaningKo: '그건 ~ 때문이야.', usageNote: '설명형 이유', exampleEn: "It's because I don't have time.", exampleKo: '그건 시간이 없어서야.' },
  { categoryCode: 'reason', templateText: "That's why ~.", meaningKo: '그래서 ~야.', usageNote: '결과 연결', exampleEn: "That's why I left early.", exampleKo: '그래서 일찍 떠났어.' },
  { categoryCode: 'reason', templateText: 'One reason is that ~.', meaningKo: '이유 중 하나는 ~야.', usageNote: '이유 일부 설명', exampleEn: 'One reason is that it is cheaper.', exampleKo: '이유 중 하나는 더 싸기 때문이야.' },
  { categoryCode: 'reason', templateText: "So that's why ~.", meaningKo: '그래서 ~한 거야.', usageNote: '대화식 이유 정리', exampleEn: "So that's why I called you.", exampleKo: '그래서 네게 전화한 거야.' },
  { categoryCode: 'reason', templateText: 'That is because ~.', meaningKo: '그건 ~ 때문이야.', usageNote: '짧고 직접적인 이유 설명', exampleEn: 'That is because we were late.', exampleKo: '그건 우리가 늦었기 때문이야.' },
  { categoryCode: 'reason', templateText: 'Mainly because ~.', meaningKo: '주로 ~ 때문에.', usageNote: '핵심 이유 압축', exampleEn: 'Mainly because I was busy.', exampleKo: '주로 내가 바빴기 때문이야.' },
  { categoryCode: 'reason', templateText: 'The main reason is ~.', meaningKo: '주된 이유는 ~야.', usageNote: '핵심 이유 강조', exampleEn: 'The main reason is time.', exampleKo: '주된 이유는 시간이야.' },

  { categoryCode: 'suggestion', templateText: "Why don't we ~?", meaningKo: '우리 ~하는 거 어때?', usageNote: '가장 범용적인 제안', exampleEn: "Why don't we meet tomorrow?", exampleKo: '우리 내일 만나는 거 어때?' },
  { categoryCode: 'suggestion', templateText: 'How about ~?', meaningKo: '~하는 건 어때?', usageNote: '짧은 제안', exampleEn: 'How about dinner?', exampleKo: '저녁은 어때?' },
  { categoryCode: 'suggestion', templateText: 'Maybe we should ~.', meaningKo: '아마 ~하는 게 좋을 것 같아.', usageNote: '부드러운 제안', exampleEn: 'Maybe we should call first.', exampleKo: '먼저 전화하는 게 좋을 것 같아.' },
  { categoryCode: 'suggestion', templateText: "Let's ~.", meaningKo: '우리 ~하자.', usageNote: '직접 제안', exampleEn: "Let's go now.", exampleKo: '이제 가자.' },
  { categoryCode: 'suggestion', templateText: 'We could ~.', meaningKo: '우리는 ~할 수 있어.', usageNote: '선택지 제시', exampleEn: 'We could take a taxi.', exampleKo: '택시를 탈 수도 있어.' },
  { categoryCode: 'suggestion', templateText: 'What if we ~?', meaningKo: '만약 우리가 ~하면 어떨까?', usageNote: '대안 제시', exampleEn: 'What if we change the plan?', exampleKo: '계획을 바꾸면 어때?' },
  { categoryCode: 'suggestion', templateText: 'Maybe try ~.', meaningKo: '~를 해보는 건 어때?', usageNote: '짧은 제안', exampleEn: 'Maybe try the other one.', exampleKo: '다른 걸 해보는 건 어때?' },
  { categoryCode: 'suggestion', templateText: 'You might want to ~.', meaningKo: '~하는 게 좋을 수도 있어.', usageNote: '조심스러운 제안', exampleEn: 'You might want to rest first.', exampleKo: '먼저 쉬는 게 좋을 수도 있어.' },
  { categoryCode: 'suggestion', templateText: 'It would be better to ~.', meaningKo: '~하는 편이 더 좋을 거야.', usageNote: '대안 권유', exampleEn: 'It would be better to leave earlier.', exampleKo: '더 일찍 출발하는 게 좋을 거야.' },

  { categoryCode: 'scheduling', templateText: 'Are you free on ~?', meaningKo: '~에 시간 있어?', usageNote: '일정 확인', exampleEn: 'Are you free on Friday?', exampleKo: '금요일에 시간 있어?' },
  { categoryCode: 'scheduling', templateText: 'What time works for you?', meaningKo: '언제가 괜찮아?', usageNote: '시간 조율', exampleEn: 'What time works for you tomorrow?', exampleKo: '내일 몇 시가 괜찮아?' },
  { categoryCode: 'scheduling', templateText: 'Can we move it to ~?', meaningKo: '그걸 ~로 옮길 수 있을까?', usageNote: '변경 요청', exampleEn: 'Can we move it to Monday?', exampleKo: '월요일로 옮길 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'Does ~ work for you?', meaningKo: '~는 괜찮아?', usageNote: '일정 합의', exampleEn: 'Does 3 p.m. work for you?', exampleKo: '오후 3시는 괜찮아?' },
  { categoryCode: 'scheduling', templateText: "I'm available after ~.", meaningKo: '나는 ~ 이후에 가능해.', usageNote: '가능 시간 말하기', exampleEn: "I'm available after 6.", exampleKo: '6시 이후에 가능해.' },
  { categoryCode: 'scheduling', templateText: "Let's do it another day.", meaningKo: '다른 날 하자.', usageNote: '일정 재조정', exampleEn: "Let's do it another day.", exampleKo: '다른 날 하자.' },
  { categoryCode: 'scheduling', templateText: 'Can we make it earlier?', meaningKo: '좀 더 일찍 할 수 있을까?', usageNote: '앞당기기 요청', exampleEn: 'Can we make it earlier tomorrow?', exampleKo: '내일 좀 더 일찍 할 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'Can we make it later?', meaningKo: '좀 더 늦게 할 수 있을까?', usageNote: '뒤로 미루기 요청', exampleEn: 'Can we make it later in the day?', exampleKo: '오늘 조금 더 늦게 할 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'I will let you know by ~.', meaningKo: '~까지 알려줄게.', usageNote: '확정 시점 안내', exampleEn: 'I will let you know by tonight.', exampleKo: '오늘 밤까지 알려줄게.' },

  { categoryCode: 'compare_preference', templateText: 'I prefer ~ to ~.', meaningKo: '~보다 ~를 더 좋아해.', usageNote: '비교 선호', exampleEn: 'I prefer coffee to tea.', exampleKo: '나는 차보다 커피를 더 좋아해.' },
  { categoryCode: 'compare_preference', templateText: "I'd rather ~.", meaningKo: '차라리 ~하겠어.', usageNote: '선택 선호', exampleEn: "I'd rather stay home.", exampleKo: '차라리 집에 있겠어.' },
  { categoryCode: 'compare_preference', templateText: '~ is better than ~.', meaningKo: '~가 ~보다 더 좋아.', usageNote: '직접 비교', exampleEn: 'This is better than that.', exampleKo: '이게 저것보다 더 좋아.' },
  { categoryCode: 'compare_preference', templateText: 'I like ~ more because ~.', meaningKo: '~를 더 좋아해, 왜냐하면 ~.', usageNote: '이유가 있는 선호', exampleEn: 'I like this one more because it is lighter.', exampleKo: '이게 더 가벼워서 더 좋아.' },
  { categoryCode: 'compare_preference', templateText: 'This one is more ~.', meaningKo: '이건 더 ~해.', usageNote: '형용사 비교', exampleEn: 'This one is more convenient.', exampleKo: '이게 더 편리해.' },
  { categoryCode: 'compare_preference', templateText: "I'd choose ~.", meaningKo: '나는 ~를 고를 거야.', usageNote: '선택 표현', exampleEn: "I'd choose the blue one.", exampleKo: '파란색을 고를 거야.' },
  { categoryCode: 'compare_preference', templateText: '~ is not as ~ as ~.', meaningKo: '~는 ~만큼 ...하지 않아.', usageNote: '비교 약화 표현', exampleEn: 'This one is not as cheap as that one.', exampleKo: '이건 저것만큼 싸지 않아.' },
  { categoryCode: 'compare_preference', templateText: 'I like both, but ~.', meaningKo: '둘 다 좋지만, ~.', usageNote: '선호 차이 설명', exampleEn: 'I like both, but this one is easier.', exampleKo: '둘 다 좋지만 이게 더 쉬워.' },
  { categoryCode: 'compare_preference', templateText: 'The difference is ~.', meaningKo: '차이는 ~야.', usageNote: '비교 차이 설명', exampleEn: 'The difference is the price.', exampleKo: '차이는 가격이야.' },

  { categoryCode: 'problem_explain', templateText: "There's a problem with ~.", meaningKo: '~에 문제가 있어.', usageNote: '문제 상황 알림', exampleEn: "There's a problem with the app.", exampleKo: '앱에 문제가 있어.' },
  { categoryCode: 'problem_explain', templateText: "It doesn't work.", meaningKo: '안 돼 / 작동 안 해.', usageNote: '고장/불가', exampleEn: "It doesn't work anymore.", exampleKo: '이제 안 돼.' },
  { categoryCode: 'problem_explain', templateText: "I'm having trouble with ~.", meaningKo: '~ 때문에 어려움을 겪고 있어.', usageNote: '도움 요청 맥락', exampleEn: "I'm having trouble with my phone.", exampleKo: '휴대폰 때문에 좀 어려워.' },
  { categoryCode: 'problem_explain', templateText: 'Something is wrong with ~.', meaningKo: '~에 뭐가 잘못됐어.', usageNote: '문제 이상 징후', exampleEn: 'Something is wrong with the sound.', exampleKo: '소리에 문제가 있어.' },
  { categoryCode: 'problem_explain', templateText: "I can't get ~ to work.", meaningKo: '~를 작동시키지 못하겠어.', usageNote: '문제 해결 실패', exampleEn: "I can't get the printer to work.", exampleKo: '프린터가 안 돼.' },
  { categoryCode: 'problem_explain', templateText: "It keeps ~ing.", meaningKo: '계속 ~해.', usageNote: '반복 문제', exampleEn: 'It keeps crashing.', exampleKo: '계속 꺼져.' },
  { categoryCode: 'problem_explain', templateText: '~ is missing.', meaningKo: '~가 빠졌어.', usageNote: '누락 설명', exampleEn: 'The file is missing.', exampleKo: '파일이 빠졌어.' },
  { categoryCode: 'problem_explain', templateText: 'I made a mistake with ~.', meaningKo: '~에서 실수했어.', usageNote: '자기 실수 설명', exampleEn: 'I made a mistake with the order.', exampleKo: '주문에서 실수했어.' },
  { categoryCode: 'problem_explain', templateText: 'The issue is ~.', meaningKo: '문제는 ~야.', usageNote: '핵심 문제 정리', exampleEn: 'The issue is the timing.', exampleKo: '문제는 타이밍이야.' },

  { categoryCode: 'intention_plan', templateText: 'I plan to ~.', meaningKo: '~할 계획이야.', usageNote: '계획 표현', exampleEn: 'I plan to study tonight.', exampleKo: '오늘 밤 공부할 계획이야.' },
  { categoryCode: 'intention_plan', templateText: "I'm going to ~.", meaningKo: '~할 거야.', usageNote: '가까운 미래', exampleEn: "I'm going to leave soon.", exampleKo: '곧 떠날 거야.' },
  { categoryCode: 'intention_plan', templateText: "I want to ~.", meaningKo: '~하고 싶어.', usageNote: '원함/의도', exampleEn: "I want to learn more.", exampleKo: '더 배우고 싶어.' },
  { categoryCode: 'intention_plan', templateText: "I'm thinking of ~ing.", meaningKo: '~할까 생각 중이야.', usageNote: '고민 중', exampleEn: "I'm thinking of moving.", exampleKo: '이사할까 생각 중이야.' },
  { categoryCode: 'intention_plan', templateText: 'I hope to ~.', meaningKo: '~하길 바라.', usageNote: '희망', exampleEn: 'I hope to finish soon.', exampleKo: '빨리 끝내길 바라.' },
  { categoryCode: 'intention_plan', templateText: 'I am trying to ~.', meaningKo: '~하려고 노력 중이야.', usageNote: '진행 중인 노력', exampleEn: 'I am trying to save money.', exampleKo: '돈을 모으려고 노력 중이야.' },
  { categoryCode: 'intention_plan', templateText: 'I need to ~ first.', meaningKo: '먼저 ~해야 해.', usageNote: '선행 계획', exampleEn: 'I need to check first.', exampleKo: '먼저 확인해야 해.' },
  { categoryCode: 'intention_plan', templateText: 'My plan is to ~.', meaningKo: '내 계획은 ~하는 거야.', usageNote: '계획 명시', exampleEn: 'My plan is to finish this today.', exampleKo: '내 계획은 오늘 이걸 끝내는 거야.' },

  { categoryCode: 'soft_disagreement', templateText: 'I see your point, but ~.', meaningKo: '네 말은 알겠는데, ~.', usageNote: '부드러운 반대', exampleEn: 'I see your point, but I disagree.', exampleKo: '네 말은 알겠는데, 나는 반대야.' },
  { categoryCode: 'soft_disagreement', templateText: 'I understand, but ~.', meaningKo: '이해는 하는데, ~.', usageNote: '완곡한 반대', exampleEn: 'I understand, but we need more time.', exampleKo: '이해는 하는데, 시간이 더 필요해.' },
  { categoryCode: 'soft_disagreement', templateText: 'That may be true, but ~.', meaningKo: '그럴 수도 있지만, ~.', usageNote: '논점 전환', exampleEn: 'That may be true, but it is still risky.', exampleKo: '그럴 수도 있지만 아직 위험해.' },
  { categoryCode: 'soft_disagreement', templateText: "I'm not sure about that.", meaningKo: '그건 잘 모르겠어.', usageNote: '완곡한 반대/유보', exampleEn: "I'm not sure about that idea.", exampleKo: '그 아이디어는 잘 모르겠어.' },
  { categoryCode: 'soft_disagreement', templateText: 'Maybe we should try ~ instead.', meaningKo: '대신 ~을 해보는 게 어때?', usageNote: '대안 제시', exampleEn: 'Maybe we should try another way instead.', exampleKo: '대신 다른 방법을 해보는 게 어때?' },
  { categoryCode: 'soft_disagreement', templateText: "I wouldn't say that.", meaningKo: '난 그렇게 말하진 않을 것 같아.', usageNote: '부드러운 반론', exampleEn: "I wouldn't say that is the main issue.", exampleKo: '그게 핵심 문제라고 하진 않을 것 같아.' },
  { categoryCode: 'soft_disagreement', templateText: 'I get it, but ~.', meaningKo: '무슨 말인진 알겠는데, ~.', usageNote: '구어체 완곡 반대', exampleEn: 'I get it, but I still disagree.', exampleKo: '무슨 말인진 알겠는데 그래도 난 반대야.' },
  { categoryCode: 'soft_disagreement', templateText: 'I am not convinced that ~.', meaningKo: '~라는 점은 아직 확신이 안 들어.', usageNote: '조심스러운 반론', exampleEn: 'I am not convinced that this is enough.', exampleKo: '이걸로 충분하다는 점은 아직 확신이 안 들어.' },
  { categoryCode: 'soft_disagreement', templateText: 'Maybe, but I think ~.', meaningKo: '그럴 수도 있지만 내 생각엔 ~.', usageNote: '대안 의견 연결', exampleEn: 'Maybe, but I think we need more time.', exampleKo: '그럴 수도 있지만 내 생각엔 시간이 더 필요해.' },
  { categoryCode: 'request', templateText: 'Would you mind ~ing?', meaningKo: '~해 줄 수 있을까?', usageNote: '부드러운 부탁', exampleEn: 'Would you mind opening the window?', exampleKo: '창문 좀 열어줄래?' },
  { categoryCode: 'request', templateText: 'Can you take a look?', meaningKo: '잠깐 봐줄래?', usageNote: '확인 부탁', exampleEn: 'Can you take a look at this?', exampleKo: '이거 잠깐 봐줄래?' },
  { categoryCode: 'request', templateText: 'Please let me know.', meaningKo: '알려 주세요.', usageNote: '응답 요청', exampleEn: 'Please let me know by tonight.', exampleKo: '오늘 밤까지 알려 주세요.' },
  { categoryCode: 'clarification', templateText: 'What exactly do you mean?', meaningKo: '정확히 무슨 뜻이야?', usageNote: '의도 상세 확인', exampleEn: 'What exactly do you mean by that?', exampleKo: '정확히 무슨 뜻으로 한 말이야?' },
  { categoryCode: 'clarification', templateText: 'So you mean ~?', meaningKo: '그러니까 네 말은 ~라는 거지?', usageNote: '정리형 되묻기', exampleEn: 'So you mean we should wait?', exampleKo: '그러니까 기다려야 한다는 거지?' },
  { categoryCode: 'feelings', templateText: "I'm relieved.", meaningKo: '안심이 돼.', usageNote: '안도감 표현', exampleEn: "I'm relieved to hear that.", exampleKo: '그 말 들으니 안심이 돼.' },
  { categoryCode: 'feelings', templateText: "I'm frustrated.", meaningKo: '답답해.', usageNote: '답답함/짜증 표현', exampleEn: "I'm frustrated with this issue.", exampleKo: '이 문제 때문에 답답해.' },
  { categoryCode: 'agreement', templateText: 'Exactly.', meaningKo: '맞아, 바로 그거야.', usageNote: '강한 동의', exampleEn: 'Exactly. That is what I meant.', exampleKo: '맞아. 내가 그 말 하려던 거야.' },
  { categoryCode: 'agreement', templateText: 'That makes sense.', meaningKo: '그거 말이 되네.', usageNote: '상대 의견 수용', exampleEn: 'That makes sense to me.', exampleKo: '그거 이해돼.' },
  { categoryCode: 'refusal', templateText: "I'd rather not.", meaningKo: '안 하는 게 좋을 것 같아.', usageNote: '직설적이지 않은 거절', exampleEn: "I'd rather not talk about it now.", exampleKo: '지금은 그 얘기 안 하는 게 좋을 것 같아.' },
  { categoryCode: 'permission', templateText: 'Go ahead.', meaningKo: '그래, 해도 돼.', usageNote: '허가 응답', exampleEn: 'Go ahead and start.', exampleKo: '그래, 시작해도 돼.' },
  { categoryCode: 'thanks_apology', templateText: 'No worries.', meaningKo: '괜찮아, 신경 쓰지 마.', usageNote: '사과에 대한 응답', exampleEn: 'No worries. It happens.', exampleKo: '괜찮아. 그럴 수도 있지.' },
  { categoryCode: 'thanks_apology', templateText: 'I am sorry for ~.', meaningKo: '~해서 미안해.', usageNote: '이유가 있는 사과', exampleEn: 'I am sorry for being late.', exampleKo: '늦어서 미안해.' },
  { categoryCode: 'suggestion', templateText: 'How about we ~?', meaningKo: '우리 ~하는 거 어때?', usageNote: '주어 포함 제안', exampleEn: 'How about we talk later?', exampleKo: '우리 나중에 얘기하는 거 어때?' },
  { categoryCode: 'scheduling', templateText: 'I am running late.', meaningKo: '나 좀 늦고 있어.', usageNote: '지각 상황 알림', exampleEn: 'I am running late, sorry.', exampleKo: '나 좀 늦고 있어, 미안.' },
  { categoryCode: 'compare_preference', templateText: 'I am more comfortable with ~.', meaningKo: '~가 더 편해.', usageNote: '편안함 기준 선호', exampleEn: 'I am more comfortable with email.', exampleKo: '나는 이메일이 더 편해.' },
  { categoryCode: 'problem_explain', templateText: 'It stopped working.', meaningKo: '갑자기 작동이 멈췄어.', usageNote: '갑작스러운 고장 설명', exampleEn: 'It stopped working this morning.', exampleKo: '오늘 아침부터 작동이 멈췄어.' },
  { categoryCode: 'intention_plan', templateText: 'I am about to ~.', meaningKo: '막 ~하려고 해.', usageNote: '바로 직전 계획', exampleEn: 'I am about to leave.', exampleKo: '막 나가려고 해.' },
  { categoryCode: 'soft_disagreement', templateText: 'I see it differently.', meaningKo: '나는 좀 다르게 봐.', usageNote: '짧은 완곡 반대', exampleEn: 'I see it differently this time.', exampleKo: '이번엔 나는 좀 다르게 봐.' },
  { categoryCode: 'request', templateText: 'Can you come with me?', meaningKo: '같이 가줄래?', usageNote: '동행 요청', exampleEn: 'Can you come with me for a minute?', exampleKo: '잠깐 같이 가줄래?' },
  { categoryCode: 'request', templateText: 'Can you pick it up?', meaningKo: '그거 좀 집어줄래?/찾아줄래?', usageNote: '물건 요청', exampleEn: 'Can you pick it up for me?', exampleKo: '그거 좀 집어줄래?' },
  { categoryCode: 'request', templateText: 'Can you hold this?', meaningKo: '이거 좀 들어줄래?', usageNote: '잠깐 맡기기', exampleEn: 'Can you hold this for a second?', exampleKo: '이거 잠깐 들어줄래?' },
  { categoryCode: 'clarification', templateText: 'Which part?', meaningKo: '어느 부분?', usageNote: '부분 확인', exampleEn: 'Which part do you mean?', exampleKo: '어느 부분을 말하는 거야?' },
  { categoryCode: 'clarification', templateText: 'What happened?', meaningKo: '무슨 일이 있었어?', usageNote: '상황 확인', exampleEn: 'What happened here?', exampleKo: '여기 무슨 일 있었어?' },
  { categoryCode: 'feelings', templateText: "I'm not ready.", meaningKo: '아직 준비가 안 됐어.', usageNote: '심리 상태/준비 부족', exampleEn: "I'm not ready yet.", exampleKo: '아직 준비가 안 됐어.' },
  { categoryCode: 'feelings', templateText: "I'm okay with ~.", meaningKo: '~도 괜찮아.', usageNote: '수용 가능 상태', exampleEn: "I'm okay with that plan.", exampleKo: '그 계획도 괜찮아.' },
  { categoryCode: 'agreement', templateText: 'Sounds good.', meaningKo: '좋아 보여.', usageNote: '간단 동의', exampleEn: 'Sounds good to me.', exampleKo: '좋은데.' },
  { categoryCode: 'agreement', templateText: 'That works for me.', meaningKo: '난 괜찮아.', usageNote: '일정/조건 수락', exampleEn: 'That works for me tomorrow.', exampleKo: '나는 내일 괜찮아.' },
  { categoryCode: 'refusal', templateText: "I can't make it.", meaningKo: '나 못 갈 것 같아.', usageNote: '참석 불가', exampleEn: "Sorry, I can't make it tonight.", exampleKo: '미안, 오늘 밤엔 못 갈 것 같아.' },
  { categoryCode: 'refusal', templateText: 'Maybe next time.', meaningKo: '다음에 하자.', usageNote: '완곡한 거절', exampleEn: 'Maybe next time would be better.', exampleKo: '다음에 하는 게 좋겠다.' },
  { categoryCode: 'permission', templateText: 'Feel free to ~.', meaningKo: '편하게 ~해.', usageNote: '허용/권유', exampleEn: 'Feel free to ask me anything.', exampleKo: '편하게 뭐든 물어봐.' },
  { categoryCode: 'permission', templateText: 'You can use ~.', meaningKo: '~를 써도 돼.', usageNote: '도구/자원 허가', exampleEn: 'You can use my charger.', exampleKo: '내 충전기 써도 돼.' },
  { categoryCode: 'thanks_apology', templateText: 'Thanks anyway.', meaningKo: '그래도 고마워.', usageNote: '도움이 안 돼도 감사', exampleEn: 'Thanks anyway for trying.', exampleKo: '그래도 도와주려 해서 고마워.' },
  { categoryCode: 'thanks_apology', templateText: 'That is my fault.', meaningKo: '그건 내 잘못이야.', usageNote: '책임 인정', exampleEn: 'That is my fault. Sorry.', exampleKo: '그건 내 잘못이야. 미안.' },
  { categoryCode: 'basic_info', templateText: 'How do I get to ~?', meaningKo: '~에 어떻게 가요?', usageNote: '길 묻기', exampleEn: 'How do I get to the station?', exampleKo: '역에 어떻게 가요?' },
  { categoryCode: 'basic_info', templateText: 'What is wrong?', meaningKo: '뭐가 문제야?', usageNote: '문제 확인', exampleEn: 'What is wrong with it?', exampleKo: '뭐가 문제야?' },
  { categoryCode: 'suggestion', templateText: 'Let me ~.', meaningKo: '내가 ~할게.', usageNote: '자기 제안', exampleEn: 'Let me handle it.', exampleKo: '내가 처리할게.' },
  { categoryCode: 'suggestion', templateText: 'Why not ~?', meaningKo: '~하는 게 어때?', usageNote: '짧은 대안 제안', exampleEn: 'Why not try again?', exampleKo: '다시 해보는 게 어때?' },
  { categoryCode: 'scheduling', templateText: 'I will be there by ~.', meaningKo: '~까지 거기 갈게.', usageNote: '도착 예정 시점', exampleEn: 'I will be there by 7.', exampleKo: '7시까지 갈게.' },
  { categoryCode: 'scheduling', templateText: 'I need a little more time.', meaningKo: '시간이 조금 더 필요해.', usageNote: '지연 알림', exampleEn: 'I need a little more time to finish.', exampleKo: '끝내려면 시간이 조금 더 필요해.' },
  { categoryCode: 'compare_preference', templateText: 'I am okay with either one.', meaningKo: '둘 중 아무거나 괜찮아.', usageNote: '선택 무관', exampleEn: 'I am okay with either one.', exampleKo: '둘 중 아무거나 괜찮아.' },
  { categoryCode: 'problem_explain', templateText: 'I cannot find ~.', meaningKo: '~를 못 찾겠어.', usageNote: '분실/탐색 문제', exampleEn: 'I cannot find my keys.', exampleKo: '열쇠를 못 찾겠어.' },
  { categoryCode: 'problem_explain', templateText: 'I forgot to ~.', meaningKo: '~하는 걸 깜빡했어.', usageNote: '누락/실수 설명', exampleEn: 'I forgot to send it.', exampleKo: '그걸 보내는 걸 깜빡했어.' },
  { categoryCode: 'intention_plan', templateText: 'I will try to ~.', meaningKo: '~해볼게.', usageNote: '부담 적은 계획', exampleEn: 'I will try to finish it today.', exampleKo: '오늘 끝내보려고 할게.' },
  { categoryCode: 'intention_plan', templateText: 'I should ~.', meaningKo: '~해야 할 것 같아.', usageNote: '필요/의무 인식', exampleEn: 'I should go now.', exampleKo: '이제 가야 할 것 같아.' },
  { categoryCode: 'opinion', templateText: 'The way I see it, ~.', meaningKo: '내가 보기엔 ~.', usageNote: '조금 더 정리된 의견 제시', exampleEn: 'The way I see it, we need more time.', exampleKo: '내가 보기엔 시간이 더 필요해.' },
  { categoryCode: 'opinion', templateText: 'I would say ~.', meaningKo: '내 생각엔 ~라고 하겠어.', usageNote: '조심스러운 의견', exampleEn: 'I would say this is the safest option.', exampleKo: '내 생각엔 이게 가장 안전한 선택이야.' },
  { categoryCode: 'opinion', templateText: 'It depends on ~.', meaningKo: '~에 따라 달라.', usageNote: '조건부 의견', exampleEn: 'It depends on the budget.', exampleKo: '예산에 따라 달라.' },
  { categoryCode: 'reason', templateText: 'That is the reason why ~.', meaningKo: '그래서 ~인 거야.', usageNote: '이유-결과 연결', exampleEn: 'That is the reason why I changed it.', exampleKo: '그래서 내가 그걸 바꾼 거야.' },
  { categoryCode: 'reason', templateText: 'Partly because ~.', meaningKo: '부분적으로는 ~ 때문이야.', usageNote: '이유 일부 설명', exampleEn: 'Partly because we were busy.', exampleKo: '부분적으로는 우리가 바빴기 때문이야.' },
  { categoryCode: 'suggestion', templateText: 'Maybe it would be better to ~.', meaningKo: '~하는 게 더 나을 수도 있어.', usageNote: '완곡한 제안', exampleEn: 'Maybe it would be better to wait.', exampleKo: '기다리는 게 더 나을 수도 있어.' },
  { categoryCode: 'suggestion', templateText: 'One option is to ~.', meaningKo: '한 가지 방법은 ~하는 거야.', usageNote: '선택지 제시', exampleEn: 'One option is to move it to tomorrow.', exampleKo: '한 가지 방법은 내일로 미루는 거야.' },
  { categoryCode: 'suggestion', templateText: 'We should probably ~.', meaningKo: '아마 ~하는 게 좋겠어.', usageNote: '현실적 제안', exampleEn: 'We should probably leave now.', exampleKo: '이제 가는 게 좋겠어.' },
  { categoryCode: 'scheduling', templateText: 'Can we lock in ~?', meaningKo: '~로 확정할 수 있을까?', usageNote: '일정 확정', exampleEn: 'Can we lock in Friday afternoon?', exampleKo: '금요일 오후로 확정할 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'I might be a little late.', meaningKo: '조금 늦을 수도 있어.', usageNote: '예상 지각 알림', exampleEn: 'I might be a little late today.', exampleKo: '오늘 조금 늦을 수도 있어.' },
  { categoryCode: 'scheduling', templateText: 'Can we keep it short?', meaningKo: '짧게 할 수 있을까?', usageNote: '시간 제약 전달', exampleEn: 'Can we keep it short? I have another meeting.', exampleKo: '짧게 할 수 있을까? 다음 일정이 있어.' },
  { categoryCode: 'compare_preference', templateText: 'I would rather ~ than ~.', meaningKo: '~보다 ~하는 편이 낫겠어.', usageNote: '행동 비교 선호', exampleEn: 'I would rather wait than rush.', exampleKo: '서두르느니 기다리는 편이 낫겠어.' },
  { categoryCode: 'compare_preference', templateText: '~ feels more ~.', meaningKo: '~가 더 ...하게 느껴져.', usageNote: '느낌 비교', exampleEn: 'This feels more natural.', exampleKo: '이게 더 자연스럽게 느껴져.' },
  { categoryCode: 'compare_preference', templateText: 'Compared to ~, ~.', meaningKo: '~와 비교하면, ~.', usageNote: '직접 비교 시작', exampleEn: 'Compared to the old one, this is better.', exampleKo: '예전 것과 비교하면 이게 더 좋아.' },
  { categoryCode: 'problem_explain', templateText: 'I ran into a problem.', meaningKo: '문제가 생겼어.', usageNote: '문제 발생 보고', exampleEn: 'I ran into a problem during the upload.', exampleKo: '업로드 중에 문제가 생겼어.' },
  { categoryCode: 'problem_explain', templateText: 'It is taking too long.', meaningKo: '너무 오래 걸려.', usageNote: '지연 설명', exampleEn: 'It is taking too long to load.', exampleKo: '로딩이 너무 오래 걸려.' },
  { categoryCode: 'problem_explain', templateText: 'The problem is getting worse.', meaningKo: '문제가 더 심해지고 있어.', usageNote: '상황 악화 설명', exampleEn: 'The problem is getting worse over time.', exampleKo: '시간이 갈수록 문제가 더 심해지고 있어.' },
  { categoryCode: 'intention_plan', templateText: 'I am planning on ~ing.', meaningKo: '~할 계획이야.', usageNote: '조금 더 구체적인 계획', exampleEn: 'I am planning on calling them later.', exampleKo: '나중에 그들에게 전화할 계획이야.' },
  { categoryCode: 'intention_plan', templateText: 'My goal is to ~.', meaningKo: '내 목표는 ~하는 거야.', usageNote: '목표 표현', exampleEn: 'My goal is to finish this today.', exampleKo: '내 목표는 오늘 이걸 끝내는 거야.' },
  { categoryCode: 'intention_plan', templateText: 'I will see if I can ~.', meaningKo: '~할 수 있는지 볼게.', usageNote: '유보적 계획', exampleEn: 'I will see if I can move it.', exampleKo: '옮길 수 있는지 볼게.' },
  { categoryCode: 'soft_disagreement', templateText: 'I am not sure that is the best idea.', meaningKo: '그게 최선인지는 잘 모르겠어.', usageNote: '완곡한 반대', exampleEn: 'I am not sure that is the best idea right now.', exampleKo: '지금 그게 최선인지는 잘 모르겠어.' },
  { categoryCode: 'soft_disagreement', templateText: 'I would prefer ~ instead.', meaningKo: '대신 ~하는 편이 좋겠어.', usageNote: '대안 선호 제시', exampleEn: 'I would prefer to wait instead.', exampleKo: '대신 기다리는 편이 좋겠어.' },
  { categoryCode: 'soft_disagreement', templateText: 'That is one way to look at it, but ~.', meaningKo: '그렇게 볼 수도 있지만, ~.', usageNote: '관점 인정 후 반론', exampleEn: 'That is one way to look at it, but I think we need more data.', exampleKo: '그렇게 볼 수도 있지만 내 생각엔 데이터가 더 필요해.' },
  { categoryCode: 'problem_explain', templateText: 'I am still working on it.', meaningKo: '아직 처리 중이야.', usageNote: '진행 중 상태 공유', exampleEn: 'I am still working on it now.', exampleKo: '지금 아직 처리 중이야.' },
  { categoryCode: 'scheduling', templateText: 'I will try to be there on time.', meaningKo: '제시간에 가보려고 할게.', usageNote: '시간 약속 노력 표현', exampleEn: 'I will try to be there on time tomorrow.', exampleKo: '내일 제시간에 가보려고 할게.' },
  { categoryCode: 'opinion', templateText: 'I am leaning toward ~.', meaningKo: '~ 쪽으로 마음이 기울고 있어.', usageNote: '선택 직전 의견', exampleEn: 'I am leaning toward the second option.', exampleKo: '두 번째 선택지 쪽으로 마음이 기울고 있어.' },
  { categoryCode: 'scheduling', templateText: 'Let us set a time for ~.', meaningKo: '~ 시간을 정하자.', usageNote: '일정 확정 제안', exampleEn: 'Let us set a time for the call.', exampleKo: '통화 시간을 정하자.' },
  { categoryCode: 'opinion', templateText: 'From my point of view, ~.', meaningKo: '내 관점에서는 ~.', usageNote: '조금 더 정리된 의견 제시', exampleEn: 'From my point of view, this is more realistic.', exampleKo: '내 관점에서는 이게 더 현실적이야.' },
  { categoryCode: 'opinion', templateText: 'I am in favor of ~.', meaningKo: '나는 ~에 찬성이야.', usageNote: '명확한 찬성 표현', exampleEn: 'I am in favor of the simpler option.', exampleKo: '나는 더 단순한 선택지에 찬성이야.' },
  { categoryCode: 'opinion', templateText: 'That seems a bit risky to me.', meaningKo: '내게는 그게 좀 위험해 보여.', usageNote: '위험도 기준 의견', exampleEn: 'That seems a bit risky to me right now.', exampleKo: '지금 내게는 그게 좀 위험해 보여.' },
  { categoryCode: 'reason', templateText: 'The main reason is that ~.', meaningKo: '가장 큰 이유는 ~라는 거야.', usageNote: '핵심 이유 강조', exampleEn: 'The main reason is that we are short on time.', exampleKo: '가장 큰 이유는 시간이 부족하다는 거야.' },
  { categoryCode: 'reason', templateText: 'One of the reasons is ~.', meaningKo: '이유 중 하나는 ~야.', usageNote: '복수 이유 중 일부 설명', exampleEn: 'One of the reasons is the cost.', exampleKo: '이유 중 하나는 비용이야.' },
  { categoryCode: 'scheduling', templateText: 'Can we move it up?', meaningKo: '그거 앞당길 수 있을까?', usageNote: '일정 앞당기기', exampleEn: 'Can we move it up by an hour?', exampleKo: '그거 한 시간 앞당길 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'Can we push it back?', meaningKo: '그거 미룰 수 있을까?', usageNote: '일정 연기 요청', exampleEn: 'Can we push it back to Friday?', exampleKo: '그거 금요일로 미룰 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'What time works best for you?', meaningKo: '너는 몇 시가 가장 괜찮아?', usageNote: '상대 일정 확인', exampleEn: 'What time works best for you tomorrow?', exampleKo: '내일은 몇 시가 가장 괜찮아?' },
  { categoryCode: 'problem_explain', templateText: 'We ran into a problem.', meaningKo: '문제가 생겼어.', usageNote: '예상치 못한 문제 발생', exampleEn: 'We ran into a problem during the test.', exampleKo: '테스트 중에 문제가 생겼어.' },
  { categoryCode: 'problem_explain', templateText: 'We have not found the cause yet.', meaningKo: '아직 원인을 못 찾았어.', usageNote: '원인 미확인 상태', exampleEn: 'We have not found the cause yet.', exampleKo: '아직 원인을 못 찾았어.' },
  { categoryCode: 'problem_explain', templateText: 'For now, this is the best workaround.', meaningKo: '일단 이게 가장 나은 임시 방법이야.', usageNote: '임시 우회책 설명', exampleEn: 'For now, this is the best workaround we have.', exampleKo: '일단은 이게 우리가 가진 가장 나은 임시 방법이야.' },
  { categoryCode: 'soft_disagreement', templateText: 'I am not against it, but ~.', meaningKo: '반대하는 건 아니지만, ~.', usageNote: '수용 여지를 남기는 반대', exampleEn: 'I am not against it, but we should be careful.', exampleKo: '반대하는 건 아니지만 더 조심해야 해.' },
];

const vocabularyCategories: VocabularyCategorySeed[] = [
  { code: 'daily_life', nameKo: '일상생활', nameEn: 'Daily Life', sortOrder: 1 },
  { code: 'emotion', nameKo: '감정/상태', nameEn: 'Emotion & State', sortOrder: 2 },
  { code: 'request', nameKo: '요청/행동', nameEn: 'Request & Action', sortOrder: 3 },
  { code: 'schedule', nameKo: '시간/일정', nameEn: 'Time & Schedule', sortOrder: 4 },
  { code: 'problem_solving', nameKo: '문제 해결', nameEn: 'Problem Solving', sortOrder: 5 },
  { code: 'relationship', nameKo: '관계', nameEn: 'Relationship', sortOrder: 6 },
  { code: 'opinion', nameKo: '의견/판단', nameEn: 'Opinion & Judgment', sortOrder: 7 },
  { code: 'time_place_money', nameKo: '시간/장소/돈', nameEn: 'Time, Place & Money', sortOrder: 8 },
];

const vocabularyItems: VocabularyItemSeed[] = [
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'day', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '하루, 날', exampleEn: 'Have a good day.', exampleKo: '좋은 하루 보내.', frequencyRank: 1 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'time', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '시간', exampleEn: 'I do not have time.', exampleKo: '시간이 없어.', frequencyRank: 2 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'home', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '집', exampleEn: 'I am at home.', exampleKo: '집에 있어.', frequencyRank: 3 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'work', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '일, 직장', exampleEn: 'I have work today.', exampleKo: '오늘 일 있어.', frequencyRank: 4 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'thing', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '것, 물건', exampleEn: 'What is this thing?', exampleKo: '이게 뭐야?', frequencyRank: 5 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'go', partOfSpeech: PartOfSpeech.VERB, meaningKo: '가다', exampleEn: 'I want to go home.', exampleKo: '집에 가고 싶어.', frequencyRank: 6 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'come', partOfSpeech: PartOfSpeech.VERB, meaningKo: '오다', exampleEn: 'Please come here.', exampleKo: '여기로 와줘.', frequencyRank: 7 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'have to', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '해야 하다', exampleEn: 'I have to go now.', exampleKo: '이제 가야 해.', frequencyRank: 8 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'leave', partOfSpeech: PartOfSpeech.VERB, meaningKo: '떠나다, 나가다', exampleEn: 'I need to leave now.', exampleKo: '이제 나가야 해.', frequencyRank: 9 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'stay', partOfSpeech: PartOfSpeech.VERB, meaningKo: '머무르다', exampleEn: 'I will stay home today.', exampleKo: '오늘은 집에 있을게.', frequencyRank: 10 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'bring', partOfSpeech: PartOfSpeech.VERB, meaningKo: '가져오다', exampleEn: 'Can you bring water?', exampleKo: '물 좀 가져와 줄래?', frequencyRank: 11 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'use', partOfSpeech: PartOfSpeech.VERB, meaningKo: '사용하다', exampleEn: 'Can I use this?', exampleKo: '이거 써도 돼?', frequencyRank: 12 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'finish', partOfSpeech: PartOfSpeech.VERB, meaningKo: '끝내다', exampleEn: 'I need to finish this.', exampleKo: '이걸 끝내야 해.', frequencyRank: 13 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'start', partOfSpeech: PartOfSpeech.VERB, meaningKo: '시작하다', exampleEn: 'Let us start now.', exampleKo: '이제 시작하자.', frequencyRank: 14 },

  { categoryCode: 'emotion', level: Level.A1, lemma: 'happy', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '행복한, 기쁜', exampleEn: 'I am happy today.', exampleKo: '오늘 기분이 좋아.', frequencyRank: 20 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'sad', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '슬픈', exampleEn: 'I feel sad.', exampleKo: '슬퍼.', frequencyRank: 21 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'tired', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '피곤한', exampleEn: 'I am tired now.', exampleKo: '지금 피곤해.', frequencyRank: 22 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'worried', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '걱정되는', exampleEn: 'I am worried about it.', exampleKo: '그게 걱정돼.', frequencyRank: 23 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'excited', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '기대되는', exampleEn: 'I am excited about the trip.', exampleKo: '여행이 기대돼.', frequencyRank: 24 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'busy', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '바쁜', exampleEn: 'I am busy right now.', exampleKo: '지금 바빠.', frequencyRank: 25 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'calm', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '차분한', exampleEn: 'Try to stay calm.', exampleKo: '침착하려고 해.', frequencyRank: 26 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'upset', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '속상한, 화난', exampleEn: 'I am upset about that.', exampleKo: '그 일 때문에 속상해.', frequencyRank: 27 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'nervous', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '긴장한', exampleEn: 'I am nervous about the test.', exampleKo: '시험 때문에 긴장돼.', frequencyRank: 28 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'comfortable', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '편안한', exampleEn: 'I feel comfortable here.', exampleKo: '여기 있으면 편해.', frequencyRank: 29 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'better', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '더 나은, 괜찮아진', exampleEn: 'I feel better now.', exampleKo: '지금은 좀 나아졌어.', frequencyRank: 30 },

  { categoryCode: 'request', level: Level.A1, lemma: 'help', partOfSpeech: PartOfSpeech.VERB, meaningKo: '도와주다', exampleEn: 'Can you help me?', exampleKo: '나 좀 도와줄래?', frequencyRank: 30 },
  { categoryCode: 'request', level: Level.A1, lemma: 'ask', partOfSpeech: PartOfSpeech.VERB, meaningKo: '묻다, 요청하다', exampleEn: 'Ask me later.', exampleKo: '나중에 물어봐.', frequencyRank: 31 },
  { categoryCode: 'request', level: Level.A1, lemma: 'show', partOfSpeech: PartOfSpeech.VERB, meaningKo: '보여주다', exampleEn: 'Show me the way.', exampleKo: '길 좀 보여줘.', frequencyRank: 32 },
  { categoryCode: 'request', level: Level.A1, lemma: 'want', partOfSpeech: PartOfSpeech.VERB, meaningKo: '원하다', exampleEn: 'I want water.', exampleKo: '물 원해.', frequencyRank: 33 },
  { categoryCode: 'request', level: Level.A1, lemma: 'please', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '부디, 제발', exampleEn: 'Please wait here.', exampleKo: '여기서 기다려 주세요.', frequencyRank: 34 },
  { categoryCode: 'request', level: Level.A1, lemma: 'need', partOfSpeech: PartOfSpeech.VERB, meaningKo: '필요하다', exampleEn: 'I need this now.', exampleKo: '지금 이게 필요해.', frequencyRank: 35 },
  { categoryCode: 'request', level: Level.A1, lemma: 'borrow', partOfSpeech: PartOfSpeech.VERB, meaningKo: '빌리다', exampleEn: 'Can I borrow this?', exampleKo: '이거 빌려도 돼?', frequencyRank: 36 },
  { categoryCode: 'request', level: Level.A1, lemma: 'send', partOfSpeech: PartOfSpeech.VERB, meaningKo: '보내다', exampleEn: 'Please send it to me.', exampleKo: '그거 나한테 보내줘.', frequencyRank: 37 },
  { categoryCode: 'request', level: Level.A1, lemma: 'wait', partOfSpeech: PartOfSpeech.VERB, meaningKo: '기다리다', exampleEn: 'Please wait a minute.', exampleKo: '잠깐만 기다려 줘.', frequencyRank: 38 },
  { categoryCode: 'request', level: Level.A1, lemma: 'check', partOfSpeech: PartOfSpeech.VERB, meaningKo: '확인하다', exampleEn: 'Can you check this?', exampleKo: '이거 확인해 줄래?', frequencyRank: 39 },
  { categoryCode: 'request', level: Level.A1, lemma: 'share', partOfSpeech: PartOfSpeech.VERB, meaningKo: '공유하다', exampleEn: 'Can you share the file?', exampleKo: '파일 공유해 줄래?', frequencyRank: 40 },

  { categoryCode: 'schedule', level: Level.A1, lemma: 'today', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '오늘', exampleEn: 'I am free today.', exampleKo: '오늘 시간 돼.', frequencyRank: 40 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'tomorrow', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '내일', exampleEn: 'See you tomorrow.', exampleKo: '내일 봐.', frequencyRank: 41 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'later', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '나중에', exampleEn: 'Talk to you later.', exampleKo: '나중에 얘기하자.', frequencyRank: 42 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'before', partOfSpeech: PartOfSpeech.PREPOSITION, meaningKo: '전에', exampleEn: 'Before dinner, please call me.', exampleKo: '저녁 전에 전화해 줘.', frequencyRank: 43 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'after', partOfSpeech: PartOfSpeech.PREPOSITION, meaningKo: '후에', exampleEn: 'After work, I am free.', exampleKo: '일 끝나고 시간 돼.', frequencyRank: 44 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'soon', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '곧', exampleEn: 'I will leave soon.', exampleKo: '곧 갈게.', frequencyRank: 45 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'early', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '일찍', exampleEn: 'I got up early.', exampleKo: '오늘 일찍 일어났어.', frequencyRank: 46 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'late', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '늦게, 늦은', exampleEn: 'I will be late.', exampleKo: '나 늦을 것 같아.', frequencyRank: 47 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'weekend', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '주말', exampleEn: 'Are you free this weekend?', exampleKo: '이번 주말에 시간 돼?', frequencyRank: 48 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'morning', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '아침', exampleEn: 'Morning works better for me.', exampleKo: '나는 아침이 더 좋아.', frequencyRank: 49 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'night', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '밤', exampleEn: 'I will call you at night.', exampleKo: '밤에 전화할게.', frequencyRank: 50 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'schedule', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '일정', exampleEn: 'My schedule is full today.', exampleKo: '오늘 일정이 꽉 찼어.', frequencyRank: 51 },

  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'problem', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '문제', exampleEn: 'There is a problem.', exampleKo: '문제가 있어.', frequencyRank: 60 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'issue', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '이슈, 문제', exampleEn: 'We have an issue.', exampleKo: '이슈가 있어.', frequencyRank: 61 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'fix', partOfSpeech: PartOfSpeech.VERB, meaningKo: '고치다', exampleEn: 'Can you fix it?', exampleKo: '고쳐줄 수 있어?', frequencyRank: 62 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'wrong', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '틀린, 잘못된', exampleEn: 'Something is wrong.', exampleKo: '뭔가 잘못됐어.', frequencyRank: 63 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'change', partOfSpeech: PartOfSpeech.VERB, meaningKo: '바꾸다', exampleEn: 'We need to change the plan.', exampleKo: '계획을 바꿔야 해.', frequencyRank: 64 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'available', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '이용 가능한, 가능한', exampleEn: 'I am available after 3.', exampleKo: '3시 이후에 가능해.', frequencyRank: 65 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'delay', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '지연', exampleEn: 'There was a delay.', exampleKo: '지연이 있었어.', frequencyRank: 66 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'error', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '오류', exampleEn: 'I got an error message.', exampleKo: '오류 메시지가 떴어.', frequencyRank: 67 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'solve', partOfSpeech: PartOfSpeech.VERB, meaningKo: '해결하다', exampleEn: 'We need to solve this quickly.', exampleKo: '이걸 빨리 해결해야 해.', frequencyRank: 68 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'broken', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '고장난', exampleEn: 'The screen looks broken.', exampleKo: '화면이 고장난 것 같아.', frequencyRank: 69 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'retry', partOfSpeech: PartOfSpeech.VERB, meaningKo: '다시 시도하다', exampleEn: 'Let me retry it.', exampleKo: '다시 시도해 볼게.', frequencyRank: 70 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'missing', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '빠진, 누락된', exampleEn: 'One file is missing.', exampleKo: '파일 하나가 빠졌어.', frequencyRank: 71 },

  { categoryCode: 'relationship', level: Level.A1, lemma: 'friend', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '친구', exampleEn: 'This is my friend.', exampleKo: '이 사람은 내 친구야.', frequencyRank: 70 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'family', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '가족', exampleEn: 'My family is here.', exampleKo: '우리 가족이 여기 있어.', frequencyRank: 71 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'parent', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '부모', exampleEn: 'My parent is busy.', exampleKo: '부모님이 바빠.', frequencyRank: 72 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'child', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '아이', exampleEn: 'The child is sleeping.', exampleKo: '아이가 자고 있어.', frequencyRank: 73 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'partner', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '동반자, 파트너', exampleEn: 'My partner will join us.', exampleKo: '내 파트너도 올 거야.', frequencyRank: 74 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'trust', partOfSpeech: PartOfSpeech.VERB, meaningKo: '신뢰하다', exampleEn: 'I trust you.', exampleKo: '널 믿어.', frequencyRank: 75 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'team', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '팀', exampleEn: 'Our team is small.', exampleKo: '우리 팀은 작아.', frequencyRank: 76 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'neighbor', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '이웃', exampleEn: 'My neighbor is kind.', exampleKo: '우리 이웃은 친절해.', frequencyRank: 77 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'support', partOfSpeech: PartOfSpeech.VERB, meaningKo: '지지하다, 도와주다', exampleEn: 'They support me a lot.', exampleKo: '그들은 나를 많이 도와줘.', frequencyRank: 78 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'relationship', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '관계', exampleEn: 'We have a good relationship.', exampleKo: '우리는 관계가 좋아.', frequencyRank: 79 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'coworker', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '동료', exampleEn: 'I talked to my coworker.', exampleKo: '동료와 얘기했어.', frequencyRank: 80 },

  { categoryCode: 'opinion', level: Level.A2, lemma: 'think', partOfSpeech: PartOfSpeech.VERB, meaningKo: '생각하다', exampleEn: 'I think so.', exampleKo: '난 그렇게 생각해.', frequencyRank: 80 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'agree', partOfSpeech: PartOfSpeech.VERB, meaningKo: '동의하다', exampleEn: 'I agree with you.', exampleKo: '네 말에 동의해.', frequencyRank: 81 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'prefer', partOfSpeech: PartOfSpeech.VERB, meaningKo: '더 좋아하다', exampleEn: 'I prefer tea.', exampleKo: '나는 차를 더 좋아해.', frequencyRank: 82 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'reason', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '이유', exampleEn: 'What is the reason?', exampleKo: '이유가 뭐야?', frequencyRank: 83 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'opinion', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '의견', exampleEn: 'What is your opinion?', exampleKo: '네 의견은 뭐야?', frequencyRank: 84 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'better', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '더 좋은', exampleEn: 'This option is better.', exampleKo: '이 선택이 더 좋아.', frequencyRank: 85 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'guess', partOfSpeech: PartOfSpeech.VERB, meaningKo: '추측하다', exampleEn: 'I guess that is true.', exampleKo: '아마 그 말이 맞는 것 같아.', frequencyRank: 86 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'point', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '요점, 포인트', exampleEn: 'I get your point.', exampleKo: '네 요점은 알겠어.', frequencyRank: 87 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'decide', partOfSpeech: PartOfSpeech.VERB, meaningKo: '결정하다', exampleEn: 'We need to decide soon.', exampleKo: '곧 결정해야 해.', frequencyRank: 88 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'choice', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '선택', exampleEn: 'That is a good choice.', exampleKo: '그건 좋은 선택이야.', frequencyRank: 89 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'suggest', partOfSpeech: PartOfSpeech.VERB, meaningKo: '제안하다', exampleEn: 'I suggest we wait.', exampleKo: '기다리는 게 좋겠어.', frequencyRank: 90 },

  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'place', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '장소', exampleEn: 'This is the place.', exampleKo: '여기가 그 장소야.', frequencyRank: 90 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'price', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '가격', exampleEn: 'What is the price?', exampleKo: '가격이 얼마야?', frequencyRank: 91 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'free', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '무료의, 한가한', exampleEn: 'I am free now.', exampleKo: '지금 한가해.', frequencyRank: 92 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'way', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '방법, 길', exampleEn: 'This is the way.', exampleKo: '이게 방법이야.', frequencyRank: 93 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'money', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '돈', exampleEn: 'I do not have money.', exampleKo: '돈이 없어.', frequencyRank: 94 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'available', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가능한, 이용 가능한', exampleEn: 'I am available now.', exampleKo: '지금 가능해.', frequencyRank: 95 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'street', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '거리, 길', exampleEn: 'It is on this street.', exampleKo: '이 길에 있어.', frequencyRank: 96 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'corner', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '모퉁이', exampleEn: 'Meet me at the corner.', exampleKo: '모퉁이에서 만나자.', frequencyRank: 97 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'cost', partOfSpeech: PartOfSpeech.VERB, meaningKo: '비용이 들다', exampleEn: 'How much does it cost?', exampleKo: '이거 얼마야?', frequencyRank: 98 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'cheap', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '저렴한', exampleEn: 'This one is cheap.', exampleKo: '이건 저렴해.', frequencyRank: 99 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'expensive', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '비싼', exampleEn: 'It looks expensive.', exampleKo: '비싸 보인다.', frequencyRank: 100 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'near', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가까운', exampleEn: 'Is it near here?', exampleKo: '여기 가까워?', frequencyRank: 101 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'carry', partOfSpeech: PartOfSpeech.VERB, meaningKo: '들고 가다, 운반하다', exampleEn: 'I cannot carry this alone.', exampleKo: '이거 혼자 못 들겠어.', frequencyRank: 102 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'keep', partOfSpeech: PartOfSpeech.VERB, meaningKo: '유지하다, 계속하다', exampleEn: 'Keep this with you.', exampleKo: '이건 네가 가지고 있어.', frequencyRank: 103 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'turn on', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '켜다', exampleEn: 'Can you turn on the light?', exampleKo: '불 좀 켜줄래?', frequencyRank: 104 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'turn off', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '끄다', exampleEn: 'Please turn off the TV.', exampleKo: 'TV 좀 꺼줘.', frequencyRank: 105 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'clean', partOfSpeech: PartOfSpeech.VERB, meaningKo: '청소하다, 깨끗이 하다', exampleEn: 'I need to clean this up.', exampleKo: '이거 좀 치워야 해.', frequencyRank: 106 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'ready', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '준비된', exampleEn: 'I am ready now.', exampleKo: '이제 준비됐어.', frequencyRank: 107 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'annoyed', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '짜증난', exampleEn: 'I am annoyed right now.', exampleKo: '지금 좀 짜증나.', frequencyRank: 108 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'relieved', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '안도한', exampleEn: 'I feel relieved now.', exampleKo: '이제 안심돼.', frequencyRank: 109 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'embarrassed', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '민망한', exampleEn: 'That was embarrassing.', exampleKo: '그거 좀 민망했다.', frequencyRank: 110 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'stressed', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '스트레스받는', exampleEn: 'I am stressed these days.', exampleKo: '요즘 스트레스가 많아.', frequencyRank: 111 },
  { categoryCode: 'request', level: Level.A1, lemma: 'repeat', partOfSpeech: PartOfSpeech.VERB, meaningKo: '반복하다, 다시 말하다', exampleEn: 'Can you repeat that?', exampleKo: '그거 다시 말해줄래?', frequencyRank: 112 },
  { categoryCode: 'request', level: Level.A1, lemma: 'explain', partOfSpeech: PartOfSpeech.VERB, meaningKo: '설명하다', exampleEn: 'Can you explain this part?', exampleKo: '이 부분 설명해 줄래?', frequencyRank: 113 },
  { categoryCode: 'request', level: Level.A1, lemma: 'join', partOfSpeech: PartOfSpeech.VERB, meaningKo: '함께하다, 참여하다', exampleEn: 'Can I join you?', exampleKo: '나도 같이 가도 돼?', frequencyRank: 114 },
  { categoryCode: 'request', level: Level.A1, lemma: 'contact', partOfSpeech: PartOfSpeech.VERB, meaningKo: '연락하다', exampleEn: 'Please contact me later.', exampleKo: '나중에 연락해 줘.', frequencyRank: 115 },
  { categoryCode: 'request', level: Level.A1, lemma: 'drop off', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '내려주다, 두고 가다', exampleEn: 'Can you drop this off for me?', exampleKo: '이거 대신 전달해 줄래?', frequencyRank: 116 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'afternoon', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '오후', exampleEn: 'The afternoon is better for me.', exampleKo: '나는 오후가 더 좋아.', frequencyRank: 117 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'minute', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '분', exampleEn: 'Give me five minutes.', exampleKo: '5분만 줘.', frequencyRank: 118 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'hour', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '시간', exampleEn: 'It takes an hour.', exampleKo: '한 시간 걸려.', frequencyRank: 119 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'appointment', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '약속, 예약', exampleEn: 'I have an appointment tomorrow.', exampleKo: '내일 약속이 있어.', frequencyRank: 120 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'crash', partOfSpeech: PartOfSpeech.VERB, meaningKo: '충돌하다, 멈추다', exampleEn: 'The app keeps crashing.', exampleKo: '앱이 계속 꺼져.', frequencyRank: 121 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'fail', partOfSpeech: PartOfSpeech.VERB, meaningKo: '실패하다', exampleEn: 'The upload failed again.', exampleKo: '업로드가 또 실패했어.', frequencyRank: 122 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'confusing', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '헷갈리는', exampleEn: 'This part is confusing.', exampleKo: '이 부분은 좀 헷갈려.', frequencyRank: 123 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'urgent', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '급한', exampleEn: 'This is urgent.', exampleKo: '이건 급해.', frequencyRank: 124 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'guest', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '손님', exampleEn: 'We have a guest today.', exampleKo: '오늘 손님이 와.', frequencyRank: 125 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'manager', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '매니저, 관리자', exampleEn: 'I talked to the manager.', exampleKo: '매니저랑 얘기했어.', frequencyRank: 126 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'respect', partOfSpeech: PartOfSpeech.VERB, meaningKo: '존중하다', exampleEn: 'I respect your decision.', exampleKo: '네 결정을 존중해.', frequencyRank: 127 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'seem', partOfSpeech: PartOfSpeech.VERB, meaningKo: '~처럼 보이다', exampleEn: 'That seems reasonable.', exampleKo: '그건 괜찮아 보여.', frequencyRank: 128 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'difference', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '차이', exampleEn: 'What is the difference?', exampleKo: '차이가 뭐야?', frequencyRank: 129 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'option', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '선택지', exampleEn: 'We have two options.', exampleKo: '선택지가 두 개 있어.', frequencyRank: 130 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'recommend', partOfSpeech: PartOfSpeech.VERB, meaningKo: '추천하다', exampleEn: 'What do you recommend?', exampleKo: '뭘 추천해?', frequencyRank: 131 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'far', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '먼', exampleEn: 'It is not that far.', exampleKo: '그렇게 멀진 않아.', frequencyRank: 132 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'station', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '역, 정거장', exampleEn: 'The station is nearby.', exampleKo: '역이 가까워.', frequencyRank: 133 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'map', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '지도', exampleEn: 'Can you show me the map?', exampleKo: '지도 좀 보여줄래?', frequencyRank: 134 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'cash', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '현금', exampleEn: 'Do you have cash?', exampleKo: '현금 있어?', frequencyRank: 135 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'open', partOfSpeech: PartOfSpeech.VERB, meaningKo: '열다', exampleEn: 'Can you open the door?', exampleKo: '문 좀 열어줄래?', frequencyRank: 136 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'close', partOfSpeech: PartOfSpeech.VERB, meaningKo: '닫다', exampleEn: 'Please close the window.', exampleKo: '창문 좀 닫아줘.', frequencyRank: 137 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'wear', partOfSpeech: PartOfSpeech.VERB, meaningKo: '입다, 착용하다', exampleEn: 'Wear something warm.', exampleKo: '따뜻하게 입어.', frequencyRank: 138 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'take off', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '벗다, 제거하다', exampleEn: 'Take off your shoes.', exampleKo: '신발 벗어.', frequencyRank: 139 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'wash', partOfSpeech: PartOfSpeech.VERB, meaningKo: '씻다', exampleEn: 'I need to wash this.', exampleKo: '이거 씻어야 해.', frequencyRank: 140 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'dry', partOfSpeech: PartOfSpeech.VERB, meaningKo: '말리다', exampleEn: 'Let it dry first.', exampleKo: '먼저 말려야 해.', frequencyRank: 141 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'fine', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '괜찮은', exampleEn: 'I am fine now.', exampleKo: '지금은 괜찮아.', frequencyRank: 142 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'sorry', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '미안한', exampleEn: 'I am sorry about that.', exampleKo: '그건 미안해.', frequencyRank: 143 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'glad', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '기쁜', exampleEn: 'I am glad you are here.', exampleKo: '네가 와서 기뻐.', frequencyRank: 144 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'afraid', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '두려운', exampleEn: 'I am afraid of that.', exampleKo: '그게 좀 무서워.', frequencyRank: 145 },
  { categoryCode: 'request', level: Level.A1, lemma: 'call', partOfSpeech: PartOfSpeech.VERB, meaningKo: '전화하다', exampleEn: 'Call me when you arrive.', exampleKo: '도착하면 전화해.', frequencyRank: 146 },
  { categoryCode: 'request', level: Level.A1, lemma: 'text', partOfSpeech: PartOfSpeech.VERB, meaningKo: '문자하다', exampleEn: 'Text me later.', exampleKo: '나중에 문자해.', frequencyRank: 147 },
  { categoryCode: 'request', level: Level.A1, lemma: 'wait for', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~를 기다리다', exampleEn: 'Wait for me outside.', exampleKo: '밖에서 나 좀 기다려.', frequencyRank: 148 },
  { categoryCode: 'request', level: Level.A1, lemma: 'look for', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~를 찾다', exampleEn: 'I am looking for my bag.', exampleKo: '가방 찾고 있어.', frequencyRank: 149 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'tonight', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '오늘 밤', exampleEn: 'Can we talk tonight?', exampleKo: '오늘 밤에 얘기할 수 있어?', frequencyRank: 150 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'next week', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '다음 주', exampleEn: 'Maybe next week works better.', exampleKo: '다음 주가 더 좋을 수도 있어.', frequencyRank: 151 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'right away', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '바로, 즉시', exampleEn: 'I will do it right away.', exampleKo: '바로 할게.', frequencyRank: 152 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'for now', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '일단은', exampleEn: 'Let us leave it for now.', exampleKo: '일단 이건 놔두자.', frequencyRank: 153 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'reset', partOfSpeech: PartOfSpeech.VERB, meaningKo: '초기화하다, 재설정하다', exampleEn: 'Try to reset it.', exampleKo: '한번 재설정해 봐.', frequencyRank: 154 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'update', partOfSpeech: PartOfSpeech.VERB, meaningKo: '업데이트하다', exampleEn: 'Did you update the app?', exampleKo: '앱 업데이트했어?', frequencyRank: 155 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'stuck', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '막힌, 움직이지 않는', exampleEn: 'I am stuck on this step.', exampleKo: '이 단계에서 막혔어.', frequencyRank: 156 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'warning', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '경고', exampleEn: 'I saw a warning message.', exampleKo: '경고 메시지를 봤어.', frequencyRank: 157 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'group', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '그룹, 무리', exampleEn: 'Our group is meeting tonight.', exampleKo: '우리 모임이 오늘 밤 있어.', frequencyRank: 158 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'guest room', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '손님방', exampleEn: 'The guest room is ready.', exampleKo: '손님방 준비됐어.', frequencyRank: 159 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'discuss', partOfSpeech: PartOfSpeech.VERB, meaningKo: '논의하다', exampleEn: 'We need to discuss this.', exampleKo: '이거 논의해야 해.', frequencyRank: 160 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'fair', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '공정한', exampleEn: 'That seems fair.', exampleKo: '그건 공정해 보여.', frequencyRank: 161 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'improve', partOfSpeech: PartOfSpeech.VERB, meaningKo: '개선하다', exampleEn: 'We should improve this part.', exampleKo: '이 부분을 개선해야 해.', frequencyRank: 162 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'compare', partOfSpeech: PartOfSpeech.VERB, meaningKo: '비교하다', exampleEn: 'Let us compare the two options.', exampleKo: '두 선택지를 비교해 보자.', frequencyRank: 163 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'bus stop', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '버스 정류장', exampleEn: 'The bus stop is over there.', exampleKo: '버스 정류장은 저쪽이야.', frequencyRank: 164 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'subway', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '지하철', exampleEn: 'Let us take the subway.', exampleKo: '지하철 타자.', frequencyRank: 165 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'card', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '카드', exampleEn: 'Can I pay by card?', exampleKo: '카드로 결제돼?', frequencyRank: 166 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'receipt', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '영수증', exampleEn: 'Can I get the receipt?', exampleKo: '영수증 받을 수 있을까?', frequencyRank: 167 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'hold', partOfSpeech: PartOfSpeech.VERB, meaningKo: '들다, 잡다', exampleEn: 'Hold this for me.', exampleKo: '이거 좀 들어줘.', frequencyRank: 168 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'drop', partOfSpeech: PartOfSpeech.VERB, meaningKo: '떨어뜨리다, 내려놓다', exampleEn: 'I dropped my phone.', exampleKo: '휴대폰을 떨어뜨렸어.', frequencyRank: 169 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'save', partOfSpeech: PartOfSpeech.VERB, meaningKo: '저장하다, 아끼다', exampleEn: 'Do not forget to save it.', exampleKo: '저장하는 거 잊지 마.', frequencyRank: 170 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'load', partOfSpeech: PartOfSpeech.VERB, meaningKo: '불러오다, 로드하다', exampleEn: 'It takes time to load.', exampleKo: '불러오는 데 시간이 걸려.', frequencyRank: 171 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'pack', partOfSpeech: PartOfSpeech.VERB, meaningKo: '싸다, 챙기다', exampleEn: 'I still need to pack.', exampleKo: '아직 짐을 싸야 해.', frequencyRank: 172 },
  { categoryCode: 'daily_life', level: Level.A1, lemma: 'empty', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '비어 있는', exampleEn: 'The bag is empty.', exampleKo: '가방이 비어 있어.', frequencyRank: 173 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'confident', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '자신 있는', exampleEn: 'I feel confident now.', exampleKo: '지금은 자신 있어.', frequencyRank: 174 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'awkward', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '어색한', exampleEn: 'That felt awkward.', exampleKo: '좀 어색했다.', frequencyRank: 175 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'comfortable with', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~이 편한', exampleEn: 'I am comfortable with this plan.', exampleKo: '나는 이 계획이 편해.', frequencyRank: 176 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'relax', partOfSpeech: PartOfSpeech.VERB, meaningKo: '쉬다, 긴장을 풀다', exampleEn: 'Try to relax a little.', exampleKo: '조금 쉬어.', frequencyRank: 177 },
  { categoryCode: 'request', level: Level.A1, lemma: 'join in', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '끼어들다, 함께하다', exampleEn: 'Can I join in later?', exampleKo: '나중에 나도 껴도 돼?', frequencyRank: 178 },
  { categoryCode: 'request', level: Level.A1, lemma: 'bring back', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '가져다주다, 돌려주다', exampleEn: 'Can you bring it back tomorrow?', exampleKo: '내일 그거 다시 가져다줄래?', frequencyRank: 179 },
  { categoryCode: 'request', level: Level.A1, lemma: 'leave out', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '빼먹다, 제외하다', exampleEn: 'Please do not leave anything out.', exampleKo: '빠뜨리지 말아줘.', frequencyRank: 180 },
  { categoryCode: 'request', level: Level.A1, lemma: 'remind', partOfSpeech: PartOfSpeech.VERB, meaningKo: '상기시키다', exampleEn: 'Please remind me later.', exampleKo: '나중에 나한테 다시 말해줘.', frequencyRank: 181 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'by then', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '그때까지', exampleEn: 'I will finish it by then.', exampleKo: '그때까지 끝낼게.', frequencyRank: 182 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'on time', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '제시간에', exampleEn: 'I hope to be there on time.', exampleKo: '제시간에 가면 좋겠다.', frequencyRank: 183 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'ahead of time', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '미리', exampleEn: 'Please let me know ahead of time.', exampleKo: '미리 알려줘.', frequencyRank: 184 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'deadline', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '마감', exampleEn: 'The deadline is tomorrow.', exampleKo: '마감이 내일이야.', frequencyRank: 185 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'bug', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '버그', exampleEn: 'I think this is a bug.', exampleKo: '이건 버그인 것 같아.', frequencyRank: 186 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'cause', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '원인', exampleEn: 'We need to find the cause.', exampleKo: '원인을 찾아야 해.', frequencyRank: 187 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'solution', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '해결책', exampleEn: 'Do you have a solution?', exampleKo: '해결책 있어?', frequencyRank: 188 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'temporary', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '임시의', exampleEn: 'This is only a temporary fix.', exampleKo: '이건 임시 해결책이야.', frequencyRank: 189 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'check again', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '다시 확인하다', exampleEn: 'Let me check again.', exampleKo: '다시 확인해볼게.', frequencyRank: 190 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'meeting', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '회의, 만남', exampleEn: 'I have a meeting later.', exampleKo: '나중에 회의가 있어.', frequencyRank: 191 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'member', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '구성원', exampleEn: 'Our team has a new member.', exampleKo: '우리 팀에 새 멤버가 들어왔어.', frequencyRank: 192 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'feedback', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '피드백', exampleEn: 'Thanks for the feedback.', exampleKo: '피드백 고마워.', frequencyRank: 193 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'communicate', partOfSpeech: PartOfSpeech.VERB, meaningKo: '소통하다', exampleEn: 'We need to communicate better.', exampleKo: '우리가 더 잘 소통해야 해.', frequencyRank: 194 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'likely', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가능성이 높은', exampleEn: 'That is likely to happen.', exampleKo: '그럴 가능성이 높아.', frequencyRank: 195 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'possible', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가능한', exampleEn: 'Is that possible?', exampleKo: '그게 가능해?', frequencyRank: 196 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'worth', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가치 있는', exampleEn: 'It is worth trying.', exampleKo: '해볼 만한 가치가 있어.', frequencyRank: 197 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'choice between', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~ 사이의 선택', exampleEn: 'It is a choice between time and cost.', exampleKo: '시간과 비용 사이의 선택이야.', frequencyRank: 198 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'transfer', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '환승, 이체', exampleEn: 'You need to transfer once.', exampleKo: '한 번 환승해야 해.', frequencyRank: 199 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'platform', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '승강장, 플랫폼', exampleEn: 'Which platform is it?', exampleKo: '몇 번 승강장이야?', frequencyRank: 200 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'fee', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '수수료, 요금', exampleEn: 'There is an extra fee.', exampleKo: '추가 요금이 있어.', frequencyRank: 201 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'discount', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '할인', exampleEn: 'Is there any discount?', exampleKo: '할인 있어?', frequencyRank: 202 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'resolve', partOfSpeech: PartOfSpeech.VERB, meaningKo: '해결하다', exampleEn: 'We need to resolve this today.', exampleKo: '오늘 이 문제를 해결해야 해.', frequencyRank: 203 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'lean toward', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~쪽으로 기울다', exampleEn: 'I lean toward the safer option.', exampleKo: '나는 더 안전한 선택 쪽이야.', frequencyRank: 204 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'set a time', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '시간을 정하다', exampleEn: 'Let us set a time now.', exampleKo: '지금 시간을 정하자.', frequencyRank: 205 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'trade-off', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '상충 관계, 트레이드오프', exampleEn: 'It is a trade-off between speed and quality.', exampleKo: '속도와 품질 사이의 트레이드오프야.', frequencyRank: 206 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'be in favor of', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~에 찬성하다', exampleEn: 'I am in favor of the simpler plan.', exampleKo: '나는 더 단순한 계획에 찬성이야.', frequencyRank: 207 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'realistic', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '현실적인', exampleEn: 'That does not sound realistic to me.', exampleKo: '내게는 그게 현실적으로 들리지 않아.', frequencyRank: 208 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'run into', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '~에 부딪히다', exampleEn: 'We ran into a problem this morning.', exampleKo: '오늘 아침에 문제가 생겼어.', frequencyRank: 209 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'root cause', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '근본 원인', exampleEn: 'We still have not found the root cause.', exampleKo: '우리는 아직 근본 원인을 못 찾았어.', frequencyRank: 210 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'workaround', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '임시 우회책', exampleEn: 'For now, we need a workaround.', exampleKo: '일단은 임시 우회책이 필요해.', frequencyRank: 211 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'unexpected', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '예상치 못한', exampleEn: 'We had an unexpected error.', exampleKo: '예상치 못한 오류가 있었어.', frequencyRank: 212 },
  { categoryCode: 'schedule', level: Level.A2, lemma: 'move up', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '앞당기다', exampleEn: 'Can we move up the meeting?', exampleKo: '회의를 앞당길 수 있을까?', frequencyRank: 213 },
  { categoryCode: 'schedule', level: Level.A2, lemma: 'push back', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '미루다', exampleEn: 'We may need to push back the deadline.', exampleKo: '마감을 미뤄야 할 수도 있어.', frequencyRank: 214 },
  { categoryCode: 'schedule', level: Level.A2, lemma: 'availability', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '가능한 시간, 일정 가능 여부', exampleEn: 'Please share your availability.', exampleKo: '가능한 시간을 알려줘.', frequencyRank: 215 },
  { categoryCode: 'schedule', level: Level.A2, lemma: 'time slot', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '시간대', exampleEn: 'Which time slot works best for you?', exampleKo: '어떤 시간대가 가장 괜찮아?', frequencyRank: 216 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'follow up', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '후속 확인하다', exampleEn: 'I will follow up tomorrow.', exampleKo: '내일 다시 확인할게.', frequencyRank: 217 },
];

async function upsertPatternCategory(data: PatternCategorySeed) {
  const existing = await prisma.patternCategory.findFirst({
    where: { level: data.level, code: data.code },
  });
  if (existing) {
    return prisma.patternCategory.update({
      where: { id: existing.id },
      data: {
        nameKo: data.nameKo,
        nameEn: data.nameEn,
        description: data.description,
        targetCount: data.targetCount,
        sortOrder: data.sortOrder,
        active: true,
      },
    });
  }
  return prisma.patternCategory.create({ data });
}

async function upsertPatternTemplate(categoryId: string, data: PatternTemplateSeed) {
  const existing = await prisma.patternTemplate.findFirst({
    where: { categoryId, templateText: data.templateText },
  });
  const payload = {
    categoryId,
    templateText: data.templateText,
    meaningKo: data.meaningKo,
    usageNote: data.usageNote ?? null,
    difficulty: data.difficulty ?? null,
    exampleEn: data.exampleEn ?? null,
    exampleKo: data.exampleKo ?? null,
    active: true,
  };
  if (existing) {
    return prisma.patternTemplate.update({
      where: { id: existing.id },
      data: payload,
    });
  }
  return prisma.patternTemplate.create({ data: payload });
}

async function upsertVocabularyCategory(data: VocabularyCategorySeed) {
  const existing = await prisma.vocabularyCategory.findUnique({ where: { code: data.code } });
  if (existing) {
    return prisma.vocabularyCategory.update({
      where: { code: data.code },
      data: {
        nameKo: data.nameKo,
        nameEn: data.nameEn,
        description: data.description,
        sortOrder: data.sortOrder,
        active: true,
      },
    });
  }
  return prisma.vocabularyCategory.create({ data });
}

async function upsertVocabularyItem(categoryId: string | null, data: VocabularyItemSeed) {
  const existing = await prisma.vocabularyItem.findFirst({
    where: {
      level: data.level,
      lemma: data.lemma,
      partOfSpeech: data.partOfSpeech,
    },
  });
  const payload = {
    categoryId,
    level: data.level,
    lemma: data.lemma,
    partOfSpeech: data.partOfSpeech,
    meaningKo: data.meaningKo,
    exampleEn: data.exampleEn ?? null,
    exampleKo: data.exampleKo ?? null,
    frequencyRank: data.frequencyRank ?? null,
    isCore: data.isCore ?? true,
    active: true,
  };
  if (existing) {
    return prisma.vocabularyItem.update({
      where: { id: existing.id },
      data: payload,
    });
  }
  return prisma.vocabularyItem.create({ data: payload });
}

async function upsertVocabularyGoal(level: Prisma.CefrLevel, targetCount: number, description: string) {
  const existing = await prisma.vocabularyGoal.findUnique({ where: { level } });
  if (existing) {
    return prisma.vocabularyGoal.update({
      where: { level },
      data: { targetCount, description, active: true },
    });
  }
  return prisma.vocabularyGoal.create({
    data: { level, targetCount, description, active: true },
  });
}

async function main() {
  const categoryByCode = new Map<string, { id: string }>();
  for (const category of patternCategories) {
    const record = await upsertPatternCategory(category);
    categoryByCode.set(category.code, { id: record.id });
  }

  let patternCount = 0;
  for (const template of patternTemplates) {
    const category = categoryByCode.get(template.categoryCode);
    if (!category) {
      throw new Error(`Missing pattern category: ${template.categoryCode}`);
    }
    await upsertPatternTemplate(category.id, template);
    patternCount += 1;
  }

  const vocabularyCategoryByCode = new Map<string, { id: string }>();
  for (const category of vocabularyCategories) {
    const record = await upsertVocabularyCategory(category);
    vocabularyCategoryByCode.set(category.code, { id: record.id });
  }

  let vocabularyCount = 0;
  for (const item of vocabularyItems) {
    const categoryId = item.categoryCode ? vocabularyCategoryByCode.get(item.categoryCode)?.id ?? null : null;
    await upsertVocabularyItem(categoryId, item);
    vocabularyCount += 1;
  }

  await upsertVocabularyGoal(Level.A1, 500, 'A1 핵심 생활 단어');
  await upsertVocabularyGoal(Level.A2, 800, 'A2 확장 생활 단어');

  console.log(
    JSON.stringify(
      {
        patternCategories: patternCategories.length,
        patternTemplates: patternCount,
        vocabularyCategories: vocabularyCategories.length,
        vocabularyItems: vocabularyCount,
        vocabularyGoals: 2,
        progressStates: Object.values(Progress).length,
        matchSources: Object.values(Match).length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
