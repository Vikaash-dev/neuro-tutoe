/**
 * AI Tutor Chat Screen
 * Interactive tutoring conversation with Gemini 3.1 Pro
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";
import GeminiService, { TUTORING_MODES } from "@/lib/services/gemini-service";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  timestamp: number;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

export default function TutorChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "👋 Welcome to NeuroTutor AI! I'm your AI tutor powered by Gemini 3.1 Pro. What would you like to learn about today?",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<keyof typeof TUTORING_MODES>("explainer");
  const [geminiService, setGeminiService] = useState<GeminiService | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);

  // Initialize Gemini service
  useEffect(() => {
    if (GEMINI_API_KEY) {
      const service = new GeminiService(GEMINI_API_KEY);
      setGeminiService(service);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !geminiService || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await geminiService.sendMessageWithContext(inputText, selectedMode);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        mode: selectedMode,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      className={cn(
        "mb-3 px-4 py-3 rounded-lg max-w-xs",
        item.role === "user"
          ? "bg-primary self-end ml-auto"
          : "bg-surface self-start mr-auto"
      )}
    >
      <Text
        className={cn(
          "text-base leading-relaxed",
          item.role === "user" ? "text-background" : "text-foreground"
        )}
      >
        {item.content}
      </Text>
      {item.mode && (
        <Text className="text-xs text-muted mt-1">
          Mode: {TUTORING_MODES[item.mode]?.name}
        </Text>
      )}
    </View>
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="border-b border-border pb-4 mb-4">
          <Text className="text-2xl font-bold text-foreground">🎓 AI Tutor Chat</Text>
          <Text className="text-sm text-muted mt-1">Powered by Gemini 3.1 Pro</Text>
        </View>

        {/* Tutoring Mode Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 -mx-4 px-4"
        >
          {Object.entries(TUTORING_MODES).map(([key, mode]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedMode(key as keyof typeof TUTORING_MODES)}
              className={cn(
                "px-4 py-2 rounded-full mr-2 border",
                selectedMode === key
                  ? "bg-primary border-primary"
                  : "bg-surface border-border"
              )}
            >
              <Text
                className={cn(
                  "text-sm font-semibold",
                  selectedMode === key ? "text-background" : "text-foreground"
                )}
              >
                {mode.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          className="flex-1 mb-4"
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Area */}
        <View className="border-t border-border pt-4 pb-4 px-4">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me anything..."
              placeholderTextColor={colors.muted}
              className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className={cn(
                "p-3 rounded-lg",
                isLoading || !inputText.trim() ? "bg-border" : "bg-primary"
              )}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text className="text-xl">📤</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-muted mt-2">
            {inputText.length}/500 characters
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
