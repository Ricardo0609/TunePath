const access_token = 'BQCaXvcY0-uV0n-iQXmowekS-O9B7t4bkAdzRgklm30U0whWErJMoHlG6JblbJIFYzoQpLjs4A7E-Z9VSKNWXYad3u-QBB-uXWRX7tTusS7DRrNZNHnnGHsZOAwSEJs6kRxO2d0clDMUwDyrlRbDChmFwTYCdw0kNYKuBPIK38nzpjpY0SVtOJ68IhbzAjCUxE_K01kviyu8qosCBIrxpBXtUyBISm2yplZD7G9Spe_YVS50FsEimm6EIGjeeUwGCJNhIFtQ1akFunr1DFfVDM-B-MAhg-tg2b1K7vYUTIbHt1ZQ0cyKOVlkSF-JonvH';

const newPlaylistBtn = document.getElementById("newplst");
const listenPlaylistBtn = document.getElementById("listnspt");
const cancionesContainer = document.getElementById("cancionesplst");
const loader = document.getElementById("loader");

let currentPlaylistId = null;
let currentTrackUris = [];

// 🔥 1. Función para obtener canciones de una banda
async function getTracksFromArtist(artistId, limit = 5) {
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    }
  );
  const data = await response.json();
  return data.tracks.slice(0, limit); // Obtener solo los primeros 'limit'
}

// 🔥 2. Obtener canciones de todas las bandas guardadas (aleatorias)
async function getTracksFromFavorites() {
  const favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
  let tracks = [];

  for (let artist of favoritos) {
    const artistTracks = await getTracksFromArtist(artist.id, 20); // más canciones por banda
    shuffleArray(artistTracks); // mezclamos canciones
    tracks = tracks.concat(artistTracks.slice(0, 5)); // tomamos canciones aleatorias
  }

  shuffleArray(tracks); // mezclar todas las canciones
  return tracks.slice(0, 25); // Limitar a 25 canciones totales
}

// Función para mezclar un array (Fisher-Yates Shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}


// 🔥 3. Crear playlist en Spotify
async function createPlaylist(tracks) {
  const userRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const userData = await userRes.json();

  const plstRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "My Favorites Playlist 🎵",
      description: "Playlist generada con mis bandas favoritas",
      public: false
    })
  });

  const plstData = await plstRes.json();
  currentPlaylistId = plstData.id;

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

// 🔥 4. Mostrar canciones
function renderTracks(tracks) {
  cancionesContainer.innerHTML = "";
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

// 📌 Botón "New playlist"
newPlaylistBtn.addEventListener("click", async () => {
  loader.style.display = "block";

  const tracks = await getTracksFromFavorites();
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

// 🚀 Generar playlist automáticamente al cargar la página
window.onload = async () => {
  loader.style.display = "block";

  const tracks = await getTracksFromFavorites();
  currentTrackUris = tracks;

  renderTracks(tracks);
  await createPlaylist(tracks);

  loader.style.display = "none";
};
