// Espaço Decora By Rita Assunção — comportamento da página.
// Cada funcionalidade é uma função iniciada no fim do arquivo. O HTML já
// funciona sem JS (carrosséis rolam nativamente, vídeos e fotos abrem por link).

const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
const comportamentoRolagem = () => (reduzMovimento.matches ? 'auto' : 'smooth');

// ---------------------------------------------------------------------------
// Splash: o vídeo (~10 s, sem áudio, sem loop) toca INTEIRO uma vez por sessão.
// A saída vem do evento "ended" (fade de 650 ms) ou do botão "Pular introdução"
// (aparece após 1,5 s). Nada aqui remove o splash por tempo fixo curto: os únicos
// temporizadores são de segurança (vídeo que não carrega/trava → fade curto).
// Movimento reduzido: estado estático (fundo + logo) por 700 ms, sem vídeo.
// Devolve uma Promise resolvida quando o splash sai (ou não existe).
// ---------------------------------------------------------------------------
const FADE_SPLASH = 650;        // saída depois de "ended" ou de "Pular"
const FADE_SPLASH_CURTO = 300;  // saída de emergência (vídeo falhou)
const LIMITE_CARGA_VIDEO = 6000; // sem "playing" nesse prazo → libera a página

function iniciarSplash() {
  window.edSplashIniciado = true;
  const splash = document.getElementById('splash');
  const raiz = document.documentElement;
  if (!splash) return Promise.resolve();

  if (!raiz.classList.contains('splash-ativo')) {
    splash.remove();
    return Promise.resolve();
  }

  try { sessionStorage.setItem('edIntroVista', '1'); } catch (e) { /* sem storage */ }

  return new Promise((resolve) => {
    const video = splash.querySelector('.splash__video');
    const pular = splash.querySelector('[data-splash-pular]');
    const temporizadores = new Set();
    let vigia = 0;
    let saindo = false;

    const agendar = (fn, ms) => {
      const id = setTimeout(() => { temporizadores.delete(id); fn(); }, ms);
      temporizadores.add(id);
      return id;
    };

    const finalizar = () => {
      temporizadores.forEach(clearTimeout);
      temporizadores.clear();
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      video.pause();
      video.removeAttribute('src');
      video.load();
      raiz.classList.remove('splash-ativo');
      raiz.classList.add('sem-splash');
      splash.remove();
      resolve();
    };

    const sair = (duracao = FADE_SPLASH) => {
      if (saindo) return;
      saindo = true;
      temporizadores.forEach(clearTimeout);
      temporizadores.clear();
      pular.hidden = true;
      if (duracao <= 0 || typeof splash.animate !== 'function') { finalizar(); return; }
      splash
        .animate([{ opacity: getComputedStyle(splash).opacity }, { opacity: 0 }], { duration: duracao, easing: 'ease', fill: 'forwards' })
        .finished.then(finalizar, finalizar);
    };
    const sairRapido = () => sair(FADE_SPLASH_CURTO);

    function aoTeclar(e) {
      if (e.key === 'Escape') sair();
    }
    // Aba escondida pode pausar o vídeo: ao voltar, retoma de onde parou.
    function aoMudarVisibilidade() {
      if (document.visibilityState === 'visible' && video.paused && !video.ended && !saindo) {
        video.play().catch(sairRapido);
      }
    }

    // Quem navega por teclado não pode se perder na página coberta: o foco que
    // tentar sair do splash volta ao botão (o link "Pular para o conteúdo" é
    // exceção). Leitores de tela continuam lendo a página no modo de navegação.
    function aoFocar(e) {
      if (saindo || splash.contains(e.target) || e.target.closest('.pular-conteudo')) return;
      pular.hidden = false;
      pular.focus();
    }

    pular.addEventListener('click', () => sair());
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('focusin', aoFocar);

    // ---- Movimento reduzido: estado estático, sem vídeo -------------------
    if (reduzMovimento.matches) {
      splash.classList.add('splash--logo');
      pular.hidden = false;
      agendar(() => sair(0), 700);
      return;
    }

    agendar(() => { if (!saindo) pular.hidden = false; }, 1500);

    // ---- Vídeo -------------------------------------------------------------
    // Vigia: se o vídeo não estiver reproduzindo em LIMITE_CARGA_VIDEO ms (não
    // carregou, travou no buffer, autoplay silencioso bloqueado), libera a página.
    // Um prazo só: "waiting"/"stalled" repetidos não o reiniciam; só "playing" o cancela.
    const vigiar = () => {
      if (vigia) return;
      vigia = agendar(sairRapido, LIMITE_CARGA_VIDEO);
    };
    const tocar = () => {
      const promessa = video.play();
      if (promessa && typeof promessa.catch === 'function') promessa.catch(sairRapido);
    };

    video.addEventListener('playing', () => {
      clearTimeout(vigia);
      temporizadores.delete(vigia);
      vigia = 0;
    });
    video.addEventListener('waiting', vigiar);
    video.addEventListener('stalled', vigiar);
    video.addEventListener('canplay', tocar, { once: true });
    video.addEventListener('error', sairRapido);
    video.addEventListener('ended', () => sair());
    // A logo real (HTML) entra por cima quando os ramos do vídeo já cresceram.
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= 3) splash.classList.add('splash--logo');
    });
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    const ehMovel = window.matchMedia('(max-width: 640px), (max-aspect-ratio: 4/5)').matches;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = false;
    video.playsInline = true;
    video.preload = 'auto';
    vigiar();
    video.src = ehMovel ? video.dataset.srcMovel : video.dataset.src;
    tocar();
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
// Carrossel reutilizável (ideias em vídeo, avaliações e fotos da rua).
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
// Vitrine Viva (hero): três fotos no Swiper (efeito Creative discreto, loop) e
// três painéis de texto que trocam junto. Os painéis ocupam a mesma célula da
// grade (altura do maior reservada, sem layout shift); aqui só se alterna
// .is-ativo. O autoplay só começa depois do splash e tem uma única fonte de
// verdade (motivos de pausa → aplicar()), para o botão de pausa, o mouse, o foco
// do teclado, o toque, a aba oculta e o hero fora da tela nunca brigarem.
// ---------------------------------------------------------------------------
function iniciarHero(splashPronto) {
  const hero = document.querySelector('[data-hero]');
  const alvo = hero && hero.querySelector('[data-hero-swiper]');
  if (!hero || !alvo) return;
  if (typeof Swiper === 'undefined') {
    hero.classList.add('hero--sem-swiper');
    return;
  }

  const paineis = Array.from(hero.querySelectorAll('[data-hero-painel]'));
  const legendas = Array.from(hero.querySelectorAll('.hero__legenda'));
  const atual = hero.querySelector('[data-hero-atual]');
  const barra = hero.querySelector('[data-hero-progresso]');
  const anterior = hero.querySelector('[data-hero-anterior]');
  const proximo = hero.querySelector('[data-hero-proximo]');
  const pausa = hero.querySelector('[data-hero-pausa]');

  const semMovimento = reduzMovimento.matches;
  const mouseFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const atraso = window.matchMedia('(max-width: 767px)').matches ? 6500 : 5500;
  const velocidade = semMovimento ? 0 : 900;
  hero.style.setProperty('--hero-zoom', `${atraso + velocidade}ms`);

  const swiper = new Swiper(alvo, {
    loop: true,
    speed: velocidade,
    effect: 'creative',
    creativeEffect: {
      limitProgress: 1,
      perspective: false,
      prev: { translate: ['-8%', 0, 0], opacity: 0 },
      next: { translate: ['8%', 0, 0], opacity: 0 },
    },
    grabCursor: mouseFino,
    threshold: 6,
    // Começa parado; o autoplay é ligado por aplicar() depois do splash.
    autoplay: semMovimento ? false : { enabled: false, delay: atraso, disableOnInteraction: false, pauseOnMouseEnter: true },
    keyboard: { enabled: false, onlyInViewport: false },
    a11y: {
      containerRole: 'region',
      containerMessage: 'Fotos da loja',
      containerRoleDescriptionMessage: 'carrossel',
      itemRoleDescriptionMessage: 'foto',
      slideLabelMessage: '{{index}} de {{slidesLength}}',
      wrapperLiveRegion: false, // o autoplay não pode anunciar cada troca
    },
  });
  hero.setAttribute('data-hero-ativo', '');

  // ---- Texto, legenda e contador acompanham a foto --------------------------
  const marcar = (lista, indice) => {
    lista.forEach((el, i) => {
      const ativo = i === indice;
      el.classList.toggle('is-ativo', ativo);
      el.setAttribute('aria-hidden', String(!ativo));
      el.inert = !ativo;
    });
  };
  const mostrar = (indice) => {
    marcar(paineis, indice);
    marcar(legendas, indice);
    if (atual) atual.textContent = String(indice + 1).padStart(2, '0');
    if (barra) barra.style.transform = 'scaleX(0)';
  };
  mostrar(0);

  // Slides clonados pelo loop não são conteúdo: fora da árvore de acessibilidade.
  const ocultarClones = () => {
    swiper.slides.forEach((el) => {
      if (el.classList.contains('swiper-slide-duplicate')) el.setAttribute('aria-hidden', 'true');
    });
  };
  ocultarClones();
  swiper.on('update', ocultarClones);
  swiper.on('loopFix', ocultarClones);
  swiper.on('slideChange', () => mostrar(swiper.realIndex));

  if (anterior) anterior.addEventListener('click', () => swiper.slidePrev());
  if (proximo) proximo.addEventListener('click', () => swiper.slideNext());

  // ---- Autoplay --------------------------------------------------------------
  if (semMovimento) {
    hero.setAttribute('data-hero-sem-autoplay', '');
    return;
  }

  const motivos = { aguardando: true, usuario: false, foco: false, hover: false, toque: false, fora: false, aba: document.hidden };
  const aplicar = () => {
    const devePassar = !Object.values(motivos).some(Boolean);
    if (devePassar && !swiper.autoplay.running) swiper.autoplay.start();
    else if (!devePassar && swiper.autoplay.running) swiper.autoplay.stop();
  };

  swiper.on('autoplayTimeLeft', (_s, _ms, restante) => {
    if (barra) barra.style.transform = `scaleX(${Math.min(1, Math.max(0, 1 - restante)).toFixed(4)})`;
  });

  // Só depois do splash (e da entrada de ~1,2 s) as fotos começam a passar.
  splashPronto.then(() => setTimeout(() => { motivos.aguardando = false; aplicar(); }, 1200));

  hero.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { motivos.hover = true; aplicar(); } });
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { motivos.hover = false; aplicar(); } });

  // Toque: pausa enquanto toca e por mais 4 s depois; o ciclo recomeça cheio.
  let temporizadorToque = 0;
  hero.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(temporizadorToque);
    motivos.toque = true;
    aplicar();
  });
  const soltarToque = (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(temporizadorToque);
    temporizadorToque = setTimeout(() => { motivos.toque = false; aplicar(); }, 4000);
  };
  hero.addEventListener('pointerup', soltarToque);
  hero.addEventListener('pointercancel', soltarToque);

  // Teclado: setas trocam as fotos enquanto o foco estiver no hero; foco
  // visível (Tab) pausa a troca automática.
  hero.addEventListener('focusin', (e) => {
    swiper.keyboard.enable();
    if (e.target.matches(':focus-visible')) { motivos.foco = true; aplicar(); }
  });
  hero.addEventListener('focusout', (e) => {
    if (e.relatedTarget && hero.contains(e.relatedTarget)) return;
    swiper.keyboard.disable();
    motivos.foco = false;
    aplicar();
  });

  document.addEventListener('visibilitychange', () => { motivos.aba = document.hidden; aplicar(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
      motivos.fora = !entradas[entradas.length - 1].isIntersecting;
      aplicar();
    }, { threshold: 0.3 }).observe(hero);
  }

  if (pausa) {
    pausa.addEventListener('click', () => {
      motivos.usuario = !motivos.usuario;
      hero.classList.toggle('is-pausado', motivos.usuario);
      pausa.setAttribute('aria-label', motivos.usuario ? 'Retomar a troca automática' : 'Pausar a troca automática');
      aplicar();
    });
  }
}

