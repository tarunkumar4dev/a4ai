// utils/pdf-enhanced.ts - ENHANCED VERSION
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

export interface PDFRenderOptions {
  includeCognitiveLevel?: boolean;
  showDifficultyBadges?: boolean;
  includeQRCode?: boolean;
  watermarkText?: string;
  showTopicTags?: boolean;
  compactMode?: boolean;
  language?: 'english' | 'hindi';
  fontSize?: 'small' | 'medium' | 'large';
  showMarksDistribution?: boolean;
  includeInstructions?: boolean;
}

export class EnhancedPDFRenderer {
  private static defaultOptions: PDFRenderOptions = {
    includeCognitiveLevel: true,
    showDifficultyBadges: true,
    includeQRCode: false,
    showTopicTags: true,
    compactMode: false,
    language: 'english',
    fontSize: 'medium',
    showMarksDistribution: true,
    includeInstructions: true
  };

  static async createTeacherCopy(questions: any[], input: any, options: PDFRenderOptions = {}): Promise<Uint8Array> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const pdf = await PDFDocument.create();
    
    // Add metadata
    pdf.setTitle(`${input.subject} - Teacher Copy`);
    pdf.setAuthor('A4AI Test Generator');
    pdf.setSubject(`Class ${input.classNum} ${input.board} ${input.subject}`);
    pdf.setKeywords(['teacher', 'solutions', 'answer key', input.subject]);
    
    const pages: PDFPage[] = [];
    let currentPage = pdf.addPage([595.28, 841.89]); // A4
    pages.push(currentPage);
    
    // Render cover page
    await this.renderCoverPage(currentPage, input, mergedOptions, 'TEACHER COPY');
    
    // Render instructions page
    if (mergedOptions.includeInstructions) {
      currentPage = pdf.addPage([595.28, 841.89]);
      pages.push(currentPage);
      await this.renderInstructionsPage(currentPage, input, mergedOptions, true);
    }
    
    // Render questions with solutions
    const questionPages = await this.renderQuestionsWithSolutions(pdf, questions, input, mergedOptions);
    pages.push(...questionPages);
    
    // Render answer key summary
    currentPage = pdf.addPage([595.28, 841.89]);
    pages.push(currentPage);
    await this.renderAnswerKeySummary(currentPage, questions, input, mergedOptions);
    
    // Add page numbers
    this.addPageNumbers(pages, pdf);
    
