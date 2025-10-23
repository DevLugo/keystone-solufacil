import React, { useState, useEffect } from 'react';
import { Stack, Text } from '@keystone-ui/core';
import { gql, useQuery, useMutation } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';

// Componentes simples sin dependencias externas
const CustomBox = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={style}>{children}</div>
);

const CustomButton = ({ 
  children, 
  onClick, disabled, 
  style 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  disabled?: boolean; 
  style?: React.CSSProperties;
}) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    style={{
      padding: '8px 16px',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
      backgroundColor: disabled ? '#f3f4f6' : 'white',
      color: disabled ? '#9ca3af' : '#374151',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      ...style
    }}
  >
    {children}
  </button>
);

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  style 
}: { 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; 
  options: Array<{ value: string; label: string; disabled?: boolean }>; 
  placeholder?: string; 
  style?: React.CSSProperties;
}) => (
  <select
    value={value}
    onChange={onChange}
    style={{
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      width: '100%',
      backgroundColor: 'white',
      ...style
    }}
  >
    <option value="">{placeholder || 'Selecciona un usuario...'}</option>
    {options.map((option) => (
      <option 
        key={option.value} 
        value={option.value} 
        disabled={option.disabled}
      >
        {option.label}
      </option>
    ))}
  </select>
);

// Iconos simples
const FaCog = () => <span>⚙️</span>;
const FaCheckCircle = () => <span>✅</span>;
const FaTimesCircle = () => <span>❌</span>;
const FaExclamationTriangle = () => <span>⚠️</span>;
const FaInfoCircle = () => <span>ℹ️</span>;
const FaPlay = () => <span>▶️</span>;
const FaSpinner = () => <span>🔄</span>;

// Queries y mutations
const GET_TELEGRAM_USERS = gql`
  query GetTelegramUsers {
    telegramUsers {
      id
      chatId
      name
      username
      isActive
      platformUser {
        employee {
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

const VALIDATE_CHAT_ID = gql`
  mutation ValidateChatId($chatId: String!) {
    validateTelegramChatId(chatId: $chatId)
  }
`;

const SEND_TEST_MESSAGE = gql`
  mutation SendTestMessage($chatId: String!) {
    sendTestTelegramMessage(chatId: $chatId, message: "🧪 Mensaje de prueba - Configuración de Telegram funcionando correctamente")
  }
`;

const DIAGNOSE_CONFIGURATION = gql`
  mutation DiagnoseConfiguration {
    diagnoseTelegramConfiguration
  }
