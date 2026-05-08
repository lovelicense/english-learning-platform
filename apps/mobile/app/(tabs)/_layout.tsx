import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="quick-sentence" options={{ title: "Quick Save", href: null }} />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
      <Tabs.Screen name="expressions" options={{ title: "Expressions" }} />
      <Tabs.Screen name="reviews" options={{ title: "Reviews" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
