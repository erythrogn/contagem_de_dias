import { ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

const form = document.getElementById('coisinhaForm');
const input = document.getElementById('coisinhaInput');
const listContainer = document.getElementById('coisinhasList');
const filterBtns = document.querySelectorAll('.filter-btn');

let allCoisinhas = [];
let currentFilter = 'all';

// 1. ADICIONAR NOVA EXPERIÊNCIA
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  try {
    await push(ref(db, 'coisinhas'), {
      title: title,
      done: false,
      createdAt: Date.now()
    });
    input.value = '';
    input.focus();
  } catch (error) {
    console.error("Erro ao registrar a experiência:", error);
  }
});

// 2. ESCUTAR DADOS EM TEMPO REAL
onValue(ref(db, 'coisinhas'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    allCoisinhas = [];
  } else {
    allCoisinhas = Object.entries(data).map(([id, val]) => ({ id, ...val }));
  }
  renderCards();
});

// 3. FILTROS
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.getAttribute('data-filter');
    renderCards();
  });
});

// 4. RENDERIZAR CARTÕES COM IMAGEM GERADA POR IA
// 4. RENDERIZAR CARTÕES COM SISTEMA ANTI-FALHA DE IMAGEM
function renderCards() {
  listContainer.innerHTML = '';

  let itemsToRender = allCoisinhas.filter(item => {
    if (currentFilter === 'pending') return !item.done;
    if (currentFilter === 'done') return item.done;
    return true;
  });

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

    // 1. Resgate de Imagens Antigas (Cobre todas as possibilidades do Firebase)
    let oldImage = item.imageUrl || item.image || item.img || item.foto || "";
    
    // Se a imagem antiga for do serviço Unsplash que foi desativado, ignoramos ela.
    if (oldImage.includes("source.unsplash.com")) {
        oldImage = ""; 
    }

    // 2. O Motor de Inteligência Artificial para gerar as novas
    // Usamos um 'seed' fixo (baseado no ID ou tempo) para que a IA não fique gerando uma imagem diferente cada vez que você abre a página.
    const seed = item.createdAt ? item.createdAt.toString().slice(-4) : '1234';
    const aiPrompt = encodeURIComponent(item.title + ", romantic couples aesthetic photography, cinematic, 4k");
    const imgSrc = oldImage ? oldImage : `https://image.pollinations.ai/prompt/${aiPrompt}?width=600&height=400&seed=${seed}&nologo=true`;

    // 3. Fallback de Segurança Absoluta: Se a IA travar ou a internet falhar, esta foto linda entra no lugar.
    const fallbackImg = "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80";

    // Adicionamos o atributo 'onerror' direto na tag img para trocar a fonte se houver quebra.
    card.innerHTML = `
      <div class="card-actions">
        <button class="action-btn btn-edit" aria-label="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="action-btn btn-delete" aria-label="Remover">✕</button>
      </div>
      <div class="card-image">
        <img src="${imgSrc}" alt="${item.title}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackImg}';">
      </div>
      <div class="card-content">
        <span class="item-name">${item.title}</span>
        <label class="item-checkbox-container">
          <input type="checkbox" class="elegant-checkbox" ${item.done ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </div>
    `;
    
    fragment.appendChild(card);
  });

  listContainer.appendChild(fragment);
}
// 5. INTERAÇÕES: Checkbox, Deletar e Editar
listContainer.addEventListener('change', (e) => {
  if (e.target.classList.contains('elegant-checkbox')) {
    const card = e.target.closest('.experience-card');
    const id = card.getAttribute('data-id');
    update(ref(db, `coisinhas/${id}`), { done: e.target.checked });
  }
});

listContainer.addEventListener('click', (e) => {
  // Ação de Deletar
  if (e.target.closest('.btn-delete')) {
    const card = e.target.closest('.experience-card');
    const id = card.getAttribute('data-id');
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    setTimeout(() => remove(ref(db, `coisinhas/${id}`)), 300);
  }

  // Ação de Editar
  if (e.target.closest('.btn-edit')) {
    const card = e.target.closest('.experience-card');
    const id = card.getAttribute('data-id');
    const titleContainer = card.querySelector('.item-name');
    const currentTitle = titleContainer.textContent;

    // Transforma o texto num input de edição elegante
    titleContainer.innerHTML = `<input type="text" class="edit-input" value="${currentTitle}">`;
    const inputField = titleContainer.querySelector('.edit-input');
    
    // Foca no input e joga o cursor para o final do texto
    inputField.focus();
    inputField.selectionStart = inputField.selectionEnd = inputField.value.length;

    // Salva ao clicar fora (blur) ou apertar Enter
    const saveEdit = () => {
      const newTitle = inputField.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        update(ref(db, `coisinhas/${id}`), { title: newTitle });
        // O Firebase vai atualizar o dado, o evento onValue vai disparar, e a IA vai gerar uma nova foto!
      } else {
        renderCards(); // Se não mudou nada, apenas refaz o layout original
      }
    };

    inputField.addEventListener('blur', saveEdit);
    inputField.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        inputField.removeEventListener('blur', saveEdit); // Previne salvar duas vezes
        saveEdit();
      }
    });
  }
});