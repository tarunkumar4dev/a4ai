// utils/deduplicator.ts - ENHANCED VERSION

export interface DeduplicationConfig {
  similarityThreshold: number;
  checkCognitiveLevel: boolean;
  checkTopics: boolean;
  checkConcepts: boolean;
  enableSemanticCheck: boolean;
}

export class DeduplicationService {
  private similarityThreshold: number;
  private checkCognitiveLevel: boolean;
  private checkTopics: boolean;
  private checkConcepts: boolean;
  
  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.similarityThreshold = config.similarityThreshold ?? 0.85;
    this.checkCognitiveLevel = config.checkCognitiveLevel ?? true;
    this.checkTopics = config.checkTopics ?? true;
    this.checkConcepts = config.checkConcepts ?? true;
  }
  
  async findDuplicates(questions: any[]): Promise<Map<string, string[]>> {
    const duplicates = new Map<string, string[]>();
    
    for (let i = 0; i < questions.length; i++) {
      const q1 = questions[i];
      const similar: string[] = [];
      
      for (let j = i + 1; j < questions.length; j++) {
        const q2 = questions[j];
        const similarity = await this.calculateSimilarity(q1, q2);
        
        if (similarity >= this.similarityThreshold) {
          similar.push(q2.id || `question_${j}`);
        }
      }
      
      if (similar.length > 0) {
        duplicates.set(q1.id || `question_${i}`, similar);
      }
    }
    
    return duplicates;
  }
  
  private async calculateSimilarity(q1: any, q2: any): Promise<number> {
    let similarity = 0;
    let factorCount = 0;
    
    // 1. Text similarity (existing)
    const textSimilarity = this.calculateTextSimilarity(
      q1.text || q1.stem || '',
      q2.text || q2.stem || ''
    );
    similarity += textSimilarity * 0.4;
    factorCount += 0.4;
    
    // 2. Type and marks similarity
    const structuralSimilarity = this.calculateStructuralSimilarity(q1, q2);
    similarity += structuralSimilarity * 0.2;
    factorCount += 0.2;
    
    // 3. NEW: Cognitive level similarity
    if (this.checkCognitiveLevel) {
      const cognitiveSimilarity = this.calculateCognitiveSimilarity(q1, q2);
      similarity += cognitiveSimilarity * 0.15;
      factorCount += 0.15;
    }
    
    // 4. NEW: Topic/concept similarity
    if (this.checkTopics) {
      const topicSimilarity = this.calculateTopicSimilarity(q1, q2);
      similarity += topicSimilarity * 0.15;
      factorCount += 0.15;
    }
    
    // 5. NEW: Concept overlap similarity
    if (this.checkConcepts) {
      const conceptSimilarity = this.calculateConceptSimilarity(q1, q2);
      similarity += conceptSimilarity * 0.1;
      factorCount += 0.1;
    }
    
    return factorCount > 0 ? similarity / factorCount : 0;
  }
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple text similarity using Jaccard index
    const words1 = this.normalizeText(text1).split(' ');
    const words2 = this.normalizeText(text2).split(' ');
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private calculateStructuralSimilarity(q1: any, q2: any): number {
    let score = 0;
    let factors = 0;
    
    // Question type similarity
    if (q1.type === q2.type) {
      score += 1;
    } else {
      // Similar types get partial credit
      const similarTypes: Record<string, string[]> = {
        'mcq': ['multiple choice', 'objective'],
        'short': ['vsa', 'very short', 'short answer'],
        'long': ['la', 'long answer', 'descriptive'],
        'numerical': ['calculation', 'compute']
      };
      
      const q1Types = similarTypes[q1.type] || [q1.type];
      const q2Types = similarTypes[q2.type] || [q2.type];
      const hasOverlap = q1Types.some(t1 => q2Types.includes(t1));
      if (hasOverlap) score += 0.5;
    }
    factors += 1;
    
    // Marks similarity
    const marksDiff = Math.abs((q1.marks || 1) - (q2.marks || 1));
    if (marksDiff === 0) {
      score += 1;
    } else if (marksDiff <= 1) {
      score += 0.7;
    } else if (marksDiff <= 2) {
      score += 0.3;
    }
    factors += 1;
    
    return factors > 0 ? score / factors : 0;
  }
  
  private calculateCognitiveSimilarity(q1: any, q2: any): number {
    const cognitive1 = q1.cognitive || 'understand';
    const cognitive2 = q2.cognitive || 'understand';
    
    if (cognitive1 === cognitive2) return 1.0;
    
    // Cognitive hierarchy - closer levels get higher similarity
    const cognitiveLevels = ['recall', 'understand', 'apply', 'analyze'];
    const index1 = cognitiveLevels.indexOf(cognitive1);
    const index2 = cognitiveLevels.indexOf(cognitive2);
    
    if (index1 === -1 || index2 === -1) return 0.3;
    
    const distance = Math.abs(index1 - index2);
    return Math.max(0, 1 - distance * 0.4);
  }
  
  private calculateTopicSimilarity(q1: any, q2: any): number {
    const topics1 = Array.isArray(q1.topics) ? q1.topics : [];
    const topics2 = Array.isArray(q2.topics) ? q2.topics : [];
    
    if (topics1.length === 0 && topics2.length === 0) return 0.5;
    
    const set1 = new Set(topics1.map((t: string) => t.toLowerCase()));
    const set2 = new Set(topics2.map((t: string) => t.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private calculateConceptSimilarity(q1: any, q2: any): number {
    // Extract concepts from question text and solution
    const concepts1 = this.extractConcepts(q1);
    const concepts2 = this.extractConcepts(q2);
    
    if (concepts1.size === 0 && concepts2.size === 0) return 0.3;
    
    const intersection = new Set([...concepts1].filter(x => concepts2.has(x)));
    const union = new Set([...concepts1, ...concepts2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private extractConcepts(q: any): Set<string> {
    const concepts = new Set<string>();
    const text = (q.text || q.stem || '').toLowerCase();
    const solution = (q.solution || '').toLowerCase();
    
    // Common STEM concepts
    const stemConcepts = [
      'force', 'energy', 'velocity', 'acceleration', 'equation', 'formula',
      'ratio', 'percentage', 'probability', 'function', 'derivative',
      'reaction', 'compound', 'element', 'molecule', 'cell', 'organism'
    ];
    
    stemConcepts.forEach(concept => {
      if (text.includes(concept) || solution.includes(concept)) {
        concepts.add(concept);
      }
    });
    
    return concepts;
  }
  
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
      .trim();
  }
}

// Enhanced deduplication function with cognitive awareness
export function deduplicateQuestions(
  questions: any[], 
  avoidDuplicates: boolean, 
  config: Partial<DeduplicationConfig> = {}
): any[] {
  if (!avoidDuplicates) return questions;
  
  const seen = new Set<string>();
  const unique: any[] = [];
  const dedupService = new DeduplicationService(config);
  
  for (const q of questions) {
    const key = createQuestionKey(q);
    
    if (!seen.has(key)) {
      // Additional cognitive-level check for similar questions
      const isCognitiveDuplicate = unique.some(existingQ => 
        isCognitiveDuplicateQuestion(existingQ, q, config)
      );
      
      if (!isCognitiveDuplicate) {
        seen.add(key);
        unique.push(q);
      }
    }
  }
  
  return unique;
}

// Enhanced question key creation with cognitive level
export function createQuestionKey(q: any): string {
  const stem = (q.text || q.stem || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
  
  const withoutLatex = stem.replace(/\$[^$]+\$/g, 'math');
  const cognitive = q.cognitive || 'understand';
  
  return `${withoutLatex}_${q.type}_${q.marks}_${cognitive}`;
}

// NEW: Cognitive duplicate detection
function isCognitiveDuplicateQuestion(q1: any, q2: any, config: Partial<DeduplicationConfig> = {}): boolean {
  const threshold = config.similarityThreshold ?? 0.8;
  
  // Quick checks first
  if (q1.type !== q2.type) return false;
  if (Math.abs((q1.marks || 1) - (q2.marks || 1)) > 1) return false;
  
  // Cognitive level check
  const cognitive1 = q1.cognitive || 'understand';
  const cognitive2 = q2.cognitive || 'understand';
  if (cognitive1 !== cognitive2) return false;
  
  // Text similarity
  const text1 = (q1.text || q1.stem || '').toLowerCase();
  const text2 = (q2.text || q2.stem || '').toLowerCase();
  
  const similarity = new DeduplicationService().calculateTextSimilarity(text1, text2);
  return similarity >= threshold;
}

// NEW: Advanced deduplication with semantic analysis
export async function advancedDeduplicate(
  questions: any[],
  config: Partial<DeduplicationConfig> = {}
): Promise<{ unique: any[]; duplicates: Map<string, string[]> }> {
  const dedupService = new DeduplicationService(config);
  const duplicates = await dedupService.findDuplicates(questions);
  
  const duplicateIds = new Set<string>();
  duplicates.forEach((dupList, originalId) => {
    dupList.forEach(dupId => duplicateIds.add(dupId));
  });
  
  const unique = questions.filter(q => {
    const qId = q.id || createQuestionKey(q);
    return !duplicateIds.has(qId);
  });
  
  return { unique, duplicates };
}

// NEW: Batch deduplication for large question sets
export class BatchDeduplicator {
  private batchSize: number;
  private dedupService: DeduplicationService;
  
  constructor(batchSize: number = 50, config: Partial<DeduplicationConfig> = {}) {
    this.batchSize = batchSize;
    this.deduplicationService = new DeduplicationService(config);
  }
  
  async deduplicateLargeSet(questions: any[]): Promise<any[]> {
    const batches: any[][] = [];
    
    // Split into batches
    for (let i = 0; i < questions.length; i += this.batchSize) {
      batches.push(questions.slice(i, i + this.batchSize));
    }
    
    let uniqueQuestions: any[] = [];
    
    for (const batch of batches) {
      const { unique } = await advancedDeduplicate(batch);
      uniqueQuestions = uniqueQuestions.concat(unique);
      
      // Cross-batch deduplication
      if (uniqueQuestions.length > this.batchSize) {
        const { unique: deduped } = await advancedDeduplicate(uniqueQuestions);
        uniqueQuestions = deduped;
      }
    }
    
    return uniqueQuestions;
  }
}