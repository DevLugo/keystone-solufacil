import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface DuplicateGroup {
  name: string;
  personalDataIds: string[];
  borrowerIds: string[];
}

interface MergeStats {
  personalDataMerged: number;
  borrowersMerged: number;
  loansUpdated: number;
  collateralsUpdated: number;
  addressesUpdated: number;
  phonesUpdated: number;
  documentPhotosUpdated: number;
}

// Función para normalizar nombres (eliminar espacios extra, convertir a mayúsculas)
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Función para obtener confirmación del usuario
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Encontrar duplicados en PersonalData
async function findPersonalDataDuplicates(): Promise<Map<string, string[]>> {
  console.log('🔍 Buscando duplicados en PersonalData...');
  
  const allPersonalData = await prisma.personalData.findMany({
    select: {
      id: true,
      fullName: true,
    },
  });

  const duplicates = new Map<string, string[]>();
  
  // Agrupar por nombre normalizado
  const nameGroups = new Map<string, string[]>();
  
  for (const pd of allPersonalData) {
    const normalizedName = normalizeName(pd.fullName);
    if (normalizedName) {
      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, []);
      }
      nameGroups.get(normalizedName)!.push(pd.id);
    }
  }

  // Encontrar grupos con más de un registro
  for (const [name, ids] of nameGroups.entries()) {
    if (ids.length > 1) {
      duplicates.set(name, ids);
    }
  }

  return duplicates;
}

// Encontrar duplicados en Borrower
async function findBorrowerDuplicates(): Promise<Map<string, string[]>> {
  console.log('🔍 Buscando duplicados en Borrower...');
  
  const allBorrowers = await prisma.borrower.findMany({
    select: {
      id: true,
      fullName: true,
    },
  });

  const duplicates = new Map<string, string[]>();
  
  // Agrupar por nombre normalizado
  const nameGroups = new Map<string, string[]>();
  
  for (const borrower of allBorrowers) {
    const normalizedName = normalizeName(borrower.fullName);
    if (normalizedName) {
      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, []);
      }
      nameGroups.get(normalizedName)!.push(borrower.id);
    }
  }

  // Encontrar grupos con más de un registro
  for (const [name, ids] of nameGroups.entries()) {
    if (ids.length > 1) {
      duplicates.set(name, ids);
    }
  }

  return duplicates;
}

