/**
 * Teach-Back Screen
 * Implements Feynman Technique: Student explains concept in simple language
 * AI analyzes for accuracy, gaps, and misconceptions
 */

import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { AITutorService } from "@/lib/services/ai-tutor";
import { CONCEPT_MAP } from "@/lib/data/sample-concepts";
import * as Haptics from "expo-haptics";

interface AnalysisResult {
  accuracy: number;
  missingPoints: string[];
  misconceptions: string[];
  suggestions: string[];
  refinedExplanation: string;
}

export default function TeachBackScreen() {
  const colors = useColors();
  const { conceptId } = useLocalSearchParams<{ conceptId: string }>();
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const concept = conceptId ? CONCEPT_MAP[conceptId] : null;

  const handleSubmit = async () => {
    if (!explanation.trim() || !concept) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoading(true);
      setSubmitted(true);

      // TODO: Get actual mental model
      const mentalModel: any = {
        studentId: "user-123",
        learningStyle: "visual",
        communicationPreference: "encouraging",
        explanationDepth: "moderate",
        pacePreference: "moderate",
        knownConcepts: [],
        strugglingConcepts: [],
        motivationLevel: 75,
        confidenceLevel: 50,
        preferredExamples: [],
      };

      // Analyze explanation
      const result = await AITutorService.analyzeStudentExplanation(
        concept.id,
        explanation,
        concept,
        mentalModel as any
      );

      setAnalysis(result);
    } catch (error) {
      console.error("Error analyzing explanation:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExplanation("");
    setAnalysis(null);
    setSubmitted(false);
  };

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
          <Text className="text-2xl font-bold text-foreground">Teach-Back</Text>
          <Text className="text-sm text-muted mt-1">Feynman Technique: Explain Simply</Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
          {/* Concept Info */}
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted mb-1">Concept to Explain</Text>
            <Text className="text-lg font-bold text-foreground">{concept.name}</Text>
            <Text className="text-sm text-muted mt-2">{concept.description}</Text>
          </View>

          {/* Instructions */}
          <View
            className="rounded-2xl p-4 border-l-4"
            style={{
              backgroundColor: colors.surface,
              borderLeftColor: colors.primary,
            }}
          >
            <Text className="text-sm font-semibold text-foreground mb-2">📝 Instructions</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Explain {concept.name} as if teaching a 10-year-old. Use simple language and avoid jargon. Focus on the main ideas.
            </Text>
          </View>

          {/* Input Area */}
          {!submitted ? (
            <>
              <TextInput
                value={explanation}
                onChangeText={setExplanation}
                placeholder="Type your explanation here..."
                placeholderTextColor={colors.muted}
                className="rounded-xl p-4 text-base text-foreground"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  minHeight: 200,
                  textAlignVertical: "top",
                }}
                multiline
                editable={!loading}
                maxLength={2000}
              />
              <Text className="text-xs text-muted text-right">
                {explanation.length} / 2000 characters
              </Text>
            </>
          ) : (
            <>
              {/* Your Explanation */}
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-2">Your Explanation</Text>
                <Text className="text-base text-foreground leading-relaxed">{explanation}</Text>
              </View>

              {/* Analysis Results */}
              {analysis && (
                <>
                  {/* Accuracy Score */}
                  <View
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className="text-sm text-muted">Accuracy Score</Text>
                      <Text className="text-3xl font-bold text-primary">
                        {Math.round(analysis.accuracy)}%
                      </Text>
                    </View>
                    <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                      <View
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: colors.primary,
                          width: `${analysis.accuracy}%`,
                        }}
                      />
                    </View>
                  </View>

                  {/* Missing Points */}
                  {analysis.missingPoints.length > 0 && (
                    <View
                      className="rounded-2xl p-4 border-l-4"
                      style={{
                        backgroundColor: colors.surface,
                        borderLeftColor: colors.warning,
                      }}
                    >
                      <Text className="text-sm font-semibold text-foreground mb-2">
                        📌 Missing Key Points
                      </Text>
                      {analysis.missingPoints.map((point, idx) => (
                        <Text key={idx} className="text-sm text-muted mb-1">
                          • {point}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Misconceptions */}
                  {analysis.misconceptions.length > 0 && (
                    <View
                      className="rounded-2xl p-4 border-l-4"
                      style={{
                        backgroundColor: colors.surface,
                        borderLeftColor: colors.error,
                      }}
                    >
                      <Text className="text-sm font-semibold text-foreground mb-2">
                        ⚠️ Misconceptions Detected
                      </Text>
                      {analysis.misconceptions.map((misconception, idx) => (
                        <Text key={idx} className="text-sm text-muted mb-1">
                          • {misconception}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions.length > 0 && (
                    <View
                      className="rounded-2xl p-4 border-l-4"
                      style={{
                        backgroundColor: colors.surface,
                        borderLeftColor: colors.success,
                      }}
                    >
                      <Text className="text-sm font-semibold text-foreground mb-2">
                        💡 Suggestions for Improvement
                      </Text>
                      {analysis.suggestions.map((suggestion, idx) => (
                        <Text key={idx} className="text-sm text-muted mb-1">
                          • {suggestion}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Refined Explanation */}
                  <View
                    className="rounded-2xl p-4 border-l-4"
                    style={{
                      backgroundColor: colors.surface,
                      borderLeftColor: colors.primary,
                    }}
                  >
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      ✨ Refined Explanation
                    </Text>
                    <Text className="text-sm text-muted leading-relaxed">
                      {analysis.refinedExplanation}
                    </Text>
                  </View>
                </>
              )}

              {/* Loading */}
              {loading && (
                <View className="items-center gap-2">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-sm text-muted">Analyzing your explanation...</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View className="p-4 gap-3 border-t" style={{ borderTopColor: colors.border }}>
          {!submitted ? (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!explanation.trim() || loading}
              className="rounded-2xl p-3"
              style={{
                backgroundColor: explanation.trim() ? colors.primary : colors.border,
                opacity: explanation.trim() ? 1 : 0.5,
              }}
            >
              <Text className="text-center text-base font-semibold text-background">
                {loading ? "Analyzing..." : "Submit Explanation"}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleReset}
                className="rounded-2xl p-3"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center text-base font-semibold text-background">
                  Try Again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-2xl p-3 border-2"
                style={{ borderColor: colors.primary }}
              >
                <Text className="text-center text-base font-semibold" style={{ color: colors.primary }}>
                  Back to Home
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
