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
    video.src = ehMovel ? video.dataset.srcMovel : video.dataset.src;
    video.play().catch(() => { /* fica o fundo caramelo com a logo */ });
  });
}

// ---------------------------------------------------------------------------
// Menu mobile: painel pela direita (até 899px). Fecha por botão, fundo, link,
// Escape ou ao virar desktop. Aberto: rolagem do documento travada, foco preso
// no painel e o resto da página inerte; ao fechar, o foco volta ao botão.
// ---------------------------------------------------------------------------
function iniciarMenu() {
  const botao = document.querySelector('.cabecalho__alternador');
  const menu = document.getElementById('menu-mobile');
  const fundo = document.querySelector('[data-menu-fundo]');
  if (!botao || !menu || !fundo) return;

  const fechar = menu.querySelector('.menu-mobile__fechar');
  const raiz = document.documentElement;
  const desktop = window.matchMedia('(min-width: 900px)');
  const restoDaPagina = [document.querySelector('[data-cabecalho]'), document.getElementById('conteudo-principal'), document.querySelector('.rodape')];
  const focaveis = () => Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
  const estaAberto = () => raiz.classList.contains('menu-aberto');

  const definir = (abrir) => {
    if (abrir === estaAberto()) return;
    raiz.classList.toggle('menu-aberto', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
    botao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
    menu.setAttribute('aria-hidden', String(!abrir));
    menu.inert = !abrir;
    restoDaPagina.forEach((el) => { if (el) el.inert = abrir; });
    if (abrir) fechar.focus();
    else botao.focus();
  };

  botao.addEventListener('click', () => definir(!estaAberto()));
  fechar.addEventListener('click', () => definir(false));
  fundo.addEventListener('click', () => definir(false));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => definir(false)));

  document.addEventListener('keydown', (e) => {
    if (!estaAberto()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      definir(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const itens = focaveis();
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (!menu.contains(document.activeElement)) {
      e.preventDefault();
      primeiro.focus();
    } else if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  });

  desktop.addEventListener('change', () => { if (desktop.matches) definir(false); });
}

// ---------------------------------------------------------------------------
// Revelação ao rolar: só cabeçalhos e blocos de texto ([data-reveal]), uma
// única vez. A mídia principal nunca fica escondida.
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
  }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });

  alvos.forEach((el) => observador.observe(el));
}

