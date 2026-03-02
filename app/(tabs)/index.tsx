/**
 * Home Screen / Dashboard
 * Central hub for learning activities, progress tracking, and recommendations
 */

import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LearningEngineService } from "@/lib/services/learning-engine";
import { ConceptMemoryState, Concept } from "@/lib/types/learning";
import * as Haptics from "expo-haptics";

interface DashboardData {
  streak: number;
  todayProgress: number;
  conceptsMastered: number;
  studyTime: number;
  readyForReview: ConceptMemoryState[];
  recommendedTopic: Concept | null;
}

export default function HomeScreen() {
  const colors = useColors();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    streak: 0,
    todayProgress: 0,
    conceptsMastered: 0,
    studyTime: 0,
    readyForReview: [],
    recommendedTopic: null,
  });


  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Load actual data from learning engine
      // For now, show placeholder data
      const readyForReview = await LearningEngineService.getConceptsReadyForReview();

      setDashboardData({
        streak: 7,
        todayProgress: 45,
        conceptsMastered: 12,
        studyTime: 180,
        readyForReview,
        recommendedTopic: null,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const handleStartLearning = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to topic selection
  };

  const handleReviewConcept = (conceptId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to quiz screen for this concept
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="gap-6 pb-8">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Welcome back!</Text>
            <Text className="text-base text-muted">
              Continue your learning journey with NeuroTutor
            </Text>
          </View>

          {/* Quick Stats Grid */}
          <View className="gap-3">
            <View className="flex-row gap-3">
              {/* Streak Card */}
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-1">Learning Streak</Text>
                <Text className="text-3xl font-bold text-primary">{dashboardData.streak}</Text>
                <Text className="text-xs text-muted mt-1">days 🔥</Text>
              </View>

              {/* Mastered Card */}
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-1">Mastered</Text>
                <Text className="text-3xl font-bold text-success">
                  {dashboardData.conceptsMastered}
                </Text>
                <Text className="text-xs text-muted mt-1">concepts</Text>
              </View>
            </View>

            {/* Today's Progress */}
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-sm text-muted">Today&apos;s Progress</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {dashboardData.todayProgress}%
                </Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: colors.primary,
                    width: `${dashboardData.todayProgress}%`,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Ready for Review Section */}
          {dashboardData.readyForReview.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Ready for Review</Text>
              <View className="gap-2">
                {dashboardData.readyForReview.slice(0, 3).map((concept) => (
                  <TouchableOpacity
                    key={concept.conceptId}
                    onPress={() => handleReviewConcept(concept.conceptId)}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-xl p-4 active:opacity-70"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground mb-1">
                          {concept.conceptId}
                        </Text>
                        <Text className="text-sm text-muted">
                          Mastery: {concept.masteryLevel}
                        </Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-lg font-bold text-primary">
                          {concept.retentionScore}%
                        </Text>
                        <Text className="text-xs text-muted">retention</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Start Learning Button */}
          <TouchableOpacity
            onPress={handleStartLearning}
            className="bg-primary rounded-2xl p-4 active:opacity-80"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-center text-lg font-semibold text-background">
              Start New Learning Session
            </Text>
          </TouchableOpacity>

          {/* Quick Links */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Quick Links</Text>
            <View className="gap-2 flex-row flex-wrap">
              <TouchableOpacity
                className="flex-1 rounded-xl p-3 active:opacity-70 min-w-[45%]"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-semibold text-foreground">📊 Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 rounded-xl p-3 active:opacity-70 min-w-[45%]"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-semibold text-foreground">🧠 Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 rounded-xl p-3 active:opacity-70 min-w-[45%]"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-semibold text-foreground">🔗 Knowledge Graph</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 rounded-xl p-3 active:opacity-70 min-w-[45%]"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-semibold text-foreground">⚙️ Settings</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Learning Tips */}
          <View
            className="rounded-2xl p-4 border"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Text className="text-sm font-semibold text-foreground mb-2">💡 Learning Tip</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Use the Teach-Back feature to explain concepts in your own words. This activates the Feynman Technique and helps identify knowledge gaps.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
