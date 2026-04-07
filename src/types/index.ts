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
  'Certificado EPS',
  'Afiliación ARL',

  'Antecedentes Policía',
  'Antecedentes Contraloría',
  'Antecedentes Procuraduría',

  'RUT',
  'Firma',
  'Solicitud de Ingreso',
  'Solicitud de Retiro',

  // 🆕 NUEVO (si quieres que sea obligatorio)
  'Certificado de Cuenta',
];

export const TIPOS_DOCUMENTO = [
  'Hoja de Vida',
  'Cédula de Ciudadanía',
  'Contrato',

  'Certificado EPS',
  'Afiliación ARL',

  'RUT',
  'Firma',

  // 🔥 ANTECEDENTES
  'Antecedentes Policía',
  'Antecedentes Contraloría',
  'Antecedentes Procuraduría',

  'Solicitud de Ingreso',
  'Solicitud de Retiro',

  // 🆕 NUEVO
  'Certificado de Cuenta',

  'Otro',
];

export const CARGOS = [
  'CONTRATISTAS DE ADMINISTRACION',
  '5 - 6', '6 - 6', 'CARTON C', 'GUACANDA',
  'TERCERA', 'ROZO', '2 - 10', 'MAYORISTA', 'GUABINAS', 'BOLIVAR','GUABINAS','REMESAS'
];
