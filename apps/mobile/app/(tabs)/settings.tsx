import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSessionBootstrap } from "../../src/hooks/use-session-bootstrap";
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrlInfo,
  resetApiBaseUrl,
  setApiBaseUrl,
  type ApiBaseUrlInfo,
} from "../../src/lib/config";
import {
  DEFAULT_RECORDING_PREFERENCES,
  getRecordingPreferences,
  setRecordingPreferences,
  type RecordingPreferences,
} from "../../src/lib/recording-preferences";
import {
  DEFAULT_LEARNING_PREFERENCES,
  setLearningPreferences,
  getLearningPreferences,
  type LearningPreferences,
} from "../../src/lib/learning-preferences";

export default function SettingsScreen() {
  const isDevToolsVisible = typeof __DEV__ !== "undefined" ? __DEV__ : false;
  const { user, storedEmail, loading: sessionLoading, error: sessionError, reload, logout } = useSessionBootstrap();

  const [apiInfo, setApiInfo] = useState<ApiBaseUrlInfo | null>(null);
  const [draftBaseUrl, setDraftBaseUrl] = useState("");
  const [apiLoading, setApiLoading] = useState(true);
  const [apiSaving, setApiSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiMessage, setApiMessage] = useState("");

  const [recordingPrefs, setRecordingPrefsState] = useState<RecordingPreferences>(DEFAULT_RECORDING_PREFERENCES);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [prefsMessage, setPrefsMessage] = useState("");
  const [learningPrefs, setLearningPrefsState] = useState<LearningPreferences>(DEFAULT_LEARNING_PREFERENCES);
  const [learningLoading, setLearningLoading] = useState(true);
  const [learningSaving, setLearningSaving] = useState(false);
  const [learningError, setLearningError] = useState("");
  const [learningMessage, setLearningMessage] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);

  const loadScreenState = useCallback(async () => {
    void reload();

    setPrefsLoading(true);
    setPrefsError("");
    try {
      const nextPrefs = await getRecordingPreferences();
      setRecordingPrefsState(nextPrefs);
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "녹음 기본 옵션을 불러오지 못했습니다.");
    } finally {
      setPrefsLoading(false);
    }

    setLearningLoading(true);
    setLearningError("");
    try {
      const nextLearningPrefs = await getLearningPreferences();
      setLearningPrefsState(nextLearningPrefs);
    } catch (err) {
      setLearningError(err instanceof Error ? err.message : "학습 설정을 불러오지 못했습니다.");
    } finally {
      setLearningLoading(false);
    }

    if (!isDevToolsVisible) {
      setApiLoading(false);
      return;
    }

    setApiLoading(true);
    setApiError("");
    try {
      const nextApiInfo = await getApiBaseUrlInfo();
      setApiInfo(nextApiInfo);
      setDraftBaseUrl(nextApiInfo.value);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "API 설정을 불러오지 못했습니다.");
    } finally {
      setApiLoading(false);
    }
  }, [isDevToolsVisible, reload]);

  useFocusEffect(
    useCallback(() => {
      void loadScreenState();
    }, [loadScreenState]),
  );

  async function handleSaveRecordingPreferences() {
    setPrefsSaving(true);
    setPrefsError("");
    setPrefsMessage("");

    try {
      const saved = await setRecordingPreferences(recordingPrefs);
      setRecordingPrefsState(saved);
      setPrefsMessage("녹음 기본 옵션을 저장했습니다. 다음 녹음부터 바로 반영됩니다.");
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "녹음 기본 옵션 저장에 실패했습니다.");
    } finally {
      setPrefsSaving(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleSaveLearningPreferences() {
    setLearningSaving(true);
    setLearningError("");
    setLearningMessage("");

    try {
      const saved = await setLearningPreferences(learningPrefs);
      setLearningPrefsState(saved);
      setLearningMessage("학습 기본 옵션을 저장했습니다. 다음 복습/연습부터 바로 반영됩니다.");
    } catch (err) {
      setLearningError(err instanceof Error ? err.message : "학습 기본 옵션 저장에 실패했습니다.");
    } finally {
      setLearningSaving(false);
    }
  }

  async function handleSaveApiUrl() {
    if (!draftBaseUrl.trim()) {
      setApiError("API 주소를 입력해 주세요.");
      return;
    }

    setApiSaving(true);
    setApiError("");
    setApiMessage("");

    try {
      const saved = await setApiBaseUrl(draftBaseUrl);
      const next = await getApiBaseUrlInfo();
      setApiInfo(next);
      setDraftBaseUrl(saved);
      setApiMessage("API 주소를 저장했습니다. 이후 요청부터 바로 새 주소를 사용합니다.");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "API 주소 저장에 실패했습니다.");
    } finally {
      setApiSaving(false);
    }
  }

  async function handleResetApiUrl() {
    setApiSaving(true);
    setApiError("");
    setApiMessage("");

    try {
      await resetApiBaseUrl();
      const next = await getApiBaseUrlInfo();
      setApiInfo(next);
      setDraftBaseUrl(next.value);
      setApiMessage("API 주소를 기본값으로 되돌렸습니다.");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "API 주소 초기화에 실패했습니다.");
    } finally {
      setApiSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.description}>
        계정 상태를 확인하고, 모바일에서 반복해서 쓰게 될 녹음 기본 옵션을 여기서 관리할 수 있습니다.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {sessionLoading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <>
            <Text style={styles.cardValue}>stored: {storedEmail || "-"}</Text>
            <Text style={styles.cardValue}>server: {user?.email ?? "not signed in"}</Text>
            {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}
          </>
        )}
        <View style={styles.buttonRow}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{user ? "계정 전환" : "로그인"}</Text>
            </Pressable>
          </Link>
          <Pressable style={styles.secondaryButton} onPress={() => void reload()} disabled={sessionLoading}>
            <Text style={styles.secondaryButtonText}>세션 새로고침</Text>
          </Pressable>
          <Pressable style={[styles.dangerButton, logoutLoading && styles.buttonDisabled]} onPress={() => void handleLogout()} disabled={logoutLoading}>
            {logoutLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.dangerButtonText}>로그아웃</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recording Defaults</Text>
        {prefsLoading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <>
            <Text style={styles.fieldLabel}>기본 세션 제목</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 출근길 영어 메모"
              value={recordingPrefs.defaultSessionTitle}
              onChangeText={(value) => setRecordingPrefsState((current) => ({ ...current, defaultSessionTitle: value }))}
            />
            <Text style={styles.helperText}>
              비워두면 `Record` 화면에서 제목을 직접 입력하고, 값을 넣어두면 새 녹음의 기본 제목으로 사용합니다.
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.switchTitle}>녹음 종료 후 자동 업로드</Text>
                <Text style={styles.helperText}>녹음을 멈추면 presign 업로드와 처리 요청까지 바로 이어갑니다.</Text>
              </View>
              <Switch
                value={recordingPrefs.autoUploadAfterStop}
                onValueChange={(value) => setRecordingPrefsState((current) => ({ ...current, autoUploadAfterStop: value }))}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.switchTitle}>업로드 후 결과 상세 자동 열기</Text>
                <Text style={styles.helperText}>처리 요청 직후 `recording/[id]` 상세 화면으로 이동합니다.</Text>
              </View>
              <Switch
                value={recordingPrefs.openResultAfterUpload}
                onValueChange={(value) => setRecordingPrefsState((current) => ({ ...current, openResultAfterUpload: value }))}
              />
            </View>

            {prefsError ? <Text style={styles.error}>{prefsError}</Text> : null}
            {prefsMessage ? <Text style={styles.success}>{prefsMessage}</Text> : null}
            <Pressable
              style={[styles.primaryButton, prefsSaving && styles.buttonDisabled]}
              onPress={() => void handleSaveRecordingPreferences()}
              disabled={prefsSaving}
            >
              {prefsSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>녹음 옵션 저장</Text>}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Learning Settings</Text>
        {learningLoading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <>
            <Text style={styles.fieldLabel}>기본 답변 모드</Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.selectChip, learningPrefs.defaultAnswerMode === "voice" && styles.selectChipSelected]}
                onPress={() => setLearningPrefsState((current) => ({ ...current, defaultAnswerMode: "voice" }))}
              >
                <Text style={[styles.selectChipText, learningPrefs.defaultAnswerMode === "voice" && styles.selectChipTextSelected]}>음성 답변</Text>
              </Pressable>
              <Pressable
                style={[styles.selectChip, learningPrefs.defaultAnswerMode === "text" && styles.selectChipSelected]}
                onPress={() => setLearningPrefsState((current) => ({ ...current, defaultAnswerMode: "text" }))}
              >
                <Text style={[styles.selectChipText, learningPrefs.defaultAnswerMode === "text" && styles.selectChipTextSelected]}>텍스트 답변</Text>
              </Pressable>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.switchTitle}>질문 한국어 TTS 자동 재생</Text>
                <Text style={styles.helperText}>복습 문제를 시작하면 질문을 먼저 읽어줍니다.</Text>
              </View>
              <Switch
                value={learningPrefs.autoPlayPromptTts}
                onValueChange={(value) => setLearningPrefsState((current) => ({ ...current, autoPlayPromptTts: value }))}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.switchTitle}>질문 후 자동 녹음 시작</Text>
                <Text style={styles.helperText}>음성 답변 모드에서 질문 읽기 종료 3초 뒤 자동으로 녹음을 시작합니다.</Text>
              </View>
              <Switch
                value={learningPrefs.autoStartVoiceRecording}
                onValueChange={(value) => setLearningPrefsState((current) => ({ ...current, autoStartVoiceRecording: value }))}
              />
            </View>

            {learningError ? <Text style={styles.error}>{learningError}</Text> : null}
            {learningMessage ? <Text style={styles.success}>{learningMessage}</Text> : null}
            <Pressable
              style={[styles.primaryButton, learningSaving && styles.buttonDisabled]}
              onPress={() => void handleSaveLearningPreferences()}
              disabled={learningSaving}
            >
              {learningSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>학습 옵션 저장</Text>}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>People Dictionary</Text>
        <Text style={styles.helperText}>
          녹음 상세에서 관련 인물 선택과 화자 연결에 쓰는 개인 인물 사전을 여기서 관리합니다.
        </Text>
        <Link href="/person-profiles" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>개인 인물 사전 열기</Text>
          </Pressable>
        </Link>
      </View>

      {isDevToolsVisible ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Developer API Base URL</Text>
          {apiLoading ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <>
              <Text style={styles.cardValue}>{apiInfo?.value ?? DEFAULT_API_BASE_URL}</Text>
              <Text style={styles.helperText}>source: {apiInfo?.source ?? "unknown"}</Text>
              <Text style={styles.helperText}>default: {apiInfo?.defaultValue ?? DEFAULT_API_BASE_URL}</Text>
            </>
          )}
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.0.10:4000"
            value={draftBaseUrl}
            onChangeText={setDraftBaseUrl}
          />
          <Text style={styles.helperText}>
            Android 에뮬레이터는 `http://10.0.2.2:4000`, 실기기는 같은 Wi-Fi의 PC IP를 쓰면 됩니다.
          </Text>
          {apiError ? <Text style={styles.error}>{apiError}</Text> : null}
          {apiMessage ? <Text style={styles.success}>{apiMessage}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, (apiSaving || apiLoading) && styles.buttonDisabled]}
              onPress={() => void handleSaveApiUrl()}
              disabled={apiSaving || apiLoading}
            >
              {apiSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save API URL</Text>}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, (apiSaving || apiLoading) && styles.buttonDisabled]}
              onPress={() => void handleResetApiUrl()}
              disabled={apiSaving || apiLoading}
            >
              <Text style={styles.secondaryButtonText}>Reset to Default</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  description: {
    color: "#475569",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardValue: {
    color: "#334155",
    lineHeight: 20,
  },
  fieldLabel: {
    color: "#0f172a",
    fontWeight: "700",
  },
  helperText: {
    color: "#64748b",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#0f172a",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  selectChip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectChipSelected: {
    backgroundColor: "#dbeafe",
  },
  selectChipText: {
    color: "#334155",
    fontWeight: "700",
  },
  selectChipTextSelected: {
    color: "#1d4ed8",
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 4,
  },
  switchTextBlock: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  error: {
    color: "#dc2626",
    lineHeight: 20,
  },
  success: {
    color: "#0f766e",
    lineHeight: 20,
  },
});
