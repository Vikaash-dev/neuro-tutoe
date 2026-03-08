/**
 * Local Storage Service
 * Persists all learning data locally using AsyncStorage
 * No cloud sync - everything stays on device
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoredConcept {
  id: string;
  name: string;
  description: string;
  category: string;
  depthLevel: number;
  masteryLevel: number;
  lastReviewed: number;
  nextReviewDate: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredQuizAttempt {
  id: string;
  conceptId: string;
  correct: boolean;
  responseTime: number;
  timestamp: number;
  confidence: number;
  questionType: string;
}

export interface StoredStudentProfile {
  name: string;
  learningStyle: string;
  preferredDepth: number;
  totalStudyTime: number;
  streak: number;
  lastStudyDate: number;
  createdAt: number;
}

const STORAGE_KEYS = {
  CONCEPTS: "neuro_concepts",
  QUIZ_ATTEMPTS: "neuro_quiz_attempts",
  STUDENT_PROFILE: "neuro_student_profile",
  LEARNING_SESSIONS: "neuro_learning_sessions",
  KNOWLEDGE_TRACE: "neuro_knowledge_trace",
};

export class LocalStorageService {
  /**
   * Save concept
   */
  static async saveConcept(concept: StoredConcept): Promise<void> {
    try {
      const concepts = await this.getAllConcepts();
      const index = concepts.findIndex((c) => c.id === concept.id);

      if (index >= 0) {
        concepts[index] = concept;
      } else {
        concepts.push(concept);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CONCEPTS, JSON.stringify(concepts));
    } catch (error) {
      console.error("Failed to save concept:", error);
      throw error;
    }
  }

  /**
   * Get all concepts
   */
  static async getAllConcepts(): Promise<StoredConcept[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONCEPTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get concepts:", error);
      return [];
    }
  }

  /**
   * Get concept by ID
   */
  static async getConcept(conceptId: string): Promise<StoredConcept | null> {
    try {
      const concepts = await this.getAllConcepts();
      return concepts.find((c) => c.id === conceptId) || null;
    } catch (error) {
      console.error("Failed to get concept:", error);
      return null;
    }
  }

  /**
   * Delete concept
   */
  static async deleteConcept(conceptId: string): Promise<void> {
    try {
      const concepts = await this.getAllConcepts();
      const filtered = concepts.filter((c) => c.id !== conceptId);
      await AsyncStorage.setItem(STORAGE_KEYS.CONCEPTS, JSON.stringify(filtered));
    } catch (error) {
      console.error("Failed to delete concept:", error);
      throw error;
    }
  }

  /**
   * Save quiz attempt
   */
  static async saveQuizAttempt(attempt: StoredQuizAttempt): Promise<void> {
    try {
      const attempts = await this.getAllQuizAttempts();
      attempts.push(attempt);
      await AsyncStorage.setItem(STORAGE_KEYS.QUIZ_ATTEMPTS, JSON.stringify(attempts));
    } catch (error) {
      console.error("Failed to save quiz attempt:", error);
      throw error;
    }
  }

  /**
   * Get all quiz attempts
   */
  static async getAllQuizAttempts(): Promise<StoredQuizAttempt[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QUIZ_ATTEMPTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get quiz attempts:", error);
      return [];
    }
  }

  /**
   * Get quiz attempts for concept
   */
  static async getQuizAttemptsForConcept(conceptId: string): Promise<StoredQuizAttempt[]> {
    try {
      const attempts = await this.getAllQuizAttempts();
      return attempts.filter((a) => a.conceptId === conceptId);
    } catch (error) {
      console.error("Failed to get quiz attempts:", error);
      return [];
    }
  }

  /**
   * Save student profile
   */
  static async saveStudentProfile(profile: StoredStudentProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error("Failed to save student profile:", error);
      throw error;
    }
  }

  /**
   * Get student profile
   */
  static async getStudentProfile(): Promise<StoredStudentProfile | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get student profile:", error);
      return null;
    }
  }

  /**
   * Get learning statistics
   */
  static async getLearningStats(): Promise<{
    totalConcepts: number;
    masteredConcepts: number;
    totalQuizAttempts: number;
    averageAccuracy: number;
    totalStudyTime: number;
    currentStreak: number;
  }> {
    try {
      const concepts = await this.getAllConcepts();
      const attempts = await this.getAllQuizAttempts();
      const profile = await this.getStudentProfile();

      const masteredConcepts = concepts.filter((c) => c.masteryLevel >= 0.85).length;
      const correctAttempts = attempts.filter((a) => a.correct).length;
      const averageAccuracy = attempts.length > 0 ? (correctAttempts / attempts.length) * 100 : 0;

      return {
        totalConcepts: concepts.length,
        masteredConcepts,
        totalQuizAttempts: attempts.length,
        averageAccuracy,
        totalStudyTime: profile?.totalStudyTime || 0,
        currentStreak: profile?.streak || 0,
      };
    } catch (error) {
      console.error("Failed to get learning stats:", error);
      return {
        totalConcepts: 0,
        masteredConcepts: 0,
        totalQuizAttempts: 0,
        averageAccuracy: 0,
        totalStudyTime: 0,
        currentStreak: 0,
      };
    }
  }

  /**
   * Export all data as JSON
   */
  static async exportAllData(): Promise<string> {
    try {
      const concepts = await this.getAllConcepts();
      const attempts = await this.getAllQuizAttempts();
      const profile = await this.getStudentProfile();

      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        concepts,
        quizAttempts: attempts,
        studentProfile: profile,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Failed to export data:", error);
      throw error;
    }
  }

  /**
   * Import data from JSON
   */
  static async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      if (data.concepts) {
        await AsyncStorage.setItem(STORAGE_KEYS.CONCEPTS, JSON.stringify(data.concepts));
      }

      if (data.quizAttempts) {
        await AsyncStorage.setItem(STORAGE_KEYS.QUIZ_ATTEMPTS, JSON.stringify(data.quizAttempts));
      }

      if (data.studentProfile) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.STUDENT_PROFILE,
          JSON.stringify(data.studentProfile)
        );
      }
    } catch (error) {
      console.error("Failed to import data:", error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error("Failed to clear data:", error);
      throw error;
    }
  }

  /**
   * Get storage usage (approximate)
   */
  static async getStorageUsage(): Promise<{
    conceptsSize: number;
    attemptsSize: number;
    profileSize: number;
    totalSize: number;
  }> {
    try {
      const concepts = await AsyncStorage.getItem(STORAGE_KEYS.CONCEPTS);
      const attempts = await AsyncStorage.getItem(STORAGE_KEYS.QUIZ_ATTEMPTS);
      const profile = await AsyncStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE);

      const conceptsSize = concepts ? new Blob([concepts]).size : 0;
      const attemptsSize = attempts ? new Blob([attempts]).size : 0;
      const profileSize = profile ? new Blob([profile]).size : 0;

      return {
        conceptsSize,
        attemptsSize,
        profileSize,
        totalSize: conceptsSize + attemptsSize + profileSize,
      };
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return {
        conceptsSize: 0,
        attemptsSize: 0,
        profileSize: 0,
        totalSize: 0,
      };
    }
  }
}
