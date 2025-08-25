import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const API_KEY = process.env.API_KEY
const anthropic = new Anthropic({
    apiKey: API_KEY
})

// Função para formatar opções em uma mensagem
export function formatOptionsMessage(options) {
    let message = "📋 *Selecione o tipo de procuração/contrato:*\n\n";
    
    options.forEach((option, index) => {
        message += `*${index + 1}* - ${option.demanda}\n`;
        message += `   📝 ${option.proc_finalidade.substring(0, 100)}...\n\n`;
    });
    
    message += "💬 *Responda com o número da opção desejada*";
    return message;
}

// Função para validar seleção do usuário
export function validateSelection(userInput, optionsLength) {
    const selection = parseInt(userInput.trim());
    return selection >= 1 && selection <= optionsLength ? selection - 1 : null;
}

export async function processarImagem(message, which){
    try {
        const media = await message.downloadMedia();
        
        // Verificar se é uma imagem
        if (!media.mimetype.startsWith('image/')) {
            await message.reply('Por favor, envie apenas imagens.');
            return;
        }
        let dados
        let response
        if (which === 'pers') {
            response = await extrairDadosImagemAnthropicPers(media)
        
        }
        //se endereço
        else {
            response = await extrairDadosImagemAnthropicAdress(media)
        
        }
        try {
            dados = JSON.parse(response.content[0].text)
            console.log(dados)
        }
        catch (jsonError) {
            console.log("Erro ao processar o JSON retornado pelo LLM:", jsonError);
            await message.reply('Erro ao processar os dados extraídos. Tente novamente com uma imagem mais clara.');
            return;
        }
        
        if (which === 'pers') {
            if (!dados.nome || !dados.cpf) {
            await message.reply(`❌ Não foi possível extrair o nome ou CPF do documento. \n
                                Verifique se a imagem está legível e contém essas informações.`);
            return;
            }
        }
        else {
            if (!dados.endereco || !dados.cidade || !dados.cidade) {
            await message.reply(`❌ Não foi possível extrair o endereço completo.\nVerifique se a imagem está legível e contém essas informações.`);
            return;
            }
        
        }
        return dados

        } catch (error) {
        console.error('Erro ao processar imagem:', error);
        await message.reply('Ocorreu um erro ao processar sua imagem. Tente novamente.');
        return false
        }
    }

export async function processarEscrita(message, which) {
    try {
        // Verificar se há texto na mensagem
        if (!message.body || message.body.trim().length === 0) {
            await message.reply('Por favor, digite as informações solicitadas.');
            return;
        }

        let dados;
        let response;
        
        if (which === 'pers') {
            response = await extrairDadosEscritaAnthropicPers(message.body);
        }
        // se endereço
        else {
            response = await extrairDadosEscritaAnthropicAdress(message.body);
        }
        
        try {
            dados = JSON.parse(response.content[0].text);
        }
        catch (jsonError) {
            console.log("Erro ao processar o JSON retornado pelo LLM:", jsonError);
            await message.reply('Erro ao processar os dados extraídos. Tente reescrever as informações de forma mais clara.');
            return;
        }
        
        if (which === 'pers') {
            if (!dados.nome || !dados.cpf) {
                await message.reply(`❌ Não foi possível extrair o nome ou CPF do texto. \n
                                    Verifique se você forneceu nome completo e CPF.\n
                                    Exemplo: "João Silva Santos, CPF: 123.456.789-00"`);
                return;
            }
        }
        else {
            if (!dados.endereco || !dados.cidade || !dados.estado) {
                await message.reply(`❌ Não foi possível extrair o endereço completo. \n
                                    Verifique se você forneceu endereço, cidade e estado.\n
                                    Exemplo: "Rua das Flores, 123, Centro, São Paulo, SP, 01234-567"`);
                return;
            }
        }
        
        return dados;
        
    } catch (error) {
        console.error('Erro ao processar texto:', error);
        await message.reply('Ocorreu um erro ao processar seu texto. Tente novamente.');
        return false;
    }
}

