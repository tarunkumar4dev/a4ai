// utils/score.ts - ENHANCED VERSION

export interface ScorerConfig {
  topicWeight: number;
  difficultyWeight: number;
  syllabusWeight: number;
  clarityWeight: number;
  solutionWeight: number;
  styleWeight: number;
  cognitiveWeight: number; // NEW
  ncertWeight: number; // NEW
}

export interface CognitiveScoreWeights {
  recall: number;
  understand: number;
  apply: number;
  analyze: number;
}

export class QuestionScorer {
  constructor(
    private config: ScorerConfig, 
    private keywords: string[],
    private cognitiveWeights: CognitiveScoreWeights = {
      recall: 0.8,
      understand: 1.0,
      apply: 1.2,
      analyze: 1.5
    }
  ) {}
  
  score(question: any): number {
    let totalScore = 0;
    let maxPossible = 0;

    // Topic coverage (existing)
    const topicScore = this.calculateTopicCoverage(question);
    totalScore += topicScore * this.config.topicWeight;
    maxPossible += 1 * this.config.topicWeight;

    // Difficulty alignment (existing)
    const difficultyScore = this.calculateDifficultyAlignment(question);
    totalScore += difficultyScore * this.config.difficultyWeight;
    maxPossible += 1 * this.config.difficultyWeight;

    // Syllabus validation (existing)
    const syllabusScore = this.calculateSyllabusAlignment(question);
    totalScore += syllabusScore * this.config.syllabusWeight;
    maxPossible += 1 * this.config.syllabusWeight;

    // NEW: Cognitive level scoring
    const cognitiveScore = this.calculateCognitiveLevel(question);
    totalScore += cognitiveScore * this.config.cognitiveWeight;
    maxPossible += 1 * this.config.cognitiveWeight;

    // NEW: NCERT alignment scoring
    const ncertScore = this.calculateNCERTAlignment(question);
    totalScore += ncertScore * this.config.ncertWeight;
    maxPossible += 1 * this.config.ncertWeight;

    // Clarity (existing)
    const clarityScore = this.calculateClarity(question);
    totalScore += clarityScore * this.config.clarityWeight;
    maxPossible += 1 * this.config.clarityWeight;

    // Solution quality (existing)
    const solutionScore = this.calculateSolutionQuality(question);
    totalScore += solutionScore * this.config.solutionWeight;
    maxPossible += 1 * this.config.solutionWeight;

    // Style (existing)
    const styleScore = this.calculateStyle(question);
    totalScore += styleScore * this.config.styleWeight;
    maxPossible += 1 * this.config.styleWeight;

    return maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
  }
  
  private calculateTopicCoverage(q: any): number {
    // ... your existing implementation
    const text = (q.text || '').toLowerCase();
    const matches = this.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    return matches.length / this.keywords.length;
  }
  
  private calculateDifficultyAlignment(q: any): number {
    // ... your existing implementation
    const expected = q.expectedDifficulty || 'medium';
    const actual = q.difficulty || 'medium';
    return expected === actual ? 1 : 0.5;
  }

  private calculateSyllabusAlignment(q: any): number {
    // ... your existing implementation
    return SyllabusValidator.validate(q.subject, q.text);
  }

  // NEW METHOD: Cognitive level scoring
  private calculateCognitiveLevel(q: any): number {
    const expectedCognitive = q.expectedCognitive || 'understand';
    const actualCognitive = q.cognitive || 'understand';
    
    if (expectedCognitive === actualCognitive) {
      return this.cognitiveWeights[actualCognitive as keyof CognitiveScoreWeights] || 1.0;
    }
    
    // Partial credit for adjacent cognitive levels
    const cognitiveHierarchy = ['recall', 'understand', 'apply', 'analyze'];
    const expectedIndex = cognitiveHierarchy.indexOf(expectedCognitive);
    const actualIndex = cognitiveHierarchy.indexOf(actualCognitive);
    
    if (expectedIndex === -1 || actualIndex === -1) return 0.5;
    
    const distance = Math.abs(expectedIndex - actualIndex);
    return Math.max(0, 1 - distance * 0.3);
  }

  // NEW METHOD: NCERT alignment scoring
  private calculateNCERTAlignment(q: any): number {
    const text = (q.text || '').toLowerCase();
    const solution = (q.solution || '').toLowerCase();
    const fullText = text + ' ' + solution;
    
    let ncertScore = 0;
    
    // Check for NCERT terminology
    const ncertTerms = [
      'ncert', 'textbook', 'exercise', 'example', 'chapter',
      'as per syllabus', 'curriculum', 'board pattern'
    ];
    
    const termMatches = ncertTerms.filter(term => 
      fullText.includes(term.toLowerCase())
    ).length;
    
    ncertScore += Math.min(termMatches / 3, 1) * 0.3;
    
    // Check for conceptual clarity (not rote learning)
    const conceptualIndicators = [
      'explain', 'derive', 'prove', 'show that', 'demonstrate',
      'analyze', 'compare', 'contrast'
    ];
    
    const conceptualMatches = conceptualIndicators.filter(indicator =>
      fullText.includes(indicator.toLowerCase())
    ).length;
    
    ncertScore += Math.min(conceptualMatches / 2, 1) * 0.4;
    
    // Check for real-world applications
    const applicationIndicators = [
      'real world', 'application', 'example from', 'daily life',
      'practical', 'experiment', 'observation'
    ];
    
    const applicationMatches = applicationIndicators.filter(indicator =>
      fullText.includes(indicator.toLowerCase())
    ).length;
    
    ncertScore += Math.min(applicationMatches / 2, 1) * 0.3;
    
    return Math.min(ncertScore, 1);
  }

