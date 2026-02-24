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