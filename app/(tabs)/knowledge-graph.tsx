/**
 * Knowledge Graph Screen
 * Visualize concept relationships and learning connections
 */

import { ScrollView, Text, View, TouchableOpacity, Platform } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface ConceptNode {
  id: string;
  name: string;
  mastery: number;
  connections: string[];
}

export default function KnowledgeGraphScreen() {
  const colors = useColors();
  const router = useRouter();
  
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  
  const concepts: ConceptNode[] = [
    {
      id: "photosynthesis",
      name: "Photosynthesis",
      mastery: 85,
      connections: ["chloroplast", "light-reactions", "calvin-cycle"]
    },
    {
      id: "chloroplast",
      name: "Chloroplast",
      mastery: 70,
      connections: ["photosynthesis", "light-reactions"]
    },
    {
      id: "light-reactions",
      name: "Light Reactions",
      mastery: 60,
      connections: ["photosynthesis", "chloroplast", "atp-nadph"]
    },
    {
      id: "calvin-cycle",
      name: "Calvin Cycle",
      mastery: 75,
      connections: ["photosynthesis", "atp-nadph"]
    },
    {
      id: "atp-nadph",
      name: "ATP & NADPH",
      mastery: 65,
      connections: ["light-reactions", "calvin-cycle"]
    }
  ];

  const handleSelectConcept = (conceptId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedConcept(conceptId);
  };

  const handleStudyConcept = (conceptId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: "/(tabs)/quiz",
      params: { conceptId },
    });
  };

  const selectedConceptData = concepts.find(c => c.id === selectedConcept);

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Knowledge Graph</Text>
            <Text className="text-base text-muted">
              Explore concept relationships and dependencies
            </Text>
          </View>

          {/* Concept Network */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Concepts</Text>
            <View className="gap-2">
              {concepts.map((concept) => {
                const isSelected = selectedConcept === concept.id;
                const masteryColor = 
                  concept.mastery >= 80 ? colors.success :
                  concept.mastery >= 60 ? colors.primary :
                  colors.warning;

                return (
                  <TouchableOpacity
                    key={concept.id}
                    onPress={() => handleSelectConcept(concept.id)}
                    className="rounded-xl p-4 active:opacity-70 border"
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <View className="flex-row justify-between items-center gap-3">
                      <View className="flex-1">
                        <Text
                          className="text-base font-semibold mb-1"
                          style={{ color: isSelected ? "white" : colors.foreground }}
                        >
                          {concept.name}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <View
                            className="h-2 flex-1 rounded-full overflow-hidden"
                            style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : colors.border }}
                          >
                            <View
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: masteryColor,
                                width: `${concept.mastery}%`,
                              }}
                            />
                          </View>
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isSelected ? "white" : colors.muted }}
                          >
                            {concept.mastery}%
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Text className="text-xl">→</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Concept Details */}
          {selectedConceptData && (
            <View className="gap-4">
              <View
                className="rounded-2xl p-4 border"
                style={{ borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <Text className="text-lg font-semibold text-foreground mb-3">
                  {selectedConceptData.name} Details
                </Text>

                {/* Mastery Level */}
                <View className="gap-2 mb-4">
                  <Text className="text-sm text-muted">Mastery Level</Text>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                      <View
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: colors.primary,
                          width: `${selectedConceptData.mastery}%`,
                        }}
                      />
                    </View>
                    <Text className="text-lg font-bold text-primary">
                      {selectedConceptData.mastery}%
                    </Text>
                  </View>
                </View>

                {/* Related Concepts */}
                <View className="gap-2">
                  <Text className="text-sm text-muted mb-2">Related Concepts</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedConceptData.connections.map((connectionId) => {
                      const connectedConcept = concepts.find(c => c.id === connectionId);
                      return (
                        <View
                          key={connectionId}
                          className="rounded-full px-3 py-2"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Text className="text-xs font-semibold text-white">
                            {connectedConcept?.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Study Button */}
              <TouchableOpacity
                onPress={() => handleStudyConcept(selectedConceptData.id)}
                className="rounded-2xl p-4 active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center text-lg font-semibold text-background">
                  Study {selectedConceptData.name}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info Card */}
          <View
            className="rounded-2xl p-4 border"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Text className="text-sm font-semibold text-foreground mb-2">💡 About Knowledge Graphs</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Knowledge graphs show how concepts are interconnected. Mastering prerequisite concepts helps you understand advanced topics more easily.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
