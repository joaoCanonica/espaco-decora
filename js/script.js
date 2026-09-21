// Espaço Decora By Rita Assunção — comportamento da página.
// Cada funcionalidade é uma função iniciada no fim do arquivo. O HTML já
// funciona sem JS (carrosséis rolam nativamente, vídeos e fotos abrem por link).

const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
const comportamentoRolagem = () => (reduzMovimento.matches ? 'auto' : 'smooth');

// ---------------------------------------------------------------------------
// Splash: até 2 s, uma vez por sessão. A linha do tempo visual é do CSS
// (html.splash-ativo); aqui só entram o vídeo, o "pular" e a remoção do DOM.
// Devolve uma Promise resolvida quando o splash sai (ou não existe).
// ---------------------------------------------------------------------------
function iniciarSplash() {
  const splash = document.getElementById('splash');
  const raiz = document.documentElement;
  if (!splash) return Promise.resolve();

  if (!raiz.classList.contains('splash-ativo')) {
    splash.remove();
    return Promise.resolve();
  }

  try { sessionStorage.setItem('edIntroVista', '1'); } catch (e) { /* sem storage */ }

  return new Promise((resolve) => {
    let encerrando = false;
    let temporizador;

    const encerrar = () => {
      clearTimeout(temporizador);
      document.removeEventListener('keydown', aoTeclar);
      raiz.classList.remove('splash-ativo');
      raiz.classList.add('sem-splash');
      splash.remove();
      resolve();
    };

    const pular = () => {
      if (encerrando) return;
      encerrando = true;
      clearTimeout(temporizador);
      if (typeof splash.animate !== 'function') { encerrar(); return; }
      const opacidadeAtual = getComputedStyle(splash).opacity;
      splash
        .animate([{ opacity: opacidadeAtual }, { opacity: 0 }], { duration: 250, fill: 'forwards' })
        .finished.then(encerrar, encerrar);
    };

    function aoTeclar(e) {
      if (e.key === 'Enter' || e.key === 'Escape') pular();
    }

    splash.addEventListener('pointerdown', pular);
    document.addEventListener('keydown', aoTeclar);
    // Mesma marca do CSS (1750 ms de espera + 250 ms de fade).
    temporizador = setTimeout(encerrar, 2050);

    const video = splash.querySelector('.splash__video');
    const ehMovel = window.matchMedia('(max-width: 640px), (max-aspect-ratio: 4/5)').matches;
    video.poster = video.dataset.poster;
    video.src = ehMovel ? video.dataset.srcMovel : video.dataset.src;
    video.play().catch(() => { /* fica o poster */ });
  });
}

// ---------------------------------------------------------------------------
// Cabeçalho: fundo claro após rolar; menu mobile como painel abaixo do
// cabeçalho (fecha por botão, link, área externa, Escape ou ao virar desktop).
// ---------------------------------------------------------------------------
function iniciarCabecalho() {
  const cabecalho = document.querySelector('[data-cabecalho]');
  if (!cabecalho) return;

  const aoRolar = () => cabecalho.classList.toggle('cabecalho--rolado', window.scrollY > 24);
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  const botao = cabecalho.querySelector('.cabecalho__alternador');
  const nav = cabecalho.querySelector('.cabecalho__nav');
  const fundo = document.querySelector('[data-cabecalho-fundo]');
  if (!botao || !nav || !fundo) return;

  const raiz = document.documentElement;
  const desktop = window.matchMedia('(min-width: 900px)');

  const definirMenu = (aberto) => {
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    raiz.classList.toggle('menu-aberto', aberto);
  };

  botao.addEventListener('click', () => {
    definirMenu(botao.getAttribute('aria-expanded') !== 'true');
  });
  fundo.addEventListener('click', () => definirMenu(false));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => definirMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && botao.getAttribute('aria-expanded') === 'true') {
      definirMenu(false);
      botao.focus();
    }
  });
  desktop.addEventListener('change', () => definirMenu(false));
}

// ---------------------------------------------------------------------------
// Revelação ao rolar: anima o conjunto da seção, uma única vez.
// ---------------------------------------------------------------------------
function iniciarRevelacao() {
  const alvos = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduzMovimento.matches) {
    alvos.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('is-visible');
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });

  alvos.forEach((el) => observador.observe(el));
}

