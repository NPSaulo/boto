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
from models import ProcRequest, AnaliseInfoRequest, AnotarAfazerRequest, LMStudioRequest
from funcoes import analisar_html
from dotenv import load_dotenv
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

load_dotenv()

API_KEY_FROM_ENV = os.getenv("API_KEY")

if not API_KEY_FROM_ENV:
    raise ValueError("API_KEY não localizada no arquivo .env.")

app = FastAPI()
scheduler = AsyncIOScheduler()

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

# --- OBSIDIAN SYNC CONFIGURATION & LOGIC ---
# The absolute path to your Obsidian vault folder.
VAULT_PATH = 'C:/Users/YourUser/Documents/ObsidianVault/Tasks/'

# The scope required to manage events on your calendar.
SCOPES = ['https://www.googleapis.com/auth/calendar.events']

# The regex pattern to find tasks with a due date in the Obsidian Tasks format.
TASK_PATTERN = re.compile(r'^- \[( |x)\] (.*) 📅 (\d{4}-\d{2}-\d{2})')

def get_google_calendar_service():
    """Authenticates with the Google Calendar API and returns the service object."""
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            # Note: This will open a browser for the first-time authentication.
            # This is a one-time step for server-side applications.
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return build("calendar", "v3", credentials=creds)

def read_tasks_from_vault(vault_path):
    """
    Reads all markdown files in the specified vault folder and extracts tasks
    with a due date.
    Returns a list of tuples: `(task_description, due_date)`.
    """
    tasks = []
    try:
        for filename in os.listdir(vault_path):
            if filename.endswith('.md'):
                filepath = os.path.join(vault_path, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    for line in f.readlines():
                        match = TASK_PATTERN.search(line)
                        if match and match.group(1) == ' ':  # Only incomplete tasks
                            task_desc = match.group(2).strip()
                            due_date_str = match.group(3)
                            try:
                                due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
                                tasks.append((task_desc, due_date))
                            except ValueError:
                                print(f"Warning: Could not parse date '{due_date_str}' in file '{filename}'.")
    except FileNotFoundError:
        print(f"Error: Vault path '{vault_path}' not found. Please check your VAULT_PATH configuration.")
        return []
    except Exception as e:
        print(f"An unexpected error occurred while reading vault files: {e}")
        return []
    return tasks

def get_existing_events(service):
    """Fetches all events from the primary calendar and returns a set of (summary, date) tuples."""
    min_date = date.today().replace(year=date.today().year - 1, month=1, day=1)
    min_time = datetime.combine(min_date, datetime.min.time()).isoformat() + 'Z'
    try:
        events_result = service.events().list(
            calendarId='primary',
            timeMin=min_time,
            maxResults=2500,
            singleEvents=True
        ).execute()
        events = events_result.get('items', [])
        existing_events = set()
        for event in events:
            summary = event.get('summary')
            start_date = event.get('start', {}).get('date')
            if summary and start_date:
                existing_events.add((summary, start_date))
        return existing_events
    except HttpError as error:
        print(f"Error fetching existing events: {error}")
        return set()

async def sync_tasks_to_gcal_job():
    """
    Schedules the task sync job. This function is called by the scheduler.
    """
    print("\nStarting scheduled task sync...")
    try:
        service = get_google_calendar_service()
        tasks_to_sync = read_tasks_from_vault(VAULT_PATH)
        
        if not tasks_to_sync:
            print("No tasks with due dates found. Skipping sync.")
            return

        print("Fetching existing calendar events...")
        existing_events = get_existing_events(service)
        
        tasks_synced_count = 0
        for task, due_date in tasks_to_sync:
            due_date_str = due_date.isoformat()
            if (task, due_date_str) in existing_events:
                print(f"Skipping '{task}' (due {due_date_str}): already exists in Google Calendar.")
                continue

            event = {
                'summary': task,
                'start': {
                    'date': due_date_str,
                },
                'end': {
                    'date': due_date_str,
                },
            }
            try:
                service.events().insert(calendarId='primary', body=event).execute()
                print(f"Created event for task: '{task}'")
                tasks_synced_count += 1
            except Exception as e:
                print(f"Error creating event for '{task}': {e}")
        
        print(f"\nScheduled sync complete. {tasks_synced_count} new tasks were added to your calendar.")
    except Exception as e:
        print(f"A fatal error occurred during sync: {e}")


@app.on_event("startup")
def start_scheduler():
    """Starts the APScheduler when the FastAPI app starts."""
    scheduler.add_job(sync_tasks_to_gcal_job, 'interval', minutes=5)
    scheduler.start()
    print("Scheduler started. Syncing tasks every 5 minutes.")


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

@app.post("/anotar_afazer")
async def anotar_afazer(request: AnotarAfazerRequest):
    print(request)
    try:
        PATH_TODOLIST = os.getenv('PATH_TODOLIST')
        timestamp = datetime.now().strftime("%m/%Y-%m-%d")

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
