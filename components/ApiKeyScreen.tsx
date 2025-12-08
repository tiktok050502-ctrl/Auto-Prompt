import React, { useState } from 'react';
import { KeyIcon, LoadingIcon, CheckIcon } from './icons';
import { validateApiKey } from '../services/geminiService';

interface ApiKeyScreenProps {
    onValidKey: (apiKey: string) => void;
}

const ApiKeyScreen: React.FC<ApiKeyScreenProps> = ({ onValidKey }) => {
    const [inputKey, setInputKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);

    const handleCheckKey = async () => {
        const keyToValidate = inputKey.trim();
        
        // 1. Client-side validation STRICT
        if (!keyToValidate) {
            setError('Vui lòng nhập API Key.');
            return;
        }

        // Google API keys start with AIza and are usually 39 chars long.
        if (!keyToValidate.startsWith('AIza') || keyToValidate.length < 39) {
             setError('API Key không đúng định dạng (phải bắt đầu bằng "AIza" và có ít nhất 39 ký tự).');
             return;
        }

        setIsValidating(true);
        setError(null);

        try {
            // 2. Server-side validation via Gemini Service
            const isValid = await validateApiKey(keyToValidate);
            if (isValid) {
                onValidKey(keyToValidate);
            } else {
                setError('API Key không hoạt động. Vui lòng kiểm tra lại quyền truy cập hoặc giới hạn quota.');
            }
        } catch (e) {
            setError('Lỗi kết nối khi kiểm tra Key.');
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 px-4">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 transform transition-all">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-indigo-900/50 rounded-full mb-4 ring-1 ring-indigo-500/50">
                        <KeyIcon className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white text-center">Đăng nhập Google Cloud</h1>
                    <p className="text-gray-400 text-center mt-2 text-sm">
                        Nhập Google Cloud API Key (từ dự án đã bật Billing/Thanh toán) để tạo video bằng Veo 3.1.
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                            Google Cloud API Key
                        </label>
                        <div className="relative">
                            <input
                                id="apiKey"
                                type={showKey ? "text" : "password"}
                                value={inputKey}
                                onChange={(e) => {
                                    setInputKey(e.target.value);
                                    setError(null);
                                }}
                                className={`w-full bg-gray-900 border ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-indigo-500'} rounded-lg py-3 px-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                                placeholder="AIza..."
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                                title={showKey ? "Ẩn Key" : "Hiện Key"}
                            >
                                {showKey ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {error && (
                            <p className="mt-2 text-sm text-red-400 flex items-center animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleCheckKey}
                        disabled={isValidating || !inputKey}
                        className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium transition-all ${
                            isValidating || !inputKey
                                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg shadow-indigo-500/20 active:transform active:scale-95'
                        }`}
                    >
                        {isValidating ? (
                            <>
                                <LoadingIcon className="w-5 h-5 mr-2 animate-spin" />
                                Đang kiểm tra...
                            </>
                        ) : (
                            <>
                                <CheckIcon className="w-5 h-5 mr-2" />
                                Bắt đầu
                            </>
                        )}
                    </button>
                    
                    <div className="text-center pt-2 space-y-2">
                         <a 
                            href="https://console.cloud.google.com/apis/credentials" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                            Lấy API Key tại Google Cloud Console
                        </a>
                         <a 
                            href="https://cloud.google.com/billing/docs/how-to/modify-project" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-xs text-gray-500 hover:text-gray-400 underline"
                        >
                            Hướng dẫn bật Billing cho Project
                        </a>
                    </div>
                </div>
            </div>
            
            <p className="mt-8 text-gray-600 text-xs text-center">
                Lưu ý: Veo 3.1 là mô hình trả phí (Pay-as-you-go).<br/>
                Vui lòng đảm bảo API Key của bạn thuộc dự án đã liên kết tài khoản thanh toán.
            </p>
        </div>
    );
};

export default ApiKeyScreen;