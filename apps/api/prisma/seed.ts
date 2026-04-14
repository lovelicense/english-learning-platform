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

  { categoryCode: 'opinion', templateText: 'I think ~.', meaningKo: '나는 ~라고 생각해.', usageNote: '가장 기본 의견 말하기', exampleEn: 'I think it is a good idea.', exampleKo: '좋은 생각이라고 봐.' },
  { categoryCode: 'opinion', templateText: "I don't think ~.", meaningKo: '나는 ~라고 생각하지 않아.', usageNote: '부정 의견', exampleEn: "I don't think that will work.", exampleKo: '그건 안 될 것 같아.' },
  { categoryCode: 'opinion', templateText: 'In my opinion, ~.', meaningKo: '내 의견으로는 ~.', usageNote: '명시적 의견', exampleEn: 'In my opinion, we should wait.', exampleKo: '내 생각엔 기다려야 해.' },
  { categoryCode: 'opinion', templateText: 'From my point of view, ~.', meaningKo: '내 관점에서는 ~.', usageNote: '조금 더 공식적인 의견', exampleEn: 'From my point of view, this is better.', exampleKo: '내 관점에서는 이게 더 좋아.' },
  { categoryCode: 'opinion', templateText: 'It seems to me that ~.', meaningKo: '내가 보기엔 ~인 것 같아.', usageNote: '완곡한 의견', exampleEn: 'It seems to me that he is busy.', exampleKo: '내가 보기엔 그가 바쁜 것 같아.' },
  { categoryCode: 'opinion', templateText: 'I feel like ~.', meaningKo: '왠지 ~인 것 같아.', usageNote: '감각적 판단', exampleEn: 'I feel like we should leave now.', exampleKo: '지금 나가야 할 것 같아.' },
  { categoryCode: 'opinion', templateText: 'Personally, ~.', meaningKo: '개인적으로는 ~.', usageNote: '부드러운 자기 의견', exampleEn: 'Personally, I like this one.', exampleKo: '개인적으로는 이게 좋아.' },

  { categoryCode: 'reason', templateText: 'because ~', meaningKo: '왜냐하면 ~', usageNote: '이유를 붙이는 기본형', exampleEn: 'I stayed because it was raining.', exampleKo: '비가 와서 남았어.' },
  { categoryCode: 'reason', templateText: 'The reason is that ~.', meaningKo: '이유는 ~야.', usageNote: '이유 설명', exampleEn: 'The reason is that I was tired.', exampleKo: '이유는 내가 피곤했기 때문이야.' },
  { categoryCode: 'reason', templateText: "It's because ~.", meaningKo: '그건 ~ 때문이야.', usageNote: '설명형 이유', exampleEn: "It's because I don't have time.", exampleKo: '그건 시간이 없어서야.' },
  { categoryCode: 'reason', templateText: "That's why ~.", meaningKo: '그래서 ~야.', usageNote: '결과 연결', exampleEn: "That's why I left early.", exampleKo: '그래서 일찍 떠났어.' },
  { categoryCode: 'reason', templateText: 'One reason is that ~.', meaningKo: '이유 중 하나는 ~야.', usageNote: '이유 일부 설명', exampleEn: 'One reason is that it is cheaper.', exampleKo: '이유 중 하나는 더 싸기 때문이야.' },
  { categoryCode: 'reason', templateText: "So that's why ~.", meaningKo: '그래서 ~한 거야.', usageNote: '대화식 이유 정리', exampleEn: "So that's why I called you.", exampleKo: '그래서 네게 전화한 거야.' },

  { categoryCode: 'suggestion', templateText: "Why don't we ~?", meaningKo: '우리 ~하는 거 어때?', usageNote: '가장 범용적인 제안', exampleEn: "Why don't we meet tomorrow?", exampleKo: '우리 내일 만나는 거 어때?' },
  { categoryCode: 'suggestion', templateText: 'How about ~?', meaningKo: '~하는 건 어때?', usageNote: '짧은 제안', exampleEn: 'How about dinner?', exampleKo: '저녁은 어때?' },
  { categoryCode: 'suggestion', templateText: 'Maybe we should ~.', meaningKo: '아마 ~하는 게 좋을 것 같아.', usageNote: '부드러운 제안', exampleEn: 'Maybe we should call first.', exampleKo: '먼저 전화하는 게 좋을 것 같아.' },
  { categoryCode: 'suggestion', templateText: "Let's ~.", meaningKo: '우리 ~하자.', usageNote: '직접 제안', exampleEn: "Let's go now.", exampleKo: '이제 가자.' },
  { categoryCode: 'suggestion', templateText: 'We could ~.', meaningKo: '우리는 ~할 수 있어.', usageNote: '선택지 제시', exampleEn: 'We could take a taxi.', exampleKo: '택시를 탈 수도 있어.' },
  { categoryCode: 'suggestion', templateText: 'What if we ~?', meaningKo: '만약 우리가 ~하면 어떨까?', usageNote: '대안 제시', exampleEn: 'What if we change the plan?', exampleKo: '계획을 바꾸면 어때?' },

  { categoryCode: 'scheduling', templateText: 'Are you free on ~?', meaningKo: '~에 시간 있어?', usageNote: '일정 확인', exampleEn: 'Are you free on Friday?', exampleKo: '금요일에 시간 있어?' },
  { categoryCode: 'scheduling', templateText: 'What time works for you?', meaningKo: '언제가 괜찮아?', usageNote: '시간 조율', exampleEn: 'What time works for you tomorrow?', exampleKo: '내일 몇 시가 괜찮아?' },
  { categoryCode: 'scheduling', templateText: 'Can we move it to ~?', meaningKo: '그걸 ~로 옮길 수 있을까?', usageNote: '변경 요청', exampleEn: 'Can we move it to Monday?', exampleKo: '월요일로 옮길 수 있을까?' },
  { categoryCode: 'scheduling', templateText: 'Does ~ work for you?', meaningKo: '~는 괜찮아?', usageNote: '일정 합의', exampleEn: 'Does 3 p.m. work for you?', exampleKo: '오후 3시는 괜찮아?' },
  { categoryCode: 'scheduling', templateText: "I'm available after ~.", meaningKo: '나는 ~ 이후에 가능해.', usageNote: '가능 시간 말하기', exampleEn: "I'm available after 6.", exampleKo: '6시 이후에 가능해.' },
  { categoryCode: 'scheduling', templateText: "Let's do it another day.", meaningKo: '다른 날 하자.', usageNote: '일정 재조정', exampleEn: "Let's do it another day.", exampleKo: '다른 날 하자.' },

  { categoryCode: 'compare_preference', templateText: 'I prefer ~ to ~.', meaningKo: '~보다 ~를 더 좋아해.', usageNote: '비교 선호', exampleEn: 'I prefer coffee to tea.', exampleKo: '나는 차보다 커피를 더 좋아해.' },
  { categoryCode: 'compare_preference', templateText: "I'd rather ~.", meaningKo: '차라리 ~하겠어.', usageNote: '선택 선호', exampleEn: "I'd rather stay home.", exampleKo: '차라리 집에 있겠어.' },
  { categoryCode: 'compare_preference', templateText: '~ is better than ~.', meaningKo: '~가 ~보다 더 좋아.', usageNote: '직접 비교', exampleEn: 'This is better than that.', exampleKo: '이게 저것보다 더 좋아.' },
  { categoryCode: 'compare_preference', templateText: 'I like ~ more because ~.', meaningKo: '~를 더 좋아해, 왜냐하면 ~.', usageNote: '이유가 있는 선호', exampleEn: 'I like this one more because it is lighter.', exampleKo: '이게 더 가벼워서 더 좋아.' },
  { categoryCode: 'compare_preference', templateText: 'This one is more ~.', meaningKo: '이건 더 ~해.', usageNote: '형용사 비교', exampleEn: 'This one is more convenient.', exampleKo: '이게 더 편리해.' },
  { categoryCode: 'compare_preference', templateText: "I'd choose ~.", meaningKo: '나는 ~를 고를 거야.', usageNote: '선택 표현', exampleEn: "I'd choose the blue one.", exampleKo: '파란색을 고를 거야.' },

  { categoryCode: 'problem_explain', templateText: "There's a problem with ~.", meaningKo: '~에 문제가 있어.', usageNote: '문제 상황 알림', exampleEn: "There's a problem with the app.", exampleKo: '앱에 문제가 있어.' },
  { categoryCode: 'problem_explain', templateText: "It doesn't work.", meaningKo: '안 돼 / 작동 안 해.', usageNote: '고장/불가', exampleEn: "It doesn't work anymore.", exampleKo: '이제 안 돼.' },
  { categoryCode: 'problem_explain', templateText: "I'm having trouble with ~.", meaningKo: '~ 때문에 어려움을 겪고 있어.', usageNote: '도움 요청 맥락', exampleEn: "I'm having trouble with my phone.", exampleKo: '휴대폰 때문에 좀 어려워.' },
  { categoryCode: 'problem_explain', templateText: 'Something is wrong with ~.', meaningKo: '~에 뭐가 잘못됐어.', usageNote: '문제 이상 징후', exampleEn: 'Something is wrong with the sound.', exampleKo: '소리에 문제가 있어.' },
  { categoryCode: 'problem_explain', templateText: "I can't get ~ to work.", meaningKo: '~를 작동시키지 못하겠어.', usageNote: '문제 해결 실패', exampleEn: "I can't get the printer to work.", exampleKo: '프린터가 안 돼.' },
  { categoryCode: 'problem_explain', templateText: "It keeps ~ing.", meaningKo: '계속 ~해.', usageNote: '반복 문제', exampleEn: 'It keeps crashing.', exampleKo: '계속 꺼져.' },

  { categoryCode: 'intention_plan', templateText: 'I plan to ~.', meaningKo: '~할 계획이야.', usageNote: '계획 표현', exampleEn: 'I plan to study tonight.', exampleKo: '오늘 밤 공부할 계획이야.' },
  { categoryCode: 'intention_plan', templateText: "I'm going to ~.", meaningKo: '~할 거야.', usageNote: '가까운 미래', exampleEn: "I'm going to leave soon.", exampleKo: '곧 떠날 거야.' },
  { categoryCode: 'intention_plan', templateText: "I want to ~.", meaningKo: '~하고 싶어.', usageNote: '원함/의도', exampleEn: "I want to learn more.", exampleKo: '더 배우고 싶어.' },
  { categoryCode: 'intention_plan', templateText: "I'm thinking of ~ing.", meaningKo: '~할까 생각 중이야.', usageNote: '고민 중', exampleEn: "I'm thinking of moving.", exampleKo: '이사할까 생각 중이야.' },
  { categoryCode: 'intention_plan', templateText: 'I hope to ~.', meaningKo: '~하길 바라.', usageNote: '희망', exampleEn: 'I hope to finish soon.', exampleKo: '빨리 끝내길 바라.' },

  { categoryCode: 'soft_disagreement', templateText: 'I see your point, but ~.', meaningKo: '네 말은 알겠는데, ~.', usageNote: '부드러운 반대', exampleEn: 'I see your point, but I disagree.', exampleKo: '네 말은 알겠는데, 나는 반대야.' },
  { categoryCode: 'soft_disagreement', templateText: 'I understand, but ~.', meaningKo: '이해는 하는데, ~.', usageNote: '완곡한 반대', exampleEn: 'I understand, but we need more time.', exampleKo: '이해는 하는데, 시간이 더 필요해.' },
  { categoryCode: 'soft_disagreement', templateText: 'That may be true, but ~.', meaningKo: '그럴 수도 있지만, ~.', usageNote: '논점 전환', exampleEn: 'That may be true, but it is still risky.', exampleKo: '그럴 수도 있지만 아직 위험해.' },
  { categoryCode: 'soft_disagreement', templateText: "I'm not sure about that.", meaningKo: '그건 잘 모르겠어.', usageNote: '완곡한 반대/유보', exampleEn: "I'm not sure about that idea.", exampleKo: '그 아이디어는 잘 모르겠어.' },
  { categoryCode: 'soft_disagreement', templateText: 'Maybe we should try ~ instead.', meaningKo: '대신 ~을 해보는 게 어때?', usageNote: '대안 제시', exampleEn: 'Maybe we should try another way instead.', exampleKo: '대신 다른 방법을 해보는 게 어때?' },
  { categoryCode: 'soft_disagreement', templateText: "I wouldn't say that.", meaningKo: '난 그렇게 말하진 않을 것 같아.', usageNote: '부드러운 반론', exampleEn: "I wouldn't say that is the main issue.", exampleKo: '그게 핵심 문제라고 하진 않을 것 같아.' },
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

  { categoryCode: 'emotion', level: Level.A1, lemma: 'happy', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '행복한, 기쁜', exampleEn: 'I am happy today.', exampleKo: '오늘 기분이 좋아.', frequencyRank: 20 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'sad', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '슬픈', exampleEn: 'I feel sad.', exampleKo: '슬퍼.', frequencyRank: 21 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'tired', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '피곤한', exampleEn: 'I am tired now.', exampleKo: '지금 피곤해.', frequencyRank: 22 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'worried', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '걱정되는', exampleEn: 'I am worried about it.', exampleKo: '그게 걱정돼.', frequencyRank: 23 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'excited', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '기대되는', exampleEn: 'I am excited about the trip.', exampleKo: '여행이 기대돼.', frequencyRank: 24 },
  { categoryCode: 'emotion', level: Level.A1, lemma: 'busy', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '바쁜', exampleEn: 'I am busy right now.', exampleKo: '지금 바빠.', frequencyRank: 25 },

  { categoryCode: 'request', level: Level.A1, lemma: 'help', partOfSpeech: PartOfSpeech.VERB, meaningKo: '도와주다', exampleEn: 'Can you help me?', exampleKo: '나 좀 도와줄래?', frequencyRank: 30 },
  { categoryCode: 'request', level: Level.A1, lemma: 'ask', partOfSpeech: PartOfSpeech.VERB, meaningKo: '묻다, 요청하다', exampleEn: 'Ask me later.', exampleKo: '나중에 물어봐.', frequencyRank: 31 },
  { categoryCode: 'request', level: Level.A1, lemma: 'show', partOfSpeech: PartOfSpeech.VERB, meaningKo: '보여주다', exampleEn: 'Show me the way.', exampleKo: '길 좀 보여줘.', frequencyRank: 32 },
  { categoryCode: 'request', level: Level.A1, lemma: 'want', partOfSpeech: PartOfSpeech.VERB, meaningKo: '원하다', exampleEn: 'I want water.', exampleKo: '물 원해.', frequencyRank: 33 },
  { categoryCode: 'request', level: Level.A1, lemma: 'please', partOfSpeech: PartOfSpeech.PHRASE, meaningKo: '부디, 제발', exampleEn: 'Please wait here.', exampleKo: '여기서 기다려 주세요.', frequencyRank: 34 },
  { categoryCode: 'request', level: Level.A1, lemma: 'need', partOfSpeech: PartOfSpeech.VERB, meaningKo: '필요하다', exampleEn: 'I need this now.', exampleKo: '지금 이게 필요해.', frequencyRank: 35 },

  { categoryCode: 'schedule', level: Level.A1, lemma: 'today', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '오늘', exampleEn: 'I am free today.', exampleKo: '오늘 시간 돼.', frequencyRank: 40 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'tomorrow', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '내일', exampleEn: 'See you tomorrow.', exampleKo: '내일 봐.', frequencyRank: 41 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'later', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '나중에', exampleEn: 'Talk to you later.', exampleKo: '나중에 얘기하자.', frequencyRank: 42 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'before', partOfSpeech: PartOfSpeech.PREPOSITION, meaningKo: '전에', exampleEn: 'Before dinner, please call me.', exampleKo: '저녁 전에 전화해 줘.', frequencyRank: 43 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'after', partOfSpeech: PartOfSpeech.PREPOSITION, meaningKo: '후에', exampleEn: 'After work, I am free.', exampleKo: '일 끝나고 시간 돼.', frequencyRank: 44 },
  { categoryCode: 'schedule', level: Level.A1, lemma: 'soon', partOfSpeech: PartOfSpeech.ADVERB, meaningKo: '곧', exampleEn: 'I will leave soon.', exampleKo: '곧 갈게.', frequencyRank: 45 },

  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'problem', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '문제', exampleEn: 'There is a problem.', exampleKo: '문제가 있어.', frequencyRank: 60 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'issue', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '이슈, 문제', exampleEn: 'We have an issue.', exampleKo: '이슈가 있어.', frequencyRank: 61 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'fix', partOfSpeech: PartOfSpeech.VERB, meaningKo: '고치다', exampleEn: 'Can you fix it?', exampleKo: '고쳐줄 수 있어?', frequencyRank: 62 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'wrong', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '틀린, 잘못된', exampleEn: 'Something is wrong.', exampleKo: '뭔가 잘못됐어.', frequencyRank: 63 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'change', partOfSpeech: PartOfSpeech.VERB, meaningKo: '바꾸다', exampleEn: 'We need to change the plan.', exampleKo: '계획을 바꿔야 해.', frequencyRank: 64 },
  { categoryCode: 'problem_solving', level: Level.A2, lemma: 'available', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '이용 가능한, 가능한', exampleEn: 'I am available after 3.', exampleKo: '3시 이후에 가능해.', frequencyRank: 65 },

  { categoryCode: 'relationship', level: Level.A1, lemma: 'friend', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '친구', exampleEn: 'This is my friend.', exampleKo: '이 사람은 내 친구야.', frequencyRank: 70 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'family', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '가족', exampleEn: 'My family is here.', exampleKo: '우리 가족이 여기 있어.', frequencyRank: 71 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'parent', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '부모', exampleEn: 'My parent is busy.', exampleKo: '부모님이 바빠.', frequencyRank: 72 },
  { categoryCode: 'relationship', level: Level.A1, lemma: 'child', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '아이', exampleEn: 'The child is sleeping.', exampleKo: '아이가 자고 있어.', frequencyRank: 73 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'partner', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '동반자, 파트너', exampleEn: 'My partner will join us.', exampleKo: '내 파트너도 올 거야.', frequencyRank: 74 },
  { categoryCode: 'relationship', level: Level.A2, lemma: 'trust', partOfSpeech: PartOfSpeech.VERB, meaningKo: '신뢰하다', exampleEn: 'I trust you.', exampleKo: '널 믿어.', frequencyRank: 75 },

  { categoryCode: 'opinion', level: Level.A2, lemma: 'think', partOfSpeech: PartOfSpeech.VERB, meaningKo: '생각하다', exampleEn: 'I think so.', exampleKo: '난 그렇게 생각해.', frequencyRank: 80 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'agree', partOfSpeech: PartOfSpeech.VERB, meaningKo: '동의하다', exampleEn: 'I agree with you.', exampleKo: '네 말에 동의해.', frequencyRank: 81 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'prefer', partOfSpeech: PartOfSpeech.VERB, meaningKo: '더 좋아하다', exampleEn: 'I prefer tea.', exampleKo: '나는 차를 더 좋아해.', frequencyRank: 82 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'reason', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '이유', exampleEn: 'What is the reason?', exampleKo: '이유가 뭐야?', frequencyRank: 83 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'opinion', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '의견', exampleEn: 'What is your opinion?', exampleKo: '네 의견은 뭐야?', frequencyRank: 84 },
  { categoryCode: 'opinion', level: Level.A2, lemma: 'better', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '더 좋은', exampleEn: 'This option is better.', exampleKo: '이 선택이 더 좋아.', frequencyRank: 85 },

  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'place', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '장소', exampleEn: 'This is the place.', exampleKo: '여기가 그 장소야.', frequencyRank: 90 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'price', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '가격', exampleEn: 'What is the price?', exampleKo: '가격이 얼마야?', frequencyRank: 91 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'free', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '무료의, 한가한', exampleEn: 'I am free now.', exampleKo: '지금 한가해.', frequencyRank: 92 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'way', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '방법, 길', exampleEn: 'This is the way.', exampleKo: '이게 방법이야.', frequencyRank: 93 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'money', partOfSpeech: PartOfSpeech.NOUN, meaningKo: '돈', exampleEn: 'I do not have money.', exampleKo: '돈이 없어.', frequencyRank: 94 },
  { categoryCode: 'time_place_money', level: Level.A1, lemma: 'available', partOfSpeech: PartOfSpeech.ADJECTIVE, meaningKo: '가능한, 이용 가능한', exampleEn: 'I am available now.', exampleKo: '지금 가능해.', frequencyRank: 95 },
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
