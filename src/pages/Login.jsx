import { initiateLogin } from '../utils/auth';

const FEATURES = [
  { icon: '🎲', text: <><strong>Smart Mix</strong> — a playlist built from your favorite artists in one click</> },
  { icon: '🔭', text: <><strong>Discover</strong> — new tracks surfaced from the genres you already love</> },
  { icon: '💿', text: <><strong>Save straight to Spotify</strong> — no downloads, no exports, just play</> },
];

export default function Login() {
  return (
    <div className="login-page">
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card fade-up">
        <h1 className="login-logo">Tune<span>Path</span></h1>
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

        <p className="login-footer">We never store your data on any server.</p>
      </div>
    </div>
  );
}
