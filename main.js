import pkg from 'whatsapp-web.js'
const { Client, LocalAuth} = pkg
import qrcode from 'qrcode-terminal';
import { CONVERSATION_STATES } from './states.js';
import * as f from './funcoes.js'

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
            // NO FUTURO: Adicione outros comandos aqui
            // else if (message.body.toLowerCase() === "verificar_processo") {
            //     currentState.mainState = MAIN_STATES.IN_FEATURE;
            //     currentState.activeFeature = 'processos';
            //     // const newState = await handleProcessoConversation(message, currentState, client);
            //     // conversationStates.set(userId, newState);
            // }
              // Comando não reconhecido no estado idle
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
            // NO FUTURO: Adicione outros handlers aqui
            // else if (currentState.activeFeature === 'processos') {
            //     ...
            // }
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



















/*


      
        //processar imagem pers
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_IMAGE_PERS) {
            let dados_pess = await f.processarImagem(message, 'pers')
            if (dados_pess) {
               conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.APPROVING_PERS,
                timestamp: Date.now(),
                dados_pess: dados_pess
                }); 

                await client.sendMessage(message.from, f.formatarValidaPess(conversationStates.get(userId).dados_pess))
            }
            else {
                await client.sendMessage(message.from, `❌ Não foi possível processar a imagem.\n🔄 Tente novamente.\n📸 Procure enviar uma imagem em boa definição e bem enquadrada.`)
            }
        }

        //processar escrita pers
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_WRITE_PERS) {
            let dados_pess = await f.processarEscrita(message, 'pers')
            if (dados_pess) {
               conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.APPROVING_PERS,
                timestamp: Date.now(),
                dados_pess: dados_pess
                }); 

                await client.sendMessage(message.from, f.formatarValidaPess(conversationStates.get(userId).dados_pess))
            }
            else {
                await client.sendMessage(message.from, `Não foi possível processar o texto.\n Tente novamente.\n Certifique-se de fornecer apenas nome completo e CPF.\n Por exemplo: "Gerônimo Pereira, cpf 000 000 000 00.`)
            }
        }

        //pegando resposta quanto à aprovação das informações pessoais
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.APPROVING_PERS) {
            //correto, vá direto para pegar profissão
            if (parseInt(message.body.trim()) === 1) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_JOB,
                timestamp: Date.now(),
                });

                await client.sendMessage(message.from, `Informar profissão?\n👍1 - Sim;\n👎2 - Não.`)
            }
            //correções necessárias
            else if (parseInt(message.body.trim()) === 2) {
                await client.sendMessage(message.from, "✍🏻 Informe nome completo e CPF.")
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.CORRECTING_PERS,
                timestamp: Date.now(),
                });
            }
            else {
                 await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
                }
        }

        //corrigindo informações pessoais
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.CORRECTING_PERS) {
            //FUNÇÃO PARA CORRIGIR O ENDEREÇO, O INPUT DO USUARIO VAI PARA O LLM PARA RETORNAR EM JSON {nome, cpf}
            let dados_pess = await f.corrigirPessoais(message.body)
            
            if (dados_pess) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.APPROVING_PERS,
                dados_pess: dados_pess,
                timestamp: Date.now(),
                });

                await client.sendMessage(message.from, f.formatarValidaPess(conversationStates.get(userId).dados_pess))
            }
            else {
                await client.sendMessage(message.from, `Erro ao processas as informações pessoais fornecidas. Tente novamente.\n
                                                        Informe, por escrito, nome completo e CPF do sujeito.`)
            }
            
        }

        //pegando resposta quanto a ter endereço ou não
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_JOB) {
            if (parseInt(message.body.trim()) === 1) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_WRITE_JOB,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `Informe a profissão, exatamente como deve sair no documento.`)
                
            }
            else if (parseInt(message.body.trim()) === 2) {

                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.IF_MARIT,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `Informar estado civil?\n1 - Sim;\n2 - Não.`)

            }
            else {
                 await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
                }
        }

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_WRITE_JOB) {
            const profissao = message.body.trim();
            let currentState = conversationStates.get(userId)
            if (profissao && profissao.length > 0) {
                conversationStates.set(userId, {
                    ...currentState,
                    state: CONVERSATION_STATES.IF_MARIT,
                    profissao: profissao,
                    timestamp: Date.now()
                });

                await client.sendMessage(message.from, `Informar estado civil?\n1 - Sim;\n2 - Não.`)
            
            }
            else {
                await client.sendMessage(message.from, `Por favor, informe a profissão.`)
            }
        } 

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.IF_MARIT) {
            if (parseInt(message.body.trim()) === 1) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_MARIT,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `Informe o estado civil, exatamente como deve sair no documento.`)
                
            }
            else if (parseInt(message.body.trim()) === 2) {

                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_FINAL_APPROVAL,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, f.formatarResumoFinal(conversationStates.get(userId)))
            }
        }

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_MARIT) {
            const estadoCivil = message.body.trim();

            if (estadoCivil && estadoCivil.length > 0) {
                conversationStates.set(userId, {
                    ...currentState,
                    state: CONVERSATION_STATES.WAITING_FINAL_APPROVAL,
                    estadoCivil: estadoCivil,
                    timestamp: Date.now()
                });

                await client.sendMessage(message.from, f.formatarResumoFinal(conversationStates.get(userId)))
            } else {
                await client.sendMessage(message.from, `Por favor, informe um estado civil.`)
            }
        }

      
    }
    catch (error) {
        console.log(error)
    }
})

*/





