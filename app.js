// app.js (modulo) - Versione completa con appunti di classe
// Integrato con Supabase anziché Firebase

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/dist/index.min.js';
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

// ================= CONFIG SUPABASE (sostituisci con le tue chiavi) =================
const supabaseUrl = 'https://yctzagencamqoaipbjma.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdHphZ2VuY2FtcW9haXBiam1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMTcyNzgsImV4cCI6MjA3MzU5MzI3OH0.2_IlqF854MqXTTRcM7hvUMkoIscqPQj4DGzxugdqMDw';

const supabase = createClient(supabaseUrl, supabaseKey);

// NOTA: Ho mantenuto la libreria di analytics di Firebase in quanto non ha dipendenze dirette con Firestore o Auth.

// ================= Riferimenti UI (rimangono uguali) =================
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
const studentSearchInput = document.getElementById('studentSearch');
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
const classNoteForm = document.getElementById('classNoteForm');
const classNotesList = document.getElementById('classNotesList');

// ================= Stato =================
let currentSchool = null;
let currentClass = null;
let currentClassSubscription = null;
let currentStudentSubscription = null;
let currentStudentId = null;
let allStudentsInClass = [];

const classesForTimetable = [
    { school: 'scientifico', classe: 1, label: '1 Scientifico' },
    { school: 'scientifico', classe: 2, label: '2 Scientifico' },
    { school: 'scientifico', classe: 3, label: '3 Scientifico' },
    { school: 'scientifico', classe: 4, label: '4 Scientifico' },
    { school: 'scientifico', classe: 5, label: '5 Scientifico' },
    { school: 'linguistico', classe: 1, label: '1 Linguistico' },
    { school: 'linguistico', classe: 2, label: '2 Linguistico' },
    { school: 'linguistico', classe: 3, label: '3 Linguistico' },
    { school: 'linguistico', classe: 4, label: '4 Linguistico' },
    { school: 'linguistico', classe: 5, label: '5 Linguistico' },
    { school: 'comune', classe: 4, label: '4 (Comune)' }
];

// ================= Funzioni UI =================
function renderDashboard() {
    dashboard.style.display = '';
    classView.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = 'none';
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
    if (currentClassSubscription) currentClassSubscription.unsubscribe();

    currentSchool = school;
    currentClass = classe;
    dashboard.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = 'none';
    classView.style.display = '';
    classTitle.textContent = `${school[0].toUpperCase() + school.slice(1)} – Classe ${classe}`;

    // === Legge in tempo reale la tabella 'students' da Supabase ===
    const studentsSubscription = supabase
        .from('students')
        .select('*')
        .eq('school', school)
        .eq('classe', classe)
        .order('name')
        .on('UPDATE', payload => {
            const index = allStudentsInClass.findIndex(s => s.id === payload.new.id);
            if (index !== -1) {
                allStudentsInClass[index] = payload.new;
                renderStudentsTable(allStudentsInClass);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('school', school)
                    .eq('classe', classe)
                    .order('name');
                if (error) {
                    console.error('Errore caricamento studenti:', error);
                } else {
                    allStudentsInClass = data;
                    renderStudentsTable(allStudentsInClass);
                }
            }
        });
    currentClassSubscription = studentsSubscription;
    
    // === Legge in tempo reale gli appunti di classe da Supabase ===
    const classNotesSubscription = supabase
        .from('class_notes') // Ho cambiato il nome della tabella a 'class_notes'
        .select('notes')
        .eq('school', school)
        .eq('classe', classe)
        .single()
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { data, error } = await supabase
                    .from('class_notes')
                    .select('notes')
                    .eq('school', school)
                    .eq('classe', classe)
                    .single();
                if (error) {
                    console.error('Errore caricamento appunti di classe:', error);
                    renderClassNotes([]);
                } else {
                    renderClassNotes(data ? data.notes : []);
                }
            }
        });
}

