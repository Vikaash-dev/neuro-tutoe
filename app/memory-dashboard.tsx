/**
 * Memory Dashboard Screen
 * Visualizes short-term and long-term memory states
 * Shows consolidation progress and spaced repetition schedule
 */

import { ScrollView, Text, View, TouchableOpacity, FlatList } from "react-native";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LearningEngineService } from "@/lib/services/learning-engine";
import { ConceptMemoryState } from "@/lib/types/learning";
import * as Haptics from "expo-haptics";

interface MemoryStats {
  stmConcepts: ConceptMemoryState[];
  ltmConcepts: ConceptMemoryState[];
  consolidationProgress: number;
  averageRetention: number;
  readyForReview: ConceptMemoryState[];
}

export default function MemoryDashboardScreen() {
  const colors = useColors();
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    stmConcepts: [],
    ltmConcepts: [],
    consolidationProgress: 0,
    averageRetention: 0,
    readyForReview: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"stm" | "ltm" | "ready">("stm");

  useEffect(() => {
    loadMemoryStats();
  }, []);

  const loadMemoryStats = async () => {
    try {
      setLoading(true);

      // Get all memory states
      const stmConcepts = await LearningEngineService.getConceptsInMemory("short_term");
      const ltmConcepts = await LearningEngineService.getConceptsInMemory("long_term");
      const readyForReview = await LearningEngineService.getConceptsReadyForReview();

      // Calculate stats
      const allConcepts = [...stmConcepts, ...ltmConcepts];
      const averageRetention =
        allConcepts.length > 0
          ? allConcepts.reduce((sum, c) => sum + c.retentionScore, 0) / allConcepts.length
          : 0;

      const consolidationProgress =
        allConcepts.length > 0
          ? allConcepts.reduce((sum, c) => sum + c.consolidationProgress, 0) / allConcepts.length
          : 0;

      setMemoryStats({
        stmConcepts,
        ltmConcepts,
        consolidationProgress,
        averageRetention,
        readyForReview,
      });
    } catch (error) {
      console.error("Error loading memory stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewConcept = (conceptId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to quiz screen
  };

  const renderConceptCard = (concept: ConceptMemoryState) => (
    <TouchableOpacity
      onPress={() => handleReviewConcept(concept.conceptId)}
      className="rounded-xl p-3 mb-2 border"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{concept.conceptId}</Text>
          <Text className="text-xs text-muted mt-1">
            Mastery: {concept.masteryLevel} • {concept.reviewCount} reviews
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-lg font-bold text-primary">{concept.retentionScore}%</Text>
          <Text className="text-xs text-muted">retention</Text>
        </View>
      </View>

      {/* Retention Progress Bar */}
      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
        <View
          className="h-full rounded-full"
          style={{
            backgroundColor: colors.success,
            width: `${concept.retentionScore}%`,
          }}
        />
      </View>

      {/* Next Review Date */}
      <Text className="text-xs text-muted mt-2">
        Next review: {new Date(concept.nextReviewDate).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="bg-background flex-1" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Memory Dashboard</Text>
          <Text className="text-sm text-muted mt-1">Track your learning consolidation</Text>
        </View>

        {/* Memory Stats */}
        <View className="px-4 py-4 gap-3">
          {/* Overall Stats */}
          <View className="flex-row gap-3">
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-xs text-muted mb-1">Avg Retention</Text>
              <Text className="text-2xl font-bold text-primary">
                {Math.round(memoryStats.averageRetention)}%
              </Text>
            </View>
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-xs text-muted mb-1">Consolidation</Text>
              <Text className="text-2xl font-bold text-success">
                {Math.round(memoryStats.consolidationProgress)}%
              </Text>
            </View>
          </View>

          {/* Consolidation Timeline */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm font-semibold text-foreground mb-3">
              STM → LTM Consolidation
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: colors.primary,
                    width: `${memoryStats.consolidationProgress}%`,
                  }}
                />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {Math.round(memoryStats.consolidationProgress)}%
              </Text>
            </View>
            <Text className="text-xs text-muted mt-2">
              Knowledge moves from short-term to long-term memory through spaced repetition
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row border-b px-4" style={{ borderBottomColor: colors.border }}>
          {[
            { id: "stm", label: `STM (${memoryStats.stmConcepts.length})` },
            { id: "ltm", label: `LTM (${memoryStats.ltmConcepts.length})` },
            { id: "ready", label: `Ready (${memoryStats.readyForReview.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setSelectedTab(tab.id as any)}
              className="flex-1 py-3 border-b-2"
              style={{
                borderBottomColor:
                  selectedTab === tab.id ? colors.primary : "transparent",
              }}
            >
              <Text
                className="text-center text-sm font-semibold"
                style={{
                  color: selectedTab === tab.id ? colors.primary : colors.muted,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ gap: 2 }}>
          {selectedTab === "stm" &&
            (memoryStats.stmConcepts.length > 0 ? (
              <>
                <Text className="text-sm text-muted mb-2">
                  Concepts learned recently. Review within 1 day to consolidate.
                </Text>
                {memoryStats.stmConcepts.map((concept) =>
                  renderConceptCard(concept)
                )}
              </>
            ) : (
              <Text className="text-center text-muted mt-8">No concepts in short-term memory</Text>
            ))}

          {selectedTab === "ltm" &&
            (memoryStats.ltmConcepts.length > 0 ? (
              <>
                <Text className="text-sm text-muted mb-2">
                  Consolidated knowledge. Review periodically to maintain mastery.
                </Text>
                {memoryStats.ltmConcepts.map((concept) =>
                  renderConceptCard(concept)
                )}
              </>
            ) : (
              <Text className="text-center text-muted mt-8">No concepts in long-term memory</Text>
            ))}

          {selectedTab === "ready" &&
            (memoryStats.readyForReview.length > 0 ? (
              <>
                <Text className="text-sm text-muted mb-2">
                  Concepts scheduled for review today. Tap to take a quiz.
                </Text>
                {memoryStats.readyForReview.map((concept) =>
                  renderConceptCard(concept)
                )}
              </>
            ) : (
              <Text className="text-center text-muted mt-8">No concepts ready for review</Text>
            ))}
        </ScrollView>

        {/* Info Card */}
        <View className="px-4 py-3 border-t" style={{ borderTopColor: colors.border }}>
          <View
            className="rounded-xl p-3 border-l-4"
            style={{
              backgroundColor: colors.surface,
              borderLeftColor: colors.primary,
            }}
          >
            <Text className="text-xs font-semibold text-foreground mb-1">💡 Memory Tip</Text>
            <Text className="text-xs text-muted leading-relaxed">
              Regular spaced repetition strengthens neural pathways. Review concepts at optimal intervals for maximum retention.
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