async function extrairDadosImagemAnthropicPers(media) {
    const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 200,
        temperature: 0,
        system: `Você é um assistente especializado em extrair informações de documentos. 
        Sua tarefa é analisar imagens de documentos e extrair nome completo e CPF. 
        SEMPRE responda em formato JSON válido com as chaves 'nome' e 'cpf'. 
        Se não conseguir encontrar alguma informação, use null para o valor. 
        Exemplo de resposta: {\"nome\": \"João Silva Santos\", \"cpf\": \"123.456.789-00\"}`,
        messages: [
            {
                role: "user", 
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: media.mimetype, // Usa o mimetype real da imagem
                            data: media.data // Usa os dados base64 da imagem baixada
                        }
                    },
                    {
                        type: "text", 
                        text: "Extraia do documento fornecido o nome e CPF da pessoa, formato especificado"
                    }
                ]
            }
        ]
    });
    return response
}

async function extrairDadosImagemAnthropicAdress(media) {
    const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 300,
        temperature: 0,
        system: `Você é um assistente especializado em extrair informações de endereços de comprovantes de endereço. 
        Sua tarefa é analisar imagens de comprovantes de endereço (contas de luz, água, telefone, etc.) e extrair o endereço completo. 
        SEMPRE responda em formato JSON válido com as chaves: 'cidade', 'estado', 'endereco', 'cep'. 
        No campo 'endereco', inclua logradouro, número, complemento e bairro em uma única string.
        Se não conseguir encontrar alguma informação, use null para o valor. 
        Exemplo de resposta: {
            "cidade": "São Paulo",
            "estado": "SP",
            "endereco": "Rua das Flores, 123, Apto 45, Centro",
            "cep": "01234-567"
        }`,
        messages: [
            {
                role: "user", 
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: media.mimetype,
                            data: media.data
                        }
                    },
                    {
                        type: "text", 
                        text: "Extraia do comprovante de endereço fornecido as informações de cidade, estado, endereço completo (logradouro, número, complemento e bairro em uma única string) e CEP, retornando no formato JSON especificado"
                    }
                ]
            }
        ]
    });
    console.log(response)
    return response;
}

async function extrairDadosEscritaAnthropicPers(texto) {
    const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 200,
        temperature: 0,
        system: `Você é um assistente especializado em extrair informações pessoais de textos escritos. 
        Sua tarefa é analisar textos e extrair nome completo e CPF. 
        SEMPRE responda em formato JSON válido com as chaves 'nome' e 'cpf'. 
        Se não conseguir encontrar alguma informação, use null para o valor. 
        Exemplo de resposta: {"nome": "João Silva Santos", "cpf": "123.456.789-00"}`,
        messages: [
            {
                role: "user", 
                content: [
                    {
                        type: "text", 
                        text: `Extraia do texto fornecido o nome completo e CPF da pessoa, retornando no formato JSON especificado.
                        
                        Texto: ${texto}`
                    }
                ]
            }
        ]
    });
    return response;
}

async function extrairDadosEscritaAnthropicAdress(texto) {
    const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 300,
        temperature: 0,
        system: `Você é um assistente especializado em corrigir informações de endereços de textos escritos. 
        Sua tarefa é analisar textos e extrair endereço completo, cidade, estado e CEP. 
        SEMPRE responda em formato JSON válido com as chaves: 'cidade', 'estado', 'endereco', 'cep'. 
        No campo 'endereco', inclua logradouro, número, complemento e bairro em uma única string.
        Se não conseguir encontrar alguma informação, use null para o valor. 
        Exemplo de resposta: {
            "cidade": "São Paulo",
            "estado": "SP",
            "endereco": "Rua das Flores, 123, Apto 45, Centro",
            "cep": "01234-567"
        }`,
        messages: [
            {
                role: "user", 
                content: [
                    {
                        type: "text", 
                        text: `Extraia do texto fornecido as informações de cidade, estado, endereço completo (logradouro, número, complemento e bairro em uma única string) e CEP, retornando no formato JSON especificado.
                        
                        Texto: ${texto}`
                    }
                ]
            }
        ]
    });
    return response;
}


