document.addEventListener("DOMContentLoaded", () => {
  // Botón de login con Spotify
  const btnLogin = document.getElementById("btnlogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      window.location.href = "/login";
    });
  }

  // Menú lateral
  const menuBtn = document.querySelector('#menubtn');
  const sideMenu = document.querySelector('.side-menu');
  const overlay = document.querySelector('.overlay');

  if (menuBtn && sideMenu && overlay) {
    menuBtn.addEventListener('click', () => {
      sideMenu.classList.toggle('show');
      overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
      sideMenu.classList.remove('show');
      overlay.classList.remove('show');
    });
  }
});
