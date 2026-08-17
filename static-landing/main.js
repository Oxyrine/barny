document.addEventListener("DOMContentLoaded", () => {
  // Mobile Menu
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.mobile-overlay');
  const menu = document.querySelector('.mobile-menu');
  
  function closeMenu() {
    document.body.classList.remove('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.classList.add('hidden');
    if (menu) menu.classList.add('hidden');
  }

  function toggleMenu() {
    const isExpanded = burger.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu();
    } else {
      document.body.classList.add('menu-open');
      burger.setAttribute('aria-expanded', 'true');
      overlay.classList.remove('hidden');
      menu.classList.remove('hidden');
    }
  }

  if (burger) burger.addEventListener('click', toggleMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);
  
  document.querySelectorAll('.mobile-nav a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
      closeMenu();
    }
  });

  // Count-up animation
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  const statCols = document.querySelectorAll('.stat-col');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        
        // Find index among all stat cols
        const index = Array.from(statCols).indexOf(entry.target);
        const numEl = entry.target.querySelector('.num');
        if (!numEl) return;
        
        const target = parseFloat(numEl.dataset.target);
        const decimals = parseInt(numEl.dataset.decimals);
        const duration = 1500 + (index * 80);
        const delay = 480 + (index * 90);
        
        setTimeout(() => {
          let startTime = null;
          
          function update(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const eased = easeOutCubic(progress);
            const currentVal = (target * eased).toFixed(decimals);
            numEl.textContent = currentVal;
            
            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              numEl.textContent = target.toFixed(decimals);
            }
          }
          
          requestAnimationFrame(update);
        }, delay);
      }
    });
  }, { threshold: 0.25 });

  statCols.forEach(col => observer.observe(col));
});
