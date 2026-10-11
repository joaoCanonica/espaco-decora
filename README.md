# Espaço Decora By Rita Assunção

Site estático (index.html, css/, js/, assets/, videos/), sem build; a Vercel publica direto do repositório.

Para trocar o domínio (hoje https://espaco-decora.vercel.app) em index.html, robots.txt, sitemap.xml e 404.html, rode com Node 18+ e faça commit do resultado:

    node scripts/set-site-url.mjs https://espacodecora.com.br
