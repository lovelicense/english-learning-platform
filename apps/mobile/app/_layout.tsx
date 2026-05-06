import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ title: "Login" }} />
      <Stack.Screen name="ai-conversation" options={{ title: "AI Conversation" }} />
      <Stack.Screen name="ai-conversation/setup" options={{ title: "AI Conversation Setup" }} />
      <Stack.Screen name="ai-conversation/[id]" options={{ title: "AI Conversation Session" }} />
      <Stack.Screen name="dialogue-practice/index" options={{ title: "Dialogue Practice Library" }} />
      <Stack.Screen name="dialogue-practice/[id]" options={{ title: "Dialogue Practice" }} />
      <Stack.Screen name="learning-assets" options={{ title: "Learning Assets" }} />
      <Stack.Screen name="person-profiles" options={{ title: "People Dictionary" }} />
      <Stack.Screen name="quick-sentence" options={{ title: "Quick Save" }} />
      <Stack.Screen name="recording/[id]" options={{ title: "Recording Detail" }} />
      <Stack.Screen name="expression/[id]" options={{ title: "Expression Detail" }} />
    </Stack>
  );
}
