from flask import Flask, render_template
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def index():
    nome1 = ""
    nome2 = ""
  
    data_inicio_iso = "2025-11-29T00:00:00"
    
    return render_template('index.html', n1=nome1, n2=nome2, data=data_inicio_iso)

# Necessário para deploy e testes locais
if __name__ == '__main__':
    app.run(debug=True)