/**
 * Achievements Screen
 * Display unlocked badges, milestones, and gamification progress
 */

import { ScrollView, Text, View, TouchableOpacity, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ACHIEVEMENTS_CATALOG, AchievementsService } from "@/lib/services/achievements";
import { MaterialIcons } from "@expo/vector-icons";

export default function AchievementsScreen() {
  const colors = useColors();

  // Mock data
  const [userStats] = useState({
    level: 5,
    totalPoints: 425,
    nextLevelProgress: 25,
    currentStreak: 7,
    masteredConcepts: 8,
    unlockedAchievements: [
      "first-concept",
      "five-concepts",
      "three-day-streak",
      "seven-day-streak",
      "first-expert",
      "perfect-quiz",
      "early-bird",
    ],
  });

  const achievements = AchievementsService.getUnlockedAchievements(
    userStats.unlockedAchievements
  );
  const nextMilestones = AchievementsService.getNextMilestones(
    userStats.unlockedAchievements,
    userStats.masteredConcepts
  );
  const stats = AchievementsService.getAchievementStats(userStats.unlockedAchievements);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return colors.muted;
      case "rare":
        return "#3b82f6";
      case "epic":
        return "#a855f7";
      case "legendary":
        return "#f59e0b";
      default:
        return colors.primary;
    }
  };

  const AchievementBadge = ({ achievement }: { achievement: (typeof ACHIEVEMENTS_CATALOG)[string] }) => {
    const rarityColor = getRarityColor(achievement.rarity);
    const points = AchievementsService.getAchievementPoints(achievement.rarity);

    return (
      <TouchableOpacity
        className="items-center gap-2"
        style={{ width: "33.33%" }}
      >
        <View
          className="w-16 h-16 rounded-full items-center justify-center border-2"
          style={{
            backgroundColor: rarityColor + "20",
            borderColor: rarityColor,
          }}
        >
          <MaterialIcons name={achievement.icon as any} size={32} color={rarityColor} />
        </View>
        <Text className="text-xs font-semibold text-foreground text-center">{achievement.title}</Text>
        <Text className="text-xs text-muted">+{points} pts</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView>
        {/* Header with Level */}
        <View
          className="p-6 rounded-b-3xl"
          style={{
            backgroundColor: colors.primary,
          }}
        >
          <View className="items-center gap-3">
            <View className="w-20 h-20 rounded-full items-center justify-center bg-white">
              <Text className="text-3xl font-bold" style={{ color: colors.primary }}>
                {userStats.level}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-white">Level {userStats.level}</Text>
            <Text className="text-sm text-white opacity-90">{userStats.totalPoints} Total Points</Text>

            {/* Level Progress */}
            <View className="w-full mt-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-xs text-white">Next Level</Text>
                <Text className="text-xs text-white">{userStats.nextLevelProgress}%</Text>
              </View>
              <View className="h-2 bg-white opacity-30 rounded-full overflow-hidden">
                <View
                  className="h-full bg-white"
                  style={{ width: `${userStats.nextLevelProgress}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Stats Overview */}
        <View className="p-4 flex-row gap-3 border-b" style={{ borderBottomColor: colors.border }}>
          <StatBox
            icon="local-fire-department"
            label="Streak"
            value={`${userStats.currentStreak}d`}
            color={colors.warning}
          />
          <StatBox
            icon="trending-up"
            label="Mastered"
            value={`${userStats.masteredConcepts}`}
            color={colors.success}
          />
          <StatBox
            icon="emoji-events"
            label="Achievements"
            value={`${stats.totalUnlocked}`}
            color={colors.primary}
          />
        </View>

        {/* Next Milestones */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-3">Next Milestones</Text>
          <View className="gap-3">
            {nextMilestones.map((milestone, idx) => (
              <View key={idx} className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1">
                    <MaterialIcons
                      name={milestone.achievement.icon as any}
                      size={20}
                      color={colors.primary}
                    />
                    <Text className="font-semibold text-foreground flex-1">
                      {milestone.achievement.title}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    {Math.round(milestone.progress)}%
                  </Text>
                </View>
                <View className="h-2 bg-surface rounded-full overflow-hidden">
                  <View
                    className="h-full"
                    style={{
                      width: `${milestone.progress}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Unlocked Achievements */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-4">Unlocked Achievements</Text>
          <View className="flex-row flex-wrap gap-4">
            {achievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} />
            ))}
          </View>
        </View>

        {/* Achievement Statistics */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-lg font-semibold text-foreground mb-3">By Rarity</Text>
          <View className="gap-2">
            {Object.entries(stats.byRarity).map(([rarity, count]) => (
              <View key={rarity} className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getRarityColor(rarity) }}
                  />
                  <Text className="text-sm text-foreground capitalize">{rarity}</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">{count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Locked Achievements Preview */}
        <View className="p-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Locked Achievements</Text>
          <View className="flex-row flex-wrap gap-4">
            {Object.values(ACHIEVEMENTS_CATALOG)
              .filter((a) => !userStats.unlockedAchievements.includes(a.id))
              .slice(0, 6)
              .map((achievement) => (
                <View
                  key={achievement.id}
                  className="items-center gap-2"
                  style={{ width: "33.33%" }}
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center border-2 opacity-40"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    }}
                  >
                    <MaterialIcons
                      name={achievement.icon as any}
                      size={32}
                      color={colors.muted}
                    />
                  </View>
                  <Text className="text-xs font-semibold text-muted text-center opacity-60">
                    {achievement.title}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      className="flex-1 rounded-lg p-3 items-center"
      style={{ backgroundColor: colors.surface }}
    >
      <MaterialIcons name={icon as any} size={24} color={color} />
      <Text className="text-xs text-muted mt-2">{label}</Text>
      <Text className="text-lg font-bold text-foreground mt-1">{value}</Text>
    </View>
  );
}
