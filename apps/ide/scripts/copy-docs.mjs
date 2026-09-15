/**
 * copy-docs.mjs — converts docs/manual/ markdown files into styled HTML pages
 * and writes them to public/manual/. The HTML pages are responsive and support
 * light and dark modes via prefers-color-scheme and the [data-theme] attribute.
 *
 * Run automatically via the predev / prebuild npm scripts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../../../docs/manual");
const outDir = path.resolve(__dirname, "../public/manual");

fs.mkdirSync(outDir, { recursive: true });

// ─── Section manifest ────────────────────────────────────────────────────────

const sections = [
  {
    file: "00-concepts.md",
    title: "0 — Core Concepts",
    html: "00-concepts.html",
  },
  {
    file: "01-prerequisites.md",
    title: "1 — Prerequisites",
    html: "01-prerequisites.html",
  },
  {
    file: "02-getting-started.md",
    title: "2 — Getting Started",
    html: "02-getting-started.html",
  },
  {
    file: "03-architecture.md",
    title: "3 — Architecture",
    html: "03-architecture.html",
  },
  {
    file: "04-core-reference.md",
    title: "4 — Core Reference",
    html: "04-core-reference.html",
  },
  {
    file: "05-systems-reference.md",
    title: "5 — Systems Reference",
    html: "05-systems-reference.html",
  },
  {
    file: "06-actor-model.md",
    title: "6 — Actor Model",
    html: "06-actor-model.html",
  },
  {
    file: "07-ide-reference.md",
    title: "7 — IDE Reference",
    html: "07-ide-reference.html",
  },
  {
    file: "08-tutorial-pong.md",
    title: "8 — Tutorial: Pong",
    html: "08-tutorial-pong.html",
  },
  {
    file: "09-troubleshooting.md",
    title: "9 — Troubleshooting",
    html: "09-troubleshooting.html",
  },
  {
    file: "10-language-reference.md",
    title: "10 — Language Reference",
    html: "10-language-reference.html",
  },
  {
    file: "11-gms2-migration.md",
    title: "11 — GameMaker Migration",
    html: "11-gms2-migration.html",
  },
  {
    file: "12-tutorial-platformer.md",
    title: "12 — Tutorial: Platformer",
    html: "12-tutorial-platformer.html",
  },
  {
    file: "13-tutorial-visual-novel.md",
    title: "13 — Tutorial: Visual Novel",
    html: "13-tutorial-visual-novel.html",
  },
  { file: "14-glossary.md", title: "14 — Glossary", html: "14-glossary.html" },
  {
    file: "15-gmrt-roadmap.md",
    title: "15 — Roadmap",
    html: "15-gmrt-roadmap.html",
  },
  {
    file: "16-hot-reload.md",
    title: "16 — Hot Reload",
    html: "16-hot-reload.html",
  },
  {
    file: "17-spine-animation.md",
    title: "17 — Spine Animation",
    html: "17-spine-animation.html",
  },
  {
    file: "18-debugger-plan.md",
    title: "18 — Debugger",
    html: "18-debugger-plan.html",
  },
  {
    file: "19-multiplayer-boilerplate.md",
    title: "19 — Multiplayer",
    html: "19-multiplayer-boilerplate.html",
  },
  {
    file: "20-tutorial-bullet-hell.md",
    title: "20 — Tutorial: Bullet Hell",
    html: "20-tutorial-bullet-hell.html",
  },
  {
    file: "21-scene-manager.md",
    title: "21 — SceneManager",
    html: "21-scene-manager.html",
  },
  {
    file: "22-ui-widgets.md",
    title: "22 — UI Widgets",
    html: "22-ui-widgets.html",
  },
  {
    file: "23-battle-system.md",
    title: "23 — BattleSystem",
    html: "23-battle-system.html",
  },
];

// ─── Minimal markdown → HTML converter ───────────────────────────────────────

function escHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-");
}

function inlineFormat(text) {
  // Code spans (before other patterns so backtick content isn't touched)
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold + italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Strike
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Links [text](url)
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return text;
}

function convertMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];

    // Fenced code block
    if (/^```/.test(raw)) {
      const lang = raw.slice(3).trim() || "";
      const langClass = lang ? ` class="language-${escHtml(lang)}"` : "";
      let code = "";
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code += escHtml(lines[i]) + "\n";
        i++;
      }
      html += `<pre><code${langClass}>${code}</code></pre>\n`;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) {
      html += "<hr>\n";
      i++;
      continue;
    }

    // ATX headings
    const hMatch = raw.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].trim();
      const id = slugify(text);
      html += `<h${level} id="${id}"><a class="anchor" href="#${id}">#</a>${inlineFormat(escHtml(text))}</h${level}>\n`;
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(raw)) {
      let bq = "";
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bq += lines[i].replace(/^>\s?/, "") + "\n";
        i++;
      }
      html += `<blockquote>${convertMarkdown(bq)}</blockquote>\n`;
      continue;
    }

    // Tables — detect by pipe-separated rows
    if (/^\|/.test(raw) && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1])) {
      // Collect table rows
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      // rows[0] = header, rows[1] = separator, rows[2..] = body
      const parseCells = (row) =>
        row
          .split("|")
          .slice(1, -1)
          .map((c) => inlineFormat(escHtml(c.trim())));

      const headers = parseCells(rows[0]);
      const alignRow = rows[1]
        .split("|")
        .slice(1, -1)
        .map((c) => {
          c = c.trim();
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });

      let tableHtml = '<div class="table-wrap"><table>\n<thead><tr>';
      headers.forEach((h, idx) => {
        tableHtml += `<th style="text-align:${alignRow[idx] ?? "left"}">${h}</th>`;
      });
      tableHtml += "</tr></thead>\n<tbody>\n";

      for (let r = 2; r < rows.length; r++) {
        if (!/^\|/.test(rows[r])) continue;
        const cells = parseCells(rows[r]);
        tableHtml += "<tr>";
        cells.forEach((c, idx) => {
          tableHtml += `<td style="text-align:${alignRow[idx] ?? "left"}">${c}</td>`;
        });
        tableHtml += "</tr>\n";
      }
      tableHtml += "</tbody></table></div>\n";
      html += tableHtml;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(raw)) {
      html += "<ol>\n";
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const item = lines[i].replace(/^\d+\.\s/, "");
        html += `<li>${inlineFormat(escHtml(item))}</li>\n`;
        i++;
      }
      html += "</ol>\n";
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(raw)) {
      html += "<ul>\n";
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        const item = lines[i].replace(/^[-*+]\s/, "");
        html += `<li>${inlineFormat(escHtml(item))}</li>\n`;
        i++;
      }
      html += "</ul>\n";
      continue;
    }

    // Blank line
    if (raw.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — accumulate until blank or block element
    let para = "";
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|>|\||\d+\.\s|[-*+]\s|---|\*\*\*|___)/.test(lines[i])
    ) {
      para += (para ? " " : "") + lines[i].trim();
      i++;
    }
    if (para) {
      html += `<p>${inlineFormat(escHtml(para))}</p>\n`;
    }
  }

  return html;
}

// ─── Page template ────────────────────────────────────────────────────────────

const sharedCss = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    color-scheme: dark light;
    --bg:       #0f0f12;
    --bg2:      #1a1a22;
    --bg3:      #22222e;
    --border:   #2a2a38;
    --text:     #dddde8;
    --muted:    #888898;
    --accent:   #9d8ffa;
    --accent2:  #6ee7b7;
    --code-bg:  #16161e;
    --code-border: #2a2a3a;
    --link:     #9d8ffa;
    --link-hover: #bdb0fc;
    --table-head: #1e1e2e;
    --table-alt:  #181820;
    --blockquote-border: #4a3fa0;
    --blockquote-bg: #1a1830;
  }

  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg:       #f8f8fc;
      --bg2:      #f0f0f8;
      --bg3:      #e8e8f4;
      --border:   #d0d0e0;
      --text:     #1a1a2e;
      --muted:    #666678;
      --accent:   #5a4fd8;
      --accent2:  #0d9488;
      --code-bg:  #f0f0f8;
      --code-border: #d0d0e0;
      --link:     #5a4fd8;
      --link-hover: #3a2fb8;
      --table-head: #eeeef8;
      --table-alt:  #f4f4fc;
      --blockquote-border: #8070e0;
      --blockquote-bg: #f0eeff;
    }
  }

  :root[data-theme="light"] {
    --bg:       #f8f8fc;
    --bg2:      #f0f0f8;
    --bg3:      #e8e8f4;
    --border:   #d0d0e0;
    --text:     #1a1a2e;
    --muted:    #666678;
    --accent:   #5a4fd8;
    --accent2:  #0d9488;
    --code-bg:  #f0f0f8;
    --code-border: #d0d0e0;
    --link:     #5a4fd8;
    --link-hover: #3a2fb8;
    --table-head: #eeeef8;
    --table-alt:  #f4f4fc;
    --blockquote-border: #8070e0;
    --blockquote-bg: #f0eeff;
  }

  :root[data-theme="dark"] {
    --bg:       #0f0f12;
    --bg2:      #1a1a22;
    --bg3:      #22222e;
    --border:   #2a2a38;
    --text:     #dddde8;
    --muted:    #888898;
    --accent:   #9d8ffa;
    --accent2:  #6ee7b7;
    --code-bg:  #16161e;
    --code-border: #2a2a3a;
    --link:     #9d8ffa;
    --link-hover: #bdb0fc;
    --table-head: #1e1e2e;
    --table-alt:  #181820;
    --blockquote-border: #4a3fa0;
    --blockquote-bg: #1a1830;
  }

  html { font-size: 16px; }

  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    min-height: 100dvh;
  }

  /* ── Layout ─────────────────────────────────────────────────────────────── */

  .page-shell {
    display: grid;
    grid-template-columns: 220px 1fr;
    grid-template-rows: 52px 1fr;
    grid-template-areas: "topbar topbar" "nav content";
    min-height: 100dvh;
  }

  /* ── Topbar ──────────────────────────────────────────────────────────────── */

  .topbar {
    grid-area: topbar;
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    height: 52px;
  }

  .topbar-logo {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .topbar-logo:hover { color: var(--link-hover); }

  .topbar-title {
    font-size: 0.88rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .theme-btn {
    margin-left: auto;
    padding: 5px 12px;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg3);
    color: var(--muted);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .theme-btn:hover { color: var(--text); border-color: var(--accent); }

  /* ── Sidebar nav ─────────────────────────────────────────────────────────── */

  .sidebar {
    grid-area: nav;
    position: sticky;
    top: 52px;
    height: calc(100dvh - 52px);
    overflow-y: auto;
    border-right: 1px solid var(--border);
    background: var(--bg2);
    padding: 16px 0 40px;
  }

  .sidebar a {
    display: block;
    padding: 5px 18px;
    font-size: 0.82rem;
    color: var(--muted);
    text-decoration: none;
    line-height: 1.4;
    border-left: 2px solid transparent;
    transition: color 0.12s, border-color 0.12s;
  }

  .sidebar a:hover { color: var(--text); border-left-color: var(--accent); }
  .sidebar a.active { color: var(--accent); border-left-color: var(--accent); font-weight: 600; }

  /* ── Main content ────────────────────────────────────────────────────────── */

  .content {
    grid-area: content;
    padding: 48px 40px 80px;
    max-width: 820px;
    width: 100%;
  }

  /* ── Typography ──────────────────────────────────────────────────────────── */

  h1, h2, h3, h4, h5, h6 {
    color: var(--text);
    line-height: 1.3;
    margin-top: 2.2em;
    margin-bottom: 0.6em;
    scroll-margin-top: 68px;
    position: relative;
  }

  h1 { font-size: 1.9rem; margin-top: 0; border-bottom: 1px solid var(--border); padding-bottom: 0.4em; }
  h2 { font-size: 1.35rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  h3 { font-size: 1.1rem; }
  h4 { font-size: 1rem; }

  .anchor {
    color: var(--border);
    text-decoration: none;
    margin-right: 6px;
    font-weight: 400;
    font-size: 0.85em;
    opacity: 0;
    transition: opacity 0.1s;
  }

  h1:hover .anchor,
  h2:hover .anchor,
  h3:hover .anchor,
  h4:hover .anchor { opacity: 1; }

  p { margin: 0.9em 0; }

  a { color: var(--link); }
  a:hover { color: var(--link-hover); }

  strong { color: var(--text); font-weight: 600; }
  em { font-style: italic; }

  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }

  ul, ol {
    margin: 0.8em 0;
    padding-left: 1.6em;
  }

  li { margin: 0.3em 0; }

  /* ── Code ────────────────────────────────────────────────────────────────── */

  code {
    font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
    font-size: 0.85em;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    color: var(--accent2);
    word-break: break-word;
  }

  pre {
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    border-radius: 8px;
    padding: 18px 20px;
    overflow-x: auto;
    margin: 1.2em 0;
    position: relative;
  }

  pre code {
    background: none;
    border: none;
    padding: 0;
    color: var(--text);
    font-size: 0.875rem;
    word-break: normal;
  }

  .copy-btn {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 0.72rem;
    padding: 3px 8px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }

  pre:hover .copy-btn { opacity: 1; }
  .copy-btn:hover { color: var(--text); }

  /* ── Tables ──────────────────────────────────────────────────────────────── */

  .table-wrap { overflow-x: auto; margin: 1.2em 0; border-radius: 8px; border: 1px solid var(--border); }

  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }

  thead tr { background: var(--table-head); }

  th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 0.82rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    line-height: 1.55;
  }

  tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) { background: var(--table-alt); }

  /* ── Blockquotes ─────────────────────────────────────────────────────────── */

  blockquote {
    border-left: 3px solid var(--blockquote-border);
    background: var(--blockquote-bg);
    margin: 1.2em 0;
    padding: 12px 18px;
    border-radius: 0 6px 6px 0;
    color: var(--muted);
    font-size: 0.93rem;
  }

  blockquote p { margin: 0.3em 0; }
  blockquote strong { color: var(--text); }
  blockquote code { font-size: 0.82em; }

  /* ── Prev / Next nav ─────────────────────────────────────────────────────── */

  .page-nav {
    display: flex;
    gap: 16px;
    margin-top: 56px;
    border-top: 1px solid var(--border);
    padding-top: 28px;
  }

  .page-nav a {
    flex: 1;
    display: block;
    padding: 14px 18px;
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    color: var(--muted);
    font-size: 0.88rem;
    transition: border-color 0.12s, color 0.12s;
  }

  .page-nav a:hover { border-color: var(--accent); color: var(--accent); }
  .page-nav a strong { display: block; color: var(--text); font-size: 0.95rem; margin-top: 2px; }
  .page-nav .nav-prev { text-align: left; }
  .page-nav .nav-next { text-align: right; }
  .page-nav .nav-spacer { flex: 1; }

  /* ── Responsive ──────────────────────────────────────────────────────────── */

  @media (max-width: 720px) {
    .page-shell {
      grid-template-columns: 1fr;
      grid-template-areas: "topbar" "content";
    }

    .sidebar { display: none; }
    .content { padding: 28px 16px 60px; max-width: 100%; }
    .topbar { padding: 0 16px; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.15rem; }

    .page-nav { flex-direction: column; }
    .page-nav .nav-spacer { display: none; }
  }
