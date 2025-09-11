// app.js (module) - Firestore + Auth (Google) + SheetJS + modal + improved import
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, updateDoc, arrayUnion,
  onSnapshot, query, where, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

/* ---------- CONFIG FIREBASE (usa la tua config) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDAP5DTAg7TX9SKdIMLFFngo_csolzkswo",
  authDomain: "registro-d308f.firebaseapp.com",
  projectId: "registro-d308f",
  storageBucket: "registro-d308f.firebasestorage.app",
  messagingSenderId: "878790384139",
  appId: "1:878790384139:web:5c21fc809d6a109ac6450e",
  measurementId: "G-21K3RD2Y93"
};
const fbApp = initializeApp(firebaseConfig);
const analytics = getAnalytics ? getAnalytics(fbApp) : null;
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

/* ---------- UI refs ---------- */
const schoolsContainer = document.getElementById('schoolsContainer');
const dashboard = document.getElementById('dashboard');
const classView = document.getElementById('classView');
const studentModal = document.getElementById('studentModal');
const classTitle = document.getElementById('classTitle');
const studentsTableBody = document.querySelector('#studentsTable tbody');
const studentNameEl = document.getElementById('studentName');

const homeBtn = document.getElementById('homeBtn');
const backBtn = document.getElementById('backBtn');

const authBtn = document.getElementById('authBtn');
const userInfo = document.getElementById('userInfo');

const addStudentBtn = document.getElementById('addStudentBtn');

const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');

const xlsxInput = document.getElementById('xlsxInput');
const sheetSelect = document.getElementById('sheetSelect');
const colSurname = document.getElementById('colSurname');
const colName = document.getElementById('colName');
const colFull = document.getElementById('colFull');
const colMapLabel = document.getElementById('colMapLabel');
const importBtn = document.getElementById('importBtn');
const previewBtn = document.getElementById('previewBtn');
const importClassSelect = document.getElementById('importClassSelect');
const hasHeaderCheckbox = document.getElementById('hasHeader');
const tryDedupeCheckbox = document.getElementById('tryDedupe');

const previewSection = document.getElementById('previewSection');
const previewContent = document.getElementById('previewContent');

let currentSchool = null;
let currentClasse = null;
let lastScreen = null;
let unsubscribeSnapshot = null;
let currentStudentId = null;

let workbookGlobal = null;
let parsedRows = []; // array di oggetti o array depending on header option

/* ---------- RENDER DASHBOARD ---------- */
function renderDashboard() {
  dashboard.style.display = '';
  classView.style.display = 'none';
  hideModal();
  currentSchool = null; currentClasse = null;
  schoolsContainer.innerHTML = '';

  const licei = ['scientifico','linguistico'];
  licei.forEach((liceo) => {
    const card = document.createElement('div');
    card.className = 'school-card';
    const title = document.createElement('h3');
    title.textContent = liceo.charAt(0).toUpperCase() + liceo.slice(1);
    card.appendChild(title);

    const list = document.createElement('div');
    list.className = 'class-list';
    for (let i=1;i<=5;i++){
      const btn = document.createElement('button');
      btn.className = 'class-btn small';
      btn.textContent = `Classe ${i}`;
      btn.addEventListener('click', ()=> openClass(liceo, i));
      list.appendChild(btn);
    }
    card.appendChild(list);
    schoolsContainer.appendChild(card);
  });
}

/* ---------- OPEN CLASS & realtime listener ---------- */
function openClass(school, classe) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  currentSchool = school;
  currentClasse = classe;
  lastScreen = 'dashboard';
  dashboard.style.display = 'none';
  classView.style.display = '';
  hideModal();
  classTitle.textContent = `${school.charAt(0).toUpperCase() + school.slice(1)} — Classe ${classe}`;

  const studentsCol = collection(db, 'students');
  const q = query(studentsCol, where('school','==',school), where('classe','==',classe));
  unsubscribeSnapshot = onSnapshot(q, (snap) => {
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.deleted) return; // skip soft-deleted
      docs.push({ id: d.id, ...data });
    });
    renderStudentsTable(docs);
  }, (err)=> {
    console.error("Errore snapshot:", err);
  });
}

