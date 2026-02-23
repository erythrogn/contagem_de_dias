from flask import Flask, render_template, request, jsonify
import json
import os
import urllib.request

app = Flask(__name__)

# Variáveis injetadas automaticamente pela Vercel após criar o banco KV
KV_REST_API_URL = os.environ.get('KV_REST_API_URL')
KV_REST_API_TOKEN = os.environ.get('KV_REST_API_TOKEN')

def load_data():
    if not KV_REST_API_URL or not KV_REST_API_TOKEN:
        print("Aviso: Vercel KV não configurado.")
        return {"coisinhas": [], "filmes": [], "viagens": []}
    
    try:
        # Comando GET do Redis
        payload = json.dumps(["GET", "tj_data"])
        req = urllib.request.Request(
            KV_REST_API_URL,
            data=payload.encode('utf-8'),
            headers={"Authorization": f"Bearer {KV_REST_API_TOKEN}", "Content-Type": "application/json"},
            method='POST'
        )
        with urllib.request.urlopen(req) as response:
            resp_json = json.loads(response.read().decode('utf-8'))
            if resp_json.get('result'):
                return json.loads(resp_json['result'])
    except Exception as e:
        print("Erro ao carregar dados do banco:", e)
    
    return {"coisinhas": [], "filmes": [], "viagens": []}

def save_data(data):
    if not KV_REST_API_URL or not KV_REST_API_TOKEN:
        print("Aviso: Vercel KV não configurado. Os dados não serão salvos.")
        return
    
    try:
        # Comando SET do Redis
        payload = json.dumps(["SET", "tj_data", json.dumps(data)])
        req = urllib.request.Request(
            KV_REST_API_URL,
            data=payload.encode('utf-8'),
            headers={"Authorization": f"Bearer {KV_REST_API_TOKEN}", "Content-Type": "application/json"},
            method='POST'
        )
        urllib.request.urlopen(req)
    except Exception as e:
        print("Erro ao salvar dados no banco:", e)

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