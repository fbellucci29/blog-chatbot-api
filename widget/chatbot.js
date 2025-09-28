<!-- Widget Chatbot Sicurezza con API Vercel -->
<style>
.safety-bot-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.bot-trigger {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 50px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.3s;
}

.bot-trigger:hover {
    transform: translateY(-2px);
}

.bot-window {
    position: absolute;
    bottom: 70px;
    right: 0;
    width: 380px;
    height: 550px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.bot-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bot-close {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
}

.bot-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: #f9fafb;
}

.bot-message {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}

.bot-message.user {
    align-items: flex-end;
}

.bot-message.assistant {
    align-items: flex-start;
}

.message-bubble {
    max-width: 80%;
    padding: 12px 16px;
    border-radius: 18px;
    line-height: 1.5;
    font-size: 14px;
}

.bot-message.user .message-bubble {
    background: #667eea;
    color: white;
}

.bot-message.assistant .message-bubble {
    background: white;
    color: #374151;
    border: 1px solid #e5e7eb;
}

.bot-input-area {
    padding: 20px;
    background: white;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 10px;
}

.bot-input {
    flex: 1;
    border: 1px solid #d1d5db;
    border-radius: 25px;
    padding: 12px 20px;
    font-size: 14px;
    outline: none;
}

.bot-input:focus {
    border-color: #667eea;
}

.bot-send {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.bot-send:hover:not(:disabled) {
    background: #5a67d8;
}

.bot-send:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

.bot-typing {
    display: none;
    padding: 12px 16px;
    background: white;
    border-radius: 18px;
    border: 1px solid #e5e7eb;
    margin: 10px 20px;
}

.typing-dots {
    display: flex;
    gap: 4px;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    background: #9ca3af;
    border-radius: 50%;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        transform: translateY(0);
    }
    30% {
        transform: translateY(-10px);
    }
}

.bot-register {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    padding: 15px;
    border-radius: 10px;
    margin: 10px 0;
}

.bot-register input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    margin: 10px 0;
    box-sizing: border-box;
}

.bot-register button {
    background: #0ea5e9;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
}

@media (max-width: 480px) {
    .bot-window {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
    }
}
</style>

<div class='safety-bot-widget'>
    <div class='bot-trigger' onclick='toggleBot()'>
        🛡️ Esperto Sicurezza AI
    </div>
    
    <div class='bot-window' id='botWindow'>
        <div class='bot-header'>
            <span>💬 Assistente D.Lgs 81/2008</span>
            <button class='bot-close' onclick='toggleBot()'>×</button>
        </div>
        
        <div class='bot-messages' id='botMessages'>
            <div class='bot-message assistant'>
                <div class='message-bubble'>
                    Ciao! Sono il tuo assistente AI specializzato in sicurezza sul lavoro.<br/>
                    Puoi farmi <strong>1 domanda gratuita</strong>, poi ti chiederò di registrarti per continuare.
                </div>
            </div>
        </div>
        
        <div class='bot-typing' id='botTyping'>
            <div class='typing-dots'>
                <span>.</span>
                <span>.</span>
                <span>.</span>
            </div>
        </div>
        
        <div class='bot-input-area'>
            <input class='bot-input' id='botInput' onkeypress='if(event.key==="Enter") sendBotMessage()' placeholder='Fai la tua domanda...' type='text'/>
            <button class='bot-send' id='botSend' onclick='sendBotMessage()'>
                <svg fill='currentColor' height='20' viewBox='0 0 24 24' width='20'>
                    <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'/>
                </svg>
            </button>
        </div>
    </div>
</div>

<script>
// URL API Vercel (da aggiornare dopo deploy)
const BOT_API_URL = 'https://tuo-progetto.vercel.app';

let botState = {
    isOpen: false,
    sessionId: generateSessionId(),
    isRegistered: false,
    questionsAsked: 0,
    userEmail: null
};

function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function toggleBot() {
    botState.isOpen = !botState.isOpen;
    const window = document.getElementById('botWindow');
    window.style.display = botState.isOpen ? 'flex' : 'none';
}

function addBotMessage(text, sender) {
    const messagesDiv = document.getElementById('botMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message ' + sender;
    messageDiv.innerHTML = "<div class='message-bubble'>" + text + "</div>";
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showRegistrationForm() {
    const form = document.createElement('div');
    form.className = 'bot-message assistant';
    form.innerHTML = `
        <div class='message-bubble'>
            <div class='bot-register'>
                <strong>Registrati per continuare</strong><br/>
                Hai già usato la tua domanda gratuita. Registrati per avere <strong>5 domande al giorno</strong>!<br/>
                <input id='regName' placeholder='Nome completo' type='text'/>
                <input id='regEmail' placeholder='Email' type='email'/>
                <button onclick='registerUser()'>Registrati</button>
            </div>
        </div>
    `;
    document.getElementById('botMessages').appendChild(form);
}

async function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    
    if (!name || !email) {
        alert('Compila tutti i campi');
        return;
    }
    
    try {
        const response = await fetch(BOT_API_URL + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        if (response.ok) {
            botState.isRegistered = true;
            botState.userEmail = email;
            addBotMessage('Registrazione completata! Ora puoi fare 5 domande al giorno.', 'assistant');
        } else {
            const error = await response.json();
            addBotMessage('Errore registrazione: ' + (error.message || 'Riprova'), 'assistant');
        }
    } catch (error) {
        addBotMessage('Errore di connessione. Riprova.', 'assistant');
    }
}

async function sendBotMessage() {
    const input = document.getElementById('botInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Controlla se può fare la domanda
    if (!botState.isRegistered && botState.questionsAsked >= 1) {
        addBotMessage('Per continuare devi registrarti!', 'assistant');
        showRegistrationForm();
        return;
    }
    
    input.value = '';
    input.disabled = true;
    document.getElementById('botSend').disabled = true;
    
    addBotMessage(message, 'user');
    document.getElementById('botTyping').style.display = 'block';
    
    try {
        const response = await fetch(BOT_API_URL + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                sessionId: botState.sessionId,
                email: botState.userEmail,
                isRegistered: botState.isRegistered
            })
        });
        
        document.getElementById('botTyping').style.display = 'none';
        
        if (response.ok) {
            const data = await response.json();
            addBotMessage(data.response, 'assistant');
            
            botState.questionsAsked++;
            
            // Dopo la prima domanda (per anonimi), richiedi registrazione
            if (!botState.isRegistered && botState.questionsAsked === 1) {
                setTimeout(() => {
                    addBotMessage('Questa era la tua domanda gratuita! Per continuare, registrati qui sotto:', 'assistant');
                    showRegistrationForm();
                }, 2000);
            }
            
        } else {
            const error = await response.json();
            addBotMessage('Errore: ' + (error.message || 'Riprova'), 'assistant');
        }
    } catch (error) {
        document.getElementById('botTyping').style.display = 'none';
        addBotMessage('Errore di connessione.', 'assistant');
    } finally {
        input.disabled = false;
        document.getElementById('botSend').disabled = false;
        input.focus();
    }
}
</script>
