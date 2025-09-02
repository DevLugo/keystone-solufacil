/** @jsxRuntime classic */
/** @jsx jsx */

import * as React from 'react';
const { useState, useEffect } = React;
import { jsx, Box, Heading } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { useQuery } from '@apollo/client';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { gql } from '@apollo/client';
import { FaDownload, FaCalendarAlt, FaBirthdayCake, FaMapMarkerAlt, FaRoute } from 'react-icons/fa';

// GraphQL Query
const GET_LEADERS_BIRTHDAYS = gql`
  query GetLeadersBirthdays($month: Int!) {
    getLeadersBirthdays(month: $month) {
      id
      fullName
      birthDate
      day
      route {
        id
        name
      }
      location {
        id
        name
      }
    }
  }
`;

interface LeaderBirthday {
  id: string;
  fullName: string;
  birthDate: string;
  day: number;
  route: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const styles = {
  container: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  header: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0052CC',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  contentCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  birthdayList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  birthdayCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '24px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    cursor: 'default',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    ':hover': {
      borderColor: '#0ea5e9',
      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)',
      transform: 'translateY(-2px)',
    },
  },
  dayCircle: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: '#0052CC',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: '700',
    marginRight: '24px',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0, 82, 204, 0.3)',
  },
  birthdayInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '12px',
  },
  leaderDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#4a5568',
    padding: '4px 0',
  },
  detailIcon: {
    color: '#0ea5e9',
    fontSize: '16px',
    width: '20px',
  },
  ageHighlight: {
    backgroundColor: '#f0f9ff',
    color: '#0369a1',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    border: '1px solid #0ea5e9',
  },
  birthdateHighlight: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    border: '1px solid #f59e0b',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#718096',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    color: '#cbd5e0',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    ':hover': {
      borderColor: '#0ea5e9',
      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)',
      transform: 'translateY(-2px)',
    },
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#0052CC',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0052CC',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '2px solid #0052CC',
    paddingBottom: '8px',
  },
};

// Función para calcular la edad que cumplirán este año
const calculateAgeThisYear = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  return today.getFullYear() - birth.getFullYear();
};

