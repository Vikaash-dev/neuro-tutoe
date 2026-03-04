/**
 * Topic Selection Screen
 * Browse and search learning topics by category with difficulty levels
 * Shows prerequisites and current mastery progress
 */

import { ScrollView, Text, View, TouchableOpacity, TextInput, FlatList } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LearningEngineService } from "@/lib/services/learning-engine";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  prerequisites: string[];
  estimatedTime: number; // in minutes
  masteryLevel?: "novice" | "intermediate" | "proficient" | "expert";
  isLocked?: boolean;
}

const TOPICS: Topic[] = [
  {
    id: "photosynthesis",
    title: "Photosynthesis",
    description: "How plants convert light into chemical energy",
    category: "Biology",
    difficulty: "beginner",
    prerequisites: [],
    estimatedTime: 45,
  },
  {
    id: "quantum-mechanics",
    title: "Quantum Mechanics",
    description: "Fundamental principles of quantum physics",
    category: "Physics",
    difficulty: "advanced",
    prerequisites: ["classical-mechanics"],
    estimatedTime: 120,
  },
  {
    id: "classical-mechanics",
    title: "Classical Mechanics",
    description: "Newton's laws and motion principles",
    category: "Physics",
    difficulty: "intermediate",
    prerequisites: [],
    estimatedTime: 90,
  },
  {
    id: "calculus-derivatives",
    title: "Calculus: Derivatives",
    description: "Rates of change and differentiation",
    category: "Mathematics",
    difficulty: "intermediate",
    prerequisites: ["algebra"],
    estimatedTime: 75,
  },
  {
    id: "algebra",
    title: "Algebra Fundamentals",
    description: "Variables, equations, and algebraic operations",
    category: "Mathematics",
    difficulty: "beginner",
    prerequisites: [],
    estimatedTime: 60,
  },
  {
    id: "dna-genetics",
    title: "DNA & Genetics",
    description: "Heredity, genes, and molecular biology",
    category: "Biology",
    difficulty: "intermediate",
    prerequisites: ["photosynthesis"],
    estimatedTime: 90,
  },
];

const CATEGORIES = ["All", "Biology", "Physics", "Mathematics", "Chemistry", "History"];

export default function TopicSelectionScreen() {
  const colors = useColors();
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [topics, setTopics] = useState<Topic[]>(TOPICS);
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>(TOPICS);

  useEffect(() => {
    filterTopics();
  }, [searchText, selectedCategory]);

  const filterTopics = () => {
    let filtered = topics;

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Filter by search text
    if (searchText.trim()) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchText.toLowerCase()) ||
          t.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredTopics(filtered);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return colors.success;
      case "intermediate":
        return colors.warning;
      case "advanced":
        return colors.error;
      case "expert":
        return colors.primary;
      default:
        return colors.muted;
    }
  };

  const handleTopicSelect = (topic: Topic) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/tutor-chat",
      params: { conceptId: topic.id },
    });
  };

  const renderTopicCard = ({ item }: { item: Topic }) => (
    <TouchableOpacity
      onPress={() => handleTopicSelect(item)}
      style={{ marginBottom: 12 }}
    >
      <View
        className="rounded-2xl p-4 border"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-lg font-semibold text-foreground">{item.title}</Text>
            <Text className="text-xs text-muted mt-1">{item.category}</Text>
          </View>
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: getDifficultyColor(item.difficulty) + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: getDifficultyColor(item.difficulty) }}
            >
              {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text className="text-sm text-muted leading-relaxed mb-3">{item.description}</Text>

        {/* Meta Info */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="schedule" size={16} color={colors.muted} />
            <Text className="text-xs text-muted">{item.estimatedTime} min</Text>
          </View>

          {item.masteryLevel && (
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="trending-up" size={16} color={colors.success} />
              <Text className="text-xs text-success font-semibold">
                {item.masteryLevel.charAt(0).toUpperCase() + item.masteryLevel.slice(1)}
              </Text>
            </View>
          )}

          {item.prerequisites.length > 0 && (
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="lock" size={14} color={colors.warning} />
              <Text className="text-xs text-warning">{item.prerequisites.length} req</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-0">
      {/* Header */}
      <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
        <Text className="text-2xl font-bold text-foreground mb-4">Explore Topics</Text>

        {/* Search Bar */}
        <View
          className="flex-row items-center rounded-lg px-3 py-2 border"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <MaterialIcons name="search" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search topics..."
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            className="flex-1 ml-2 text-foreground"
            style={{ fontSize: 14 }}
          />
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3 border-b"
        style={{ borderBottomColor: colors.border }}
        contentContainerStyle={{ gap: 8 }}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => setSelectedCategory(category)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor:
                selectedCategory === category ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: selectedCategory === category ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: selectedCategory === category ? "white" : colors.foreground,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Topics List */}
      <FlatList
        data={filteredTopics}
        renderItem={renderTopicCard}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={{ padding: 16, gap: 0 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <MaterialIcons name="search-off" size={48} color={colors.muted} />
            <Text className="text-muted mt-4 text-center">No topics found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
