/**
 * Advanced Analytics Dashboard
 * Detailed learning progress, mastery trends, and performance metrics
 */

import { ScrollView, Text, View, Dimensions } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LearningEngineService } from "@/lib/services/learning-engine";
import { MaterialIcons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface AnalyticsData {
  totalConceptsLearned: number;
  masteredConcepts: number;
  currentStreak: number;
  totalStudyTime: number;
  averageMastery: number;
  weeklyProgress: number[];
  masteryDistribution: { level: string; count: number }[];
}

export default function AnalyticsDashboardScreen() {
  const colors = useColors();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalConceptsLearned: 12,
    masteredConcepts: 8,
    currentStreak: 7,
    totalStudyTime: 14400, // 4 hours in seconds
    averageMastery: 72,
    weeklyProgress: [45, 52, 48, 65, 72, 68, 75],
    masteryDistribution: [
      { level: "Novice", count: 2 },
      { level: "Intermediate", count: 2 },
      { level: "Proficient", count: 5 },
      { level: "Expert", count: 3 },
    ],
  });

  const formatStudyTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const StatCard = ({
    icon,
    label,
    value,
    unit,
    color,
  }: {
    icon: string;
    label: string;
    value: string | number;
    unit?: string;
    color: string;
  }) => (
    <View
      className="rounded-2xl p-4 flex-1"
      style={{
        backgroundColor: colors.surface,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm text-muted">{label}</Text>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className="text-2xl font-bold text-foreground">{value}</Text>
        {unit && <Text className="text-sm text-muted">{unit}</Text>}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView>
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Analytics</Text>
          <Text className="text-sm text-muted mt-1">Your learning journey insights</Text>
        </View>

        {/* Key Metrics */}
        <View className="p-4 gap-3">
          <View className="flex-row gap-3">
            <StatCard
              icon="trending-up"
              label="Mastered"
              value={analytics.masteredConcepts}
              unit="concepts"
              color={colors.success}
            />
            <StatCard
              icon="local-fire-department"
              label="Streak"
              value={analytics.currentStreak}
              unit="days"
              color={colors.warning}
            />
          </View>

          <View className="flex-row gap-3">
            <StatCard
              icon="schedule"
              label="Study Time"
              value={formatStudyTime(analytics.totalStudyTime)}
              color={colors.primary}
            />
            <StatCard
              icon="psychology"
              label="Avg Mastery"
              value={`${analytics.averageMastery}%`}
              color={colors.primary}
            />
          </View>
        </View>

        {/* Weekly Progress Chart */}
        <View className="p-4 border-t" style={{ borderTopColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-4">Weekly Progress</Text>
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.surface, height: 200 }}
          >
            <View className="flex-1 flex-row items-flex-end justify-between gap-2">
              {analytics.weeklyProgress.map((value, idx) => {
                const maxHeight = 160;
                const barHeight = (value / 100) * maxHeight;
                const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                return (
                  <View key={idx} className="flex-1 items-center">
                    <View
                      style={{
                        height: barHeight,
                        width: "100%",
                        backgroundColor: colors.primary,
                        borderRadius: 4,
                        marginBottom: 8,
                      }}
                    />
                    <Text className="text-xs text-muted">{days[idx]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Mastery Distribution */}
        <View className="p-4 border-t" style={{ borderTopColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-4">Mastery Distribution</Text>
          <View className="gap-3">
            {analytics.masteryDistribution.map((item, idx) => {
              const colors_array = [colors.warning, colors.primary, colors.success, colors.primary];
              const percentage = (item.count / analytics.totalConceptsLearned) * 100;
              return (
                <View key={idx}>
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-semibold text-foreground">{item.level}</Text>
                    <Text className="text-sm text-muted">
                      {item.count} ({percentage.toFixed(0)}%)
                    </Text>
                  </View>
                  <View
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.border }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${percentage}%`,
                        backgroundColor: colors_array[idx],
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Learning Insights */}
        <View className="p-4 border-t" style={{ borderTopColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-4">Insights</Text>
          <View className="gap-3">
            <InsightCard
              icon="lightbulb"
              title="Optimal Learning Time"
              description="You learn best in the morning. Schedule reviews between 9-11 AM."
              color={colors.warning}
            />
            <InsightCard
              icon="trending-up"
              title="Strong Progress"
              description="Your mastery improved 15% this week. Keep up the momentum!"
              color={colors.success}
            />
            <InsightCard
              icon="psychology"
              title="Knowledge Gaps"
              description="Consider reviewing Quantum Mechanics. Your retention is below 60%."
              color={colors.error}
            />
          </View>
        </View>

        {/* Export Section */}
        <View className="p-4 border-t" style={{ borderTopColor: colors.border, marginBottom: 20 }}>
          <Text className="text-lg font-semibold text-foreground mb-3">Export Data</Text>
          <View className="flex-row gap-2">
            <View
              className="flex-1 rounded-lg p-3 items-center border"
              style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <MaterialIcons name="file-download" size={24} color={colors.primary} />
              <Text className="text-xs text-foreground mt-2 font-semibold">PDF Report</Text>
            </View>
            <View
              className="flex-1 rounded-lg p-3 items-center border"
              style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <MaterialIcons name="table-chart" size={24} color={colors.primary} />
              <Text className="text-xs text-foreground mt-2 font-semibold">CSV Export</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function InsightCard({
  icon,
  title,
  description,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      className="rounded-xl p-3 flex-row gap-3"
      style={{ backgroundColor: color + "15", borderLeftWidth: 3, borderLeftColor: color }}
    >
      <MaterialIcons name={icon as any} size={24} color={color} />
      <View className="flex-1">
        <Text className="font-semibold text-foreground text-sm">{title}</Text>
        <Text className="text-xs text-muted mt-1">{description}</Text>
      </View>
    </View>
  );
}
