// -----------------------
// TunePath - Playlist aleatoria + Surprise Mode
// -----------------------
const access_token = 'BQC_-qYuuv7M93SgUluVbkoH92LsKk5F9sHQae94XbnqNio1k5ySLM9DjpNwWIPSzefSk6ENi_HtcPwLL3dmoXICfb9FXNTqFQEuDBoLSuMNi4tTHvY4Nzd8pPIfbMK6sLZciYVdR0JGWS4uioiVa__8g-W76sost1455MJIhb2x3WGUvrpQ7zxDxi9gvbv0H_L9tQI1S4OW0rflJIp78s98FZTkXNFRLXIKzEMiIzebwrsi5XPp3dCdk685BE5pD0R0ccGoPSOsoiXv72xm3rE_0WiM6kKR7xYXdeDnMlfcDHcw56Gzy2L4SpvS7btc';

const newPlaylistBtn = document.getElementById("newplst");
const listenPlaylistBtn = document.getElementById("listnspt");
const cancionesContainer = document.getElementById("cancionesplst");
const loader = document.getElementById("loader");
const guardarBtn = document.getElementById("guardar");
const numCancionesInput = document.getElementById("numdcanc");
const surpriseBtn = document.getElementById("suprsbtn");

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
    if (finalTracks.length >= totalSongsRequested) break;
  }

  return finalTracks.slice(0, totalSongsRequested);
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

    const validIds = artistIds
      .filter(id => typeof id === "string" && id.trim() !== "")
      .slice(0, 5)
      .join(",");

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
if (newPlaylistBtn) {
  newPlaylistBtn.addEventListener("click", async () => {
    await generatePlaylist(totalSongs);
  });
}

if (listenPlaylistBtn) {
  listenPlaylistBtn.addEventListener("click", async () => {
    if (!generatedTracks.length) {
      alert("Primero genera la playlist con 'New playlist'.");
      return;
    }
    await createPlaylist(generatedTracks);
    if (currentPlaylistId)
      window.open(`https://open.spotify.com/playlist/${currentPlaylistId}`, "_blank");
  });
}

if (guardarBtn) {
  guardarBtn.addEventListener("click", async () => {
    const valorInput = parseInt(numCancionesInput.value);
    totalSongs = !isNaN(valorInput) && valorInput > 0 ? valorInput : 25;
    document.getElementById("ajustesOverlay").style.display = "none";
    await generatePlaylist(totalSongs);
  });
}

// ---- NUEVO: Surprise mode ----
if (surpriseBtn) {
  surpriseBtn.addEventListener("click", async () => {
    try {
      const favorites = getSavedFavorites();
      if (!favorites.length) {
        alert("No tienes artistas favoritos guardados.");
        console.error("No hay artistas para recomendaciones");
        return;
      }

      const artistIds = favorites
        .map(a => a.id)
        .filter(id => typeof id === "string" && id.trim() !== "");

      if (!artistIds.length) {
        alert("No hay artistas válidos para recomendaciones.");
        return;
      }

      const recs = await getRecommendedTracks(artistIds, 5);
      if (recs.length > 0) {
        generatedTracks.push(...recs);
        renderTracks(generatedTracks);
        surpriseBtn.classList.add("btnprsionado");
      } else {
        surpriseBtn.classList.remove("btnprsionado");
        alert("No se pudieron obtener canciones recomendadas.");
      }
    } catch (err) {
      console.error("Error en Surprise Mode:", err);
      alert("Ocurrió un error al intentar obtener las recomendaciones.");
    }
  });
}

// -----------------------
// Autogenerar al cargar
// -----------------------
window.addEventListener("load", async () => {
  await generatePlaylist(totalSongs);
});

