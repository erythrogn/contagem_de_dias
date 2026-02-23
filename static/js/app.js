import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAkmYoQKSUD1brrYL47RBZB9nHy5WaaSiw",
  authDomain: "contagem-de-dias.firebaseapp.com",
  databaseURL: "https://contagem-de-dias-default-rtdb.firebaseio.com",
  projectId: "contagem-de-dias",
  storageBucket: "contagem-de-dias.firebasestorage.app",
  messagingSenderId: "1086679329538",
  appId: "1:1086679329538:web:a13279892d895a6591b01b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

class UIController {
    constructor() {
        this.createToastContainer();
        this.createModalContainer();
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    createModalContainer() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'modal-overlay';
        this.modalOverlay.innerHTML = `
            <div class="modal-content">
                <h3 class="modal-title">Confirmação</h3>
                <p id="modal-text">Deseja realmente excluir este item?</p>
                <div class="modal-actions">
                    <button class="btn-cancel" id="btn-cancel">Cancelar</button>
                    <button class="btn-confirm" id="btn-confirm">Excluir</button>
                </div>
            </div>`;
        document.body.appendChild(this.modalOverlay);
        document.getElementById('btn-cancel').addEventListener('click', () => this.closeModal());
    }

    showToast(message, type = 'default') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        this.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    confirmAction(message, callback) {
        document.getElementById('modal-text').textContent = message;
        this.modalOverlay.classList.add('active');
        const confirmBtn = document.getElementById('btn-confirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', () => {
            callback();
            this.closeModal();
        });
    }

    closeModal() {
        this.modalOverlay.classList.remove('active');
    }
}

const ui = new UIController();

const ICONS = {
    visitar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    receita: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>',
    drink: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 22h8"></path><path d="M12 15v7"></path><path d="m3 3 18 0"></path><path d="m3 3 9 12 9-12"></path></svg>',
    outro: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    del: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
};

// ── MÓDULO: COISINHAS ──────────────────────────────────────────────
function initCoisinhas() {
    const listRef = ref(db, 'coisinhas');
    onValue(listRef, (snapshot) => {
        const data = snapshot.val();
        const list = document.getElementById('item-list');
        if (!list) return;
        list.innerHTML = '';
        
        let total = 0, doneCount = 0;
        
        if (data) {
            Object.keys(data).forEach(key => {
                const item = data[key];
                total++;
                if (item.done) doneCount++;
                
                const card = document.createElement('div');
                card.className = `item-card ${item.done ? 'done' : ''}`;
                card.innerHTML = `
                    <div class="i-check ${item.done ? 'checked' : ''}" onclick="window.toggleCoisinha('${key}', ${item.done})">
                        ${item.done ? ICONS.check : ''}
                    </div>
                    <div class="i-info">
                        <h3 class="i-title">${item.title}</h3>
                        <span class="i-meta">${ICONS[item.category] || ICONS.outro} ${item.category.toUpperCase()}</span>
                        ${item.notes ? `<p class="i-notes">${item.notes}</p>` : ''}
                    </div>
                    <button class="btn-del" onclick="window.reqDeleteCoisinha('${key}')">${ICONS.del}</button>`;
                list.appendChild(card);
            });
        }
        updateProgress('progress-fill', 'progress-count', doneCount, total);
    });
}

window.addCoisinha = () => {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    if (!title || !category) return ui.showToast('Preencha os campos obrigatórios', 'error');

    push(ref(db, 'coisinhas'), {
        title, category, notes: document.getElementById('notes').value.trim(), done: false
    }).then(() => {
        ui.showToast('Coisinha salva!', 'success');
        document.getElementById('add-form').reset();
    });
};

window.toggleCoisinha = (key, currentStatus) => {
    update(ref(db, `coisinhas/${key}`), { done: !currentStatus });
};

window.reqDeleteCoisinha = (key) => {
    ui.confirmAction('Remover esta coisinha?', () => remove(ref(db, `coisinhas/${key}`)));
};

// ── MÓDULO: VIAGENS ────────────────────────────────────────────────
function initViagens() {
    const listRef = ref(db, 'viagens');
    onValue(listRef, (snapshot) => {
        const data = snapshot.val();
        const list = document.getElementById('tripList');
        if (!list) return;
        list.innerHTML = '';
        
        if (data) {
            Object.keys(data).forEach(key => {
                const t = data[key];
                const card = document.createElement('div');
                card.className = 'trip-card';
                card.innerHTML = `
                    <div class="trip-body">
                        <div class="trip-dest">${t.dest}</div>
                        <div class="trip-meta">
                            ${t.data || 'A definir'} · ${t.quem || 'Nós'}
                        </div>
                        ${t.notes ? `<div class="trip-notes">${t.notes}</div>` : ''}
                        <span class="status-badge badge-${t.status}">${t.status.toUpperCase()}</span>
                    </div>
                    <button class="btn-icon" onclick="window.reqDeleteTrip('${key}')">${ICONS.del}</button>`;
                list.appendChild(card);
            });
            document.getElementById('s-total').textContent = Object.keys(data).length;
        }
    });
}

