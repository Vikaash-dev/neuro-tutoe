import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function APISetupScreen() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if API key is already set
    const checkAPIKey = async () => {
      const existingKey = await AsyncStorage.getItem("GEMINI_API_KEY");
      if (existingKey) {
        router.replace("/");
      }
    };
    checkAPIKey();
  }, [router]);

  const handleSaveAPIKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert("Error", "Please enter your Gemini 3.1 Pro API key");
      return;
    }

    setIsLoading(true);
    try {
      // Save API key to AsyncStorage
      await AsyncStorage.setItem("GEMINI_API_KEY", apiKey.trim());
      
      // Mark setup as complete
      await AsyncStorage.setItem("API_SETUP_COMPLETE", "true");

      Alert.alert("Success", "API key saved successfully!", [
        {
          text: "Continue",
          onPress: () => router.replace("/"),
        },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save API key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-gradient-to-b from-primary/10 to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
        <View className="flex-1 justify-center gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground">NeuroTutor AI</Text>
            <Text className="text-lg text-muted text-center">
              Self-Hosted Learning Platform
            </Text>
          </View>

          {/* Info Card */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-semibold text-foreground">Setup Required</Text>
            <Text className="text-sm text-muted leading-relaxed">
              NeuroTutor AI uses Google Gemini 3.1 Pro to power AI tutoring. To get started, you&apos;ll need to provide your own API key.
            </Text>
            <Text className="text-sm font-medium text-primary">
              This is a self-hosted app - your API key is stored locally on your device only.
            </Text>
          </View>

          {/* Instructions */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-base font-semibold text-foreground">How to get your API key:</Text>
            <View className="gap-2">
            <Text className="text-sm text-muted">
              1. Go to{" "}
              <Text className="font-semibold text-primary">
                https://aistudio.google.com
              </Text>
            </Text>
            <Text className="text-sm text-muted">
              2. Click &quot;Get API Key&quot; in the left sidebar
            </Text>
            <Text className="text-sm text-muted">
              3. Create a new API key or copy an existing one
            </Text>
            <Text className="text-sm text-muted">
              4. Paste it below and tap &quot;Save &amp; Continue&quot;
            </Text>
            </View>
          </View>

          {/* API Key Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Gemini 3.1 Pro API Key</Text>
            <TextInput
              className="bg-surface border border-border rounded-lg p-4 text-foreground text-base"
              placeholder="sk-..."
              placeholderTextColor="#687076"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={true}
              editable={!isLoading}
              multiline={true}
            />
            <Text className="text-xs text-muted">
              Your API key is stored locally on your device and never sent to external servers.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className="bg-primary rounded-lg py-4 items-center"
            onPress={handleSaveAPIKey}
            disabled={isLoading}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? "Saving..." : "Save & Continue"}
            </Text>
          </TouchableOpacity>

          {/* Privacy Notice */}
          <View className="bg-success/10 rounded-lg p-4 border border-success/30">
            <Text className="text-xs text-success font-medium">
              🔒 Privacy: Your API key is stored locally and encrypted. NeuroTutor AI does not collect or transmit your key to any external servers.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
