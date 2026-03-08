/**
 * Web Search Integration Service
 * Provides real-time web search capabilities for learning
 * Inspired by DeepTutor's web search integration
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore: number;
  timestamp: number;
}

export interface SearchCache {
  query: string;
  results: SearchResult[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Web Search Service
 * Handles web search queries and result caching
 */
export class WebSearchService {
  private cacheKey = "web_search_cache";
  private cache: Map<string, SearchCache> = new Map();
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.loadCache();
  }

  /**
   * Load cache from storage
   */
  private async loadCache(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("Failed to load search cache:", error);
    }
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      const data = Object.fromEntries(this.cache);
      await AsyncStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save search cache:", error);
    }
  }

  /**
   * Search the web for information
   * In production, integrate with real search APIs (Google, Bing, etc.)
   */
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    // Check cache first
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.results;
    }

    // Simulate web search with mock results
    // In production, call real search API
    const results = await this.mockWebSearch(query, maxResults);

    // Cache results
    this.cache.set(query, {
      query,
      results,
      timestamp: Date.now(),
      ttl: this.cacheTTL,
    });

    await this.saveCache();
    return results;
  }

  /**
   * Mock web search for development
   * In production, replace with real API calls
   */
  private async mockWebSearch(query: string, maxResults: number): Promise<SearchResult[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock results based on query
    const results: SearchResult[] = [];

    const mockData: Record<string, Array<{ title: string; snippet: string; url: string }>> = {
      photosynthesis: [
        {
          title: "Photosynthesis - Wikipedia",
          snippet:
            "Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy...",
          url: "https://en.wikipedia.org/wiki/Photosynthesis",
        },
        {
          title: "How Photosynthesis Works - Khan Academy",
          snippet:
            "Learn about the light-dependent and light-independent reactions of photosynthesis...",
          url: "https://www.khanacademy.org/science/biology/photosynthesis",
        },
        {
          title: "Photosynthesis: Definition, Process & Equation",
          snippet:
            "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy...",
          url: "https://www.britannica.com/science/photosynthesis",
        },
      ],
      "quantum mechanics": [
        {
          title: "Quantum Mechanics - Stanford Encyclopedia",
          snippet:
            "Quantum mechanics is the study of the behavior of matter and energy at the atomic and subatomic levels...",
          url: "https://plato.stanford.edu/entries/qt-quantummechanics/",
        },
        {
          title: "Introduction to Quantum Mechanics",
          snippet:
            "Quantum mechanics describes the behavior of atoms, electrons, and photons at the quantum scale...",
          url: "https://www.physics.org/article/quantum-mechanics",
        },
      ],
      "machine learning": [
        {
          title: "Machine Learning - Google AI",
          snippet:
            "Machine learning is a subset of artificial intelligence that enables systems to learn from data...",
          url: "https://ai.google/education/machine-learning/",
        },
        {
          title: "What is Machine Learning? - IBM",
          snippet:
            "Machine learning is a branch of artificial intelligence that focuses on building applications that learn from data...",
          url: "https://www.ibm.com/cloud/learn/machine-learning",
        },
        {
          title: "A Survey of Machine Learning Methods",
          snippet:
            "This paper provides a comprehensive survey of machine learning methods and their applications...",
          url: "https://arxiv.org/abs/2001.00001",
        },
      ],
    };

    const queryLower = query.toLowerCase();
    let data = mockData[queryLower] || [];

    // If no exact match, generate generic results
    if (data.length === 0) {
      data = [
        {
          title: `${query} - Overview`,
          snippet: `Learn more about ${query} and its applications in modern science and technology...`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        },
        {
          title: `${query} - Tutorial`,
          snippet: `A comprehensive guide to understanding ${query} with examples and explanations...`,
          url: `https://example.com/tutorial/${query.replace(/\s+/g, "-")}`,
        },
      ];
    }

    // Convert mock data to SearchResults
    for (let i = 0; i < Math.min(data.length, maxResults); i++) {
      const item = data[i];
      results.push({
        id: `result_${i}`,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: new URL(item.url).hostname,
        relevanceScore: 1 - i * 0.1, // Decrease score for lower ranked results
        timestamp: Date.now(),
      });
    }

    return results;
  }

  /**
   * Search with academic focus
   */
  async academicSearch(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    // In production, use Google Scholar API or similar
    const results = await this.search(query, maxResults);
    return results.filter((r) => this.isAcademicSource(r.source));
  }

  /**
   * Check if source is academic
   */
  private isAcademicSource(source: string): boolean {
    const academicDomains = [
      "scholar.google.com",
      "arxiv.org",
      "researchgate.net",
      "academia.edu",
      ".edu",
      "jstor.org",
      "sciencedirect.com",
    ];

    return academicDomains.some((domain) => source.includes(domain));
  }

  /**
   * Get cached results for a query
   */
  getCachedResults(query: string): SearchResult[] | null {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.results;
    }
    return null;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    await AsyncStorage.removeItem(this.cacheKey);
  }

  /**
   * Clear specific query from cache
   */
  async clearCacheEntry(query: string): Promise<void> {
    this.cache.delete(query);
    await this.saveCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Format search results for display
   */
  formatResults(results: SearchResult[]): string {
    return results
      .map(
        (r, i) =>
          `${i + 1}. **${r.title}**\n   Source: ${r.source}\n   ${r.snippet}\n   URL: ${r.url}`
      )
      .join("\n\n");
  }

  /**
   * Extract citations from search results
   */
  extractCitations(results: SearchResult[]): string[] {
    return results.map((r) => `${r.title} - ${r.source} (${r.url})`);
  }
}

// Export singleton instance
export const webSearch = new WebSearchService();
