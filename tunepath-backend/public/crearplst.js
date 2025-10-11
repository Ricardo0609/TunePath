// -----------------------
// TunePath - Playlist aleatoria por bloques de artistas + "Surprise mode"
// -----------------------
const access_token = 'BQCFoYAr2_eyXuBJ_8Zim4Q1LTc5Cvv4XFj7w6nySulCsFANbYrkB_kDZoKzfzgZ-SIZ8yPuHSSb90uxQQBaLy90xcHbaIexhX3hczszBAt5Z8hCv4oINe43KK1RZPaMfiX5oqREiEk-4Lh4u2bAQ5bVhEK06dDH66GidJEsT0RLyucOqwaeX6k7yAZZtx9WmCHz52nw-HDYE9nyqtykriddrgLqIzR8qoZA85-q1fhK2VPANk4lZPW3z1lAiHW29llsTWqte9PblbDwVrA1vpw5E0LgRqUgkqyadoG2W6HZ0EXXRBx9_n7QfglUobUt'
; // <-- pega tu token válido aquí

const newPlaylistBtn = document.getElementById("newplst");
const listenPlaylistBtn = document.getElementById("listnspt");
const cancionesContainer = document.getElementById("cancionesplst");
const loader = document.getElementById("loader");
const guardarBtn = document.getElementById("guardar");
const numCancionesInput = document.getElementById("numdcanc");
const surpriseBtn = document.getElementById("suprsbtn"); // nuevo botón

let currentPlaylistId = null;
let totalSongs = 25;
const songsPerArtist = 5;
let generatedTracks = [];

// -----------------------
// Helpers
// -----------------------
function getSavedFavorites() {
  return JSON.parse(localStorage.getItem("favoritos")) || [];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function chooseArtistsRandomly(favorites, neededCount) {
  if (!favorites.length) return [];
  const pool = [...favorites];
  shuffleArray(pool);
  const chosen = [];
  let idx = 0;
  while (chosen.length < neededCount) {
    chosen.push(pool[idx % pool.length]);
    idx++;
    if (idx >= pool.length) {
      shuffleArray(pool);
      idx = 0;
    }
  }
  return chosen;
}

// -----------------------
// Buscar canciones aleatorias por artista
// -----------------------
async function getRandomTracksByArtist(artistName, artistId, limit = 50) {
  try {
    const q = `artist:${encodeURIComponent('"' + artistName + '"')}`;
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const data = await res.json();
    const items = data.tracks?.items || [];
    const filtered = items.filter(t => t.artists.some(a => a.id === artistId));
    shuffleArray(filtered);
    return filtered.slice(0, songsPerArtist);
  } catch (err) {
    console.error("Error al obtener canciones:", err);
    return [];
  }
}

// -----------------------
// Obtener canciones por bloques de artistas
// -----------------------
async function getTracksGroupedByArtists(totalSongsRequested = 25, perArtist = songsPerArtist) {
  const favorites = getSavedFavorites();
  if (!favorites.length) {
    alert("No tienes artistas favoritos guardados.");
    return [];
  }

  const numArtistsNeeded = Math.ceil(totalSongsRequested / perArtist);
  const chosenArtists = chooseArtistsRandomly(favorites, numArtistsNeeded);

  let finalTracks = [];

  for (const artist of chosenArtists) {
    const artistTracks = await getRandomTracksByArtist(artist.name, artist.id, 50);
    finalTracks.push(...artistTracks.slice(0, perArtist));
    // ❌ Quitar esta línea para no cortar antes de tiempo
    // if (finalTracks.length >= totalSongsRequested) break;
  }

  // ⚡ Recortar al final para asegurar cantidad exacta
  if (finalTracks.length > totalSongsRequested) {
    finalTracks = finalTracks.slice(0, totalSongsRequested);
  }

  return finalTracks;
}


// -----------------------
// Obtener canciones sorpresa (recomendaciones)
// -----------------------
async function getRecommendedTracks(artistIds, limit = 5) {
  try {
    if (!Array.isArray(artistIds) || artistIds.length === 0) {
      console.error("No hay artistas para recomendaciones");
      return [];
    }

    const validIds = artistIds.slice(0, 5).join(","); // máximo 5 permitidos

    const res = await fetch(
      `https://api.spotify.com/v1/recommendations?limit=${limit}&seed_artists=${validIds}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!res.ok) {
      console.error("Error HTTP:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    return data.tracks || [];
  } catch (err) {
    console.error("Error al obtener recomendaciones:", err);
    return [];
  }
}


// -----------------------
// Crear playlist en Spotify
// -----------------------
async function createPlaylist(tracks) {
  if (!tracks.length) {
    alert("No hay canciones para crear la playlist.");
    return;
  }

  try {
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
        name: `My Playlist (${tracks.length} songs) 🎵`,
        description: "Playlist generada con mis bandas favoritas 🎶",
        public: false
      })
    });

    const plstData = await plstRes.json();
    currentPlaylistId = plstData.id;

    const uris = tracks.map(t => t.uri).filter(Boolean);
    await fetch(`https://api.spotify.com/v1/playlists/${currentPlaylistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uris })
    });
  } catch (err) {
    console.error("Error al crear playlist:", err);
  }
}

// -----------------------
// Render UI
// -----------------------
function renderTracks(tracks) {
  cancionesContainer.innerHTML = "";
  tracks.forEach(track => {
    const div = document.createElement("div");
    div.classList.add("cancion");
    div.innerHTML = `
      <img src="${track.album.images?.[0]?.url || ''}" alt="${track.name}" class="cancion__port">
      <h5 class="cancion__nom">${track.name}</h5>
    `;
    cancionesContainer.appendChild(div);
  });
}

// -----------------------
// Generar canciones sin crear playlist todavía
// -----------------------
async function generatePlaylist(cantidad = 25) {
  loader.style.display = "block";
  try {
    const tracks = await getTracksGroupedByArtists(cantidad, songsPerArtist);
    generatedTracks = tracks;
    renderTracks(tracks);
  } catch (err) {
    console.error("Error generando playlist:", err);
  } finally {
    loader.style.display = "none";
  }
}

// -----------------------
// Eventos
// -----------------------
newPlaylistBtn.addEventListener("click", async () => {
  await generatePlaylist(totalSongs);
});

listenPlaylistBtn.addEventListener("click", async () => {
  if (!generatedTracks.length) {
    alert("Primero genera la playlist con 'New playlist'.");
    return;
  }
  await createPlaylist(generatedTracks);
  if (currentPlaylistId)
    window.open(`https://open.spotify.com/playlist/${currentPlaylistId}`, "_blank");
});

guardarBtn.addEventListener("click", async () => {
  const valorInput = parseInt(numCancionesInput.value);
  if (!isNaN(valorInput) && valorInput > 0) totalSongs = valorInput;
  else totalSongs = 25;
  document.getElementById("ajustesOverlay").style.display = "none";
  await generatePlaylist(totalSongs);
});

// ---- NUEVO: Surprise mode ----
surpriseBtn.addEventListener("click", async () => {
  const recs = await getRecommendedTracks(5);
  if (recs.length) {
    generatedTracks.push(...recs);
    renderTracks(generatedTracks);
  } else {
    alert("No se pudieron obtener canciones recomendadas.");
  }
});

window.addEventListener("load", async () => {
  await generatePlaylist(totalSongs);
});


