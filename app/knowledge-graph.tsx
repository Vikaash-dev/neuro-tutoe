/**
 * Knowledge Graph Visualization Screen
 * Interactive visualization of concept relationships and dependencies
 * Shows prerequisites, related concepts, and skill transfer opportunities
 */

import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { DeepTutorIntegrationService } from "@/lib/services/deeptutor-integration";
import { CONCEPT_MAP } from "@/lib/data/sample-concepts";
import * as Haptics from "expo-haptics";

interface GraphNode {
  id: string;
  name: string;
  type: "current" | "prerequisite" | "related" | "advanced";
  mastery?: "novice" | "intermediate" | "proficient" | "expert";
}

interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
}

export default function KnowledgeGraphScreen() {
  const colors = useColors();
  const router = useRouter();
  const { conceptId } = useLocalSearchParams<{ conceptId: string }>();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  const concept = conceptId ? CONCEPT_MAP[conceptId] : null;

  useEffect(() => {
    loadGraphData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const loadGraphData = async () => {
    try {
      setLoading(true);

      if (!concept) return;

      // Get concept relationships from DeepTutor
      const relationships = await DeepTutorIntegrationService.getConceptRelationships(
        concept.name,
        concept.description
      );

      // Build nodes
      const graphNodes: GraphNode[] = [
        {
          id: concept.id,
          name: concept.name,
          type: "current",
          mastery: "intermediate",
        },
      ];

      // Add prerequisite nodes
      relationships.prerequisites.forEach((prereq) => {
        graphNodes.push({
          id: prereq.name.toLowerCase().replace(/\s+/g, "-"),
          name: prereq.name,
          type: "prerequisite",
        });
      });

      // Add related concept nodes
      relationships.relatedConcepts.forEach((related) => {
        graphNodes.push({
          id: related.name.toLowerCase().replace(/\s+/g, "-"),
          name: related.name,
          type: "related",
        });
      });

      // Add advanced topic nodes
      relationships.advancedTopics.forEach((advanced) => {
        graphNodes.push({
          id: advanced.name.toLowerCase().replace(/\s+/g, "-"),
          name: advanced.name,
          type: "advanced",
        });
      });

      setNodes(graphNodes);

      // Build edges
      const graphEdges: GraphEdge[] = [];

      relationships.prerequisites.forEach((prereq) => {
        graphEdges.push({
          from: prereq.name.toLowerCase().replace(/\s+/g, "-"),
          to: concept.id,
          relationship: prereq.relationship,
        });
      });

      relationships.relatedConcepts.forEach((related) => {
        graphEdges.push({
          from: concept.id,
          to: related.name.toLowerCase().replace(/\s+/g, "-"),
          relationship: related.relationship,
        });
      });

      relationships.advancedTopics.forEach((advanced) => {
        graphEdges.push({
          from: concept.id,
          to: advanced.name.toLowerCase().replace(/\s+/g, "-"),
          relationship: advanced.relationship,
        });
      });

      setEdges(graphEdges);
      setSelectedNode(graphNodes[0]);
    } catch (error) {
      console.error("Error loading graph data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (node: GraphNode) => {
    switch (node.type) {
      case "current":
        return colors.primary;
      case "prerequisite":
        return colors.warning;
      case "related":
        return colors.success;
      case "advanced":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  const getNodeLabel = (type: string) => {
    switch (type) {
      case "current":
        return "Current Topic";
      case "prerequisite":
        return "Prerequisite";
      case "related":
        return "Related Concept";
      case "advanced":
        return "Advanced Topic";
      default:
        return "Concept";
    }
  };

  const handleNodeTap = (node: GraphNode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNode(node);
  };

  const handleLearnConcept = (nodeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/tutor-chat",
      params: { conceptId: nodeId },
    });
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-lg text-muted">Loading knowledge graph...</Text>
      </ScreenContainer>
    );
  }

  if (!concept) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-lg text-muted">Concept not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background flex-1" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">Knowledge Graph</Text>
          <Text className="text-sm text-muted mt-1">{concept.name}</Text>
        </View>

        {/* Graph Legend */}
        <View className="px-4 py-3 gap-2">
          <View className="flex-row gap-2 flex-wrap">
            {[
              { type: "current", label: "Current" },
              { type: "prerequisite", label: "Prerequisite" },
              { type: "related", label: "Related" },
              { type: "advanced", label: "Advanced" },
            ].map((item) => (
              <View key={item.type} className="flex-row items-center gap-1">
                <View
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getNodeColor({
                      id: "",
                      name: "",
                      type: item.type as any,
                    }),
                  }}
                />
                <Text className="text-xs text-muted">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Graph Visualization (Simplified - Node List) */}
        <ScrollView className="flex-1 px-4 py-2" contentContainerStyle={{ gap: 8 }}>
          {nodes.map((node) => (
            <TouchableOpacity
              key={node.id}
              onPress={() => handleNodeTap(node)}
              className="rounded-xl p-3 border-2"
              style={{
                borderColor: selectedNode?.id === node.id ? colors.primary : getNodeColor(node),
                backgroundColor:
                  selectedNode?.id === node.id ? getNodeColor(node) + "20" : colors.surface,
              }}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{node.name}</Text>
                  <Text className="text-xs text-muted mt-1">{getNodeLabel(node.type)}</Text>
                </View>
                <View
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getNodeColor(node) }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selected Node Details */}
        {selectedNode && (
          <View className="border-t p-4" style={{ borderTopColor: colors.border }}>
            <View
              className="rounded-2xl p-4 gap-3"
              style={{ backgroundColor: colors.surface }}
            >
              <View>
                <Text className="text-sm text-muted mb-1">Selected Concept</Text>
                <Text className="text-lg font-bold text-foreground">{selectedNode.name}</Text>
                <Text className="text-xs text-muted mt-1">{getNodeLabel(selectedNode.type)}</Text>
              </View>

              {/* Related Edges */}
              {edges
                .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                .length > 0 && (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Connections</Text>
                  <View className="gap-1">
                    {edges
                      .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                      .map((edge, idx) => (
                        <Text key={idx} className="text-xs text-muted">
                          • {edge.relationship}
                        </Text>
                      ))}
                  </View>
                </View>
              )}

              {selectedNode.type !== "current" && (
                <TouchableOpacity
                  onPress={() => handleLearnConcept(selectedNode.id)}
                  className="rounded-lg p-2 mt-2"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-center text-sm font-semibold text-background">
                    Learn This Concept
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
