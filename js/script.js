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
// Posters de vídeo abaixo da dobra: o atributo `poster` não tem lazy-loading e
// baixava ~530 KB já na abertura. Aqui cada poster (data-poster) só é
// atribuído quando o vídeo chega perto da tela.
// ---------------------------------------------------------------------------
const videosComPosterAdiado = document.querySelectorAll('video[data-poster]:not(.splash__video)');
if (videosComPosterAdiado.length) {
  const aplicarPoster = (v) => {
    if (v.dataset.poster) { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); }
  };
  if ('IntersectionObserver' in window) {
    const observadorPoster = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { aplicarPoster(e.target); observadorPoster.unobserve(e.target); }
      });
    }, { rootMargin: '900px 0px' });
    videosComPosterAdiado.forEach((v) => observadorPoster.observe(v));
  } else {
    videosComPosterAdiado.forEach(aplicarPoster);
  }
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
        if (outro !== video && !outro.paused) outro.pause();
      });
    });
  });
}

// ---------------------------------------------------------------------------
// "Reconheça a loja ao chegar": cada foto é um <a href> apontando direto
// pro arquivo — sem JS, o clique simplesmente abre a imagem (fallback
// funcional). Com JS, o clique é interceptado e a mesma imagem é exibida
// ampliada no <dialog> reaproveitado, devolvendo o foco ao link de origem
// ao fechar.
// ---------------------------------------------------------------------------
const fotoDialog = document.getElementById('foto-dialog');

if (fotoDialog) {
  const fotoDialogImg = document.getElementById('foto-dialog-img');
  const fotoDialogLegenda = document.getElementById('foto-dialog-titulo');
  const botaoFecharFoto = fotoDialog.querySelector('[data-fecha-foto]');
  let origemFoco = null;

  const abrirFoto = (link) => {
    origemFoco = link;
    const legenda = link.dataset.legenda || '';
    fotoDialogImg.src = link.href;
    fotoDialogImg.alt = link.querySelector('img').alt || legenda;
    fotoDialogLegenda.textContent = legenda;
    document.documentElement.classList.add('foto-dialog-aberto');
    fotoDialog.showModal();
  };

  document.querySelectorAll('[data-abre-foto]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      abrirFoto(link);
    });
  });

  if (botaoFecharFoto) {
    botaoFecharFoto.addEventListener('click', () => fotoDialog.close());
  }

  // Fecha ao clicar fora do quadro (no próprio <dialog>, que é o backdrop)
  // — comparar e.target com o dialog evita fechar por engano ao clicar ou
  // arrastar dentro da foto, inclusive durante um gesto de pinça/zoom.
  fotoDialog.addEventListener('click', (e) => {
    if (e.target === fotoDialog) fotoDialog.close();
  });

  // Cobre fechamento por Esc (evento nativo do <dialog>), pelo botão e por
  // clique fora: sempre libera a rolagem do fundo e devolve o foco.
  fotoDialog.addEventListener('close', () => {
    document.documentElement.classList.remove('foto-dialog-aberto');
    fotoDialogImg.removeAttribute('src');
    if (origemFoco) origemFoco.focus();
  });
}

// ---------------------------------------------------------------------------
// Explorador da loja: visita guiada em três etapas (vídeos convencionais,
// NÃO 360°). O HTML já traz três blocos com <video controls> — é a versão
// sem JS e também a única fonte de dados (títulos, durações, posters,
// capítulos). Aqui eles viram UM player com etapas. Se qualquer coisa
// falhar antes do fim da inicialização, o palco continua escondido e os
// três blocos originais permanecem visíveis e reproduzíveis.
// Nada inicia sozinho: trocar de etapa, terminar um vídeo ou clicar num
// capítulo nunca chama play().
// ---------------------------------------------------------------------------
const exploradorRaiz = document.querySelector('[data-explorador]');

if (exploradorRaiz) {
  const palco = exploradorRaiz.querySelector('[data-explorador-palco]');
  const blocos = exploradorRaiz.querySelector('[data-explorador-blocos]');

  try {
    iniciarExplorador(exploradorRaiz, palco, blocos);
  } catch (erro) {
    if (palco) palco.hidden = true;
    if (blocos) blocos.hidden = false;
    const fechamento = exploradorRaiz.querySelector('[data-ex="conclusao"]');
    if (fechamento) fechamento.hidden = false;
    console.warn('Explorador da loja: usando os blocos simples.', erro);
  }
}

