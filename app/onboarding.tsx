/**
 * Onboarding Screen
 * Initial setup: learning style, depth level, baseline knowledge assessment
 */

import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

type LearningStyle = "visual" | "verbal" | "kinesthetic" | "reading_writing";
type DepthLevel = "beginner" | "intermediate" | "advanced" | "expert";
type CommunicationPreference = "encouraging" | "neutral" | "formal" | "socratic";

interface OnboardingState {
  step: 1 | 2 | 3 | 4;
  learningStyle: LearningStyle | null;
  depthLevel: DepthLevel | null;
  communicationPreference: CommunicationPreference | null;
  loading: boolean;
}

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    learningStyle: null,
    depthLevel: null,
    communicationPreference: null,
    loading: false,
  });

  const handleLearningStyleSelect = (style: LearningStyle) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, learningStyle: style, step: 2 }));
  };

  const handleDepthLevelSelect = (level: DepthLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, depthLevel: level, step: 3 }));
  };

  const handleCommunicationSelect = (pref: CommunicationPreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, communicationPreference: pref, step: 4 }));
  };

  const handleComplete = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // TODO: Save preferences to AsyncStorage
      // TODO: Initialize mental model

      // Navigate to home screen
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState((prev) => ({ ...prev, step: (prev.step - 1) as any }));
    }
  };

  return (
    <ScreenContainer className="bg-background flex-1" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Welcome to NeuroTutor</Text>
          <Text className="text-sm text-muted mt-1">
            Step {state.step} of 4 - Let's personalize your learning
          </Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
          {/* Step 1: Learning Style */}
          {state.step === 1 && (
            <>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-semibold text-foreground mb-2">
                  How do you learn best?
                </Text>
                <Text className="text-sm text-muted">
                  Understanding your learning style helps us adapt explanations to suit you.
                </Text>
              </View>

              <View className="gap-3">
                {[
                  {
                    id: "visual" as LearningStyle,
                    icon: "👁️",
                    title: "Visual",
                    description: "I learn best with diagrams, charts, and visual representations",
                  },
                  {
                    id: "verbal" as LearningStyle,
                    icon: "🗣️",
                    title: "Verbal",
                    description: "I learn best through discussions and spoken explanations",
                  },
                  {
                    id: "kinesthetic" as LearningStyle,
                    icon: "🤲",
                    title: "Kinesthetic",
                    description: "I learn best by doing and hands-on practice",
                  },
                  {
                    id: "reading_writing" as LearningStyle,
                    icon: "📝",
                    title: "Reading/Writing",
                    description: "I learn best through reading and writing notes",
                  },
                ].map((style) => (
                  <TouchableOpacity
                    key={style.id}
                    onPress={() => handleLearningStyleSelect(style.id)}
                    className="rounded-xl p-4 border-2 flex-row items-center gap-3"
                    style={{
                      borderColor:
                        state.learningStyle === style.id ? colors.primary : colors.border,
                      backgroundColor:
                        state.learningStyle === style.id
                          ? colors.primary + "20"
                          : colors.surface,
                    }}
                  >
                    <Text className="text-3xl">{style.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">{style.title}</Text>
                      <Text className="text-xs text-muted mt-1">{style.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 2: Depth Level */}
          {state.step === 2 && (
            <>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-semibold text-foreground mb-2">
                  What's your learning depth preference?
                </Text>
                <Text className="text-sm text-muted">
                  This helps us adjust the complexity and detail of explanations.
                </Text>
              </View>

              <View className="gap-3">
                {[
                  {
                    id: "beginner" as DepthLevel,
                    title: "Beginner",
                    description: "Simple explanations, focus on core concepts",
                  },
                  {
                    id: "intermediate" as DepthLevel,
                    title: "Intermediate",
                    description: "Balanced detail, some technical depth",
                  },
                  {
                    id: "advanced" as DepthLevel,
                    title: "Advanced",
                    description: "In-depth explanations with technical details",
                  },
                  {
                    id: "expert" as DepthLevel,
                    title: "Expert",
                    description: "Comprehensive coverage with advanced concepts",
                  },
                ].map((level) => (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => handleDepthLevelSelect(level.id)}
                    className="rounded-xl p-4 border-2"
                    style={{
                      borderColor:
                        state.depthLevel === level.id ? colors.primary : colors.border,
                      backgroundColor:
                        state.depthLevel === level.id ? colors.primary + "20" : colors.surface,
                    }}
                  >
                    <Text className="text-base font-semibold text-foreground">{level.title}</Text>
                    <Text className="text-sm text-muted mt-1">{level.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 3: Communication Preference */}
          {state.step === 3 && (
            <>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-semibold text-foreground mb-2">
                  How should I communicate with you?
                </Text>
                <Text className="text-sm text-muted">
                  Choose your preferred communication style for feedback and guidance.
                </Text>
              </View>

              <View className="gap-3">
                {[
                  {
                    id: "encouraging" as CommunicationPreference,
                    title: "Encouraging",
                    description: "Supportive and motivational tone",
                  },
                  {
                    id: "neutral" as CommunicationPreference,
                    title: "Neutral",
                    description: "Objective and straightforward",
                  },
                  {
                    id: "formal" as CommunicationPreference,
                    title: "Formal",
                    description: "Academic and professional tone",
                  },
                  {
                    id: "socratic" as CommunicationPreference,
                    title: "Socratic",
                    description: "Questioning to guide discovery",
                  },
                ].map((pref) => (
                  <TouchableOpacity
                    key={pref.id}
                    onPress={() => handleCommunicationSelect(pref.id)}
                    className="rounded-xl p-4 border-2"
                    style={{
                      borderColor:
                        state.communicationPreference === pref.id
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        state.communicationPreference === pref.id
                          ? colors.primary + "20"
                          : colors.surface,
                    }}
                  >
                    <Text className="text-base font-semibold text-foreground">{pref.title}</Text>
                    <Text className="text-sm text-muted mt-1">{pref.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 4: Summary & Confirmation */}
          {state.step === 4 && (
            <>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-semibold text-foreground mb-3">
                  Your Learning Profile
                </Text>

                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Learning Style:</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {state.learningStyle}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Depth Level:</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {state.depthLevel}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Communication:</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {state.communicationPreference}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                className="rounded-2xl p-4 border-l-4"
                style={{
                  backgroundColor: colors.surface,
                  borderLeftColor: colors.success,
                }}
              >
                <Text className="text-sm font-semibold text-foreground mb-2">
                  ✨ You're all set!
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  Your personalized learning profile is ready. Let's start your journey to superunderstanding!
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View className="p-4 gap-3 border-t" style={{ borderTopColor: colors.border }}>
          {state.step > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              className="rounded-2xl p-3 border-2"
              style={{ borderColor: colors.primary }}
              disabled={state.loading}
            >
              <Text className="text-center text-base font-semibold" style={{ color: colors.primary }}>
                Back
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={state.step === 4 ? handleComplete : () => {}}
            className="rounded-2xl p-3 flex-row items-center justify-center gap-2"
            style={{ backgroundColor: colors.primary, opacity: state.loading ? 0.6 : 1 }}
            disabled={state.loading}
          >
            {state.loading ? (
              <>
                <ActivityIndicator size="small" color={colors.background} />
                <Text className="text-center text-base font-semibold text-background">
                  Getting Started...
                </Text>
              </>
            ) : (
              <Text className="text-center text-base font-semibold text-background">
                {state.step === 4 ? "Start Learning" : "Next"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
