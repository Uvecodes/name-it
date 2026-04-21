document.addEventListener('DOMContentLoaded', () => {
  const navbars = document.querySelectorAll('.navbar .nav-flex');

  navbars.forEach((nav) => {
    const hamburger = nav.querySelector('.hamburger');
    const menu = nav.querySelector('.nav-menu');

    if (!hamburger || !menu) {
      return;
    }

    const closeMenu = () => {
      hamburger.classList.remove('active');
      menu.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    };

    const toggleMenu = () => {
      const isOpen = hamburger.classList.toggle('active');
      menu.classList.toggle('active', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    hamburger.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    menu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        closeMenu();
      }
    });
  });
});



