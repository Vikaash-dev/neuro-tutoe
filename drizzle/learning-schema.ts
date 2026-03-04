/**
 * Learning Data Schema for NeuroTutor AI
 * Extends the base schema with tables for learning concepts, memory states, and user progress
 */

import {
  int,
  mysqlTable,
  text,
  varchar,
  timestamp,
  decimal,
  json,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

/**
 * Learning Concepts Table
 * Stores all learning topics and concepts available in the app
 */
export const learningConcepts = mysqlTable("learning_concepts", {
  id: int("id").autoincrement().primaryKey(),
  conceptId: varchar("conceptId", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced", "expert"])
    .notNull()
    .default("beginner"),
  prerequisites: json("prerequisites").$type<string[]>().default([]),
  estimatedTime: int("estimatedTime").notNull(), // in minutes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * User Memory States Table
 * Tracks short-term and long-term memory for each user-concept pair
 */
export const userMemoryStates = mysqlTable("user_memory_states", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conceptId: varchar("conceptId", { length: 255 }).notNull(),
  memoryType: mysqlEnum("memoryType", ["short_term", "long_term"]).notNull(),
  retentionScore: decimal("retentionScore", { precision: 5, scale: 2 }).notNull().default("0"),
  masteryLevel: mysqlEnum("masteryLevel", ["novice", "intermediate", "proficient", "expert"])
    .notNull()
    .default("novice"),
  consolidationProgress: decimal("consolidationProgress", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  lastReviewDate: timestamp("lastReviewDate"),
  nextReviewDate: timestamp("nextReviewDate"),
  reviewCount: int("reviewCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Quiz Attempts Table
 * Stores all quiz attempts and performance data
 */
export const quizAttempts = mysqlTable("quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conceptId: varchar("conceptId", { length: 255 }).notNull(),
  questionId: varchar("questionId", { length: 255 }).notNull(),
  userAnswer: text("userAnswer").notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  timeSpent: int("timeSpent").notNull(), // in seconds
  confidence: int("confidence").notNull(), // 1-5 scale
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Learning Sessions Table
 * Tracks study sessions and learning activity
 */
export const learningSessions = mysqlTable("learning_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conceptId: varchar("conceptId", { length: 255 }).notNull(),
  sessionType: mysqlEnum("sessionType", ["tutor_chat", "quiz", "teach_back", "review"])
    .notNull(),
  duration: int("duration").notNull(), // in seconds
  performance: decimal("performance", { precision: 5, scale: 2 }), // 0-100 score
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * User Mental Models Table
 * Stores Theory of Mind data about student learning preferences
 */
export const userMentalModels = mysqlTable("user_mental_models", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  learningStyle: mysqlEnum("learningStyle", [
    "visual",
    "verbal",
    "kinesthetic",
    "reading_writing",
  ]).notNull(),
  depthLevel: mysqlEnum("depthLevel", ["beginner", "intermediate", "advanced"]).notNull(),
  communicationPreference: mysqlEnum("communicationPreference", [
    "formal",
    "casual",
    "socratic",
  ]).notNull(),
  knownConcepts: json("knownConcepts").$type<string[]>().default([]),
  misconceptions: json("misconceptions").$type<Record<string, string>>().default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Knowledge Graph Relationships Table
 * Stores concept relationships for the knowledge graph
 */
export const knowledgeGraphRelationships = mysqlTable("knowledge_graph_relationships", {
  id: int("id").autoincrement().primaryKey(),
  fromConceptId: varchar("fromConceptId", { length: 255 }).notNull(),
  toConceptId: varchar("toConceptId", { length: 255 }).notNull(),
  relationshipType: mysqlEnum("relationshipType", [
    "prerequisite",
    "related",
    "advanced",
    "application",
  ]).notNull(),
  strength: decimal("strength", { precision: 3, scale: 2 }).notNull().default("1"), // 0-1 scale
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Learning Statistics Table
 * Aggregated statistics for user progress tracking
 */
export const learningStatistics = mysqlTable("learning_statistics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalConceptsLearned: int("totalConceptsLearned").notNull().default(0),
  masteredConcepts: int("masteredConcepts").notNull().default(0),
  currentStreak: int("currentStreak").notNull().default(0),
  totalStudyTime: int("totalStudyTime").notNull().default(0), // in seconds
  averageMastery: decimal("averageMastery", { precision: 5, scale: 2 }).notNull().default("0"),
  lastActivityDate: timestamp("lastActivityDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Export types
export type LearningConcept = typeof learningConcepts.$inferSelect;
export type InsertLearningConcept = typeof learningConcepts.$inferInsert;

export type UserMemoryState = typeof userMemoryStates.$inferSelect;
export type InsertUserMemoryState = typeof userMemoryStates.$inferInsert;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

export type LearningSession = typeof learningSessions.$inferSelect;
export type InsertLearningSession = typeof learningSessions.$inferInsert;

export type UserMentalModel = typeof userMentalModels.$inferSelect;
export type InsertUserMentalModel = typeof userMentalModels.$inferInsert;

export type KnowledgeGraphRelationship = typeof knowledgeGraphRelationships.$inferSelect;
export type InsertKnowledgeGraphRelationship = typeof knowledgeGraphRelationships.$inferInsert;

export type LearningStatistic = typeof learningStatistics.$inferSelect;
export type InsertLearningStatistic = typeof learningStatistics.$inferInsert;