// Função para corrigir informações pessoais
export async function corrigirPessoais(texto) {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 200,
            temperature: 0,
            system: `Você é um assistente especializado em extrair informações pessoais de textos escritos. 
            Sua tarefa é analisar textos e extrair nome completo e CPF. 
            SEMPRE responda em formato JSON válido com as chaves 'nome' e 'cpf'. 
            Se não conseguir encontrar alguma informação, use null para o valor. 
            Exemplo de resposta: {"nome": "João Silva Santos", "cpf": "123.456.789-00"}`,
            messages: [
                {
                    role: "user", 
                    content: [
                        {
                            type: "text", 
                            text: `Extraia do texto fornecido o nome completo e CPF da pessoa, retornando no formato JSON especificado.
                            
                            Texto: ${texto}`
                        }
                    ]
                }
            ]
        });
        console.log(response.content[0].text)
        const dados = JSON.parse(response.content[0].text);
        console.log(dados)
        return dados;
    } catch (error) {
        console.error('Erro ao corrigir dados pessoais:', error);
        return null;
    }
}

// Função para corrigir endereço
export async function corrigirEndereço(correcaoSolicitada, dadosAtuais) {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 500,
            temperature: 0,
            system: `Você é um assistente especializado em processar correções de endereço.
            
            Sua tarefa é analisar os dados atuais e as correções solicitadas pelo usuário, então retornar um JSON com os dados corrigidos.
            
            REGRAS IMPORTANTES:
            1. Mantenha todos os dados que NÃO foram mencionados para correção
            2. Aplique apenas as correções especificamente solicitadas
            3. SEMPRE responda em formato JSON válido
            4. Use as mesmas chaves da estrutura de dados atual
            5. Se não conseguir entender a correção, retorne os dados originais
            
            Estrutura de resposta esperada:
            {
                "dados_end": {"endereco": "...", "cidade": "...", "estado": "...", "cep": "..."}
            }`,
            messages: [
                {
                    role: "user", 
                    content: [
                        {
                            type: "text", 
                            text: `DADOS ATUAIS: ${JSON.stringify(dadosAtuais, null, 2)} \n
                                    CORREÇÃO SOLICITADA PELO USUÁRIO: ${correcaoSolicitada} \n
                                    Processe a correção e retorne os dados atualizados no formato JSON especificado. \n
                                    \n Não dê qualquer informação adicional além da resposta em formato JSON. \n
                                    Mantenha todos os dados que não foram alterados.`
                        }
                    ]
                }
            ]
        });
        console.log(response.content[0].text)
        const dados = JSON.parse(response.content[0].text);
        return dados;
    } catch (error) {
        console.error('Erro ao corrigir endereço:', error);
        return null;
    }
}

