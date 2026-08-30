import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCode } from '../utils/auth';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('You cancelled the Spotify login.');
      return;
    }

    if (!code) {
      setError('Missing authorization code.');
      return;
    }

    exchangeCode(code)
      .then(() => {
        const hasArtists = localStorage.getItem('ws_artists');
        navigate(hasArtists ? '/app' : '/select', { replace: true });
      })
      .catch(err => setError(err.message || 'Login failed.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="callback-page">
      {error ? (
        <>
          <p className="callback-text">{error}</p>
          <button className="btn btn-accent" onClick={() => navigate('/', { replace: true })}>
            Back to login
          </button>
        </>
      ) : (
        <>
          <div className="spinner spinner-lg" />
          <p className="callback-text">Connecting to Spotify…</p>
        </>
      )}
    </div>
  );
}
