import * as dotenv from 'dotenv';
dotenv.config();
import fs from 'fs'
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic()

const ARQUIVO_JSON = 'info_vistos.json';

async function extrairDadosDaPagina(url) {
    let browser = null; // Declaramos o browser fora do try para que ele seja acessível no finally

    console.log(`Iniciando o scraping para a URL: ${url}`);

    try {
        // 2. INICIALIZAÇÃO DO NAVEGADOR
        // Lançamos uma nova instância do navegador.
        // O `{ headless: true }` (padrão) faz com que o navegador rode em segundo plano.
        // Para depuração, você pode usar `{ headless: false }` para ver o que o bot está fazendo.
        browser = await chromium.launch({ headless: true });

        // Criamos um novo contexto e uma nova página.
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log('Página carregada com sucesso.');

        //clicando na aba de edições de informativo
        await page.click('#ui-id-2')

        await page.waitForSelector('#idInformativoEdicoesCombo2025', {state: 'visible'})

        let selectEdicoes = page.locator('#idInformativoEdicoesCombo2025');
        let primeiraOpcao = await selectEdicoes.locator('option').first();
        let valorPrimeiraOpcao = await primeiraOpcao.getAttribute('value');
        
        await selectEdicoes.selectOption({ value: valorPrimeiraOpcao });
        
        let textoSelecionado = await selectEdicoes.locator(`option[value="${valorPrimeiraOpcao}"]`).textContent();
        console.log(`Opção mais recente selecionada: ${textoSelecionado.trim()}`);

        let dadosExtraidos = {
            pagina: await page.title(),
            edicaoSelecionada: {
                valor: valorPrimeiraOpcao,
                texto: textoSelecionado.trim()
            }
        };

        console.log('Dados extraídos:', dadosExtraidos);

        let conteudoArquivo = fs.readFileSync(ARQUIVO_JSON, 'utf-8');
        let dados = JSON.parse(conteudoArquivo);
        console.log(dados)
        let ultimo_informativo = Number(dadosExtraidos.edicaoSelecionada.valor)
        let jaVisto = dados.data.edicoes_ordinarias.some(
            (edicao) => edicao.edicao === ultimo_informativo
        );

        // 3. Tomar a decisão
        if (jaVisto) {
            // Se já foi visto, apenas informa e encerra
            console.log(`[STATUS] O informativo ordinário nº ${ultimo_informativo} já foi visto. Nenhuma ação necessária.`);
        } else {
            // Se não foi visto, executa as ações
            console.log(`[STATUS] Novo informativo ordinário (nº ${ultimo_informativo}) encontrado.`);
            const navigationPromise = page.waitForLoadState('domcontentloaded');
            await page.click("#idBaixarEdicaoAnterior")
            await navigationPromise
            await page.waitForSelector('#idInformativoBlocoLista', {state: 'visible'})
            const containerPrincipal = page.locator('#idInformativoBlocoLista');

            // 2. Localiza todos os itens de informativo dentro do contêiner
            const todosOsItens = await containerPrincipal.locator('.clsInformativoBlocoItem').all();
            console.log(`[INFO] ${todosOsItens.length} blocos de informativo encontrados.`);

            const resultadosFinais = [];

            for (const [index, item] of todosOsItens.entries()) {
                console.log(`-- Processando item ${index + 1}/${todosOsItens.length}...`);

                // 1. Extrai o HTML completo do bloco do item
                const htmlDoItem = await item.innerHTML();
                let requestBody = {
                    html: htmlDoItem
                }
                const fastApiResponse = await fetch('http://127.0.0.1:8000/analisar_html_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
                });


                // 3. Adiciona o resultado à lista final
                resultadosFinais.push({
                    item: index + 1
                });
            }
            console.log(resultadosFinais)
            /*
            const novoRegistro = {
                edicao: ultimo_informativo,
                // Gera um timestamp Unix (em segundos), similar ao do seu JSON
                visto_em: Math.floor(Date.now() / 1000) 
            };

            dados.data.edicoes_ordinarias.push(novoRegistro);

                // Opcional: Mantém a lista ordenada pela edição mais recente
                dados.data.edicoes_ordinarias.sort((a, b) => b.edicao - a.edicao);

                // 4. Salva o arquivo JSON atualizado
                // JSON.stringify com os argumentos 'null, 4' formata o arquivo de forma legível
                let novoConteudo = JSON.stringify(dados, null, 4);
                fs.writeFileSync(ARQUIVO_JSON, novoConteudo, 'utf-8');
                
                console.log(`[SUCESSO] O arquivo ${ARQUIVO_JSON} foi atualizado com o informativo nº ${ultimo_informativo}.`);
            */
        }
        //partindo para as edições extraordinárias
        await page.click('#ui-id-3')

        await page.waitForSelector('#idInformativoEdicoesComboE', {state: 'visible'})

        selectEdicoes = page.locator('#idInformativoEdicoesComboE');
        primeiraOpcao = await selectEdicoes.locator('option').first();
        valorPrimeiraOpcao = await primeiraOpcao.getAttribute('value');
        
        await selectEdicoes.selectOption({ value: valorPrimeiraOpcao });
        
        textoSelecionado = await selectEdicoes.locator(`option[value="${valorPrimeiraOpcao}"]`).textContent();
        console.log(`Opção mais recente selecionada: ${textoSelecionado.trim()}`);

        dadosExtraidos = {
            pagina: await page.title(),
            edicaoSelecionada: {
                valor: valorPrimeiraOpcao,
                texto: textoSelecionado.trim()
            }
        };

        console.log('Dados extraídos:', dadosExtraidos);
        conteudoArquivo = fs.readFileSync(ARQUIVO_JSON, 'utf-8');
        dados = JSON.parse(conteudoArquivo);
        ultimo_informativo = Number(dadosExtraidos.edicaoSelecionada.valor.slice(0,-1)) //lendo até o penúltimo caractere pois o valor vem como, por ex., "0027E"
        jaVisto = dados.data.edicoes_extra.some(
            (edicao) => edicao.edicao === ultimo_informativo
        );

        // 3. Tomar a decisão
        if (jaVisto) {
            // Se já foi visto, apenas informa e encerra
            console.log(`[STATUS] O informativo extraordinário nº ${ultimo_informativo} já foi visto. Nenhuma ação necessária.`);
        } else {
            // Se não foi visto, executa as ações
            console.log(`[STATUS] Novo informativo extraordinário (nº ${ultimo_informativo}) encontrado.`);

            //scraping aqui

            const novoRegistro = {
                edicao: ultimo_informativo,
                // Gera um timestamp Unix (em segundos), similar ao do seu JSON
                visto_em: Math.floor(Date.now() / 1000) 
            };

            dados.data.edicoes_extra.push(novoRegistro);

            // Opcional: Mantém a lista ordenada pela edição mais recente
            dados.data.edicoes_extra.sort((a, b) => b.edicao - a.edicao);

            // 4. Salva o arquivo JSON atualizado
            // JSON.stringify com os argumentos 'null, 4' formata o arquivo de forma legível
            let novoConteudo = JSON.stringify(dados, null, 4);
            fs.writeFileSync(ARQUIVO_JSON, novoConteudo, 'utf-8');
            
            console.log(`[SUCESSO] O arquivo ${ARQUIVO_JSON} foi atualizado com o informativo extraordinário nº ${ultimo_informativo}.`);
        }
    }
     catch (error) {
        // 4. TRATAMENTO DE ERROS
        console.error(`Ocorreu um erro durante o scraping: ${error.message}`);
        return null; // Retorna nulo para indicar que a operação falhou.

    } finally {
        // 5. FINALIZAÇÃO
        // Este bloco será executado sempre, tendo ocorrido erro ou não.
        // É crucial para garantir que o navegador seja fechado e não consuma memória.
        if (browser) {
            await browser.close();
            console.log('Navegador fechado.');
        }
    }
}




