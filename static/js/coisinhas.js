import { ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

const form = document.getElementById('coisinhaForm');
const input = document.getElementById('coisinhaInput');
const listContainer = document.getElementById('coisinhasList');
const filterBtns = document.querySelectorAll('.filter-btn');

let allCoisinhas = [];
let currentFilter = 'all'; // Pode ser 'all', 'pending', 'done'

// 1. O SERVIÇO: Adicionar um novo item
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  try {
    await push(ref(db, 'coisinhas'), {
      title: title,
      done: false,
      createdAt: Date.now()
      // Se você tinha imagens salvas no banco antes, pode adicionar o campo imageUrl aqui.
    });
    input.value = '';
    input.focus();
  } catch (error) {
    console.error("Erro ao registrar a experiência:", error);
  }
});

// 2. ESCUTAR DADOS DO FIREBASE
onValue(ref(db, 'coisinhas'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    allCoisinhas = [];
  } else {
    allCoisinhas = Object.entries(data).map(([id, val]) => ({ id, ...val }));
  }
  renderCards();
});

// 3. LÓGICA DE FILTROS
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Muda a classe ativa visualmente
    filterBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    // Atualiza o estado do filtro e re-renderiza
    currentFilter = e.target.getAttribute('data-filter');
    renderCards();
  });
});

// 4. RENDERIZAR A GRADE DE CARTÕES
function renderCards() {
  listContainer.innerHTML = '';

  // Aplica o filtro atual
  let itemsToRender = allCoisinhas.filter(item => {
    if (currentFilter === 'pending') return !item.done;
    if (currentFilter === 'done') return item.done;
    return true; // 'all'
  });

  // Ordena: Não concluídos primeiro, depois os concluídos
  itemsToRender.sort((a, b) => {
    if (a.done === b.done) return (b.createdAt || 0) - (a.createdAt || 0);
    return a.done ? 1 : -1;
  });

  if (itemsToRender.length === 0) {
    listContainer.innerHTML = '<div class="empty-menu">Nenhuma experiência encontrada nesta categoria.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  itemsToRender.forEach(item => {
    const card = document.createElement('div');
    card.className = `experience-card ${item.done ? 'done' : ''}`;
    card.setAttribute('data-id', item.id);

    // Geração Dinâmica da Imagem baseada no Título (mantém a mágica do app antigo)
    // Se não houver imageUrl no banco, ele gera uma foto temática (romantic aesthetic) na hora.
    const imgSrc = item.imageUrl ? item.imageUrl : `https://image.pollinations.ai/prompt/${encodeURIComponent(item.title + " romantic cinematic")}?width=400&height=300&nologo=true`;

    card.innerHTML = `
      <div class="card-image">
        <img src="${imgSrc}" alt="${item.title}" loading="lazy">
      </div>
      <div class="card-content">
        <span class="item-name">${item.title}</span>
        <label class="item-checkbox-container">
          <input type="checkbox" class="elegant-checkbox" ${item.done ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </div>
      <button class="btn-delete" aria-label="Remover">✕</button>
    `;
    
    fragment.appendChild(card);
  });

  listContainer.appendChild(fragment);
}

// 5. INTERAÇÃO: Checkbox e Deleção
listContainer.addEventListener('change', (e) => {
  if (e.target.classList.contains('elegant-checkbox')) {
    const card = e.target.closest('.experience-card');
    const id = card.getAttribute('data-id');
    const isChecked = e.target.checked;
    update(ref(db, `coisinhas/${id}`), { done: isChecked });
  }
});

listContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    const card = e.target.closest('.experience-card');
    const id = card.getAttribute('data-id');
    
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    
    setTimeout(() => remove(ref(db, `coisinhas/${id}`)), 300);
  }
});