/**
 * Settings Screen
 * User preferences, notifications, spaced repetition customization, and data management
 */

import { ScrollView, Text, View, TouchableOpacity, Switch, Platform } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";

interface SettingsState {
  notificationsEnabled: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  spacedRepetitionEnabled: boolean;
  reviewInterval: number; // in days
  darkMode: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
}

export default function SettingsScreen() {
  const colors = useColors();
  const [settings, setSettings] = useState<SettingsState>({
    notificationsEnabled: true,
    dailyReminder: true,
    reminderTime: "09:00",
    spacedRepetitionEnabled: true,
    reviewInterval: 3,
    darkMode: false,
    soundEnabled: true,
    hapticFeedback: true,
  });

  const toggleSetting = (key: keyof SettingsState) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportData = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // TODO: Implement data export
  };

  const handleClearData = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    // TODO: Implement data clearing with confirmation
  };

  const SettingRow = ({
    icon,
    label,
    description,
    value,
    onToggle,
  }: {
    icon: string;
    label: string;
    description?: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <View
      className="flex-row items-center justify-between p-4 border-b"
      style={{ borderBottomColor: colors.border }}
    >
      <View className="flex-row items-center flex-1 mr-4">
        <MaterialIcons name={icon as any} size={24} color={colors.primary} />
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-foreground">{label}</Text>
          {description && <Text className="text-xs text-muted mt-1">{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary + "40" }}
        thumbColor={value ? colors.primary : colors.muted}
      />
    </View>
  );

  const SettingButton = ({
    icon,
    label,
    description,
    onPress,
    danger = false,
  }: {
    icon: string;
    label: string;
    description?: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between p-4 border-b"
      style={{ borderBottomColor: colors.border }}
    >
      <View className="flex-row items-center flex-1 mr-4">
        <MaterialIcons
          name={icon as any}
          size={24}
          color={danger ? colors.error : colors.primary}
        />
        <View className="ml-3 flex-1">
          <Text className={`text-base font-semibold ${danger ? "text-error" : "text-foreground"}`}>
            {label}
          </Text>
          {description && <Text className="text-xs text-muted mt-1">{description}</Text>}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView>
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

        {/* Notifications Section */}
        <View className="mt-4">
          <Text className="px-4 py-2 text-sm font-semibold text-muted uppercase">
            Notifications
          </Text>
          <SettingRow
            icon="notifications"
            label="Enable Notifications"
            description="Get reminders for reviews and new concepts"
            value={settings.notificationsEnabled}
            onToggle={() => toggleSetting("notificationsEnabled")}
          />
          {settings.notificationsEnabled && (
            <>
              <SettingRow
                icon="schedule"
                label="Daily Reminder"
                description="Receive a daily learning reminder"
                value={settings.dailyReminder}
                onToggle={() => toggleSetting("dailyReminder")}
              />
              <View className="px-4 py-3 bg-surface" style={{ backgroundColor: colors.surface }}>
                <Text className="text-sm text-muted mb-2">Reminder Time</Text>
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="access-time" size={20} color={colors.primary} />
                  <Text className="text-base font-semibold text-foreground">
                    {settings.reminderTime}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Learning Preferences Section */}
        <View className="mt-4">
          <Text className="px-4 py-2 text-sm font-semibold text-muted uppercase">
            Learning Preferences
          </Text>
          <SettingRow
            icon="repeat"
            label="Spaced Repetition"
            description="Use SM-2 algorithm for optimal review scheduling"
            value={settings.spacedRepetitionEnabled}
            onToggle={() => toggleSetting("spacedRepetitionEnabled")}
          />
          {settings.spacedRepetitionEnabled && (
            <View className="px-4 py-3 bg-surface" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm text-muted mb-3">Review Interval (days)</Text>
              <View className="flex-row gap-2">
                {[1, 3, 7, 14].map((interval) => (
                  <TouchableOpacity
                    key={interval}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, reviewInterval: interval }))
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor:
                        settings.reviewInterval === interval ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          settings.reviewInterval === interval ? "white" : colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {interval}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Accessibility Section */}
        <View className="mt-4">
          <Text className="px-4 py-2 text-sm font-semibold text-muted uppercase">
            Accessibility
          </Text>
          <SettingRow
            icon="volume-up"
            label="Sound Effects"
            description="Play sounds for interactions and feedback"
            value={settings.soundEnabled}
            onToggle={() => toggleSetting("soundEnabled")}
          />
          <SettingRow
            icon="vibration"
            label="Haptic Feedback"
            description="Vibration feedback on interactions"
            value={settings.hapticFeedback}
            onToggle={() => toggleSetting("hapticFeedback")}
          />
        </View>

        {/* Data Management Section */}
        <View className="mt-4 mb-6">
          <Text className="px-4 py-2 text-sm font-semibold text-muted uppercase">
            Data Management
          </Text>
          <SettingButton
            icon="download"
            label="Export Learning Data"
            description="Download your learning progress as JSON"
            onPress={handleExportData}
          />
          <SettingButton
            icon="delete-outline"
            label="Clear All Data"
            description="Delete all learning data (cannot be undone)"
            onPress={handleClearData}
            danger
          />
        </View>

        {/* App Info Section */}
        <View className="mt-4 mb-6">
          <Text className="px-4 py-2 text-sm font-semibold text-muted uppercase">
            About NeuroTutor
          </Text>
          <View className="px-4 py-3 border-b" style={{ borderBottomColor: colors.border }}>
            <Text className="text-sm text-muted mb-1">Version</Text>
            <Text className="text-base font-semibold text-foreground">1.0.0</Text>
          </View>
          <View className="px-4 py-3">
            <Text className="text-sm text-muted mb-1">Built with</Text>
            <Text className="text-base font-semibold text-foreground">
              Neuroscience & Feynman Technique
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
