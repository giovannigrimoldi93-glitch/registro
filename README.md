# Registro Scuola (Web App)

Applicazione web per la gestione dei registri di classe in un liceo.
Realizzata in **HTML/CSS/JS** con backend su **Firebase (Auth + Firestore)**.

---

## ✨ Funzionalità

- **Login con Google** (solo utenti autorizzati possono accedere).
- **Dashboard** con tutte le classi (I–V per Scientifico e Linguistico).
- **Ricerca rapida Studente** integrata in dashboard.
- **Registro di classe** con elenco studenti, voti e note.
- **Esportazione XLSX** della classe (voti e note in formato storico).
- **Scheda studente in modal** per:
    - Inserimento di voti e annotazioni.
    - **Eliminazione singola** (soft-delete) di voti o annotazioni storiche.
- **Gestione Appunti di Classe** per salvare note sul programma svolto, accessibile dalla vista classe.
- **Soft Delete Studente**: lo studente viene archiviato (non eliminato) per conservare lo storico.
- **Gestione Orario Settimanale** (visualizzazione e modifica).
- **Import studenti da Excel** con sezione dedicata.
- **RIMOSSA COMPLETAMENTE** la gestione delle assenze.

---

## 📂 Struttura del progetto
registro/
│── index.html
│── style.css
│── app.js
│── README.md
│── studenti_facsimile.xlsx


---

## 🚀 Installazione locale
1. Clona il progetto:
   ```bash
   git clone [https://github.com/tuo-username/registro.git](https://github.com/tuo-username/registro.git)
   cd registro
Avvia un server locale (necessario per Firebase Auth):

Bash
npx serve
Oppure:

Bash
python -m http.server 3000
Apri http://localhost:3000.

🔑 Configurazione Firebase
Vai su Firebase Console e crea un progetto.

Abilita Authentication → Sign-in method → Google.

In Authentication → Settings → Authorized domains aggiungi localhost.

In Firestore Database → Rules incolla regole di base:

JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
Sostituisci in app.js la sezione firebaseConfig con i tuoi dati del progetto.

📥 Import studenti
Vai alla sezione Importa tramite l’header.

Carica un file .xlsx.

Seleziona foglio e classe di destinazione.

Premi Importa in classe.

Verranno creati documenti in Firestore con i campi:

JSON
{
  "name": "Mario Rossi",
  "school": "scientifico",
  "classe": 1,
  "grades": [],
  "notes": [],
  "deleted": false
  // 'absences' è stato rimosso
}
📊 File Excel di esempio
Vedi studenti_facsimile.xlsx.

Il sistema usa solo la prima colonna come elenco nomi.

Ogni riga = uno studente.

Eventuali colonne extra vengono ignorate.

🌐 Deploy su GitHub Pages
Fai commit dei file su main branch.

Vai su Settings → Pages e scegli branch main, cartella /root.

Dopo pochi minuti sarà disponibile su:

[https://tuo-username.github.io/registro/](https://tuo-username.github.io/registro/)
Ricorda di aggiungere il dominio di GitHub Pages (es. tuo-username.github.io) nelle Impostazioni di Autenticazione Firebase come dominio autorizzato.
