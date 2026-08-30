import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './utils/auth';
import Login from './pages/Login';
import Callback from './pages/Callback';
import ArtistSelect from './pages/ArtistSelect';
import Main from './pages/Main';

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/select" element={<PrivateRoute><ArtistSelect /></PrivateRoute>} />
        <Route path="/app" element={<PrivateRoute><Main /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
