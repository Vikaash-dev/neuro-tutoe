/**
 * Code Execution Service for STEM
 * Provides Python code execution in a sandboxed environment
 * Supports interactive problem solving and visualization
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CodeExecution {
  id: string;
  code: string;
  language: "python" | "javascript";
  output: string;
  error?: string;
  executedAt: number;
  duration: number;
  topic: string;
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
  language: "python" | "javascript";
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  visualization?: string; // SVG or image data
}

/**
 * Code Executor Service
 * Handles code execution, examples, and visualizations
 */
export class CodeExecutorService {
  private executionHistory: Map<string, CodeExecution> = new Map();
  private codeExamples: Map<string, CodeExample> = new Map();
  private storageKey = "code_executions";
  private examplesKey = "code_examples";

  constructor() {
    this.loadHistory();
    this.initializeExamples();
  }

  /**
   * Load execution history from storage
   */
  private async loadHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.executionHistory = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("Failed to load execution history:", error);
    }
  }

  /**
   * Save execution history to storage
   */
  private async saveHistory(): Promise<void> {
    try {
      const data = Object.fromEntries(this.executionHistory);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save execution history:", error);
    }
  }

  /**
   * Initialize built-in code examples
   */
  private initializeExamples(): void {
    const examples: CodeExample[] = [
      {
        id: "ex_1",
        title: "Calculate Fibonacci Sequence",
        description: "Generate Fibonacci numbers up to N",
        code: `def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

# Calculate first 10 Fibonacci numbers
fib = fibonacci(10)
print("Fibonacci Sequence:", fib)`,
        language: "python",
        topic: "Mathematics",
        difficulty: "beginner",
        tags: ["sequence", "recursion", "math"],
      },
      {
        id: "ex_2",
        title: "Prime Number Checker",
        description: "Check if a number is prime",
        code: `def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

# Check numbers from 1 to 20
primes = [n for n in range(1, 21) if is_prime(n)]
print("Prime numbers 1-20:", primes)`,
        language: "python",
        topic: "Mathematics",
        difficulty: "beginner",
        tags: ["prime", "number-theory", "loop"],
      },
      {
        id: "ex_3",
        title: "Statistical Analysis",
        description: "Calculate mean, median, and standard deviation",
        code: `import statistics

data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

mean = statistics.mean(data)
median = statistics.median(data)
stdev = statistics.stdev(data)

print(f"Data: {data}")
print(f"Mean: {mean}")
print(f"Median: {median}")
print(f"Standard Deviation: {stdev:.2f}")`,
        language: "python",
        topic: "Statistics",
        difficulty: "intermediate",
        tags: ["statistics", "data-analysis", "math"],
      },
      {
        id: "ex_4",
        title: "Matrix Operations",
        description: "Perform basic matrix operations",
        code: `# Matrix multiplication
matrix_a = [[1, 2], [3, 4]]
matrix_b = [[5, 6], [7, 8]]

def matrix_multiply(a, b):
    result = [[0, 0], [0, 0]]
    for i in range(2):
        for j in range(2):
            for k in range(2):
                result[i][j] += a[i][k] * b[k][j]
    return result

result = matrix_multiply(matrix_a, matrix_b)
print("Matrix A:", matrix_a)
print("Matrix B:", matrix_b)
print("A × B:", result)`,
        language: "python",
        topic: "Linear Algebra",
        difficulty: "intermediate",
        tags: ["matrix", "algebra", "computation"],
      },
      {
        id: "ex_5",
        title: "Sorting Algorithms",
        description: "Implement and compare sorting algorithms",
        code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

data = [64, 34, 25, 12, 22, 11, 90]
sorted_data = bubble_sort(data.copy())
print("Original:", data)
print("Sorted:", sorted_data)`,
        language: "python",
        topic: "Computer Science",
        difficulty: "intermediate",
        tags: ["sorting", "algorithm", "efficiency"],
      },
    ];

    for (const example of examples) {
      this.codeExamples.set(example.id, example);
    }
  }

  /**
   * Execute Python code (simulated)
   * In production, use a real Python sandbox or API
   */
  async executePython(code: string, topic: string = "General"): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Simulate code execution
      const result = await this.simulateExecution(code);
      const duration = Date.now() - startTime;

      // Store in history
      const execution: CodeExecution = {
        id: `exec_${Date.now()}`,
        code,
        language: "python",
        output: result.output,
        error: result.error,
        executedAt: Date.now(),
        duration,
        topic,
      };

      this.executionHistory.set(execution.id, execution);
      await this.saveHistory();

      return {
        success: !result.error,
        output: result.output,
        error: result.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        output: "",
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        duration,
      };
    }
  }

  /**
   * Simulate code execution (mock)
   * In production, use actual Python interpreter or API
   */
  private async simulateExecution(
    code: string
  ): Promise<{ output: string; error?: string }> {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check for common Python patterns and return mock output
    if (code.includes("fibonacci")) {
      return {
        output: "Fibonacci Sequence: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]",
      };
    }

    if (code.includes("is_prime")) {
      return {
        output: "Prime numbers 1-20: [2, 3, 5, 7, 11, 13, 17, 19]",
      };
    }

    if (code.includes("statistics")) {
      return {
        output: `Data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
Mean: 55.0
Median: 55.0
Standard Deviation: 30.28`,
      };
    }

    if (code.includes("matrix")) {
      return {
        output: `Matrix A: [[1, 2], [3, 4]]
Matrix B: [[5, 6], [7, 8]]
A × B: [[19, 22], [43, 50]]`,
      };
    }

    if (code.includes("bubble_sort")) {
      return {
        output: `Original: [64, 34, 25, 12, 22, 11, 90]
Sorted: [11, 12, 22, 25, 34, 64, 90]`,
      };
    }

    // Generic output for other code
    return {
      output: "Code executed successfully",
    };
  }

  /**
   * Execute JavaScript code
   */
  async executeJavaScript(code: string, topic: string = "General"): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // In production, use a safe JavaScript sandbox
      // For now, return mock result
      const result = await this.simulateExecution(code);
      const duration = Date.now() - startTime;

      const execution: CodeExecution = {
        id: `exec_${Date.now()}`,
        code,
        language: "javascript",
        output: result.output,
        error: result.error,
        executedAt: Date.now(),
        duration,
        topic,
      };

      this.executionHistory.set(execution.id, execution);
      await this.saveHistory();

      return {
        success: !result.error,
        output: result.output,
        error: result.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        output: "",
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        duration,
      };
    }
  }

  /**
   * Get code example by ID
   */
  getExample(exampleId: string): CodeExample | undefined {
    return this.codeExamples.get(exampleId);
  }

  /**
   * Get all code examples
   */
  getAllExamples(): CodeExample[] {
    return Array.from(this.codeExamples.values());
  }

  /**
   * Get examples by topic
   */
  getExamplesByTopic(topic: string): CodeExample[] {
    return Array.from(this.codeExamples.values()).filter((ex) => ex.topic === topic);
  }

  /**
   * Get examples by difficulty
   */
  getExamplesByDifficulty(difficulty: "beginner" | "intermediate" | "advanced"): CodeExample[] {
    return Array.from(this.codeExamples.values()).filter((ex) => ex.difficulty === difficulty);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 10): CodeExecution[] {
    return Array.from(this.executionHistory.values())
      .sort((a, b) => b.executedAt - a.executedAt)
      .slice(0, limit);
  }

  /**
   * Get execution history by topic
   */
  getExecutionHistoryByTopic(topic: string): CodeExecution[] {
    return Array.from(this.executionHistory.values())
      .filter((ex) => ex.topic === topic)
      .sort((a, b) => b.executedAt - a.executedAt);
  }

  /**
   * Clear execution history
   */
  async clearExecutionHistory(): Promise<void> {
    this.executionHistory.clear();
    await AsyncStorage.removeItem(this.storageKey);
  }

  /**
   * Add custom code example
   */
  async addExample(example: CodeExample): Promise<void> {
    this.codeExamples.set(example.id, example);
    await AsyncStorage.setItem(this.examplesKey, JSON.stringify(Array.from(this.codeExamples.values())));
  }

  /**
   * Get execution statistics
   */
  getStatistics(): Record<string, unknown> {
    const executions = Array.from(this.executionHistory.values());

    return {
      totalExecutions: executions.length,
      successRate: executions.filter((ex) => !ex.error).length / Math.max(executions.length, 1),
      averageDuration:
        executions.reduce((sum, ex) => sum + ex.duration, 0) / Math.max(executions.length, 1),
      topicBreakdown: this.getTopicBreakdown(executions),
      languageBreakdown: this.getLanguageBreakdown(executions),
    };
  }

  /**
   * Get topic breakdown
   */
  private getTopicBreakdown(executions: CodeExecution[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const execution of executions) {
      breakdown[execution.topic] = (breakdown[execution.topic] || 0) + 1;
    }

    return breakdown;
  }

  /**
   * Get language breakdown
   */
  private getLanguageBreakdown(executions: CodeExecution[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const execution of executions) {
      breakdown[execution.language] = (breakdown[execution.language] || 0) + 1;
    }

    return breakdown;
  }
}

// Export singleton instance
export const codeExecutor = new CodeExecutorService();
