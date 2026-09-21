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
// Galeria "Na Espaço Decora": quatro fotos, sem autoplay e sem loop. No desktop
// a troca é uma dissolução por ruído em WebGL (canvas sobre o <img>); no celular
// (até 767px), com movimento reduzido ou se o WebGL falhar, é só o <img> com um
// cross-fade curto. O WebGL só é criado quando a seção está perto da tela e só
// desenha durante uma transição: parado, não há requestAnimationFrame rodando.
// Marcação: [data-morph] > [data-morph-palco] (img, canvas, legenda, setas),
// [data-morph-item] (miniaturas, com data-src/-titulo/-alt) e [data-morph-contador].
// ---------------------------------------------------------------------------
const MORPH = {
  duracao: 850,       // ms da transição
  escalaRuido: 3.0,   // frequência do ruído (mais alto = manchas menores)
  borda: 0.12,        // suavidade da frente da dissolução
  deriva: 0.22,       // deslocamento de textura durante a transição
  dprMax: 1.5,
};

const MORPH_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Ruído de valor + fbm. A luminância da imagem seguinte entra no limiar: as
// áreas claras dela aparecem antes. coverUV reproduz object-fit: cover e mirror
// evita bordas esticadas quando a deriva empurra a amostra para fora da imagem.
const MORPH_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDe;
uniform sampler2D uPara;
uniform vec2 uTela;
uniform vec2 uImgDe;
uniform vec2 uImgPara;
uniform float uProgresso;
uniform float uEscala;
uniform float uBorda;
uniform float uDeriva;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
vec2 coverUV(vec2 uv, vec2 img) {
  float s = max(uTela.x / img.x, uTela.y / img.y);
  vec2 medida = img * s;
  return (uv * uTela - (uTela - medida) * 0.5) / medida;
}
vec2 mirror(vec2 uv) {
  vec2 m = mod(uv, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

void main() {
  vec2 p = vUv * uEscala;
  // O fbm concentra-se no meio da faixa; reescalar faz a dissolução ocupar
  // todo o tempo da transição, não só o miolo.
  float n = clamp((fbm(p + 1.7) - 0.22) / 0.56, 0.0, 1.0);

  // Deriva: some nas pontas (progresso 0 e 1), então o repouso é exato.
  vec2 fluxo = vec2(fbm(p + 3.1), fbm(p + 7.7)) - 0.5;
  vec2 d = fluxo * uDeriva * 0.16;
  vec4 de = texture2D(uDe, mirror(coverUV(vUv + d * uProgresso, uImgDe)));
  vec4 para = texture2D(uPara, mirror(coverUV(vUv - d * (1.0 - uProgresso), uImgPara)));

  float lum = dot(para.rgb, vec3(0.299, 0.587, 0.114));
  float limiar = n * 0.8 + (1.0 - lum) * 0.2;
  float frente = uProgresso * (1.0 + 2.0 * uBorda) - uBorda;
  float m = 1.0 - smoothstep(frente - uBorda, frente + uBorda, limiar);

  gl_FragColor = vec4(mix(de.rgb, para.rgb, m), 1.0);
}`;

function iniciarGaleriaMorph() {
  const raiz = document.querySelector('[data-morph]');
  if (!raiz) return;

  const palco = raiz.querySelector('[data-morph-palco]');
  const img = palco.querySelector('.galeria-morph__fallback');
  const canvas = palco.querySelector('.galeria-morph__canvas');
  const legenda = raiz.querySelector('[data-morph-legenda]');
  const contador = raiz.querySelector('[data-morph-contador]');
  const anterior = raiz.querySelector('[data-morph-anterior]');
  const proximo = raiz.querySelector('[data-morph-proximo]');
  const botoes = Array.from(raiz.querySelectorAll('[data-morph-item]'));
  const itens = botoes.map((b) => ({ src: b.dataset.src, alt: b.dataset.alt, titulo: b.dataset.titulo }));
  const total = itens.length;
  const movel = window.matchMedia('(max-width: 767px)');

  let indice = 0;   // o que a pessoa escolheu (interface)
  let motor = null; // WebGL ativo; null = fallback DOM

  // --- Imagens (uma promessa por foto; o cache do navegador já tem as miniaturas)
  const imagens = new Map();
  const carregarImagem = (i) => {
    if (!imagens.has(i)) {
      imagens.set(i, new Promise((ok, erro) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => ok(im);
        im.onerror = () => { imagens.delete(i); erro(new Error('imagem')); };
        im.src = itens[i].src;
      }));
    }
    return imagens.get(i);
  };

  // --- Fallback DOM: o <img> troca de fonte; o cross-fade usa um clone que some.
  const trocarNoDom = (i) => {
    const aplicar = () => {
      const saida = img.cloneNode(false);
      saida.classList.add('galeria-morph__fallback--saida');
      saida.alt = '';
      saida.setAttribute('aria-hidden', 'true');
      saida.removeAttribute('loading');
      img.after(saida);
      img.src = itens[i].src;
      img.alt = itens[i].alt;
      if (reduzMovimento.matches || typeof saida.animate !== 'function') { saida.remove(); return; }
      saida.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease' })
        .finished.then(() => saida.remove(), () => saida.remove());
    };
    // Só troca com a nova foto decodificada: sem faixa vazia sob o cross-fade.
    carregarImagem(i).then((im) => (im.decode ? im.decode().catch(() => {}) : null)).then(() => {
      if (i === indice) aplicar();
    }, () => { if (i === indice) { img.src = itens[i].src; img.alt = itens[i].alt; } });
  };

  // --- Motor WebGL. Devolve null se qualquer etapa falhar.
  const criarMotor = () => {
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return null;

    const compilar = (tipo, fonte) => {
      const sombreador = gl.createShader(tipo);
      gl.shaderSource(sombreador, fonte);
      gl.compileShader(sombreador);
      return gl.getShaderParameter(sombreador, gl.COMPILE_STATUS) ? sombreador : null;
    };
    const vert = compilar(gl.VERTEX_SHADER, MORPH_VERT);
    const frag = compilar(gl.FRAGMENT_SHADER, MORPH_FRAG);
    if (!vert || !frag) return null;
    const programa = gl.createProgram();
    gl.attachShader(programa, vert);
    gl.attachShader(programa, frag);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return null;
    gl.useProgram(programa);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posicao = gl.getAttribLocation(programa, 'aPos');
    gl.enableVertexAttribArray(posicao);
    gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uDe', 'uPara', 'uTela', 'uImgDe', 'uImgPara', 'uProgresso', 'uEscala', 'uBorda', 'uDeriva']
      .forEach((nome) => { u[nome] = gl.getUniformLocation(programa, nome); });
    gl.uniform1i(u.uDe, 0);
    gl.uniform1i(u.uPara, 1);
    gl.uniform1f(u.uEscala, MORPH.escalaRuido);
    gl.uniform1f(u.uBorda, MORPH.borda);
    gl.uniform1f(u.uDeriva, MORPH.deriva);

    const texturas = new Map();
    const textura = (i) => {
      if (texturas.has(i)) return texturas.get(i);
      const promessa = carregarImagem(i).then((im) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return { tex, w: im.naturalWidth, h: im.naturalHeight };
      });
      texturas.set(i, promessa);
      return promessa;
    };

    const m = { gl, exibido: -1, animando: false, raf: 0, versao: 0, ativo: true, naTela: true };

    const desenhar = (de, para, progresso) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, de.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, para.tex);
      gl.uniform2f(u.uTela, canvas.width, canvas.height);
      gl.uniform2f(u.uImgDe, de.w, de.h);
      gl.uniform2f(u.uImgPara, para.w, para.h);
      gl.uniform1f(u.uProgresso, progresso);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Quadro de repouso: a foto exibida, sem dissolução.
    const repouso = async () => {
      const t = await textura(m.exibido);
      if (!m.ativo) return;
      desenhar(t, t, 0);
    };

    const ajustarTamanho = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MORPH.dprMax);
      const largura = Math.max(1, Math.round(palco.clientWidth * dpr));
      const altura = Math.max(1, Math.round(palco.clientHeight * dpr));
      if (canvas.width === largura && canvas.height === altura) return;
      canvas.width = largura;
      canvas.height = altura;
      if (!m.animando && m.exibido >= 0) repouso();
    };

    // Para qualquer animação e cai no quadro final (sem deixar meio-termo).
    let alvoAtual = -1;
    m.concluir = () => {
      if (m.raf) { cancelAnimationFrame(m.raf); m.raf = 0; }
      if (!m.animando) return;
      m.animando = false;
      m.exibido = alvoAtual;
      repouso();
    };

    m.mostrar = async (i, animar) => {
      const versao = ++m.versao;
      m.concluir();
      let de, para;
      try {
        [de, para] = await Promise.all([textura(m.exibido < 0 ? i : m.exibido), textura(i)]);
      } catch (e) { m.falha(); return; }
      if (versao !== m.versao || !m.ativo) return;

      const podeAnimar = animar && m.exibido >= 0 && m.exibido !== i
        && !reduzMovimento.matches && !document.hidden && m.naTela;
      if (!podeAnimar) {
        m.exibido = i;
        desenhar(para, para, 0);
        palco.classList.add('galeria-morph__palco--gl');
        return;
      }
      alvoAtual = i;
      m.animando = true;
      const inicio = performance.now();
      const passo = (agora) => {
        m.raf = 0;
        const t = Math.min(1, (agora - inicio) / MORPH.duracao);
        if (t >= 1) { m.concluir(); return; }
        const suave = t * t * (3 - 2 * t);
        desenhar(de, para, suave);
        m.raf = requestAnimationFrame(passo);
      };
      m.raf = requestAnimationFrame(passo);
    };

    m.parar = () => {
      m.ativo = false;
      m.versao++;
      if (m.raf) { cancelAnimationFrame(m.raf); m.raf = 0; }
      m.animando = false;
    };

    // Falha (contexto perdido, shader ou textura): fallback DOM, sem reconstruir.
    m.falha = () => {
      m.parar();
      motor = null;
      palco.classList.remove('galeria-morph__palco--gl');
      img.src = itens[indice].src;
      img.alt = itens[indice].alt;
    };

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); m.falha(); });
    if ('ResizeObserver' in window) new ResizeObserver(ajustarTamanho).observe(palco);
    ajustarTamanho();
    m.ajustarTamanho = ajustarTamanho;

    // Fora da tela, aba oculta ou movimento reduzido: nada anima.
    document.addEventListener('visibilitychange', () => { if (document.hidden) m.concluir(); });
    reduzMovimento.addEventListener('change', () => { if (reduzMovimento.matches) m.concluir(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entradas) => {
        m.naTela = entradas.some((e) => e.isIntersecting);
        if (!m.naTela) m.concluir();
      }).observe(palco);
    }
    return m;
  };

  // --- Navegação
  const atualizarInterface = () => {
    legenda.textContent = itens[indice].titulo;
    contador.textContent = `${indice + 1} de ${total}`;
    botoes.forEach((b, i) => {
      if (i === indice) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    const desativar = (botao, sim, outro) => {
      if (sim && document.activeElement === botao && !outro.disabled) outro.focus();
      botao.disabled = sim;
    };
    desativar(anterior, indice === 0, proximo);
    desativar(proximo, indice === total - 1, anterior);
  };

  const ir = (alvo) => {
    const destino = Math.min(total - 1, Math.max(0, alvo)); // sem loop
    if (destino === indice) return;
    indice = destino;
    atualizarInterface();
    if (motor) {
      // O <img> acompanha por baixo: se o WebGL falhar no meio, já está certo.
      img.src = itens[indice].src;
      img.alt = itens[indice].alt;
      motor.mostrar(indice, true);
    } else {
      trocarNoDom(indice);
    }
  };

  anterior.addEventListener('click', () => ir(indice - 1));
  proximo.addEventListener('click', () => ir(indice + 1));
  botoes.forEach((b, i) => b.addEventListener('click', () => ir(i)));

  palco.addEventListener('keydown', (e) => {
    const destinos = { ArrowLeft: indice - 1, ArrowRight: indice + 1, Home: 0, End: total - 1 };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    ir(destinos[e.key]);
  });

  // Swipe (toque e caneta): arrasto horizontal predominante troca a foto.
  let toque = null;
  palco.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    toque = { x: e.clientX, y: e.clientY };
  });
  palco.addEventListener('pointerup', (e) => {
    if (!toque) return;
    const dx = e.clientX - toque.x;
    const dy = e.clientY - toque.y;
    toque = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) ir(dx < 0 ? indice + 1 : indice - 1);
  });
  palco.addEventListener('pointercancel', () => { toque = null; });

  // --- Início do WebGL: só desktop, sem movimento reduzido e com a seção perto.
  const iniciarWebGL = async () => {
    if (movel.matches || reduzMovimento.matches || !('WebGLRenderingContext' in window)) return;
    try { await carregarImagem(indice); } catch (e) { return; }
    const novo = criarMotor();
    if (!novo) return;
    motor = novo;
    novo.exibido = indice;
    await novo.mostrar(indice, false);
    if (motor !== novo) return;
    // As demais fotos entram depois, sem competir com o carregamento inicial.
    const restante = () => itens.forEach((_, i) => { if (i !== indice) carregarImagem(i).catch(() => {}); });
    if ('requestIdleCallback' in window) requestIdleCallback(restante, { timeout: 2500 });
    else setTimeout(restante, 1200);
  };

  // Virar celular com o WebGL ativo: desliga o motor e fica no fallback.
  movel.addEventListener('change', () => { if (movel.matches && motor) motor.falha(); });

  atualizarInterface();
  if ('IntersectionObserver' in window) {
    const perto = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      perto.disconnect();
      iniciarWebGL();
    }, { rootMargin: '500px 0px' });
    perto.observe(raiz);
  } else {
    iniciarWebGL();
  }
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

iniciarGaleriaMorph();
iniciarComparador();
pausarOutrosVideos();
iniciarVideoCards();
iniciarGaleriaVideos(splashPronto);
iniciarFotoAmpliada();
iniciarMapa();
