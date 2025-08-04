from dataclasses import dataclass
from models import ProcRequest
from docxtpl import RichTextParagraph, RichText
import pandas as pd
import json
from docxtpl import DocxTemplate
from docxtpl.richtext import RichTextParagraph, RichText
from datetime import datetime
from typing import Dict, Any
from docx2pdf import convert
import asyncio

@dataclass
class TemplateConfig:
    """Configuração de um template específico"""
    filename: str
    required_fields: list[str]
    optional_fields: list[str] = None
    
    def __post_init__(self):
        if self.optional_fields is None:
            self.optional_fields = []


class TemplateSelectorProc:
    """Classe responsável por selecionar o template correto baseado nas condições"""
    
    BASE_PATH = r"G:\Drives compartilhados\RANL\Internos\boto\procuracoes"
    PREFIX = "proc_"
    # Mapeamento de combinações para templates
    TEMPLATES = {
        # Formato: (endereco, civil, profissao) -> template
        (True, True, True): TemplateConfig(
            "proc_completo.docx",
            ["nome", "cpf", "estado_civil", "profissao", "endereco", "cidade", "estado", "cep"]
        ),
        (True, True, False): TemplateConfig(
            "proc_end_civ.docx",
            ["nome", "cpf", "estado_civil", "endereco", "cidade", "estado", "cep"]
        ),
        (True, False, True): TemplateConfig(
            "proc_end_prof.docx",
            ["nome", "cpf", "profissao", "endereco", "cidade", "estado", "cep"]
        ),
        (False, True, True): TemplateConfig(
            "proc_civ_prof.docx",
            ["nome", "cpf", "estado_civil", "profissao", "cidade", "estado"]
        ),
        (False, False, True): TemplateConfig(
            "proc_prof.docx",
            ["nome", "cpf", "profissao", "cidade", "estado"]
        ),
        (False, True, False): TemplateConfig(
            "proc_civ.docx",
            ["nome", "cpf", "estado_civil", "cidade", "estado"]
        ),
        (True, False, False): TemplateConfig(
            "proc_end.docx",
            ["nome", "cpf", "endereco", "cidade", "estado", "cep"]
        ),
        (False, False, False): TemplateConfig(
            "proc.docx",
            ["nome", "cpf", "cidade", "estado"]
        ),
    }
    
    def get_template_config(self, request: ProcRequest) -> TemplateConfig:
        """Retorna a configuração do template baseado no request"""
        key = (request.informa_endereco, request.informa_civ, request.informa_prof)
        return self.TEMPLATES.get(key, self.TEMPLATES[(False, False, False)])
    
    def get_template_path(self, config: TemplateConfig) -> str:
        """Retorna o caminho completo do template"""
        return f"{self.BASE_PATH}\\{config.filename}"


class TemplateSelectorCont:
    """Classe responsável por selecionar o template correto baseado nas condições"""
    
    BASE_PATH = r"G:\Drives compartilhados\RANL\Internos\boto\contratos"
    PREFIX = "cont_"
    # Mapeamento de combinações para templates
    TEMPLATES = {
        # Formato: (endereco, civil, profissao) -> template
        (True, True, True): TemplateConfig(
            "cont_completo.docx",
            ["nome", "cpf", "estado_civil", "profissao", "endereco", "cidade", "estado", "cep"]
        ),
        (True, True, False): TemplateConfig(
            "cont_end_civ.docx",
            ["nome", "cpf", "estado_civil", "endereco", "cidade", "estado", "cep"]
        ),
        (True, False, True): TemplateConfig(
            "cont_end_prof.docx",
            ["nome", "cpf", "profissao", "endereco", "cidade", "estado", "cep"]
        ),
        (False, True, True): TemplateConfig(
            "cont_civ_prof.docx",
            ["nome", "cpf", "estado_civil", "profissao", "cidade", "estado"]
        ),
        (False, False, True): TemplateConfig(
            "cont_prof.docx",
            ["nome", "cpf", "profissao", "cidade", "estado"]
        ),
        (False, True, False): TemplateConfig(
            "cont_civ.docx",
            ["nome", "cpf", "estado_civil", "cidade", "estado"]
        ),
        (True, False, False): TemplateConfig(
            "cont_end.docx",
            ["nome", "cpf", "endereco", "cidade", "estado", "cep"]
        ),
        (False, False, False): TemplateConfig(
            "cont.docx",
            ["nome", "cpf", "cidade", "estado"]
        ),
    }
    
    def get_template_config(self, request: ProcRequest) -> TemplateConfig:
        """Retorna a configuração do template baseado no request"""
        key = (request.informa_endereco, request.informa_civ, request.informa_prof)
        return self.TEMPLATES.get(key, self.TEMPLATES[(False, False, False)])
    
    def get_template_path(self, config: TemplateConfig) -> str:
        """Retorna o caminho completo do template"""
        return f"{self.BASE_PATH}\\{config.filename}"


