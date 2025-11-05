import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelectionModal = ({ isOpen, onClose, onLanguageSelect, currentLanguage }) => {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'pt-BR');
  const [isLoading, setIsLoading] = useState(false);

  // Configuração da URL da API
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const languages = [
    { code: 'pt-BR', name: t('languageSelection.portuguese'), flag: '🇧🇷' },
    { code: 'en-US', name: t('languageSelection.english'), flag: '🇺🇸' },
    { code: 'es-ES', name: t('languageSelection.spanish'), flag: '🇪🇸' }
  ];

  const handleLanguageSelect = async () => {
    setIsLoading(true);
    
    try {
      // Converter código de idioma completo para código simples que o backend espera
      let backendLanguageCode = selectedLanguage;
      if (selectedLanguage === 'pt-BR') {
        backendLanguageCode = 'pt';
      } else if (selectedLanguage === 'en-US') {
        backendLanguageCode = 'en';
      } else if (selectedLanguage === 'es-ES') {
        backendLanguageCode = 'es';
      }
      
      // Alterar idioma no i18n primeiro
      await i18n.changeLanguage(selectedLanguage);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/auth/language`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ language: backendLanguageCode })
      });

      if (response.ok) {
        // Clonar a resposta ANTES de qualquer tentativa de leitura
        const responseClone = response.clone();
        const updatedUser = await responseClone.json();
        
        // Atualizar dados do usuário no localStorage com o código simples
        const userData = JSON.parse(localStorage.getItem('user'));
        userData.preferred_language = backendLanguageCode;
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('Idioma salvo com sucesso:', backendLanguageCode);
        
        // Fechar o modal após sucesso - usar o código completo para o frontend
        if (onLanguageSelect) {
          onLanguageSelect(selectedLanguage);
        }
      } else {
        // Clonar a resposta ANTES de qualquer tentativa de leitura para erros
        const responseClone = response.clone();
        let errorData;
        try {
          errorData = await responseClone.json();
        } catch {
          errorData = await responseClone.text();
        }
        console.error('Erro ao salvar idioma:', response.status, errorData);
        alert('Erro ao salvar idioma. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar idioma:', error);
      alert('Erro ao salvar idioma. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-emerald-500/20 rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">
            {t('languageSelection.title')}
          </h2>
          <p className="text-gray-300">
            {t('languageSelection.subtitle')}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {languages.map((language) => (
            <label
              key={language.code}
              className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                selectedLanguage === language.code
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-600 hover:border-emerald-500/50'
              }`}
            >
              <input
                type="radio"
                name="language"
                value={language.code}
                checked={selectedLanguage === language.code}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="sr-only"
              />
              <span className="text-2xl mr-3">{language.flag}</span>
              <span className="text-white font-medium">{language.name}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleLanguageSelect}
          disabled={!selectedLanguage || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            selectedLanguage && !isLoading
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? t('common.loading') : t('languageSelection.confirm')}
        </button>
      </div>
    </div>
  );
};

export default LanguageSelectionModal;