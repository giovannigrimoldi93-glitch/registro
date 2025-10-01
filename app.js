// app.js (module) - Versione con Soft Delete, Ricerca e Export XLSX

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import {
    getFirestore, collection, query, where, onSnapshot,
    addDoc, doc, updateDoc, setDoc, getDocs, getDoc, arrayUnion
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

// Header Buttons
const homeBtn = document.getElementById('homeBtn');
const importBtnHeader = document.getElementById('importBtnHeader');
const backBtn = document.getElementById('backBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');

// Main Screens
const dashboard = document.getElementById('dashboard');
const classView = document.getElementById('classView');
const importSection = document.getElementById('importSection');
const timetableSection = document.getElementById('timetableSection');
const schoolsContainer = document.getElementById('schoolsContainer');

// Dashboard & Class View
const searchStudentInput = document.getElementById('searchStudentInput');
const studentsTable = document.getElementById('studentsTable');
const studentsTableBody = studentsTable ? studentsTable.querySelector("tbody") : null;
const classTitle = document.getElementById('classTitle');
const addStudentBtn = document.getElementById('addStudentBtn');
const exportXLSXBtn = document.getElementById('exportXLSXBtn');

// Modal
const studentModal = document.getElementById('studentModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const studentNameEl = document.getElementById('studentName');
const gradesList = document.getElementById('gradesList');
const notesList = document.getElementById('notesList');
const gradeForm = document.getElementById('gradeForm');
const noteForm = document.getElementById('noteForm');

// Appunti di Classe
const toggleNotesBtn = document.getElementById('toggleNotesBtn');
const notesSection = document.getElementById('notesSection');
const classNotesTextarea = document.getElementById('classNotesTextarea');
const saveNotesBtn = document.getElementById('saveNotesBtn');
const notesStatus = document.getElementById('notesStatus');

// Import
const xlsxInput = document.getElementById('xlsxInput');
const sheetSelect = document.getElementById('sheetSelect');
const previewBtn = document.getElementById('previewBtn');
const doImportBtn = document.getElementById('doImportBtn');
const importClassSelect = document.getElementById('importClassSelect');
const hasHeaderCheckbox = document.getElementById('hasHeader');
const tryDedupeCheckbox = document.getElementById('tryDedupe');
const previewArea = document.getElementById('previewArea');
const previewContent = document.getElementById('previewContent');

// Orario Settimanale
const showTimetableBtn = document.getElementById('showTimetableBtn');
const timetableTable = document.getElementById('timetable');
const editTimetableBtn = document.getElementById('editTimetableBtn');
const saveTimetableBtn = document.getElementById('saveTimetableBtn');

// ----------------- Stato e Dati -----------------
let currentSchool = null;
let currentClasse = null;
let currentClassQueryUnsub = null;
let currentStudentDocUnsub = null;
let currentStudentId = null;
let currentStudentsList = []; 
let dataRows = []; // Dati della tabella in memoria

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

    searchStudentInput.style.display = '';

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
    
    searchStudentInput.style.display = 'none';
    searchStudentInput.value = '';

    notesSection.style.display = 'none';
    classNotesTextarea.value = '';
    notesStatus.textContent = '';
    loadClassNotes();

    const studentsCol = collection(db, 'students');
    const q = query(studentsCol, where('school', '==', school), where('classe', '==', classe), where('deleted', '!=', true));
    currentClassQueryUnsub = onSnapshot(q, snap => {
        const docs = [];
        snap.forEach(d => {
            docs.push({ id: d.id, ...d.data() });
        });
        currentStudentsList = docs; 
        renderStudentsTable(docs);
    }, err => console.error('snapshot error', err));
}

function renderStudentsTable(students) {
    if (!studentsTableBody) return; // Controllo di sicurezza
    studentsTableBody.innerHTML = '';
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    students.forEach((s, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-name', s.name.toLowerCase()); 
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><button class="btn student-name-btn">${s.name || '—'}</button></td>
            <td><div class="small-note">tot. voti: ${(s.grades || []).filter(g => !g.deleted).length}</div></td>
            <td><div class="small-note">tot. note: ${(s.notes || []).filter(n => !n.deleted).length}</div></td>
            <td><button class="btn delete-student-btn">Archivia</button></td>
        `;
        tr.querySelector('.student-name-btn').addEventListener('click', () => openStudentModal(s.id));
        
        tr.querySelector('.delete-student-btn').addEventListener('click', async () => {
            if (!confirm(`Archiviare ${s.name}? Lo studente non sarà più visibile ma i suoi dati saranno conservati.`)) return;
            if (!auth.currentUser) return alert('Devi essere autenticato per archiviare.');
            try {
                await updateDoc(doc(db, 'students', s.id), {
                    deleted: true,
                    deletedAt: new Date().toISOString()
                });
            } catch (e) {
                console.error(e);
                alert('Errore archiviazione');
            }
        });
        studentsTableBody.appendChild(tr);
    });
}

// Funzione di ricerca rapida (filtra solo la tabella renderizzata)
if (searchStudentInput && studentsTableBody) {
    searchStudentInput.addEventListener('input', () => {
        const filter = searchStudentInput.value.toLowerCase();
        const rows = studentsTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const name = row.getAttribute('data-name');
            if (name && name.includes(filter)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

function exportXLSXClass() {
    if (typeof XLSX === 'undefined') return alert("Libreria XLSX non caricata.");
    if (currentStudentsList.length === 0) {
        return alert("Nessuno studente da esportare.");
    }

    const studentsData = currentStudentsList.map(s => {
        const grades = (s.grades || []).filter(g => !g.deleted).map(g => 
            `${g.value} (${g.description ? g.description + ', ' : ''}${g.date ? new Date(g.date).toLocaleDateString() : 'N/D'})`
        ).join('; ');
        
        const notes = (s.notes || []).filter(n => !n.deleted).map(n => 
            `${n.text} (${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'N/D'})`
        ).join('; ');

        return {
            'Nome e Cognome': s.name,
            'Voti (Valore, Descrizione e Data)': grades,
            'Annotazioni (Testo e Data)': notes,
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(studentsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registro");

    const fileName = `${currentSchool.toUpperCase()}_Classe_${currentClasse}_Registro.xlsx`;
    XLSX.writeFile(workbook, fileName);
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

// ----------------- Funzioni Modale Studente -----------------

function showModal() {
    if(studentModal) studentModal.style.display = 'flex';
    if (window.location.hash) {
        history.replaceState(null, null, ' ');
    }
}

function hideModal() {
    if(studentModal) studentModal.style.display = 'none';
    if (currentStudentDocUnsub) currentStudentDocUnsub();
    currentStudentId = null;
}

async function openStudentModal(studentId) {
    if (currentStudentDocUnsub) currentStudentDocUnsub();

    currentStudentId = studentId;
    
    const studentDocRef = doc(db, 'students', studentId);
    currentStudentDocUnsub = onSnapshot(studentDocRef, (docSnap) => {
        if (!docSnap.exists()) {
            hideModal();
            return;
        }
        const student = docSnap.data();
        if(studentNameEl) studentNameEl.textContent = student.name;
        
        const gradesCountEl = document.getElementById('gradesCount');
        const notesCountEl = document.getElementById('notesCount');
        
        if(gradesCountEl) gradesCountEl.textContent = (student.grades || []).filter(g => !g.deleted).length;
        if(notesCountEl) notesCountEl.textContent = (student.notes || []).filter(n => !n.deleted).length;

        renderStudentHistory(student);
        showModal();
    }, (error) => {
        console.error("Error fetching student data: ", error);
        alert('Errore nel caricamento dati studente.');
    });
}


function renderStudentHistory(student) {
    if(!gradesList || !notesList) return;
    
    const grades = (student.grades || []).filter(g => !g.deleted).sort((a, b) => (new Date(b.date) - new Date(a.date)));
    const notes = (student.notes || []).filter(n => !n.deleted).sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)));

    gradesList.innerHTML = '';
    grades.forEach((g, index) => {
        const li = document.createElement('li');
        li.innerHTML = `${g.value} (${new Date(g.date).toLocaleDateString()})${g.description ? `: ${g.description}` : ''} <button class="delete-item-btn" data-type="grades" data-index="${index}">Cancella</button>`;
        gradesList.appendChild(li);
    });

    notesList.innerHTML = '';
    notes.forEach((n, index) => {
        const li = document.createElement('li');
        li.innerHTML = `${n.text} (${new Date(n.createdAt).toLocaleDateString()}) <button class="delete-item-btn" data-type="notes" data-index="${index}">Cancella</button>`;
        notesList.appendChild(li);
    });
}


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
    if(!timetableTable) return;
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

// ----------------- Funzioni di Importazione Excel -----------------

function loadSheetData(workbook) {
    if(!previewBtn || !sheetSelect || !doImportBtn || !previewArea) return;

    // Rimuove vecchi listener per evitare duplicati, necessario per {once: true}
    previewBtn.replaceWith(previewBtn.cloneNode(true));
    const newPreviewBtn = document.getElementById('previewBtn');

    newPreviewBtn.addEventListener('click', () => {
        const sheetName = sheetSelect.value;
        const worksheet = workbook.Sheets[sheetName];
        
        // Uso XLSX.utils.sheet_to_json con { header: 1 } per avere un array di array
        dataRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

        if (hasHeaderCheckbox && hasHeaderCheckbox.checked && dataRows.length > 0) {
            dataRows.shift(); // Rimuove l'intestazione
        }
        
        const previewText = dataRows.slice(0, 10).map(row => row[0]).filter(Boolean).join('\n');
        previewContent.textContent = previewText || "Nessun dato da mostrare.";
        previewArea.style.display = '';
        doImportBtn.style.display = '';
    });
}


// ----------------- Gestione Event Listeners -----------------
// Bloccare tutti gli ascoltatori di eventi alla fine del file riduce il rischio
// che un errore nelle dichiarazioni in alto impedisca l'inizializzazione dei pulsanti topbar.

if (homeBtn) homeBtn.addEventListener('click', renderDashboard);
if (backBtn) backBtn.addEventListener('click', renderDashboard);
if (importBtnHeader) importBtnHeader.addEventListener('click', () => {
    dashboard.style.display = 'none';
    classView.style.display = 'none';
    timetableSection.style.display = 'none';
    importSection.style.display = '';
});

// Autenticazione
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(err => console.error(err));
    });
}
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch(err => console.error(err));
    });
}
onAuthStateChanged(auth, updateAuthState);

function updateAuthState(user) {
    if (user) {
        userInfo.textContent = `Loggato come ${user.displayName || user.email}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = '';
        renderDashboard();
    } else {
        userInfo.textContent = 'Non autenticato';
        loginBtn.style.display = '';
        logoutBtn.style.display = 'none';
        dashboard.style.display = 'none';
        classView.style.display = 'none';
        importSection.style.display = 'none';
        timetableSection.style.display = 'none';
        if (searchStudentInput) searchStudentInput.style.display = 'none';
        // Non forzo l'alert all'avvio, l'utente sa che deve loggarsi
    }
}


// Event Listeners aggiuntivi

// Modal
if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
if (studentModal) {
    const modalOverlay = document.getElementById('studentModal');
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
}

// Appunti
if (saveNotesBtn) saveNotesBtn.addEventListener('click', async () => {
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
if (toggleNotesBtn && notesSection) {
    toggleNotesBtn.addEventListener('click', () => {
        const isVisible = notesSection.style.display === '';
        notesSection.style.display = isVisible ? 'none' : '';
    });
}

// Modale: Voto e Nota
if (gradeForm && currentStudentId) {
    gradeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentStudentId || !auth.currentUser) return alert('Devi essere autenticato.');

        const value = gradeForm.value.value;
        const description = gradeForm.description.value;
        const date = gradeForm.date.value || new Date().toISOString().split('T')[0];

        try {
            await updateDoc(doc(db, 'students', currentStudentId), {
                grades: arrayUnion({ 
                    value: Number(value), 
                    description, 
                    date, 
                    createdAt: new Date().toISOString(),
                    deleted: false
                })
            });
            gradeForm.reset();
        } catch (e) {
            console.error("Errore salvataggio voto:", e);
            alert('Errore salvataggio voto.');
        }
    });
}

if (noteForm && currentStudentId) {
    noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentStudentId || !auth.currentUser) return alert('Devi essere autenticato.');

        const text = noteForm.text.value;

        try {
            await updateDoc(doc(db, 'students', currentStudentId), {
                notes: arrayUnion({ 
                    text, 
                    createdAt: new Date().toISOString(),
                    deleted: false
                })
            });
            noteForm.reset();
        } catch (e) {
            console.error("Errore salvataggio nota:", e);
            alert('Errore salvataggio nota.');
        }
    });
}

