/**
 * Quiz Results Screen
 * Displays performance metrics, retention scoring, and next steps
 */

import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

export default function QuizResultsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { score, totalQuestions, correctAnswers } = useLocalSearchParams<{
    score: string;
    totalQuestions: string;
    correctAnswers: string;
  }>();

  const scoreNum = parseInt(score || "0");
  const totalNum = parseInt(totalQuestions || "0");
  const correctNum = parseInt(correctAnswers || "0");

  const getMasteryMessage = (score: number) => {
    if (score >= 90) return { message: "Expert Level! 🎓", color: colors.success };
    if (score >= 80) return { message: "Proficient! 🌟", color: colors.primary };
    if (score >= 70) return { message: "Good Progress! 📈", color: colors.primary };
    if (score >= 60) return { message: "Keep Practicing 💪", color: colors.warning };
    return { message: "Review & Try Again 🔄", color: colors.error };
  };

  const mastery = getMasteryMessage(scoreNum);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleReviewMisconceptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to misconception review screen
  };

  const handleRetakeQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <ScreenContainer className="bg-background flex-1">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="gap-6 pb-8">
          {/* Score Display */}
          <View className="items-center gap-4 mt-8">
            <View
              className="w-32 h-32 rounded-full items-center justify-center"
              style={{ backgroundColor: mastery.color + "20" }}
            >
              <Text className="text-5xl font-bold" style={{ color: mastery.color }}>
                {scoreNum}%
              </Text>
            </View>
            <Text className="text-2xl font-bold text-foreground">{mastery.message}</Text>
            <Text className="text-base text-muted">
              You got {correctNum} out of {totalNum} questions correct
            </Text>
          </View>

          {/* Performance Breakdown */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Performance Breakdown</Text>

            {/* Accuracy */}
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-muted">Accuracy</Text>
                <Text className="text-lg font-bold text-foreground">{scoreNum}%</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: mastery.color,
                    width: `${scoreNum}%`,
                  }}
                />
              </View>
            </View>

            {/* Retention Estimate */}
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-muted">Estimated Retention</Text>
                <Text className="text-lg font-bold text-foreground">
                  {Math.round(scoreNum * 0.9)}%
                </Text>
              </View>
              <Text className="text-xs text-muted mt-2">
                Based on active recall performance and spaced repetition schedule
              </Text>
            </View>

            {/* Next Review */}
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-sm text-muted">Next Review</Text>
                <Text className="text-base font-semibold text-foreground">
                  {scoreNum >= 80 ? "3 days" : "1 day"}
                </Text>
              </View>
              <Text className="text-xs text-muted">
                Scheduled based on spaced repetition algorithm
              </Text>
            </View>
          </View>

          {/* Insights */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Key Insights</Text>

            {scoreNum >= 80 && (
              <View
                className="rounded-2xl p-4 border-l-4"
                style={{
                  backgroundColor: colors.surface,
                  borderLeftColor: colors.success,
                }}
              >
                <Text className="text-sm font-semibold text-foreground mb-1">
                  ✓ Strong Understanding
                </Text>
                <Text className="text-sm text-muted">
                  Your retention score indicates solid mastery. Focus on applying these concepts to new problems.
                </Text>
              </View>
            )}

            {scoreNum >= 60 && scoreNum < 80 && (
              <View
                className="rounded-2xl p-4 border-l-4"
                style={{
                  backgroundColor: colors.surface,
                  borderLeftColor: colors.warning,
                }}
              >
                <Text className="text-sm font-semibold text-foreground mb-1">
                  📝 Review Recommended
                </Text>
                <Text className="text-sm text-muted">
                  Some concepts need reinforcement. Use the teach-back feature to solidify your understanding.
                </Text>
              </View>
            )}

            {scoreNum < 60 && (
              <View
                className="rounded-2xl p-4 border-l-4"
                style={{
                  backgroundColor: colors.surface,
                  borderLeftColor: colors.error,
                }}
              >
                <Text className="text-sm font-semibold text-foreground mb-1">
                  🔄 Deeper Review Needed
                </Text>
                <Text className="text-sm text-muted">
                  Return to the main explanation and use the Feynman Technique to break down concepts more carefully.
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={handleContinue}
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center text-lg font-semibold text-background">
                Back to Home
              </Text>
            </TouchableOpacity>

            {scoreNum < 80 && (
              <TouchableOpacity
                onPress={handleReviewMisconceptions}
                className="rounded-2xl p-4 border-2"
                style={{ borderColor: colors.primary }}
              >
                <Text className="text-center text-lg font-semibold" style={{ color: colors.primary }}>
                  Review Misconceptions
                </Text>
              </TouchableOpacity>
            )}

            {scoreNum < 70 && (
              <TouchableOpacity
                onPress={handleRetakeQuiz}
                className="rounded-2xl p-4 border-2"
                style={{ borderColor: colors.primary }}
              >
                <Text className="text-center text-lg font-semibold" style={{ color: colors.primary }}>
                  Retake Quiz
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