`;

function pageTemplate({ title, bodyHtml, prevSection, nextSection, allSections, currentHtml }) {
  const sidebarLinks = allSections
    .map((s) => {
      const cls = s.html === currentHtml ? " active" : "";
      return `      <a class="${cls}" href="${s.html}">${s.title}</a>`;
    })
    .join("\n");

  const prevLink =
    prevSection
      ? `<a class="nav-prev" href="${prevSection.html}">← Previous<strong>${prevSection.title}</strong></a>`
      : `<span class="nav-spacer"></span>`;

  const nextLink =
    nextSection
      ? `<a class="nav-next" href="${nextSection.html}">Next →<strong>${nextSection.title}</strong></a>`
      : `<span class="nav-spacer"></span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(title)} — EmptySock Engine</title>
<style>
${sharedCss}
</style>
</head>
<body>
<div class="page-shell">
  <header class="topbar">
    <a class="topbar-logo" href="index.html">EmptySock Engine</a>
    <span class="topbar-title">${escHtml(title)}</span>
    <button class="theme-btn" onclick="toggleTheme()" aria-label="Toggle theme">Theme</button>
  </header>

  <nav class="sidebar" aria-label="Documentation sections">
    <a href="index.html" style="font-weight:600;color:var(--text);margin-bottom:8px;display:block;padding:5px 18px;">← All Sections</a>