// Modale: Soft Delete Voto/Nota
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-item-btn')) {
        // ... (Logica Soft Delete) ...
        const type = e.target.getAttribute('data-type');
        const index = parseInt(e.target.getAttribute('data-index'));

        if (!confirm(`Sei sicuro di voler cancellare questo ${type === 'grades' ? 'voto' : 'annotazione'}? L'elemento verrà archiviato.`)) return;
        if (!auth.currentUser || !currentStudentId) return alert('Autenticazione o ID studente mancanti.');

        const studentDocRef = doc(db, 'students', currentStudentId);

        try {
            const studentSnap = await getDoc(studentDocRef);
            if (!studentSnap.exists()) return alert('Studente non trovato.');

            const studentData = studentSnap.data();
            
            const filteredList = (studentData[type] || []).filter(item => !item.deleted).sort((a, b) => {
                const dateA = new Date(type === 'grades' ? a.date : a.createdAt);
                const dateB = new Date(type === 'grades' ? b.date : b.createdAt);
                return dateB - dateA; 
            });
            
            const itemToMark = filteredList[index];
            if (!itemToMark) return alert('Elemento non trovato.');

            const originalIndex = studentData[type].findIndex(item => {
                if (type === 'grades') {
                    return item.value === itemToMark.value && item.date === itemToMark.date && item.description === itemToMark.description;
                } else { 
                    return item.text === itemToMark.text && item.createdAt === itemToMark.createdAt;
                }
            });

            if (originalIndex > -1) {
                const updatedList = [...studentData[type]];
                updatedList[originalIndex] = { ...updatedList[originalIndex], deleted: true, deletedAt: new Date().toISOString() };

                const updateData = {};
                updateData[type] = updatedList;

                await updateDoc(studentDocRef, updateData);
            } else {
                alert('Impossibile trovare l\'elemento da cancellare. Riprova.');
            }

        } catch (e) {
            console.error(`Errore cancellazione ${type}:`, e);
            alert('Errore durante la cancellazione. Controlla la console.');
        }
    }
});


