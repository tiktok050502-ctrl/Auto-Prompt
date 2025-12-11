import React, { useState } from 'react';
import { Scene } from '../types';
import { ClipboardIcon, CheckIcon, WandIcon } from './icons';

interface SceneCardProps {
    scene: Scene;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene }) => {
    const [isPromptCopied, setIsPromptCopied] = useState(false);
    const [isWishkCopied, setIsWishkCopied] = useState(false);
    
    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(scene.veo_prompt).then(() => {
            setIsPromptCopied(true);
            setTimeout(() => setIsPromptCopied(false), 2000); 
        });
    };

    const handleCopyWishk = () => {
         navigator.clipboard.writeText(scene.wishk_prompt).then(() => {
            setIsWishkCopied(true);
            setTimeout(() => setIsWishkCopied(false), 2000);
        });
    }

    return (
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden transition-all duration-300 hover:border-indigo-200 hover:shadow-[0_20px_50px_-10px_rgba(79,70,229,0.15)] hover:-translate-y-1 group">
            <div className="p-6 md:p-8 bg-gradient-to-r from-gray-50/80 to-white border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                    Cảnh {scene.scene_number}
                </h3>
            </div>
            <div className="p-6 md:p-8 pt-6">
                <div className="space-y-6">
                    {/* Prompt Details */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-800 text-lg">Veo Prompt (Tiếng Anh)</h4>
                            <button
                                onClick={handleCopyPrompt}
                                className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-full transition-all shadow-md transform active:scale-95 ${
                                    isPromptCopied
                                        ? 'bg-green-500 text-white shadow-green-500/30'
                                        : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600 shadow-indigo-500/30'
                                }`}
                            >
                                {isPromptCopied ? (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        <span>Đã sao chép!</span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardIcon className="w-4 h-4" />
                                        <span>Sao chép Prompt</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="text-sm text-indigo-900 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 whitespace-pre-wrap font-mono text-xs mb-4 shadow-inner hover:bg-indigo-50/50 transition-colors">
                           <code>{scene.veo_prompt}</code>
                        </pre>
                    </div>

                    {/* Wishk Prompt Section */}
                    {scene.wishk_prompt && (
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-amber-700 flex items-center text-lg">
                                    <WandIcon className="w-5 h-5 mr-2 text-amber-500" />
                                    Wishk AI Prompt
                                </h4>
                                <button
                                    onClick={handleCopyWishk}
                                    className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-full transition-all shadow-md transform active:scale-95 ${
                                        isWishkCopied
                                            ? 'bg-green-500 text-white shadow-green-500/30'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30'
                                    }`}
                                >
                                    {isWishkCopied ? (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            <span>Đã sao chép!</span>
                                        </>
                                    ) : (
                                        <>
                                            <ClipboardIcon className="w-4 h-4" />
                                            <span>Copy Wishk</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="text-sm text-amber-900 bg-amber-50/30 p-5 rounded-2xl border border-amber-100 whitespace-pre-wrap font-medium shadow-inner hover:bg-amber-100/50 transition-colors">
                                {scene.wishk_prompt}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SceneCard;