/* ---------- RENDER TABLE ---------- */
function renderStudentsTable(students) {
  studentsTableBody.innerHTML = '';
  students.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  students.forEach(student => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    const nameBtn = document.createElement('button');
    nameBtn.className = 'btn';
    nameBtn.style.padding = '6px 8px';
    nameBtn.textContent = student.name || '—';
    nameBtn.addEventListener('click', ()=> openStudentModal(student.id));
    tdName.appendChild(nameBtn);

    const tdGrades = document.createElement('td');
    tdGrades.innerHTML = `<div class="small-note">tot. voti: ${ (student.grades || []).length }</div>`;

    const tdAbs = document.createElement('td');
    tdAbs.innerHTML = `<div class="small-note">tot. assenze: ${ (student.absences || []).length }</div>`;

    const tdActions = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn';
    delBtn.textContent = 'Elimina';
    delBtn.addEventListener('click', async ()=> {
      if (!confirm(`Eliminare ${student.name}?`)) return;
      try {
        // cancella fisicamente:
        await deleteDoc(doc(db, 'students', student.id));
      } catch(e){ console.error(e); alert('Errore eliminazione'); }
    });
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdGrades);
    tr.appendChild(tdAbs);
    tr.appendChild(tdActions);
    studentsTableBody.appendChild(tr);
  });
}

/* ---------- MODAL (student panel) ---------- */
function showModal() {
  studentModal.style.display = '';
  // trap focus if needed (left simple)
}
function hideModal() {
  studentModal.style.display = 'none';
  currentStudentId = null;
  document.getElementById('gradesList').innerHTML = '';
  document.getElementById('absencesList').innerHTML = '';
  document.getElementById('notesList').innerHTML = '';
}

/* open modal with data */
async function openStudentModal(studentId) {
  lastScreen = 'classView';
  dashboard.style.display = 'none';
  classView.style.display = '';
  studentModal.style.display = '';
  currentStudentId = studentId;

  const dref = doc(db, 'students', studentId);
  const dSnap = await getDoc(dref);
  if (!dSnap.exists()) {
    alert('Studente non trovato');
    return;
  }
  const data = dSnap.data();
  studentNameEl.textContent = data.name || '—';
  populateHistory(data);
}
function populateHistory(data) {
  const gradesList = document.getElementById('gradesList');
  const absencesList = document.getElementById('absencesList');
  const notesList = document.getElementById('notesList');
  gradesList.innerHTML = '';
  absencesList.innerHTML = '';
  notesList.innerHTML = '';

  (data.grades || []).slice().reverse().forEach(g=>{
    const li = document.createElement('li');
    li.textContent = `${g.date || ''} — ${g.subject || ''}: ${g.value}`;
    gradesList.appendChild(li);
  });
  (data.absences || []).slice().reverse().forEach(a=>{
    const li = document.createElement('li');
    li.textContent = `${a.date || ''} — ${a.reason || ''}`;
    absencesList.appendChild(li);
  });
  (data.notes || []).slice().reverse().forEach(n=>{
    const li = document.createElement('li');
    li.textContent = `${n.createdAt ? n.createdAt.slice(0,10) : ''} — ${n.text || ''}`;
    notesList.appendChild(li);
  });
}

/* modal close handlers */
modalOverlay.addEventListener('click', hideModal);
closeModalBtn.addEventListener('click', hideModal);

/* ---------- FORMS ---------- */
const gradeForm = document.getElementById('gradeForm');
const absenceForm = document.getElementById('absenceForm');
const noteForm = document.getElementById('noteForm');

gradeForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const f = new FormData(gradeForm);
  const subject = f.get('subject');
  const value = f.get('value');
  const date = f.get('date') || new Date().toISOString().slice(0,10);
  const g = { subject, value: Number(value), date, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { grades: arrayUnion(g) });
    const d = await getDoc(sref);
    populateHistory(d.data());
    gradeForm.reset();
  } catch(e){ console.error(e); alert('Errore salvataggio voto'); }
});

absenceForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const f = new FormData(absenceForm);
  const date = f.get('date');
  const reason = f.get('reason') || '';
  const a = { date, reason, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { absences: arrayUnion(a) });
    const d = await getDoc(sref);
    populateHistory(d.data());
    absenceForm.reset();
  } catch(e){ console.error(e); alert('Errore salvataggio assenza'); }
});

noteForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!currentStudentId) return alert('Seleziona uno studente');
  const f = new FormData(noteForm);
  const text = f.get('text');
  const n = { text, createdAt: new Date().toISOString() };
  try {
    const sref = doc(db, 'students', currentStudentId);
    await updateDoc(sref, { notes: arrayUnion(n) });
    const d = await getDoc(sref);
    populateHistory(d.data());
    noteForm.reset();
  } catch(e){ console.error(e); alert('Errore salvataggio nota'); }
});

/* ---------- AUTH (Google) ---------- */
authBtn.addEventListener('click', async ()=>{
  if (auth.currentUser) {
    // sign out
    await signOut(auth);
  } else {
    try {
      await signInWithPopup(auth, provider);
    } catch(e){ console.error('Auth error', e); alert('Errore autenticazione'); }
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.textContent = user.displayName || user.email;
    authBtn.textContent = 'Esci';
  } else {
    userInfo.textContent = '';
    authBtn.textContent = 'Accedi';
  }
});

/* ---------- ADD STUDENT MANUAL ---------- */
addStudentBtn.addEventListener('click', async ()=>{
  if (!auth.currentUser) return alert('Devi autenticarti (Google) per modificare i dati.');
  const name = prompt('Nome completo alunno:');
  if (!name) return;
  try {
    await addDoc(collection(db, 'students'), {
      name,
      school: currentSchool,
      classe: currentClasse,
      grades: [],
      absences: [],
      notes: []
    });
  } catch(e){ console.error(e); alert('Errore aggiunta studente'); }
});

/* ---------- XLSX IMPORT: lettura e mapping colonne ---------- */
xlsxInput.addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target.result;
    const wb = XLSX.read(data, { type: 'array' });
    workbookGlobal = wb;
    sheetSelect.innerHTML = '';
    wb.SheetNames.forEach((s,i)=>{
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = `${i+1}. ${s}`;
      sheetSelect.appendChild(opt);
    });
    sheetSelect.style.display = '';
    previewBtn.style.display = '';
    importBtn.style.display = '';
    colMapLabel.style.display = '';
    // clear columns until sheet selected
    colSurname.innerHTML = '';
    colName.innerHTML = '';
    colFull.innerHTML = '';
    previewSection.style.display = 'none';
  };
  reader.readAsArrayBuffer(f);
});

sheetSelect.addEventListener('change', ()=> buildColumnSelectors());

function buildColumnSelectors() {
  if (!workbookGlobal) return;
  const sheetName = sheetSelect.value;
  const sheet = workbookGlobal.Sheets[sheetName];
  // get first 20 rows to detect headers and sample columns
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }).slice(0,30);
  if (rows.length === 0) return;
  // determine max columns
  let maxCols = 0;
  rows.forEach(r => { if (r && r.length > maxCols) maxCols = r.length; });
  const columns = [];
  for (let c=0;c<maxCols;c++) {
    // attempt header label if hasHeader true
    const hdr = (hasHeaderCheckbox.checked && rows[0] && rows[0][c]) ? String(rows[0][c]) : `Col ${c+1}`;
    columns.push({ idx: c, label: hdr });
  }
  // fill selects
  [colSurname, colName, colFull].forEach(sel => sel.innerHTML='');
  const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='(vuota)';
  colSurname.appendChild(emptyOpt.cloneNode(true));
  colName.appendChild(emptyOpt.cloneNode(true));
  colFull.appendChild(emptyOpt.cloneNode(true));
  columns.forEach(col => {
    const opt1 = document.createElement('option'); opt1.value = col.idx; opt1.textContent = `${col.label} [${col.idx+1}]`;
    const opt2 = opt1.cloneNode(true);
    const opt3 = opt1.cloneNode(true);
    colSurname.appendChild(opt1);
    colName.appendChild(opt2);
    colFull.appendChild(opt3);
  });
}

/* preview generation */
previewBtn.addEventListener('click', ()=>{
  if (!workbookGlobal) return alert('Carica il file prima');
  const sheetName = sheetSelect.value;
  const sheet = workbookGlobal.Sheets[sheetName];
  const hasHeader = hasHeaderCheckbox.checked;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: hasHeader ? 0 : 1, raw: false });
  // rows is array of objects (if header=true) otherwise arrays
  parsedRows = rows;
  const sample = rows.slice(0,8).map((r,i)=>{
    if (hasHeader) return JSON.stringify(r);
    return JSON.stringify(r.map(c => c || ''));
  }).join('\n\n');
  previewContent.textContent = sample || '(foglio vuoto)';
  previewSection.style.display = '';
});