`;

export default function DiagnosticoTelegramPage() {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [testResults, setTestResults] = useState<{ [chatId: string]: any }>({});
  const [selectedChatId, setSelectedChatId] = useState('');
  const [selectedUsername, setSelectedUsername] = useState('');
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);
  const [isTestingChat, setIsTestingChat] = useState(false);

  // Queries y mutations
  const { data: telegramUsersData, loading: usersLoading, refetch: refetchUsers } = useQuery(GET_TELEGRAM_USERS);
  const [validateChatId] = useMutation(VALIDATE_CHAT_ID);
  const [sendTestMessage] = useMutation(SEND_TEST_MESSAGE);
  const [diagnoseConfiguration] = useMutation(DIAGNOSE_CONFIGURATION);

  const telegramUsers = telegramUsersData?.telegramUsers || [];

  // Debug: Mostrar información sobre los datos
  console.log('🔍 Debug - telegramUsersData:', telegramUsersData);
  console.log('🔍 Debug - telegramUsers:', telegramUsers);
  console.log('🔍 Debug - usersLoading:', usersLoading);

  // Crear opciones para el dropdown
  const userOptions = telegramUsers.map((user: any) => ({
    value: user.chatId,
    label: `${user.platformUser?.employee?.personalData?.fullName || user.name || 'Usuario sin nombre'} (@${user.username || 'sin_username'}) - ${user.chatId}`,
    disabled: !user.isActive
  }));

  console.log('🔍 Debug - userOptions:', userOptions);

  // Manejar selección de usuario
  const handleUserSelection = (chatId: string) => {
    setSelectedChatId(chatId);
    const user = telegramUsers.find((u: any) => u.chatId === chatId);
    setSelectedUsername(user ? `@${user.username || 'sin_username'}` : '');
  };

  // Función para ejecutar diagnóstico completo
  const runDiagnosis = async () => {
    setIsRunningDiagnosis(true);
    try {
      console.log('🔧 Ejecutando diagnóstico completo...');
      const result = await diagnoseConfiguration();
      console.log('📊 Resultado del diagnóstico:', result.data?.diagnoseTelegramConfiguration);
      
      try {
        const diagnosisData = JSON.parse(result.data?.diagnoseTelegramConfiguration || '{}');
        setDiagnosis(diagnosisData);
      } catch (e) {
        setDiagnosis({ 
          isValid: false, 
          errors: ['Error parseando diagnóstico'], 
          warnings: [],
          botInfo: null 
        });
      }
    } catch (error: any) {
      console.error('❌ Error ejecutando diagnóstico:', error);
      setDiagnosis({ 
        isValid: false, 
        errors: [`Error: ${error.message}`], 
        warnings: [],
        botInfo: null 
      });
    } finally {
      setIsRunningDiagnosis(false);
    }
  };

  // Función para probar un chat ID específico
  const testChatId = async (chatId: string) => {
    setIsTestingChat(true);
    try {
      console.log(`🧪 Probando chat ID: ${chatId}`);
      
      // Validar chat ID primero
      const validationResult = await validateChatId({ variables: { chatId } });
      console.log('🔍 Validación de chat ID:', validationResult.data?.validateTelegramChatId);
      
      // Parsear la respuesta de validación
      let validationDetails = '';
      try {
        const validationData = JSON.parse(validationResult.data?.validateTelegramChatId || '{}');
        if (validationData.isValid) {
          validationDetails = `✅ Chat válido - Tipo: ${validationData.chatInfo?.type || 'desconocido'}`;
        } else {
          validationDetails = `❌ Chat inválido: ${validationData.error || 'Error desconocido'}`;
        }
      } catch (e) {
        validationDetails = validationResult.data?.validateTelegramChatId || 'Error parseando validación';
      }
      
      // Enviar mensaje de prueba
      const testResult = await sendTestMessage({ variables: { chatId } });
      console.log('📱 Resultado del mensaje de prueba:', testResult.data?.sendTestTelegramMessage);
      
      // Parsear la respuesta del mensaje de prueba
      let testDetails = '';
      try {
        const testData = JSON.parse(testResult.data?.sendTestTelegramMessage || '{}');
        if (testData.success) {
          testDetails = `✅ Mensaje enviado exitosamente (ID: ${testData.messageId || 'N/A'})`;
        } else {
          testDetails = `❌ Error enviando mensaje: ${testData.error || 'Error desconocido'}`;
        }
      } catch (e) {
        testDetails = testResult.data?.sendTestTelegramMessage || 'Error parseando resultado';
      }
      
      // Determinar el estado final
      const isSuccess = testResult.data?.sendTestTelegramMessage?.includes('✅') || 
                       testResult.data?.sendTestTelegramMessage?.includes('success');
      
      setTestResults(prev => ({
        ...prev,
        [chatId]: {
          status: isSuccess ? 'success' : 'error',
          validation: validationDetails,
          testMessage: testDetails,
          timestamp: new Date().toISOString(),
          rawResponse: {
            validation: validationResult.data?.validateTelegramChatId,
            test: testResult.data?.sendTestTelegramMessage
          }
        }
      }));
    } catch (error: any) {
      console.error(`❌ Error probando chat ID ${chatId}:`, error);
      
      // Capturar más detalles del error
      let errorDetails = `Error: ${error.message}`;
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorDetails += `\n\nErrores GraphQL:`;
        error.graphQLErrors.forEach((gqlError: any, index: number) => {
          errorDetails += `\n${index + 1}. ${gqlError.message}`;
          if (gqlError.extensions) {
            errorDetails += `\n   Extensions: ${JSON.stringify(gqlError.extensions, null, 2)}`;
          }
        });
      }
      if (error.networkError) {
        errorDetails += `\n\nError de red: ${error.networkError.message}`;
        if (error.networkError.result) {
          errorDetails += `\n   Resultado: ${JSON.stringify(error.networkError.result, null, 2)}`;
        }
      }
      
      setTestResults(prev => ({
        ...prev,
        [chatId]: {
          status: 'error',
          error: errorDetails,
          timestamp: new Date().toISOString(),
          rawResponse: {
            error: error.message,
            graphQLErrors: error.graphQLErrors,
            networkError: error.networkError
          }
        }
      }));
    } finally {
      setIsTestingChat(false);
    }
  };

  // Función para probar todos los usuarios
  const testAllUsers = async () => {
    for (const user of telegramUsers) {
      if (user.chatId && user.isActive) {
        await testChatId(user.chatId);
        // Esperar un poco entre pruebas para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Función para obtener el estado de un chat ID
  const getChatStatus = (chatId: string) => {
    const result = testResults[chatId];
    if (!result) return 'pending';
    if (result.status) return result.status;
    if (result.error) return 'error';
    if (result.testMessage?.includes('✅')) return 'success';
    return 'failed';
  };

  // Función para obtener el icono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <FaCheckCircle />;
      case 'error':
        return <FaTimesCircle />;
      case 'failed':
        return <FaExclamationTriangle />;
      default:
        return <FaInfoCircle />;
    }
  };

  return (
    <PageContainer header="🔧 Diagnóstico de Telegram">
      <CustomBox style={{ padding: '32px' }}>
        {/* Header con botones de acción */}
        <CustomBox style={{
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <CustomBox style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <Text weight="bold" size="large" color="black">
              🔧 Diagnóstico de Telegram
            </Text>
            <CustomBox style={{ display: 'flex', gap: '12px' }}>
              <CustomButton
                onClick={runDiagnosis}
                disabled={isRunningDiagnosis}
                style={{
                  backgroundColor: isRunningDiagnosis ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none'
                }}
              >
                {isRunningDiagnosis ? (
                  <>
                    <FaSpinner /> Diagnostizando...
                  </>
                ) : (
                  <>
                    <FaCog /> Ejecutar Diagnóstico
                  </>
                )}
              </CustomButton>
              <CustomButton
                onClick={testAllUsers}
                disabled={isTestingChat}
                style={{
                  border: '1px solid #10b981',
                  backgroundColor: isTestingChat ? '#9ca3af' : 'white',
                  color: isTestingChat ? '#6b7280' : '#10b981'
                }}
              >
                {isTestingChat ? (
                  <>
                    <FaSpinner /> Probando...
                  </>
                ) : (
                  <>
                    <FaPlay /> Probar Todos
                  </>
                )}
              </CustomButton>
            </CustomBox>
          </CustomBox>

          {/* Dropdown para seleccionar usuario */}
          <CustomBox style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <CustomSelect
              value={selectedChatId}
              onChange={(e) => handleUserSelection(e.target.value)}
              options={userOptions}
              placeholder={usersLoading ? "Cargando usuarios..." : userOptions.length === 0 ? "No hay usuarios de Telegram disponibles" : "Selecciona un usuario de Telegram para probar..."}
              style={{ flex: 1 }}
            />
            <CustomButton
              onClick={() => selectedChatId && testChatId(selectedChatId)}
              disabled={!selectedChatId || isTestingChat}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none'
              }}
            >
              <FaPlay /> Probar
            </CustomButton>
            {selectedChatId && (
              <CustomButton
                onClick={() => {
                  setSelectedChatId('');
                  setSelectedUsername('');
                }}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: '1px solid #d1d5db'
                }}
              >
                ✕ Limpiar
              </CustomButton>
            )}
          </CustomBox>

          {/* Información de debug */}
          {!usersLoading && (
            <CustomBox style={{
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <Text size="small" color="neutral600">
                📊 Estado: {userOptions.length} usuarios encontrados | Cargando: {usersLoading ? 'Sí' : 'No'}
              </Text>
            </CustomBox>
          )}
          
          {selectedChatId && (
            <CustomBox style={{
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              border: '1px solid #bae6fd'
            }}>
              <Text size="small" color="blue600">
                📋 Usuario seleccionado: <strong>{selectedUsername}</strong> (Chat ID: {selectedChatId})
              </Text>
            </CustomBox>
          )}
        </CustomBox>

        {/* Resultados del diagnóstico */}
        {diagnosis && (
          <CustomBox style={{
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px'
          }}>
            <Text weight="bold" size="medium" color="black" style={{ marginBottom: '16px' }}>
              📊 Resultado del Diagnóstico
            </Text>

            {diagnosis.botInfo && (
              <CustomBox style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <Text weight="medium" size="small" color="blue600" style={{ marginBottom: '8px' }}>
                  🤖 Información del Bot
                </Text>
                <Text size="small" color="blue600">
                  ID: {diagnosis.botInfo.id} | Username: @{diagnosis.botInfo.username} | Nombre: {diagnosis.botInfo.first_name}
                </Text>
              </CustomBox>
            )}

            {diagnosis.errors && diagnosis.errors.length > 0 && (
              <CustomBox style={{
                padding: '16px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <Text weight="medium" size="small" color="red600" style={{ marginBottom: '8px' }}>
                  ❌ Errores
                </Text>
                {diagnosis.errors.map((error: string, index: number) => (
                  <Text key={index} size="small" color="red600" style={{ marginBottom: '4px' }}>
                    • {error}
                  </Text>
                ))}
              </CustomBox>
            )}

            {diagnosis.warnings && diagnosis.warnings.length > 0 && (
              <CustomBox style={{
                padding: '16px',
                backgroundColor: '#fffbeb',
                borderRadius: '8px'
              }}>
                <Text weight="medium" size="small" color="yellow600" style={{ marginBottom: '8px' }}>
                  ⚠️ Advertencias
                </Text>
                {diagnosis.warnings.map((warning: string, index: number) => (
                  <Text key={index} size="small" color="yellow600" style={{ marginBottom: '4px' }}>
                    • {warning}
                  </Text>
                ))}
              </CustomBox>
            )}
          </CustomBox>
        )}

        {/* Lista de usuarios de Telegram */}
        <CustomBox style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <CustomBox style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <Text weight="bold" size="medium" color="black">
              👥 Usuarios de Telegram Configurados
            </Text>
          </CustomBox>

          {usersLoading ? (
            <CustomBox style={{
              padding: '48px',
              textAlign: 'center'
            }}>
              <FaSpinner />
              <Text size="small" color="neutral600" style={{ marginTop: '8px' }}>
                Cargando usuarios...
              </Text>
            </CustomBox>
          ) : (
            <CustomBox>
              {telegramUsers.map((user: any) => (
                <CustomBox
                  key={user.id}
                  style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <CustomBox>
                    <Text weight="medium" size="small" color="black" style={{ marginBottom: '4px' }}>
                      {user.platformUser?.employee?.personalData?.fullName || user.name || 'Usuario sin nombre'}
                    </Text>
                    <Text size="small" color="neutral600">
                      Chat ID: {user.chatId} | Username: @{user.username || 'N/A'} | 
                      Estado: {user.isActive ? 'Activo' : 'Inactivo'}
                    </Text>
                  </CustomBox>

                  <CustomBox style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {getStatusIcon(getChatStatus(user.chatId))}
                    <CustomButton
                      onClick={() => testChatId(user.chatId)}
                      disabled={!user.chatId || isTestingChat}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        color: '#3b82f6',
                        border: '1px solid #3b82f6'
                      }}
                    >
                      <FaPlay /> Probar
                    </CustomButton>
                    <CustomButton
                      onClick={() => handleUserSelection(user.chatId)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        border: '1px solid #d1d5db'
                      }}
                    >
                      📋 Seleccionar
                    </CustomButton>
                  </CustomBox>
                </CustomBox>
              ))}
            </CustomBox>
          )}
        </CustomBox>

        {/* Resultados de pruebas */}
        {Object.keys(testResults).length > 0 && (
          <CustomBox style={{
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginTop: '24px'
          }}>
            <Text weight="bold" size="medium" color="black" style={{ marginBottom: '16px' }}>
              📋 Resultados de Pruebas
            </Text>

            {Object.entries(testResults).map(([chatId, result]) => (
              <CustomBox
                key={chatId}
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                  Chat ID: {chatId}
                </Text>
                
                {result.error ? (
                  <CustomBox style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text size="small" color="red600" style={{ whiteSpace: 'pre-line' }}>
                      ❌ Error: {result.error}
                    </Text>
                    {result.rawResponse && (
                      <CustomBox style={{ 
                        padding: '8px', 
                        backgroundColor: '#fef2f2', 
                        borderRadius: '4px',
                        border: '1px solid #fecaca'
                      }}>
                        <Text size="small" color="red600" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          📋 Detalles técnicos: {JSON.stringify(result.rawResponse, null, 2)}
                        </Text>
                      </CustomBox>
                    )}
                  </CustomBox>
                ) : (
                  <CustomBox style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.validation && (
                      <Text size="small" color="neutral600" style={{ whiteSpace: 'pre-line' }}>
                        🔍 Validación: {result.validation}
                      </Text>
                    )}
                    {result.testMessage && (
                      <Text size="small" color="neutral600" style={{ whiteSpace: 'pre-line' }}>
                        📱 Mensaje: {result.testMessage}
                      </Text>
                    )}
                    {result.rawResponse && (
                      <CustomBox style={{ 
                        padding: '8px', 
                        backgroundColor: '#f0f9ff', 
                        borderRadius: '4px',
                        border: '1px solid #bae6fd'
                      }}>
                        <Text size="small" color="blue600" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          📋 Respuesta completa: {JSON.stringify(result.rawResponse, null, 2)}
                        </Text>
                      </CustomBox>
                    )}
                    <Text size="small" color="neutral500">
                      ⏰ Prueba realizada: {new Date(result.timestamp).toLocaleString('es-ES')}
                    </Text>
                  </CustomBox>
                )}
              </CustomBox>
            ))}
          </CustomBox>
        )}
      </CustomBox>
    </PageContainer>
  );
}