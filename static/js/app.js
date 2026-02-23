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
            </div>
        `;
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

async function apiFetch(endpoint) {
    try {
        const res = await fetch(`/api/${endpoint}`);
        if (!res.ok) throw new Error('Falha na rede');
        return await res.json();
    } catch (e) {
        ui.showToast(`Erro ao carregar dados: ${e.message}`, 'error');
        return [];
    }
}

async function apiSync(endpoint, data) {
    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Falha ao salvar');
        ui.showToast('Sincronizado com sucesso', 'success');
    } catch (e) {
        ui.showToast(`Erro ao salvar: ${e.message}`, 'error');
    }
}

let coisinhas = [];
async function initCoisinhas() {
    coisinhas = await apiFetch('coisinhas');
    renderCoisinhas();
}

function renderCoisinhas() {
    const list = document.getElementById('item-list');
    if (!list) return;
    list.innerHTML = '';
    coisinhas.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `item-card ${item.done ? 'done' : ''}`;
        card.innerHTML = `
            <div class="i-check ${item.done ? 'checked' : ''}" onclick="toggleCoisinha(${index})">
                ${item.done ? ICONS.check : ''}
            </div>
            <div class="i-info">
                <h3 class="i-title">${item.title}</h3>
                <span class="i-meta">${ICONS[item.category] || ICONS.outro} ${item.category.toUpperCase()}</span>
                ${item.notes ? `<p class="i-notes">${item.notes}</p>` : ''}
            </div>
            <button class="btn-del" onclick="reqDeleteCoisinha(${index})">${ICONS.del}</button>
        `;
        list.appendChild(card);
    });
    const total = coisinhas.length;
    const done = coisinhas.filter(c => c.done).length;
    const pct = total ? (done / total) * 100 : 0;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    const text = document.getElementById('progress-count');
    if (text) text.textContent = `${done}/${total}`;
}

async function addCoisinha() {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    if (!title || !category) {
        ui.showToast('Preencha os campos obrigatórios', 'error');
        return;
    }
    coisinhas.push({ title, category, notes: document.getElementById('notes').value.trim(), done: false });
    await apiSync('coisinhas', coisinhas);
    renderCoisinhas();
    document.getElementById('add-form').reset();
}

async function toggleCoisinha(index) {
    coisinhas[index].done = !coisinhas[index].done;
    await apiSync('coisinhas', coisinhas);
    renderCoisinhas();
}

function reqDeleteCoisinha(index) {
    ui.confirmAction('Tem certeza que deseja excluir esta coisinha?', async () => {
        coisinhas.splice(index, 1);
        await apiSync('coisinhas', coisinhas);
        renderCoisinhas();
    });
}

let trips = [];
async function initViagens() {
    trips = await apiFetch('viagens');
    renderViagens();
}

function renderViagens() {
    const list = document.getElementById('tripList');
    if (!list) return;
    list.innerHTML = '';
    trips.forEach(t => {
        const card = document.createElement('div');
        card.className = 'trip-card';
        card.innerHTML = `
            <div class="trip-body">
                <div class="trip-dest">${t.dest}</div>
                <div class="trip-meta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    ${t.data || 'A definir'}
                    &nbsp;&nbsp;&nbsp;
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${t.quem || 'Nós'}
                </div>
                ${t.notes ? `<div class="trip-notes">${t.notes}</div>` : ''}
                <span class="status-badge badge-${t.status}">${t.status.toUpperCase()}</span>
            </div>
            <div class="trip-actions">
                <button class="btn-icon" onclick="reqDeleteTrip('${t.id}')">${ICONS.del}</button>
            </div>
        `;
        list.appendChild(card);
    });
    const sTotal = document.getElementById('s-total');
    if (sTotal) sTotal.textContent = trips.length;
}

async function addTrip() {
    const dest = document.getElementById('fDest').value.trim();
    if (!dest) {
        ui.showToast('O destino é obrigatório', 'error');
        return;
    }
    trips.unshift({
        id: Date.now().toString(),
        dest,
        data: document.getElementById('fData').value.trim(),
        status: document.getElementById('fStatus').value,
        quem: document.getElementById('fQuem').value.trim(),
        notes: document.getElementById('fNotes').value.trim()
    });
    await apiSync('viagens', trips);
    renderViagens();
    document.querySelectorAll('.form-section input, .form-section textarea').forEach(i => i.value = '');
}

function reqDeleteTrip(id) {
    ui.confirmAction('Tem certeza que deseja excluir esta viagem?', async () => {
        trips = trips.filter(t => t.id !== id);
        await apiSync('viagens', trips);
        renderViagens();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('item-list')) initCoisinhas();
    if (document.getElementById('tripList')) initViagens();
    const formC = document.getElementById('add-form');
    if (formC) formC.addEventListener('submit', (e) => { e.preventDefault(); addCoisinha(); });
    const btnTrip = document.getElementById('btn-add-trip');
    if (btnTrip) btnTrip.addEventListener('click', addTrip);
});