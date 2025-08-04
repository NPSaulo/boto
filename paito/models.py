from pydantic import BaseModel

class ProcRequest(BaseModel):
    nome: str
    cpf: str
    estado_civil: str | None = None
    profissao: str | None = None
    cidade: str = 'Cuiabá'
    estado: str = 'MT'
    endereço: str | None = None
    cep: str | None = None
    finalidade_proc: str
    objeto_con: str
    remunera_con_1: str
    remunera_con_2: str
    remunera_con_3: str
    informa_endereco: bool
    informa_prof: bool
    informa_civ: bool