export async function requestFastApi(dados_pess, dados_end, option, profissao, estadoCivil, message){
    // Enviar dados para a FastAPI
    try {
        let requestBody = {
            nome: dados_pess.nome,
            cpf: dados_pess.cpf,
            finalidade_proc: option.proc_finalidade,
            objeto_con: option.con_objeto,
            remunera_con_1: option.boto_1d3,
            remunera_con_2: option.boto_2d3,
            remunera_con_3: option.boto_3d3,
            informa_endereco: false,
            informa_prof: false,
            informa_civ: false,
        };

        // Adicionar dados opcionais se disponíveis
        if (dados_end) {
            requestBody.cidade = dados_end.cidade;
            requestBody.estado = dados_end.estado;
            requestBody.endereco = dados_end.endereco;
            requestBody.cep = dados_end.cep;
            requestBody.informa_endereco = true;
        }

        if (profissao) {
            requestBody.profissao = profissao;
            requestBody.informa_prof = true;
        }

        if (estadoCivil) {
            requestBody.estado_civil = estadoCivil;
            requestBody.informa_civ = true;
        }

        console.log(requestBody)
        const fastApiResponse = await fetch('http://127.0.0.1:8000/proc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!fastApiResponse.ok) {
            throw new Error(`Erro HTTP: ${fastApiResponse.status}`);
        }

        const fastApiData = await fastApiResponse.json();
        
        // Formatear resposta baseada nos dados disponíveis
        let responseMessage = `✅ Procuração gerada com sucesso!\n\n📄 **Dados utilizados:**\n`;
        responseMessage += `• Nome: ${dados_pess.nome}\n`;
        responseMessage += `• CPF: ${dados_pess.cpf}\n`;
        
        if (dados_end) {
            responseMessage += `• Endereço: ${dados_end.endereco}\n`;
            responseMessage += `• Cidade: ${dados_end.cidade}\n`;
            responseMessage += `• Estado: ${dados_end.estado}\n`;
            responseMessage += `• CEP: ${dados_end.cep}\n`;
        }
        
        if (profissao) {
            responseMessage += `• Profissão: ${profissao}\n`;
        }
        
        if (estadoCivil) {
            responseMessage += `• Estado Civil: ${estadoCivil}\n`;
        }
        
        responseMessage += `\n${fastApiData.data.mensagem}`;
        
        await message.reply(responseMessage);
        
    } catch (fetchError) {
        console.error('Erro ao enviar para FastAPI:', fetchError);
        await message.reply(`❌ Erro ao gerar procuração: ${fetchError.message}`);
    }
}

export function formatarSeEndereço() {
    let message =   `Informar endereço? \n
                1 - 👁 Sim, enviar imagem; \n
                2 - ✍️ Sim, informar por escrito; \n
                3 - ❌ Não.`
    return message

}

export function formatarOpcaoInfoPessoal() {
    let message =   `Como o nome e CPF serão informados? \n
                1 - 👁 Por imagem; \n
                2 - ✍️ Por escrito.`
    return message
}

export function formatarValidaPess(dados) {
    let message = `📋 *Dados Pessoais Extraídos:*\n\n`;
    message += `👤 *Nome:* ${dados.nome || 'Não informado'}\n`;
    message += `📄 *CPF:* ${dados.cpf || 'Não informado'}\n\n`;
    message += `🔍 *Verifique se os dados estão corretos:*\n\n`;
    message += `*1* - ✅ Os dados estão corretos, prosseguir\n`;
    message += `*2* - ❌ Os dados estão incorretos, preciso corrigir\n\n`;
    message += `💬 *Responda com o número da opção desejada*`;
    
    return message
}

export function formatarValidaEnd(dados) {
    let message = `🏠 *Dados de Endereço Extraídos:*\n\n`;
    message += `📍 *Endereço:* ${dados.endereco}\n`;
    message += `🏙️ *Cidade:* ${dados.cidade}\n`;
    message += `📍 *Estado:* ${dados.estado}\n`;
    message += `📮 *CEP:* ${dados.cep}\n\n`;
    message += `🔍 *Verifique se os dados estão corretos:*\n\n`;
    message += `*1* - ✅ Os dados estão corretos, prosseguir\n`;
    message += `*2* - ❌ Os dados estão incorretos, preciso corrigir\n\n`;
    message += `💬 *Responda com o número da opção desejada*`;
    
    return message;
}

