/**
 * animations.gsap.js
 * Animações globais de entrada para todas as páginas do "tamo junto".
 * Requer GSAP 3 carregado antes deste script.
 *
 * Inclua antes de </body> em cada template:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
 *   <script src="{{ url_for('static', filename='js/animations.gsap.js') }}"></script>
 */

(function () {
  if (typeof gsap === 'undefined') return;

  gsap.defaults({ ease: 'power3.out' });

  /* ── Utilitários ─────────────────────────────────────── */
  function tl(defaults) {
    return gsap.timeline({ defaults: Object.assign({ duration: 0.65 }, defaults) });
  }

  /* ── Detecta página pelo body id ou classe ───────────── */
  var body = document.body;

  /* ────────────────────────────────────────────────────────
     INDEX  (#page-index)
  ──────────────────────────────────────────────────────── */
  if (document.querySelector('.stage')) {
    tl()
      .fromTo('.date-label',
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0 }
      )
      .fromTo('.title-stack',
        { opacity: 0, scale: .96, filter: 'blur(8px)' },
        { opacity: 1, scale: 1,   filter: 'blur(0px)', duration: .9 },
        '-=.35'
      )
      .fromTo('.ha-line',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: .5 },
        '-=.3'
      )
      .fromTo('.love-msg',
        { opacity: 0 },
        { opacity: 1, duration: .9 },
        '-=.2'
      )
      .fromTo('.counter',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0 },
        '-=.5'
      )
      .fromTo('.noti-panel',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0 },
        '-=.4'
      )
      .fromTo('.corner-stamp',
        { opacity: 0, scale: .9 },
        { opacity: 1, scale: 1, duration: .5 },
        '-=.4'
      );
  }

  /* ────────────────────────────────────────────────────────
     CALENDÁRIO
  ──────────────────────────────────────────────────────── */
  if (document.querySelector('.cal-header')) {
    tl()
      .fromTo('.cal-header',
        { opacity: 0, y: 36, filter: 'blur(6px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)' }
      )
      .fromTo('.legend',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        '-=.35'
      )
      .fromTo('.month-card',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0,  duration: .75 },
        '-=.3'
      );

    /* Anima event-rows ao trocar mês */
    window.gsapAnimateEvents = function () {
      gsap.fromTo(
        '.event-row',
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: .45, stagger: .07 }
      );
    };
  }

  /* ────────────────────────────────────────────────────────
     VIAGENS
  ──────────────────────────────────────────────────────── */
  if (document.querySelector('.stats-bar')) {
    tl()
      .fromTo('.page-header, .content-header',
        { opacity: 0, y: 32, filter: 'blur(6px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)' }
      )
      .fromTo('.stats-bar',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        '-=.35'
      )
      .fromTo('.form-section',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        '-=.3'
      )
      .fromTo('.filter-container, .filter-row, .filter-wrapper',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0 },
        '-=.3'
      );

    /* Cards de viagem em stagger ao carregar / filtrar */
    window.gsapAnimateTripCards = function () {
      gsap.fromTo(
        '.trip-card',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: .5, stagger: .08 }
      );
    };
    window.gsapAnimateTripCards();
  }

  /* ────────────────────────────────────────────────────────
     COISINHAS
  ──────────────────────────────────────────────────────── */
  if (document.querySelector('.item-list')) {
    tl()
      .fromTo('.page-header, .content-header',
        { opacity: 0, y: 32, filter: 'blur(6px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)' }
      )
      .fromTo('.card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: .12 },
        '-=.35'
      )
      .fromTo('.filter-container, .filter-row, .filter-wrapper',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0 },
        '-=.3'
      );

    window.gsapAnimateItems = function () {
      gsap.fromTo(
        '.item-card',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .45, stagger: .07 }
      );
    };
    window.gsapAnimateItems();
  }

  /* ────────────────────────────────────────────────────────
     BLOCO (Grimório)
  ──────────────────────────────────────────────────────── */
  if (document.querySelector('.mform-shell')) {
    tl()
      .fromTo('.page-header, .content-header',
        { opacity: 0, y: 32, filter: 'blur(6px)' },
        { opacity: 1, y: 0,  filter: 'blur(0px)' }
      )
      .fromTo('.mform-shell',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0 },
        '-=.35'
      )
      .fromTo('.notes-masonry',
        { opacity: 0 },
        { opacity: 1, duration: .6 },
        '-=.2'
      );

    /* Anima step do wizard ao avançar */
    window.gsapAnimateStep = function (stepEl) {
      gsap.fromTo(
        stepEl,
        { opacity: 0, x: 28, filter: 'blur(4px)' },
        { opacity: 1, x: 0,  filter: 'blur(0px)', duration: .5 }
      );
    };

    /* Note cards em stagger */
    window.gsapAnimateNotes = function () {
      gsap.fromTo(
        '.note-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: .45, stagger: .08 }
      );
    };
    window.gsapAnimateNotes();
  }

  /* ────────────────────────────────────────────────────────
     TOASTS (global)
  ──────────────────────────────────────────────────────── */
  window.gsapShowToast = function (toastEl) {
    gsap.fromTo(
      toastEl,
      { opacity: 0, x: 20 },
      { opacity: 1, x: 0, duration: .35 }
    );
    gsap.to(toastEl, { opacity: 0, x: 20, duration: .3, delay: 2.8, onComplete: function () {
      toastEl.remove();
    }});
  };

})();
