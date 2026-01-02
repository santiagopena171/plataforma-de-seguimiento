const fs = require('fs');
const path = 'src/app/admin/penca/[slug]/PencaTabs.tsx';
const s = fs.readFileSync(path, 'utf8');
console.log('path:', path);
console.log('backticks:', (s.match(/`/g) || []).length);
console.log('single quotes:', (s.match(/'/g) || []).length);
console.log('double quotes:', (s.match(/"/g) || []).length);
console.log('lines:', s.split(/\r?\n/).length);
