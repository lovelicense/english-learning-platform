import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { login } from "../../src/lib/api/auth";
import { setSession } from "../../src/lib/auth";
import { getApiBaseUrlInfo, resetApiBaseUrl, type ApiBaseUrlInfo } from "../../src/lib/config";
import { mobileTheme } from "../../src/theme/colors";

const theme = mobileTheme.colors;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiInfo, setApiInfo] = useState<ApiBaseUrlInfo | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiMessage, setApiMessage] = useState("");

  useEffect(() => {
    void loadApiInfo();
  }, []);

  async function loadApiInfo() {
    setApiLoading(true);
    try {
      const next = await getApiBaseUrlInfo();
      setApiInfo(next);
    } catch (err) {
      setApiMessage(err instanceof Error ? err.message : "API 주소를 불러오지 못했습니다.");
    } finally {
      setApiLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await login(email.trim(), password);
      await setSession(response.accessToken, response.user);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetApiUrl() {
    setApiLoading(true);
    setApiMessage("");

    try {
      await resetApiBaseUrl();
      const next = await getApiBaseUrlInfo();
      setApiInfo(next);
      setApiMessage("API 주소를 기본값으로 초기화했습니다.");
    } catch (err) {
      setApiMessage(err instanceof Error ? err.message : "API 주소 초기화에 실패했습니다.");
    } finally {
      setApiLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인</Text>
      <Text style={styles.description}>
        기존 `/auth/login`과 `/auth/me` API를 사용합니다. 로그인 성공 시 토큰은 Secure Store에 저장됩니다.
      </Text>
      <View style={styles.apiCard}>
        <Text style={styles.apiTitle}>현재 API 주소</Text>
        {apiLoading ? <ActivityIndicator color={theme.brand} /> : <Text style={styles.apiValue}>{apiInfo?.value ?? "-"}</Text>}
        {apiInfo ? <Text style={styles.apiMeta}>source: {apiInfo.source}</Text> : null}
        {apiMessage ? <Text style={styles.apiMessage}>{apiMessage}</Text> : null}
        <Pressable style={styles.secondaryButton} onPress={() => void handleResetApiUrl()} disabled={apiLoading}>
          <Text style={styles.secondaryButtonText}>기본값으로 초기화</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={() => void handleLogin()} disabled={loading}>
        {loading ? <ActivityIndicator color={theme.textOnBrand} /> : <Text style={styles.buttonText}>로그인</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 24,
    justifyContent: "center",
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.text,
  },
  description: {
    color: theme.textSoft,
    lineHeight: 22,
  },
  apiCard: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  apiTitle: {
    color: theme.text,
    fontWeight: "700",
  },
  apiValue: {
    color: theme.text,
  },
  apiMeta: {
    color: theme.textSoft,
    fontSize: 12,
  },
  apiMessage: {
    color: theme.textSoft,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: "600",
  },
  buttonText: {
    color: theme.textOnBrand,
    fontWeight: "700",
  },
  error: {
    color: theme.danger,
  },
});
