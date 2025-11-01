def normalize_whatsapp(whatsapp_number):
    """Normaliza número de WhatsApp para formato internacional"""
    if not whatsapp_number:
        return whatsapp_number
    
    # Remove todos os caracteres não numéricos
    clean_number = ''.join(filter(str.isdigit, whatsapp_number))
    
    # Se não começar com código do país, adiciona +55 (Brasil)
    if len(clean_number) == 11 and clean_number.startswith(('11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99')):
        return f"+55{clean_number}"
    elif len(clean_number) == 13 and clean_number.startswith('55'):
        return f"+{clean_number}"
    elif clean_number.startswith('55') and len(clean_number) > 11:
        return f"+{clean_number}"
    
    # Se já tem código do país, mantém
    return f"+{clean_number}" if not whatsapp_number.startswith('+') else whatsapp_number

# Testar diferentes formatos
test_numbers = [
    "(11) 99999-9999",
    "11999999999",
    "+5511999999999",
    "5511999999999",
    "11 99999-9999",
    "(11)99999-9999"
]

print("🧪 Testando normalização de números de WhatsApp:")
for number in test_numbers:
    normalized = normalize_whatsapp(number)
    print(f"   {number} -> {normalized}")