// ---------------------------------------------------------------------------
// Carrossel reutilizável (categorias, vídeos, avaliações e fotos da rua).
// Marcação esperada dentro de [data-carrossel]:
//   [data-carrossel-viewport]  trilho rolável com scroll-snap; filhos = slides
//   [data-carrossel-anterior] / [data-carrossel-proximo]   botões (opcionais)
//   [data-carrossel-contador]  texto do indicador, aria-live (opcional)
//   [data-carrossel-pontos]    barrinhas, uma por slide (opcional)
// Sem intervalos automáticos; a rolagem respeita prefers-reduced-motion.
// ---------------------------------------------------------------------------
function iniciarCarrossel(raiz, formatar = (i, total) => `${i + 1} de ${total}`) {
  const viewport = raiz.querySelector('[data-carrossel-viewport]');
  if (!viewport) return;

  const slides = Array.from(viewport.children);
  const total = slides.length;
  const anterior = raiz.querySelector('[data-carrossel-anterior]');
  const proximo = raiz.querySelector('[data-carrossel-proximo]');
  const contador = raiz.querySelector('[data-carrossel-contador]');
  const pontos = raiz.querySelector('[data-carrossel-pontos]');
  const marcadores = pontos
    ? slides.map(() => pontos.appendChild(document.createElement('span')))
    : [];

  let primeiroVisivel = 0;
  let agendado = 0;

  const fracoesVisiveis = () => {
    const area = viewport.getBoundingClientRect();
    return slides.map((slide) => {
      const r = slide.getBoundingClientRect();
      const visivel = Math.min(r.right, area.right) - Math.max(r.left, area.left);
      return r.width ? Math.max(0, visivel) / r.width : 0;
    });
  };

  const desativarBotao = (botao, desativar, outro) => {
    if (!botao || botao.disabled === desativar) return;
    // Um botão desativado perde o foco: passa para o vizinho.
    if (desativar && document.activeElement === botao && outro && !outro.disabled) outro.focus();
    botao.disabled = desativar;
  };

  const atualizar = () => {
    agendado = 0;
    const fracoes = fracoesVisiveis();
    const limite = viewport.scrollWidth - viewport.clientWidth;
    const noInicio = viewport.scrollLeft <= 2;
    const noFim = viewport.scrollLeft >= limite - 2;

    primeiroVisivel = fracoes.findIndex((f) => f >= 0.5);
    if (primeiroVisivel < 0) primeiroVisivel = fracoes.indexOf(Math.max(...fracoes));

    // Indicador: nas pontas o item é o primeiro/último, senão o predominante.
    let indice = primeiroVisivel;
    if (noInicio) indice = 0;
    else if (noFim) indice = total - 1;

    if (contador) {
      const texto = formatar(indice, total);
      if (contador.textContent !== texto) contador.textContent = texto;
    }
    marcadores.forEach((m, i) => m.classList.toggle('is-ativo', i === indice));
    desativarBotao(anterior, noInicio || limite <= 2, proximo);
    desativarBotao(proximo, noFim || limite <= 2, anterior);
  };

  const agendar = () => {
    if (!agendado) agendado = requestAnimationFrame(atualizar);
  };

  const irPara = (indice) => {
    const alvo = slides[Math.min(total - 1, Math.max(0, indice))];
    const recuo = parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
    viewport.scrollTo({ left: alvo.offsetLeft - recuo, behavior: comportamentoRolagem() });
  };

  if (anterior) anterior.addEventListener('click', () => irPara(primeiroVisivel - 1));
  if (proximo) proximo.addEventListener('click', () => irPara(primeiroVisivel + 1));

  // Teclado com o próprio trilho focado (setas e Home/End).
  viewport.addEventListener('keydown', (e) => {
    if (e.target !== viewport) return;
    const destinos = {
      ArrowLeft: primeiroVisivel - 1,
      ArrowRight: primeiroVisivel + 1,
      Home: 0,
      End: total - 1,
    };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    irPara(destinos[e.key]);
  });

  viewport.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', agendar);
  atualizar();
}

// ---------------------------------------------------------------------------
// Comparador antes/depois: o range atualiza --pos, que move o clip-path da
// camada "antes" e a alça.
// ---------------------------------------------------------------------------
function iniciarComparador() {
  const comparador = document.querySelector('.comparador');
  const range = comparador && comparador.querySelector('.comparador__range');
  if (!range) return;

  const atualizar = () => {
    comparador.style.setProperty('--pos', `${range.value}%`);
    range.setAttribute('aria-valuetext', `${range.value}% da foto antes visível`);
  };
  range.addEventListener('input', atualizar);
  atualizar();
}

// ---------------------------------------------------------------------------
// Vídeos
// ---------------------------------------------------------------------------

// Um vídeo tocando pausa todos os outros (a fase de captura cobre também os
// <video> criados depois).
function pausarOutrosVideos() {
  document.addEventListener('play', (e) => {
    if (!(e.target instanceof HTMLVideoElement)) return;
    document.querySelectorAll('video').forEach((v) => {
      if (v !== e.target && !v.paused) v.pause();
    });
  }, true);
}

