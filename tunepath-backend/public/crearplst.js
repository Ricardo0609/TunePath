// ⚠️ Pega aquí tu access token manual de Spotify
const access_token = 'BQCZeJs9Q917Cfk6yUnOyg0v0fzvnYUHImOIiiqHyXRE5KeLufEsJ1CXkbTq_fZU5XlNLDzBV_BsKgR4z67U7_Ly4OVtWhmBkV-qi9a-R6lNeNpFZ1CqpvLxztH0Z387_l3kzWPh4E0kzOlT0IqZgMqIs8Y4Aq6bDmNq81f6318rRYCUVhIJ8mQrK_a8TbkGBET4unsTKEz9g1q0nx_tAPDEYQxQHUdvuJF5x-MCmXzms0KiWlX-U1n0IC44IlAHAQUAAKxLQIYMBnpbM3wDGyPJ1rqDl0UABeJ5ti2AXzWEzv-33Aln9MqWp_fff-fo';

const newPlaylistBtn = document.getElementById("newplst");
const listenPlaylistBtn = document.getElementById("listnspt");
const cancionesContainer = document.getElementById("cancionesplst");

let currentPlaylistId = null; // guardamos el ID de la playlist creada
let currentTrackUris = [];    // canciones random seleccionadas

// 🔥 1. Función para obtener canciones aleatorias
async function getRandomTracks(limit = 25) {
  // letra random para buscar canciones
  const randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26));

  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${randomLetter}&type=track&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    }
  );

  const data = await response.json();
  return data.tracks.items;
}

// 🔥 2. Crear playlist en la cuenta del usuario
async function createPlaylist(tracks) {
  // obtener perfil del usuario para saber el user_id
  const userRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const userData = await userRes.json();

  // crear playlist
  const plstRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "My Random Playlist 🎵",
      description: "La mejor playlist para tu día a día",
      public: false
    })
  });

  const plstData = await plstRes.json();
  currentPlaylistId = plstData.id;

  // agregar canciones a la playlist
  await fetch(`https://api.spotify.com/v1/playlists/${currentPlaylistId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uris: tracks.map(t => t.uri)
    })
  });
}

// 🔥 3. Mostrar canciones en el div
function renderTracks(tracks) {
  cancionesContainer.innerHTML = ""; // limpiar antes de mostrar
  tracks.forEach(track => {
    const songDiv = document.createElement("div");
    songDiv.classList.add("cancion");
    songDiv.innerHTML = `
      <img src="${track.album.images[0]?.url}" alt="" class="cancion__port">
      <h5 class="cancion__nom">${track.name}</h5>
    `;
    cancionesContainer.appendChild(songDiv);
  });
}

const loader = document.getElementById("loader");

// 📌 Botón "New playlist"
newPlaylistBtn.addEventListener("click", async () => {
  loader.style.display = "block"; // mostrar loader

  const tracks = await getRandomTracks(25);
  currentTrackUris = tracks;

  // mostrar en pantalla
  renderTracks(tracks);

  // crear playlist en Spotify
  await createPlaylist(tracks);

  loader.style.display = "none"; // ocultar loader
});

// 📌 También en carga inicial (si lo tienes activado con DOMContentLoaded)
window.addEventListener("DOMContentLoaded", async () => {
  loader.style.display = "block";
  const tracks = await getRandomTracks(25);
  currentTrackUris = tracks;
  renderTracks(tracks);
  await createPlaylist(tracks);
  loader.style.display = "none";
});


// 📌 Botón "Listen playlist"
listenPlaylistBtn.addEventListener("click", () => {
  if (currentPlaylistId) {
    window.open(`https://open.spotify.com/playlist/${currentPlaylistId}`, "_blank");
  } else {
    alert("Primero genera una playlist con 'New playlist'");
  }
});

// 🔥 4. Función central para generar playlist
async function generatePlaylist() {
  const tracks = await getRandomTracks(25);
  currentTrackUris = tracks;
  renderTracks(tracks);
  await createPlaylist(tracks);
}

// 🚀 Crear playlist automáticamente al cargar la página
window.onload = async () => {
  await generatePlaylist();
};

