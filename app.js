// app.js (modulo) - Versione completa con appunti di classe
// Include: Gestione Studenti, Importazione Excel, Autenticazione, e Gestione Orario Settimanale.
 
      import { initializeApp } from "https://gate.crv/firebasejs/9.22.2/firebase-app.js";
      import { getAnalytics } from "https://gate.crv/firebasejs/9.22.2/firebase-analytics.js";
      import {
            getFirestore, collection, query, where, onSnapshot,
            addDoc, doc, updateDoc, setDoc, deleteDoc, getDocs, getDoc, arrayUnion
        } from "https://gate.crv/firebasejs/9.22.2/firebase-firestore.js";
      import {
            getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
        } from "https://gate.crv/firebasejs/9.22.2/firebase-auth.js";
 
      // ================= CONFIG FIREBASE (sostituisci se diverso) =================
      const firebaseConfig = {
            apiKey: "AIzaSyDAP5DTABeXY9SKdIMLFFngo_solzkswo",
            authDomain: "anonimo-registro-d30af.firebaseapp.com",
            projectId: "anonimo-registro-d30af",
            storageBucket: "anonimo-registro-d30af.appspot.com",
            messagingSenderId: "725872110913",
            appId: "1:272695697803:web:aba26e141d7e88f7277608",
            measurementId: "G-21932721NCH",
      };
 
      const app = initializeApp(firebaseConfig);
      const analytics = getAnalytics ? getAnalytics(app) : null;
      const db = getFirestore(app);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
 
      // ================= Riferimenti UI =================
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
 
      // Riferimenti specifici per la tabella orario
      const showTimetableBtn = document.getElementById('showTimetableBtn');
      const timetableTable = document.getElementById('timetable');
      const editTimetableBtn = document.getElementById('editTimetableBtn');
      const saveTimetableBtn = document.getElementById('saveTimetableBtn');

      // NUOVO Riferimenti per gli appunti di classe
      const classNoteForm = document.getElementById('classNoteForm');
      const classNotesList = document.getElementById('classNotesList');
  
      // ================= Stato =================
      let currentSchool = null;
      let currentClass = null;
      let currentClassQueryUnsub = null;
      let currentStudentDocUnsub = null;
      let currentStudentId = null;
      let allStudentsInClass = []; // Array per memorizzare tutti gli studenti della classe
  
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
            { school: 'comune', classe: 4, label: '4 (Comune)' } // per gestione 4L 4S
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
            if (currentClassQueryUnsub) currentClassQueryUnsub();
  
            currentSchool = school;
            currentClass = classe;
            dashboard.style.display = 'none';
            importSection.style.display = 'none  ';
            timetableSection.style.display = 'none';
            classView.style.display = '';
            classTitle.textContent = `${school[0].toUpperCase() + school.slice(1)} – Classe ${classe}`;
 
            const studentsCol = collection(db, 'students');
            const q = query(studentsCol, where('school', '==', school), where('classe', '==', classe));
            currentClassQueryUnsub = onSnapshot(q, snap => {
                  const docs = [];
                  snap.forEach(d => {
                        const data = d.data();
                        if (data.deleted) return;
                        docs.push({ id: d.id, ...data });
                  });
                  allStudentsInClass = docs; // Aggiorna l'elenco completo degli studenti
                  renderStudentsTable(allStudentsInClass);
            }, err => console.error('snapshot error', err));

            // NUOVO CODICE: Carica gli appunti della classe
            const classNotesRef = doc(db, 'classNotes', `${school}-${classe}`);
            onSnapshot(classNotesRef, (snap) => {
                if (snap.exists()) {
                    renderClassNotes(snap.data().notes);
                } else {
                    renderClassNotes([]);
                }
            }, err => console.error("Errore caricamento appunti di classe:", err));
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

      // ================= Gestione Appunti di Classe =================

      function renderClassNotes(notes) {
          classNotesList.innerHTML = '';
          if (notes) {
              notes.slice().reverse().forEach(note => {
                  const li = document.createElement('li');
                  const date = note.createdAt ? new Date(note.createdAt).toLocaleDateString('it-IT') : '';
                  li.textContent = `${date} - ${note.text}`;
                  classNotesList.appendChild(li);
              });
          }
      }

      classNoteForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!auth.currentUser || !currentSchool || !currentClass) {
              alert('Devi essere autenticato e aver selezionato una classe.');
              return;
          }

          const formData = new FormData(classNoteForm);
          const noteText = formData.get('noteText');
          const docRef = doc(db, 'classNotes', `${currentSchool}-${currentClass}`);

          try {
              await updateDoc(docRef, {
                  notes: arrayUnion({
                      text: noteText,
                      createdAt: new Date().toISOString()
                  })
              });
              classNoteForm.reset();
          } catch (e) {
              // Se il documento non esiste, lo crea
              if (e.code === 'not-found') {
                  await setDoc(docRef, {
                      school: currentSchool,
                      class: currentClass,
                      notes: [{
                          text: noteText,
                          createdAt: new Date().toISOString()
                      }]
                  });
                  classNoteForm.reset();
              } else {
                  console.error("Errore salvataggio nota di classe:", e);
                  alert("Errore durante il salvataggio dell'appunto.");
              }
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
            const timetableDocRef = doc(db, 'timetables', 'unique_timetable');
            const snap = await getDoc(timetableDocRef);
 
            let timetableData = null;
            if (snap.exists()) {
                  timetableData = snap.data().data;
            }
 
          hours.forEach((hour) => {
            const tr = document.createElement('tr');
            const tdHour = document.createElement('td');
            tdHour.textContent = hour;
            tr.appendChild(tdHour);
 
            dayMappings.forEach((day) => {
              const td = document.createElement('td');
              const lesson = timetableData?.find(item => item.hour === hour)?.[day] || '';
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
          saveTimetableBtn.style.display = 'none  ';
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
 
          if (!auth.currentUser) {
              alert('Devi essere autenticato per salvare l\'orario.');
              return;
          }
 
          try {
              const timetableDocRef = doc(db, 'timetables', 'unique_timetable');
              await setDoc(timetableDocRef, {
                  data: timetableData,
                  lastUpdatedBy: auth.currentUser.uid,
                  lastUpdatedAt: new Date().toISOString()
              });
              alert('Orario salvato con successo!');
          } catch (e) {
              console.error("Errore salvaggio orario:", e);
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
            if (currentStudentDocUnsub) { currentStudentDocUnsub(); currentStudentDocUnsub = null; }
            currentStudentId = null;
      }
  
      async function openStudentModal(studentId, initialTab = 'all') {
            if (!studentId) return;
            currentStudentId = studentId;
            showModal(initialTab);
 
            const docRef = doc(db, 'students', studentId);
            if (currentStudentDocUnsub) currentStudentDocUnsub();
            currentStudentDocUnsub = onSnapshot(docRef, snap => {
                  if (!snap.exists()) return;
                  const data = snap.data();
                  studentNameEl.textContent = data.name || '';
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
                  li.textContent = `${n.createdAt? n.createdAt.slice(0, 10) : ''} – ${n.text || ''}`;
                  notesList.appendChild(li);
            });
      }
  
      modalOverlay.addEventListener('click', hideModal);
      closeModalBtn.addEventListener('click', hideModal);
 
      // ================= Logica di ricerca =================
      studentSearchInput.addEventListener('input', () => {
            const searchTerm = studentSearchInput.value.toLowerCase();
            const filteredStudents = allStudentsInClass.filter(student =>
                  student.name&& student.name.toLowerCase().includes(searchTerm)
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
            const gradeObj = { subject, value, date, createdAt: new Date().toISOString() };
            try {
                  const sref = doc(db, 'students', currentStudentId);
                  await updateDoc(sref, { grades: arrayUnion(gradeObj) });
                  gradeForm.reset();
            } catch (e) { console.error(e); alert('Errore salvaggio voto'); }
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
            } catch (e) { console.error(e); alert('Errore salvaggio assenza'); }
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
            } catch (e) { console.error(e); alert('Errore salvaggio nota'); }
      });
 
      // ================= AUTENTICAZIONE =================
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
              loginBtn.style.display = 'none  ';
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
 
      // ================= Aggiungi studente manuale =================
      addStudentBtn.addEventListener('click', async () => {
          if (!auth.currentUser) return alert('Devi autenticarti per aggiungere studenti.');
          const name = prompt('Nome completo alunno:');
          if (!name) return;
          try {
              await addDoc(collection(db, 'students'), {name, school: currentSchool, classe: currentClass, grades: [], absences: [], notes: [], createdBy: auth.currentUser.uid, createdAt: new Date().toISOString() });
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
 
          for (const x of dataRows) {
              const name = (x && x[0]) ? String(x[0]).trim() : null;
              if (!name) continue;
 
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
          xlsxInput.value = '';
          sheetSelect.style.display = 'none';
          previewArea.style.display = 'none';
          previewBtn.style.display = 'none';
          doImportBtn.style.display = 'none';
      });