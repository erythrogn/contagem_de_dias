from flask import Flask, render_template

app = Flask(__name__)

@app.route('/index')
def index(): return render_template('index.html')

@app.route('/calendario')
def calendario(): return render_template('calendario.html')

@app.route('/viagens')
def viagens(): return render_template('viagens.html')

@app.route('/filmes')
def filmes(): return render_template('filmes.html')

@app.route('/coisinhas')
def coisinhas(): return render_template('coisinhas.html')

if __name__ == '__main__':
    app.run(debug=True)