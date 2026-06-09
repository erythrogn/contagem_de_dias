import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
export const db = getDatabase(app);

export class UIController {
    constructor() {
        this.createToastContainer();
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
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
}

export const ui = new UIController();

function toggleMenu() {
  const toggle   = document.getElementById('menuToggle');
  const menu     = document.getElementById('navMenu');
  const overlay  = document.getElementById('overlay');
  
  const willBeOpen = !menu.classList.contains('active');
  
  menu.classList.toggle('active', willBeOpen);
  toggle.classList.toggle('open', willBeOpen);
  overlay.classList.toggle('active', willBeOpen);
  
  toggle.setAttribute('aria-expanded', willBeOpen);
  toggle.setAttribute('aria-label', willBeOpen ? 'Fechar menu' : 'Abrir menu');
  
  document.body.style.overflow = willBeOpen ? 'hidden' : '';
  
  if (willBeOpen) {
    menu.querySelector('a').focus(); // foco no primeiro link
  }
}

document.getElementById('menuToggle').addEventListener('click', toggleMenu);
document.getElementById('overlay').addEventListener('click', toggleMenu);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('navMenu').classList.contains('active')) {
    toggleMenu();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 820) {
    document.getElementById('menuToggle').classList.remove('open');
    document.getElementById('navMenu').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    document.body.style.overflow = '';
  }
});