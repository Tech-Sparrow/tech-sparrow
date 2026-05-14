const ORG = "Tech-Sparrow";
const API_ORG = `https://api.github.com/orgs/${ORG}`;
const API_REPOS = `https://api.github.com/orgs/${ORG}/repos?per_page=100&sort=updated`;
const THEME_KEY = "tech-sparrow-theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  try {
    localStorage.setItem(THEME_KEY, theme === "light" ? "light" : "dark");
  } catch (_) {
    /* ignore */
  }
  syncThemeToggle();
}

function syncThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const isLight = currentTheme() === "light";
  btn.setAttribute("aria-pressed", isLight ? "true" : "false");
  btn.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
  const label = btn.querySelector(".theme-toggle__label");
  if (label) label.textContent = isLight ? "Dark theme" : "Light theme";
}

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });
  syncThemeToggle();
}

function updateBrandingFromOrg(org) {
  const url = org && typeof org.avatar_url === "string" ? org.avatar_url.trim() : "";
  if (!url) return;
  const img = document.getElementById("brand-avatar");
  if (img) img.src = url;
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = url;
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return iso.slice(0, 10);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function getVisitBadgePageId() {
  const card = document.querySelector(".connect-card--stat");
  const custom = card && card.getAttribute("data-visit-page-id");
  if (custom != null && String(custom).trim() !== "") return String(custom).trim();
  return `${location.hostname}-tech-sparrow-site`;
}

function parseCountFromVisitorBadgeSvg(svg) {
  const matches = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)];
  if (!matches.length) return null;
  const n = parseInt(matches[matches.length - 1][1], 10);
  return Number.isFinite(n) ? n : null;
}

async function loadVisitCount() {
  const el = document.getElementById("visit-count");
  const hint = document.getElementById("visit-hint");
  if (!el) return;

  const baseHint =
    "Total page loads recorded for this site via a lightweight public counter (not unique visitors). Works on static GitHub Pages; ad blockers or offline use may hide the number.";

  const pageId = getVisitBadgePageId();
  const url = `https://visitor-badge.laobi.icu/badge?page_id=${encodeURIComponent(pageId)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const svg = await res.text();
    const n = parseCountFromVisitorBadgeSvg(svg);
    if (n == null) throw new Error("parse");
    el.textContent = n.toLocaleString();
    if (hint) hint.textContent = baseHint;
  } catch (err) {
    console.warn("Visit counter:", err);
    el.textContent = "—";
    if (hint) {
      hint.textContent =
        `${baseHint} Could not load the counter (network, blocker, or third-party service).`;
    }
  }
}

function renderOrgStats(org) {
  const host = document.getElementById("org-stats");
  if (!host) return;

  const created = formatDate(org.created_at);
  const followers = typeof org.followers === "number" ? String(org.followers) : "—";
  const items = [
    { label: "Public repositories", value: String(org.public_repos ?? "—") },
    { label: "Founded", value: created },
    { label: "GitHub followers", value: followers },
  ];

  host.innerHTML = items
    .map(
      (item) =>
        `<li class="chip chip--accent"><strong>${escapeHtml(item.label)}</strong> · ${escapeHtml(item.value)}</li>`
    )
    .join("");
}

function renderRepos(repos) {
  const list = document.getElementById("repo-list");
  const status = document.getElementById("repo-status");
  if (!list) return;

  if (!repos.length) {
    if (status) status.textContent = "No public repositories returned.";
    list.innerHTML = "";
    return;
  }

  if (status) {
    status.textContent = `${repos.length} public ${repos.length === 1 ? "repository" : "repositories"} (sorted by last update).`;
  }

  list.innerHTML = repos
    .map((repo) => {
      const desc = repo.description?.trim() || "No description yet.";
      const lang = repo.language || "—";
      const stars = repo.stargazers_count ?? 0;
      const forks = repo.forks_count ?? 0;
      const topics =
        Array.isArray(repo.topics) && repo.topics.length > 0
          ? `<span>${escapeHtml(repo.topics.slice(0, 3).join(" · "))}</span>`
          : "";

      return `<li class="repo-card">
        <h3 class="repo-card__name"><a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        repo.name
      )}</a></h3>
        <p class="repo-card__desc">${escapeHtml(desc)}</p>
        <div class="repo-card__meta">
          <span title="Primary language">${escapeHtml(lang)}</span>
          <span title="Stars">★ ${stars}</span>
          <span title="Forks">⑂ ${forks}</span>
          <span title="Last push">${escapeHtml(formatDate(repo.pushed_at))}</span>
          ${topics}
        </div>
      </li>`;
    })
    .join("");
}

async function load() {
  const host = document.getElementById("org-stats");
  const status = document.getElementById("repo-status");

  try {
    const [orgRes, reposRes] = await Promise.all([fetch(API_ORG), fetch(API_REPOS)]);

    if (!orgRes.ok) throw new Error(`Organisation request failed (${orgRes.status})`);
    if (!reposRes.ok) throw new Error(`Repositories request failed (${reposRes.status})`);

    const org = await orgRes.json();
    const repos = await reposRes.json();

    renderOrgStats(org);
    updateBrandingFromOrg(org);
    renderRepos(Array.isArray(repos) ? repos : []);
  } catch (err) {
    console.error(err);
    if (host) {
      host.innerHTML = `<li class="chip chip--muted">Could not load live stats. Try again shortly or visit GitHub directly.</li>`;
    }
    if (status) {
      status.textContent =
        "Could not load repositories from GitHub (network, rate limit, or API error). Open the organisation on GitHub to browse code.";
    }
  }
}

setYear();
initThemeToggle();
load();
loadVisitCount();
