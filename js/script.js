// Espaço Decora By Rita Assunção — comportamento base

document.getElementById('ano').textContent = new Date().getFullYear();

// A ocultação inicial dos blocos [data-reveal] só existe em CSS quando
// .js-pronto está presente (ver <head>), então uma falha aqui nunca deixa
// conteúdo invisível.
const prefereMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Splash de abertura: vídeo dos ramos se desenhando + fade-in do texto real
// da marca por cima. Timeline fixa (não depende do vídeo ter carregado):
//   0s     — vídeo roda sozinho
//   2.5s   — texto entra (fade + leve subida, 600ms, ease-out)
//   4s     — splash inteiro começa a sumir (fade, 400ms) revelando o hero
// Aparece só na primeira carga da sessão: a marca em sessionStorage garante
// que navegação interna (âncoras da própria página) nunca a repete, e o
// <head> já aplica .sem-splash antes do primeiro paint para não piscar.
// ---------------------------------------------------------------------------
const splash = document.getElementById('splash');

if (splash) {
  const marcarComoVista = () => {
    try { sessionStorage.setItem('edIntroVista', '1'); } catch (e) {}
  };

  const pularSplash = () => {
    marcarComoVista();
    document.documentElement.classList.remove('splash-ativo');
    splash.remove();
  };

  const jaVista = document.documentElement.classList.contains('sem-splash');

  if (jaVista || prefereMenosMovimento) {
    pularSplash();
  } else {
    const video = splash.querySelector('.splash__video');
    const texto = splash.querySelector('.splash__texto');

    document.documentElement.classList.add('splash-ativo');

    // O <video> só ganha poster/fonte aqui, via JS — assim quem já viu a
    // intro nesta sessão (branch acima) nunca faz o navegador buscar esses
    // arquivos, e o carregamento da página real não compete com eles.
    // A fonte usa a mesma URL já disparada via <link rel="preload"> no
    // <head> (window.__edSplashSrc), reaproveitando o download que já
    // está em andamento em vez de começar tudo de novo aqui.
    const ehMovel = window.matchMedia('(max-width: 640px), (max-aspect-ratio: 4/5)').matches;
    const fonteEscolhida = window.__edSplashSrc
      || (ehMovel ? video.dataset.srcMovel : video.dataset.src);
    video.poster = video.dataset.poster;
    const fonte = document.createElement('source');
    fonte.src = fonteEscolhida;
    fonte.type = 'video/mp4';
    video.appendChild(fonte);
    video.load();
    // Só chama play() quando já houver buffer suficiente para reproduzir
    // sem travar — chamar play() direto após load() podia render um
    // engasgo visível em conexões móveis mais lentas, com o vídeo tocando
    // e pausando para continuar baixando.
    if (video.readyState >= 3) {
      video.play().catch(() => {});
    } else {
      video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
    }

    setTimeout(() => texto.classList.add('splash__texto--visivel'), 2500);

    setTimeout(() => {
      splash.classList.add('splash--saindo');
      splash.addEventListener('transitionend', pularSplash, { once: true });
      setTimeout(pularSplash, 600); // segurança caso 'transitionend' não dispare
    }, 4000);
  }
}

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
