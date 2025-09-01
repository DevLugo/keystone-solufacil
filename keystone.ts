// Welcome to Keystone!
//
// This file is what Keystone uses as the entry-point to your headless backend
//
// Keystone imports the default export of this file, expecting a Keystone configuration object
//   you can find out more at https://keystonejs.com/docs/apis/config

import { config } from '@keystone-6/core'
import { PrismaClient } from '@prisma/client';

// to keep this file tidy, we define our schema in a different file
import { lists } from './schema'

// authentication is configured separately here too, but you might move this elsewhere
// when you write your list-level access control functions, as they typically rely on session data
import { withAuth, session } from './auth'
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { extendGraphqlSchema } from './graphql/extendGraphqlSchema';
import { extendExpressApp } from './keystone-extensions.js';
import { components } from './admin/config';

// Declare global types
declare global {
  var prisma: PrismaClient | undefined;
}

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Error: Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n💡 Please set these variables in your .env file or deployment environment');
  process.exit(1);
}

// Validate DATABASE_URL format for PostgreSQL
if (!process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL?.startsWith('postgres://')) {
  console.error('❌ Error: DATABASE_URL must be a valid PostgreSQL connection string');
  console.error('   Example: postgresql://username:password@hostname:5432/database_name');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');
console.log(`🚀 Starting Keystone in ${process.env.NODE_ENV || 'development'} mode`);

// Comentado temporalmente - no funciona con Keystone
// const app = express();
// ... endpoints comentados temporalmente

// Initialize Prisma client with proper typing
let prisma: PrismaClient;

if (typeof global.prisma === 'undefined') {
  global.prisma = new PrismaClient({
    log: ['error'],
  });
}

prisma = global.prisma;
export { prisma };

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/solufacil',
      enableLogging: false,
    },
    lists,
    session,
    graphql: {
      extendGraphqlSchema,
    },
    ui: {
      isAccessAllowed: (context) => !!context.session?.data,
      components,
      pages: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          component: () => import('./admin/pages/dashboard'),
        },
        {
          label: 'Historial de Cliente',
          path: '/historial-cliente',
          component: () => import('./admin/pages/historial-cliente'),
        },
        {
          label: 'Documentos Personales',
          path: '/documentos-personales',
          component: () => import('./admin/pages/documentos-personales'),
        },
        {
          label: 'Transacciones',
          path: '/transacciones',
          component: () => import('./admin/pages/transacciones'),
        },
        {
          label: 'Gastos Toka',
          path: '/gastos-toka',
          component: () => import('./admin/pages/gastos-toka'),
        },
        {
          label: 'Generar PDFs',
          path: '/generar-pdfs',
          component: () => import('./admin/pages/generar-listados'),
        },
        {
          label: 'Reporte Financiero',
          path: '/reporte-financiero',
          component: () => import('./admin/pages/reporte-financiero'),
        },
        {
          label: 'Reporte de Cobranza',
          path: '/reporte-cobranza',
          component: () => import('./admin/pages/reporte-cobranza'),
        },
        {
          label: 'Administrar Rutas',
          path: '/administrar-rutas',
          component: () => import('./admin/pages/administrar-rutas'),
        },
        {
          label: 'Limpieza de Cartera',
          path: '/limpieza-cartera',
          component: () => import('./admin/pages/limpieza-cartera'),
        },
        {
          label: 'Configuración de Reportes',
          path: '/configuracion-reportes',
          component: () => import('./admin/pages/configuracion-reportes'),
        },
        {
          label: 'Usuarios de Telegram',
          path: '/telegram-users',
          component: () => import('./admin/pages/telegram-users'),
        },
        {
          label: 'Gestión de Deuda Mala',
          path: '/deuda-mala',
          component: () => import('./admin/pages/deuda-mala'),
        },
        {
          label: 'Cartera',
          path: '/cartera',
          component: () => import('./admin/pages/cartera'),
        },
        {
          label: 'Ajustar Cuenta',
          path: '/ajustar-cuenta',
          component: () => import('./admin/pages/ajustar-cuenta'),
        }
      ],
    },
    server: {
      port: 3000,
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true,
      },
      extendExpressApp: extendExpressApp,
    },

  })
);
