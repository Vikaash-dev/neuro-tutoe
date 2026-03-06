/**
 * AI Tutor Chat Screen
 * Main learning interface using Feynman Technique and adaptive teaching
 * Implements DeepTutor's multi-agent problem solving
 */

import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Platform } from "react-native";
import { useEffect, useState, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { AITutorService } from "@/lib/services/ai-tutor";
import { LearningEngineService } from "@/lib/services/learning-engine";
import { CONCEPT_MAP } from "@/lib/data/sample-concepts";
import { StudentMentalModel } from "@/lib/types/learning";
import * as Haptics from "expo-haptics";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  type?: "explanation" | "question" | "feedback" | "misconception";
}

export default function TutorChatScreen() {
  const colors = useColors();
  const { conceptId } = useLocalSearchParams<{ conceptId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mentalModel, setMentalModel] = useState<StudentMentalModel | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const concept = conceptId ? CONCEPT_MAP[conceptId] : null;

  useEffect(() => {
    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const initializeChat = async () => {
    try {
      // Load student mental model
      const model = await LearningEngineService.getMentalModel("user-123"); // TODO: Use actual user ID
      setMentalModel(model);

      // Generate initial explanation using Feynman Technique
      if (concept) {
        setLoading(true);
        const explanation = await AITutorService.generateSimpleExplanation(
          concept,
          model
        );

        const initialMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: explanation.simpleExplanation,
          timestamp: Date.now(),
          type: "explanation",
        };

        setMessages([initialMessage]);
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !concept || !mentalModel) return;

    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setLoading(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: inputText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");

      // Get adaptive AI response
      const aiResponse = await AITutorService.getAdaptiveTutorResponse(
        inputText,
        concept.id,
        concept.name,
        mentalModel,
        messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      );

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: aiResponse.explanation,
        timestamp: Date.now(),
        type: "explanation",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTeachBack = async () => {
    // Navigate to teach-back screen
    // TODO: Implement navigation
  };

  const handleTakeQuiz = async () => {
    // Navigate to quiz screen
    // TODO: Implement navigation
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
        <View className="border-b p-4" style={{ borderColor: colors.border }}>
          <Text className="text-2xl font-bold text-foreground">{concept.name}</Text>
          <Text className="text-sm text-muted mt-1">{concept.difficulty} level</Text>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 p-4"
          contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              className={`flex-row ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <View
                className={`max-w-[85%] rounded-2xl p-3 ${
                  message.role === "user"
                    ? "bg-primary"
                    : "border"
                }`}
                style={
                  message.role === "assistant"
                    ? { borderColor: colors.border, backgroundColor: colors.surface }
                    : { backgroundColor: colors.primary }
                }
              >
                <Text
                  className={`text-base leading-relaxed ${
                    message.role === "user" ? "text-background" : "text-foreground"
                  }`}
                >
                  {message.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View className="flex-row justify-start">
              <View
                className="rounded-2xl p-3 flex-row gap-2 items-center"
                style={{ backgroundColor: colors.surface }}
              >
                <ActivityIndicator color={colors.primary} size="small" />
                <Text className="text-sm text-muted">NeuroTutor is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View className="flex-row gap-2 px-4 py-3" style={{ borderTopColor: colors.border, borderTopWidth: 1 }}>
          <TouchableOpacity
            onPress={handleTeachBack}
            className="flex-1 rounded-lg p-2"
            style={{ borderColor: colors.primary, borderWidth: 1 }}
          >
            <Text className="text-center text-sm font-semibold" style={{ color: colors.primary }}>📝 Teach Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleTakeQuiz}
            className="flex-1 rounded-lg p-2"
            style={{ borderColor: colors.primary, borderWidth: 1 }}
          >
            <Text className="text-center text-sm font-semibold" style={{ color: colors.primary }}>📊 Quiz</Text>
          </TouchableOpacity>
        </View>

        {/* Input Area */}
        <View className="flex-row gap-2 p-4" style={{ borderTopColor: colors.border, borderTopWidth: 1 }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question or explain the concept..."
            placeholderTextColor={colors.muted}
            className="flex-1 rounded-full px-4 py-2 text-base text-foreground"
            style={{ backgroundColor: colors.surface }}
            editable={!loading}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || loading}
            className="rounded-full p-3 items-center justify-center"
            style={{ backgroundColor: colors.primary, opacity: !inputText.trim() || loading ? 0.5 : 1 }}
          >
            <Text className="text-lg">→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