// ---------------------------------------------------------------------------
// Categorias ("Peças para diferentes cantos da casa"): trilho horizontal com o
// mesmo Swiper. Sem autoplay e sem roda do mouse (a página nunca é sequestrada);
// a pessoa arrasta, usa as setas ou o teclado (com o foco na seção). O próximo
// card sempre aparece pela metade. A entrada ao rolar é uma classe (.is-visible)
// posta uma única vez por IntersectionObserver.
// ---------------------------------------------------------------------------
function iniciarCategorias() {
  const secao = document.querySelector('[data-categorias]');
  const alvo = secao && secao.querySelector('[data-categorias-swiper]');
  if (!secao || !alvo) return;

  if (!('IntersectionObserver' in window) || reduzMovimento.matches) {
    secao.classList.add('is-visible');
  } else {
    const entrada = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      secao.classList.add('is-visible');
      entrada.disconnect();
    }, { threshold: 0.2 });
    entrada.observe(secao);
  }

  if (typeof Swiper === 'undefined') {
    secao.classList.add('categorias--sem-swiper');
    return;
  }

  const anterior = secao.querySelector('[data-categorias-anterior]');
  const proximo = secao.querySelector('[data-categorias-proximo]');
  const atual = secao.querySelector('[data-categorias-atual]');
  const progresso = secao.querySelector('[data-categorias-progresso]');
  const controles = secao.querySelector('[data-categorias-controles]');
  const total = alvo.querySelectorAll('.swiper-slide').length;
  const mouseFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const swiper = new Swiper(alvo, {
    slidesPerView: 1.12,
    spaceBetween: 14,
    centeredSlides: false,
    breakpoints: {
      640: { slidesPerView: 1.65, spaceBetween: 20 },
      900: { slidesPerView: 2.35, spaceBetween: 24 },
      1280: { slidesPerView: 3.15, spaceBetween: 28 },
    },
    loop: false,
    speed: reduzMovimento.matches ? 0 : 750,
    grabCursor: mouseFino,
    freeMode: { enabled: true, sticky: true, momentum: true, momentumRatio: 0.6, momentumBounce: false },
    watchOverflow: true,
    watchSlidesProgress: true, // marca .swiper-slide-fully-visible (o resto fica esmaecido)
    resistanceRatio: 0.6,
    threshold: 6,
    keyboard: { enabled: false, onlyInViewport: false },
    a11y: {
      slideRole: 'article',
      slideLabelMessage: '{{index}} de {{slidesLength}}',
      wrapperLiveRegion: false,
    },
  });

  const alternarSeta = (botao, desativado) => {
    botao.setAttribute('aria-disabled', String(desativado));
    botao.classList.toggle('is-desativado', desativado);
  };

  const slides = Array.from(alvo.querySelectorAll('.swiper-slide'));
  const atualizar = () => {
    alternarSeta(anterior, swiper.isBeginning);
    alternarSeta(proximo, swiper.isEnd);
    // "Inteiro na janela" com 2 px de tolerância (a classe do Swiper falha por
    // frações de pixel no último card e esmaeceria a última posição inteira).
    slides.forEach((el, i) => {
      const inicio = swiper.slidesGrid[i] + swiper.translate;
      const fim = inicio + swiper.slidesSizesGrid[i];
      el.classList.toggle('is-inteiro', inicio >= -2 && fim <= swiper.size + 2);
    });
    const passo = swiper.slidesSizesGrid[0] + (swiper.params.spaceBetween || 0);
    const primeiro = Math.min(total - 1, Math.max(0, Math.round(-swiper.translate / passo)));
    atual.textContent = String(primeiro + 1).padStart(2, '0');
    // Preenchimento mínimo de 1/total: a barra sempre diz "onde estou".
    const p = Math.min(1, Math.max(0, swiper.progress || 0));
    progresso.style.transform = `scaleX(${((1 + p * (total - 1)) / total).toFixed(4)})`;
  };
  swiper.on('progress', atualizar);
  swiper.on('setTranslate', atualizar);
  swiper.on('slideChange', atualizar);
  swiper.on('resize', atualizar);
  swiper.on('update', atualizar);
  swiper.on('breakpoint', atualizar);
  atualizar();

  // A indicação "arraste para explorar" perde a função na primeira interação.
  const usada = () => { if (controles) controles.classList.add('is-usada'); };
  swiper.on('touchStart', usada);
  swiper.on('slideChange', usada);
  swiper.on('progress', () => { if (swiper.isTouched || swiper.animating) usada(); });

  const irPara = (direcao) => {
    if ((direcao < 0 ? anterior : proximo).getAttribute('aria-disabled') === 'true') return;
    usada();
    if (direcao < 0) swiper.slidePrev(); else swiper.slideNext();
  };
  anterior.addEventListener('click', () => irPara(-1));
  proximo.addEventListener('click', () => irPara(1));

  // Teclado só com o foco na seção (o trilho tem tabindex="0"); nunca global.
  secao.addEventListener('focusin', () => swiper.keyboard.enable());
  secao.addEventListener('focusout', (e) => {
    if (e.relatedTarget && secao.contains(e.relatedTarget)) return;
    swiper.keyboard.disable();
  });
}

