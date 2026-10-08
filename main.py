from datetime import datetime, timedelta
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import socket
import time
from urllib.parse import urlparse
import urllib.request
from flask import Flask, jsonify, render_template, request, session

app = Flask(__name__)

# Chave secreta da sessao
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# Data inicial do relacionamento
DATA_INICIO = datetime(2025, 11, 29, 0, 1, 0)

# Senha do bloco (SHA-256 hash) - padrao: "floresta"
_DEFAULT_HASH = hashlib.sha256("floresta".encode()).hexdigest()
BLOCO_PASSWORD_HASH = os.environ.get("BLOCO_PASSWORD_HASH", _DEFAULT_HASH)

# Allowlist e Cache nativo em memoria (TTL 24h) para resolucao de midia
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

CACHE_TTL_SECONDS = 86400
resolver_cache = {}


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


def tempo_juntos():
  agora = datetime.utcnow() - timedelta(hours=3)
  diff = agora - DATA_INICIO
  total_seg = int(diff.total_seconds())
  return {
      "dias": diff.days,
      "horas": (total_seg % 86400) // 3600,
      "minutos": (total_seg % 3600) // 60,
      "segundos": total_seg % 60,
      "data_iso": DATA_INICIO.strftime("%Y-%m-%dT%H:%M:%S"),
  }


@app.after_request
def add_security_headers(response):
  response.headers["X-Content-Type-Options"] = "nosniff"
  response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
  response.headers["Permissions-Policy"] = (
      "camera=(), microphone=(), geolocation=()"
  )
  csp = (
      "default-src 'self'; "
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com"
      " https://www.gstatic.com https://*.firebaseio.com"
      " https://open.spotify.com https://www.youtube.com"
      " https://w.soundcloud.com https://player.vimeo.com; "
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
      "font-src 'self' https://fonts.gstatic.com; "
      "img-src 'self' data: https: http:; "
      "connect-src 'self' https: wss:; "
      "frame-src 'self' https://open.spotify.com https://embed.music.apple.com"
      " https://www.youtube.com https://w.soundcloud.com"
      " https://widget.deezer.com https://player.vimeo.com"
      " https://www.dailymotion.com https://player.twitch.tv; "
      "object-src 'none'; "
      "base-uri 'self'; "
      "frame-ancestors 'self'"
  )
  response.headers["Content-Security-Policy"] = csp
  return response


@app.route("/")
def index():
  ctx = tempo_juntos()
  agora_br = datetime.utcnow() - timedelta(hours=3)
  ctx["surpresa"] = agora_br.day == 29
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


@app.route("/api/midia/resolver", methods=["POST"])
def resolver_midia():
  data = request.get_json(silent=True) or {}
  url = data.get("url")

  if not url or not is_safe_url(url):
    return jsonify({"error": "URL invalida ou nao permitida"}), 400

  now = time.time()
  cached = resolver_cache.get(url)
  if cached and (now - cached["ts"] < CACHE_TTL_SECONDS):
    return jsonify(cached["data"])

  parsed = urlparse(url)
  host = parsed.hostname or ""

  oembed_url = None
  if "youtube.com" in host or "youtu.be" in host:
    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
  elif "vimeo.com" in host:
    oembed_url = f"https://vimeo.com/api/oembed.json?url={url}"
  elif "soundcloud.com" in host:
    oembed_url = f"https://soundcloud.com/oembed?format=json&url={url}"
  elif "dailymotion.com" in host:
    oembed_url = (
        f"https://www.dailymotion.com/services/oembed?format=json&url={url}"
    )
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

  if oembed_url and is_safe_url(oembed_url):
    try:
      req = urllib.request.Request(
          oembed_url,
          headers={"User-Agent": "Mozilla/5.0 (compatible; TamoJunto/1.0)"},
      )
      with urllib.request.urlopen(req, timeout=5) as resp:
        if resp.status == 200:
          raw_bytes = resp.read(1024 * 1024)
          j = json.loads(raw_bytes.decode("utf-8", errors="replace"))
          result["title"] = j.get("title", "")
          result["author"] = j.get("author_name", "")
          result["thumbnail"] = j.get("thumbnail_url", "")
    except Exception:
      pass

  if len(resolver_cache) >= 500:
    resolver_cache.clear()
  resolver_cache[url] = {"ts": now, "data": result}
  return jsonify(result)


@app.route("/bloco")
def bloco():
  return render_template("bloco.html", **tempo_juntos())


@app.route("/api/bloco/auth", methods=["POST"])
def bloco_auth():
  data = request.get_json(silent=True)
  if not data or "hash" not in data:
    return jsonify({"ok": False, "msg": "Dados inválidos"}), 400

  candidate_hash = data["hash"].lower().strip()

  if hmac.compare_digest(candidate_hash, BLOCO_PASSWORD_HASH):
    session["bloco_auth"] = True
    session.permanent = True
    app.permanent_session_lifetime = timedelta(hours=12)
    return jsonify({"ok": True})
  else:
    return jsonify({"ok": False, "msg": "Senha incorreta"}), 401


@app.route("/api/bloco/check")
def bloco_check():
  return jsonify({"authenticated": bool(session.get("bloco_auth"))})


@app.route("/api/bloco/logout", methods=["POST"])
def bloco_logout():
  session.pop("bloco_auth", None)
  return jsonify({"ok": True})


if __name__ == "__main__":
  app.run(debug=True)