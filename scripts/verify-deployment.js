#!/usr/bin/env node

/**
 * Script de verificación pre-deployment
 * Verifica que todas las configuraciones estén listas para production
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de deployment...\n');

// Verificar package.json
function verifyPackageJson() {
  console.log('📦 Verificando package.json...');
  
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    console.error('❌ package.json no encontrado');
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Verificar scripts requeridos
  const requiredScripts = ['start', 'build'];
  const missingScripts = requiredScripts.filter(script => !pkg.scripts[script]);
  
  if (missingScripts.length > 0) {
    console.error(`❌ Scripts faltantes en package.json: ${missingScripts.join(', ')}`);
    return false;
  }

  // Verificar dependencias críticas
  const requiredDeps = ['@keystone-6/core', 'pg', 'dotenv'];
  const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.error(`❌ Dependencias faltantes: ${missingDeps.join(', ')}`);
    return false;
  }

  // Verificar que las dependencias de testing estén en devDependencies
  const testingDeps = ['cypress', 'jest', '@testing-library/jest-dom'];
  const wronglyPlacedDeps = testingDeps.filter(dep => pkg.dependencies[dep]);
  
  if (wronglyPlacedDeps.length > 0) {
    console.error(`❌ Dependencias de testing en dependencies (deben estar en devDependencies): ${wronglyPlacedDeps.join(', ')}`);
    return false;
  }

  // Verificar que el script de build no ejecute tests
  const buildScript = pkg.scripts.build || '';
  const testKeywords = ['test', 'cypress', 'jest', 'spec'];
  const hasTestsInBuild = testKeywords.some(keyword => buildScript.includes(keyword));
  
  if (hasTestsInBuild) {
    console.error('❌ El script de build no debe incluir comandos de testing');
    return false;
  }

  // Verificar engines
  if (!pkg.engines || !pkg.engines.node) {
    console.warn('⚠️  Recomendado: Agregar "engines" en package.json para especificar versión de Node.js');
  }

  console.log('✅ package.json configurado correctamente');
  return true;
}

// Verificar archivos de configuración
function verifyConfigFiles() {
  console.log('\n⚙️  Verificando archivos de configuración...');
  
  const requiredFiles = [
    'keystone.ts',
    'schema.ts',
    'auth.ts'
  ];

  const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(process.cwd(), file)));
  
  if (missingFiles.length > 0) {
    console.error(`❌ Archivos de configuración faltantes: ${missingFiles.join(', ')}`);
    return false;
  }

  console.log('✅ Archivos de configuración presentes');
  return true;
}

// Verificar configuración de base de datos
function verifyDatabaseConfig() {
  console.log('\n🗄️  Verificando configuración de base de datos...');
  
  const keystonePath = path.join(process.cwd(), 'keystone.ts');
  const keystoneContent = fs.readFileSync(keystonePath, 'utf8');
  
  // Verificar que use PostgreSQL
  if (!keystoneContent.includes("provider: 'postgresql'")) {
    console.error('❌ Database provider debe ser PostgreSQL para Render');
    return false;
  }

  // Verificar que use DATABASE_URL del entorno
  if (!keystoneContent.includes('process.env.DATABASE_URL')) {
    console.error('❌ keystone.ts debe usar process.env.DATABASE_URL');
    return false;
  }

  console.log('✅ Configuración de base de datos correcta');
  return true;
}

// Verificar variables de entorno de ejemplo
function verifyEnvExample() {
  console.log('\n🔐 Verificando archivo de variables de entorno...');
  
  const envExamplePath = path.join(process.cwd(), 'env.example');
  if (!fs.existsSync(envExamplePath)) {
    console.warn('⚠️  env.example no encontrado - se recomienda tenerlo para referencia');
    return true;
  }

  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  const requiredVars = ['DATABASE_URL', 'SESSION_SECRET', 'NODE_ENV'];
  const missingVars = requiredVars.filter(envVar => !envContent.includes(envVar));
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Variables faltantes en env.example: ${missingVars.join(', ')}`);
  } else {
    console.log('✅ env.example configurado correctamente');
  }
  
  return true;
}

// Verificar que no haya archivos sensibles
function verifyGitignore() {
  console.log('\n🔒 Verificando .gitignore...');
  
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    console.error('❌ .gitignore no encontrado');
    return false;
  }

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  const sensitiveFiles = ['.env', 'node_modules'];
  const missing = sensitiveFiles.filter(file => !gitignoreContent.includes(file));
  
  if (missing.length > 0) {
    console.error(`❌ Archivos sensibles no ignorados en .gitignore: ${missing.join(', ')}`);
    return false;
  }

  // Verificar que se ignoren archivos de Cypress
  const cypressFiles = ['cypress/screenshots/', 'cypress/videos/', 'cypress/downloads/'];
  const missingCypress = cypressFiles.filter(file => !gitignoreContent.includes(file));
  
  if (missingCypress.length > 0) {
    console.error(`❌ Archivos de Cypress no ignorados: ${missingCypress.join(', ')}`);
    return false;
  }

  console.log('✅ .gitignore configurado correctamente');
  return true;
}

// Verificar configuración de testing/Cypress
function verifyTestingConfig() {
  console.log('\n🧪 Verificando configuración de testing...');
  
  // Verificar que Cypress no esté en producción
  const cypressConfigPath = path.join(process.cwd(), 'cypress.config.ts');
  if (!fs.existsSync(cypressConfigPath)) {
    console.log('ℹ️  cypress.config.ts no encontrado (OK para producción)');
  }

  // Verificar que los archivos de Cypress estén presentes pero ignorados
  const cypressDir = path.join(process.cwd(), 'cypress');
  if (fs.existsSync(cypressDir)) {
    const screenshotsDir = path.join(cypressDir, 'screenshots');
    const videosDir = path.join(cypressDir, 'videos');
    
    if (fs.existsSync(screenshotsDir)) {
      const screenshots = fs.readdirSync(screenshotsDir);
      if (screenshots.length > 0) {
        console.log(`⚠️  ${screenshots.length} screenshots de Cypress encontrados - serán ignorados en deploy`);
      }
    }
    
    if (fs.existsSync(videosDir)) {
      const videos = fs.readdirSync(videosDir);
      if (videos.length > 0) {
        console.log(`⚠️  ${videos.length} videos de Cypress encontrados - serán ignorados en deploy`);
      }
    }
  }

  console.log('✅ Configuración de testing verificada');
  return true;
}

// Ejecutar todas las verificaciones
function runAllChecks() {
  const checks = [
    verifyPackageJson,
    verifyConfigFiles,
    verifyDatabaseConfig,
    verifyEnvExample,
    verifyGitignore,
    verifyTestingConfig
  ];

  const results = checks.map(check => check());
  const allPassed = results.every(result => result);

  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ¡Todas las verificaciones pasaron!');
    console.log('✅ El proyecto está listo para deployment en Render');
    console.log('\n📋 Próximos pasos:');
    console.log('1. Crear cuenta en Neon y obtener DATABASE_URL');
    console.log('2. Generar SESSION_SECRET');
    console.log('3. Configurar variables en Render');
    console.log('4. Deploy automático desde GitHub');
    console.log('\n📖 Ver DEPLOY_RENDER.md para instrucciones detalladas');
    process.exit(0);
  } else {
    console.log('❌ Algunas verificaciones fallaron');
    console.log('🔧 Revisa los errores arriba y corrígelos antes del deployment');
    process.exit(1);
  }
}

// Mostrar información del entorno actual
function showCurrentEnv() {
  console.log('🌍 Información del entorno actual:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   NPM: ${process.env.npm_version || 'No detectado'}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Working Dir: ${process.cwd()}`);
  console.log('');
}

// Ejecutar el script
showCurrentEnv();
runAllChecks(); 