// One-off: copies the static site's stylesheets into app/styles with every selector scoped under a surface class,
// so the technician, supervisor and sign-in styles cannot leak into each other when Next.js keeps CSS loaded between pages.
const fs = require('fs');
const postcss = require('postcss');
const prefixer = require('postcss-prefix-selector');

const jobs = [
  { out: 'app/styles/tech.css', prefix: '.s-tech', files: ['legacy/styles.css'] },
  { out: 'app/styles/sup.css', prefix: '.s-sup', files: ['legacy/supervisor.css'] },
  { out: 'app/styles/auth.css', prefix: '.s-auth', files: ['legacy/login.css', 'legacy/profile.css'] },
];

(async () => {
  for (const j of jobs) {
    let css = '';
    for (const f of j.files) css += `/* ---- from ${f} ---- */\n` + fs.readFileSync(f, 'utf8') + '\n';
    const res = await postcss([
      prefixer({
        prefix: j.prefix,
        // html, body and :root rules describe the page itself: they now describe the surface's root element
        transform(prefix, selector, prefixed) {
          const m = selector.match(/^(html|body|:root)(?![\w-])(.*)$/);
          return m ? prefix + m[2] : prefixed;
        },
      }),
    ]).process(css, { from: undefined });
    fs.writeFileSync(j.out, `/* Generated from the static site by scripts/scope-css.cjs, then maintained by hand. Scope: ${j.prefix} */\n` + res.css);
    console.log(j.out, res.css.length);
  }
})();
