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







    //AQUI O RESTO

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