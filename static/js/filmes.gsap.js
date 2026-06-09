
(function () {
  if (typeof gsap === 'undefined') return;

  /* ── Defaults globais ─────────────────────────────────── */
  gsap.defaults({ ease: 'power3.out' });

  /* ── Timeline de entrada ──────────────────────────────── */
  function runEntrance() {
    const tl = gsap.timeline({ defaults: { duration: 0.7 } });

    tl
      /* Cabeçalho */
      .fromTo('.filmes-header',
        { opacity: 0, y: 40, filter: 'blur(6px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)' }
      )
      /* Barra de progresso */
      .fromTo('.progress-wrapper',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        '-=0.4'
      )
      /* Formulário */
      .fromTo('.form-wrapper',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        '-=0.3'
      )
      /* Filtros e tags de gênero em stagger */
      .fromTo('.filter-wrapper, .genre-wrapper',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, stagger: 0.12 },
        '-=0.3'
      )
      /* Slider */
      .fromTo('.slider-section',
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1,  duration: 0.8 },
        '-=0.2'
      );
  }

  /* ── Re-anima ao trocar de aba (filmes / séries / jogos) ─ */
  document.querySelectorAll('.main-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const section = document.getElementById('section-' + btn.dataset.section);
      if (!section) return;

      gsap.fromTo(
        section.querySelectorAll(
          '.filmes-header, .progress-wrapper, .form-wrapper, .filter-wrapper, .genre-wrapper, .slider-section'
        ),
        { opacity: 0, y: 24, filter: 'blur(4px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)', duration: 0.55, stagger: 0.08 }
      );
    });
  });

  /* ── Animação dos cards do slider ao navegar ─────────── */
  /* Exposta globalmente para ser chamada após updateSlider() */
  window.gsapSliderChange = function (activeCard, prevCards, nextCards) {
    if (activeCard) {
      gsap.fromTo(activeCard,
        { scale: 0.96, opacity: 0.6 },
        { scale: 1,    opacity: 1,   duration: 0.5, ease: 'power2.out' }
      );
    }
    if (prevCards && prevCards.length) {
      gsap.to(prevCards, { filter: 'brightness(0.4)', duration: 0.4 });
    }
    if (nextCards && nextCards.length) {
      gsap.to(nextCards, { filter: 'brightness(0.55)', duration: 0.4 });
    }
  };

  /* ── Micro-interação: hover no card ativo ────────────── */
  document.addEventListener('mouseover', function (e) {
    const card = e.target.closest('.slider-card.active');
    if (card) gsap.to(card, { y: -4, duration: 0.3, ease: 'power2.out' });
  });
  document.addEventListener('mouseout', function (e) {
    const card = e.target.closest('.slider-card.active');
    if (card) gsap.to(card, { y: 0, duration: 0.4, ease: 'power2.inOut' });
  });

  /* ── Inicia ───────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runEntrance);
  } else {
    runEntrance();
  }
})();
