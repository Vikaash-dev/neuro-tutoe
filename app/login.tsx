/**
 * Login Screen
 * Manus OAuth authentication for NeuroTutor AI
 */

import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to home
    if (isAuthenticated && user) {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoggingIn(true);
    try {
      // Redirect to OAuth login
      const redirectUrl = Linking.createURL("/oauth/callback");
      const oauthUrl = `https://auth.manus.im/oauth/authorize?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      await Linking.openURL(oauthUrl);
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-between p-6">
          {/* Top Section - Logo and Branding */}
          <View className="items-center pt-12">
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <MaterialIcons name="psychology" size={56} color={colors.primary} />
            </View>
            <Text className="text-4xl font-bold text-foreground mb-2">NeuroTutor</Text>
            <Text className="text-lg text-muted text-center">
              Learn with Feynman Technique & Neuroscience
            </Text>
          </View>

          {/* Middle Section - Features */}
          <View className="gap-6 my-12">
            <FeatureItem
              icon="psychology"
              title="Neuroscience-Backed"
              description="Spaced repetition, active recall, and memory consolidation"
              color={colors.primary}
            />
            <FeatureItem
              icon="school"
              title="Feynman Technique"
              description="Break concepts into simplest components for deep understanding"
              color={colors.success}
            />
            <FeatureItem
              icon="trending-up"
              title="Adaptive Learning"
              description="Personalized paths based on your learning style and pace"
              color={colors.warning}
            />
            <FeatureItem
              icon="cloud-sync"
              title="Cloud Sync"
              description="Continue learning on any device with your progress synced"
              color={colors.primary}
            />
          </View>

          {/* Bottom Section - Login Button */}
          <View className="gap-4 pb-6">
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoggingIn}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 12,
                opacity: isLoggingIn ? 0.7 : 1,
              }}
            >
              {isLoggingIn ? (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-semibold text-base">Signing in...</Text>
                </View>
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <MaterialIcons name="login" size={20} color="white" />
                  <Text className="text-white font-semibold text-base">Sign in with Manus</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text className="text-xs text-muted text-center">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function FeatureItem({
  icon,
  title,
  description,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <View className="flex-row gap-3">
      <View
        className="w-12 h-12 rounded-lg items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + "20" }}
      >
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted mt-1">{description}</Text>
      </View>
    </View>
  );
}
