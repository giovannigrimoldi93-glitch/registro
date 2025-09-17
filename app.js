// app.js (module) - Versione con eliminazione voti/assenze e appunti di classe

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import {
    getFirestore, collection, query, where, onSnapshot,
    addDoc, doc, updateDoc, setDoc, deleteDoc, getDocs, getDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ----------------- CONFIG FIREBASE -----------------
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
const timetableSection = document.getElementById('timetableSection');

const homeBtn = document.getElementById('homeBtn');
const importBtnHeader = document.getElementById('importBtnHeader');
const backBtn = document.getElementById('backBtn');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');

const studentsTableBody = document.querySelector("#studentsTable tbody");
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

const showTimetableBtn = document.getElementById('showTimetableBtn');
const timetableTable = document.getElementById('timetable');
const editTimetableBtn = document.getElementById('editTimetableBtn');
const saveTimetableBtn = document.getElementById('saveTimetableBtn');

// Riferimenti UI Appunti di Classe
const toggleNotesBtn = document.getElementById('toggleNotesBtn');
const notesSection = document.getElementById('notesSection');
const classNotesTextarea = document.getElementById('classNotesTextarea');
const saveNotesBtn = document.getElementById('saveNotesBtn');
const notesStatus = document.getElementById('notesStatus');

// ----------------- Stato -----------------
let currentSchool = null;
let currentClasse = null;
let currentClassQueryUnsub = null;
let currentStudentDocUnsub = null;
let currentStudentId = null;

const classesForTimetable = [
    { school: 'scientifico', classe: 1, label: '1 Scientifico' }, { school: 'scientifico', classe: 2, label: '2 Scientifico' },
    { school: 'scientifico', classe: 3, label: '3 Scientifico' }, { school: 'scientifico', classe: 4, label: '4 Scientifico' },
    { school: 'scientifico', classe: 5, label: '5 Scientifico' }, { school: 'linguistico', classe: 1, label: '1 Linguistico' },
    { school: 'linguistico', classe: 2, label: '2 Linguistico' }, { school: 'linguistico', classe: 3, label: '3 Linguistico' },
    { school: 'linguistico', classe: 4, label: '4 Linguistico' }, { school: 'linguistico', classe: 5, label: '5 Linguistico' },
    { school: 'comune', classe: 4, label: '4 (Comune)' }
];

// ----------------- Funzioni UI -----------------
function renderDashboard() {
    dashboard.style.display = '';
    classView.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = 'none';
    hideModal();

    schoolsContainer.innerHTML = '';
    const licei = [
        { id: 'scientifico', label: 'Liceo Scientifico' }, { id: 'linguistico', label: 'Liceo Linguistico' }
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
    if (currentClassQueryUnsub) currentClassQueryUnsub();

    currentSchool = school;
    currentClasse = classe;
    dashboard.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = 'none';
    classView.style.display = '';
    classTitle.textContent = `${(school[0].toUpperCase() + school.slice(1))} — Classe ${classe}`;
    
    // Reset e caricamento appunti
    notesSection.style.display = 'none';
    classNotesTextarea.value = '';
    notesStatus.textContent = '';
    loadClassNotes();

    const studentsCol = collection(db, 'students');
    const q = query(studentsCol, where('school', '==', school), where('classe', '==', classe));
    currentClassQueryUnsub = onSnapshot(q, snap => {
        const docs = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.deleted) return;
            docs.push({ id: d.id, ...data });
        });
        renderStudentsTable(docs);
    }, err => console.error('snapshot error', err));
}

