/**
 * Document Upload Screen
 *
 * Lets the user upload PDF, TXT, or paste text into the RAG knowledge base.
 * The document is sent to the server where it is chunked and embedded with
 * Gemini text-embedding-004.  Once ingested, every tutor conversation
 * automatically retrieves relevant chunks as context.
 */

import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: Array<{ id: string; title: string; uploadedAt: number; type: string }>;
  createdAt: number;
}

export default function DocumentUploadScreen() {
  const colors = useColors();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingKBs, setLoadingKBs] = useState(true);
  const [kbs, setKBs] = useState<KnowledgeBase[]>([]);
  const [activeTab, setActiveTab] = useState<"paste" | "browse">("paste");

  useEffect(() => {
    loadKBs();
  }, []);

  const getHeaders = async (): Promise<Record<string, string>> => {
    const key = (await AsyncStorage.getItem("GEMINI_API_KEY")) ?? "";
    return {
      "Content-Type": "application/json",
      ...(key ? { "x-gemini-api-key": key } : {}),
    };
  };

  const loadKBs = async () => {
    try {
      setLoadingKBs(true);
      const res = await fetch(`${API_BASE}/api/rag/kb`, {
        headers: await getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setKBs(Array.isArray(data) ? data : []);
      }
    } catch {
      // Server might not be running yet
    } finally {
      setLoadingKBs(false);
    }
  };

  const handleUpload = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Please paste some document content first.");
      return;
    }

    try {
      setLoading(true);
      const headers = await getHeaders();

      const res = await fetch(`${API_BASE}/api/rag/upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim() || "Untitled Document",
          content: content.trim(),
          source: "manual paste",
          type: "txt",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }

      Alert.alert(
        "✅ Document Uploaded",
        "Your document has been embedded and added to the knowledge base. Future tutor conversations will use it as context.",
        [
          {
            text: "Upload Another",
            onPress: () => {
              setTitle("");
              setContent("");
            },
          },
          {
            text: "Done",
            onPress: () => {
              loadKBs();
              setActiveTab("browse");
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert("Upload Failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKB = async (kbId: string) => {
    Alert.alert("Delete Knowledge Base", "Are you sure? This will remove all documents.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const headers = await getHeaders();
            await fetch(`${API_BASE}/api/rag/kb/${kbId}`, { method: "DELETE", headers });
            loadKBs();
          } catch {
            Alert.alert("Error", "Could not delete knowledge base");
          }
        },
      },
    ]);
  };

  const totalDocs = kbs.reduce((acc, kb) => acc + (kb.documents?.length ?? 0), 0);

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">📄 Document RAG</Text>
              <Text className="text-sm text-muted">Upload docs · AI learns from your content</Text>
            </View>
          </View>
        </View>

        {/* Stats bar */}
        <View className="mx-4 mt-2 mb-4 rounded-xl p-3 flex-row gap-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-primary">{kbs.length}</Text>
            <Text className="text-xs text-muted">Collections</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-primary">{totalDocs}</Text>
            <Text className="text-xs text-muted">Documents</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-success">768</Text>
            <Text className="text-xs text-muted">Embed dims</Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row mx-4 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: colors.border }}>
          {(["paste", "browse"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-2 items-center"
              style={{ backgroundColor: activeTab === tab ? colors.primary : colors.surface }}
            >
              <Text style={{ color: activeTab === tab ? "white" : colors.muted, fontWeight: "600", fontSize: 13 }}>
                {tab === "paste" ? "📋 Upload Text" : `📚 Browse (${totalDocs})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upload tab */}
        {activeTab === "paste" && (
          <View className="px-4 gap-4">
            <View className="rounded-xl p-4 border gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-base font-semibold text-foreground">📌 How it works</Text>
              <Text className="text-sm text-muted leading-relaxed">
                1. Paste your document text (PDF content, notes, lecture slides…){"\n"}
                2. Tap Upload — the server embeds it with Gemini text-embedding-004{"\n"}
                3. Every tutor chat will automatically retrieve relevant chunks as context
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">Document Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Quantum Mechanics Lecture 3"
                placeholderTextColor={colors.muted}
                className="rounded-lg px-4 py-3 text-foreground border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              />
            </View>

            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">Document Content</Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Paste your document text here…&#10;&#10;Tip: Copy-paste from a PDF, Word doc, or your notes."
                placeholderTextColor={colors.muted}
                className="rounded-lg px-4 py-3 text-foreground border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border, minHeight: 200, textAlignVertical: "top" }}
                multiline
                numberOfLines={10}
              />
              {content.length > 0 && (
                <Text className="text-xs text-muted">{content.length.toLocaleString()} characters · ~{Math.ceil(content.length / 500)} chunks</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleUpload}
              disabled={loading || !content.trim()}
              className="rounded-xl py-4 items-center flex-row justify-center gap-2"
              style={{ backgroundColor: loading || !content.trim() ? colors.muted : colors.primary, opacity: loading || !content.trim() ? 0.6 : 1 }}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white font-semibold">Embedding with Gemini…</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="upload" size={18} color="white" />
                  <Text className="text-white font-semibold text-base">Upload & Embed Document</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Browse tab */}
        {activeTab === "browse" && (
          <View className="px-4 gap-3">
            {loadingKBs ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : kbs.length === 0 ? (
              <View className="items-center py-12 gap-3">
                <MaterialIcons name="library-books" size={48} color={colors.muted} />
                <Text className="text-muted text-center text-base">No documents yet</Text>
                <Text className="text-muted text-center text-sm">Upload a document to get started</Text>
                <TouchableOpacity onPress={() => setActiveTab("paste")} className="mt-2 rounded-lg px-6 py-2" style={{ backgroundColor: colors.primary }}>
                  <Text className="text-white font-semibold">Upload Document</Text>
                </TouchableOpacity>
              </View>
            ) : (
              kbs.map((kb) => (
                <View key={kb.id} className="rounded-xl border p-4 gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">{kb.name}</Text>
                      {kb.description ? <Text className="text-xs text-muted mt-0.5">{kb.description}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteKB(kb.id)} className="p-1">
                      <MaterialIcons name="delete-outline" size={20} color={colors.error ?? "#ef4444"} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row gap-2 flex-wrap">
                    {(kb.documents ?? []).map((doc) => (
                      <View key={doc.id} className="rounded-lg px-3 py-1.5 flex-row items-center gap-1" style={{ backgroundColor: colors.primary + "18" }}>
                        <MaterialIcons name="description" size={12} color={colors.primary} />
                        <Text className="text-xs font-medium" style={{ color: colors.primary }} numberOfLines={1}>
                          {doc.title}
                        </Text>
                      </View>
                    ))}
                    {(kb.documents ?? []).length === 0 && (
                      <Text className="text-xs text-muted italic">Empty collection</Text>
                    )}
                  </View>
                </View>
              ))
            )}

            {kbs.length > 0 && (
              <TouchableOpacity onPress={loadKBs} className="items-center py-2">
                <Text className="text-sm" style={{ color: colors.primary }}>↻ Refresh</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