async function analisarComLLM(htmlDoItem) {
    console.log('   [LLM] Enviando bloco HTML para análise...');
    let system_prompt = 
`Você é um assistente especializado em análise de documentos jurídicos. Sua tarefa é analisar o conteúdo HTML de um informativo de jurisprudência e extrair informações específicas.

Instruções:

1 - Leia o HTML fornecido.

2 - Identifique a matéria principal (o tema central) que foi objeto de julgamento ou afetação, de maneira concisa.

3 - Verifique se o recurso foi "julgado" ou está "afeto a julgamento".

4 - Retorne sua resposta exclusivamente no formato JSON, contendo as chaves "materia_principal" e "status_julgamento".

5 - A chave "status_julgamento" deve conter APENAS os valores "julgado" ou "afetado"


Exemplo de Resposta:
{
  "materia_principal": "Adicional noturno de Agente Federal de Execução Penal durante períodos de afastamento, como férias e licenças.",
  "status_julgamento": "julgado"
}`
    const msg = await anthropic.messages.create({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1024,
        system: system_prompt,
        messages: [
            { role: "user", content: htmlDoItem }],
      });

    return msg
}


// BLOCO DE EXECUÇÃO
// Usamos uma função auto-executável para poder usar `await`.
(async () => {
    // Defina aqui a URL que você quer analisar.
    const urlAlvo = 'https://processo.stj.jus.br/jurisprudencia/externo/informativo/'; 

    const dados = await extrairDadosDaPagina(urlAlvo);
})();