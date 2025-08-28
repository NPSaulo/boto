export const MAIN_STATES = {
    IDLE: 'idle',
    IN_FEATURE: 'in_feature'
};

export const PROCURACAO_STATES = {
    // Seleção do tipo de procuração/contrato
    SELECTING_TYPE: 'selecting_type',
    
    // Estados relacionados ao endereço
    IF_ADRESS: 'if_address',
    WAITING_IMAGE_ADRESS: 'waiting_image_address',
    WAITING_WRITE_ADRESS: 'waiting_write_address',
    SEND_APPROVAL_ADRESS: 'send_approval_address',
    APPROVING_ADRESS: 'approving_address',
    CORRECTING_ADRESS: 'correcting_address',
    
    // Estados relacionados às informações pessoais
    HOW_PERS: 'how_personal',
    WRITE_IMAGE_PERS: 'write_image_personal',
    WAITING_IMAGE_PERS: 'waiting_image_personal',
    WAITING_WRITE_PERS: 'waiting_write_personal',
    SEND_APPROVAL_PERS: 'send_approval_personal',
    APPROVING_PERS: 'approving_personal',
    CORRECTING_PERS: 'correcting_personal',
    
    // Estados relacionados à profissão
    IF_JOB: 'if_job',
    WAITING_IF_JOB: 'waiting_if_job',
    WAITING_JOB: 'waiting_job',
    
    // Estados relacionados ao estado civil
    IF_MARIT: 'if_marital',
    WAITING_IF_MARIT: 'waiting_if_marital',
    WAITING_MARIT: 'waiting_marital',
    
    // Estados finais
    SEND_FINAL_APPROVAL: 'send_final_approval',
    WAITING_FINAL_APPROVAL: 'waiting_final_approval',
    CORRECTING_FINAL: 'correcting_final',
    REQUEST_FASTAPI: 'request_fastapi'
};

export const AFAZER_STATES = {
    //inicial, esperando usuário mandar o a-fazer
    WAITING_MSG: 'waiting_msg',

    //mostrando como seria escrito
    WAITING_APPROVAL: 'waiting_approval',
    WAITING_CORRECTION: 'waiting_correction',
    REQUEST_FASTAPI: 'request_fastapi'
}