import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ title: "로그인" }} />
      <Stack.Screen name="ai-conversation" options={{ title: "AI 대화" }} />
      <Stack.Screen name="ai-conversation/setup" options={{ title: "AI 대화 설정" }} />
      <Stack.Screen name="ai-conversation/[id]" options={{ title: "AI 대화 세션" }} />
      <Stack.Screen name="dialogue-practice/index" options={{ title: "다이얼로그 연습 라이브러리" }} />
      <Stack.Screen name="dialogue-practice/[id]" options={{ title: "다이얼로그 연습" }} />
      <Stack.Screen name="learning-assets" options={{ title: "학습 자산" }} />
      <Stack.Screen name="person-profiles" options={{ title: "개인 인물 사전" }} />
      <Stack.Screen name="recording/[id]" options={{ title: "녹음 상세" }} />
      <Stack.Screen name="expression/[id]" options={{ title: "표현 상세" }} />
    </Stack>
  );
}