// Cards com poster: o <video> só é criado quando a pessoa pede para tocar.
function iniciarVideoCards() {
  document.querySelectorAll('[data-video-card]').forEach((card) => {
    const abrir = card.querySelector('[data-video-abrir]');
    const poster = card.querySelector('.video-card__poster');
    if (!abrir || !poster) return;

    if (!poster.complete) {
      const pronto = () => card.removeAttribute('data-carregando');
      card.setAttribute('data-carregando', '');
      poster.addEventListener('load', pronto, { once: true });
      poster.addEventListener('error', pronto, { once: true });
    }

    abrir.addEventListener('click', (e) => {
      e.preventDefault();

      const video = document.createElement('video');
      video.className = 'video-card__video';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.poster = poster.currentSrc || poster.src;
      video.src = abrir.href;
      video.setAttribute('aria-label', abrir.getAttribute('aria-label').replace(/^Reproduzir vídeo: /, ''));

      video.addEventListener('play', () => card.classList.add('video-card--tocando'));
      video.addEventListener('pause', () => card.classList.remove('video-card--tocando'));
      video.addEventListener('ended', () => card.classList.remove('video-card--tocando'));

      card.classList.add('video-card--ativo');
      card.append(video);
      poster.remove();
      abrir.remove();
      video.focus();
      video.play().catch(() => { /* fica pronto para tocar nos controles */ });
    });
  });
}

// Conheça a loja por dentro: um único player; as miniaturas trocam a fonte.
// Só o vídeo ativo usa preload="metadata"; os outros só recebem src ao serem
// escolhidos. Nada toca sozinho.
function iniciarGaleriaVideos(splashPronto) {
  const raiz = document.querySelector('[data-galeria]');
  if (!raiz) return;

  const palco = raiz.querySelector('[data-galeria-palco]');
  const video = palco.querySelector('video');
  const status = raiz.querySelector('[data-galeria-status]');
  const botoes = Array.from(raiz.querySelectorAll('[data-video]'));
  const alternativa = video.querySelector('a');
  let atual = botoes.find((b) => b.getAttribute('aria-current') === 'true') || botoes[0];
  let troca = 0;

  const selecionar = (botao) => {
    if (botao === atual) return;
    atual = botao;
    botoes.forEach((b) => {
      if (b === botao) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    if (!video.paused) video.pause();

    palco.classList.add('is-trocando');
    clearTimeout(troca);
    troca = setTimeout(() => {
      video.preload = 'metadata';
      video.poster = botao.dataset.poster;
      video.src = botao.dataset.video;
      video.setAttribute('aria-label', botao.dataset.titulo);
      if (alternativa) alternativa.href = botao.dataset.video;
      palco.classList.remove('is-trocando');
    }, reduzMovimento.matches ? 0 : 200);

    status.textContent = `Vídeo selecionado: ${botao.dataset.titulo}.`;
  };

  botoes.forEach((botao) => botao.addEventListener('click', () => selecionar(botao)));

  // O primeiro vídeo começa sem poster e com preload="none": o poster e os
  // metadados só são pedidos quando o splash já saiu e a seção está perto da tela.
  const prepararPrimeiroVideo = () => {
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      video.removeAttribute('data-poster');
    }
    if (video.preload === 'none') video.preload = 'metadata';
  };
  if ('IntersectionObserver' in window) {
    const perto = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      perto.disconnect();
      splashPronto.then(prepararPrimeiroVideo);
    }, { rootMargin: '250px 0px' });
    perto.observe(raiz);
  } else {
    splashPronto.then(prepararPrimeiroVideo);
  }
}

// ---------------------------------------------------------------------------
// Foto ampliada (<dialog>): fecha por botão, Esc e clique no fundo; o foco
// volta ao item de origem. Sem JS, o link abre o arquivo da foto.
// ---------------------------------------------------------------------------
function iniciarFotoAmpliada() {
  const dialogo = document.getElementById('foto-dialog');
  if (!dialogo || typeof dialogo.showModal !== 'function') return;

  const imagem = document.getElementById('foto-dialog-img');
  const legenda = document.getElementById('foto-dialog-legenda');
  const raiz = document.documentElement;
  let origem = null;

  document.querySelectorAll('[data-abre-foto]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      origem = link;
      const miniatura = link.querySelector('img');
      imagem.src = link.href;
      imagem.alt = miniatura ? miniatura.alt : link.dataset.legenda;
      legenda.textContent = link.dataset.legenda;
      raiz.classList.add('foto-dialog-aberto');
      dialogo.showModal();
    });
  });

  dialogo.querySelector('[data-fecha-foto]').addEventListener('click', () => dialogo.close());
  // O <dialog> só é o alvo do clique quando ele cai no backdrop.
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close();
  });
  dialogo.addEventListener('close', () => {
    raiz.classList.remove('foto-dialog-aberto');
    imagem.removeAttribute('src');
    if (origem) origem.focus();
  });
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
const anoAtual = document.getElementById('ano');
if (anoAtual) anoAtual.textContent = new Date().getFullYear();

const splashPronto = iniciarSplash();
iniciarCabecalho();
iniciarRevelacao();

const doisDigitos = (n) => String(n).padStart(2, '0');
document.querySelectorAll('[data-carrossel]').forEach((raiz) => {
  if (raiz.classList.contains('carrossel--categorias')) {
    iniciarCarrossel(raiz, (i, total) => `${doisDigitos(i + 1)} / ${doisDigitos(total)}`);
  } else {
    iniciarCarrossel(raiz);
  }
});

iniciarComparador();
pausarOutrosVideos();
iniciarVideoCards();
iniciarGaleriaVideos(splashPronto);
iniciarFotoAmpliada();