class ContextBuilder:
    """Classe responsável por construir o contexto para o template"""
    
    def __init__(self, request: ProcRequest):
        self.request = request
    
    def build_rich_text_remuneracao(self) -> RichTextParagraph:
        """Constrói o rich text para remuneração"""
        rich_para_remunera_con = RichTextParagraph(parastyle='Normal')
        rich_remunera_con = RichText()
        rich_remunera_con.add(self.request.remunera_con_1)
        rich_remunera_con.add(self.request.remunera_con_2, bold=True)
        rich_remunera_con.add(self.request.remunera_con_3)
        rich_para_remunera_con.add(rich_remunera_con, parastyle='Normal')
        return rich_para_remunera_con
    
    def build_context(self, template_config: TemplateConfig) -> Dict[str, Any]:
        """Constrói o contexto baseado na configuração do template"""
        # Contexto base sempre presente
        context = {
            'NOME': self.request.nome,
            'CPF': self.request.cpf,
            'data': datetime.today().strftime("%d/%m/%y"),
            'finalidade_proc': self.request.finalidade_proc,
            'objeto_con': self.request.objeto_con,
            'remunera_con': self.build_rich_text_remuneracao(),
            'cidade': self.request.cidade,
            'estado': self.request.estado,
        }
        
        # Adiciona campos condicionais baseado na configuração
        if 'endereco' in template_config.required_fields:
            context.update({
                'endereco': self.request.endereco,
                'CEP': self.request.cep
            })
        
        if 'estado_civil' in template_config.required_fields:
            context['estado_civil'] = self.request.estado_civil
        
        if 'profissao' in template_config.required_fields:
            context['profissao'] = self.request.profissao
        
        return context


class DocumentProcessor:
    """Classe responsável por processar e salvar o documento"""
    
    OUTPUT_PATH = r"G:\Drives compartilhados\RANL\Internos\boto\saidas"
    
    def __init__(self, template_selector, context_builder: ContextBuilder):
        self.template_selector = template_selector
        self.context_builder = context_builder
    
    async def process_document(self, request: ProcRequest) -> str:
        """Processa o documento e retorna o caminho do arquivo salvo"""
        # Seleciona o template
        template_config = self.template_selector.get_template_config(request)
        template_path = self.template_selector.get_template_path(template_config)

        # Constrói o contexto
        context = self.context_builder.build_context(template_config)
        
        # Processa o documento
        doc = DocxTemplate(template_path)
        doc.render(context)
        
        # Salva o documento
        filename = f"{self.template_selector.PREFIX}{context['NOME']}_{datetime.today().strftime('%d_%m_%Y')}.docx"
        output_path = f"{self.OUTPUT_PATH}\\{filename}"
        print(output_path)
        doc.save(output_path)
        await convert(output_path, output_path[:-5]+".pdf")
        
        return output_path