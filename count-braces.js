const fs = require('fs');

const content = fs.readFileSync('src/app/admin/penca/[slug]/PencaTabs.tsx', 'utf8');
const lines = content.split('\n');

let openCount = 0;
let closeCount = 0;
let inString = false;
let stringChar = null;
let escapeNext = false;

for (let i = 0; i < Math.min(lines.length, 568); i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if ((char === '"' || char === "'" || char === '`') && !inString) {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === stringChar && inString) {
      inString = false;
      stringChar = null;
      continue;
    }
    
    if (!inString) {
      if (char === '{') openCount++;
      if (char === '}') closeCount++;
    }
  }
  // Reset string state at end of line for template literals
  if (inString && stringChar !== '`') {
    inString = false;
    stringChar = null;
  }
}

console.log('Open braces:', openCount);
console.log('Close braces:', closeCount);
console.log('Difference:', openCount - closeCount);
