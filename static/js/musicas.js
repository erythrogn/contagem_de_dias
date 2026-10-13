// Módulo de Músicas - tamo junto
// ES Module puro, otimizado e seguro.

const ALLOWED_PROVIDERS = [
  "spotify.com",
  "youtube.com",
  "youtu.be",
  "music.apple.com",
  "soundcloud.com",
  "deezer.com",
  "tidal.com",
  "amazon.com",
  "music.amazon.com",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "bandcamp.com",
  "mixcloud.com",
  "audiomack.com",
  "twitter.com",
  "x.com",
  "tiktok.com"
];

function isHostAllowed(hostname) {
  return ALLOWED_PROVIDERS.some(domain => {
    return hostname === domain || hostname.endsWith("." + domain);
  });
}

export function parseMediaLink(input) {
  if (!input || typeof input !== "string") return null;
  let raw = input.trim();

  if (raw.toLowerCase().startsWith("<iframe")) {
    const match = raw.match(/src=["'](.*?)["']/i);
    if (match && match[1]) {
      raw = match[1];
    } else {
      return null;
    }
  }

  let urlObj;
  try {
    urlObj = new URL(raw);
  } catch {
    return null;
  }

  // Rejeitar protocolos inseguros
  if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
    return null;
  }

  const hostname = urlObj.hostname.toLowerCase();
  if (!isHostAllowed(hostname)) {
    return {
      provider: "unknown",
      kind: "link",
      embedUrl: null,
      canonicalUrl: urlObj.href,
      supported: false
    };
  }

  let provider = "unknown";
  let kind = "track";
  let embedUrl = null;

  if (hostname.includes("spotify.com")) {
    provider = "spotify";
    if (urlObj.pathname.includes("/playlist/")) kind = "playlist";
    else if (urlObj.pathname.includes("/album/")) kind = "album";
    else if (urlObj.pathname.includes("/artist/")) kind = "artist";
    else if (urlObj.pathname.includes("/episode/") || urlObj.pathname.includes("/show/")) kind = "episode";
    embedUrl = `https://open.spotify.com/embed${urlObj.pathname}${urlObj.search}`;
  } else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    provider = "youtube";
    let videoId = "";
    if (hostname.includes("youtu.be")) {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.pathname.startsWith("/shorts/")) {
      videoId = urlObj.pathname.split("/")[2];
      kind = "short";
    } else {
      videoId = urlObj.searchParams.get("v");
    }
    const listId = urlObj.searchParams.get("list");
    if (listId) kind = "playlist";
    if (videoId) {
      embedUrl = `https://www.youtube.com/embed/${videoId}${listId ? `?list=${listId}` : ""}`;
    } else if (listId) {
      embedUrl = `https://www.youtube.com/embed/videoseries?list=${listId}`;
    }
  } else if (hostname.includes("music.apple.com")) {
    provider = "apple";
    kind = "album";
    embedUrl = `https://embed.music.apple.com${urlObj.pathname}${urlObj.search}`;
  } else if (hostname.includes("soundcloud.com")) {
    provider = "soundcloud";
    embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(urlObj.href)}&color=%23e2d4a3&auto_play=false&hide_related=true&show_comments=true&show_user=true&show_reposts=false&show_teaser=false`;
  } else if (hostname.includes("deezer.com")) {
    provider = "deezer";
    embedUrl = `https://widget.deezer.com/widget/dark${urlObj.pathname}`;
  } else if (hostname.includes("vimeo.com")) {
    provider = "vimeo";
    const vId = urlObj.pathname.split("/").filter(Boolean)[0];
    if (vId && !isNaN(vId)) {
      embedUrl = `https://player.vimeo.com/video/${vId}`;
      kind = "video";
    }
  } else if (hostname.includes("dailymotion.com")) {
    provider = "dailymotion";
    const matchDm = urlObj.pathname.match(/\/video\/([^_]+)/);
    if (matchDm && matchDm[1]) {
      embedUrl = `https://www.dailymotion.com/embed/video/${matchDm[1]}`;
      kind = "video";
    }
  } else if (hostname.includes("twitch.tv")) {
    provider = "twitch";
    embedUrl = `https://player.twitch.tv/?autoplay=false&muted=true&video=${urlObj.pathname.split("/").pop()}&parent=${window.location.hostname}`;
    kind = "video";
  } else {
    provider = hostname.replace("www.", "").split(".")[0];
    embedUrl = urlObj.href;
  }

  return {
    provider,
    kind,
    embedUrl,
    canonicalUrl: urlObj.href,
    supported: true
  };
}

const FALLBACK_TITLE = "Nossa Música";
const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
const DELETE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

// Itens antigos guardam `src` (já em formato embed); novos guardam `embedUrl`.
export function resolveEmbed(item) {
  // Itens salvos com link original são recalculados; itens antigos usam o embed salvo.
  if (item.url) {
    const parsed = parseMediaLink(item.url);
    if (parsed?.embedUrl) return parsed.embedUrl;
  }
  if (item.embedUrl && item.embedUrl !== item.url) return item.embedUrl;
  if (item.src) return item.src;
  if (item.embedUrl) return item.embedUrl;
  if (item.src) return item.src;
  if (item.url) return parseMediaLink(item.url)?.embedUrl || null;
  return null;
}

