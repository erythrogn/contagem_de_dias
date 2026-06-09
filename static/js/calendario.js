import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

const START = new Date(2025, 10, 29);
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_FULL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const todayLoad = new Date();
let viewMonth = todayLoad.getMonth();
let viewYear = todayLoad.getFullYear();

let rawData = { viagens: null, filmes: null, coisinhas: null };
let allEvents = {};
let isAnimating = false;
let renderTimeout;

window.prevMonth = function() {
  if (isAnimating) return;
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar(true);
};

window.nextMonth = function() {
  if (isAnimating) return;
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar(true);
};

window.changeMonth = function(val) {
  if (isAnimating || viewMonth === parseInt(val)) return;
  viewMonth = parseInt(val);
  renderCalendar(true);
};

window.changeYear = function(val) {
  if (isAnimating || viewYear === parseInt(val)) return;
  viewYear = parseInt(val);
  renderCalendar(true);
};

window.goToToday = function() {
  if (isAnimating) return;
  const now = new Date();
  if (viewMonth === now.getMonth() && viewYear === now.getFullYear()) return;
  viewMonth = now.getMonth();
  viewYear = now.getFullYear();
  renderCalendar(true);
};

onValue(ref(db, 'viagens'), snap => { rawData.viagens = snap.val(); processEvents(); });
onValue(ref(db, 'filmes'), snap => { rawData.filmes = snap.val(); processEvents(); });
onValue(ref(db, 'coisinhas'), snap => { rawData.coisinhas = snap.val(); processEvents(); });

function processEvents() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    allEvents = {};
    const add = (data, type, titleField, doneCheck) => {
      if (!data) return;
      Object.values(data).forEach(item => {
        if (item.targetDate && !doneCheck(item)) {
          if (!allEvents[item.targetDate]) allEvents[item.targetDate] = [];
          allEvents[item.targetDate].push({ type, title: item[titleField] });
        }
      });
    };
    add(rawData.viagens, 'viagem', 'dest', i => i.status === 'feita');
    add(rawData.filmes, 'filme', 'title', i => i.watched === true || i.watched === 'true');
    add(rawData.coisinhas, 'coisinha', 'title', i => i.done === true);
    
    renderCalendar(false);
  }, 50);
}

function pad(n) { return String(n).padStart(2, '0'); }

function initViewSelectors() {
  const monthSelect = document.getElementById('monthSelect');
  if(monthSelect) monthSelect.innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');

  const yearSelect = document.getElementById('yearSelect');
  if(yearSelect) {
    yearSelect.innerHTML = '';
    for (let y = 2025; y <= 2035; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }
}

function renderCalendar(animate = true) {
  const grid = document.getElementById('daysGrid');
  const listContainer = document.getElementById('eventsListContainer');
  if(!grid || !listContainer) return;
  
  const isInitialRender = grid.innerHTML === '';

  const buildDOM = () => {
    grid.innerHTML = '';
    listContainer.innerHTML = '';

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const anniversaryDay = 29;
    const hasAnniv = totalDays >= anniversaryDay;
    const monthCount = (viewYear - START.getFullYear()) * 12 + (viewMonth - START.getMonth());

    let monthEventsRender = [];
    const now = new Date();

    const gridFrag = document.createDocumentFragment();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day empty';
      gridFrag.appendChild(empty);
    }

    for (let d = 1; d <= totalDays; d++) {
      const cell = document.createElement('div');
      const thisDate = new Date(viewYear, viewMonth, d);
      const dateString = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const dayEvents = allEvents[dateString] || [];

      const isToday = now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === d;
      const isPast = thisDate < new Date(now.getFullYear(), now.getMonth(), now.getDate()) && !isToday;
      const isAnniv = d === anniversaryDay && hasAnniv && thisDate >= START;

      let cls = 'day';
      if (isToday) cls += ' today';
      if (isAnniv) cls += ' anniversary';
      if (isPast) cls += ' past';
      if (!isPast && !isToday) cls += ' future';

      cell.className = cls;
      cell.style.animationDelay = `${(d * 0.015).toFixed(3)}s`;
      
      let innerHTML = `<span class="day-num">${d}</span>`;

      if (isAnniv) {
        const annivTitle = monthCount === 0 ? 'Início do nosso namoro' : `${monthCount} ${monthCount === 1 ? 'mês' : 'meses'} de namoro`;
        monthEventsRender.push({ date: d, dow: DOW_FULL[thisDate.getDay()], type: 'anniv', label: 'Mesversário', title: annivTitle });
      }

      if (dayEvents.length > 0) {
        let tooltips = dayEvents.map(e => e.title).join(' • ');
        if (isToday) tooltips = `Hoje | ` + tooltips;
        cell.setAttribute('data-tip', tooltips);

        let dotsHtml = `<div class="event-dots">`;
        dayEvents.forEach(e => {
          dotsHtml += `<div class="e-dot dot-${e.type}"></div>`;
          const evLabel = e.type === 'viagem' ? 'Viagem' : e.type === 'filme' ? 'Filme' : 'Coisinha';
          monthEventsRender.push({ date: d, dow: DOW_FULL[thisDate.getDay()], type: e.type, label: evLabel, title: e.title });
        });
        dotsHtml += `</div>`;
        innerHTML += dotsHtml;
      } else {
        if (isToday) cell.setAttribute('data-tip', 'Hoje');
        else if (isAnniv) {
          const tip = monthCount === 0 ? 'Início do nosso namoro' : `${monthCount} meses juntos`;
          cell.setAttribute('data-tip', tip);
        }
      }

      cell.innerHTML = innerHTML;
      gridFrag.appendChild(cell);
    }
    
    grid.appendChild(gridFrag);
    monthEventsRender.sort((a, b) => a.date - b.date);

    const listFrag = document.createDocumentFragment();
    
    if (monthEventsRender.length === 0) {
      const div = document.createElement('div');
      div.className = 'no-events';
      div.textContent = 'Nenhum plano ou mesversário marcado para este mês.';
      listFrag.appendChild(div);
    } else {
      monthEventsRender.forEach((ev, idx) => {
        const row = document.createElement('div');
        row.className = 'event-row';
        row.style.animationDelay = `${(idx * 0.08).toFixed(2)}s`; 
        row.innerHTML = `
          <div class="event-date-box">
            <span class="event-date-num">${pad(ev.date)}</span>
            <span class="event-date-dow">${ev.dow}</span>
          </div>
          <div class="event-details">
            <span class="event-type-badge">
              <span class="e-dot dot-${ev.type}"></span> ${ev.label}
            </span>
            <span class="event-title">${ev.title}</span>
          </div>
        `;
        listFrag.appendChild(row);
      });
    }
    
    listContainer.appendChild(listFrag);

    const monthSelectEl = document.getElementById('monthSelect');
    const yearSelectEl = document.getElementById('yearSelect');
    if (monthSelectEl) monthSelectEl.value = viewMonth;
    if (yearSelectEl) yearSelectEl.value = viewYear;
  };

  if (isInitialRender || !animate) {
    buildDOM();
  } else {
    isAnimating = true;
    grid.classList.add('fading-out');
    listContainer.classList.add('fading-out');

    setTimeout(() => {
      buildDOM();
      requestAnimationFrame(() => {
        grid.classList.remove('fading-out');
        listContainer.classList.remove('fading-out');
        setTimeout(() => { isAnimating = false; }, 350);
      });
    }, 300);
  }
}

document.addEventListener("DOMContentLoaded", initViewSelectors);