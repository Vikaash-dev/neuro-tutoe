/**
 * Learning tRPC Routes
 * API endpoints for managing learning data, memory states, and user progress
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import * as learningDb from "./learning-db";

export const learningRouter = router({
  /**
   * Get user's memory states for all concepts
   */
  getMemoryStates: protectedProcedure.query(async ({ ctx }) => {
    try {
      const states = await learningDb.getUserMemoryStates(ctx.user.id);
      return states || [];
    } catch (error) {
      console.error("Error fetching memory states:", error);
      return [];
    }
  }),

  /**
   * Get specific memory state for a concept
   */
  getMemoryState: protectedProcedure
    .input(z.object({ conceptId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const state = await learningDb.getUserMemoryState(ctx.user.id, input.conceptId);
        return state;
      } catch (error) {
        console.error("Error fetching memory state:", error);
        return null;
      }
    }),

  /**
   * Update memory state after quiz attempt
   */
  updateMemoryState: protectedProcedure
    .input(
      z.object({
        conceptId: z.string(),
        retentionScore: z.number().min(0).max(100),
        masteryLevel: z.enum(["novice", "intermediate", "proficient", "expert"]),
        consolidationProgress: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await learningDb.updateUserMemoryState(ctx.user.id, input.conceptId, {
          retentionScore: input.retentionScore,
          masteryLevel: input.masteryLevel,
          consolidationProgress: input.consolidationProgress,
          lastReviewDate: new Date(),
        });
        return { success: true };
      } catch (error) {
        console.error("Error updating memory state:", error);
        throw error;
      }
    }),

  /**
   * Record quiz attempt
   */
  recordQuizAttempt: protectedProcedure
    .input(
      z.object({
        conceptId: z.string(),
        questionId: z.string(),
        userAnswer: z.string(),
        isCorrect: z.boolean(),
        timeSpent: z.number(),
        confidence: z.number().min(1).max(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const id = await learningDb.createQuizAttempt({
          userId: ctx.user.id,
          conceptId: input.conceptId,
          questionId: input.questionId,
          userAnswer: input.userAnswer,
          isCorrect: input.isCorrect,
          timeSpent: input.timeSpent,
          confidence: input.confidence,
        });
        return { success: true, id };
      } catch (error) {
        console.error("Error recording quiz attempt:", error);
        throw error;
      }
    }),

  /**
   * Get quiz history for a concept
   */
  getQuizHistory: protectedProcedure
    .input(z.object({ conceptId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const history = await learningDb.getUserQuizAttempts(ctx.user.id, input.conceptId);
        return history || [];
      } catch (error) {
        console.error("Error fetching quiz history:", error);
        return [];
      }
    }),

  /**
   * Record learning session
   */
  recordLearningSession: protectedProcedure
    .input(
      z.object({
        conceptId: z.string(),
        sessionType: z.enum(["tutor_chat", "quiz", "teach_back", "review"]),
        duration: z.number(),
        performance: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const id = await learningDb.createLearningSession({
          userId: ctx.user.id,
          conceptId: input.conceptId,
          sessionType: input.sessionType,
          duration: input.duration,
          performance: input.performance,
        });
        return { success: true, id };
      } catch (error) {
        console.error("Error recording learning session:", error);
        throw error;
      }
    }),

  /**
   * Get user's learning statistics
   */
  getLearningStatistics: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stats = await learningDb.getUserLearningStatistics(ctx.user.id);
      return (
        stats || {
          userId: ctx.user.id,
          totalConceptsLearned: 0,
          masteredConcepts: 0,
          currentStreak: 0,
          totalStudyTime: 0,
          averageMastery: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching learning statistics:", error);
      return null;
    }
  }),

  /**
   * Update user mental model (learning preferences)
   */
  updateMentalModel: protectedProcedure
    .input(
      z.object({
        learningStyle: z.enum(["visual", "verbal", "kinesthetic", "reading_writing"]),
        depthLevel: z.enum(["beginner", "intermediate", "advanced"]),
        communicationPreference: z.enum(["formal", "casual", "socratic"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await learningDb.updateUserMentalModel(ctx.user.id, {
          learningStyle: input.learningStyle,
          depthLevel: input.depthLevel,
          communicationPreference: input.communicationPreference,
        });
        return { success: true };
      } catch (error) {
        console.error("Error updating mental model:", error);
        throw error;
      }
    }),

  /**
   * Get user mental model
   */
  getMentalModel: protectedProcedure.query(async ({ ctx }) => {
    try {
      const model = await learningDb.getUserMentalModel(ctx.user.id);
      return model;
    } catch (error) {
      console.error("Error fetching mental model:", error);
      return null;
    }
  }),

  /**
   * Get learning sessions for analytics
   */
  getLearningHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      const sessions = await learningDb.getUserLearningSessions(ctx.user.id);
      return sessions || [];
    } catch (error) {
      console.error("Error fetching learning history:", error);
      return [];
    }
  }),

  /**
   * Sync learning data (for offline-first support)
   */
  syncLearningData: protectedProcedure
    .input(
      z.object({
        memoryStates: z.array(z.any()).optional(),
        quizAttempts: z.array(z.any()).optional(),
        sessions: z.array(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // TODO: Implement batch sync logic
        return { success: true, synced: 0 };
      } catch (error) {
        console.error("Error syncing learning data:", error);
        throw error;
      }
    }),
});