// "Conheça a loja" → #categorias com rolagem suave só quando o sistema permite.
// O CSS (html.rolagem-suave) vale por um instante, e o deslocamento do cabeçalho
// fixo vem de scroll-padding-top; o link continua funcionando sem JavaScript.
function iniciarRolagemSuave() {
  document.querySelectorAll('[data-rolagem-suave]').forEach((link) => {
    link.addEventListener('click', () => {
      if (reduzMovimento.matches) return;
      const raiz = document.documentElement;
      raiz.classList.add('rolagem-suave');
      setTimeout(() => raiz.classList.remove('rolagem-suave'), 1200);
    });
  });
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
const anoAtual = document.getElementById('ano');
if (anoAtual) anoAtual.textContent = new Date().getFullYear();

const splashPronto = iniciarSplash();
// A entrada do hero (CSS, ≤ 1,2 s) só dispara depois que o splash sai. Dois
// quadros de folga garantem que o estado inicial escondido já foi pintado.
splashPronto.then(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.add('hero-pronto');
    setTimeout(() => document.documentElement.classList.add('hero-entrou'), 1400);
  }));
});
iniciarMenu();
iniciarRevelacao();
iniciarHero(splashPronto);
iniciarCategorias();
iniciarRolagemSuave();

document.querySelectorAll('[data-carrossel]').forEach(iniciarCarrossel);

iniciarComparador();
pausarOutrosVideos();
iniciarVideoCards();
iniciarGaleriaVideos(splashPronto);
iniciarFotoAmpliada();
iniciarMapa();