export function renderMusicasList(items, container, escapeHTML) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p class="empty-text">Aguardando playlists…</p></div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(m => {
    const embed = resolveEmbed(m) || "";
    const card = document.createElement("div");
    card.className = "musica-card";
    card.innerHTML = `
      <div class="musica-card-header">
        <h3 class="musica-title" title="${escapeHTML(m.title)}">${escapeHTML(m.title || FALLBACK_TITLE)}</h3>
        <button type="button" class="movie-action-btn delete" onclick="window.deleteItem('musicas','${escapeHTML(m.key)}')" aria-label="Deletar">${DELETE_ICON}</button>
      </div>
      ${m.thumbnail ? `<img class="musica-thumb" src="${escapeHTML(m.thumbnail)}" alt="" loading="lazy">` : ""}
      <div class="musica-btn-group">
        <button type="button" class="movie-action-btn play" data-embed="${escapeHTML(embed)}" data-provider="${escapeHTML(m.provider || "")}" data-kind="${escapeHTML(m.kind || "")}" aria-label="Tocar" ${embed ? "" : "disabled"}>${PLAY_ICON}</button>
        <span class="musica-meta-info">${escapeHTML(m.provider || "link")}</span>
      </div>`;
    fragment.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

export function playMediaItem(embedUrl, provider, kind) {
  const box = document.getElementById("player-frame-box");
  if (!box) return;

  if (!embedUrl) {
    box.innerHTML = `<div class="empty-state"><p class="empty-text">Este item não possui player embutido.</p></div>`;
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.width = "100%";
  iframe.height = kind === "playlist" || kind === "album" ? "352" : "152";
  iframe.frameBorder = "0";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation");
  iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write");
  iframe.title = "Player de Mídia";
  box.replaceChildren(iframe);
}

/**
 * Inicializa a seção de músicas: um único player no topo, formulário de
 * adição e cliques na lista que carregam a música no player.
 * Recebe `push` e `dbRefs` do chamador para não duplicar a conexão com o Firebase.
 */
export function initMusicasModule({ dbRefs, push, escapeHTML, showToast }) {
  const form = document.getElementById("form-musicas");
  const linkInput = document.getElementById("mLink");
  const titleInput = document.getElementById("mTitle");
  const trackContainer = document.getElementById("list-musicas");
  if (!form || !trackContainer) return;

  const notify = (msg, type) => (showToast ? showToast(msg, type) : alert(msg));

  // Player único, criado uma vez e reaproveitado por todas as músicas
  if (!document.getElementById("shared-music-player")) {
    const wrapper = document.createElement("div");
    wrapper.id = "shared-music-player";
    wrapper.className = "shared-music-player";
    wrapper.innerHTML = `
      <div class="player-header">
        <span class="player-label">Player</span>
        <span class="player-notice">Spotify e Apple Music pedem login uma vez neste player.</span>
      </div>
      <div class="player-frame-container" id="player-frame-box">
        <div class="empty-state"><p class="empty-text">Selecione uma música na lista abaixo para tocar.</p></div>
      </div>`;
    trackContainer.parentNode.insertBefore(wrapper, trackContainer);
  }

  // Clique em "tocar": carrega no player único e destaca o card
  trackContainer.addEventListener("click", e => {
    const btn = e.target.closest(".play");
    if (!btn || btn.disabled) return;
    const card = btn.closest(".musica-card");
    trackContainer.querySelectorAll(".musica-card.active-card").forEach(c => c.classList.remove("active-card"));
    card?.classList.add("active-card");
    playMediaItem(btn.dataset.embed, btn.dataset.provider, btn.dataset.kind);
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const linkVal = linkInput?.value.trim();
    if (!linkVal) return;

    const parsed = parseMediaLink(linkVal);
    if (!parsed || !parsed.supported) {
      notify("Plataforma não suportada ou link inválido.", "error");
      return;
    }

    const resolved = {
      title: titleInput?.value.trim() || FALLBACK_TITLE,
      url: parsed.canonicalUrl,
      provider: parsed.provider,
      kind: parsed.kind,
      embedUrl: parsed.embedUrl,
      thumbnail: "",
      author: "",
      timestamp: Date.now()
    };

    try {
      const res = await fetch("/api/midia/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.canonicalUrl })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.title && !titleInput?.value) resolved.title = json.title;
        if (json.thumbnail) resolved.thumbnail = json.thumbnail;
        if (json.author) resolved.author = json.author;
        // json.embedUrl do servidor é o link original (não embutível): mantemos o embed calculado acima.
      }
    } catch (err) {
      console.warn("Falha ao resolver oEmbed:", err);
    }

    try {
      await push(dbRefs.musicas, resolved);
      form.reset();
      notify("Mídia adicionada com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao salvar música:", err);
      notify("Erro ao salvar no banco.", "error");
    }
  });
}
