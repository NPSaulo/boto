import { AFAZER_STATES } from '../states.js';
import * as f from '../funcoes.js';


export async function handleAfazerConversation(message, currentState, client) {
    console.log(currentState)
    // primeiro estado = feature_state limpo
    if (currentState.featureState === null) {
        const newState = {
            ...currentState,
            featureState: AFAZER_STATES.WAITING_MSG,
            featureData: {
                timestamp: Date.now()
            }
        };
        let messageToSend = "Envie, por texto ou áudio, o a-fazer."
        await client.sendMessage(message.from, messageToSend);
        return newState;
    }
    
    // A partir daqui se destrincha em cada etapa da conversa
    const { featureState, featureData } = currentState;

    if (featureState === AFAZER_STATES.WAITING_MSG) {
        let afazerProcessado = ""
        // Verifica se é um áudio (ptt = push-to-talk)
        if (message.hasMedia && message.type === 'ptt') {
            await client.sendMessage(message.from, "🎙️ Processando seu áudio, um momento...");
            afazerProcessado = await f.processarAudioAfazer(message);
        } 
        // Verifica se é um texto
        else if (message.body && !message.hasMedia) {
            afazerProcessado = await f.processarTextoAfazer(message.body);
        } 
        // Se for qualquer outra coisa (imagem, vídeo, etc.)
        else {
            await client.sendMessage(message.from, "❌ Formato não suportado. Por favor, envie apenas texto ou áudio.");
            return currentState;
        }

        // Se o processamento falhou, a função de processamento retornará null/false
        if (!afazerProcessado) {
            await client.sendMessage(message.from, "❌ Não foi possível entender sua mensagem. Tente novamente.");
            return currentState;
        }
        console.log(afazerProcessado.afazer)
        const messageToSend = `📋 Anotar o seguinte a-fazer?\n\n*_"${afazerProcessado.afazer}"_*\n\n*1* - ✅ Sim, está correto\n*2* - ✍️ Não, quero corrigir`;
        await client.sendMessage(message.from, messageToSend);

        // Atualiza o estado para aguardar a aprovação
        return {
            ...currentState,
            featureState: AFAZER_STATES.WAITING_APPROVAL,
            featureData: {
                ...featureData,
                afazer: afazerProcessado.afazer,
                timestamp: Date.now()
            }
        };
        
    }

    else if (featureState === AFAZER_STATES.WAITING_APPROVAL) {
        const choice = parseInt(message.body.trim());

        if (choice === 1) {
            await client.sendMessage(message.from, "⏳ Ok, salvando seu a-fazer...");
            const apiResponse = await f.enviarAfazerParaApi(featureData.afazer);

            if (apiResponse.success) {
                await client.sendMessage(message.from, `✅ A-fazer anotado com sucesso!`);
            } else {
                await client.sendMessage(message.from, `❌ Houve um erro ao salvar. Tente novamente mais tarde.`);
            }
            return { finished: true }; // Sinaliza para o main.js que a conversa da feature acabou

        } else if (choice === 2) {
            await client.sendMessage(message.from, "✍️ Entendido. Por favor, envie o texto corrigido ou um novo áudio.");
            return {
                ...currentState,
                featureState: AFAZER_STATES.WAITING_CORRECTION,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            };
        } else {
            await client.sendMessage(message.from, "Opção inválida. Por favor, responda com *1* para confirmar ou *2* para corrigir.");
            return currentState;
        }
    }

    else if (featureState === AFAZER_STATES.WAITING_CORRECTION) {
        let afazerCorrigido = ""
        // Verifica se é um áudio (ptt = push-to-talk)
        if (message.hasMedia && message.type === 'ptt') {
            await client.sendMessage(message.from, "🎙️ Processando seu áudio, um momento...");
            afazerCorrigido = await f.corrigirAudioAfazer(message, featureState);
        } 
        // Verifica se é um texto
        else if (message.body && !message.hasMedia) {
            afazerCorrigido = await f.corrigirTextoAfazer(message.body, featureState);
        } 
        // Se for qualquer outra coisa (imagem, vídeo, etc.)
        else {
            await client.sendMessage(message.from, "❌ Formato não suportado. Por favor, envie apenas texto ou áudio.");
            return currentState;
        }

        // Se o processamento falhou, a função de processamento retornará null/false
        if (!afazerCorrigido) {
            await client.sendMessage(message.from, "❌ Não foi possível entender sua mensagem. Tente novamente.");
            return currentState;
        }
        const messageToSend = `📋 Anotar o seguinte a-fazer?\n\n*_"${afazerCorrigido}"_*\n\n*1* - ✅ Sim, está correto\n*2* - ✍️ Não, quero corrigir`;
        await client.sendMessage(message.from, messageToSend);

        // Atualiza o estado para aguardar a aprovação
        return {
            ...currentState,
            featureState: AFAZER_STATES.WAITING_APPROVAL,
            featureData: {
                ...featureData,
                afazer: afazerCorrigido,
                timestamp: Date.now()
            }
        };
    }
}
