from dataclasses import dataclass
from models import ProcRequest
from docxtpl import DocxTemplate, RichTextParagraph, RichText
from datetime import datetime
from typing import Dict, Any
from docx2pdf import convert

class TemplateSelector:
    """Classe responsável por selecionar e gerenciar templates"""

    def __init__(self, is_proc: bool):
        self.is_proc = is_proc
        self.base_path = r"G:\Drives compartilhados\RANL\Internos\boto"
        self.prefix = "proc_" if is_proc else "cont_"
        self.template_name = "procuracao.docx" if is_proc else "contrato.docx"

    def get_template_path(self) -> str:
        """Retorna o caminho completo do template"""
        folder = "procuracoes" if self.is_proc else "contratos"
        return f"{self.base_path}\\{folder}\\{self.template_name}"

class ContextBuilder:
    """Classe responsável por construir o contexto para o template"""
    
    def __init__(self, request: ProcRequest):
        self.request = request
    
    def build_rich_text_remuneracao(self) -> RichTextParagraph:
        """Constrói o rich text para remuneração com formatação adequada"""
        paragraph = RichTextParagraph(
            line_spacing=1.15,      # Espaçamento entre linhas (1.0 = simples, 1.15 = 1,15 linhas, 2.0 = duplo)
            space_before=0,         # Espaço antes do parágrafo (em pontos)
            space_after=12,         # Espaço depois do parágrafo (em pontos)
            jc='both'      # Alinhamento: 'left', 'right', 'center', 'justify'
        )
        rt = RichText()
        rt.add(self.request.remunera_con_1, size=22, font='Times New Roman')
        rt.add(self.request.remunera_con_2, bold=True, size=22, font='Times New Roman')
        rt.add(self.request.remunera_con_3, size=22, font='Times New Roman')
        paragraph.add(rt)
        return paragraph
    
    def build_context(self) -> Dict[str, Any]:
        """Constrói o contexto com flags condicionais"""
        return {
            'nome': self.request.nome.upper(),
            'cpf': self.request.cpf,
            'data': datetime.today().strftime("%d/%m/%y"),
            'finalidade_proc': self.request.finalidade_proc,
            'objeto_con': self.request.objeto_con,
            'remunera_con': self.build_rich_text_remuneracao(),
            'cidade': self.request.cidade,
            'estado': self.request.estado,
            'estado_civil': self.request.estado_civil,
            'profissao': self.request.profissao,
            'endereco': self.request.endereco,
            'cep': self.request.cep,
            'mostrar_endereco': self.request.informa_endereco,
            'mostrar_prof': self.request.informa_prof,
            'mostrar_civ': self.request.informa_civ
        }
class DocumentProcessor:
    """Classe responsável por processar e salvar o documento"""
    
    OUTPUT_PATH = r"G:\Drives compartilhados\RANL\Internos\boto\saidas"
    
    def __init__(self, template_selector: TemplateSelector, context_builder: ContextBuilder):
        self.template_selector = template_selector
        self.context_builder = context_builder
    
    async def process_document(self) -> str:
        template_path = self.template_selector.get_template_path()
        context = self.context_builder.build_context()
        
        doc = DocxTemplate(template_path)
        doc.render(context)
        #falta alterar na biblioteca docxtpl para deixar a função assíncrona
        filename = f"{self.template_selector.prefix}{context['nome']}_{datetime.today().strftime('%d_%m_%Y_%H_%M')}.docx"
        output_path = f"{self.OUTPUT_PATH}\\{filename}"
        doc.save(output_path)
        await convert(output_path, output_path[:-5]+".pdf")
        
        return output_path