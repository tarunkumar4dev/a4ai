// src/utils/testGeneratorService.ts - ENHANCED VERSION
import { TestBlueprint, GeneratedTest, GenerationStatus, TestGenerationError } from '../types/testgen';

export class EnhancedTestGenerator {
  private static baseURL = '/functions/v1';

  static async generateTest(blueprint: TestBlueprint): Promise<GeneratedTest> {
    try {
      const response = await fetch(`${this.baseURL}/generate-test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}` 
        },
        body: JSON.stringify({
          ...blueprint,
          // Ensure required fields
          userId: blueprint.userId || 'default-user',
          requestId: blueprint.requestId || this.generateRequestId(),
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      return result.data;

    } catch (error) {
      console.error('Test generation failed:', error);
      throw this.normalizeError(error);
    }
  }

  static async scoreQuestions(questions: any[], blueprint: TestBlueprint) {
    try {
      const response = await fetch(`${this.baseURL}/score-questions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}` 
        },
        body: JSON.stringify({ 
          questions, 
          blueprint,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();

    } catch (error) {
      console.error('Question scoring failed:', error);
      throw this.normalizeError(error);
    }
  }

  static async regenerateSimilar(question: any, keepFields: string[] = ['cognitive', 'difficulty', 'marks']) {
    try {
      const response = await fetch(`${this.baseURL}/regenerate-similar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}` 
        },
        body: JSON.stringify({ 
          question, 
          keepFields,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      const result = await response.json();
      return result.data || result;

    } catch (error) {
      console.error('Question regeneration failed:', error);
      throw this.normalizeError(error);
    }
  }

  // NEW: Get generation status
  static async getGenerationStatus(testId: string): Promise<GenerationStatus> {
    try {
      const response = await fetch(`${this.baseURL}/generation-status/${testId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

      return await response.json();

    } catch (error) {
      console.error('Status check failed:', error);
      throw this.normalizeError(error);
    }
  }

  // NEW: Cancel generation
  static async cancelGeneration(testId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/cancel-generation/${testId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw await this.handleError(response);
      }

    } catch (error) {
      console.error('Cancel generation failed:', error);
      throw this.normalizeError(error);
    }
  }

  // NEW: Validate blueprint before generation
  static validateBlueprint(blueprint: TestBlueprint): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!blueprint.subject) errors.push('Subject is required');
    if (!blueprint.classNum) errors.push('Class number is required');
    if (!blueprint.board) errors.push('Board is required');
    if (!blueprint.userId) errors.push('User ID is required');
    
    if (!blueprint.buckets || blueprint.buckets.length === 0) {
      errors.push('At least one question bucket is required');
    } else {
      blueprint.buckets.forEach((bucket, index) => {
        if (bucket.count <= 0) errors.push(`Bucket ${index + 1}: Count must be positive`);
        if (bucket.marks <= 0) errors.push(`Bucket ${index + 1}: Marks must be positive`);
        if (!bucket.chapters || bucket.chapters.length === 0) {
          errors.push(`Bucket ${index + 1}: At least one chapter is required`);
        }
      });
    }

    if (blueprint.cognitiveLevels.length === 0) {
      errors.push('At least one cognitive level is required');
    }

    if (blueprint.ncertWeight < 0 || blueprint.ncertWeight > 1) {
      errors.push('NCERT weight must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // NEW: Calculate estimated time
  static estimateGenerationTime(blueprint: TestBlueprint): number {
    const totalQuestions = blueprint.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    // Base time + per question time
    return 5000 + (totalQuestions * 2000); // milliseconds
  }

  // Utility methods
  private static getAuthToken(): string {
    // Implementation depends on your auth system
    return localStorage.getItem('auth_token') || '';
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async handleError(response: Response): Promise<Error> {
    try {
      const errorData = await response.json();
      return new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    } catch {
      return new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private static normalizeError(error: any): TestGenerationError {
    if (error instanceof Error) {
      return {
        code: 'GENERATION_ERROR',
        message: error.message,
        suggestion: 'Please check your blueprint and try again'
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      suggestion: 'Please try again later'
    };
  }
}

// NEW: Custom hook for React components (agar aap React use kar rahe hain)
export const useTestGeneration = () => {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [error, setError] = useState<TestGenerationError | null>(null);
  const [result, setResult] = useState<GeneratedTest | null>(null);

  const generateTest = async (blueprint: TestBlueprint) => {
    setStatus({ status: 'pending', progress: 0 });
    setError(null);
    
    try {
      // Validate first
      const validation = EnhancedTestGenerator.validateBlueprint(blueprint);
      if (!validation.isValid) {
        throw {
          code: 'VALIDATION_ERROR',
          message: 'Invalid blueprint',
          details: validation.errors
        };
      }

      setStatus({ status: 'processing', progress: 30 });
      
      const test = await EnhancedTestGenerator.generateTest(blueprint);
      setResult(test);
      setStatus({ status: 'completed', progress: 100 });

      return test;

    } catch (err) {
      const normalizedError = EnhancedTestGenerator.normalizeError(err);
      setError(normalizedError);
      setStatus({ status: 'failed', progress: 0 });
      throw normalizedError;
    }
  };

  return {
    generateTest,
    status,
    error,
    result,
    isGenerating: status?.status === 'processing',
    isCompleted: status?.status === 'completed',
    isFailed: status?.status === 'failed'
  };
};