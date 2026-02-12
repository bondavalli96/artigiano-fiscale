import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated, Alert } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "@/lib/i18n";

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  onRecordingComplete,
  disabled,
}: VoiceRecorderProps) {
  const { t } = useI18n();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const startRecording = async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionDenied(true);
        Alert.alert(t("permissionDenied"), t("microphonePermissionNeeded"));
        return;
      }
      setPermissionDenied(false);

      audioRecorder.record();
      setIsRecording(true);
      setDuration(0);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      const errorMessage = err?.message || "";
      const isRecordingDisabled =
        errorMessage.includes("Recording not allowed") ||
        errorMessage.includes("RecordingDisabledException");
      if (isRecordingDisabled) {
        setPermissionDenied(true);
        Alert.alert(t("permissionDenied"), t("microphonePermissionNeeded"));
      }
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      setDuration(0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const uri = audioRecorder.uri;
      if (uri) {
        onRecordingComplete(uri);
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View className="items-center py-4">
      {isRecording && (
        <Text className="text-lg font-mono text-danger mb-3">
          {formatTime(duration)}
        </Text>
      )}

      {permissionDenied && !isRecording && (
        <Text className="text-xs text-danger mb-2">
          {t("microphonePermissionNeeded")}
        </Text>
      )}

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={toggleRecording}
          disabled={disabled}
          className={`w-20 h-20 rounded-full items-center justify-center ${
            isRecording ? "bg-red-500" : "bg-primary"
          } ${disabled ? "opacity-50" : ""}`}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={isRecording ? "stop" : "microphone"}
            size={36}
            color="white"
          />
        </TouchableOpacity>
      </Animated.View>

      <Text className="text-xs text-muted mt-2">
        {isRecording ? t("tapToStop") : t("tapToRecord")}
      </Text>
    </View>
  );
}
