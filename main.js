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
    //console.log("message", message)
    //console.log(conversationStates)
    
    const userId = message._data.from
    
    if (!conversationStates.get(userId)) {
        conversationStates.set(userId, {
            state:CONVERSATION_STATES.IDLE
        })
    }
    
    if (message.body === 'cancelar') {        
        conversationStates.delete(userId);
        await message.reply("❌ Operação cancelada. Digite 'fazer_proc' para começar novamente.");
        conversationStates.delete(userId);
        return
    }

    console.log(conversationStates.get(userId))
    
    try {
        if (message.body === "fazer_proc" && conversationStates.get(userId).state === CONVERSATION_STATES.IDLE) {
            const fastApiResponse = await fetch('http://127.0.0.1:8000/teste', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!fastApiResponse.ok) {
                throw new Error(`Erro HTTP: ${fastApiResponse.status}`);
            }

            const fastApiData = await fastApiResponse.json();
            
            if (!fastApiData.data || !Array.isArray(fastApiData.data) || fastApiData.data.length === 0) {
                await message.reply("❌ Nenhuma opção de procuração/contrato disponível no momento.");
                return;
            }
            
            conversationStates.set(userId, {
                state: CONVERSATION_STATES.SELECTING_TYPE,
                options: fastApiData.data,
                timestamp: Date.now()
            });
            
            const optionsMessage = f.formatOptionsMessage(fastApiData.data);
            await client.sendMessage(message.from, optionsMessage);
        }

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.SELECTING_TYPE){
            const selectedIndex = f.validateSelection(message.body, conversationStates.get(userId).options.length);    
            
            if (selectedIndex === null) {
                await client.reply(`❌ Opção inválida. Por favor, digite um número entre 1 e ${conversationStates.get(userId).options.length}.`);
                return;
            }
                
            const selectedOption = conversationStates.get(userId).options[selectedIndex];
        

            conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.IF_ADRESS,
                selectedOption: selectedOption,
                timestamp: Date.now()
            });
            await client.sendMessage(message.from, `Opção selecionada: ${selectedOption.demanda}`)
            await client.sendMessage(message.from, f.formatarSeEndereço())
        }

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.IF_ADRESS) {
            //imagem
            if (parseInt(message.body.trim()) === 1) {
                
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_IMAGE_ADRESS,
                informa_endereco: true,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `Envie a imagem com o endereço.\nForneça uma imagem em boa definição e bem enquadrada.`)
            }
            //escrito
            else if (parseInt(message.body.trim()) === 2) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_WRITE_ADRESS,
                informa_endereco: true,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `✍🏻 Forneça o endereço por escrito.\nNão deixe de informar cidade, estado e CEP.`)
            
            }
            //se não, vai direto para informações pessoais
            else if (parseInt(message.body.trim()) === 3) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.HOW_PERS,
                informa_endereco: false,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, await client.sendMessage(message.from, f.formatarOpcaoInfoPessoal()))
            }
            else {
                 await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
            }
        }

        //processar imagem do endereço
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_IMAGE_ADRESS) {
            let dados_end = await f.processarImagem(message, 'adr')
            if (dados_end) {
                conversationStates.set(userId, {
                    ...conversationStates.get(userId), // mantém dados existentes
                    state: CONVERSATION_STATES.APPROVING_ADRESS,
                    timestamp: Date.now(),
                    dados_end: dados_end
                });
                await client.sendMessage(message.from, f.formatarValidaEnd(conversationStates.get(userId).dados_end))
            }
            else {
                await client.sendMessage(message.from, "🔄 Tente novamente com outra imagem, ou digite 'cancelar' para recomeçar.")
            }
        }

        //processar escrita do endereço
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_WRITE_ADRESS) {
            let dados_end = await f.processarEscrita(message, 'adr')
            if (dados_end) {
                conversationStates.set(userId, {
                    ...conversationStates.get(userId), // mantém dados existentes
                    state: CONVERSATION_STATES.APPROVING_ADRESS,
                    timestamp: Date.now(),
                    dados_end: dados_end
                });
                await client.sendMessage(message.from, f.formatarValidaEnd(conversationStates.get(userId).dados_end))
            }
            else {
                await client.sendMessage(message.from, "❌ Não foi possível processar a informação escrita de endereço.")
            }
        }

        //pegando resposta quanto à aprovação das informações de endereço
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.APPROVING_ADRESS) {
            //correto, vá direto para pegar informações pessoais
            if (parseInt(message.body.trim()) === 1) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.HOW_PERS,
                timestamp: Date.now(),
                });

                await client.sendMessage(message.from, await client.sendMessage(message.from, f.formatarOpcaoInfoPessoal()))
            }
            else if (parseInt(message.body.trim()) === 2) {
                await client.sendMessage(message.from, '❓ Diga o que precisa ser corrigido.\nPor exemplo: "troque a cidade para ___; troque o número para __ e o bairro para ___.')
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.CORRECTING_ADRESS,
                timestamp: Date.now(),
                });
            }
            else {
                 await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
                }
        }

        //corrigindo o endereço
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.CORRECTING_ADRESS) {
            let dados_end = await f.corrigirEndereço(message.body, conversationStates.get(userId).dados_end)
            if (dados_end) {
                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.APPROVING_ADRESS,
                dados_end: dados_end,
                timestamp: Date.now(),
                });
                console.log("dados_end", dados_end)
                console.log("state", conversationStates.get(userId))
                await client.sendMessage(message.from, f.formatarValidaEnd(conversationStates.get(userId).dados_end))
            }
            else {
                await client.sendMessage(message.from, `❌ Erro ao processar o endereço informado. Tente novamente.\nInforme, por escrito, o endereço completo, sempre com cidade, estado e cep.`)
            }
            
        }

        //decidindo como serão informadas as informações pessoais
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.HOW_PERS) {
            //imagem
            if (parseInt(message.body.trim()) === 1) {

                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_IMAGE_PERS,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `📸 Envie imagem de um documento pessoal.\n✅ Forneça uma imagem em boa definição e bem enquadrada.`)
            }
            //escrito
            else if (parseInt(message.body.trim()) === 2) {

                conversationStates.set(userId, {
                ...conversationStates.get(userId),
                state: CONVERSATION_STATES.WAITING_WRITE_PERS,
                timestamp: Date.now()
                });

                await client.sendMessage(message.from, `✍🏻 Forneça apenas o nome e o CPF da pessoa.`)
            }
            else {
                 await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
            }

        }
        
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

        else if (conversationStates.get(userId).state === CONVERSATION_STATES.WAITING_FINAL_APPROVAL) {
            if (parseInt(message.body.trim()) === 1) {
                let currentState = conversationStates.get(userId)
                // Dados estão corretos, enviar para FastAPI
                conversationStates.set(userId, {
                    ...currentState,
                    state: CONVERSATION_STATES.REQUEST_FASTAPI,
                    timestamp: Date.now()
                });

                await client.sendMessage(message.from, "⏳ Gerando documento... Aguarde um momento.")
                
                // Enviar para FastAPI
                await f.requestFastApi(
                    currentState.dados_pess,
                    currentState.dados_end,
                    currentState.selectedOption,
                    currentState.profissao,
                    currentState.estadoCivil,
                    message
                );
                
                // Limpar estado após processar
                conversationStates.delete(userId);
            }
            else if (parseInt(message.body.trim()) === 2) {
                let currentState = conversationStates.get(userId)
                await client.sendMessage(message.from, `
                    📝 *Informe as correções necessárias:*\n
                    🔧 *Exemplos de correções que você pode solicitar:*\n
                    • "Corrigir nome para Maria Silva Santos"\n
                    • "Alterar CPF para 987.654.321-00"\n
                    • "Mudar endereço para Rua Nova, 456, Centro"\n
                    • "Corrigir cidade para Rio de Janeiro"\n
                    • "Alterar profissão para Engenheiro"\n
                    • "Mudar estado civil para Casado"`)
                conversationStates.set(userId, {
                    ...currentState,
                    state: CONVERSATION_STATES.CORRECTING_FINAL,
                    timestamp: Date.now()
                });
            }

        }

        //CORRECTING_FINAL
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.CORRECTING_FINAL) {
            let currentState = conversationStates.get(userId)
            const dadosCorrigidos = await f.processarCorrecoesFinal(currentState, message.body, anthropic);
            if (dadosCorrigidos) {
                // Atualizar o estado com os dados corrigidos
                const estadoAtualizado = {
                    ...currentState,
                    dados_pess: dadosCorrigidos.dados_pess || currentState.dados_pess,
                    dados_end: dadosCorrigidos.dados_end || currentState.dados_end,
                    profissao: dadosCorrigidos.profissao !== undefined ? dadosCorrigidos.profissao : currentState.profissao,
                    estadoCivil: dadosCorrigidos.estadoCivil !== undefined ? dadosCorrigidos.estadoCivil : currentState.estadoCivil,
                    state: CONVERSATION_STATES.WAITING_FINAL_APPROVAL,
                    timestamp: Date.now()
                };
                
                conversationStates.set(userId, estadoAtualizado);
                
                // Mostrar o novo resumo com correções
                await client.sendMessage(message.from, "✅ Correções aplicadas!\n\n" + f.formatarResumoFinal(estadoAtualizado));
                
                conversationStates.set(userId, {
                    ...estadoAtualizado,
                    state: CONVERSATION_STATES.WAITING_FINAL_APPROVAL,
                    timestamp: Date.now()
                });
            } else {
                await message.sendMessage(message.from, "❌ Não foi possível processar as correções. Descreva novamente o que precisa ser alterado de forma mais específica.\n\nExemplo: 'Corrigir nome para João Silva' ou 'Alterar endereço para Rua Nova, 123'")
            }
        }

        // Comando não reconhecido no estado idle
        else if (conversationStates.get(userId).state === CONVERSATION_STATES.IDLE) {
            // Opcional: responder apenas se for um comando específico
            if (message.body.includes("proc") || message.body.includes("contrato")) {
                await message.reply("💡 Digite 'fazer_proc' para iniciar o processo de criação de procuração/contrato.");
                conversationStates.delete(userId);
            }
        }
    }
    catch (error) {
        console.log(error)
    }
})


//Limpar estados antigos periodicamente (para evitar vazamento de memória)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [userId, state] of conversationStates.entries()) {
        if (state.timestamp && state.timestamp < oneHourAgo) {
            conversationStates.delete(userId);
        }
    }
}, 60 * 60 * 1000);

client.initialize();



