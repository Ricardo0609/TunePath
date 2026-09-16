import { useEffect, useState } from 'react';

/**
 * Botón de instalación de la PWA.
 *
 * Android / Chrome / Edge de escritorio: el navegador dispara el evento
 * `beforeinstallprompt`, lo guardamos y al pulsar mostramos el diálogo
 * nativo de instalación.
 *
 * iOS (Safari): NO existe esa API. Apple obliga a instalar manualmente
 * desde Compartir → Añadir a pantalla de inicio, así que ahí mostramos
 * las instrucciones en vez de intentar instalar.
 */
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [instalada, setInstalada] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);

  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    // Ya está corriendo instalada: no tiene sentido ofrecer descargarla
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) setInstalada(true);

    function onPrompt(e) {
      e.preventDefault();       // evita el banner automático del navegador
      setPrompt(e);
    }
    function onInstalled() {
      setInstalada(true);
      setPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleClick() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    // iOS, o navegador que aún no disparó el evento
    setMostrarAyuda(true);
  }

  if (instalada) return null;
  // En escritorios sin soporte no mostramos nada; en iOS sí, con ayuda
  if (!prompt && !esIOS) return null;

  return (
    <>
      <button
        className="mode-tab tab-install"
        onClick={handleClick}
        title="Instalar TunePath"
      >
        ⬇ Download
      </button>

      {mostrarAyuda && (
        <>
          <div className="settings-overlay" onClick={() => setMostrarAyuda(false)} />
          <div className="install-help">
            <h3>Instalar TunePath</h3>
            {esIOS ? (
              <ol>
                <li>Abre esta página en <strong>Safari</strong> (no Chrome).</li>
                <li>Toca el botón <strong>Compartir</strong> (el cuadrito con la flecha).</li>
                <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
                <li>Confirma con <strong>Añadir</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Abre el menú del navegador (los tres puntos).</li>
                <li>Busca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li>
                <li>Confirma la instalación.</li>
              </ol>
            )}
            <button className="btn btn-accent" onClick={() => setMostrarAyuda(false)}>
              Entendido
            </button>
          </div>
        </>
      )}
    </>
  );
}