${sidebarLinks}
  </nav>

  <main class="content">
${bodyHtml}
    <nav class="page-nav" aria-label="Page navigation">
      ${prevLink}
      ${nextLink}
    </nav>
  </main>
</div>

<script>
  // ── Theme toggle ───────────────────────────────────────────────────────────
  (function () {
    try {
      const stored = localStorage.getItem('es-docs-theme');
      if (stored) document.documentElement.setAttribute('data-theme', stored);
    } catch (_) {}
  })();

  function toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('es-docs-theme', next); } catch (_) {}
  }

  // ── Copy buttons ───────────────────────────────────────────────────────────
  document.querySelectorAll('pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
      });
    });
    pre.appendChild(btn);
  });
</script>
</body>
</html>`;
}

// ─── Index page ───────────────────────────────────────────────────────────────

function buildIndex(allSections) {
  const listItems = allSections
    .filter((s) => fs.existsSync(path.join(srcDir, s.file)))
    .map((s) => `      <li><a href="${s.html}">${escHtml(s.title)}</a></li>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>EmptySock Engine — Offline Manual</title>
<style>
${sharedCss}
  .index-shell {
    max-width: 680px;
    margin: 0 auto;
    padding: 60px 24px 80px;
  }
  .index-shell h1 { border: none; font-size: 2rem; margin-top: 0; }
  .index-shell p.sub { color: var(--muted); margin-top: 4px; margin-bottom: 36px; }
  ol { padding-left: 1.4em; }
  ol li { margin: 10px 0; font-size: 1rem; }
  ol a { color: var(--link); text-decoration: none; }
  ol a:hover { color: var(--link-hover); text-decoration: underline; }
  .topbar-solo {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; gap: 16px;
    padding: 0 24px; background: var(--bg2);
    border-bottom: 1px solid var(--border); height: 52px;
  }
  .topbar-logo-solo { font-weight: 700; font-size: 0.95rem; color: var(--accent); flex: 1; }