// Función para formatear la fecha de nacimiento
const formatBirthDate = (birthDate: string): string => {
  const date = new Date(birthDate);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export default function CumpleanosLideresPage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_LEADERS_BIRTHDAYS, {
    variables: { month: selectedMonth },
    fetchPolicy: 'cache-and-network',
  });

  const birthdays: LeaderBirthday[] = data?.getLeadersBirthdays || [];

  const handleMonthChange = (value: string) => {
    setSelectedMonth(parseInt(value));
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Create PDF content
      const pdfContent = generatePDFContent();
      
      // Create and download HTML file that can be printed to PDF
      const element = document.createElement('a');
      const file = new Blob([pdfContent], { type: 'text/html' });
      element.href = URL.createObjectURL(file);
      element.download = `cumpleanos-lideres-${monthNames[selectedMonth - 1].toLowerCase()}.html`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      // Show instructions to user
      setTimeout(() => {
        alert('Archivo HTML descargado. Para convertir a PDF:\n1. Abre el archivo en tu navegador\n2. Presiona Ctrl+P (Cmd+P en Mac)\n3. Selecciona "Guardar como PDF"\n4. Haz clic en "Guardar"');
      }, 500);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar archivo');
    } finally {
      setIsExporting(false);
    }
  };

  const generatePDFContent = () => {
    const monthName = monthNames[selectedMonth - 1];
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cumpleaños de Líderes - ${monthName}</title>
    <style>
        @media print {
            body { margin: 20px; }
            .no-print { display: none; }
        }
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.4;
            color: #333;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #3182ce; 
            padding-bottom: 20px; 
        }
        .title { 
            font-size: 28px; 
            font-weight: bold; 
            color: #0052CC; 
            margin-bottom: 15px; 
        }
        .subtitle { 
            font-size: 18px; 
            color: #718096; 
            border-bottom: 2px solid #0052CC;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .stats { 
            display: flex; 
            justify-content: center; 
            gap: 40px; 
            margin: 30px 0; 
            flex-wrap: wrap;
        }
        .stat { 
            text-align: center; 
            min-width: 140px;
            padding: 15px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: white;
        }
        .stat-value { 
            font-size: 36px; 
            font-weight: bold; 
            color: #0052CC; 
        }
        .stat-label { 
            font-size: 12px; 
            color: #718096; 
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .birthday-list { 
            margin-top: 30px; 
        }
        .birthday-item { 
            display: flex; 
            align-items: flex-start; 
            padding: 20px; 
            margin: 15px 0; 
            border: 1px solid #e2e8f0; 
            border-radius: 12px;
            background: white;
            break-inside: avoid;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .day-circle { 
            width: 60px; 
            height: 60px; 
            border-radius: 50%; 
            background: #0052CC; 
            color: white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: bold; 
            font-size: 24px;
            margin-right: 20px;
            flex-shrink: 0;
            box-shadow: 0 4px 8px rgba(0, 82, 204, 0.3);
        }
        .leader-info { 
            flex: 1; 
        }
        .leader-name { 
            font-size: 20px; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: #1a202c;
        }
        .leader-details { 
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
        }
        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            padding: 4px 0;
        }
        .age-highlight {
            background: #f0f9ff;
            color: #0369a1;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
            border: 1px solid #0ea5e9;
        }
        .birthdate-highlight {
            background: #fef3c7;
            color: #92400e;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
            border: 1px solid #f59e0b;
        }
        .empty-state { 
            text-align: center; 
            padding: 60px; 
            color: #718096; 
        }
        .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #718096; 
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
        @page {
            margin: 2cm;
            size: A4;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🎂 Cumpleaños de Líderes</div>
        <div class="subtitle">${monthName}</div>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">${birthdays.length}</div>
            <div class="stat-label">Total Cumpleaños</div>
        </div>
        <div class="stat">
            <div class="stat-value">${new Set(birthdays.map(b => b.route?.name).filter(Boolean)).size}</div>
            <div class="stat-label">Rutas Representadas</div>
        </div>
        <div class="stat">
            <div class="stat-value">${averageAge > 0 ? `${averageAge} años` : '-'}</div>
            <div class="stat-label">Edad Promedio</div>
        </div>
    </div>

    <div class="birthday-list">
        ${birthdays.length === 0 ? 
          '<div class="empty-state">No hay cumpleaños registrados para este mes</div>' :
          birthdays.map(birthday => {
            const ageThisYear = calculateAgeThisYear(birthday.birthDate);
            const formattedBirthDate = formatBirthDate(birthday.birthDate);
            
            return `
            <div class="birthday-item">
                <div class="day-circle">${birthday.day}</div>
                <div class="leader-info">
                    <div class="leader-name">${birthday.fullName}</div>
                    <div class="leader-details">
                        <div class="detail-item">
                            🎂 <span class="age-highlight">Cumple ${ageThisYear} años</span>
                        </div>
                        <div class="detail-item">
                            📅 <span class="birthdate-highlight">${formattedBirthDate}</span>
                        </div>
                        ${birthday.route ? `
                        <div class="detail-item">
                            🛣️ Ruta: <strong>${birthday.route.name}</strong>
                        </div>` : ''}
                        ${birthday.location ? `
                        <div class="detail-item">
                            📍 Localidad: <strong>${birthday.location.name}</strong>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
          }).join('')
        }
    </div>

    <div class="footer">
        <strong>Reporte de Cumpleaños de Líderes</strong><br>
        Generado el ${new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })} a las ${new Date().toLocaleTimeString('es-ES')}<br>
        <em>Sistema de Gestión SoluFácil</em>
    </div>