/* import with mapping & dedupe */
importBtn.addEventListener('click', async ()=>{
  if (!auth.currentUser) return alert('Devi autenticarti (Google) per importare dati.');

  if (!workbookGlobal) return alert('Carica il file prima');
  const sheetName = sheetSelect.value;
  const sheet = workbookGlobal.Sheets[sheetName];
  const hasHeader = hasHeaderCheckbox.checked;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: hasHeader ? 0 : 1, raw: false });
  if (!rows || rows.length === 0) return alert('Foglio vuoto');

  // figure destination
  const target = importClassSelect.value.split('-');
  const school = target[0];
  const classe = Number(target[1]);

  // mapping choices
  const surnameIdx = colSurname.value !== '' ? Number(colSurname.value) : null;
  const nameIdx = colName.value !== '' ? Number(colName.value) : null;
  const fullIdx = colFull.value !== '' ? Number(colFull.value) : null;
  const tryDedupe = tryDedupeCheckbox.checked;

  // Build preview of normalized names and confirm
  const buildName = (r) => {
    if (hasHeader) {
      // r is object; try to use selected keys (we stored selects as numeric idx, but header mode uses keys)
      // we will map idx -> header key by reading first row keys order
      const headerKeys = Object.keys(rows[0]);
      if (fullIdx !== null) {
        const k = headerKeys[fullIdx];
        return (r[k] || '').toString().trim();
      }
      const surname = surnameIdx !== null ? (r[headerKeys[surnameIdx]] || '') : '';
      const name = nameIdx !== null ? (r[headerKeys[nameIdx]] || '') : '';
      if (surname && name) return `${surname} ${name}`.trim();
      if (name) return name.trim();
      if (surname) return surname.trim();
      return '';
    } else {
      // r is array
      if (fullIdx !== null && r[fullIdx]) return String(r[fullIdx]).trim();
      const surname = (surnameIdx !== null && r[surnameIdx]) ? String(r[surnameIdx]) : '';
      const name = (nameIdx !== null && r[nameIdx]) ? String(r[nameIdx]) : '';
      if (surname && name) return `${surname} ${name}`.trim();
      if (name) return name.trim();
      if (surname) return surname.trim();
      return '';
    }
  };

  // build sanitized list
  const names = rows.map(r => buildName(r)).filter(n => n && n.trim());
  if (names.length === 0) return alert('Nessun nome rilevato con la mappatura selezionata.');

  // preview first 8
  const previewList = names.slice(0,8).map((n,i) => `${i+1}. ${n}`).join('\n');
  if (!confirm(`Importare ${names.length} studenti in ${school} classe ${classe}? Anteprima (prime 8):\n${previewList}`)) return;

  // loop and add, attempt dedupe if requested
  const added = [];
  const skipped = [];
  for (const nm of names) {
    const name = nm.trim();
    const normalized = name.toLowerCase().replace(/\s+/g,' ').trim();
    try {
      let exists = false;
      if (tryDedupe) {
        const studentsCol = collection(db, 'students');
        const q = query(studentsCol, where('school','==',school), where('classe','==',classe), where('name','==',name));
        const snap = await getDocs(q);
        if (!snap.empty) exists = true;
      }
      if (exists) {
        skipped.push({ name, reason: 'duplicato' });
        continue;
      }
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
      added.push(name);
    } catch(e) {
      console.error('Errore import', name, e);
      skipped.push({ name, reason: 'errore' });
    }
  }

  alert(`Import completato.\nAggiunti: ${added.length}\nSaltati: ${skipped.length} (vedi console per dettagli)`);
  // pulizia UI
  xlsxInput.value = '';
  sheetSelect.style.display = 'none';
  colMapLabel.style.display = 'none';
  previewSection.style.display = 'none';
});

/* ---------- header navigation ---------- */
homeBtn.addEventListener('click', ()=> {
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  renderDashboard();
});
backBtn.addEventListener('click', ()=> {
  if (!lastScreen) return renderDashboard();
  if (lastScreen === 'dashboard') renderDashboard();
  else if (lastScreen === 'classView') {
    hideModal();
    classView.style.display = '';
  } else renderDashboard();
});

/* ---------- init ---------- */
renderDashboard();