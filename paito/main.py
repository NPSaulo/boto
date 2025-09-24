import os
import re
from datetime import datetime, date
import pickle
from fastapi import FastAPI, Header, HTTPException, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from docxtpl import DocxTemplate
from docxtpl.richtext import RichTextParagraph, RichText
from templates import TemplateSelector, ContextBuilder, DocumentProcessor
from models import ProcRequest, AnotarAfazerRequest
from dotenv import load_dotenv

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

@app.post("/anotar_afazer", dependencies=[Depends(get_api_key)])
async def anotar_afazer(request: AnotarAfazerRequest):
    print(request)
    try:
        PATH_TODOLIST = os.getenv('PATH_TODO_LIST')
        timestamp = datetime.now().strftime("%Y-%m-%d")

        msg_formatada = f"- [ ] {request.afazer.strip()} 📅 {timestamp}\n"
        with open(PATH_TODOLIST, "a", encoding='utf-8') as file:
            file.write(msg_formatada)
        print("A-fazer anotado com sucesso.")
        return {
            'data': {
                'mensagem': "A-fazer anotado com sucesso."
            }
        }
    except Exception as e:
        print(f"Erro ao anotar a-fazer: {e}")

