/**
 * Módulo de Rastreo Silencioso e Invisible
 * Detecta plataforma, sistema operativo, navegador y envía métricas en segundo plano.
 */

export function parseDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      sistemaOperativo: 'Servidor',
      navegador: 'Servidor',
      dispositivoNombre: 'Servidor',
      resolucionPantalla: 'N/A',
      userAgent: ''
    };
  }

  const ua = navigator.userAgent || '';
  
  // Detectar Sistema Operativo
  let sistemaOperativo = 'Desconocido';
  if (ua.includes('Win')) sistemaOperativo = 'Windows';
  if (ua.includes('Mac')) sistemaOperativo = 'macOS';
  if (ua.includes('Linux')) sistemaOperativo = 'Linux';
  if (ua.includes('Android')) sistemaOperativo = 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) sistemaOperativo = 'iOS';

  if (ua.includes('Windows NT 10.0')) sistemaOperativo = 'Windows 10/11';
  if (ua.includes('Windows NT 6.3')) sistemaOperativo = 'Windows 8.1';
  if (ua.includes('Windows NT 6.1')) sistemaOperativo = 'Windows 7';

  // Detectar Navegador / Cliente
  let navegador = 'Otro Navegador';
  if (ua.includes('Electron')) {
    navegador = 'Aplicación de Escritorio (Electron)';
  } else if (ua.includes('Edg/')) {
    navegador = 'Microsoft Edge';
  } else if (ua.includes('Chrome/')) {
    navegador = 'Google Chrome';
  } else if (ua.includes('Firefox/')) {
    navegador = 'Mozilla Firefox';
  } else if (ua.includes('Safari/')) {
    navegador = 'Apple Safari';
  }

  // Nombre representativo del dispositivo
  const esMobile = /Mobile|Android|iP(hone|ad)/.test(ua);
  const dispositivoNombre = ua.includes('Electron')
    ? `PC Escritorio (${sistemaOperativo})`
    : esMobile
    ? `Dispositivo Móvil (${sistemaOperativo})`
    : `PC (${sistemaOperativo})`;

  const resolucionPantalla = `${window.screen?.width || 0}x${window.screen?.height || 0}`;

  return {
    sistemaOperativo,
    navegador,
    dispositivoNombre,
    resolucionPantalla,
    userAgent: ua
  };
}

export async function registrarRastreoSilencioso(accionRealizada: string = 'APERTURA_APP', detalles: any = null) {
  try {
    const info = parseDeviceInfo();
    
    // Ejecución asíncrona sin bloquear la UI ni lanzar errores
    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...info,
        accionRealizada,
        detalles
      })
    }).catch(() => {
      // Ignorar cualquier fallo de red de forma silenciosa
    });
  } catch (e) {
    // Ignorar excepciones de manera imperceptible
  }
}