function renderStudentsTable(students) {
    studentsTableBody.innerHTML = '';
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    students.forEach((s, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><button class="btn student-name-btn">${s.name || '—'}</button></td>
            <td><div class="small-note">tot. voti: ${(s.grades || []).length}</div></td>
            <td><div class="small-note">tot. assenze: ${(s.absences || []).length}</div></td>
            <td><button class="btn delete-student-btn">Elimina</button></td>
        `;
        tr.querySelector('.student-name-btn').addEventListener('click', () => openStudentModal(s.id));
        tr.querySelector('.delete-student-btn').addEventListener('click', async () => {
            if (!confirm(`Eliminare ${s.name}?`)) return;
            if (!auth.currentUser) return alert('Devi essere autenticato per eliminare.');
            try {
                await deleteDoc(doc(db, 'students', s.id));
            } catch (e) {
                console.error(e);
                alert('Errore eliminazione');
            }
        });
        studentsTableBody.appendChild(tr);
    });
}

// ----------- Funzioni per gli appunti di classe -----------
async function loadClassNotes() {
    if (!currentSchool || !currentClasse) return;
    const classId = `${currentSchool}-${currentClasse}`;
    const notesDocRef = doc(db, 'classNotes', classId);

    try {
        const docSnap = await getDoc(notesDocRef);
        if (docSnap.exists()) {
            classNotesTextarea.value = docSnap.data().notes || '';
            notesStatus.textContent = `Caricato il ${new Date(docSnap.data().updatedAt).toLocaleString()}`;
        } else {
            classNotesTextarea.value = '';
            notesStatus.textContent = 'Nessun appunto trovato per questa classe.';
        }
    } catch (e) {
        console.error("Errore nel caricamento degli appunti:", e);
        notesStatus.textContent = "Errore di caricamento.";
    }
}

saveNotesBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return alert('Devi essere autenticato per salvare.');
    if (!currentSchool || !currentClasse) return;

    const classId = `${currentSchool}-${currentClasse}`;
    const notesDocRef = doc(db, 'classNotes', classId);
    const notesContent = classNotesTextarea.value;
    notesStatus.textContent = 'Salvataggio...';

    try {
        await setDoc(notesDocRef, {
            notes: notesContent,
            updatedBy: auth.currentUser.uid,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        notesStatus.textContent = `Salvato ora.`;
    } catch (e) {
        console.error("Errore salvataggio appunti:", e);
        notesStatus.textContent = 'Errore durante il salvataggio.';
        alert('Si è verificato un errore.');
    }
});

toggleNotesBtn.addEventListener('click', () => {
    const isVisible = notesSection.style.display === '';
    notesSection.style.display = isVisible ? 'none' : '';
});


// ----------------- Funzioni per la tabella orario -----------------
const dayMappings = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const hours = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function openTimetable() {
    dashboard.style.display = 'none';
    classView.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = '';
    loadTimetable();
}

async function loadTimetable() {
    timetableTable.querySelector('tbody').innerHTML = '';
    const timetableDocRef = doc(db, 'timetables', 'unique_timetable');
    const snap = await getDoc(timetableDocRef);
    let timetableData = snap.exists() ? snap.data().data : null;

    hours.forEach((hour) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${hour}</td>` + dayMappings.map(day => {
            const lesson = timetableData?.find(item => item.hour === hour)?.[day] || '';
            return `<td>${lesson}</td>`;
        }).join('');
        timetableTable.querySelector('tbody').appendChild(tr);
    });
}

showTimetableBtn.addEventListener('click', openTimetable);

