// app.js (module) - versione corretta e coerente
// Usa: Firestore top-level collection "students" con campi:
// name, school ("scientifico"|"linguistico"), classe (1..5),
// grades: array, absences: array, notes: array

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import {
  getFirestore, collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, deleteDoc, getDocs, getDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ----------------- CONFIG FIREBASE (sostituisci se diverso) -----------------
const firebaseConfig = {
  apiKey: "AIzaSyDAP5DTAg7TX9SKdIMLFFngo_csolzkswo",
  authDomain: "registro-d308f.firebaseapp.com",
  projectId: "registro-d308f",
  storageBucket: "registro-d308f.firebasestorage.app",
  messagingSenderId: "878790384139",
  appId: "1:878790384139:web:5c21fc809d6a109ac6450e",
  measurementId: "G-21K3RD2Y93"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ----------------- Riferimenti UI -----------------
const schoolsContainer = document.getElementById('schoolsContainer');
const dashboard = document.getElementById('dashboard');
const classView = document.getElementById('classView');
const importSection = document.getElementById('importSection');

const homeBtn = document.getElementById('homeBtn');
const importBtnHeader = document.getElementById('importBtnHeader');
const backBtn = document.getElementById('backBtn');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');

const studentsTableBody = document.querySelector('#studentsTable tbody');
const classTitle = document.getElementById('classTitle');
const addStudentBtn = document.getElementById('addStudentBtn');

const xlsxInput = document.getElementById('xlsxInput');
const sheetSelect = document.getElementById('sheetSelect');
const previewBtn = document.getElementById('previewBtn');
const doImportBtn = document.getElementById('doImportBtn');
const importClassSelect = document.getElementById('importClassSelect');
const hasHeaderCheckbox = document.getElementById('hasHeader');
const tryDedupeCheckbox = document.getElementById('tryDedupe');
const previewArea = document.getElementById('previewArea');
const previewContent = document.getElementById('previewContent');

const studentModal = document.getElementById('studentModal');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const studentNameEl = document.getElementById('studentName');
const gradesList = document.getElementById('gradesList');
const absencesList = document.getElementById('absencesList');
const notesList = document.getElementById('notesList');

const gradeForm = document.getElementById('gradeForm');
const absenceForm = document.getElementById('absenceForm');
const noteForm = document.getElementById('noteForm');
const studentsTableBody = document.querySelector("#studentsTable tbody");

// ----------------- Stato -----------------
let currentSchool = null;
let currentClasse = null;
let currentClassQueryUnsub = null;
let currentStudentDocUnsub = null;
let currentStudentId = null;

// ----------------- Funzioni UI -----------------
function renderDashboard() {
  dashboard.style.display = '';
  classView.style.display = 'none';
  importSection.style.display = 'none';
  hideModal();

  schoolsContainer.innerHTML = '';
  const licei = [
    { id: 'scientifico', label: 'Liceo Scientifico' },
    { id: 'linguistico', label: 'Liceo Linguistico' }
  ];
  licei.forEach(liceo => {
    const card = document.createElement('div');
    card.className = 'school-card';
    const title = document.createElement('h3');
    title.textContent = liceo.label;
    card.appendChild(title);

    const list = document.createElement('div');
    list.className = 'class-list';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.className = 'class-btn';
      btn.textContent = `Classe ${i}`;
      btn.addEventListener('click', () => openClass(liceo.id, i));
      list.appendChild(btn);
    }
    card.appendChild(list);
    schoolsContainer.appendChild(card);
  });
}

function openClass(school, classe) {
  // annulla listener precedente
  if (currentClassQueryUnsub) currentClassQueryUnsub();

  currentSchool = school;
  currentClasse = classe;
  dashboard.style.display = 'none';
  importSection.style.display = 'none';
  classView.style.display = '';
  classTitle.textContent = `${(school[0].toUpperCase() + school.slice(1))} — Classe ${classe}`;

  // query realtime
  const studentsCol = collection(db, 'students');
  const q = query(studentsCol, where('school', '==', school), where('classe', '==', classe));
  currentClassQueryUnsub = onSnapshot(q, snap => {
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.deleted) return; // ignore soft-deleted
      docs.push({ id: d.id, ...data });
    });
    renderStudentsTable(docs);
  }, err => console.error('snapshot error', err));
}

