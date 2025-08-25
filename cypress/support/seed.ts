import { seedDatabase } from './database';

async function runSeed() {
  try {
    console.log('🌱 Ejecutando seed de datos de testing...');
    const result = await seedDatabase();
    console.log('✅ Seed ejecutado exitosamente');
    console.log('🎯 Datos disponibles para testing');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runSeed();
}

export { runSeed }; 