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

// ---------------------------------------------------------------------------
// Cabeçalho: fundo creme translúcido após rolar, e menu mobile acessível
// (abre/fecha por clique no botão, clique fora, clique num link ou Esc).
// ---------------------------------------------------------------------------
const cabecalho = document.querySelector('[data-cabecalho]');

if (cabecalho) {
  const aoRolar = () => {
    cabecalho.classList.toggle('cabecalho--rolado', window.scrollY > 8);
  };
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  const botaoMenu = cabecalho.querySelector('.cabecalho__alternador');
  const nav = cabecalho.querySelector('.cabecalho__nav');
  const fundoMenu = document.querySelector('[data-cabecalho-fundo]');

  if (botaoMenu && nav && fundoMenu) {
    const abrirMenu = () => {
      botaoMenu.setAttribute('aria-expanded', 'true');
      // aria-label muda junto (não só aria-expanded): sem isso, um leitor
      // de tela anuncia "Abrir menu" mesmo com o menu já aberto e o botão
      // prestes a fechá-lo — nome ambíguo para o que o botão faz agora.
      botaoMenu.setAttribute('aria-label', 'Fechar menu');
      nav.classList.add('cabecalho__nav--aberto');
      fundoMenu.classList.add('cabecalho__fundo--visivel');
      document.documentElement.classList.add('menu-aberto');
    };
    const fecharMenu = () => {
      botaoMenu.setAttribute('aria-expanded', 'false');
      botaoMenu.setAttribute('aria-label', 'Abrir menu');
      nav.classList.remove('cabecalho__nav--aberto');
      fundoMenu.classList.remove('cabecalho__fundo--visivel');
      document.documentElement.classList.remove('menu-aberto');
    };

    botaoMenu.addEventListener('click', () => {
      const aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
      if (aberto) fecharMenu(); else abrirMenu();
    });
    fundoMenu.addEventListener('click', fecharMenu);
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', fecharMenu));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && botaoMenu.getAttribute('aria-expanded') === 'true') {
        fecharMenu();
        botaoMenu.focus();
      }
    });
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
// Vídeos com controles nativos (Sobre + Inspirações em vídeo): tocar um
// pausa os demais, para não sobrepor sons. Não mexe nos controles nativos
// em si — só reage ao evento 'play', então funciona igual com clique,
// toque ou teclado.
// ---------------------------------------------------------------------------
const videosComControles = document.querySelectorAll('video[controls]');

if (videosComControles.length > 1) {
  videosComControles.forEach((video) => {
    video.addEventListener('play', () => {
      videosComControles.forEach((outro) => {
        if (outro !== video) outro.pause();
      });
    });
  });
}
