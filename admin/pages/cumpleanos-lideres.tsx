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
    color: '#1a202c',
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
    padding: '20px',
    backgroundColor: '#f7fafc',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    cursor: 'default',
  },
  birthdayCardHover: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  dayCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#3182ce',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '700',
    marginRight: '20px',
    flexShrink: 0,
  },
  birthdayInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '8px',
  },
  leaderDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#718096',
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
    boxShadow: '0 1px 2px rgba(16,24,40,.06)',
    border: '1px solid #e2e8f0',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096',
    fontWeight: '500',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
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
            font-size: 24px; 
            font-weight: bold; 
            color: #1a202c; 
            margin-bottom: 10px; 
        }
        .subtitle { 
            font-size: 16px; 
            color: #718096; 
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
            min-width: 120px;
        }
        .stat-value { 
            font-size: 32px; 
            font-weight: bold; 
            color: #3182ce; 
        }
        .stat-label { 
            font-size: 14px; 
            color: #718096; 
        }
        .birthday-list { 
            margin-top: 30px; 
        }
        .birthday-item { 
            display: flex; 
            align-items: center; 
            padding: 15px; 
            margin: 10px 0; 
            border: 1px solid #e2e8f0; 
            border-radius: 8px;
            background: #f7fafc;
            break-inside: avoid;
        }
        .day-circle { 
            width: 50px; 
            height: 50px; 
            border-radius: 50%; 
            background: #3182ce; 
            color: white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: bold; 
            font-size: 18px;
            margin-right: 20px;
            flex-shrink: 0;
        }
        .leader-info { 
            flex: 1; 
        }
        .leader-name { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 5px; 
            color: #1a202c;
        }
        .leader-details { 
            font-size: 14px; 
            color: #718096; 
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
            <div class="stat-label">Rutas</div>
        </div>
    </div>

    <div class="birthday-list">
        ${birthdays.length === 0 ? 
          '<div class="empty-state">No hay cumpleaños registrados para este mes</div>' :
          birthdays.map(birthday => `
            <div class="birthday-item">
                <div class="day-circle">${birthday.day}</div>
                <div class="leader-info">
                    <div class="leader-name">${birthday.fullName}</div>
                    <div class="leader-details">
                        ${birthday.route ? `📍 Ruta: ${birthday.route.name}` : ''}
                        ${birthday.location ? ` • Localidad: ${birthday.location.name}` : ''}
                    </div>
                </div>
            </div>
          `).join('')
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

  const uniqueRoutes = new Set(birthdays.map(b => b.route?.name).filter(Boolean)).size;

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
                <div css={styles.statValue}>{monthNames[selectedMonth - 1]}</div>
                <div css={styles.statLabel}>Mes Seleccionado</div>
              </div>
            </div>

            <div css={styles.contentCard}>
              <Heading type="h2" css={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaCalendarAlt />
                Cumpleaños en {monthNames[selectedMonth - 1]}
              </Heading>

              {birthdays.length === 0 ? (
                <div css={styles.emptyState}>
                  <div css={styles.emptyIcon}>🎂</div>
                  <h3>No hay cumpleaños registrados</h3>
                  <p>No se encontraron líderes con cumpleaños en {monthNames[selectedMonth - 1]}</p>
                </div>
              ) : (
                <div css={styles.birthdayList}>
                  {birthdays.map((birthday) => (
                    <div key={birthday.id} css={styles.birthdayCard}>
                      <div css={styles.dayCircle}>
                        {birthday.day}
                      </div>
                      <div css={styles.birthdayInfo}>
                        <div css={styles.leaderName}>
                          {birthday.fullName}
                        </div>
                        <div css={styles.leaderDetails}>
                          {birthday.route && (
                            <div css={styles.detailItem}>
                              <FaRoute />
                              <span>Ruta: {birthday.route.name}</span>
                            </div>
                          )}
                          {birthday.location && (
                            <div css={styles.detailItem}>
                              <FaMapMarkerAlt />
                              <span>Localidad: {birthday.location.name}</span>
                            </div>
                          )}
                          <div css={styles.detailItem}>
                            <FaCalendarAlt />
                            <span>
                              {new Date(birthday.birthDate).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'long'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </React.Fragment>
        )}
      </div>
    </PageContainer>
  );
}