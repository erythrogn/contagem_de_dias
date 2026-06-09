from flask import Flask, render_template, request, jsonify, session
from datetime import datetime, timedelta
import os
import hashlib
import hmac
import secrets

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
