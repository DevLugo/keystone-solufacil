/**
 * Script para vincular usuarios existentes con empleados
 * Ejecutar después de aplicar la migración de la nueva relación User-Employee
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function linkUsersToEmployees() {
  console.log('🔗 Iniciando vinculación de usuarios con empleados...');

  try {
    // Obtener todos los usuarios y empleados
    const users = await prisma.user.findMany({
      include: {
        employee: true
      }
    });

    const employees = await prisma.employee.findMany({
      include: {
        personalData: true,
        user: true
      }
    });

    console.log(`📊 Encontrados ${users.length} usuarios y ${employees.length} empleados`);

    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let noMatchCount = 0;

    for (const user of users) {
      // Saltar si ya tiene empleado vinculado
      if (user.employee) {
        alreadyLinkedCount++;
        console.log(`✅ Usuario ${user.name} ya tiene empleado vinculado`);
        continue;
      }

      // Buscar empleado que coincida por nombre o email
      const matchingEmployee = employees.find(emp => {
        if (emp.user) return false; // Saltar si ya está vinculado
        
        const empName = emp.personalData?.fullName?.toLowerCase() || '';
        const userName = user.name.toLowerCase();
        
        // Coincidencia exacta por nombre
        if (empName === userName) return true;
        
        // Coincidencia parcial (nombre contiene apellido o viceversa)
        const userParts = userName.split(' ');
        const empParts = empName.split(' ');
        
        // Verificar si al menos 2 palabras coinciden
        const matches = userParts.filter(part => 
          empParts.some(empPart => 
            empPart.length > 2 && part.length > 2 && 
            (empPart.includes(part) || part.includes(empPart))
          )
        );
        
        return matches.length >= 2;
      });

      if (matchingEmployee) {
        // Vincular usuario con empleado
        await prisma.employee.update({
          where: { id: matchingEmployee.id },
          data: { user: { connect: { id: user.id } } }
        });

        linkedCount++;
        console.log(`🔗 Vinculado: ${user.name} ↔ ${matchingEmployee.personalData?.fullName}`);
      } else {
        noMatchCount++;
        console.log(`❌ Sin coincidencia para usuario: ${user.name}`);
      }
    }

    console.log('\n📈 Resumen de vinculación:');
    console.log(`✅ Vinculados exitosamente: ${linkedCount}`);
    console.log(`ℹ️  Ya estaban vinculados: ${alreadyLinkedCount}`);
    console.log(`❌ Sin coincidencias: ${noMatchCount}`);
    console.log(`📊 Total procesados: ${users.length}`);

    // Mostrar estadísticas finales
    const finalStats = await prisma.user.findMany({
      include: {
        employee: {
          include: {
            routes: true,
            personalData: true
          }
        }
      }
    });

    const usersWithEmployee = finalStats.filter(u => u.employee);
    const usersWithRoutes = finalStats.filter(u => u.employee?.routes);

    console.log('\n📊 Estadísticas finales:');
    console.log(`👥 Usuarios con empleado: ${usersWithEmployee.length}/${finalStats.length}`);
    console.log(`🛣️  Usuarios con rutas: ${usersWithRoutes.length}/${finalStats.length}`);

    // Mostrar usuarios sin vincular para revisión manual
    const unlinkedUsers = finalStats.filter(u => !u.employee);
    if (unlinkedUsers.length > 0) {
      console.log('\n⚠️  Usuarios sin vincular (requieren vinculación manual):');
      unlinkedUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - Rol: ${user.role}`);
      });
    }

    // Mostrar empleados sin usuario para información
    const employeesWithoutUser = await prisma.employee.findMany({
      where: { user: null },
      include: {
        personalData: true,
        routes: true
      }
    });

    if (employeesWithoutUser.length > 0) {
      console.log('\n📋 Empleados sin usuario vinculado:');
      employeesWithoutUser.forEach(emp => {
        console.log(`   - ${emp.personalData?.fullName || 'Sin nombre'} (${emp.type || 'Sin tipo'}) - Ruta: ${emp.routes?.name || 'Sin ruta'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error durante la vinculación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  linkUsersToEmployees()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { linkUsersToEmployees };