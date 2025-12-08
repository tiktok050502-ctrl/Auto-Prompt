
import React, { useState, useRef, useEffect } from 'react';
import { generateScript, extendScript, validateApiKey } from '../services/geminiService';
import { Script, Scene, VideoGenerationOptions } from '../types';
import { VIDEO_STYLES } from '../constants';
import SceneCard from './SceneCard';
import { LoadingIcon, SparklesIcon, ClipboardIcon, CheckIcon, WandIcon, KeyIcon, PlayIcon } from './icons';

const MainScreen = () => {
    // API KEY MANAGEMENT STATE
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [isKeyVerified, setIsKeyVerified] = useState(false);
    const [isCheckingKey, setIsCheckingKey] = useState(false);
    const [keyError, setKeyError] = useState('');
    const [showKeyInput, setShowKeyInput] = useState(true);

    const [options, setOptions] = useState<VideoGenerationOptions>({
        idea: '',
        promptCount: '',
        videoStyle: 'Cinematic',
        aspectRatio: '16:9', // Default hardcoded to 16:9
        dialogueLanguage: 'Không Có',
        promptType: 'default', // Default value
    });
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    
    // UI Feedback States
    const [isAllPromptsCopied, setIsAllPromptsCopied] = useState(false);
    const [isAllScriptsCopied, setIsAllScriptsCopied] = useState(false);
    const [isAllWishkCopied, setIsAllWishkCopied] = useState(false);

    // Extension States
    const [isExpanding, setIsExpanding] = useState(false);
    const [extendIdea, setExtendIdea] = useState('');
    const [extendCount, setExtendCount] = useState<number | string>('');
    const [isExtendingLoading, setIsExtendingLoading] = useState(false);

    // Refs to ensure callbacks always access the latest values
    const optionsRef = useRef(options);
    const scenesRef = useRef(scenes);

    // Sync refs
    useEffect(() => { optionsRef.current = options; }, [options]);
    useEffect(() => { scenesRef.current = scenes; }, [scenes]);

    // CHECK SAVED KEY ON MOUNT
    useEffect(() => {
        const savedKey = localStorage.getItem('google_ai_key');
        if (savedKey) {
            setGoogleApiKey(savedKey);
            setShowKeyInput(true);
            setIsKeyVerified(false);
        }
    }, []);

    const handleVerifyKey = async () => {
        const keyClean = googleApiKey.trim();
        if (!keyClean) {
            setKeyError("Vui lòng nhập Key.");
            return;
        }
        setIsCheckingKey(true);
        setKeyError('');
        setIsKeyVerified(false); 
        
        try {
            const isValid = await validateApiKey(keyClean);
            if (isValid) {
                setIsKeyVerified(true);
                localStorage.setItem('google_ai_key', keyClean);
                setShowKeyInput(false);
            } else {
                setIsKeyVerified(false);
                setKeyError("Key không đúng hoặc không tồn tại.");
                localStorage.removeItem('google_ai_key'); 
            }
        } catch (e) {
            setKeyError("Lỗi kết nối.");
            setIsKeyVerified(false);
        } finally {
            setIsCheckingKey(false);
        }
    };

    const handleResetKey = () => {
        setIsKeyVerified(false);
        setShowKeyInput(true);
        setKeyError('');
        setGoogleApiKey('');
        localStorage.removeItem('google_ai_key');
    };

    const handleGenerateScript = async () => {
        if (!isKeyVerified || !googleApiKey) {
            setError('Vui lòng nhập và KIỂM TRA (Check) Google AI Studio Key trước.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (!options.idea) {
            setError('Vui lòng nhập ý tưởng video.');
            return;
        }
        if (options.promptCount === '') {
            setError('Vui lòng nhập số lượng prompt.');
            return;
        }
        setIsLoading(true);
        setProgressMessage('Đang khởi tạo quy trình AI...');
        setError(null);
        setScenes([]);
        setIsExpanding(false); // Reset expansion UI

        try {
            // NOTE: We explicitly pass the validated `googleApiKey` here
            const script: Script = await generateScript(options, googleApiKey, (msg) => {
                setProgressMessage(msg);
            });
            setScenes(script.scenes);
        } catch (err: any) {
            console.error("Error generating script:", err);
            setError('Tạo kịch bản thất bại. ' + (err.message || ''));
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    const handleExtendScript = async () => {
        if (!isKeyVerified || !googleApiKey) {
            setError('Vui lòng kiểm tra Google AI Studio Key.');
            return;
        }
        if (!extendIdea) {
            alert('Vui lòng nhập ý tưởng tiếp theo.');
            return;
        }

        if (extendCount === '' || (typeof extendCount === 'number' && extendCount <= 0)) {
            alert('Vui lòng nhập số lượng cảnh muốn thêm.');
            return;
        }
        
        const currentScenes = scenesRef.current;
        if (currentScenes.length === 0) return;

        const lastScene = currentScenes[currentScenes.length - 1];
        const countNumber = typeof extendCount === 'string' ? parseInt(extendCount, 10) : extendCount;
        
        setIsExtendingLoading(true);
        setError(null);
        
        try {
            // NOTE: We explicitly pass the validated `googleApiKey` here
            const newScenes = await extendScript(
                lastScene,
                extendIdea,
                countNumber,
                optionsRef.current,
                googleApiKey
            );
            
            setScenes(prev => [...prev, ...newScenes]);
            setIsExpanding(false); // Close form on success
            setExtendIdea('');
            setExtendCount('');
            
            // Scroll to bottom
            setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 100);
            
        } catch (err: any) {
            console.error("Error extending script:", err);
            setError('Mở rộng kịch bản thất bại: ' + err.message);
        } finally {
            setIsExtendingLoading(false);
        }
    };
    
    const handleCopyAllPrompts = () => {
        if (scenes.length === 0) return;
        const allPrompts = scenes.map(scene => scene.veo_prompt).join('\n\n');
        navigator.clipboard.writeText(allPrompts).then(() => {
            setIsAllPromptsCopied(true);
            setTimeout(() => setIsAllPromptsCopied(false), 2000);
        });
    };

    const handleCopyAllScripts = () => {
        if (scenes.length === 0) return;
        const allScripts = scenes.map(scene => scene.script_description).join('\n\n');
        navigator.clipboard.writeText(allScripts).then(() => {
            setIsAllScriptsCopied(true);
            setTimeout(() => setIsAllScriptsCopied(false), 2000);
        });
    };

    const handleCopyAllWishk = () => {
        if (scenes.length === 0) return;
        const allWishk = scenes.map(scene => scene.wishk_prompt).filter(p => p).join('\n\n');
        navigator.clipboard.writeText(allWishk).then(() => {
            setIsAllWishkCopied(true);
            setTimeout(() => setIsAllWishkCopied(false), 2000);
        });
    };

    return (
        <main className="w-full min-h-screen p-4 md:p-6 relative">
            {/* Centered Header Layout */}
            <header className="relative flex flex-col items-center justify-center mb-10 mt-8 gap-4">
                <div className="text-center z-10 w-full max-w-4xl px-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-2 drop-shadow-sm">
                        Tool Tạo Prompt
                    </h1>
                    <p className="text-lg text-gray-600 font-medium">
                        Biến ý tưởng thành video AI đẳng cấp chỉ trong tích tắc.
                    </p>
                </div>
            </header>

            {/* Layout Container: Always split 50/50 on desktop */}
            <div className="flex flex-col lg:flex-row items-start gap-8">
                
                {/* Left Side: Input Form */}
                <div className="w-full lg:w-1/2 lg:sticky lg:top-6">
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-gray-100">
                        <div className="space-y-6">
                            
                            {/* GOOGLE AI STUDIO API KEY SECTION */}
                            <div className={`p-5 rounded-2xl border transition-all duration-300 shadow-sm ${isKeyVerified ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-indigo-100'}`}>
                                <label className="flex items-center text-sm font-bold text-gray-700 mb-3 tracking-wide uppercase">
                                    <KeyIcon className="w-5 h-5 mr-2 text-indigo-500" />
                                    Google AI Studio API Key
                                </label>
                                
                                {isKeyVerified && !showKeyInput ? (
                                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-green-200 shadow-sm">
                                        <div className="flex items-center text-green-700 font-bold">
                                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                                                <CheckIcon className="w-4 h-4 text-green-600" />
                                            </div>
                                            Đã kết nối thành công
                                        </div>
                                        <button 
                                            onClick={() => setShowKeyInput(true)}
                                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                                        >
                                            Thay đổi
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex w-full items-stretch gap-3 h-12">
                                            <div className="relative flex-1 h-full">
                                                <input
                                                    type="password"
                                                    value={googleApiKey}
                                                    onChange={(e) => {
                                                        setGoogleApiKey(e.target.value);
                                                        setKeyError('');
                                                    }}
                                                    placeholder="Dán API Key vào đây..."
                                                    className={`w-full h-full bg-white border rounded-xl px-4 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm focus:shadow-indigo-100 ${keyError ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                            </div>
                                            <button
                                                onClick={handleVerifyKey}
                                                disabled={isCheckingKey || !googleApiKey}
                                                className={`h-full px-6 rounded-xl font-bold text-sm transition-all shadow-lg whitespace-nowrap flex items-center justify-center min-w-[120px] ${
                                                    isCheckingKey || !googleApiKey
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:scale-105 active:scale-95 shadow-blue-500/30'
                                                }`}
                                            >
                                                {isCheckingKey ? <LoadingIcon className="w-5 h-5 animate-spin" /> : "Thêm Key"}
                                            </button>
                                        </div>
                                        {keyError && (
                                            <p className="text-red-500 text-xs flex items-center mt-1 animate-pulse font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
                                                {keyError}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-1 italic">
                                            * Hệ thống sẽ kiểm tra Key thực tế.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Idea Input */}
                            <div>
                                <label htmlFor="idea" className="block text-sm font-bold text-gray-700 mb-2">
                                    Ý tưởng Video
                                </label>
                                <textarea
                                    id="idea"
                                    rows={4}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all shadow-inner text-base"
                                    placeholder="Ví dụ: Một cô gái Việt Nam mặc áo dài đi dạo ở phố cổ Hội An..."
                                    value={options.idea}
                                    onChange={(e) => setOptions({ ...options, idea: e.target.value })}
                                />
                            </div>
                            
                            {/* Grid controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="promptCount" className="block text-sm font-bold text-gray-700 mb-2">Số lượng prompt</label>
                                    <input
                                        id="promptCount"
                                        type="number"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                                        value={options.promptCount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setOptions({ ...options, promptCount: value === '' ? '' : parseInt(value, 10) });
                                        }}
                                        min="0"
                                        placeholder="Ví dụ: 5"
                                    />
                                </div>
                                {/* Removed Aspect Ratio Dropdown */}
                                <div>
                                    <label htmlFor="videoStyle" className="block text-sm font-bold text-gray-700 mb-2">Phong cách</label>
                                    <select
                                        id="videoStyle"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                                        value={options.videoStyle}
                                        onChange={(e) => setOptions({ ...options, videoStyle: e.target.value })}
                                    >
                                        {VIDEO_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="dialogueLanguage" className="block text-sm font-bold text-gray-700 mb-2">Hội thoại</label>
                                    <select
                                        id="dialogueLanguage"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                                        value={options.dialogueLanguage}
                                        onChange={(e) => setOptions({ ...options, dialogueLanguage: e.target.value })}
                                    >
                                        <option value="Không Có">Không Có</option>
                                        <option value="Tiếng Việt">Tiếng Việt</option>
                                        <option value="Tiếng Anh">Tiếng Anh</option>
                                    </select>
                                </div>
                                {/* Prompt Type Field */}
                                <div>
                                    <label htmlFor="promptType" className="block text-sm font-bold text-gray-700 mb-2">Loại Prompt</label>
                                    <select
                                        id="promptType"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                                        value={options.promptType || 'default'}
                                        onChange={(e) => setOptions({ ...options, promptType: e.target.value as any })}
                                    >
                                        <option value="default">Mặc định (Đa dạng góc máy)</option>
                                        <option value="camera_lock">Khoá Camera (One-Shot liền mạch)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleGenerateScript}
                                    disabled={isLoading || !isKeyVerified}
                                    className={`w-full flex items-center justify-center px-6 py-4 text-lg font-bold text-white rounded-xl transition-all h-16 shadow-xl ${
                                        !isKeyVerified 
                                        ? 'bg-gray-300 cursor-not-allowed opacity-70 text-gray-500' 
                                        : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 shadow-indigo-500/40 hover:shadow-indigo-500/60 transform hover:scale-[1.02] active:scale-95'
                                    }`}
                                    title={!isKeyVerified ? "Vui lòng nhập và kiểm tra API Key trước" : "Tạo kịch bản"}
                                >
                                    {isLoading ? (
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center">
                                                <LoadingIcon className="w-6 h-6 mr-3 animate-spin" />
                                                Đang sáng tạo
                                            </div>
                                            {progressMessage && <span className="text-xs text-white/80 mt-1 font-normal animate-pulse">{progressMessage}</span>}
                                        </div>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-6 h-6 mr-3" />
                                            {isKeyVerified ? "TẠO KỊCH BẢN NGAY" : "Vui lòng thêm API Key"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        {error && <p className="mt-4 text-center text-red-500 font-medium animate-pulse bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
                    </div>
                </div>

                {/* Right Side: Results */}
                <div className="w-full lg:w-1/2">
                    {scenes.length > 0 ? (
                        <>
                            <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200 sticky top-4 z-20 shadow-xl shadow-gray-200/50 mb-8 flex flex-wrap gap-3 justify-between items-center transition-all">
                                <div className="flex flex-1 gap-3 min-w-[200px]">
                                    <button onClick={handleCopyAllScripts} className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isAllScriptsCopied ? 'bg-green-500 shadow-green-500/30' : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 shadow-purple-500/30'}`}>
                                        {isAllScriptsCopied ? <CheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5 mr-2" />} Kịch bản
                                    </button>
                                    <button onClick={handleCopyAllPrompts} className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isAllPromptsCopied ? 'bg-green-500 shadow-green-500/30' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-blue-500/30'}`}>
                                        {isAllPromptsCopied ? <CheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5 mr-2" />} Prompts
                                    </button>
                                    <button onClick={handleCopyAllWishk} className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isAllWishkCopied ? 'bg-green-500 shadow-green-500/30' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30'}`}>
                                        {isAllWishkCopied ? <CheckIcon className="w-5 h-5" /> : <WandIcon className="w-5 h-5 mr-2" />} Wishk
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-8 pb-12">
                                {scenes.map((scene) => (
                                    <SceneCard 
                                        key={scene.scene_number} 
                                        scene={scene}
                                    />
                                ))}

                                {/* Expansion Section */}
                                <div className="mt-10 border-t border-gray-200 pt-10">
                                    {!isExpanding ? (
                                        <button 
                                            onClick={() => setIsExpanding(true)}
                                            className="w-full py-5 border-2 border-dashed border-indigo-300 rounded-2xl text-indigo-600 font-bold hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-center group bg-white shadow-sm hover:shadow-md text-lg"
                                        >
                                            <SparklesIcon className="w-6 h-6 mr-3 group-hover:scale-125 transition-transform duration-300" />
                                            Mở rộng Kịch bản (Viết tiếp câu chuyện)
                                        </button>
                                    ) : (
                                        <div className="bg-white rounded-2xl p-6 md:p-8 border border-indigo-200 shadow-2xl animate-fade-in ring-4 ring-indigo-50">
                                            <h3 className="text-xl font-bold text-indigo-600 mb-6 flex items-center">
                                                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                                                   <SparklesIcon className="w-6 h-6" />
                                                </div>
                                                Viết tiếp câu chuyện
                                            </h3>
                                            
                                            <div className="mb-6">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Ý tưởng tiếp theo là gì?</label>
                                                <textarea
                                                    value={extendIdea}
                                                    onChange={(e) => setExtendIdea(e.target.value)}
                                                    placeholder="Ví dụ: Nhân vật chính gặp một người lạ mặt, trời bắt đầu mưa to..."
                                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[120px] shadow-inner text-base"
                                                />
                                            </div>
                                            
                                            <div className="mb-8">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Số lượng cảnh muốn thêm</label>
                                                <input
                                                    type="number"
                                                    value={extendCount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setExtendCount(val === '' ? '' : parseInt(val));
                                                    }}
                                                    placeholder="Nhập số lượng cảnh..."
                                                    min="1"
                                                    max="10"
                                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white shadow-sm"
                                                />
                                            </div>
                                            
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={handleExtendScript}
                                                    disabled={isExtendingLoading}
                                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30 transform hover:scale-[1.02] active:scale-95"
                                                >
                                                    {isExtendingLoading ? (
                                                        <>
                                                            <LoadingIcon className="w-5 h-5 mr-2 animate-spin" />
                                                            Đang viết tiếp...
                                                        </>
                                                    ) : (
                                                        "Tạo tiếp kịch bản"
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setIsExpanding(false)}
                                                    disabled={isExtendingLoading}
                                                    className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center min-h-[600px] text-gray-500 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                            <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl border border-gray-100 ring-4 ring-gray-50">
                                <PlayIcon className="w-12 h-12 text-indigo-400 ml-2" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-700 mb-3">Chưa có kịch bản nào</h3>
                            <p className="text-gray-500 max-w-sm text-center text-lg">
                                Nhập ý tưởng và nhấn <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">Tạo Kịch bản</span>.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default MainScreen;
