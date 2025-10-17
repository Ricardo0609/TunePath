document.addEventListener("DOMContentLoaded", () => {
  function debounce(fn, wait = 500) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const inputInfo = document.getElementById("buscbandsinfo");
  const bandResultsDiv = document.getElementById("bandsselinfo");
  const bandHistoryDiv = document.getElementById("bandhistory");
  const albumsDiv = document.getElementById("albums");

  // --- Buscar coincidencias (sugerencias) ---
  async function searchBands(query) {
    const url = `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.artists || [];
  }

  // --- Obtener información completa de la banda ---
  async function getBandInfo(band) {
    const url = `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(band)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.artists ? data.artists[0] : null;
  }

  // --- Obtener álbumes (combinando MusicBrainz + TheAudioDB) ---
  async function getBandAlbums(band) {
    try {
      // Buscar artista en MusicBrainz
      const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(band)}&fmt=json&limit=1`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      if (!data.artists?.length) return [];

      const artistId = data.artists[0].id;
      const albumsUrl = `https://musicbrainz.org/ws/2/release-group?artist=${artistId}&type=album&fmt=json&limit=100`;
      const albumsRes = await fetch(albumsUrl);
      const albumsData = await albumsRes.json();

      // Filtrar álbumes principales (no remasters, compilaciones, etc.)
      const filtered = albumsData["release-groups"]
        .filter(a =>
          a["first-release-date"] &&
          !/live|remaster|compilation|greatest|collection|soundtrack|mix/i.test(a.title)
        )
        .sort((a, b) => new Date(a["first-release-date"]) - new Date(b["first-release-date"]))
        .slice(0, 15); // máximo 15 álbumes

      // Buscar imágenes desde TheAudioDB
      const imgPromises = filtered.map(async a => {
        const albumUrl = `https://www.theaudiodb.com/api/v1/json/2/searchalbum.php?s=${encodeURIComponent(
          band
        )}&a=${encodeURIComponent(a.title)}`;
        const imgRes = await fetch(albumUrl);
        const imgData = await imgRes.json();
        const thumb = imgData?.album?.[0]?.strAlbumThumb || "https://via.placeholder.com/100";
        return {
          strAlbum: a.title,
          intYearReleased: a["first-release-date"].split("-")[0],
          strAlbumThumb: thumb
        };
      });

      return await Promise.all(imgPromises);
    } catch (e) {
      console.error("Error obteniendo álbumes:", e);
      return [];
    }
  }

  // --- Mostrar lista de sugerencias ---
  function showBandSuggestions(bands) {
    bandResultsDiv.innerHTML = "";
    bands.forEach(band => {
      const div = document.createElement("div");
      div.className = "band-suggestion";
      div.style = "display:flex;align-items:center;gap:10px;cursor:pointer;margin:6px 0;padding:5px;border-radius:10px;background-color:#111;";
      div.innerHTML = `
        <img src="${band.strArtistThumb || "https://via.placeholder.com/70"}" width="90" height="90" style="border-radius:50%;object-fit:cover;">
        <span style="color:white;font-size:1rem;">${band.strArtist}</span>
      `;
      div.addEventListener("click", () => displayBandData(band.strArtist));
      bandResultsDiv.appendChild(div);
    });
  }

  // --- Mostrar toda la información ---
  async function displayBandData(band) {
    bandResultsDiv.innerHTML = `<p style="color:white;">Cargando información...</p>`;
    bandHistoryDiv.innerHTML = "";
    albumsDiv.innerHTML = "";

    const info = await getBandInfo(band);
    const albums = await getBandAlbums(band);

    if (!info && !albums.length) {
      bandResultsDiv.innerHTML = `<p style="color:white;">No se encontró información.</p>`;
      return;
    }

    // --- Información general ---
    if (info) {
      bandResultsDiv.innerHTML = `
        <div class="cajaprba" style="display:flex;align-items:center;gap:15px;margin-bottom:10px;">
          <h1 style="color:#1DB6FF;margin:0;">${info.strArtist}</h1>
          <img class="imginfo" src="${info.strArtistThumb || "https://via.placeholder.com/150"}" >
          <div >
          <div class="infopeg">
          
            <p  >-Country: ${info.strCountry || "—"}</p>
             <p  > -Genere: ${info.strGenre || "—"}</p>
              <p  >-Year: ${info.intFormedYear || "—"}</p>
            <p >-members: ${info.intMembers || "No disponible"}</p>
            </div>
          </div>
        </div>
      `;
    }

    // --- Historia (desplegable) ---
    bandHistoryDiv.innerHTML = `
      <details close style="margin-top:15px;">
        <summary >History</summary>
        <div style="max-height:200px;overflow-y:auto;margin-top:10px;padding-right:10px;">
          <p style="color:white;white-space:pre-wrap;">
            ${info?.strBiographyEN || info?.strBiographyES || "No hay biografía disponible."}
          </p>
        </div>
      </details>
    `;

    // --- Álbumes (con imagen y año) ---
    albumsDiv.innerHTML = `
      <details open style="margin-top:15px;">
        <summary >Albums</summary>
        <div style="max-height:300px;overflow-y:auto;margin-top:10px;padding-right:10px;">
          ${albums.length
        ? albums.map(a => `
                <div style="display:flex;align-items:center;gap:15px;margin-bottom:10px;">
                  <img src="${a.strAlbumThumb}" width="100" height="100" style="border-radius:8px;object-fit:cover;">
                  <p style="color:white;margin:0;">${a.intYearReleased || "?"} — ${a.strAlbum}</p>
                </div>
              `).join("")
        : `<p style="color:white;">No hay álbumes oficiales registrados.</p>`
      }
        </div>
      </details>
    `;
  }

  // --- Input buscador ---
  if (inputInfo) {
    inputInfo.addEventListener(
      "keyup",
      debounce(async (e) => {
        const q = e.target.value.trim();
        if (q.length >= 3) {
          const bands = await searchBands(q);
          if (bands.length > 0) showBandSuggestions(bands);
          else bandResultsDiv.innerHTML = `<p style="color:white;">No hay coincidencias.</p>`;
        } else {
          bandResultsDiv.innerHTML = "";
        }
      }, 400)
    );
  }
});
