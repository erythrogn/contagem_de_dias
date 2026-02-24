from flask import Flask, render_template
from datetime import datetime, timedelta

app = Flask(__name__)

DATA_INICIO = datetime(2025, 11, 29, 0, 1, 0)

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
    return render_template("filmes.html", **tempo_juntos())

@app.route("/coisinhas")
def coisinhas():
    return render_template("coisinhas.html", **tempo_juntos())

@app.route("/bloco")
def bloco():
    return render_template("bloco.html", **tempo_juntos())

if __name__ == "__main__":
    app.run(debug=True)