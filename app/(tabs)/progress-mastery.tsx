/**
 * Progress & Mastery Screen
 * Displays learning analytics, mastery levels, and achievement milestones
 */

import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LearningEngineService } from "@/lib/services/learning-engine";

interface ProgressStats {
  totalConcepts: number;
  masteredConcepts: number;
  inProgressConcepts: number;
  averageMastery: number;
  totalStudyTime: number;
  currentStreak: number;
  conceptsByMastery: Record<string, number>;
}

export default function ProgressMasteryScreen() {
  const colors = useColors();
  const [stats, setStats] = useState<ProgressStats>({
    totalConcepts: 0,
    masteredConcepts: 0,
    inProgressConcepts: 0,
    averageMastery: 0,
    totalStudyTime: 0,
    currentStreak: 7,
    conceptsByMastery: {
      novice: 0,
      intermediate: 0,
      proficient: 0,
      expert: 0,
    },
  });


  useEffect(() => {
    loadProgressStats();
  }, []);

  const loadProgressStats = async () => {
    try {
      // Get all memory states
      const stmConcepts = await LearningEngineService.getConceptsInMemory("short_term");
      const ltmConcepts = await LearningEngineService.getConceptsInMemory("long_term");
      const allConcepts = [...stmConcepts, ...ltmConcepts];

      // Calculate stats
      const masteredConcepts = allConcepts.filter(
        (c) => c.masteryLevel === "expert" || c.masteryLevel === "proficient"
      ).length;
      const inProgressConcepts = allConcepts.filter(
        (c) => c.masteryLevel === "novice" || c.masteryLevel === "intermediate"
      ).length;
      const averageMastery =
        allConcepts.length > 0
          ? allConcepts.reduce((sum, c) => {
              const masteryScore =
                c.masteryLevel === "novice"
                  ? 25
                  : c.masteryLevel === "intermediate"
                  ? 50
                  : c.masteryLevel === "proficient"
                  ? 75
                  : 100;
              return sum + masteryScore;
            }, 0) / allConcepts.length
          : 0;

      const conceptsByMastery = {
        novice: allConcepts.filter((c) => c.masteryLevel === "novice").length,
        intermediate: allConcepts.filter((c) => c.masteryLevel === "intermediate").length,
        proficient: allConcepts.filter((c) => c.masteryLevel === "proficient").length,
        expert: allConcepts.filter((c) => c.masteryLevel === "expert").length,
      };

      setStats({
        totalConcepts: allConcepts.length,
        masteredConcepts,
        inProgressConcepts,
        averageMastery,
        totalStudyTime: 0, // TODO: Calculate from sessions
        currentStreak: 7, // TODO: Calculate from session history
        conceptsByMastery,
      });
    } catch (error) {
      console.error("Error loading progress stats:", error);
    }
  };

  const getMasteryColor = (level: string) => {
    switch (level) {
      case "expert":
        return colors.success;
      case "proficient":
        return colors.primary;
      case "intermediate":
        return colors.warning;
      case "novice":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  return (
    <ScreenContainer className="bg-background flex-1" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Progress & Mastery</Text>
          <Text className="text-sm text-muted mt-1">Track your learning journey</Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
          {/* Key Metrics */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Key Metrics</Text>

            <View className="flex-row gap-3">
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs text-muted mb-1">Total Concepts</Text>
                <Text className="text-3xl font-bold text-foreground">{stats.totalConcepts}</Text>
              </View>
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs text-muted mb-1">Mastered</Text>
                <Text className="text-3xl font-bold text-success">{stats.masteredConcepts}</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs text-muted mb-1">Avg Mastery</Text>
                <Text className="text-3xl font-bold text-primary">
                  {Math.round(stats.averageMastery)}%
                </Text>
              </View>
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-xs text-muted mb-1">Streak</Text>
                <Text className="text-3xl font-bold text-warning">{stats.currentStreak}🔥</Text>
              </View>
            </View>
          </View>

          {/* Mastery Distribution */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Mastery Distribution</Text>

            {[
              { level: "expert", label: "Expert", count: stats.conceptsByMastery.expert },
              { level: "proficient", label: "Proficient", count: stats.conceptsByMastery.proficient },
              { level: "intermediate", label: "Intermediate", count: stats.conceptsByMastery.intermediate },
              { level: "novice", label: "Novice", count: stats.conceptsByMastery.novice },
            ].map((item) => (
              <View
                key={item.level}
                className="rounded-xl p-3"
                style={{ backgroundColor: colors.surface }}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-sm font-bold" style={{ color: getMasteryColor(item.level) }}>
                    {item.count}
                  </Text>
                </View>
                <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: getMasteryColor(item.level),
                      width: `${stats.totalConcepts > 0 ? (item.count / stats.totalConcepts) * 100 : 0}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Achievements */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Achievements</Text>

            {[
              { icon: "🌟", title: "First Steps", description: "Learn your first concept" },
              { icon: "🎯", title: "Focused Learner", description: "Master 5 concepts" },
              { icon: "🚀", title: "Momentum", description: "7-day learning streak" },
              { icon: "🏆", title: "Expert", description: "Achieve expert level in any concept" },
            ].map((achievement, idx) => (
              <TouchableOpacity
                key={idx}
                className="rounded-xl p-3 flex-row items-center gap-3"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-3xl">{achievement.icon}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{achievement.title}</Text>
                  <Text className="text-xs text-muted mt-1">{achievement.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Learning Tips */}
          <View
            className="rounded-2xl p-4 border-l-4"
            style={{
              backgroundColor: colors.surface,
              borderLeftColor: colors.primary,
            }}
          >
            <Text className="text-sm font-semibold text-foreground mb-2">💡 Learning Tip</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Consistency is key! Regular spaced repetition and active recall are the most effective ways to move concepts from short-term to long-term memory.
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