editTimetableBtn.addEventListener('click', () => {
    editTimetableBtn.style.display = 'none';
    saveTimetableBtn.style.display = '';
    timetableTable.querySelectorAll('tbody td:not(:first-child)').forEach(cell => {
        const currentContent = cell.textContent.trim();
        cell.innerHTML = `<select class="timetable-select">
            <option value=""></option>
            <option value="Disponibile">Disponibile</option>
            ${classesForTimetable.map(c => `<option value="${c.label}" ${currentContent === c.label ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>`;
    });
});

saveTimetableBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return alert('Devi essere autenticato per salvare l\'orario.');
    saveTimetableBtn.style.display = 'none';
    editTimetableBtn.style.display = '';

    const timetableData = Array.from(timetableTable.querySelectorAll('tbody tr')).map(row => {
        const hour = row.cells[0].textContent;
        const rowData = { hour };
        Array.from(row.cells).slice(1).forEach((cell, index) => {
            const select = cell.querySelector('select');
            const lesson = select ? select.value : cell.textContent.trim();
            rowData[dayMappings[index]] = lesson;
            cell.textContent = lesson;
        });
        return rowData;
    });

    try {
        const timetableDocRef = doc(db, 'timetables', 'unique_timetable');
        await setDoc(timetableDocRef, {
            data: timetableData,
            lastUpdatedBy: auth.currentUser.uid,
            lastUpdatedAt: new Date().toISOString()
        });
        alert('Orario salvato con successo!');
    } catch (e) {
        console.error("Errore salvataggio orario:", e);
        alert('Si è verificato un errore durante il salvataggio.');
    }
});

// ----------------- Modal studente -----------------
function showModal() { studentModal.style.display = ''; }
function hideModal() {
    studentModal.style.display = 'none';
    if (currentStudentDocUnsub) { currentStudentDocUnsub(); currentStudentDocUnsub = null; }
    currentStudentId = null;
}

async function openStudentModal(studentId) {
    if (!studentId) return;
    currentStudentId = studentId;
    showModal();
    if (currentStudentDocUnsub) currentStudentDocUnsub();
    currentStudentDocUnsub = onSnapshot(doc(db, 'students', studentId), snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        studentNameEl.textContent = data.name || '—';
        populateHistory(data);
    }, err => console.error('doc snapshot', err));
}

// *** NUOVA LOGICA DI ELIMINAZIONE ***
async function handleDeleteGrade(grade) {
    if (!currentStudentId || !grade) return;
    if (!confirm(`Sei sicuro di voler eliminare il voto ${grade.value} di ${grade.subject}?`)) return;
    try {
        const sref = doc(db, 'students', currentStudentId);
        await updateDoc(sref, { grades: arrayRemove(grade) });
    } catch (e) {
        console.error(e);
        alert('Errore durante l\'eliminazione del voto.');
    }
}

async function handleDeleteAbsence(absence) {
    if (!currentStudentId || !absence) return;
    if (!confirm(`Sei sicuro di voler eliminare l'assenza del ${absence.date}?`)) return;
    try {
        const sref = doc(db, 'students', currentStudentId);
        await updateDoc(sref, { absences: arrayRemove(absence) });
    } catch (e) {
        console.error(e);
        alert('Errore durante l\'eliminazione dell\'assenza.');
    }
}

function populateHistory(data) {
    gradesList.innerHTML = '';
    absencesList.innerHTML = '';
    notesList.innerHTML = '';

    const grades = data.grades || [];
    const absences = data.absences || [];
    const notes = data.notes || [];

    document.getElementById('summaryGrades').textContent = grades.length;
    document.getElementById('summaryAbsences').textContent = absences.length;
    document.getElementById('summaryNotes').textContent = notes.length;

    grades.slice().reverse().forEach(g => {
        const li = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = `${g.date || ''} — ${g.subject || ''}: ${g.value}`;
        li.appendChild(text);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Elimina';
        delBtn.className = 'delete-item-btn';
        delBtn.addEventListener('click', () => handleDeleteGrade(g));
        li.appendChild(delBtn);
        gradesList.appendChild(li);
    });

    absences.slice().reverse().forEach(a => {
        const li = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = `${a.date || ''} — ${a.reason || 'Nessun motivo'}`;
        li.appendChild(text);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Elimina';
        delBtn.className = 'delete-item-btn';
        delBtn.addEventListener('click', () => handleDeleteAbsence(a));
        li.appendChild(delBtn);
        absencesList.appendChild(li);
    });
    
    notes.slice().reverse().forEach(n => {
        const li = document.createElement('li');
        li.textContent = `${n.createdAt ? n.createdAt.slice(0, 10) : ''} — ${n.text || ''}`;
        notesList.appendChild(li);
    });
}

modalOverlay.addEventListener('click', hideModal);
closeModalBtn.addEventListener('click', hideModal);

// ----------------- Forms in modal -----------------
async function handleFormSubmit(e, form, collectionName, createObject) {
    e.preventDefault();
    if (!currentStudentId) return alert('Seleziona uno studente');
    try {
        const formData = new FormData(form);
        const obj = createObject(formData);
        const sref = doc(db, 'students', currentStudentId);
        await updateDoc(sref, { [collectionName]: arrayUnion(obj) });
        form.reset();
    } catch (err) {
        console.error(err);
        alert(`Errore salvataggio ${collectionName}`);
    }
}

gradeForm.addEventListener('submit', (e) => handleFormSubmit(e, gradeForm, 'grades', (form) => ({
    subject: form.get('subject'),
    value: Number(form.get('value')),
    date: form.get('date') || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
})));

absenceForm.addEventListener('submit', (e) => handleFormSubmit(e, absenceForm, 'absences', (form) => ({
    date: form.get('date'),
    reason: form.get('reason') || '',
    createdAt: new Date().toISOString()
})));

noteForm.addEventListener('submit', (e) => handleFormSubmit(e, noteForm, 'notes', (form) => ({
    text: form.get('text'),
    createdAt: new Date().toISOString()
})));

// ----------------- AUTH -----------------
onAuthStateChanged(auth, (user) => {
    userInfo.textContent = user ? (user.displayName || user.email) : '';
    loginBtn.style.display = user ? 'none' : '';
    logoutBtn.style.display = user ? '' : 'none';
    if (!user) {
        dashboard.style.display = 'none';
        classView.style.display = 'none';
        importSection.style.display = 'none';
        timetableSection.style.display = 'none';
    } else {
        renderDashboard();
    }
});

loginBtn.addEventListener('click', () => signInWithPopup(auth, provider).catch(e => console.error('auth error', e)));
logoutBtn.addEventListener('click', () => signOut(auth));

// ----------------- Header navigation -----------------
homeBtn.addEventListener('click', () => {
    if (currentClassQueryUnsub) { currentClassQueryUnsub(); currentClassQueryUnsub = null; }
    renderDashboard();
});
importBtnHeader.addEventListener('click', () => {
    dashboard.style.display = 'none';
    classView.style.display = 'none';
    timetableSection.style.display = 'none';
    importSection.style.display = '';
    hideModal();
});
backBtn.addEventListener('click', () => {
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
            name, school: currentSchool, classe: currentClasse,
            grades: [], absences: [], notes: [],
            createdBy: auth.currentUser.uid, createdAt: new Date().toISOString()
        });
    } catch (e) {
        console.error(e);
        alert('Errore aggiunta studente');
    }
});

// ----------------- IMPORT XLSX -----------------
let workbookGlobal = null;
xlsxInput.addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        workbookGlobal = XLSX.read(data, { type: 'array' });
        sheetSelect.innerHTML = workbookGlobal.SheetNames.map(s => `<option value="${s}">${s}</option>`).join('');
        sheetSelect.style.display = '';
        previewBtn.style.display = '';
        doImportBtn.style.display = '';
    };
    reader.readAsArrayBuffer(file);
});

