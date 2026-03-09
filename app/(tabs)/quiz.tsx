/**
 * Quiz Screen / Active Recall
 * Interactive quiz with spaced repetition and adaptive difficulty
 */

import { ScrollView, Text, View, TouchableOpacity, Platform } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: number;
}

export default function QuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const { conceptId } = useLocalSearchParams<{ conceptId: string }>();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  
  const [questions] = useState<QuizQuestion[]>([
    {
      id: "q1",
      question: "What is the primary function of photosynthesis?",
      options: [
        "To break down glucose for energy",
        "To convert light energy into chemical energy",
        "To produce oxygen only",
        "To absorb water from soil"
      ],
      correctAnswer: 1,
      explanation: "Photosynthesis converts light energy into chemical energy stored in glucose molecules.",
      difficulty: 2
    },
    {
      id: "q2",
      question: "Which organelle is responsible for photosynthesis?",
      options: [
        "Mitochondria",
        "Nucleus",
        "Chloroplast",
        "Ribosome"
      ],
      correctAnswer: 2,
      explanation: "Chloroplasts contain chlorophyll and are the site of photosynthesis in plant cells.",
      difficulty: 1
    },
    {
      id: "q3",
      question: "What are the two main stages of photosynthesis?",
      options: [
        "Glycolysis and Krebs cycle",
        "Light-dependent and light-independent reactions",
        "Oxidation and reduction",
        "Anabolism and catabolism"
      ],
      correctAnswer: 1,
      explanation: "Photosynthesis consists of light-dependent reactions (in thylakoids) and light-independent reactions (Calvin cycle).",
      difficulty: 3
    }
  ]);

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswerCorrect = selectedAnswer === currentQuestion.correctAnswer;

  const handleSelectAnswer = (index: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    if (index === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizComplete(true);
    }
  };

  const handleReturnHome = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/");
  };

  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <ScreenContainer className="p-6">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="flex-1 justify-center items-center gap-6">
            {/* Score Circle */}
            <View
              className="w-40 h-40 rounded-full items-center justify-center"
              style={{ backgroundColor: percentage >= 70 ? colors.success : colors.warning }}
            >
              <Text className="text-5xl font-bold text-white">{percentage}%</Text>
              <Text className="text-lg text-white mt-2">Score</Text>
            </View>

            {/* Results Summary */}
            <View className="w-full gap-3">
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-1">Correct Answers</Text>
                <Text className="text-3xl font-bold text-success">
                  {score}/{questions.length}
                </Text>
              </View>

              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-2">Performance</Text>
                <Text className="text-base text-foreground">
                  {percentage >= 80 ? "🌟 Excellent! You've mastered this concept." : 
                   percentage >= 70 ? "✅ Good job! Review the tricky areas." :
                   "📚 Keep practicing! More review needed."}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="w-full gap-3 mt-6">
              <TouchableOpacity
                onPress={handleReturnHome}
                className="rounded-2xl p-4 active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center text-lg font-semibold text-background">
                  Return to Home
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6">
          {/* Progress Bar */}
          <View className="gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-foreground">
                Question {currentQuestionIndex + 1}/{questions.length}
              </Text>
              <Text className="text-sm text-muted">
                Score: {score}
              </Text>
            </View>
            <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: colors.primary,
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </View>
          </View>

          {/* Question */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">
              {currentQuestion.question}
            </Text>

            {/* Answer Options */}
            <View className="gap-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctAnswer;
                
                let backgroundColor = colors.surface;
                if (isSelected && showExplanation) {
                  backgroundColor = isCorrect ? colors.success : colors.error;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => !showExplanation && handleSelectAnswer(index)}
                    disabled={showExplanation}
                    className="rounded-xl p-4 active:opacity-70"
                    style={{ backgroundColor }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: isSelected && showExplanation 
                            ? "rgba(255,255,255,0.3)" 
                            : colors.border,
                        }}
                      >
                        <Text className="text-sm font-semibold text-foreground">
                          {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <Text className="flex-1 text-base text-foreground">
                        {option}
                      </Text>
                      {isSelected && showExplanation && (
                        <Text className="text-lg">
                          {isCorrect ? "✓" : "✗"}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Explanation */}
            {showExplanation && (
              <View
                className="rounded-xl p-4 border"
                style={{ borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-semibold text-foreground mb-2">
                  {isAnswerCorrect ? "✓ Correct!" : "✗ Incorrect"}
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  {currentQuestion.explanation}
                </Text>
              </View>
            )}
          </View>

          {/* Next Button */}
          {showExplanation && (
            <TouchableOpacity
              onPress={handleNextQuestion}
              className="rounded-2xl p-4 active:opacity-80 mt-auto"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center text-lg font-semibold text-background">
                {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Complete Quiz"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
