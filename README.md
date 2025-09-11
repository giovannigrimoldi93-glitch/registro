# Registro Scuola (Web App)

Applicazione web per la gestione dei registri di classe in un liceo.  
Realizzata in **HTML/CSS/JS** con backend su **Firebase (Auth + Firestore)**.  

---

## ✨ Funzionalità
- **Login con Google** (solo utenti autorizzati possono accedere).  
- **Dashboard** con tutte le classi (I–V per Scientifico e Linguistico).  
- **Registro di classe** con elenco studenti, voti, assenze e note.  
- **Scheda studente in modal** per inserire voti, assenze e annotazioni.  
- **Import studenti da Excel** con sezione dedicata.  

---

## 📂 Struttura del progetto
```
registro/
│── index.html
│── style.css
│── app.js
│── README.md
│── studenti_facsimile.xlsx
```

---

## 🚀 Installazione locale
1. Clona il progetto:
   ```bash
   git clone https://github.com/tuo-username/registro.git
   cd registro
   ```
2. Avvia un server locale (necessario per Firebase Auth):
   ```bash
   npx serve
   ```
   Oppure:
   ```bash
   python -m http.server 3000
   ```
3. Apri [http://localhost:3000](http://localhost:3000).

---

## 🔑 Configurazione Firebase
1. Vai su [Firebase Console](https://console.firebase.google.com/) e crea un progetto.  
2. Abilita **Authentication → Sign-in method → Google**.  
3. In **Authentication → Settings → Authorized domains** aggiungi:
   - `localhost` (per test locali)
   - `tuo-username.github.io` (se usi GitHub Pages)
4. In **Firestore Database → Rules** incolla regole di base:
   ```js
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
5. Sostituisci in `app.js` la sezione **firebaseConfig** con i tuoi dati del progetto.

---

## 📥 Import studenti
1. Vai alla sezione **Importa** tramite l’header.  
2. Carica un file `.xlsx`.  
3. Seleziona foglio e classe di destinazione.  
4. Premi **Importa in classe**.  
5. Verranno creati documenti in Firestore con i campi:
   ```json
   {
     "nome": "Mario Rossi",
     "voti": [],
     "assenze": 0,
     "note": []
   }
   ```

---

## 📊 File Excel di esempio
Vedi [`studenti_facsimile.xlsx`](./studenti_facsimile.xlsx).  
- Il sistema usa **solo la prima colonna** come elenco nomi.  
- Ogni riga = uno studente.  
- Eventuali colonne extra vengono ignorate.  

---

## 🌐 Deploy su GitHub Pages
1. Fai commit dei file su `main` branch.  
2. Vai su **Settings → Pages** e scegli branch `main`, cartella `/root`.  
3. Dopo pochi minuti sarà disponibile su:
   ```
   https://tuo-username.github.io/registro/
   ```
4. Ricordati di autorizzare il dominio in **Firebase Authentication**.

---

## 📌 Note
- Regole Firestore vanno ristrette in produzione (es. solo prof).  
- Il login funziona **solo via https:// o localhost** (non da `file://`).  
- Il foglio Excel deve avere i nomi nella **prima colonna**.