</body>
</html>
    `;
  };

  const monthOptions = monthNames.map((month, index) => ({
    label: month,
    value: (index + 1).toString(),
  }));

  // Función auxiliar para calcular edad actual (para promedios)
  const calculateCurrentAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const uniqueRoutes = new Set(birthdays.map(b => b.route?.name).filter(Boolean)).size;
  const averageAge = birthdays.length > 0 
    ? Math.round(birthdays.reduce((sum, birthday) => sum + calculateCurrentAge(birthday.birthDate), 0) / birthdays.length)
    : 0;

  if (error) {
    return (
      <PageContainer header="Cumpleaños de Líderes">
        <GraphQLErrorNotice networkError={error.networkError} errors={error.graphQLErrors} />
      </PageContainer>
    );
  }

  return (
    <PageContainer header="Cumpleaños de Líderes">
      <div css={styles.container}>
        <div css={styles.header}>
          <h1 css={styles.title}>
            <FaBirthdayCake />
            Cumpleaños de Líderes
          </h1>
          <p css={styles.subtitle}>
            Listado de cumpleaños de líderes por mes con opción de exportar a PDF
          </p>
          
          <div css={styles.filtersRow}>
            <Box>
              <Select
                value={{ label: monthNames[selectedMonth - 1], value: selectedMonth.toString() }}
                onChange={(option) => option && handleMonthChange(option.value)}
                options={monthOptions}
              />
            </Box>
            <Box>
              <Button
                tone="active"
                weight="bold"
                size="medium"
                isDisabled={isExporting}
                onClick={handleExportPDF}
                css={styles.exportButton}
              >
                {isExporting ? <LoadingDots label="Exportando..." /> : <FaDownload />}
                {isExporting ? 'Exportando...' : 'Exportar PDF'}
              </Button>
            </Box>
          </div>
        </div>

        {loading ? (
          <div css={styles.contentCard}>
            <Box css={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <LoadingDots label="Cargando cumpleaños..." />
            </Box>
          </div>
        ) : (
          <React.Fragment>
            <div css={styles.statsRow}>
              <div css={styles.statCard}>
                <div css={styles.statValue}>{birthdays.length}</div>
                <div css={styles.statLabel}>Total Cumpleaños</div>
              </div>
              <div css={styles.statCard}>
                <div css={styles.statValue}>{uniqueRoutes}</div>
                <div css={styles.statLabel}>Rutas Representadas</div>
              </div>
              <div css={styles.statCard}>
                <div css={styles.statValue}>{averageAge > 0 ? `${averageAge} años` : '-'}</div>
                <div css={styles.statLabel}>Edad Promedio</div>
              </div>
              <div css={styles.statCard}>
                <div css={styles.statValue}>{monthNames[selectedMonth - 1]}</div>
                <div css={styles.statLabel}>Mes Seleccionado</div>
              </div>
            </div>

            <div css={styles.contentCard}>
              <div css={styles.sectionTitle}>
                <FaCalendarAlt />
                Cumpleaños en {monthNames[selectedMonth - 1]}
              </div>

              {birthdays.length === 0 ? (
                <div css={styles.emptyState}>
                  <div css={styles.emptyIcon}>🎂</div>
                  <h3>No hay cumpleaños registrados</h3>
                  <p>No se encontraron líderes con cumpleaños en {monthNames[selectedMonth - 1]}</p>
                </div>
              ) : (
                <div css={styles.birthdayList}>
                  {birthdays.map((birthday) => {
                    const ageThisYear = calculateAgeThisYear(birthday.birthDate);
                    const formattedBirthDate = formatBirthDate(birthday.birthDate);
                    
                    return (
                      <div key={birthday.id} css={styles.birthdayCard}>
                        <div css={styles.dayCircle}>
                          {birthday.day}
                        </div>
                        <div css={styles.birthdayInfo}>
                          <div css={styles.leaderName}>
                            {birthday.fullName}
                          </div>
                          <div css={styles.leaderDetails}>
                            <div css={styles.detailItem}>
                              <FaBirthdayCake css={styles.detailIcon} />
                              <span css={styles.ageHighlight}>
                                Cumple {ageThisYear} años
                              </span>
                            </div>
                            <div css={styles.detailItem}>
                              <FaCalendarAlt css={styles.detailIcon} />
                              <span css={styles.birthdateHighlight}>
                                {formattedBirthDate}
                              </span>
                            </div>
                            {birthday.route && (
                              <div css={styles.detailItem}>
                                <FaRoute css={styles.detailIcon} />
                                <span>Ruta: <strong>{birthday.route.name}</strong></span>
                              </div>
                            )}
                            {birthday.location && (
                              <div css={styles.detailItem}>
                                <FaMapMarkerAlt css={styles.detailIcon} />
                                <span>Localidad: <strong>{birthday.location.name}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </React.Fragment>
        )}
      </div>
    </PageContainer>
  );
}