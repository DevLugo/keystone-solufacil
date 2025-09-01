-- Script para verificar el estado de la relación User-Employee

-- 1. Verificar si la columna existe en la tabla Employee
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Employee' AND column_name = 'user';

-- 2. Verificar usuarios y sus empleados vinculados
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    e.id as employee_id,
    e.type as employee_type,
    e."routesId" as employee_route_id,
    r.name as route_name,
    pd."fullName" as employee_full_name
FROM "User" u
LEFT JOIN "Employee" e ON u.id = e."user"
LEFT JOIN "Route" r ON e."routesId" = r.id
LEFT JOIN "PersonalData" pd ON e."personalDataId" = pd.id
ORDER BY u.name;

-- 3. Verificar empleados y sus usuarios vinculados
SELECT 
    e.id as employee_id,
    pd."fullName" as employee_name,
    e.type as employee_type,
    e."routesId" as route_id,
    r.name as route_name,
    u.id as user_id,
    u.name as user_name,
    u.email as user_email
FROM "Employee" e
LEFT JOIN "PersonalData" pd ON e."personalDataId" = pd.id
LEFT JOIN "Route" r ON e."routesId" = r.id
LEFT JOIN "User" u ON e."user" = u.id
ORDER BY pd."fullName";

-- 4. Estadísticas de vinculación
SELECT 
    'Total Users' as metric,
    COUNT(*) as count
FROM "User"
UNION ALL
SELECT 
    'Users with Employee' as metric,
    COUNT(*) as count
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Employee" e WHERE e."user" = u.id)
UNION ALL
SELECT 
    'Total Employees' as metric,
    COUNT(*) as count
FROM "Employee"
UNION ALL
SELECT 
    'Employees with User' as metric,
    COUNT(*) as count
FROM "Employee" e
WHERE e."user" IS NOT NULL
UNION ALL
SELECT 
    'Employees with Route' as metric,
    COUNT(*) as count
FROM "Employee" e
WHERE e."routesId" IS NOT NULL;

-- 5. Buscar empleados que podrían coincidir con usuarios por nombre
SELECT 
    u.name as user_name,
    u.email as user_email,
    pd."fullName" as potential_employee_name,
    e.id as employee_id,
    e.type as employee_type,
    r.name as route_name,
    CASE 
        WHEN e."user" IS NOT NULL THEN 'YA_VINCULADO'
        WHEN LOWER(u.name) = LOWER(pd."fullName") THEN 'COINCIDENCIA_EXACTA'
        WHEN LOWER(pd."fullName") LIKE LOWER('%' || u.name || '%') THEN 'COINCIDENCIA_PARCIAL'
        WHEN LOWER(u.name) LIKE LOWER('%' || pd."fullName" || '%') THEN 'COINCIDENCIA_PARCIAL'
        ELSE 'SIN_COINCIDENCIA'
    END as match_type
FROM "User" u
CROSS JOIN "Employee" e
LEFT JOIN "PersonalData" pd ON e."personalDataId" = pd.id
LEFT JOIN "Route" r ON e."routesId" = r.id
WHERE u.role != 'ADMIN'
    AND pd."fullName" IS NOT NULL
    AND (
        LOWER(u.name) = LOWER(pd."fullName")
        OR LOWER(pd."fullName") LIKE LOWER('%' || u.name || '%')
        OR LOWER(u.name) LIKE LOWER('%' || pd."fullName" || '%')
    )
ORDER BY u.name, match_type;