function iniciarExplorador(raiz, palco, blocos) {
  const el = (nome) => {
    const alvo = raiz.querySelector(`[data-ex="${nome}"]`);
    if (!alvo) throw new Error(`Elemento ausente: ${nome}`);
    return alvo;
  };

  const etapas = Array.from(blocos.querySelectorAll('[data-etapa]')).map((bloco) => {
    const video = bloco.querySelector('video');
    const fonte = video.querySelector('source');
    return {
      numero: Number(bloco.dataset.etapa),
      titulo: bloco.dataset.titulo,
      duracao: bloco.dataset.duracao,
      descricao: bloco.querySelector('[data-ex-desc]').textContent.trim(),
      arquivo: fonte.getAttribute('src'),
      poster: video.getAttribute('data-poster') || video.getAttribute('poster'),
      miniatura: bloco.dataset.miniatura || video.getAttribute('data-poster') || video.getAttribute('poster'),
      capitulos: Array.from(bloco.querySelectorAll('[data-tempo]')).map((a) => ({
        tempo: Number(a.dataset.tempo),
        rotulo: a.dataset.rotulo,
      })),
    };
  });

  if (etapas.length !== 3 || etapas.some((e) => !e.arquivo || !e.poster || !e.titulo)) {
    throw new Error('Dados das etapas incompletos');
  }

  const video = el('video');
  const baixar = el('baixar');
  const texto = el('texto');
  const passo = el('passo');
  const titulo = el('titulo');
  const duracao = el('duracao');
  const descricao = el('descricao');
  const fim = el('fim');
  const fimMsg = el('fim-msg');
  const continuar = el('continuar');
  const anterior = el('anterior');
  const proxima = el('proxima');
  const lista = el('etapas');
  const observar = el('observar');
  const detalhes = el('detalhes');
  const voltar = el('voltar');
  const avancar = el('avancar');
  const pausa = el('pausa');
  const velocidade = el('velocidade');
  const normal = el('normal');
  const capitulosLista = el('capitulos');
  const status = el('status');
  const conclusao = raiz.querySelector('[data-ex="conclusao"]');

  const total = etapas.length;
  const VELOCIDADE_DETALHE = 0.75;
  let indice = 0;
  let tempoPendente = null;

  const formatarTempo = (seg) => {
    // floor: o rótulo nunca promete um instante à frente do frame mostrado.
    const s = Math.max(0, Math.floor(seg + 1e-6));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const formatarVelocidade = (v) => `${String(v).replace('.', ',')}x`;
  const anunciar = (msg) => { status.textContent = msg; };

  // Botões com aria-disabled (não `disabled`) mantêm o foco no lugar.
  const definirDesativado = (botao, desativado) => {
    botao.setAttribute('aria-disabled', desativado ? 'true' : 'false');
  };
  const aoClicar = (botao, acao) => {
    botao.addEventListener('click', () => {
      if (botao.getAttribute('aria-disabled') === 'true') return;
      acao();
    });
  };

  // --- lista de etapas (botões reais, aria-current="step" na atual) -------
  const botoesEtapa = etapas.map((etapa, i) => {
    const li = document.createElement('li');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'explorador__etapa';
    botao.setAttribute('aria-label', `Etapa ${etapa.numero} de ${total}: ${etapa.titulo}, duração ${etapa.duracao}`);

    const mini = document.createElement('img');
    mini.className = 'explorador__miniatura';
    mini.src = etapa.miniatura;
    mini.alt = '';
    mini.width = 56;
    mini.height = 100;
    mini.loading = 'lazy';

    const nome = document.createElement('span');
    nome.className = 'explorador__etapa-titulo';
    nome.textContent = `${etapa.numero} · ${etapa.titulo}`;

    const meta = document.createElement('span');
    meta.className = 'explorador__etapa-meta';
    meta.textContent = etapa.duracao;

    botao.append(mini, nome, meta);
    botao.addEventListener('click', () => irParaEtapa(i));
    li.appendChild(botao);
    lista.appendChild(li);
    return botao;
  });

  // --- velocidade / modo "Observar detalhes" --------------------------------
  const definirVelocidade = (v) => {
    // defaultPlaybackRate sobrevive ao load() ao trocar de etapa.
    video.defaultPlaybackRate = v;
    video.playbackRate = v;
    atualizarVelocidade();
  };
  const atualizarVelocidade = () => {
    velocidade.textContent = `Velocidade: ${formatarVelocidade(video.playbackRate)}`;
    definirDesativado(normal, video.playbackRate === 1);
  };

  observar.addEventListener('click', () => {
    const ativar = observar.getAttribute('aria-pressed') !== 'true';
    observar.setAttribute('aria-pressed', String(ativar));
    detalhes.hidden = !ativar;
    definirVelocidade(ativar ? VELOCIDADE_DETALHE : 1);
    anunciar(ativar
      ? `Observar detalhes ligado: velocidade ${formatarVelocidade(VELOCIDADE_DETALHE)}.`
      : 'Observar detalhes desligado: velocidade normal.');
  });
  aoClicar(normal, () => {
    definirVelocidade(1);
    anunciar('Velocidade normal.');
  });
  video.addEventListener('ratechange', atualizarVelocidade);

  // --- posicionamento no vídeo ---------------------------------------------
  // Antes de o navegador ter metadados (preload="none"), currentTime não é
  // confiável: pede só os metadados desta etapa e posiciona quando chegarem.
  // Aqui o load() é intencional — o visitante acabou de pedir esse trecho.
  video.addEventListener('loadedmetadata', () => {
    if (tempoPendente !== null) {
      video.currentTime = Math.min(tempoPendente, video.duration || tempoPendente);
      tempoPendente = null;
    }
  });
  const irParaTempo = (segundos) => {
    if (video.readyState >= 1) {
      video.currentTime = Math.min(segundos, video.duration || segundos);
    } else {
      tempoPendente = segundos;
      video.preload = 'metadata';
      video.load();
    }
  };
  const tempoAtual = () => (video.readyState >= 1 ? video.currentTime : (tempoPendente || 0));
  const deslocar = (delta) => {
    const limite = Number.isFinite(video.duration) ? video.duration : Infinity;
    irParaTempo(Math.min(limite, Math.max(0, tempoAtual() + delta)));
  };
  aoClicar(voltar, () => deslocar(-5));
  aoClicar(avancar, () => deslocar(5));

  aoClicar(pausa, () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  const atualizarPausa = () => { pausa.textContent = video.paused ? 'Reproduzir' : 'Pausar'; };
  video.addEventListener('play', atualizarPausa);
  video.addEventListener('pause', atualizarPausa);
  video.addEventListener('ended', atualizarPausa);

  // --- fim do vídeo: destaca a próxima etapa, sem iniciar nada --------------
  const limparFim = () => {
    fim.hidden = true;
    if (conclusao) conclusao.hidden = true;
    botoesEtapa.forEach((b) => b.classList.remove('is-proxima'));
  };
  video.addEventListener('play', limparFim);
  video.addEventListener('ended', () => {
    const atual = etapas[indice];
    if (indice < total - 1) {
      fimMsg.textContent = `Etapa ${atual.numero} concluída.`;
      continuar.hidden = false;
      botoesEtapa[indice + 1].classList.add('is-proxima');
      anunciar(`Etapa ${atual.numero} concluída. Use Continuar a visita para seguir para a próxima etapa.`);
    } else {
      fimMsg.textContent = 'Você chegou ao fim da visita guiada.';
      continuar.hidden = true;
      anunciar('Fim da visita guiada. Logo abaixo: planejar sua visita ou falar no WhatsApp.');
      if (conclusao) {
        // O aviso "fim" abre antes: ele empurra o layout, e a rolagem abaixo
        // precisa medir a posição já final da faixa.
        fim.hidden = false;
        // Só aparece por decisão do visitante (terminou o vídeo); nunca inicia nada.
        conclusao.hidden = false;
        conclusao.classList.remove('is-entrando');
        void conclusao.offsetWidth;
        conclusao.classList.add('is-entrando');
        // Fora da tela cheia, traz a faixa para a vista com o mínimo de rolagem.
        if (!document.fullscreenElement) {
          conclusao.scrollIntoView({ block: 'nearest', behavior: prefereMenosMovimento ? 'auto' : 'smooth' });
        }
      }
    }
    fim.hidden = false;
  });

  // --- capítulos da etapa atual --------------------------------------------
  const montarCapitulos = () => {
    capitulosLista.textContent = '';
    etapas[indice].capitulos.forEach((cap) => {
      const li = document.createElement('li');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'explorador__capitulo';
      botao.setAttribute('aria-label', `Ir para ${formatarTempo(cap.tempo)}: ${cap.rotulo}`);

      const tempo = document.createElement('span');
      tempo.className = 'explorador__capitulo-tempo';
      tempo.textContent = formatarTempo(cap.tempo);
      const rotulo = document.createElement('span');
      rotulo.textContent = cap.rotulo;

      botao.append(tempo, rotulo);
      // Só posiciona: se estava pausado, continua pausado.
      botao.addEventListener('click', () => {
        irParaTempo(cap.tempo);
        anunciar(`Vídeo em ${formatarTempo(cap.tempo)}: ${cap.rotulo}.`);
      });
      li.appendChild(botao);
      capitulosLista.appendChild(li);
    });
  };

  // --- troca de etapa ------------------------------------------------------
  function irParaEtapa(novo, inicial = false) {
    if (novo < 0 || novo >= total) return;

    // Só pausa se estiver tocando: pause() num vídeo ainda sem carregar
    // (NETWORK_EMPTY) dispara a seleção de recurso e ignora preload="none".
    if (!video.paused) video.pause();
    tempoPendente = null;
    indice = novo;
    const etapa = etapas[novo];

    // Trocar o src já executa o algoritmo de carga do navegador. Só a etapa
    // ATIVA usa preload="metadata" (baixa apenas o cabeçalho, que o faststart
    // deixa no início do arquivo); a etapa inicial espera o splash acabar e a
    // seção chegar perto da tela (ativarMetadata, abaixo), e as demais nunca
    // são tocadas até serem escolhidas. load() explícito NÃO é chamado aqui
    // de propósito — o Chrome o trata como pedido de download completo e
    // ignora o preload (medido).
    video.preload = inicial ? 'none' : 'metadata';
    video.src = etapa.arquivo;
    // Poster da etapa inicial: só quando a seção fica perto (ativarMetadata).
    if (!inicial) video.poster = etapa.poster;
    baixar.setAttribute('href', etapa.arquivo);
    video.setAttribute('aria-label', `Etapa ${etapa.numero} de ${total}: ${etapa.titulo}`);
    atualizarPausa();
    atualizarVelocidade();

    passo.textContent = `Etapa ${etapa.numero} de ${total}`;
    titulo.textContent = etapa.titulo;
    duracao.textContent = `Duração: ${etapa.duracao}`;
    descricao.textContent = etapa.descricao;

    botoesEtapa.forEach((botao, i) => {
      if (i === novo) {
        botao.setAttribute('aria-current', 'step');
      } else {
        botao.removeAttribute('aria-current');
      }
    });
    definirDesativado(anterior, novo === 0);
    definirDesativado(proxima, novo === total - 1);
    limparFim();
    montarCapitulos();

    if (!inicial) {
      // No mobile a lista de etapas rola na horizontal: traz a atual para a
      // vista sem mexer na rolagem vertical da página.
      if (lista.scrollWidth > lista.clientWidth) {
        const item = botoesEtapa[novo].parentElement;
        const recuo = parseFloat(getComputedStyle(lista).paddingLeft) || 0;
        lista.scrollTo({
          left: item.getBoundingClientRect().left - lista.getBoundingClientRect().left + lista.scrollLeft - recuo,
          behavior: prefereMenosMovimento ? 'auto' : 'smooth',
        });
      }
      texto.classList.remove('is-entrando');
      void texto.offsetWidth;
      texto.classList.add('is-entrando');
      anunciar(`Etapa ${etapa.numero} de ${total}: ${etapa.titulo}. Duração ${etapa.duracao}.`);
    }
  }

  texto.addEventListener('animationend', () => texto.classList.remove('is-entrando'));
  if (conclusao) conclusao.addEventListener('animationend', () => conclusao.classList.remove('is-entrando'));
  aoClicar(anterior, () => irParaEtapa(indice - 1));
  aoClicar(proxima, () => irParaEtapa(indice + 1));
  continuar.addEventListener('click', () => {
    irParaEtapa(indice + 1);
    // O botão some ao trocar de etapa: devolve o foco ao player.
    video.focus();
  });

  irParaEtapa(0, true);
  definirVelocidade(1);

  // A etapa 1 só pede metadados depois que o splash acabou (na primeira
  // abertura ele já disputa a rede com o vídeo dos ramos) e quando a seção
  // está perto de aparecer. Se o visitante escolher outra etapa antes, ela
  // já entra com preload="metadata" e isto vira um no-op.
  const ativarMetadata = () => {
    if (!video.poster) video.poster = etapas[indice].poster;
    if (video.preload === 'none') video.preload = 'metadata';
  };
  const aguardarSplash = () => new Promise((resolve) => {
    if (!document.getElementById('splash')) { resolve(); return; }
    const espera = setInterval(() => {
      if (!document.getElementById('splash')) { clearInterval(espera); resolve(); }
    }, 300);
  });
  if ('IntersectionObserver' in window) {
    const perto = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        perto.disconnect();
        aguardarSplash().then(ativarMetadata);
      }
    }, { rootMargin: '600px 0px' });
    perto.observe(raiz);
  } else {
    aguardarSplash().then(ativarMetadata);
  }

  // Tudo montado: só agora troca os blocos simples pelo player único.
  palco.hidden = false;
  if (conclusao) conclusao.hidden = true;
  blocos.remove();
}