function renderStudentsTable(students) {
  const studentsTableBody = document.querySelector("#studentsTable tbody"); // <--- selezione tbody
  studentsTableBody.innerHTML = '';
  
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  
  students.forEach((s, index) => {
    const tr = document.createElement('tr');

    // Numero progressivo
    const tdIndex = document.createElement('td');
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);

    // Nome studente
    const tdName = document.createElement('td');
    const nameBtn = document.createElement('button');
    nameBtn.className = 'btn';
    nameBtn.style.padding = '6px 8px';
    nameBtn.textContent = s.name || '—';
    nameBtn.addEventListener('click', () => openStudentModal(s.id));
    tdName.appendChild(nameBtn);
    tr.appendChild(tdName);

    // Totale voti
    const tdGrades = document.createElement('td');
    tdGrades.innerHTML = `<div class="small-note">tot. voti: ${(s.grades || []).length}</div>`;
    tr.appendChild(tdGrades);

    // Totale assenze
    const tdAbs = document.createElement('td');
    tdAbs.innerHTML = `<div class="small-note">tot. assenze: ${(s.absences || []).length}</div>`;
    tr.appendChild(tdAbs);

    // Azioni
    const tdActions = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn';
    delBtn.textContent = 'Elimina';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Eliminare ${s.name}?`)) return;
      if (!auth.currentUser) return alert('Devi essere autenticato per eliminare.');
      try {
        await deleteDoc(doc(db, 'students', s.id));
      } catch (e) {
        console.error(e);
        alert('Errore eliminazione');
      }
    });
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    studentsTableBody.appendChild(tr);
  });
}


// ----------------- Modal studente -----------------
function showModal() { studentModal.style.display = ''; }
function hideModal() {
  studentModal.style.display = 'none';
  studentNameEl.textContent = '';
  gradesList.innerHTML = '';
  absencesList.innerHTML = '';
  notesList.innerHTML = '';
  if (currentStudentDocUnsub) { currentStudentDocUnsub(); currentStudentDocUnsub = null; }
  currentStudentId = null;
}

async function openStudentModal(studentId) {
  if (!studentId) return;
  currentStudentId = studentId;
  showModal();

  const docRef = doc(db, 'students', studentId);
  // realtime doc
  if (currentStudentDocUnsub) currentStudentDocUnsub();
  currentStudentDocUnsub = onSnapshot(docRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    studentNameEl.textContent = data.name || '—';
    populateHistory(data);
  }, err => console.error('doc snapshot', err));
}

function populateHistory(data) {
  gradesList.innerHTML = '';
  absencesList.innerHTML = '';
  notesList.innerHTML = '';

  const grades = data.grades || [];
  const absences = data.absences || [];
  const notes = data.notes || [];

  // aggiorna riepilogo
  document.getElementById('summaryGrades').textContent = grades.length;
  document.getElementById('summaryAbsences').textContent = absences.length;
  document.getElementById('summaryNotes').textContent = notes.length;

  grades.slice().reverse().forEach(g => {
    const li = document.createElement('li');
    li.textContent = `${g.date || ''} — ${g.subject || ''}: ${g.value}`;
    gradesList.appendChild(li);
  });
  absences.slice().reverse().forEach(a => {
    const li = document.createElement('li');
    li.textContent = `${a.date || ''} — ${a.reason || ''}`;
    absencesList.appendChild(li);
  });
  notes.slice().reverse().forEach(n => {
    const li = document.createElement('li');
    li.textContent = `${n.createdAt ? n.createdAt.slice(0,10) : ''} — ${n.text || ''}`;
    notesList.appendChild(li);
  });
}

// Modal close
modalOverlay.addEventListener('click', hideModal);
closeModalBtn.addEventListener('click', hideModal);

// ----------------- Forms in modal -----------------
gradeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const form = new FormData(gradeForm);
  const subject = form.get('subject');
  const value = Number(form.get('value'));
  const date = form.get('date') || new Date().toISOString().slice(0,10);
  const gradeObj = { subject, value, date, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { grades: arrayUnion(gradeObj) });
    gradeForm.reset();
  } catch (e) { console.error(e); alert('Errore salvataggio voto'); }
});

absenceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const form = new FormData(absenceForm);
  const date = form.get('date');
  const reason = form.get('reason') || '';
  const obj = { date, reason, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { absences: arrayUnion(obj) });
    absenceForm.reset();
  } catch (e) { console.error(e); alert('Errore salvataggio assenza'); }
});

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const form = new FormData(noteForm);
  const text = form.get('text');
  const obj = { text, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { notes: arrayUnion(obj) });
    noteForm.reset();
  } catch (e) { console.error(e); alert('Errore salvataggio nota'); }
});

// ----------------- AUTH -----------------
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('auth error', e);
    alert('Errore durante il login: ' + (e.message || e));
  }
});
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.textContent = user.displayName || user.email;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = '';
    renderDashboard();
  } else {
    userInfo.textContent = '';
    loginBtn.style.display = '';
    logoutBtn.style.display = 'none';
    // nascondi aree sensibili se non loggato
    dashboard.style.display = 'none';
    classView.style.display = 'none';
    importSection.style.display = 'none';
  }
});

// ----------------- Header navigation -----------------
homeBtn.addEventListener('click', () => {
  if (currentClassQueryUnsub) { currentClassQueryUnsub(); currentClassQueryUnsub = null; }
  renderDashboard();
});
importBtnHeader.addEventListener('click', () => {
  dashboard.style.display = 'none';
  classView.style.display = 'none';
  importSection.style.display = '';
  hideModal();
});
backBtn.addEventListener('click', () => {
  // comportamento semplice: torna alla dashboard
  if (currentClassQueryUnsub) { currentClassQueryUnsub(); currentClassQueryUnsub = null; }
  renderDashboard();
});

// ----------------- Aggiungi studente manuale -----------------
addStudentBtn.addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Devi autenticarti per aggiungere studenti.');
  const name = prompt('Nome completo alunno:');
  if (!name) return;
  try {
    await addDoc(collection(db, 'students'), {
      name,
      school: currentSchool,
      classe: currentClasse,
      grades: [],
      absences: [],
      notes: [],
      createdBy: auth.currentUser.uid,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    alert('Errore aggiunta studente');
  }
});

// ----------------- IMPORT XLSX (prima colonna) -----------------
let workbookGlobal = null;
xlsxInput.addEventListener('change', (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target.result;
    const wb = XLSX.read(data, { type: 'array' });
    workbookGlobal = wb;
    sheetSelect.innerHTML = '';
    wb.SheetNames.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sheetSelect.appendChild(opt);
    });
    sheetSelect.style.display = '';
    previewBtn.style.display = '';
    doImportBtn.style.display = '';
  };
  reader.readAsArrayBuffer(f);
});

previewBtn.addEventListener('click', () => {
  if (!workbookGlobal) return alert('Carica prima un file .xlsx');
  const sheet = workbookGlobal.Sheets[sheetSelect.value];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const hasHeader = hasHeaderCheckbox.checked;
  const displayRows = hasHeader ? rows.slice(1) : rows;
  const preview = displayRows.slice(0, 8).map(r => (r && r[0]) ? r[0] : '').join('\n');
  previewContent.textContent = preview || '(foglio vuoto o mapping errato)';
  previewArea.style.display = '';
});

doImportBtn.addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Devi autenticarti (Google) per importare dati.');
  if (!workbookGlobal) return alert('Carica prima un file .xlsx');

  const sheet = workbookGlobal.Sheets[sheetSelect.value];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const hasHeader = hasHeaderCheckbox.checked;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const target = importClassSelect.value.split('-');
  const school = target[0];
  const classe = Number(target[1]);
  const tryDedupe = tryDedupeCheckbox.checked;

  if (!dataRows || dataRows.length === 0) return alert('Foglio vuoto');

  const toAdd = [];
  const skipped = [];

  for (const r of dataRows) {
    const name = (r && r[0]) ? String(r[0]).trim() : null;
    if (!name) continue;

    // dedupe opzionale (match esatto)
    let exists = false;
    if (tryDedupe) {
      const q = query(collection(db, 'students'), where('school', '==', school), where('classe', '==', classe), where('name', '==', name));
      const snap = await getDocs(q);
      if (!snap.empty) exists = true;
    }
    if (exists) { skipped.push({ name, reason: 'duplicato' }); continue; }

    try {
      await addDoc(collection(db, 'students'), {
        name,
        school,
        classe,
        grades: [],
        absences: [],
        notes: [],
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      toAdd.push(name);
    } catch (e) {
      console.error('Import error for', name, e);
      skipped.push({ name, reason: 'errore' });
    }
  }

  alert(`Import completato. Aggiunti: ${toAdd.length}. Saltati: ${skipped.length}.`);
  // pulizia UI
  xlsxInput.value = '';
  sheetSelect.style.display = 'none';
  previewArea.style.display = 'none';
  previewBtn.style.display = 'none';
  doImportBtn.style.display = 'none';
});

// ----------------- inizializzazione UI -----------------
renderDashboard();
