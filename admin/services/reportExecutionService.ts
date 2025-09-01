import { gql } from '@apollo/client';

// Mutación para crear un log de ejecución
export const CREATE_EXECUTION_LOG = gql`
  mutation CreateReportExecutionLog($data: ReportExecutionLogCreateInput!) {
    createReportExecutionLog(data: $data) {
      id
      status
      executionType
      message
      startTime
      endTime
      duration
      recipientsCount
      successfulDeliveries
      failedDeliveries
    }
  }
`;

// Mutación para actualizar un log de ejecución
export const UPDATE_EXECUTION_LOG = gql`
  mutation UpdateReportExecutionLog($id: ID!, $data: ReportExecutionLogUpdateInput!) {
    updateReportExecutionLog(where: { id: $id }, data: $data) {
      id
      status
      message
      endTime
      duration
      successfulDeliveries
      failedDeliveries
    }
  }
`;

// Query para obtener logs de ejecución de una configuración
export const GET_EXECUTION_LOGS = gql`
  query GetReportExecutionLogs($reportConfigId: ID!, $limit: Int = 10) {
    reportExecutionLogs(
      where: { reportConfig: { id: { equals: $reportConfigId } } }
      orderBy: [{ createdAt: desc }]
      take: $limit
    ) {
      id
      status
      executionType
      message
      startTime
      endTime
      duration
      recipientsCount
      successfulDeliveries
      failedDeliveries
      createdAt
    }
  }
`;

// Interfaz para el log de ejecución
export interface ReportExecutionLog {
  id: string;
  status: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'CANCELLED';
  executionType: 'AUTOMATIC' | 'MANUAL' | 'TEST';
  message: string;
  errorDetails?: string;
  recipientsCount: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  cronExpression?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

// Interfaz para crear un log de ejecución
export interface CreateExecutionLogData {
  reportConfig: { connect: { id: string } };
  status: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'CANCELLED';
  executionType: 'AUTOMATIC' | 'MANUAL' | 'TEST';
  message: string;
  errorDetails?: string;
  recipientsCount: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  startTime: string;
  cronExpression?: string;
  timezone?: string;
}

// Interfaz para actualizar un log de ejecución
export interface UpdateExecutionLogData {
  status?: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'CANCELLED';
  message?: string;
  errorDetails?: string;
  endTime?: string;
  duration?: number;
  successfulDeliveries?: number;
  failedDeliveries?: number;
}

// Función para crear un log de ejecución
export const createExecutionLog = async (
  client: any,
  data: CreateExecutionLogData
): Promise<ReportExecutionLog> => {
  try {
    const result = await client.mutate({
      mutation: CREATE_EXECUTION_LOG,
      variables: { data }
    });
    
    return result.data.createReportExecutionLog;
  } catch (error) {
    console.error('❌ Error creando log de ejecución:', error);
    throw error;
  }
};

// Función para actualizar un log de ejecución
export const updateExecutionLog = async (
  client: any,
  id: string,
  data: UpdateExecutionLogData
): Promise<ReportExecutionLog> => {
  try {
    const result = await client.mutate({
      mutation: UPDATE_EXECUTION_LOG,
      variables: { id, data }
    });
    
    return result.data.updateReportExecutionLog;
  } catch (error) {
    console.error('❌ Error actualizando log de ejecución:', error);
    throw error;
  }
};

// Función para obtener logs de ejecución
export const getExecutionLogs = async (
  client: any,
  reportConfigId: string,
  limit: number = 10
): Promise<ReportExecutionLog[]> => {
  try {
    const result = await client.query({
      query: GET_EXECUTION_LOGS,
      variables: { reportConfigId, limit }
    });
    
    return result.data.reportExecutionLogs;
  } catch (error) {
    console.error('❌ Error obteniendo logs de ejecución:', error);
    throw error;
  }
};
