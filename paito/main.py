from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from docxtpl import DocxTemplate
from docxtpl.richtext import RichTextParagraph, RichText
from datetime import datetime
from templates import TemplateSelector, ContextBuilder, DocumentProcessor
from models import ProcRequest, AnaliseInfoRequest, AnotarAfazerRequest
from funcoes import analisar_html
from dotenv import load_dotenv
import os

load_dotenv()


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

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/proc")
async def fazer_proc_cont(request: ProcRequest):
    try:
        context_builder = ContextBuilder(request)
        
        # Processa procuração
        proc_selector = TemplateSelector(is_proc=True)
        doc_processor_proc = DocumentProcessor(proc_selector, context_builder)
        await doc_processor_proc.process_document()
        
        # Processa contrato
        cont_selector = TemplateSelector(is_proc=False)
        doc_processor_cont = DocumentProcessor(cont_selector, context_builder)
        await doc_processor_cont.process_document()
        
        return {
            'data': {
                'mensagem': r'Documentos salvos em "G:\Drives compartilhados\RANL\Internos\boto\saidas"'
            }
        }
    
    except Exception as e:
        return {
            'error': f'Erro ao processar documento: {str(e)}'
        }


@app.get("/teste")
async def get_modelos_proc():
    df = pd.read_excel(r"G:\Drives compartilhados\RANL\Internos\Modelos\Procurações e Contratos\modelos_proc_con_corpo.xlsx")
    json_data = df.to_json(orient='records', force_ascii=False)
    parsed_data = json.loads(json_data)
    return  {
            "success": True,
            "total_records": len(parsed_data),
            "data": parsed_data
        }

@app.post("/analisar_html_info")
async def analisar_html_info(request: AnaliseInfoRequest):
    teste = analisar_html(request.html)

@app.post("/anotar_afazer")
async def anotar_afazer(request: AnotarAfazerRequest):
    print(request)
    try:
        PATH_TODOLIST = os.getenv('PATH_TODOLIST')
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")

        msg_formatada = f"- [ ] {request.afazer.strip()} _{timestamp}_\n"
        with open(PATH_TODOLIST, "a", encoding='utf-8') as file:
            file.write(msg_formatada)
        print("A-fazer anotado com sucesso.")
        return {
            'data': {
                'mensagem': "A-fazer anotado com sucesso."
            }
        }
    except Exception as e:
        print(f"Erro ao anotar a-fazer: {e}")