</style>
</head>
<body>
<header class="topbar-solo">
  <span class="topbar-logo-solo">EmptySock Engine</span>
  <button class="theme-btn" onclick="toggleTheme()">Theme</button>
</header>
<div class="index-shell">
  <h1>Offline Manual</h1>
  <p class="sub">All sections are available offline — no internet connection needed.</p>
  <ol>
${listItems}
  </ol>
</div>
<script>
  (function () {
    try {
      const stored = localStorage.getItem('es-docs-theme');
      if (stored) document.documentElement.setAttribute('data-theme', stored);
    } catch (_) {}
  })();
  function toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('es-docs-theme', next); } catch (_) {}
  }
</script>
</body>
</html>`;
}

// ─── Build ────────────────────────────────────────────────────────────────────

// Filter to sections that actually have source files
const availableSections = sections.filter((s) =>
  fs.existsSync(path.join(srcDir, s.file)),
);

let converted = 0;

for (let idx = 0; idx < availableSections.length; idx++) {
  const section = availableSections[idx];
  const srcPath = path.join(srcDir, section.file);
  const outPath = path.join(outDir, section.html);

  const md = fs.readFileSync(srcPath, "utf8");
  const bodyHtml = convertMarkdown(md);

  const prevSection = idx > 0 ? availableSections[idx - 1] : null;
  const nextSection = idx < availableSections.length - 1 ? availableSections[idx + 1] : null;

  const page = pageTemplate({
    title: section.title,
    bodyHtml,
    prevSection,
    nextSection,
    allSections: availableSections,
    currentHtml: section.html,
  });

  fs.writeFileSync(outPath, page);
  converted++;
}

// Write index
fs.writeFileSync(path.join(outDir, "index.html"), buildIndex(availableSections));

// Copy api-reference.json to public/ so Help → API Reference works offline.
const apiSrc = path.resolve(__dirname, "../../../api-reference.json");
const apiDst = path.resolve(__dirname, "../public/api-reference.json");
if (fs.existsSync(apiSrc)) {
  fs.copyFileSync(apiSrc, apiDst);
}

// Copy esbuild.wasm to public/
const wasmSrc = path.resolve(
  __dirname,
  "../../../node_modules/.pnpm/esbuild-wasm@0.28.2/node_modules/esbuild-wasm/esbuild.wasm",
);
const wasmFallback = path.resolve(__dirname, "../node_modules/esbuild-wasm/esbuild.wasm");
const wasmDst = path.resolve(__dirname, "../public/esbuild.wasm");
const wasmResolved = fs.existsSync(wasmSrc)
  ? wasmSrc
  : fs.existsSync(wasmFallback)
    ? wasmFallback
    : null;

if (wasmResolved) {
  fs.copyFileSync(wasmResolved, wasmDst);
} else {
  try {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    const resolved = req.resolve("esbuild-wasm/esbuild.wasm");
    fs.copyFileSync(resolved, wasmDst);
  } catch {
    console.warn("[copy-docs] could not locate esbuild-wasm/esbuild.wasm — skipping");
  }
}

console.log(
  `[copy-docs] converted ${converted} manual pages → HTML at public/manual/`,
);
