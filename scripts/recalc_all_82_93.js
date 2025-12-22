const { execSync } = require('child_process');

const raceSeqs = [82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93];

console.log('🔄 Recalculando carreras 82-93...\n');

for (const seq of raceSeqs) {
  console.log(`Recalculando carrera ${seq}...`);
  try {
    const output = execSync(`node scripts\\recalc_race.js ${seq}`, {
      cwd: 'c:\\Users\\Santiago Peña\\Desktop\\plataforma-de-seguimiento-4',
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);
  } catch (error) {
    console.error(`Error en carrera ${seq}:`, error.message);
  }
}

console.log('\n✨ Proceso completado');
