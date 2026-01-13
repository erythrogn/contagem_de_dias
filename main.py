from flask import Flask, render_template
from datetime import datetime, timedelta

app = Flask(__name__)

@app.route('/')
def index():
    nome1 = ""
    nome2 = ""
    data_inicio_iso = "2025-11-29T00:00:00"
    agora = datetime.now()
    agora_br = agora - timedelta(hours=3)
    mostrar_surpresa = (agora_br.day == 29 and agora_br.month == 12)
    return render_template('index.html', n1=nome1, n2=nome2, data=data_inicio_iso, surpresa=mostrar_surpresa)

if __name__ == '__main__':
    app.run(debug=True)