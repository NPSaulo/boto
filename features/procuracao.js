import { PROCURACAO_STATES } from '../states.js';
import * as f from '../funcoes.js';


export async function handleProcuracaoConversation(message, currentState, client) {
    // primeiro estado = feature_state limpo
    if (currentState.featureState === null) {
        const fastApiResponse = await fetch('http://127.0.0.1:8000/teste', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!fastApiResponse.ok) {
            throw new Error(`Erro HTTP: ${fastApiResponse.status}`);
        }

        const fastApiData = await fastApiResponse.json();
        
        if (!fastApiData.data || !Array.isArray(fastApiData.data) || fastApiData.data.length === 0) {
            await message.reply("❌ Nenhuma opção de procuração/contrato disponível no momento.");
            return { cancel: true }; // Sinaliza para encerrar a feature
        }
        
        const newState = {
            ...currentState,
            featureState: PROCURACAO_STATES.SELECTING_TYPE,
            featureData: {
                options: fastApiData.data,
                timestamp: Date.now()
            }
        };
        
        const optionsMessage = f.formatOptionsMessage(fastApiData.data);
        await client.sendMessage(message.from, optionsMessage);
        return newState;
    }

    // A partir daqui se destrincha em cada etapa da conversa
    const { featureState, featureData } = currentState;

    if (featureState === PROCURACAO_STATES.SELECTING_TYPE) {
        const selectedIndex = f.validateSelection(message.body, featureData.options.length);    
        
        if (selectedIndex === null) {
            await message.reply(`❌ Opção inválida. Por favor, digite um número entre 1 e ${featureData.options.length}.`);
            return currentState; // Retorna o estado sem alteração
        }
            
        const selectedOption = featureData.options[selectedIndex];
    
        const newState = {
            ...currentState,
            featureState: PROCURACAO_STATES.IF_ADRESS,
            featureData: {
                ...featureData,
                selectedOption: selectedOption,
                timestamp: Date.now()
            }
        };
        await client.sendMessage(message.from, `Opção selecionada: ${selectedOption.demanda}`);
        await client.sendMessage(message.from, f.formatarSeEndereço());
        return newState;
    }

    else if (featureState === PROCURACAO_STATES.IF_ADRESS) {
        let nextState = null;
        let messageToSend = null;
        let informa_endereco = null;

        if (parseInt(message.body.trim()) === 1) {
            nextState = PROCURACAO_STATES.WAITING_IMAGE_ADRESS;
            informa_endereco = true;
            messageToSend = `Envie a imagem com o endereço.\nForneça uma imagem em boa definição e bem enquadrada.`;
        } else if (parseInt(message.body.trim()) === 2) {
            nextState = PROCURACAO_STATES.WAITING_WRITE_ADRESS;
            informa_endereco = true;
            messageToSend = `✍🏻 Forneça o endereço por escrito.\nNão deixe de informar cidade, estado e CEP.`;
        } else if (parseInt(message.body.trim()) === 3) {
            nextState = PROCURACAO_STATES.HOW_PERS;
            informa_endereco = false;
            messageToSend = f.formatarOpcaoInfoPessoal();
        } else {
            await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`);
            return currentState;
        }

        await client.sendMessage(message.from, messageToSend);

        return {
            ...currentState,
            featureState: nextState,
            featureData: {
                ...featureData,
                informa_endereco: informa_endereco,
                timestamp: Date.now()
            }
        };
    }

    else if (featureState === PROCURACAO_STATES.WAITING_IMAGE_ADRESS) {
        //let nextState = null;
        //let messageToSend = null;
        let dados_end = await f.processarImagem(message, 'adr');
        if (dados_end) {
            let nextState = PROCURACAO_STATES.APPROVING_ADRESS;
            let messageToSend = f.formatarValidaEnd(dados_end)
            await client.sendMessage(message.from, messageToSend)

            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    dados_end: dados_end,
                    timestamp: Date.now()
                }
            }
        }
        else {
            messageToSend = "🔄 Tente novamente com outra imagem, ou digite 'cancelar' para recomeçar."
            await client.sendMessage(message.from, messageToSend)

            return currentState
        }
    }

    else if (featureState === PROCURACAO_STATES.WAITING_WRITE_ADRESS) {
        let dados_end = await f.processarEscrita(message, 'adr')
        if (dados_end) {
            let nextState = PROCURACAO_STATES.APPROVING_ADRESS;
            let messageToSend = f.formatarValidaEnd(dados_end)
            await client.sendMessage(message.from, messageToSend)

            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    dados_end: dados_end,
                    timestamp: Date.now()
                }
            }
        }
        else {
            messageToSend = "❌ Não foi possível processar a informação escrita de endereço."
            await client.sendMessage(message.from, messageToSend)

            return currentState
        }
    }

    else if (featureState === PROCURACAO_STATES.APPROVING_ADRESS) {
        if (parseInt(message.body.trim()) === 1) {
            let nextState = PROCURACAO_STATES.HOW_PERS
            await client.sendMessage(message.from, f.formatarOpcaoInfoPessoal())
            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            }
        }
        else if (parseInt(message.body.trim()) === 2) {
            let nextState = PROCURACAO_STATES.CORRECTING_ADRESS
            let messageToSend = '❓ Diga o que precisa ser corrigido'+
                                '\nPor exemplo: "troque a cidade para ___;'+
                                '\ntroque o número para __ e o bairro para ___.'
            await client.sendMessage(message.from, messageToSend)
            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            }
        }
        else {
            await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
            return currentState
        }
    }

    else if (featureState === PROCURACAO_STATES.CORRECTING_ADRESS) {
        let dados_end = await f.corrigirEndereço(message.body, currentState.dados_end)
        if (dados_end) {
            let nextState = PROCURACAO_STATES.APPROVING_ADRESS
            currentState = {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    dados_end: dados_end,
                    timestamp: Date.now()
                }
            }
            let messageToSend = f.formatarValidaEnd(currentState.dados_end)
            await client.sendMessage(message.from, messageToSend)
        }
        else {
            let messageToSend = '❌ Erro ao processar o endereço informado. Tente novamente.'+
                                '\nInforme, por escrito, o endereço completo, sempre com cidade, estado e cep.'
            await client.sendMessage(message.from, messageToSend)
            return currentState
        }
             
        
    }

    else if (featureState === PROCURACAO_STATES.HOW_PERS) {
        //imagem
        if (parseInt(message.body.trim()) === 1) {
            let nextState = PROCURACAO_STATES.WAITING_IMAGE_PERS
            let messageToSend = '📸 Envie imagem de um documento pessoal.\n✅ Forneça uma imagem em boa definição e bem enquadrada.'
            await client.sendMessage(message.from, messageToSend)
            
            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            }
        }
        //escrito
        else if (parseInt(message.body.trim()) === 2) {
            let nextState = PROCURACAO_STATES.WAITING_WRITE_PERS
            let messageToSend = '✍🏻 Forneça apenas o nome e o CPF da pessoa.'
            await client.sendMessage(message.from, messageToSend)
            
            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            }
        }

        else {
             await client.sendMessage(message.from, `Opção inválida. ☝️ Tente novamente.`)
             return currentState
        }
    }

    else if (featureState === PROCURACAO_STATES.WAITING_IMAGE_PERS) {
        const dados_pess = await f.processarImagem(message, 'pers');

        if (dados_pess) {
            await client.sendMessage(message.from, f.formatarValidaPess(dados_pess));
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.APPROVING_PERS,
                featureData: {
                    ...featureData,
                    dados_pess: dados_pess,
                    timestamp: Date.now()
                }
            };
        } else {
            const lines = [
                '❌ Não foi possível processar a imagem.',
                '🔄 Tente novamente.',
                '📸 Procure enviar uma imagem em boa definição e bem enquadrada.'
            ];
            await client.sendMessage(message.from, lines.join('\n'));
            return currentState; // Continua no mesmo estado
        }
    }

    // Processar texto com informações pessoais
    else if (featureState === PROCURACAO_STATES.WAITING_WRITE_PERS) {
        const dados_pess = await f.processarEscrita(message, 'pers');
        
        if (dados_pess) {
            await client.sendMessage(message.from, f.formatarValidaPess(dados_pess));
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.APPROVING_PERS,
                featureData: {
                    ...featureData,
                    dados_pess: dados_pess,
                    timestamp: Date.now()
                }
            };
        } else {
            const lines = [
                'Não foi possível processar o texto.',
                'Tente novamente.',
                'Certifique-se de fornecer apenas nome completo e CPF.',
                'Por exemplo: "Gerônimo Pereira, cpf 000 000 000 00."'
            ];
            await client.sendMessage(message.from, lines.join('\n'));
            return currentState;
        }
    }

    // Aguardando aprovação das informações pessoais
    else if (featureState === PROCURACAO_STATES.APPROVING_PERS) {
        const choice = parseInt(message.body.trim());

        if (choice === 1) { // Dados corretos
            await client.sendMessage(message.from, 'Informar profissão?\n👍1 - Sim;\n👎2 - Não.');
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.WAITING_JOB,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else if (choice === 2) { // Corrigir dados
            await client.sendMessage(message.from, "✍🏻 Informe nome completo e CPF.");
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.CORRECTING_PERS,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else {
            await client.sendMessage(message.from, 'Opção inválida. ☝️ Tente novamente.');
            return currentState;
        }
    }

    // Corrigindo informações pessoais
    else if (featureState === PROCURACAO_STATES.CORRECTING_PERS) {
        const dados_pess = await f.corrigirPessoais(message.body);

        if (dados_pess) {
            await client.sendMessage(message.from, f.formatarValidaPess(dados_pess));
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.APPROVING_PERS,
                featureData: {
                    ...featureData,
                    dados_pess: dados_pess,
                    timestamp: Date.now()
                }
            };
        } else {
            const lines = [
                'Erro ao processar as informações pessoais fornecidas. Tente novamente.',
                'Informe, por escrito, nome completo e CPF do sujeito.'
            ];
            await client.sendMessage(message.from, lines.join('\n'));
            return currentState;
        }
    }

    // Perguntando se informa a profissão
    else if (featureState === PROCURACAO_STATES.WAITING_JOB) {
        const choice = parseInt(message.body.trim());

        if (choice === 1) { // Sim, informar profissão
            await client.sendMessage(message.from, 'Informe a profissão, exatamente como deve sair no documento.');
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.WAITING_WRITE_JOB,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else if (choice === 2) { // Não, pular para estado civil
            await client.sendMessage(message.from, 'Informar estado civil?\n1 - Sim;\n2 - Não.');
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.IF_MARIT,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else {
            await client.sendMessage(message.from, 'Opção inválida. ☝️ Tente novamente.');
            return currentState;
        }
    }

    // Aguardando o texto da profissão
    else if (featureState === PROCURACAO_STATES.WAITING_WRITE_JOB) {
        const profissao = message.body.trim();

        if (profissao && profissao.length > 0) {
            await client.sendMessage(message.from, 'Informar estado civil?\n1 - Sim;\n2 - Não.');
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.IF_MARIT,
                featureData: {
                    ...featureData,
                    profissao: profissao,
                    timestamp: Date.now()
                }
            };
        } else {
            await client.sendMessage(message.from, 'Por favor, informe a profissão.');
            return currentState;
        }
    }

    else if (featureState === PROCURACAO_STATES.IF_MARIT) {
        const choice = parseInt(message.body.trim());

        if (choice === 1) { // Sim, informar estado civil
            await client.sendMessage(message.from, 'Informe o estado civil, exatamente como deve sair no documento.');
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.WAITING_MARIT,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else if (choice === 2) { // Não, ir para aprovação final
            await client.sendMessage(message.from, f.formatarResumoFinal(currentState));
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.WAITING_FINAL_APPROVAL,
                featureData: { ...featureData, timestamp: Date.now() }
            };
        } else {
            await client.sendMessage(message.from, 'Opção inválida. ☝️ Tente novamente.');
            return currentState;
        }
    }

    else if (featureState === PROCURACAO_STATES.WAITING_MARIT) {
        const estadoCivil = message.body.trim();

        if (estadoCivil && estadoCivil.length > 0) {
            // Cria um estado temporário para enviar o resumo já com o estado civil
            const tempState = {
                ...currentState,
                featureData: {
                    ...featureData,
                    estadoCivil: estadoCivil
                }
            };
            await client.sendMessage(message.from, f.formatarResumoFinal(tempState));

            // Retorna o estado final atualizado
            return {
                ...currentState,
                featureState: PROCURACAO_STATES.WAITING_FINAL_APPROVAL,
                featureData: {
                    ...featureData,
                    estadoCivil: estadoCivil,
                    timestamp: Date.now()
                }
            };
        } else {
            await client.sendMessage(message.from, 'Por favor, informe um estado civil.');
            return currentState;
        }
    }

    else if (featureState === PROCURACAO_STATES.WAITING_FINAL_APPROVAL) {
        
        if (parseInt(message.body.trim()) === 1) {
            // Dados estão corretos, enviar para FastAPI
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
            
            return { finished: true} // Sinaliza que a feature terminou com sucesso

        }

        else if (parseInt(message.body.trim()) === 2) {
            let nextState = PROCURACAO_STATES.CORRECTING_FINAL
            let messageToSend = `
                📝 *Informe as correções necessárias:*\n
                🔧 *Exemplos de correções que você pode solicitar:*\n
                • "Corrigir nome para Maria Silva Santos"\n
                • "Alterar CPF para 987.654.321-00"\n
                • "Mudar endereço para Rua Nova, 456, Centro"\n
                • "Corrigir cidade para Rio de Janeiro"\n
                • "Alterar profissão para Engenheiro"\n
                • "Mudar estado civil para casado"`
            await client.sendMessage(message.from, messageToSend)
            return {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now()
                }
            }
        }

    }

    else if (featureState === PROCURACAO_STATES.CORRECTING_FINAL) {
        const dadosCorrigidos = await f.processarCorrecoesFinal(currentState, message.body, anthropic);
        if (dadosCorrigidos) {
            let nextState = PROCURACAO_STATES.WAITING_FINAL_APPROVAL

            let estadoAtualizado = {
                ...currentState,
                featureState: nextState,
                featureData: {
                    ...featureData,
                    timestamp: Date.now(),
                    dados_pess: dadosCorrigidos.dados_pess || currentState.dados_pess,
                    dados_end: dadosCorrigidos.dados_end || currentState.dados_end,
                    profissao: dadosCorrigidos.profissao !== undefined ? dadosCorrigidos.profissao : currentState.profissao,
                    estadoCivil: dadosCorrigidos.estadoCivil !== undefined ? dadosCorrigidos.estadoCivil : currentState.estadoCivil
                }
            }

            let messageToSend = "✅ Correções aplicadas!\n\n" + f.formatarResumoFinal(estadoAtualizado)
            await client.sendMessage(message.from, messageToSend);

            return estadoAtualizado
        }
        else {
            let messageToSend = `❌ Não foi possível processar as correções. Descreva novamente o que precisa ser alterado de forma mais específica.
            \n\nExemplo: 'Corrigir nome para João Silva' ou 'Alterar endereço para Rua Nova, 123'`
            await client.sendMessage(message.from, messageToSend);
           
            return currentState
        }
    }
}