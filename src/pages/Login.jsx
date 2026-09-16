import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initiateLogin, isLoggedIn } from '../utils/auth';

const FEATURES = [
  { icon: '🎲', text: <><strong>Smart Mix</strong> — una playlist de tus artistas favoritos en un clic</> },
  { icon: '🔭', text: <><strong>Discover</strong> — bandas emergentes de los géneros que ya te gustan</> },
  { icon: '💿', text: <><strong>Guarda en Spotify</strong> — sin descargas ni exportaciones, sólo darle play</> },
];

export default function Login() {
  const navigate = useNavigate();
  // Empieza oculta: si ya hay sesión evitamos el parpadeo de la portada
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      // Ya hay sesión: entramos directo, sin pedir el clic otra vez.
      // Si aún no eligió artistas, lo mandamos a la selección.
      const tieneArtistas = (() => {
        try {
          return (JSON.parse(localStorage.getItem('ws_artists')) || []).length > 0;
        } catch {
          return false;
        }
      })();
      navigate(tieneArtistas ? '/app' : '/select', { replace: true });
      return;
    }
    setVerificando(false);
  }, [navigate]);

  if (verificando) {
    return (
      <div className="callback-page">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card fade-up">
        <h1 className="login-logo">TUNE<span>PATH</span></h1>
        <p className="login-tagline">Stop overthinking. Start listening.</p>

        <div className="login-features stagger">
          {FEATURES.map((f, i) => (
            <div className="login-feature" key={i}>
              <span className="login-feature-icon">{f.icon}</span>
              <span className="login-feature-text">{f.text}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-spotify" onClick={initiateLogin}>
          Connect with Spotify
        </button>

        <p className="login-footer">Nunca guardamos tus datos en ningún servidor.</p>
      </div>
    </div>
  );
}
