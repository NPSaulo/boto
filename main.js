import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { MAIN_STATES } from './states.js';
import { handleProcuracaoConversation } from './features/procuracao.js';
import { handleAfazerConversation } from './features/afazer.js';


const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    authStrategy: new LocalAuth()
});


const conversationStates = new Map();

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});


client.on('message', async message => {
    const userId = message._data.from;
    
    // Inicializa o estado do usuário se não existir
    if (!conversationStates.has(userId)) {
        conversationStates.set(userId, {
            mainState: MAIN_STATES.IDLE,
            activeFeature: null, // Qual feature está ativa (ex: 'procuracao')
            featureState: null, // Estado interno da feature
            featureData: {} // Dados coletados pela feature
        });
    }
    
    let currentState = conversationStates.get(userId);

    // Comando de cancelamento global
    if (message.body.toLowerCase() === 'cancelar') {        
        conversationStates.delete(userId);
        await message.reply("❌ Operação cancelada. Envie um comando para começar.");
        return;
    }
    
    try {
        // ROTEADOR PRINCIPAL
        // Se o usuário está inativo (IDLE), ele pode iniciar uma nova funcionalidade
        if (currentState.mainState === MAIN_STATES.IDLE) {
            if (message.body.toLowerCase() === "fazer_proc") {
                // Ativa a feature de procuração
                currentState.mainState = MAIN_STATES.IN_FEATURE;
                currentState.activeFeature = 'procuracao';
                
                // Chama o handler da feature pela primeira vez para iniciar o fluxo
                const newState = await handleProcuracaoConversation(message, currentState, client);
                conversationStates.set(userId, newState);
            }
            else if (message.body.toLowerCase() === "/afazer") {
            currentState.mainState = MAIN_STATES.IN_FEATURE;
                 currentState.activeFeature = 'afazer';
                const newState = await handleAfazerConversation(message, currentState, client);
                conversationStates.set(userId, newState);
            }
            else {
                await message.reply("Comando não reconhecido.");
            }
        }
        // Se o usuário já está em uma funcionalidade, direcione a mensagem para o handler correto
        else if (currentState.mainState === MAIN_STATES.IN_FEATURE) {
            if (currentState.activeFeature === 'procuracao') {
                const newState = await handleProcuracaoConversation(message, currentState, client);
                
                // Se a feature sinalizar que terminou, reseta o estado do usuário para IDLE
                if (newState.finished) {
                    conversationStates.delete(userId);
                } else {
                    conversationStates.set(userId, newState);
                }
            }
            else if (currentState.activeFeature === 'afazer') {
                const newState = await handleAfazerConversation(message, currentState, client);
                
                // Se a feature sinalizar que terminou, reseta o estado do usuário para IDLE
                if (newState.finished) {
                    conversationStates.delete(userId);
                } else {
                    conversationStates.set(userId, newState);
                }
            }
        }
    }
    catch (error) {
        console.error("Erro no processamento da mensagem:", error);
        await message.reply("Ocorreu um erro inesperado. A operação foi cancelada. Tente novamente.");
        conversationStates.delete(userId); // Limpa o estado em caso de erro
    }
});

// A limpeza periódica continua igual
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [userId, state] of conversationStates.entries()) {
        if (state.featureData && state.featureData.timestamp && state.featureData.timestamp < oneHourAgo) {
            conversationStates.delete(userId);
        }
    }
}, 60 * 60 * 1000);

client.initialize();