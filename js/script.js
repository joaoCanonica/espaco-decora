// Espaço Decora By Rita Assunção — comportamento base

document.getElementById('ano').textContent = new Date().getFullYear();

// Revela suavemente os blocos marcados com [data-reveal] ao entrar na tela.
// A ocultação inicial só existe em CSS quando .js-pronto está presente
// (ver <head>), então uma falha aqui nunca deixa conteúdo invisível.
const prefereMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefereMenosMovimento) {
  const alvos = document.querySelectorAll('[data-reveal]');

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('is-visible');
          observador.unobserve(entrada.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );

  alvos.forEach((el) => observador.observe(el));
}

// ---------------------------------------------------------------------------
// Comparador de antes/depois: arrastar o range atualiza a variável CSS --pos,
// que controla o clip-path da camada "antes" sobre a foto "depois".
// ---------------------------------------------------------------------------
const comparador = document.querySelector('.comparador');
if (comparador) {
  const range = comparador.querySelector('.comparador__range');
  const atualizarComparador = (valor) => {
    comparador.style.setProperty('--pos', `${valor}%`);
  };
  range.addEventListener('input', (e) => atualizarComparador(e.target.value));
  atualizarComparador(range.value);
}

// ---------------------------------------------------------------------------
// Vitrine de vídeo: cada preview só reproduz (mudo) enquanto está visível na
// tela — evita tocar vários vídeos grandes ao mesmo tempo fora da vista.
// Passar o mouse (ou tocar, no touch) ativa o som daquele vídeo por vez.
// ---------------------------------------------------------------------------
const cardsDeVideo = document.querySelectorAll('[data-video]');

if (cardsDeVideo.length) {
  const observadorDeVideo = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        const video = entrada.target.querySelector('video');
        if (!video) return;
        if (entrada.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.4 }
  );

  const silenciarTodos = (exceto) => {
    cardsDeVideo.forEach((card) => {
      if (card === exceto) return;
      const video = card.querySelector('video');
      const botao = card.querySelector('.video-card__som');
      if (video) video.muted = true;
      if (botao) {
        botao.classList.remove('com-som');
        botao.setAttribute('aria-pressed', 'false');
      }
    });
  };

  cardsDeVideo.forEach((card) => {
    observadorDeVideo.observe(card);

    const video = card.querySelector('video');
    const botao = card.querySelector('.video-card__som');
    if (!video || !botao) return;

    const ativarSom = () => {
      silenciarTodos(card);
      video.muted = false;
      botao.classList.add('com-som');
      botao.setAttribute('aria-pressed', 'true');
    };
    const desativarSom = () => {
      video.muted = true;
      botao.classList.remove('com-som');
      botao.setAttribute('aria-pressed', 'false');
    };

    card.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') ativarSom();
    });
    card.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') desativarSom();
    });
    botao.addEventListener('click', () => {
      if (video.muted) ativarSom();
      else desativarSom();
    });
  });
}