// Seleccionar el registro maestro (el más antiguo o el que tenga más datos)
async function selectMasterPersonalData(ids: string[]): Promise<string> {
  const records = await prisma.personalData.findMany({
    where: { id: { in: ids } },
    include: {
      addresses: true,
      phones: true,
      documentPhotos: true,
      loansAsCollateral: true,
      borrower: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Priorizar el que tenga más datos asociados
  let master = records[0];
  let maxData = 
    (master.addresses?.length || 0) +
    (master.phones?.length || 0) +
    (master.documentPhotos?.length || 0) +
    (master.loansAsCollateral?.length || 0) +
    (master.borrower ? 1 : 0);

  for (const record of records.slice(1)) {
    const dataCount =
      (record.addresses?.length || 0) +
      (record.phones?.length || 0) +
      (record.documentPhotos?.length || 0) +
      (record.loansAsCollateral?.length || 0) +
      (record.borrower ? 1 : 0);

    if (dataCount > maxData) {
      master = record;
      maxData = dataCount;
    }
  }

  return master.id;
}

// Seleccionar el registro maestro de Borrower
async function selectMasterBorrower(ids: string[]): Promise<string> {
  const records = await prisma.borrower.findMany({
    where: { id: { in: ids } },
    include: {
      loans: true,
      personalData: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Priorizar el que tenga más préstamos o datos personales
  let master = records[0];
  let maxData = 
    (master.loans?.length || 0) +
    (master.personalData ? 1 : 0);

  for (const record of records.slice(1)) {
    const dataCount =
      (record.loans?.length || 0) +
      (record.personalData ? 1 : 0);

    if (dataCount > maxData) {
      master = record;
      maxData = dataCount;
    }
  }

  return master.id;
}

// Unificar PersonalData duplicados
async function mergePersonalDataDuplicates(
  name: string,
  ids: string[],
  stats: MergeStats
): Promise<void> {
  const masterId = await selectMasterPersonalData(ids);
  const duplicateIds = ids.filter(id => id !== masterId);

  console.log(`  📝 Unificando ${duplicateIds.length} duplicados de "${name}" en PersonalData (maestro: ${masterId})`);

  // Actualizar direcciones
  const addressesUpdated = await prisma.address.updateMany({
    where: {
      personalDataId: { in: duplicateIds },
    },
    data: {
      personalDataId: masterId,
    },
  });
  stats.addressesUpdated += addressesUpdated.count;

  // Actualizar teléfonos
  const phonesUpdated = await prisma.phone.updateMany({
    where: {
      personalDataId: { in: duplicateIds },
    },
    data: {
      personalDataId: masterId,
    },
  });
  stats.phonesUpdated += phonesUpdated.count;

  // Actualizar fotos de documentos
  const documentPhotosUpdated = await prisma.documentPhoto.updateMany({
    where: {
      personalDataId: { in: duplicateIds },
    },
    data: {
      personalDataId: masterId,
    },
  });
  stats.documentPhotosUpdated += documentPhotosUpdated.count;

  // Actualizar préstamos como colateral (relación many-to-many)
  // Necesitamos usar raw SQL para la tabla de relación
  let collateralsCount = 0;
  for (const duplicateId of duplicateIds) {
    // Contar relaciones que se van a actualizar
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "_LoanToPersonalData"
      WHERE "B" = ${duplicateId}
      AND "A" NOT IN (
        SELECT "A" FROM "_LoanToPersonalData"
        WHERE "B" = ${masterId}
      )
    `;
    collateralsCount += Number(countResult[0]?.count || 0);
    
    await prisma.$executeRaw`
      UPDATE "_LoanToPersonalData"
      SET "B" = ${masterId}
      WHERE "B" = ${duplicateId}
      AND "A" NOT IN (
        SELECT "A" FROM "_LoanToPersonalData"
        WHERE "B" = ${masterId}
      )
    `;
    
    // Eliminar relaciones duplicadas
    await prisma.$executeRaw`
      DELETE FROM "_LoanToPersonalData"
      WHERE "B" = ${duplicateId}
    `;
  }
  stats.collateralsUpdated += collateralsCount;

  // Actualizar Borrower asociado
  // La relación es: Borrower tiene personalData (relación 1:1)
  // Buscar borrowers que apuntan a los PersonalData duplicados
  const borrowersWithDuplicatePersonalData = await prisma.borrower.findMany({
    where: {
      personalData: {
        id: { in: duplicateIds },
      },
    },
    include: {
      loans: true,
      personalData: true,
    },
  });

  const masterBorrower = await prisma.borrower.findFirst({
    where: {
      personalData: {
        id: masterId,
      },
    },
    include: {
      loans: true,
    },
  });

  for (const borrower of borrowersWithDuplicatePersonalData) {
    if (!masterBorrower) {
      // Mover el borrower al maestro actualizando la referencia
      await prisma.borrower.update({
        where: { id: borrower.id },
        data: {
          personalData: {
            connect: { id: masterId },
          },
        },
      });
    } else {
      // Si ambos tienen borrower, unificar los borrowers
      // Actualizar los loans del borrower duplicado
      const loansCount = borrower.loans?.length || 0;
      
      await prisma.loan.updateMany({
        where: { borrowerId: borrower.id },
        data: { borrowerId: masterBorrower.id },
      });
      stats.loansUpdated += loansCount;
      
      // Desconectar el personalData del borrower duplicado antes de eliminarlo
      await prisma.borrower.update({
        where: { id: borrower.id },
        data: {
          personalData: {
            disconnect: true,
          },
        },
      });
      
      // Eliminar el borrower duplicado
      await prisma.borrower.delete({
        where: { id: borrower.id },
      });
      stats.borrowersMerged++;
    }
  }

  // Eliminar PersonalData duplicados
  await prisma.personalData.deleteMany({
    where: { id: { in: duplicateIds } },
  });
  stats.personalDataMerged += duplicateIds.length;
}

// Unificar Borrower duplicados
async function mergeBorrowerDuplicates(
  name: string,
  ids: string[],
  stats: MergeStats
): Promise<void> {
  const masterId = await selectMasterBorrower(ids);
  const duplicateIds = ids.filter(id => id !== masterId);

  console.log(`  📝 Unificando ${duplicateIds.length} duplicados de "${name}" en Borrower (maestro: ${masterId})`);

  // Actualizar préstamos
  const loansUpdated = await prisma.loan.updateMany({
    where: {
      borrowerId: { in: duplicateIds },
    },
    data: {
      borrowerId: masterId,
    },
  });
  stats.loansUpdated += loansUpdated.count;

  // Actualizar PersonalData asociado
  // La relación es: Borrower tiene personalData (relación 1:1)
  // Los duplicateIds son IDs de borrowers, así que buscamos sus personalData asociados
  const duplicateBorrowers = await prisma.borrower.findMany({
    where: {
      id: { in: duplicateIds },
    },
    include: {
      personalData: true,
    },
  });

  const masterBorrower = await prisma.borrower.findUnique({
    where: { id: masterId },
    include: {
      personalData: true,
    },
  });

  for (const duplicateBorrower of duplicateBorrowers) {
    if (duplicateBorrower.personalData) {
      if (!masterBorrower?.personalData) {
        // Mover el personalData al maestro actualizando la referencia en el borrower
        await prisma.borrower.update({
          where: { id: masterId },
          data: {
            personalData: {
              connect: { id: duplicateBorrower.personalData.id },
            },
          },
        });
      }
      // Si ambos tienen personalData, los personalData deberían ser duplicados también
      // y se manejarán en la función de merge de PersonalData
      // Por ahora, desconectamos el personalData del borrower duplicado
      await prisma.borrower.update({
        where: { id: duplicateBorrower.id },
        data: {
          personalData: {
            disconnect: true,
          },
        },
      });
    }
  }

  // Eliminar Borrower duplicados
  await prisma.borrower.deleteMany({
    where: { id: { in: duplicateIds } },
  });
  stats.borrowersMerged += duplicateIds.length;
}

// Función principal
async function main() {
  console.log('🚀 Iniciando proceso de unificación de duplicados...\n');

  try {
    // Encontrar duplicados
    const personalDataDuplicates = await findPersonalDataDuplicates();
    const borrowerDuplicates = await findBorrowerDuplicates();

    console.log(`\n📊 Resumen de duplicados encontrados:`);
    console.log(`   PersonalData: ${personalDataDuplicates.size} grupos con duplicados`);
    console.log(`   Borrower: ${borrowerDuplicates.size} grupos con duplicados\n`);

    if (personalDataDuplicates.size === 0 && borrowerDuplicates.size === 0) {
      console.log('✅ No se encontraron duplicados. La base de datos está limpia.');
      return;
    }

    // Mostrar detalles
    if (personalDataDuplicates.size > 0) {
      console.log('📋 Duplicados en PersonalData:');
      for (const [name, ids] of personalDataDuplicates.entries()) {
        console.log(`   - "${name}": ${ids.length} registros`);
      }
      console.log('');
    }

    if (borrowerDuplicates.size > 0) {
      console.log('📋 Duplicados en Borrower:');
      for (const [name, ids] of borrowerDuplicates.entries()) {
        console.log(`   - "${name}": ${ids.length} registros`);
      }
      console.log('');
    }

    // Pedir confirmación
    const answer = await askQuestion('¿Deseas proceder con la unificación? (s/N): ');
    if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Operación cancelada por el usuario.');
      return;
    }

    console.log('\n🔄 Iniciando proceso de unificación...\n');

    const stats: MergeStats = {
      personalDataMerged: 0,
      borrowersMerged: 0,
      loansUpdated: 0,
      collateralsUpdated: 0,
      addressesUpdated: 0,
      phonesUpdated: 0,
      documentPhotosUpdated: 0,
    };

    // Unificar PersonalData
    for (const [name, ids] of personalDataDuplicates.entries()) {
      await mergePersonalDataDuplicates(name, ids, stats);
    }

    // Unificar Borrower
    for (const [name, ids] of borrowerDuplicates.entries()) {
      await mergeBorrowerDuplicates(name, ids, stats);
    }

    console.log('\n✅ Proceso de unificación completado!\n');
    console.log('📊 Estadísticas:');
    console.log(`   PersonalData unificados: ${stats.personalDataMerged}`);
    console.log(`   Borrowers unificados: ${stats.borrowersMerged}`);
    console.log(`   Préstamos actualizados: ${stats.loansUpdated}`);
    console.log(`   Colaterales actualizados: ${stats.collateralsUpdated}`);
    console.log(`   Direcciones actualizadas: ${stats.addressesUpdated}`);
    console.log(`   Teléfonos actualizados: ${stats.phonesUpdated}`);
    console.log(`   Documentos actualizados: ${stats.documentPhotosUpdated}`);

  } catch (error) {
    console.error('❌ Error durante el proceso:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

