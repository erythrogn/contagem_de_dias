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
    embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(urlObj.href)}&color=%23f1d299&auto_play=false&hide_related=true&show_comments=true&show_user=true&show_reposts=false&show_teaser=false`;
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

export function initMusicasModule(db, dbRefs, escapeHTML, showToast) {
  const form = document.getElementById("form-musicas");
  const linkInput = document.getElementById("mLink");
  const titleInput = document.getElementById("mTitle");
  const trackContainer = document.getElementById("list-musicas");
  
  if (!form || !trackContainer) return;

  // Criar player único persistente no topo da seção de músicas
  let playerWrapper = document.getElementById("shared-music-player");
  if (!playerWrapper) {
    playerWrapper = document.createElement("div");
    playerWrapper.id = "shared-music-player";
    playerWrapper.className = "shared-music-player";
    playerWrapper.innerHTML = `
      <div class="player-header">
        <span class="player-label">Player Principal</span>
        <span class="player-notice">Spotify e Apple Music exigem login no navegador para reproducao completa.</span>
      </div>
      <div class="player-frame-container" id="player-frame-box">
        <div class="empty-state"><p class="empty-text">Selecione uma musica na lista abaixo para tocar.</p></div>
      </div>
    `;
    trackContainer.parentNode.insertBefore(playerWrapper, trackContainer);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleVal = titleInput?.value.trim() || "Sem titulo";
    const linkVal = linkInput?.value.trim();
    if (!linkVal) return;

    const parsed = parseMediaLink(linkVal);
    if (!parsed || !parsed.supported) {
      if (showToast) showToast("Plataforma nao suportada ou link invalido.", "error");
      else alert("Plataforma nao suportada ou link invalido.");
      return;
    }

    let resolvedData = {
      title: titleVal,
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
        if (json.title && (!titleInput || !titleInput.value)) {
          resolvedData.title = json.title;
        }
        if (json.thumbnail) resolvedData.thumbnail = json.thumbnail;
        if (json.author) resolvedData.author = json.author;
        if (json.embedUrl) resolvedData.embedUrl = json.embedUrl;
      }
    } catch (err) {
      console.warn("Falha ao resolver oEmbed:", err);
    }

    try {
      const { push } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js");
      await push(dbRefs.musicas, resolvedData);
      form.reset();
      if (showToast) showToast("Midia adicionada com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao salvar musica:", err);
      if (showToast) showToast("Erro ao salvar no banco.", "error");
    }
  });
}

export function playMediaItem(embedUrl, provider, kind) {
  const box = document.getElementById("player-frame-box");
  if (!box) return;

  if (!embedUrl) {
    box.innerHTML = `<div class="empty-state"><p class="empty-text">Este item nao possui player embutido.</p></div>`;
    return;
  }

  const sandboxAttr = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation";
  const allowAttr = "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write";

  box.innerHTML = `
    <iframe src="${embedUrl}" 
            width="100%" 
            height="${kind === 'playlist' || kind === 'album' ? '352' : '152'}" 
            frameborder="0" 
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            sandbox="${sandboxAttr}"
            allow="${allowAttr}"
            title="Player de Midia">
    </iframe>
  `;
}