from fastapi import FastAPI, Header, HTTPException, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from docxtpl import DocxTemplate
from docxtpl.richtext import RichTextParagraph, RichText
from datetime import datetime
from templates import TemplateSelector, ContextBuilder, DocumentProcessor
from models import ProcRequest, AnaliseInfoRequest, AnotarAfazerRequest, LMStudioRequest
from funcoes import analisar_html
from dotenv import load_dotenv
import os
import httpx


load_dotenv()


API_KEY_FROM_ENV = os.getenv("API_KEY")

if not API_KEY_FROM_ENV:
    raise ValueError("API_KEY não localizada no arquivo .env.")

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

async def get_api_key(x_api_key: str = Header(..., description="Your API key")) -> str:
    if x_api_key != API_KEY_FROM_ENV:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    return x_api_key

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/proc", dependencies=[Depends(get_api_key)])
async def fazer_proc_cont(request: ProcRequest):
    try:
        # Inicializa os componentes
        template_selector_proc = TemplateSelectorProc()
        template_selector_cont = TemplateSelectorCont()
        context_builder = ContextBuilder(request)
        document_processor_proc = DocumentProcessor(template_selector_proc, context_builder)
        document_processor_cont = DocumentProcessor(template_selector_cont, context_builder)
        # Processa os documentos
        output_path_proc = await document_processor_proc.process_document(request)
        output_path_cont = await document_processor_cont.process_document(request)

        return {
            'data': {
                'mensagem': r'Documentos salvos em "G:\Drives compartilhados\RANL\Internos\boto\saidas"'
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Erro ao processar documento: {str(e)}')


@app.get("/teste", dependencies=[Depends(get_api_key)])
async def get_modelos_proc():
    df = pd.read_excel(r"G:\Drives compartilhados\RANL\Internos\Modelos\Procurações e Contratos\modelos_proc_con_corpo.xlsx")
    json_data = df.to_json(orient='records', force_ascii=False)
    parsed_data = json.loads(json_data)
    return {
        "success": True,
        "total_records": len(parsed_data),
        "data": parsed_data
    }

@app.post("/analisar_html_info", dependencies=[Depends(get_api_key)])
async def analisar_html_info(request: AnaliseInfoRequest):
    teste = analisar_html(request.html)
    return {"result": teste}

@app.post("/lmstudio_proxy", dependencies=[Depends(get_api_key)])
async def lmstudio_proxy(request: LMStudioRequest):
    """
    Atua como um proxy total para o serviço LMStudio rodando localmente na porta 1234,
    permitindo escolher a rota do LMStudio a ser utilizada.
    Requer chave de API.
    """
    lmstudio_base_url = "http://localhost:1234/"
    full_lmstudio_url = lmstudio_base_url + request.path

    try:
        # Lê o método HTTP e o corpo da requisição de entrada
        method = request.method
        body = {
            'temperature': request.temperature,
            'max_tokens': request.max_tokens,
            'messages': request.messages
        }
        headers = {
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=full_lmstudio_url,
                headers=headers,
                content=json.dumps(body),
                timeout=30000
            )
            response.raise_for_status() 

            # Prepara os cabeçalhos da resposta para o cliente original
            # Exclui cabeçalhos que FastAPI ou o servidor web upstream irá gerenciar.
            response_headers = {
                k: v for k, v in response.headers.items()
                if k.lower() not in ["content-encoding", "transfer-encoding", "content-length"]
            }

            # Retorna a resposta completa do LMStudio ao cliente original
            return Response(content=response.content, status_code=response.status_code, headers=response_headers)

    except httpx.RequestError as exc:
        # Erro de rede ou LMStudio não acessível
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Não foi possível conectar ao serviço LMStudio: {exc}",
        )
    except httpx.HTTPStatusError as exc:
        # Erro de status HTTP do LMStudio (ex: 404, 500 do LMStudio)
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Erro do serviço LMStudio: {exc.response.text}",
            headers=response_headers if 'response_headers' in locals() else None # Tenta incluir headers se disponíveis
        )
    except Exception as e:
        # Outros erros inesperados
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no proxy: {str(e)}",
        )
