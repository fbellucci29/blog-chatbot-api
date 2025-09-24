# Blog Chatbot API

API serverless per chatbot e funzioni interattive del blog di sicurezza sul lavoro.

## 🚀 Funzionalità

- **Chatbot Claude**: Assistente specializzato in sicurezza sul lavoro
- **Generatore Cruciverba**: Cruciverba automatici per ogni modulo corso
- **Generatore Quiz**: Quiz a scelta multipla personalizzati
- **Controllo Limiti**: Sistema di limitazione richieste per utente
- **Database Supabase**: Persistenza dati e tracking utilizzo

## 📁 Struttura

```
blog-chatbot-api/
├── api/
│   ├── chat.js          # Chatbot principale
│   ├── cruciverba.js    # Generatore cruciverba
│   ├── quiz.js          # Generatore quiz
│   └── check-limits.js  # Controllo richieste
├── lib/
│   └── supabase.js      # Connessione database
├── package.json         # Dipendenze
├── vercel.json         # Configurazione deploy
└── README.md           # Documentazione
```

## 🔧 Configurazione

### Variabili d'ambiente necessarie:

```env
ANTHROPIC_API_KEY=your_claude_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Supabase:

**Tabella `user_requests`:**
```sql
CREATE TABLE user_requests (
  id BIGSERIAL PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_identifier, date)
);
```

**Tabella `courses`:**
```sql
CREATE TABLE courses (
  id BIGSERIAL PRIMARY KEY,
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 📊 API Endpoints

### POST `/api/chat`
Chatbot principale per domande su sicurezza sul lavoro.

**Body:**
```json
{
  "message": "Domanda sulla sicurezza",
  "userIdentifier": "user_123",
  "courseId": "sicurezza-base",
  "moduleId": "modulo-1"
}
```

### POST `/api/cruciverba`
Genera cruciverba automatico per un modulo.

**Body:**
```json
{
  "userIdentifier": "user_123",
  "courseId": "sicurezza-base", 
  "moduleId": "modulo-1"
}
```

### POST `/api/quiz`
Genera quiz a scelta multipla per un modulo.

**Body:**
```json
{
  "userIdentifier": "user_123",
  "courseId": "sicurezza-base",
  "moduleId": "modulo-1",
  "numDomande": 5
}
```

### POST `/api/check-limits`
Controlla limiti richieste per utente.

**Body:**
```json
{
  "userIdentifier": "user_123"
}
```

## 🚨 Limiti

- **10 richieste al giorno per utente** (configurabile)
- **30 secondi timeout** per richieste Claude
- **CORS abilitato** per chiamate dal blog

## 🛠️ Deploy

1. Pusha su GitHub
2. Connetti repository a Vercel
3. Configura variabili d'ambiente
4. Deploy automatico

## 💡 Utilizzo nel Blog

```javascript
// Esempio chiamata dal tema WordPress
async function callChatbot(message) {
  const response = await fetch('https://your-vercel-url.vercel.app/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      userIdentifier: getUserId(), // Funzione per ottenere ID utente
      courseId: getCurrentCourse(),
      moduleId: getCurrentModule()
    })
  });
  
  return await response.json();
}
```

## 📄 Licenza

MIT License
