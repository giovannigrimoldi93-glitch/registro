// === Firebase setup ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import { getFirestore, collection, doc, addDoc, getDocs, setDoc, onSnapshot } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Config dal tuo progetto
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
const analytics = getAnalytics(fbApp);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

// === Elementi UI ===
const dashboard = document.getElementById('dashboard');
const classView = document.getElementById('classView');
const importSection = document.getElementById('importSection');
const studentModal = document.getElementById('studentModal');

const homeBtn = document.getElementById('homeBtn');
const backBtn = document.getElementById('backBtn');
const importBtnHeader = document.getElementById('importBtnHeader');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentClass = null;
let unsubscribeSnapshot = null;
let lastScreen = 'dashboard';
let selectedStudentId = null;

// === Autenticazione ===
loginBtn.addEventListener('click', async ()=>{
  try {
    await signInWithPopup(auth, provider);
  } catch(err){ console.error(err); alert('Errore login: ' + err.message); }
});
logoutBtn.addEventListener('click', async ()=>{ await signOut(auth); });

onAuthStateChanged(auth, (user)=>{
  if(user){
    console.log("Loggato come", user.email);
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    renderDashboard();
  } else {
    console.log("Non loggato");
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    dashboard.style.display = "none";
    classView.style.display = "none";
    importSection.style.display = "none";
  }
});

// === Navigazione ===
homeBtn.addEventListener('click', () => {
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  renderDashboard();
  importSection.style.display = 'none';
});
importBtnHeader.addEventListener('click', () => {
  lastScreen = 'dashboard';
  dashboard.style.display = 'none';
  classView.style.display = 'none';
  studentModal.style.display = 'none';
  importSection.style.display = '';
});
backBtn.addEventListener('click', () => {
  if (lastScreen === 'dashboard') {
    renderDashboard();
    importSection.style.display = 'none';
  } else if (lastScreen === 'classView') {
    studentModal.style.display = 'none';
    classView.style.display = '';
  } else {
    renderDashboard();
  }
});

// === Dashboard rendering ===
function renderDashboard(){
  dashboard.style.display = '';
  classView.style.display = 'none';
  studentModal.style.display = 'none';
  importSection.style.display = 'none';

  const schools = [
    {id:'scientifico', name:'Scientifico'},
    {id:'linguistico', name:'Linguistico'}
  ];
  schools.forEach(s=>{
    const container = document.querySelector(`#${s.id} .classes`);
    container.innerHTML = '';
    for(let i=1;i<=5;i++){
      const btn = document.createElement('button');
      btn.textContent = `${s.name} ${i}`;
      btn.addEventListener('click', ()=>loadClass(`${s.id}-${i}`, `${s.name} ${i}`));
      container.appendChild(btn);
    }
  });
}

// === Caricamento classe ===
async function loadClass(classId, label){
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  currentClass = classId;
  lastScreen = 'dashboard';
  dashboard.style.display = 'none';
  importSection.style.display = 'none';
  classView.style.display = '';
  document.getElementById('classTitle').textContent = label;

  const tbody = document.querySelector('#studentTable tbody');
  tbody.innerHTML = '';

  const studentsRef = collection(db, "classi", classId, "studenti");
  unsubscribeSnapshot = onSnapshot(studentsRef, snapshot=>{
    tbody.innerHTML = '';
    snapshot.forEach(docSnap=>{
      const data = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="#" class="student-link" data-id="${docSnap.id}">${data.nome}</a></td>
        <td>${(data.voti||[]).join(", ")}</td>
        <td>${(data.assenze||0)}</td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.student-link').forEach(link=>{
      link.addEventListener('click', (e)=>{
        e.preventDefault();
        openStudentModal(link.dataset.id);
      });
    });
  });
}

// === Modal studente ===
const modalClose = studentModal.querySelector('.close');
modalClose.onclick = ()=> studentModal.style.display = 'none';

function openStudentModal(studentId){
  selectedStudentId = studentId;
  studentModal.style.display = 'flex';
  const ref = doc(db, "classi", currentClass, "studenti", studentId);
  onSnapshot(ref, snap=>{
    const data = snap.data();
    if(!data) return;
    document.getElementById('studentName').textContent = data.nome;
    document.getElementById('studentData').innerHTML = `
      <p><strong>Voti:</strong> ${(data.voti||[]).join(", ")}</p>
      <p><strong>Assenze:</strong> ${data.assenze||0}</p>
      <p><strong>Note:</strong> ${(data.note||[]).join("<br>")}</p>
    `;
  });
}

// Forms nel modal
document.getElementById('gradesForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const val = parseInt(document.getElementById('gradeInput').value);
  if(!val) return;
  const ref = doc(db, "classi", currentClass, "studenti", selectedStudentId);
  const snap = await (await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js")).getDoc(ref);
  let data = snap.data();
  let voti = data.voti||[];
  voti.push(val);
  await setDoc(ref, {...data, voti});
});
document.getElementById('absencesForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const val = parseInt(document.getElementById('absenceInput').value);
  if(val==null) return;
  const ref = doc(db, "classi", currentClass, "studenti", selectedStudentId);
  const snap = await (await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js")).getDoc(ref);
  let data = snap.data();
  let assenze = (data.assenze||0) + val;
  await setDoc(ref, {...data, assenze});
});
document.getElementById('notesForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const val = document.getElementById('noteInput').value;
  if(!val) return;
  const ref = doc(db, "classi", currentClass, "studenti", selectedStudentId);
  const snap = await (await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js")).getDoc(ref);
  let data = snap.data();
  let note = data.note||[];
  note.push(val);
  await setDoc(ref, {...data, note});
});

// === Import studenti da Excel ===
const xlsxInput = document.getElementById('xlsxInput');
const sheetSelect = document.getElementById('sheetSelect');
const importBtn = document.getElementById('importBtn');
let workbook;

xlsxInput.addEventListener('change', e=>{
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = evt=>{
    const data = new Uint8Array(evt.target.result);
    workbook = XLSX.read(data, {type:'array'});
    sheetSelect.innerHTML = '';
    workbook.SheetNames.forEach(name=>{
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      sheetSelect.appendChild(opt);
    });
    sheetSelect.style.display = '';
    importBtn.style.display = '';
  };
  reader.readAsArrayBuffer(file);
});

importBtn.addEventListener('click', async ()=>{
  const sheet = workbook.Sheets[sheetSelect.value];
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1});
  const classId = document.getElementById('importClassSelect').value;
  for(let r of rows){
    if(r[0]){
      const nome = r[0];
      const ref = doc(collection(db, "classi", classId, "studenti"));
      await setDoc(ref, {nome, voti:[], assenze:0, note:[]});
    }
  }
  alert("Import completato!");
});
