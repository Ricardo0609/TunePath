// ⚡ Este archivo maneja el buscador de bandas en selectbands.html

// ⚠️ IMPORTANTE: necesitas pasar el access_token que obtuviste al loguearte con Spotify.
// De momento puedes ponerlo a mano para probar, pero después lo vamos a manejar bien con OAuth.
const access_token = 'BQDSxyQc9pOObo2h6xlxWnIibtPSDzCnSF9vwCHazePlUP1NE61ZcutP_3oFoM6ly7BUKiFVPKOOkg-0Zdt8VZVOslWx-xO2gYGr-d-grYV90kkFkeqvI7plnSZGWf9HmKnwHSmTORAL1TIZn6ezhBwYvizYMLH917jy8HFFDWi5q3_5VBi4ogj6hlJqZ2CA3eolY1Y4RaLZK-3VrF0Nn2Olt7wkx0WVv3dlj6Q6JhBMM6PICmJGpU5fcEm6QBTd9yKQBimAnmM1bkxVV43N3na6mnp3TYy1qq69c93seyJL7N2or1JMRzYPMDBaP-C1';  

// Función para buscar artistas en la API de Spotify
async function searchArtist(query) {
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`, {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });
  const data = await response.json();
  return data.artists.items; // devuelve la lista de artistas
}

// Función para mostrar artistas en el contenedor #bands
function displayArtists(artists) {
  const container = document.getElementById("bands");
  container.innerHTML = ""; // limpiar antes de mostrar

  artists.forEach(artist => {
    const imgUrl = artist.images[0] ? artist.images[0].url : "https://via.placeholder.com/150";

    const artistDiv = document.createElement("div");
    artistDiv.classList.add("artist-card");
    artistDiv.innerHTML = `
      <img src="${imgUrl}" alt="${artist.name}" width="100" height="100" style="border-radius:50%">
      <p style="color:white;">${artist.name}</p>
    `;
    container.appendChild(artistDiv);
  });
}

// Evento al escribir en el input
document.getElementById("buscbands").addEventListener("keyup", async (e) => {
  const query = e.target.value.trim();
  if (query.length > 2) { // solo buscar si hay al menos 3 letras
    const artists = await searchArtist(query);
    displayArtists(artists);
  } else {
    document.getElementById("bands").innerHTML = "";
  }
});






// Recuperar favoritos desde localStorage al cargar
let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];

// Función para buscar artistas en la API de Spotify
async function searchArtist(query) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    }
  );
  const data = await response.json();
  return data.artists.items; // devuelve la lista de artistas
}

// Función para mostrar artistas en el contenedor #bands
function displayArtists(artists) {
  const container = document.getElementById("bands");
  container.innerHTML = ""; // limpiar antes de mostrar

  artists.forEach(artist => {
    const imgUrl = artist.images[0] ? artist.images[0].url : "https://via.placeholder.com/150";

    const artistDiv = document.createElement("div");
    artistDiv.classList.add("artist-card");
    artistDiv.innerHTML = `
      <img src="${imgUrl}" alt="${artist.name}" width="100" height="100" style="border-radius:50%">
      <p style="color:white;">${artist.name}</p>
    `;

    // Al hacer click, añadir a favoritos
    artistDiv.addEventListener("click", () => addToFavorites(artist));

    container.appendChild(artistDiv);
  });
}

// Función para mostrar favoritos en el div#bandsfavsmias
function renderFavorites() {
  const favContainer = document.getElementById("bandsfavsmias");
  favContainer.innerHTML = "";

  favoritos.forEach(artist => {
    const favDiv = document.createElement("div");
    favDiv.classList.add("fav-artist");
    favDiv.innerHTML = `
      <img src="${artist.imgUrl}" alt="${artist.name}" width="80" height="80" style="border-radius:50%">
      <p style="color:white;">${artist.name}</p>
    `;
    favContainer.appendChild(favDiv);
  });
}

// Función para añadir a favoritos (sin duplicados)
function addToFavorites(artist) {
  const imgUrl = artist.images[0] ? artist.images[0].url : "https://via.placeholder.com/150";

  // Verificar si ya está en favoritos
  const exists = favoritos.some(fav => fav.id === artist.id);
  if (!exists) {
    favoritos.push({
      id: artist.id,
      name: artist.name,
      imgUrl: imgUrl
    });

    // Guardar en localStorage
    localStorage.setItem("favoritos", JSON.stringify(favoritos));

    // Renderizar de nuevo
    renderFavorites();
  }
}

// Evento al escribir en el input
document.getElementById("buscbands").addEventListener("keyup", async (e) => {
  const query = e.target.value.trim();
  if (query.length > 2) { // solo buscar si hay al menos 3 letras
    const artists = await searchArtist(query);
    displayArtists(artists);
  } else {
    document.getElementById("bands").innerHTML = "";
  }
});

// Mostrar favoritos al cargar la página
renderFavorites();























/*// ⚡ Este archivo maneja el buscador de bandas en selectbands.html

// ⚠️ IMPORTANTE: necesitas pasar el access_token que obtuviste al loguearte con Spotify.
// De momento puedes ponerlo a mano para probar, pero después lo vamos a manejar bien con OAuth.
// 🔑 Función para extraer el token del hash de la URL
function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

// Si el token viene en la URL después del login
const tokenFromUrl = getAccessTokenFromUrl();
if (tokenFromUrl) {
  localStorage.setItem("spotify_access_token", tokenFromUrl);
  // Limpiar el hash de la URL para que se vea más limpio
  window.history.replaceState({}, document.title, "/selectbands.html");
}

// Recuperar el token guardado
const access_token = localStorage.getItem("spotify_access_token");







// Función para buscar artistas en la API de Spotify
async function searchArtist(query) {
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`, {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });
  const data = await response.json();

  if (data.error) {
    console.error("Error con el token:", data.error);
    alert("Tu sesión expiró, vuelve a iniciar sesión con Spotify.");
    localStorage.removeItem("spotify_access_token");
    window.location.href = "login.html"; // te regresa al login
    return [];
  }

  return data.artists.items;
}


// Función para mostrar artistas en el contenedor #bands
function displayArtists(artists) {
  const container = document.getElementById("bands");
  container.innerHTML = ""; // limpiar antes de mostrar

  artists.forEach(artist => {
    const imgUrl = artist.images[0] ? artist.images[0].url : "https://via.placeholder.com/150";

    const artistDiv = document.createElement("div");
    artistDiv.classList.add("artist-card");
    artistDiv.innerHTML = `
      <img src="${imgUrl}" alt="${artist.name}" width="100" height="100" style="border-radius:50%">
      <p style="color:white;">${artist.name}</p>
    `;
    container.appendChild(artistDiv);
  });
}

// Evento al escribir en el input
document.getElementById("buscbands").addEventListener("keyup", async (e) => {
  const query = e.target.value.trim();
  if (query.length > 2) { // solo buscar si hay al menos 3 letras
    const artists = await searchArtist(query);
    displayArtists(artists);
  } else {
    document.getElementById("bands").innerHTML = "";
  }
});
*/

