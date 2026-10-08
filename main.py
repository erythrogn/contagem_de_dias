from flask import Flask, render_template, request, jsonify, session
from datetime import datetime, timedelta
import os
import hashlib
import hmac
import secrets
import ipaddress
import socket
from urllib.parse import urlparse
import requests
from cachetools import TTLCache
from flask import jsonify, request

ALLOWED_HOSTS = [
    "spotify.com",
    "youtube.com",
    "youtu.be",
    "apple.com",
    "soundcloud.com",
    "deezer.com",
    "tidal.com",
    "amazon.com",
    "vimeo.com",
    "dailymotion.com",
    "twitch.tv",
    "bandcamp.com",
    "mixcloud.com",
    "audiomack.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
]


def is_safe_url(url):
  try:
    parsed = urlparse(url)
    if parsed.scheme != "https":
      return False
    hostname = parsed.hostname
    if not hostname:
      return False

    allowed = any(
        hostname == h or hostname.endswith("." + h) for h in ALLOWED_HOSTS
    )
    if not allowed:
      return False

    # Protecao SSRF: checar IPs privados, loopback ou link-local
    ip_str = socket.gethostbyname(hostname)
    ip_obj = ipaddress.ip_address(ip_str)
    if (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
    ):
      return False
  except Exception:
    return False
  return True


resolver_cache = TTLCache(maxsize=500, ttl=86400)


@app.route("/api/midia/resolver", methods=["POST"])
def resolver_midia():
  data = request.get_json() or {}
  url = data.get("url")

  if not url or not is_safe_url(url):
    return jsonify({"error": "URL invalida ou nao permitida"}), 400

  if url in resolver_cache:
    return jsonify(resolver_cache[url])

  parsed = urlparse(url)
  host = parsed.hostname

  oembed_url = None
  if "youtube.com" in host or "youtu.be" in host:
    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
  elif "vimeo.com" in host:
    oembed_url = f"https://vimeo.com/api/oembed.json?url={url}"
  elif "soundcloud.com" in host:
    oembed_url = f"https://soundcloud.com/oembed?format=json&url={url}"
  elif "dailymotion.com" in host:
    oembed_url = f"https://www.dailymotion.com/services/oembed?format=json&url={url}"
  elif "spotify.com" in host:
    oembed_url = f"https://open.spotify.com/oembed?url={url}"

  result = {
      "title": "",
      "author": "",
      "thumbnail": "",
      "provider": host,
      "kind": "track",
      "embedUrl": url,
  }

  if oembed_url:
    try:
      resp = requests.get(
          oembed_url, timeout=5, allow_redirects=True, max_redirects=3
      )
      if resp.status_code == 200 and len(resp.content) < 1024 * 1024:
        j = resp.json()
        result["title"] = j.get("title", "")
        result["author"] = j.get("author_name", "")
        result["thumbnail"] = j.get("thumbnail_url", "")
    except Exception:
      pass

  resolver_cache[url] = result
  return jsonify(result)

app = Flask(__name__)

# Secret key for session encryption — in production set via env var
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# ── Data inicial do relacionamento ──────────────────────────────────────────
DATA_INICIO = datetime(2025, 11, 29, 0, 1, 0)

# ── Bloco password (SHA-256 hash) ───────────────────────────────────────────
# Hash of the password.  Default password: "floresta"
# To change: python3 -c "import hashlib; print(hashlib.sha256('suasenha'.encode()).hexdigest())"
# You can also set env var BLOCO_PASSWORD_HASH to override.
_DEFAULT_HASH = hashlib.sha256("floresta".encode()).hexdigest()
BLOCO_PASSWORD_HASH = os.environ.get("BLOCO_PASSWORD_HASH", _DEFAULT_HASH)


def tempo_juntos():
    agora = datetime.utcnow() - timedelta(hours=3)
    diff = agora - DATA_INICIO
    total_seg = int(diff.total_seconds())
    return {
        "dias":     diff.days,
        "horas":    (total_seg % 86400) // 3600,
        "minutos":  (total_seg % 3600) // 60,
        "segundos": total_seg % 60,
        "data_iso": DATA_INICIO.strftime("%Y-%m-%dT%H:%M:%S"),
    }


# ── Public routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    ctx = tempo_juntos()
    agora_br = datetime.utcnow() - timedelta(hours=3)
    ctx["surpresa"] = (agora_br.day == 29)
    return render_template("index.html", **ctx)

@app.route("/calendario")
def calendario():
    return render_template("calendario.html", **tempo_juntos())

@app.route("/viagens")
def viagens():
    return render_template("viagens.html", **tempo_juntos())

@app.route("/filmes")
def filmes():
    ctx = tempo_juntos()
    ctx["tmdb_api_key"] = os.environ.get("TMDB_API_KEY", "")
    ctx["rawg_api_key"] = os.environ.get("RAWG_API_KEY", "")
    return render_template("filmes.html", **ctx)

@app.route("/coisinhas")
def coisinhas():
    return render_template("coisinhas.html", **tempo_juntos())


# ── Bloco — password-protected ───────────────────────────────────────────────

@app.route("/bloco")
def bloco():
    """Serve the bloco page. The client-side JS handles auth via session."""
    return render_template("bloco.html", **tempo_juntos())


@app.route("/api/bloco/auth", methods=["POST"])
def bloco_auth():
    """
    Verify password sent as SHA-256 hash.
    The client sends: { "hash": "<sha256 of entered password>" }
    We compare using hmac.compare_digest to prevent timing attacks.
    """
    data = request.get_json(silent=True)
    if not data or "hash" not in data:
        return jsonify({"ok": False, "msg": "Dados inválidos"}), 400

    candidate_hash = data["hash"].lower().strip()

    # Constant-time comparison
    if hmac.compare_digest(candidate_hash, BLOCO_PASSWORD_HASH):
        session["bloco_auth"] = True
        session.permanent = True
        app.permanent_session_lifetime = timedelta(hours=12)
        return jsonify({"ok": True})
    else:
        return jsonify({"ok": False, "msg": "Senha incorreta"}), 401


@app.route("/api/bloco/check")
def bloco_check():
    """Quick check whether the current session is authenticated."""
    return jsonify({"authenticated": bool(session.get("bloco_auth"))})


@app.route("/api/bloco/logout", methods=["POST"])
def bloco_logout():
    session.pop("bloco_auth", None)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
@app.after_request
def add_security_headers(response):
  response.headers['X-Content-Type-Options'] = 'nosniff'
  response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
  response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
  csp = (
      "default-src 'self'; "
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com"
      " https://www.gstatic.com https://open.spotify.com https://www.youtube.com"
      " https://w.soundcloud.com https://player.vimeo.com; "
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
      "font-src 'self' https://fonts.gstatic.com; "
      "img-src 'self' data: https: https://image.tmdb.org"
      " https://cdn.cloudflare.steamstatic.com;"
      " connect-src 'self' https://*.firebaseio.com"
      " https://*.googleapis.com https://api.themoviedb.org"
      " https://store.steampowered.com https://api.allorigins.win; "
      "frame-src 'self' https://open.spotify.com https://embed.music.apple.com"
      " https://www.youtube.com https://w.soundcloud.com"
      " https://widget.deezer.com https://player.vimeo.com"
      " https://www.dailymotion.com https://player.twitch.tv;"
      " object-src 'none'; "
      "base-uri 'self'; "
      "frame-ancestors 'self'"
  )
  response.headers['Content-Security-Policy'] = csp
  return response