function renderStudentsTable(students) {
    studentsTableBody.innerHTML = '';
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    students.forEach((s, index) => {
        const tr = document.createElement('tr');
        const tdIndex = document.createElement('td');
        tdIndex.textContent = index + 1;
        tr.appendChild(tdIndex);
        const tdName = document.createElement('td');
        tdName.textContent = s.name || '';
        tr.appendChild(tdName);
        const tdGrades = document.createElement('td');
        const gradesBtn = document.createElement('button');
        gradesBtn.className = 'btn';
        gradesBtn.style.padding = '6px 8px';
        gradesBtn.textContent = `Voti (${(s.grades || []).length})`;
        gradesBtn.addEventListener('click', () => openStudentModal(s.id, 'grades'));
        tdGrades.appendChild(gradesBtn);
        tr.appendChild(tdGrades);
        const tdAbs = document.createElement('td');
        const absencesBtn = document.createElement('button');
        absencesBtn.className = 'btn';
        absencesBtn.style.padding = '6px 8px';
        absencesBtn.textContent = `Assenze (${(s.absences || []).length})`;
        absencesBtn.addEventListener('click', () => openStudentModal(s.id, ('absences')));
        tdAbs.appendChild(absencesBtn);
        tr.appendChild(tdAbs);
        const tdActions = document.createElement('td');
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'btn';
        detailsBtn.style.padding = '6px 8px';
        detailsBtn.textContent = 'Dettagli';
        detailsBtn.addEventListener('click', () => openStudentModal(s.id));
        tdActions.appendChild(detailsBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'btn';
        delBtn.textContent = 'Elimina';
        delBtn.addEventListener('click', async () => {
            if (!confirm(`Elimina ${s.name}?`)) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return alert('Devi essere autenticato per eliminare.');
            try {
                await supabase.from('students').delete().eq('id', s.id);
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

// ================= Gestione Appunti di Classe =================

function renderClassNotes(notes) {
    classNotesList.innerHTML = '';
    if (notes) {
        notes.slice().reverse().forEach(note => {
            const li = document.createElement('li');
            const date = note.created_at ? new Date(note.created_at).toLocaleDateString('it-IT') : '';
            li.textContent = `${date} - ${note.text}`;
            classNotesList.appendChild(li);
        });
    }
}

classNoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !currentSchool || !currentClass) {
        alert('Devi essere autenticato e aver selezionato una classe.');
        return;
    }
    const formData = new FormData(classNoteForm);
    const noteText = formData.get('noteText');
    const { data: existingNotes, error } = await supabase
        .from('class_notes')
        .select('notes')
        .eq('school', currentSchool)
        .eq('classe', currentClass)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 significa "not found"
        console.error("Errore recupero nota di classe:", error);
        alert("Errore durante il salvataggio dell'appunto.");
        return;
    }

    try {
        const newNote = {
            text: noteText,
            created_at: new Date().toISOString()
        };
        if (existingNotes) {
            await supabase
                .from('class_notes')
                .update({ notes: [...existingNotes.notes, newNote] })
                .eq('school', currentSchool)
                .eq('classe', currentClass);
        } else {
            await supabase
                .from('class_notes')
                .insert([{
                    school: currentSchool,
                    classe: currentClass,
                    notes: [newNote],
                    user_id: session.user.id
                }]);
        }
        classNoteForm.reset();
    } catch (e) {
        console.error("Errore salvataggio nota di classe:", e);
        alert("Errore durante il salvataggio dell'appunto.");
    }
});

// ================= Funzioni per la tabella orario =================
const dayMappings = ['Lunedì', 'Martedì', 'Mercoledì', "Giovedì", "Venerdì"];
const hours = ['I', "II", "III", 'IV', 'V', 'VI', 'VII'];

function openTimetable() {
    dashboard.style.display = 'none';
    classView.style.display = 'none';
    importSection.style.display = 'none';
    timetableSection.style.display = '';
    loadTimetable();
}

async function loadTimetable() {
    timetableTable.querySelector('tbody').innerHTML = '';
    const { data: timetableData, error } = await supabase
        .from('timetables')
        .select('data')
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Errore caricamento orario:', error);
    }

    const data = timetableData ? timetableData.data : null;
    hours.forEach((hour) => {
        const tr = document.createElement('tr');
        const tdHour = document.createElement('td');
        tdHour.textContent = hour;
        tr.appendChild(tdHour);

        dayMappings.forEach((day) => {
            const td = document.createElement('td');
            const lesson = data?.find(item => item.hour === hour)?.[day] || '';
            td.textContent = lesson;
            tr.appendChild(td);
        });
        timetableTable.querySelector('tbody').appendChild(tr);
    });
}

showTimetableBtn.addEventListener('click', () => {
    openTimetable();
});

editTimetableBtn.addEventListener('click', () => {
    editTimetableBtn.style.display = 'none';
    saveTimetableBtn.style.display = '';
    const cells = timetableTable.querySelectorAll('tbody td');
    cells.forEach(cell => {
        if (cell.cellIndex > 0) {
            const currentContent = cell.textContent.trim();
            cell.innerHTML = '';
            const select = document.createElement('select');
            select.className = 'timetable-select';
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '';
            select.appendChild(emptyOption);
            const availableOption = document.createElement('option');
            availableOption.value = 'Disponibile';
            availableOption.textContent = 'Disponibile';
            select.appendChild(availableOption);
            classesForTimetable.forEach(c => {
                const option = document.createElement('option');
                option.value = c.label;
                option.textContent = c.label;
                select.appendChild(option);
            });
            if (currentContent) {
                select.value = currentContent;
            }
            cell.appendChild(select);
        }
    });
});

saveTimetableBtn.addEventListener('click', async () => {
    saveTimetableBtn.style.display = 'none';
    editTimetableBtn.style.display = '';
    const rows = timetableTable.querySelectorAll('tbody tr');
    const timetableData = [];
    rows.forEach(row => {
        const hour = row.querySelector('td:first-child').textContent;
        const rowData = { hour };
        const cells = row.querySelectorAll('td:not(:first-child)');
        cells.forEach((cell, index) => {
            const select = cell.querySelector('select');
            const lesson = select ? select.value : cell.textContent.trim();
            rowData[dayMappings[index]] = lesson;
            cell.textContent = lesson;
        });
        timetableData.push(rowData);
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Devi essere autenticato per salvare l\'orario.');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('timetables')
            .upsert({ data: timetableData, last_updated_by: session.user.id, last_updated_at: new Date().toISOString() })
            .eq('id', 'unique_timetable'); // Assumo che tu abbia un ID univoco per il documento
        
        if (error) throw error;
        
        alert('Orario salvato con successo!');
    } catch (e) {
        console.error("Errore salvataggio orario:", e);
        alert('Si è verificato un errore durante il salvataggio.');
    }
});

// ================= Modal studente =================
function showModal(initialTab = null) { studentModal.style.display = ''; }
function hideModal() {
    studentModal.style.display = 'none';
    studentNameEl.textContent = '';
    gradesList.innerHTML = '';
    absencesList.innerHTML = '';
    notesList.innerHTML = '';
    if (currentStudentSubscription) {
        currentStudentSubscription.unsubscribe();
        currentStudentSubscription = null;
    }
    currentStudentId = null;
}

async function openStudentModal(studentId, initialTab = 'all') {
    if (!studentId) return;
    currentStudentId = studentId;
    showModal(initialTab);

    if (currentStudentSubscription) currentStudentSubscription.unsubscribe();

    currentStudentSubscription = supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('id', studentId)
                    .single();
                if (error) {
                    console.error('Errore caricamento studente:', error);
                } else {
                    studentNameEl.textContent = data.name || '';
                    populateHistory(data);
                }
            }
        });
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
        li.textContent = `${g.date || ''} – ${g.subject || '-'}: ${g.value}`;
        gradesList.appendChild(li);
    });
    absences.slice().reverse().forEach(a => {
        const li = document.createElement('li');
        li.textContent = `${a.date || ''} – ${a.reason || ''}`;
        absencesList.appendChild(li);
    });
    notes.slice().reverse().forEach(n => {
        const li = document.createElement('li');
        li.textContent = `${n.created_at ? n.created_at.slice(0, 10) : ''} – ${n.text || ''}`;
        notesList.appendChild(li);
    });
}