export function formatarResumoFinal(currentState) {
    let message = `📋 *RESUMO FINAL DOS DADOS:*\n\n`;
    
    // Dados pessoais obrigatórios
    message += `👤 *Nome:* ${currentState.featureData.dados_pess?.nome || 'Não informado'}\n`;
    message += `📄 *CPF:* ${currentState.featureData.dados_pess?.cpf || 'Não informado'}\n\n`;
    
    // Endereço (se informado)
    if (currentState.featureData.informa_endereco && currentState.featureData.dados_end) {
        message += `🏠 *ENDEREÇO:*\n`;
        message += `📍 *Endereço:* ${currentState.featureData.dados_end.endereco}\n`;
        message += `🏙️ *Cidade:* ${currentState.featureData.dados_end.cidade}\n`;
        message += `📍 *Estado:* ${currentState.featureData.dados_end.estado}\n`;
        message += `📮 *CEP:* ${currentState.featureData.dados_end.cep}\n\n`;
    }
    
    // Profissão (se informada)
    if (currentState.featureData.profissao) {
        message += `💼 *Profissão:* ${currentState.featureData.profissao}\n`;
    }
    
    // Estado civil (se informado)
    if (currentState.featureData.estadoCivil) {
        message += `💍 *Estado Civil:* ${currentState.featureData.estadoCivil}\n`;
    }
    
    // Tipo de procuração/contrato
    message += `\n📄 *TIPO DE DOCUMENTO:*\n`;
    message += `${currentState.featureData.selectedOption?.demanda || 'Não informado'}\n\n`;
    
    message += `🔍 *Confirme se todos os dados estão corretos:*\n\n`;
    message += `*1* - ✅ Todos os dados estão corretos, gerar documento\n`;
    message += `*2* - ❌ Preciso fazer correções\n\n`;
    message += `💬 *Responda com o número da opção desejada*`;
    
    return message;
}

export async function processarCorrecoesFinal(currentState, correcaoSolicitada) {
    try {
        // Preparar dados atuais para o LLM
        const dadosAtuais = {
            dados_pessoais: {
                nome: currentState.featureData.dados_pess?.nome,
                cpf: currentState.featureData.dados_pess?.cpf
            },
            dados_end: currentState.featureData.informa_endereco ? {
                endereco: currentState.featureData.dados_end?.endereco,
                cidade: currentState.featureData.dados_end?.cidade,
                estado: currentState.featureData.dados_end?.estado,
                cep: currentState.featureData.dados_end?.cep
            } : null,
            profissao: currentState.featureData.profissao || null,
            estado_civil: currentState.featureData.estadoCivil || null,
        };

        const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 500,
            temperature: 0,
            system: `Você é um assistente especializado em processar correções de dados pessoais e de endereço.
            
            Sua tarefa é analisar os dados atuais e as correções solicitadas pelo usuário, então retornar um JSON com os dados corrigidos.
            
            REGRAS IMPORTANTES:
            1. Mantenha todos os dados que NÃO foram mencionados para correção
            2. Aplique apenas as correções especificamente solicitadas
            3. SEMPRE responda em formato JSON válido
            4. Use as mesmas chaves da estrutura de dados atual
            5. Se o usuário solicitar correção de endereço, atualize os campos: endereco, cidade, estado, cep
            6. Se o usuário solicitar correção de dados pessoais, atualize: nome, cpf
            7. Se não conseguir entender a correção, retorne os dados originais
            
            Estrutura de resposta esperada:
            {
                "dados_pess": {"nome": "...", "cpf": "..."},
                "dados_end": {"endereco": "...", "cidade": "...", "estado": "...", "cep": "..."},
                "profissao": "...",
                "estadoCivil": "..."
            }`,
            messages: [
                {
                    role: "user", 
                    content: [
                        {
                            type: "text", 
                            text: `DADOS ATUAIS: ${JSON.stringify(dadosAtuais, null, 2)} \n
                                    CORREÇÃO SOLICITADA PELO USUÁRIO: ${correcaoSolicitada} \n
                                    Processe a correção e retorne os dados atualizados no formato JSON especificado. \n
                                    Mantenha todos os dados que não foram alterados.`
                        }
                    ]
                }
            ]
        });
        
        const dadosCorrigidos = JSON.parse(response.content[0].text);
        
        // Validar se os dados essenciais ainda estão presentes
        if (!dadosCorrigidos.dados_pess?.nome || !dadosCorrigidos.dados_pess?.cpf) {
            console.error('Correção resultou em dados pessoais inválidos');
            return null;
        }
        
        return dadosCorrigidos;
        
    } catch (error) {
        console.error('Erro ao processar correções:', error);
        return null;
    }
}
export const sleep = ms => new Promise(resolve => setTimeout(resolve,ms))