window.addTrip = () => {
    const dest = document.getElementById('fDest').value.trim();
    if (!dest) return ui.showToast('Destino obrigatório', 'error');

    push(ref(db, 'viagens'), {
        dest,
        data: document.getElementById('fData').value.trim(),
        status: document.getElementById('fStatus').value,
        quem: document.getElementById('fQuem').value.trim(),
        notes: document.getElementById('fNotes').value.trim()
    }).then(() => {
        ui.showToast('Viagem planejada!', 'success');
        document.querySelectorAll('.form-section input, .form-section textarea').forEach(i => i.value = '');
    });
};

window.reqDeleteTrip = (key) => {
    ui.confirmAction('Excluir viagem?', () => remove(ref(db, `viagens/${key}`)));
};

// ── MÓDULO: FILMES ─────────────────────────────────────────────────
function initFilmes() {
    const listRef = ref(db, 'filmes');
    onValue(listRef, (snapshot) => {
        const data = snapshot.val();
        const list = document.getElementById('movieList');
        if (!list) return;
        list.innerHTML = '';
        
        let total = 0, watchedCount = 0;

        if (data) {
            Object.keys(data).forEach(key => {
                const m = data[key];
                total++;
                if (m.watched) watchedCount++;

                const card = document.createElement('div');
                card.className = `movie-card ${m.watched ? 'watched' : ''}`;
                card.innerHTML = `
                    <div class="m-check ${m.watched ? 'checked' : ''}" onclick="window.toggleMovie('${key}', ${m.watched})">
                        ${m.watched ? ICONS.check : ''}
                    </div>
                    <div style="flex:1">
                        <div class="m-title">${m.title}</div>
                        <div class="m-meta">${m.year || ''} · ${m.where || ''}</div>
                        ${m.genre ? `<span class="status-badge">${m.genre}</span>` : ''}
                    </div>
                    <button class="btn-del" onclick="window.reqDeleteMovie('${key}')">${ICONS.del}</button>`;
                list.appendChild(card);
            });
        }
        updateProgress('progressFill', 'progressLabel', watchedCount, total);
    });
}

window.addMovie = () => {
    const title = document.getElementById('fTitle').value.trim();
    if (!title) return ui.showToast('Título obrigatório', 'error');

    push(ref(db, 'filmes'), {
        title,
        genre: document.getElementById('fGenre').value.trim(),
        year: document.getElementById('fYear').value.trim(),
        who: document.getElementById('fWho').value.trim(),
        where: document.getElementById('fWhere').value.trim(),
        reason: document.getElementById('fReason').value.trim(),
        watched: false
    }).then(() => {
        ui.showToast('Filme adicionado!', 'success');
        document.querySelectorAll('.form-section input').forEach(i => i.value = '');
    });
};

window.toggleMovie = (key, currentStatus) => {
    update(ref(db, `filmes/${key}`), { watched: !currentStatus });
};

window.reqDeleteMovie = (key) => {
    ui.confirmAction('Remover filme?', () => remove(ref(db, `filmes/${key}`)));
};

// ── UTILITÁRIOS ────────────────────────────────────────────────────
function updateProgress(fillId, textId, current, total) {
    const fill = document.getElementById(fillId);
    const text = document.getElementById(textId);
    const pct = total ? Math.round((current / total) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = textId === 'progressLabel' ? `${current} / ${total}` : `${current}/${total}`;
}

// ── BOOTSTRAP ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('item-list')) initCoisinhas();
    if (document.getElementById('tripList')) initViagens();
    if (document.getElementById('movieList')) initFilmes();

    const formC = document.getElementById('add-form');
    if (formC) formC.addEventListener('submit', (e) => { e.preventDefault(); window.addCoisinha(); });
    
    const btnTrip = document.getElementById('btn-add-trip');
    if (btnTrip) btnTrip.addEventListener('click', window.addTrip);

    const btnMovie = document.getElementById('btn-add-movie');
    if (btnMovie) btnMovie.addEventListener('click', window.addMovie);
});