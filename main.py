from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os

app = Flask(__name__)

# Configuração do Banco de Dados SQLite
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'dados.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ── modelos do banco de dados ──────────────────

class Filme(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    year = db.Column(db.String(10))
    genre = db.Column(db.String(100))
    who = db.Column(db.String(50))
    where = db.Column(db.String(100))
    reason = db.Column(db.String(255))
    watched = db.Column(db.Boolean, default=False)

class Viagem(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    dest = db.Column(db.String(100), nullable=False)
    data = db.Column(db.String(50))
    status = db.Column(db.String(20))
    quem = db.Column(db.String(50))
    notes = db.Column(db.Text)

class Coisinha(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    notes = db.Column(db.Text)
    done = db.Column(db.Boolean, default=False)

# Criação automática das tabelas
with app.app_context():
    db.create_all()

# ── configurações do casal ──────────────────
DATA_INICIO = datetime(2025, 11, 29, 0, 1, 0)

def tempo_juntos():
    """Retorna um dict com dias, horas, minutos, segundos desde o início."""
    agora = datetime.utcnow() - timedelta(hours=3)  # horário de Brasília
    diff = agora - DATA_INICIO
    total_seg = int(diff.total_seconds())

    return {
        "dias": diff.days,
        "horas": (total_seg % 86400) // 3600,
        "minutos": (total_seg % 3600) // 60,
        "segundos": total_seg % 60,
        "data_iso": DATA_INICIO.strftime("%Y-%m-%dT%H:%M:%S"),
    }

# ── rotas de páginas ─────────────────────────

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

# ── apis de persistência ─────────────────────

@app.route("/api/filmes", methods=["GET", "POST"])
def api_filmes():
    if request.method == "POST":
        dados = request.json
        Filme.query.delete()
        for f in dados:
            novo_filme = Filme(
                id=f.get('id'), title=f.get('title'), year=f.get('year'),
                genre=f.get('genre'), who=f.get('who'), where=f.get('where'),
                reason=f.get('reason'), watched=f.get('watched', False)
            )
            db.session.add(novo_filme)
        db.session.commit()
        return jsonify({"mensagem": "Sincronizado"})
    
    filmes_db = Filme.query.all()
    return jsonify([{
        "id": f.id, "title": f.title, "year": f.year, "genre": f.genre,
        "who": f.who, "where": f.where, "reason": f.reason, "watched": f.watched
    } for f in filmes_db])

@app.route("/api/viagens", methods=["GET", "POST"])
def api_viagens():
    if request.method == "POST":
        dados = request.json
        Viagem.query.delete()
        for v in dados:
            nova_v = Viagem(
                id=v.get('id'), dest=v.get('dest'), data=v.get('data'),
                status=v.get('status'), quem=v.get('quem'), notes=v.get('notes')
            )
            db.session.add(nova_v)
        db.session.commit()
        return jsonify({"mensagem": "Sincronizado"})
    
    viagens_db = Viagem.query.all()
    return jsonify([{
        "id": v.id, "dest": v.dest, "data": v.data,
        "status": v.status, "quem": v.quem, "notes": v.notes
    } for v in viagens_db])

@app.route("/api/coisinhas", methods=["GET", "POST"])
def api_coisinhas():
    if request.method == "POST":
        dados = request.json
        Coisinha.query.delete()
        for c in dados:
            nova_c = Coisinha(
                title=c.get('title'), category=c.get('category'),
                notes=c.get('notes'), done=c.get('done', False)
            )
            db.session.add(nova_c)
        db.session.commit()
        return jsonify({"mensagem": "Sincronizado"})
    
    coisinhas_db = Coisinha.query.all()
    return jsonify([{
        "title": c.title, "category": c.category,
        "notes": c.notes, "done": c.done
    } for c in coisinhas_db])

if __name__ == "__main__":
    app.run(debug=True)