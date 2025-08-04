from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from docxtpl import DocxTemplate
from docxtpl.richtext import RichTextParagraph, RichText
from datetime import datetime
from templates import TemplateSelectorProc, TemplateSelectorCont, ContextBuilder, DocumentProcessor
from models import ProcRequest



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
    print(request)
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