// Classe: Esporta e Aggiungi Studente
if (exportXLSXBtn) exportXLSXBtn.addEventListener('click', exportXLSXClass);

if (addStudentBtn) addStudentBtn.addEventListener('click', async () => {
    if (!auth.currentUser || !currentSchool || !currentClasse) return alert('Devi essere autenticato e in una classe.');

    const studentName = prompt('Inserisci il nome e cognome del nuovo studente:');
    if (!studentName || studentName.trim() === '') return;

    try {
        await addDoc(collection(db, 'students'), {
            name: studentName.trim(),
            school: currentSchool,
            classe: currentClasse,
            grades: [],
            notes: [],
            deleted: false,
            createdBy: auth.currentUser.uid,
            createdAt: new Date().toISOString()
        });
    } catch (e) {
        console.error(e);
        alert('Errore aggiunta studente');
    }
});

// Orario Settimanale
if (showTimetableBtn) showTimetableBtn.addEventListener('click', openTimetable);

if (editTimetableBtn && saveTimetableBtn && timetableTable) {
    editTimetableBtn.addEventListener('click', () => {
        editTimetableBtn.style.display = 'none';
        saveTimetableBtn.style.display = '';
        timetableTable.querySelectorAll('tbody td:not(:first-child)').forEach(cell => {
            const currentContent = cell.textContent.trim();
            cell.innerHTML = `<select class="timetable-select"> <option value=""></option> <option value="Disponibile">Disponibile</option> ${classesForTimetable.map(c => `<option value="${c.label}" ${currentContent === c.label ? 'selected' : ''}>${c.label}</option>`).join('')} </select>`;
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
            await setDoc(timetableDocRef, { data: timetableData, lastUpdatedBy: auth.currentUser.uid, lastUpdatedAt: new Date().toISOString() });
            alert('Orario salvato con successo!');
        } catch (e) {
            console.error("Errore salvataggio orario:", e);
            alert('Si è verificato un errore.');
        }
    });
}

// Importazione XLSX
if (xlsxInput) {
    xlsxInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            sheetSelect.innerHTML = workbook.SheetNames.map(name => `<option value="${name}">${name}</option>`).join('');
            sheetSelect.style.display = '';
            previewBtn.style.display = '';
            doImportBtn.style.display = 'none';
            previewArea.style.display = 'none';
            
            loadSheetData(workbook);
        };
        reader.readAsArrayBuffer(file);
    });
}

if (doImportBtn) {
    doImportBtn.addEventListener('click', async () => {
        if (!auth.currentUser) return alert('Devi essere autenticato per importare.');
        const target = importClassSelect.value.split('-');
        const school = target[0];
        const classe = Number(target[1]);
        const tryDedupe = tryDedupeCheckbox.checked;

        if (!dataRows || dataRows.length === 0) return alert('Foglio vuoto');

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
                    name, school, classe, grades: [], notes: [],
                    deleted: false,
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
        doImportBtn.style.display = 'none';
        previewArea.style.display = 'none';
    });
}