previewBtn.addEventListener('click', () => {
    if (!workbookGlobal) return alert('Carica prima un file .xlsx');
    const sheet = workbookGlobal.Sheets[sheetSelect.value];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    const displayRows = hasHeaderCheckbox.checked ? rows.slice(1) : rows;
    const preview = displayRows.slice(0, 8).map(r => r?.[0] || '').join('\n');
    previewContent.textContent = preview || '(foglio vuoto o mapping errato)';
    previewArea.style.display = '';
});

doImportBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return alert('Devi autenticarti per importare dati.');
    if (!workbookGlobal) return alert('Carica prima un file .xlsx');
    
    const sheet = workbookGlobal.Sheets[sheetSelect.value];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    const dataRows = hasHeaderCheckbox.checked ? rows.slice(1) : rows;
    const [school, classeStr] = importClassSelect.value.split('-');
    const classe = Number(classeStr);
    const tryDedupe = tryDedupeCheckbox.checked;

    if (dataRows.length === 0) return alert('Foglio vuoto');
    
    let existingNames = new Set();
    if (tryDedupe) {
        const q = query(collection(db, 'students'), where('school', '==', school), where('classe', '==', classe));
        const snap = await getDocs(q);
        snap.forEach(doc => existingNames.add(doc.data().name));
    }

    const toAdd = [];
    const skipped = [];

    for (const r of dataRows) {
        const name = String(r?.[0] || '').trim();
        if (!name) continue;

        if (tryDedupe && existingNames.has(name)) {
            skipped.push({ name, reason: 'duplicato' });
            continue;
        }

        try {
            await addDoc(collection(db, 'students'), {
                name, school, classe, grades: [], absences: [], notes: [],
                createdBy: auth.currentUser.uid, createdAt: new Date().toISOString()
            });
            toAdd.push(name);
        } catch (e) {
            console.error('Import error for', name, e);
            skipped.push({ name, reason: 'errore' });
        }
    }

    alert(`Import completato. Aggiunti: ${toAdd.length}. Saltati: ${skipped.length}.`);
    xlsxInput.value = '';
    sheetSelect.style.display = 'none';
    previewArea.style.display = 'none';
    previewBtn.style.display = 'none';
    doImportBtn.style.display = 'none';
});
