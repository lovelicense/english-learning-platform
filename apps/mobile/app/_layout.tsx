import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ title: "Login" }} />
      <Stack.Screen name="recording/[id]" options={{ title: "Recording Detail" }} />
      <Stack.Screen name="expression/[id]" options={{ title: "Expression Detail" }} />
    </Stack>
  );
}
