const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'data', 'ncertFlashcards.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Function to escape quotes in strings for TypeScript
function escapeQuotes(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Transform flashcard objects
// Match pattern: { "id": "...", "topic_name": "...", "definition": "...", "example": "...", "formula": null|"...", "chemical_reaction": null|"...", "explanation": null|"..." }
const flashcardPattern = /\{\s*"id":\s*"([^"]+)",\s*"topic_name":\s*"([^"]+)",\s*"definition":\s*"([^"]*(?:\\.[^"]*)*)",\s*"example":\s*"([^"]*(?:\\.[^"]*)*)",\s*"formula":\s*(null|"[^"]*(?:\\.[^"]*)*"),\s*"chemical_reaction":\s*(null|"[^"]*(?:\\.[^"]*)*"),\s*"explanation":\s*(null|"[^"]*(?:\\.[^"]*)*")\s*\}/g;

content = content.replace(flashcardPattern, (match, id, topicName, definition, example, formula, chemicalReaction, explanation) => {
  // Determine type
  let type = 'definition';
  if (chemicalReaction && chemicalReaction !== 'null') {
    type = 'reaction';
  } else if (formula && formula !== 'null') {
    type = 'formula';
  }
  
  // Build answer
  let answerParts = [definition];
  
  if (example && example.trim()) {
    answerParts.push('Example: ' + example);
  }
  
  if (explanation && explanation !== 'null' && explanation.trim()) {
    const exp = explanation.replace(/^"|"$/g, ''); // Remove surrounding quotes if present
    answerParts.push(exp);
  }
  
  if (formula && formula !== 'null') {
    const form = formula.replace(/^"|"$/g, '');
    answerParts.push('Formula: ' + form);
  }
  
  if (chemicalReaction && chemicalReaction !== 'null') {
    const react = chemicalReaction.replace(/^"|"$/g, '');
    answerParts.push('Reaction: ' + react);
  }
  
  const answer = answerParts.join(' ');
  const question = `What is ${topicName}?`;
  
  // Return transformed object
  return `{
            id: "${id}",
            question: "${escapeQuotes(question)}",
            answer: "${escapeQuotes(answer)}",
            type: "${type}"
          }`;
});

// Remove "id" and "type" from chapter objects
content = content.replace(/"id":\s*"chapter_\d+",\s*/g, '');
content = content.replace(/,\s*"type":\s*"[^"]+",\s*(?="flashcards")/g, '');
content = content.replace(/^\s*"chapter_number"/gm, '    chapter_number');
content = content.replace(/^\s*"chapter_name"/gm, '    chapter_name');
content = content.replace(/^\s*"subject"/gm, '    subject');
content = content.replace(/^\s*"flashcards"/gm, '    flashcards');

// Also fix chapter objects that use quotes
content = content.replace(/"chapter_number":\s*/g, 'chapter_number: ');
content = content.replace(/"chapter_name":\s*/g, 'chapter_name: ');
content = content.replace(/"subject":\s*/g, 'subject: ');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Transformation complete!');