// ---------------------------------------------------------------------------
// Carrossel reutilizável (categorias, ideias em vídeo, avaliações e fotos da rua).
// Marcação esperada dentro de [data-carrossel]:
//   [data-carrossel-viewport]  trilho rolável com scroll-snap; filhos = slides
//   [data-carrossel-anterior] / [data-carrossel-proximo]   botões (opcionais)
//   [data-carrossel-contador]  texto do indicador, aria-live (opcional)
//   [data-carrossel-pontos]    barrinhas, uma por slide (opcional)
// A posição vem da matemática do trilho, não de qual card aparece mais:
//   passo   = largura do slide + gap (distância entre dois slides)
//   inicio  = round(scrollLeft / passo)        → primeiro card da janela
//   ultimo  = min(inicio + visíveis, total)    → visíveis = parte inteira de --visiveis
// Indicador: "1–3 de 4" (vários cards) ou "2 de 4" (um card). Sem autoplay, sem
// loop; a rolagem respeita prefers-reduced-motion.
// ---------------------------------------------------------------------------
function iniciarCarrossel(raiz) {
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

  let inicio = 0;
  let larguraAnterior = viewport.clientWidth;
  let agendado = 0;

  const medidas = () => {
    const passo = total > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : viewport.clientWidth;
    const visiveis = Math.max(1, Math.floor(parseFloat(getComputedStyle(raiz).getPropertyValue('--visiveis')) || 1));
    const limite = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    return { passo, visiveis, limite, ultimoInicio: Math.max(0, total - visiveis) };
  };

  const desativarBotao = (botao, desativar, outro) => {
    if (!botao || botao.disabled === desativar) return;
    // Um botão desativado perde o foco: passa para o vizinho.
    if (desativar && document.activeElement === botao && outro && !outro.disabled) outro.focus();
    botao.disabled = desativar;
  };

  const atualizar = () => {
    agendado = 0;
    const { passo, visiveis, limite, ultimoInicio } = medidas();
    const rolagem = Math.min(viewport.scrollLeft, limite);
    inicio = passo > 0 ? Math.min(ultimoInicio, Math.round(rolagem / passo)) : 0;
    const ultimo = Math.min(inicio + visiveis, total);

    if (contador) {
      const texto = ultimo > inicio + 1
        ? `${inicio + 1}–${ultimo} de ${total}`
        : `${inicio + 1} de ${total}`;
      if (contador.textContent !== texto) contador.textContent = texto;
    }
    marcadores.forEach((m, i) => m.classList.toggle('is-ativo', i === inicio));
    const semRolagem = limite <= 2;
    desativarBotao(anterior, semRolagem || rolagem <= 2, proximo);
    desativarBotao(proximo, semRolagem || rolagem >= limite - 2, anterior);
  };

  const agendar = () => {
    if (!agendado) agendado = requestAnimationFrame(atualizar);
  };

  const irPara = (indice, comportamento = comportamentoRolagem()) => {
    const { passo, limite, ultimoInicio } = medidas();
    const alvo = Math.min(ultimoInicio, Math.max(0, indice));
    viewport.scrollTo({ left: Math.min(limite, alvo * passo), behavior: comportamento });
  };

  if (anterior) anterior.addEventListener('click', () => irPara(inicio - 1));
  if (proximo) proximo.addEventListener('click', () => irPara(inicio + 1));

  // Teclado com o próprio trilho focado (setas e Home/End).
  viewport.addEventListener('keydown', (e) => {
    if (e.target !== viewport) return;
    const destinos = { ArrowLeft: inicio - 1, ArrowRight: inicio + 1, Home: 0, End: total };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    irPara(destinos[e.key]);
  });

  // Ao mudar a largura (giro, breakpoint), o trilho volta para uma posição
  // exata do mesmo primeiro card, respeitando o novo limite de rolagem.
  window.addEventListener('resize', () => {
    if (viewport.clientWidth !== larguraAnterior) {
      larguraAnterior = viewport.clientWidth;
      irPara(inicio, 'auto');
    }
    agendar();
  });

  viewport.addEventListener('scroll', agendar, { passive: true });
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

  const player = raiz.querySelector('[data-galeria-player]');
  const video = player.querySelector('video');
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

    player.classList.add('is-trocando');
    clearTimeout(troca);
    troca = setTimeout(() => {
      video.preload = 'metadata';
      video.poster = botao.dataset.poster;
      video.src = botao.dataset.video;
      video.setAttribute('aria-label', botao.dataset.titulo);
      if (alternativa) alternativa.href = botao.dataset.video;
      player.classList.remove('is-trocando');
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
// Mapa: o iframe usa loading="lazy" (só carrega perto da tela); o placeholder
// cobre o vazio até o evento "load". O link "Abrir no Google Maps" não depende
// do iframe.
// ---------------------------------------------------------------------------
function iniciarMapa() {
  const mapa = document.querySelector('.visite__mapa');
  const iframe = mapa && mapa.querySelector('iframe');
  const placeholder = mapa && mapa.querySelector('.mapa__placeholder');
  if (!iframe || !placeholder) return;
  iframe.addEventListener('load', () => { placeholder.hidden = true; }, { once: true });

  // Se o mapa já está na tela e não dispara "load" em 12 s (rede lenta ou
  // bloqueio), o texto deixa de prometer o carregamento e aponta para o link
  // externo, sem spinner. O tempo só corre depois que o mapa entra na viewport.
  if (!('IntersectionObserver' in window)) return;
  const visto = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    visto.disconnect();
    setTimeout(() => {
      if (placeholder.hidden) return;
      const texto = placeholder.querySelector('span');
      if (texto) texto.textContent = 'Mapa indisponível agora. Use "Abrir no Google Maps".';
    }, 12000);
  });
  visto.observe(mapa);
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
const anoAtual = document.getElementById('ano');
if (anoAtual) anoAtual.textContent = new Date().getFullYear();

const splashPronto = iniciarSplash();
iniciarMenu();
iniciarRevelacao();

document.querySelectorAll('[data-carrossel]').forEach(iniciarCarrossel);

iniciarComparador();
pausarOutrosVideos();
iniciarVideoCards();
iniciarGaleriaVideos(splashPronto);
iniciarFotoAmpliada();
iniciarMapa();
