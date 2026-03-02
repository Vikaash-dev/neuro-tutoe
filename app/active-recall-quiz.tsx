/**
 * Active Recall Quiz Screen
 * Implements spaced repetition with DeepTutor's QuestionGen for adaptive assessment
 * Triggers pop-up quizzes on decaying concepts using forgetting curve algorithm
 */

import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { DeepTutorIntegrationService } from "@/lib/services/deeptutor-integration";
import { LearningEngineService } from "@/lib/services/learning-engine";
import { QuizQuestion, ConceptMemoryState } from "@/lib/types/learning";
import * as Haptics from "expo-haptics";

interface QuizState {
  currentQuestionIndex: number;
  score: number;
  answers: Record<number, string>;
  timeSpent: Record<number, number>;
  confidenceLevels: Record<number, number>;
  startTime: number;
}

export default function ActiveRecallQuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const { conceptIds } = useLocalSearchParams<{ conceptIds: string }>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    score: 0,
    answers: {},
    timeSpent: {},
    confidenceLevels: {},
    startTime: Date.now(),
  });
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState("");

  const conceptIdArray = conceptIds ? conceptIds.split(",") : [];

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptIds]);

  const loadQuestions = async () => {
    try {
      setLoading(true);

      // Get memory states for all concepts
      const memoryStates: Record<string, ConceptMemoryState> = {};
      for (const id of conceptIdArray) {
        const state = await LearningEngineService.getMemoryState(id);
        if (state) memoryStates[id] = state;
      }

      // Generate adaptive questions using DeepTutor's QuestionGen
      // Prioritizes concepts with high decay (low retention)
      const generatedQuestions = await DeepTutorIntegrationService.generateAdaptiveQuestions(
        conceptIdArray,
        memoryStates,
        "medium",
        5
      );

      setQuestions(generatedQuestions);
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[quizState.currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (!showFeedback) {
      setSelectedAnswer(answer);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const correct = selectedAnswer === currentQuestion.correctAnswer;
      const timeSpent = Date.now() - quizState.startTime;

      setIsCorrect(correct);
      setFeedback(currentQuestion.explanation);
      setShowFeedback(true);

      // Update state
      setQuizState((prev) => ({
        ...prev,
        score: prev.score + (correct ? 1 : 0),
        answers: { ...prev.answers, [prev.currentQuestionIndex]: selectedAnswer },
        timeSpent: { ...prev.timeSpent, [prev.currentQuestionIndex]: timeSpent },
      }));

      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
    }
  };

  const handleNextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));
      setSelectedAnswer("");
      setShowFeedback(false);
      setFeedback("");
    } else {
      handleQuizComplete();
    }
  };

  const handleQuizComplete = async () => {
    try {
      // Calculate final score
      const finalScore = (quizState.score / questions.length) * 100;

      // Update memory states for each concept based on performance
      for (const conceptId of conceptIdArray) {
        const state = await LearningEngineService.getMemoryState(conceptId);
        if (state) {
          // Quality score: 5 = excellent, 3 = good, 1 = poor

          await LearningEngineService.processQuizAttempt(
            conceptId,
            {
              id: `attempt_${Date.now()}`,
              questionId: currentQuestion?.id || "",
              userAnswer: quizState.answers[quizState.currentQuestionIndex] || "",
              isCorrect: finalScore >= 80,
              timeSpent: Object.values(quizState.timeSpent).reduce((a, b) => a + b, 0),
              confidence: 3,
              feedback: `Quiz completed with ${finalScore.toFixed(0)}% accuracy`,
              conceptId,
              timestamp: Date.now(),
            },
            state
          );
        }
      }

      // Navigate to results screen
      router.push({
        pathname: "/quiz-results",
        params: {
          score: finalScore.toFixed(0),
          totalQuestions: questions.length,
          correctAnswers: quizState.score,
        },
      });
    } catch (error) {
      console.error("Error completing quiz:", error);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-lg text-muted mt-4">Generating adaptive questions...</Text>
      </ScreenContainer>
    );
  }

  if (questions.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-lg text-muted">No questions available</Text>
      </ScreenContainer>
    );
  }

  const progress = ((quizState.currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <ScreenContainer className="bg-background flex-1" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-foreground">Active Recall Quiz</Text>
            <Text className="text-sm text-muted">
              {quizState.currentQuestionIndex + 1} / {questions.length}
            </Text>
          </View>
          <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
            <View
              className="h-full rounded-full"
              style={{
                backgroundColor: colors.primary,
                width: `${progress}%`,
              }}
            />
          </View>
        </View>

        {/* Question */}
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
          {/* Question Text */}
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted mb-2">Question {quizState.currentQuestionIndex + 1}</Text>
            <Text className="text-lg font-semibold text-foreground leading-relaxed">
              {currentQuestion.question}
            </Text>
          </View>

          {/* Answer Options */}
          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <View className="gap-2">
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAnswerSelect(option)}
                  disabled={showFeedback}
                  className="rounded-xl p-3 border-2"
                  style={{
                    borderColor:
                      selectedAnswer === option
                        ? colors.primary
                        : showFeedback && option === currentQuestion.correctAnswer
                        ? colors.success
                        : showFeedback && option === selectedAnswer && !isCorrect
                        ? colors.error
                        : colors.border,
                    backgroundColor:
                      selectedAnswer === option
                        ? colors.primary + "20"
                        : showFeedback && option === currentQuestion.correctAnswer
                        ? colors.success + "20"
                        : showFeedback && option === selectedAnswer && !isCorrect
                        ? colors.error + "20"
                        : colors.surface,
                  }}
                >
                  <Text
                    className="text-base font-medium"
                    style={{
                      color:
                        selectedAnswer === option
                          ? colors.primary
                          : showFeedback && option === currentQuestion.correctAnswer
                          ? colors.success
                          : showFeedback && option === selectedAnswer && !isCorrect
                          ? colors.error
                          : colors.foreground,
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Feedback */}
          {showFeedback && (
            <View
              className="rounded-2xl p-4 border-l-4"
              style={{
                backgroundColor: colors.surface,
                borderLeftColor: isCorrect ? colors.success : colors.error,
              }}
            >
              <Text className="text-sm font-semibold text-foreground mb-2">
                {isCorrect ? "✓ Correct!" : "✗ Not quite right"}
              </Text>
              <Text className="text-sm text-muted leading-relaxed">{feedback}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View className="p-4 gap-3 border-t" style={{ borderTopColor: colors.border }}>
          {!showFeedback ? (
            <TouchableOpacity
              onPress={handleSubmitAnswer}
              disabled={!selectedAnswer}
              className="rounded-xl p-3"
              style={{
                backgroundColor: selectedAnswer ? colors.primary : colors.border,
                opacity: selectedAnswer ? 1 : 0.5,
              }}
            >
              <Text className="text-center text-base font-semibold text-background">
                Check Answer
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleNextQuestion}
              className="rounded-xl p-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center text-base font-semibold text-background">
                {quizState.currentQuestionIndex === questions.length - 1
                  ? "Complete Quiz"
                  : "Next Question"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