    return await pdf.save();
  }
  
  static async createStudentCopy(questions: any[], input: any, options: PDFRenderOptions = {}): Promise<Uint8Array> {
    const mergedOptions = { ...this.defaultOptions, ...options, includeCognitiveLevel: false };
    const pdf = await PDFDocument.create();
    
    // Add metadata
    pdf.setTitle(`${input.subject} - Student Test Paper`);
    pdf.setAuthor('A4AI Test Generator');
    pdf.setSubject(`Class ${input.classNum} ${input.board} ${input.subject}`);
    
    const pages: PDFPage[] = [];
    let currentPage = pdf.addPage([595.28, 841.89]);
    pages.push(currentPage);
    
    // Render cover page
    await this.renderCoverPage(currentPage, input, mergedOptions, 'STUDENT COPY');
    
    // Render instructions page
    if (mergedOptions.includeInstructions) {
      currentPage = pdf.addPage([595.28, 841.89]);
      pages.push(currentPage);
      await this.renderInstructionsPage(currentPage, input, mergedOptions, false);
    }
    
    // Render questions without solutions
    const questionPages = await this.renderQuestionsOnly(pdf, questions, input, mergedOptions);
    pages.push(...questionPages);
    
    // Add page numbers
    this.addPageNumbers(pages, pdf);
    
    return await pdf.save();
  }
  
  static async createAnswerKey(questions: any[], input: any, options: PDFRenderOptions = {}): Promise<Uint8Array> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const pdf = await PDFDocument.create();
    
    pdf.setTitle(`${input.subject} - Answer Key`);
    pdf.setAuthor('A4AI Test Generator');
    
    const pages: PDFPage[] = [];
    const currentPage = pdf.addPage([595.28, 841.89]);
    pages.push(currentPage);
    
    await this.renderAnswerKeyDetailed(currentPage, questions, input, mergedOptions);
    this.addPageNumbers(pages, pdf);
    
    return await pdf.save();
  }

  // NEW: Create cognitive analysis report
  static async createCognitiveReport(questions: any[], input: any): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    
    pdf.setTitle(`${input.subject} - Cognitive Analysis Report`);
    
    const { width, height } = page.getSize();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;
    
    // Title
    page.drawText('Cognitive Level Analysis Report', {
      x: 50,
      y,
      size: 16,
      font: bold,
      color: rgb(0, 0, 0.5)
    });
    y -= 30;
    
    // Cognitive distribution
    const cognitiveCounts = this.analyzeCognitiveDistribution(questions);
    page.drawText('Cognitive Level Distribution:', {
      x: 50,
      y,
      size: 12,
      font: bold
    });
    y -= 20;
    
    Object.entries(cognitiveCounts).forEach(([level, count]) => {
      const percentage = ((count / questions.length) * 100).toFixed(1);
      page.drawText(`${level.toUpperCase()}: ${count} questions (${percentage}%)`, {
        x: 70,
        y,
        size: 10,
        font
      });
      y -= 15;
    });
    
    y -= 20;
    
    // Difficulty distribution
    page.drawText('Difficulty Distribution:', {
      x: 50,
      y,
      size: 12,
      font: bold
    });
    y -= 20;
    
    const difficultyCounts = this.analyzeDifficultyDistribution(questions);
    Object.entries(difficultyCounts).forEach(([difficulty, count]) => {
      const percentage = ((count / questions.length) * 100).toFixed(1);
      page.drawText(`${difficulty.toUpperCase()}: ${count} questions (${percentage}%)`, {
        x: 70,
        y,
        size: 10,
        font
      });
      y -= 15;
    });
    
    return await pdf.save();
  }

  private static async renderCoverPage(page: PDFPage, input: any, options: PDFRenderOptions, copyType: string): Promise<void> {
    const { width, height } = page.getSize();
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const bold = await page.doc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await page.doc.embedFont(StandardFonts.TimesRoman);
    
    // Draw border
    page.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderWidth: 2,
      borderColor: rgb(0.2, 0.2, 0.6)
    });
    
    let y = height - 100;
    
    // Institute name
    if (input.institute) {
      page.drawText(input.institute.toUpperCase(), {
        x: width / 2 - this.getTextWidth(input.institute, bold, 16) / 2,
        y,
        size: 16,
        font: bold,
        color: rgb(0.2, 0.2, 0.6)
      });
      y -= 40;
    }
    
    // Exam title
    const examTitle = input.examTitle || `${input.subject} Examination`;
    page.drawText(examTitle, {
      x: width / 2 - this.getTextWidth(examTitle, timesRoman, 14) / 2,
      y,
      size: 14,
      font: timesRoman,
      color: rgb(0, 0, 0)
    });
      y -= 60;
    
    // Subject and class info
    const subjectInfo = `Class: ${input.classNum} | Subject: ${input.subject} | Board: ${input.board}`;
    page.drawText(subjectInfo, {
      x: width / 2 - this.getTextWidth(subjectInfo, font, 12) / 2,
      y,
      size: 12,
      font
    });
    y -= 30;
    
    // Copy type badge
    page.drawRectangle({
      x: width / 2 - 60,
      y: y - 10,
      width: 120,
      height: 30,
      color: copyType === 'TEACHER COPY' ? rgb(0.9, 0.95, 1) : rgb(0.95, 0.9, 0.95),
      borderWidth: 1,
      borderColor: rgb(0.6, 0.6, 0.8)
    });
    
    page.drawText(copyType, {
      x: width / 2 - this.getTextWidth(copyType, bold, 12) / 2,
      y: y,
      size: 12,
      font: bold,
      color: rgb(0.2, 0.2, 0.6)
    });
    y -= 60;
    
    // Date and teacher info
    if (input.examDate || input.teacherName) {
      const details = [];
      if (input.examDate) details.push(`Date: ${input.examDate}`);
      if (input.teacherName) details.push(`Teacher: ${input.teacherName}`);
      
      page.drawText(details.join(' | '), {
        x: 50,
        y: 120,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });
    }
    
    // Total marks and time
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const marksInfo = `Total Marks: ${totalMarks} | Time: ${input.timeLimit || '3 hours'}`;
    page.drawText(marksInfo, {
      x: width / 2 - this.getTextWidth(marksInfo, bold, 11) / 2,
      y: 90,
      size: 11,
      font: bold
    });
    
    // Watermark
    if (options.watermarkText) {
      this.addWatermark(page, options.watermarkText);
    }
  }

  private static async renderInstructionsPage(page: PDFPage, input: any, options: PDFRenderOptions, isTeacherCopy: boolean): Promise<void> {
    const { width, height } = page.getSize();
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const bold = await page.doc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;
    
    page.drawText('General Instructions', {
      x: 50,
      y,
      size: 14,
      font: bold,
      color: rgb(0, 0, 0.5)
    });
    y -= 30;
    
    const instructions = [
      '1. All questions are compulsory.',
      '2. Read each question carefully before attempting.',
      '3. Marks for each question are indicated against it.',
      '4. Maintain neat and clean presentation.'
    ];
    
    if (isTeacherCopy) {
      instructions.push('5. Solutions are provided for reference.');
      instructions.push('6. Use professional judgment while evaluating answers.');
    } else {
      instructions.push('5. Write your answers in the space provided.');
      instructions.push('6. For MCQ questions, choose the correct option.');
    }
    
    if (input.notes) {
      instructions.push(...input.notes.split('\n').slice(0, 3));
    }
    
    instructions.forEach(instruction => {
      if (y < 100) {
        // Would need to handle page breaks in real implementation
        y = height - 50;
      }
      page.drawText(instruction, {
        x: 60,
        y,
        size: 10,
        font
      });
      y -= 20;
    });
    
    // Cognitive level legend (for teacher copy)
    if (isTeacherCopy && options.includeCognitiveLevel) {
      y -= 30;
      page.drawText('Cognitive Level Legend:', {
        x: 50,
        y,
        size: 11,
        font: bold
      });
      y -= 20;
      
      const cognitiveLevels = [
        '🧠 Recall: Remember facts and basic concepts',
        '💡 Understand: Explain ideas and concepts', 
        '⚡ Apply: Use knowledge in new situations',
        '🔍 Analyze: Draw connections among ideas'
      ];
      
      cognitiveLevels.forEach(level => {
        page.drawText(level, {
          x: 60,
          y,
          size: 9,
          font
        });
        y -= 15;
      });
    }
  }

  private static async renderQuestionsWithSolutions(pdf: PDFDocument, questions: any[], input: any, options: PDFRenderOptions): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    let currentPage = pdf.addPage([595.28, 841.89]);
    pages.push(currentPage);
    
    let y = 800;
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    // Group by sections if available
    const sections = this.groupQuestionsBySection(questions);
    
    for (const [sectionName, sectionQuestions] of Object.entries(sections)) {
      // Add section header
      if (y < 150) {
        currentPage = pdf.addPage([595.28, 841.89]);
        pages.push(currentPage);
        y = 800;
      }
      
      currentPage.drawText(`SECTION ${sectionName}`, {
        x: 50,
        y,
        size: 12,
        font: bold,
        color: rgb(0.2, 0.2, 0.6)
      });
      y -= 25;
      
      // Render each question with solution
      for (const [index, question] of sectionQuestions.entries()) {
        if (y < 200) {
          currentPage = pdf.addPage([595.28, 841.89]);
          pages.push(currentPage);
          y = 800;
        }
        
        y = await this.renderQuestionWithSolution(currentPage, question, index + 1, y, options);
        y -= 20; // Space between questions
      }
    }
    
    return pages;
  }

  private static async renderQuestionWithSolution(page: PDFPage, question: any, number: number, startY: number, options: PDFRenderOptions): Promise<number> {
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const bold = await page.doc.embedFont(StandardFonts.HelveticaBold);
    let y = startY;
    
    // Question number and metadata
    const metaParts = [`Q${number}. (${question.marks || 1} marks)`];
    
    if (options.includeCognitiveLevel && question.cognitive) {
      metaParts.push(`Cognitive: ${question.cognitive}`);
    }
    
    if (options.showDifficultyBadges && question.difficulty) {
      metaParts.push(`Difficulty: ${question.difficulty}`);
    }
    
    page.drawText(metaParts.join(' | '), {
      x: 50,
      y,
      size: 10,
      font: bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 20;
    
    // Question text
    const questionText = this.sanitizeText(question.text || question.stem || '');
    y = this.drawWrappedText(page, questionText, 60, y, 10, font, 500);
    
    // Options for MCQ
    if (question.type === 'MCQ' && question.options?.length) {
      y -= 10;
      const options = ['A', 'B', 'C', 'D'];
      question.options.forEach((opt: string, idx: number) => {
        const optionText = `${options[idx]}. ${this.sanitizeText(opt)}`;
        page.drawText(optionText, {
          x: 70,
          y,
          size: 9,
          font
        });
        y -= 15;
      });
    }
    
    // Solution
    y -= 15;
    page.drawText('Solution:', {
      x: 50,
      y,
      size: 10,
      font: bold,
      color: rgb(0, 0.5, 0)
    });
    y -= 15;
    
    const solutionText = this.sanitizeText(question.solution || 'Solution not provided');
    y = this.drawWrappedText(page, solutionText, 60, y, 9, font, 500);
    
    // Answer
    if (question.answer) {
      y -= 10;
      page.drawText(`Answer: ${this.sanitizeText(question.answer)}`, {
        x: 60,
        y,
        size: 9,
        font: bold,
        color: rgb(0.6, 0, 0)
      });
      y -= 15;
    }
    
    return y;
  }

  private static async renderQuestionsOnly(pdf: PDFDocument, questions: any[], input: any, options: PDFRenderOptions): Promise<PDFPage[]> {
    // Similar to renderQuestionsWithSolutions but without solutions
    const pages: PDFPage[] = [];
    let currentPage = pdf.addPage([595.28, 841.89]);
    pages.push(currentPage);
    
    let y = 800;
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    const sections = this.groupQuestionsBySection(questions);
    
    for (const [sectionName, sectionQuestions] of Object.entries(sections)) {
      if (y < 100) {
        currentPage = pdf.addPage([595.28, 841.89]);
        pages.push(currentPage);
        y = 800;
      }
      
      currentPage.drawText(`SECTION ${sectionName}`, {
        x: 50,
        y,
        size: 12,
        font: bold
      });
      y -= 25;
      
      for (const [index, question] of sectionQuestions.entries()) {
        if (y < 150) {
          currentPage = pdf.addPage([595.28, 841.89]);
          pages.push(currentPage);
          y = 800;
        }
        
        y = await this.renderQuestionOnly(currentPage, question, index + 1, y, options);
        y -= 25;
      }
    }
    
    return pages;
  }

  private static async renderAnswerKeyDetailed(page: PDFPage, questions: any[], input: any, options: PDFRenderOptions): Promise<void> {
    const { width, height } = page.getSize();
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const bold = await page.doc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;
    
    page.drawText('Detailed Answer Key', {
      x: 50,
      y,
      size: 16,
      font: bold,
      color: rgb(0, 0.4, 0)
    });
    y -= 40;
    
    const sections = this.groupQuestionsBySection(questions);
    
    for (const [sectionName, sectionQuestions] of Object.entries(sections)) {
      if (y < 100) {
        // Handle page break in real implementation
        y = height - 50;
      }
      
      page.drawText(`Section ${sectionName}:`, {
        x: 50,
        y,
        size: 12,
        font: bold
      });
      y -= 20;
      
      for (const [index, question] of sectionQuestions.entries()) {
        if (y < 50) {
          // Handle page break
          y = height - 50;
        }
        
        const answerText = `Q${index + 1}. ${this.sanitizeText(question.answer || 'No answer provided')}`;
        page.drawText(answerText, {
          x: 70,
          y,
          size: 10,
          font
        });
        y -= 15;
      }
      
      y -= 10;
    }
  }

  // Utility methods
  private static drawWrappedText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, maxWidth: number): number {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for (const word of words) {
      const testLine = line + word + ' ';
      const testWidth = this.getTextWidth(testLine, font, size);
      
      if (testWidth > maxWidth && line !== '') {
        page.drawText(line, { x, y: currentY, size, font });
        currentY -= size + 2;
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      page.drawText(line, { x, y: currentY, size, font });
    }
    
    return currentY - size - 2;
  }

  private static getTextWidth(text: string, font: PDFFont, size: number): number {
    // Simple approximation - in real implementation, use font.widthOfTextAtSize
    return text.length * size * 0.6;
  }

  private static sanitizeText(text: string): string {
    return text
      .replace(/[→⟶➝➔⇒⟹]/g, '->')
      .replace(/[←⟵⇐⟸]/g, '<-')
      .replace(/[↔⇄⇆⇌⇋]/g, '<->')
      .replace(/√/g, 'sqrt')
      .replace(/[×✕✖]/g, 'x')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
  }

  private static groupQuestionsBySection(questions: any[]): Record<string, any[]> {
    const sections: Record<string, any[]> = {};
    
    questions.forEach((question, index) => {
      const section = question.section || 'A';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(question);
    });
    
    return sections;
  }

  private static addHeader(page: PDFPage, input: any): void {
    const { width } = page.getSize();
    
    // Enhanced header with institute info
    if (input.institute) {
      // Draw header background
      page.drawRectangle({
        x: 0,
        y: 820,
        width,
        height: 30,
        color: rgb(0.95, 0.95, 0.98)
      });
      
      // Add institute name
      // Implementation would require font embedding and text measurement
    }
  }

  private static addWatermark(page: PDFPage, text: string): void {
    const { width, height } = page.getSize();
    
    // Simple text watermark
    page.drawText(text, {
      x: width - 150,
      y: 30,
      size: 8,
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.3
    });
    
    // QR code placeholder - in real implementation, generate actual QR
    page.drawRectangle({
      x: width - 50,
      y: 10,
      width: 40,
      height: 40,
      borderWidth: 1,
      borderColor: rgb(0.8, 0.8, 0.8),
      opacity: 0.3
    });
  }

  private static addPageNumbers(pages: PDFPage[], pdf: PDFDocument): void {
    const font = pdf.embedFont(StandardFonts.Helvetica);
    
    pages.forEach((page, index) => {
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: 500,
        y: 30,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });
    });
  }

  private static analyzeCognitiveDistribution(questions: any[]): Record<string, number> {
    const counts: Record<string, number> = {
      recall: 0,
      understand: 0,
      apply: 0,
      analyze: 0
    };
    
    questions.forEach(question => {
      const level = question.cognitive || 'understand';
      counts[level] = (counts[level] || 0) + 1;
    });
    
    return counts;
  }

  private static analyzeDifficultyDistribution(questions: any[]): Record<string, number> {
    const counts: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0
    };
    
    questions.forEach(question => {
      const difficulty = question.difficulty || 'medium';
      counts[difficulty] = (counts[difficulty] || 0) + 1;
    });
    
    return counts;
  }

  // NEW: Create bilingual paper (English + Hindi)
  static async createBilingualCopy(questions: any[], input: any): Promise<Uint8Array> {
    // Implementation for bilingual papers
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    
    // Bilingual rendering logic
    // Left side English, right side Hindi or alternate lines
    
    return await pdf.save();
  }

  // NEW: Create compact version for quick review
  static async createCompactReview(questions: any[], input: any): Promise<Uint8Array> {
    const options: PDFRenderOptions = {
      compactMode: true,
      includeCognitiveLevel: true,
      showDifficultyBadges: true,
      fontSize: 'small'
    };
    
    return this.createTeacherCopy(questions, input, options);
  }
}