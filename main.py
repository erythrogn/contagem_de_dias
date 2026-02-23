from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

# Caminho temporário para salvar os dados na Vercel
DATA_FILE = '/tmp/tj_data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"coisinhas": [], "filmes": [], "viagens": []}

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f)

# Rotas das Páginas
@app.route('/')
def index(): return render_template('index.html')

@app.route('/calendario')
def calendario(): return render_template('calendario.html')

@app.route('/viagens')
def viagens(): return render_template('viagens.html')

@app.route('/filmes')
def filmes(): return render_template('filmes.html')

@app.route('/coisinhas')
def coisinhas(): return render_template('coisinhas.html')

# Rotas da API (Sincronização)
@app.route('/api/<list_name>', methods=['GET', 'POST'])
def api_list(list_name):
    data = load_data()
    if request.method == 'POST':
        data[list_name] = request.json
        save_data(data)
        return jsonify({"status": "success"})
    return jsonify(data.get(list_name, []))

if __name__ == '__main__':
    app.run(debug=True)