modalOverlay.addEventListener('click', hideModal);
closeModalBtn.addEventListener('click', hideModal);

// ================= Logica di ricerca =================
studentSearchInput.addEventListener('input', () => {
    const searchTerm = studentSearchInput.value.toLowerCase();
    const filteredStudents = allStudentsInClass.filter(student =>
        student.name && student.name.toLowerCase().includes(searchTerm)
    );
    renderStudentsTable(filteredStudents);
});

// ================= Forms in modal =================
gradeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentStudentId) return alert('Seleziona uno studente');
    const form = new FormData(gradeForm);
    const subject = form.get('subject');
    const value = Number(form.get('value'));
    const date = form.get('date') || new Date().toISOString().slice(0, 10);
    const gradeObj = { subject, value, date, created_at: new Date().toISOString() };
    try {
        await supabase
            .from('students')
            .update({ grades: supabase.functions.rpc('array_append', { array: 'grades', value: gradeObj }) })
            .eq('id', currentStudentId);
        gradeForm.reset();
    } catch (e) {
        console.error(e);
        alert('Errore salvataggio voto');
    }
});

absenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentStudentId) return alert('Seleziona uno studente');
    const form = new FormData(absenceForm);
    const date = form.get('date');
    const reason = form.get('reason') || '';
    const obj = { date, reason, created_at: new Date().toISOString() };
    try {
        await supabase
            .from('students')
            .update({ absences: supabase.functions.rpc('array_append', { array: 'absences', value: obj }) })
            .eq('id', currentStudentId);
        absenceForm.reset();
    } catch (e) {
        console.error(e);
        alert('Errore salvataggio assenza');
    }
});

noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentStudentId) return alert('Seleziona uno studente');
    const form = new FormData(noteForm);
    const text = form.get('text');
    const obj = { text, created_at: new Date().toISOString() };
    try {
        await supabase
            .from('students')
            .update({ notes: supabase.functions.rpc('array_append', { array: 'notes', value: obj }) })
            .eq('id', currentStudentId);
        noteForm.reset();
    } catch (e) {
        console.error(e);
        alert('Errore salvataggio nota');
    }
});

// ================= AUTENTICAZIONE =================
loginBtn.addEventListener('click', async () => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) throw error;
    } catch (e) {
        console.error('auth error', e);
        alert('Errore durante il login: ' + (e.message || e));
    }
});

logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Errore logout:', error);
});

supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        userInfo.textContent = session.user.user_metadata.name || session.user.email;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = '';
        renderDashboard();
    } else {
        userInfo.textContent = '';
        loginBtn.style.display = '';
        logoutBtn.style.display = 'none';
        dashboard.style.display = 'none';
        classView.style.display = 'none';
        importSection.style.display = 'none';
        timetableSection.style.display = 'none';
    }
});

// ================= Header navigation =================
homeBtn.addEventListener('click', () => {
    if (currentClassSubscription) {
        currentClassSubscription.unsubscribe();
        currentClassSubscription = null;
    }
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
    if (currentClassSubscription) {
        currentClassSubscription.unsubscribe();
        currentClassSubscription = null;
    }
    renderDashboard();
});

// ================= Aggiungi studente manuale =================
addStudentBtn.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('Devi autenticarti per aggiungere studenti.');
    const name = prompt('Nome completo alunno:');
    if (!name) return;
    try {
        const { error } = await supabase
            .from('students')
            .insert([{
                name,
                school: currentSchool,
                classe: currentClass,
                grades: [],
                absences: [],
                notes: [],
                user_id: session.user.id,
                created_at: new Date().toISOString()
            }]);
        if (error) throw error;
    } catch (e) {
        console.error(e);
        alert('Errore aggiunta studente');
    }
});

// ================= IMPORT XLSX (prima colonna) =================
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
        wb.SheetNames.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
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
    const preview = displayRows.slice(0, 8).map(r => (r && r[0]) ? String(r[0]).trim() : '').join('\n');
    previewContent.textContent = preview || '(foglio vuoto o mapping errato)';
    previewArea.style.display = '';
});

doImportBtn.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('Devi autenticarti (Google) per importare dati.');
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
    
    for (const x of dataRows) {
        const name = (x && x[0]) ? String(x[0]).trim() : null;
        if (!name) continue;
        
        let exists = false;
        if (tryDedupe) {
            const { data: existingStudents, error } = await supabase
                .from('students')
                .select('*')
                .eq('school', school)
                .eq('classe', classe)
                .eq('name', name);
            if (error) console.error('Errore dedupe:', error);
            if (existingStudents && existingStudents.length > 0) exists = true;
        }
        
        if (exists) {
            skipped.push({ name, reason: 'duplicato' });
            continue;
        }
        
        try {
            const { error } = await supabase
                .from('students')
                .insert([{
                    name,
                    school,
                    classe,
                    grades: [],
                    absences: [],
                    notes: [],
                    user_id: session.user.id,
                    created_at: new Date().toISOString()
                }]);
            
            if (error) throw error;
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
