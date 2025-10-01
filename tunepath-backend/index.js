import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public")); // sirve tus archivos de la carpeta public

// Spotify login
const client_id = "5c02c9bf325b4cdc9161cfe804105774";
const redirect_uri = "https://unimpeded-unsartorially-aliana.ngrok-free.dev/callback";

const scope = "user-read-private user-read-email";

app.get("/login", (req, res) => {
  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirect_uri)}`;
  res.redirect(authURL);
});

app.get("/callback", (req, res) => {
  const code = req.query.code || null;
  // aquí intercambiarías code por access token usando Spotify API
  res.cookie("loggedIn", true, { httpOnly: true });
  res.redirect("/selectbands.html"); // ahora redirige a selectbands.html
});

// Ruta principal
app.get("/", (req, res) => {
  const loggedIn = req.cookies.loggedIn; 
  if (loggedIn) {
    res.sendFile("index.html", { root: "public" });
  } else {
    res.sendFile("Login.html", { root: "public" });
  }
});

// Rutas de prueba/login simple
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    res.cookie("loggedIn", true, { httpOnly: true });
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("loggedIn");
  res.json({ success: true });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
