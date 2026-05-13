import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="home" options={{ title: "홈" }} />
      <Tabs.Screen name="quick-sentence" options={{ title: "빠른 저장", href: null }} />
      <Tabs.Screen name="record" options={{ title: "녹음" }} />
      <Tabs.Screen name="expressions" options={{ title: "표현" }} />
      <Tabs.Screen name="reviews" options={{ title: "복습" }} />
      <Tabs.Screen name="settings" options={{ title: "설정" }} />
    </Tabs>
  );
}
