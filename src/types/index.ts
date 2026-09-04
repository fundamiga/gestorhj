export interface Expediente {
  id: string;
  cedula: string;
  nombre: string;
  cargo: string;
  fecha_ingreso: string;
  estado: 'Activo' | 'Retirado';
  fecha_retiro?: string;
  observaciones?: string;
  creado_at?: string;
  es_remesa?: boolean;
  correo?: string;
  telefono?: string;
}

export interface DocumentoExpediente {
  id: string;
  expediente_id: string;
  nombre_archivo: string;
  tipo_documento: string;
  url: string;
  storage_path: string;
  subido_at?: string;
  fecha_vencimiento?: string;
  notas?: string;
}

export const DOCUMENTOS_ESENCIALES = [
  'Hoja de Vida',
  'Cédula de Ciudadanía',
  'Contrato',
  'Certificado EPS', // ✅ corregido
  'Afiliación ARL',
   'Antecedentes Policía',
  'Antecedentes Contraloría',
  'Antecedentes Procuraduría',
  'RUT',
  'Firma',
  'Solicitud de Ingreso',
  'Solicitud de Retiro',
  'Certificado de cuenta',
];

export const TIPOS_DOCUMENTO = [
  'Hoja de Vida',
  'Cédula de Ciudadanía',
  'Contrato',

  
  'Certificado EPS', // ✅ corregido

  'Afiliación ARL',

  'RUT',
  'Firma',

  // 🔥 ANTECEDENTES (te faltaban aquí)
  'Antecedentes Policía',
  'Antecedentes Contraloría',
  'Antecedentes Procuraduría',

  
  'Solicitud de Ingreso',
  'Solicitud de Retiro',
  'Certificado de cuenta',
  'Otro',
];

export const CARGOS = [
  'CONTRATISTAS DE ADMINISTRACION',
  '5 - 6', '6 - 6', 'CARTON C', 'GUACANDA',
  'TERCERA', 'ROZO', '2 - 10', 'MAYORISTA', 'GUABINAS', 'BOLIVAR', 'REMESAS'
];

export interface RegistroAuditoria {
  id: string;
  ip_address: string;
  dispositivo_nombre: string;
  sistema_operativo: string;
  navegador: string;
  resolucion_pantalla: string;
  user_agent: string;
  accion_realizada: string;
  detalles?: Record<string, any>;
  fecha_registro: string;
}

