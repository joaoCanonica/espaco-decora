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