  private calculateClarity(q: any): number {
    // ... your existing implementation
    const text = q.text || '';
    if (text.length < 10) return 0;
    if (text.length > 200) return 0.7;
    return 1;
  }

  private calculateSolutionQuality(q: any): number {
    // ... your existing implementation
    const solution = q.solution || '';
    return solution.length > 20 ? 1 : solution.length > 10 ? 0.7 : 0.3;
  }

  private calculateStyle(q: any): number {
    // ... your existing implementation
    return 0.8; // default style score
  }
}

// ENHANCE existing utility classes with cognitive features
export class UnitChecker {
  static checkPhysicsUnits(text: string): boolean {
    return /(\b(m|s|kg|N|J|W|Hz|Pa|V|A|Ω|C)\b)/i.test(text);
  }

  // NEW: Check for cognitive level indicators in text
  static detectCognitiveLevel(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (/(recall|remember|define|list|name|state)/i.test(lowerText)) {
      return 'recall';
    }
    if (/(explain|describe|understand|discuss|summarize)/i.test(lowerText)) {
      return 'understand';
    }
    if (/(apply|calculate|solve|use|demonstrate|find)/i.test(lowerText)) {
      return 'apply';
    }
    if (/(analyze|compare|contrast|differentiate|evaluate|justify)/i.test(lowerText)) {
      return 'analyze';
    }
    
    return 'understand'; // default
  }
}

export class SyllabusValidator {
  private static ncertKeywords = {
    physics: ['force', 'energy', 'motion', 'wave', 'electric', 'magnetic', 'work', 'power'],
    chemistry: ['mole', 'bond', 'reaction', 'organic', 'periodic', 'acid', 'base'],
    mathematics: ['algebra', 'geometry', 'calculus', 'trigonometry', 'probability', 'equation']
  };
  
  static validate(subject: string, text: string): number {
    const lowerText = text.toLowerCase();
    const subjectKey = subject.toLowerCase() as keyof typeof SyllabusValidator.ncertKeywords;
    const keywords = SyllabusValidator.ncertKeywords[subjectKey] || [];
    
    const matches = keywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    ).length;
    
    return Math.min(matches / Math.max(keywords.length / 2, 1), 1);
  }

  // NEW: Validate cognitive level against subject
  static validateCognitiveLevel(subject: string, cognitiveLevel: string, marks: number): boolean {
    const validLevels: Record<string, string[]> = {
      physics: ['recall', 'understand', 'apply', 'analyze'],
      chemistry: ['recall', 'understand', 'apply'],
      mathematics: ['understand', 'apply', 'analyze']
    };
    
    const subjectLevels = validLevels[subject.toLowerCase()] || ['understand', 'apply'];
    return subjectLevels.includes(cognitiveLevel);
  }
}

// NEW: Cognitive level analyzer
export class CognitiveAnalyzer {
  static analyzeQuestion(text: string, solution: string = ''): {
    level: string;
    confidence: number;
    indicators: string[];
  } {
    const fullText = (text + ' ' + solution).toLowerCase();
    const indicators: string[] = [];
    let recallScore = 0, understandScore = 0, applyScore = 0, analyzeScore = 0;

    // Recall indicators
    const recallPatterns = [/recall/, /remember/, /define/, /list/, /name/, /state/, /what is/];
    recallPatterns.forEach(pattern => {
      if (pattern.test(fullText)) {
        recallScore++;
        indicators.push('recall');
      }
    });

    // Understand indicators  
    const understandPatterns = [/explain/, /describe/, /understand/, /discuss/, /summarize/, /meaning/];
    understandPatterns.forEach(pattern => {
      if (pattern.test(fullText)) {
        understandScore++;
        indicators.push('understand');
      }
    });

    // Apply indicators
    const applyPatterns = [/apply/, /calculate/, /solve/, /use/, /demonstrate/, /find/, /compute/];
    applyPatterns.forEach(pattern => {
      if (pattern.test(fullText)) {
        applyScore++;
        indicators.push('apply');
      }
    });

    // Analyze indicators
    const analyzePatterns = [/analyze/, /compare/, /contrast/, /differentiate/, /evaluate/, /justify/, /why/];
    analyzePatterns.forEach(pattern => {
      if (pattern.test(fullText)) {
        analyzeScore++;
        indicators.push('analyze');
      }
    });

    const scores = { recall: recallScore, understand: understandScore, apply: applyScore, analyze: analyzeScore };
    const maxLevel = Object.keys(scores).reduce((a, b) => scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b);
    const totalIndicators = recallScore + understandScore + applyScore + analyzeScore;
    const confidence = totalIndicators > 0 ? Math.max(recallScore, understandScore, applyScore, analyzeScore) / totalIndicators : 0.5;

    return {
      level: maxLevel,
      confidence,
      indicators: [...new Set(indicators)]
    };
  }
}