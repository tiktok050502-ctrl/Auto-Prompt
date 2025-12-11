import React, { useState, useEffect, PropsWithChildren } from 'react';
import MainScreen from './components/MainScreen';

// =============================================================================
// CẤU HÌNH APP
// =============================================================================
const APP_SECRET = 'SECRET_KEY_BRIDGE_8823_HASH'; 
// !!! QUAN TRỌNG: Thay link này bằng link Render thật của bạn !!!
const SERVER_URL = 'https://serverkey-79p6.onrender.com'; 

// --- Component Màn hình khóa ---
const AuthGuard = ({ children }: PropsWithChildren) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  // HÀM ĐĂNG XUẤT / ĐỔI KEY (Helper)
  const handleLogout = () => {
    localStorage.removeItem('my_app_license_online');
    localStorage.removeItem('my_app_license');
    setIsUnlocked(false);
    setKeyInput('');
    setError('');
  };

  // 1. Kiểm tra Online (STRICT MODE)
  const verifyKeyOnline = async (key: string) => {
    try {
      const baseUrl = SERVER_URL.replace(/\/$/, '');
      const endpoint = `${baseUrl}/api/verify`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
           return { status: 'INVALID', message: 'Key không tồn tại, đã bị xóa hoặc hết hạn.' };
        }
        return { status: 'ERROR', message: 'Lỗi Server' };
      }

      const data = await response.json();
      if (data.valid === false) {
         return { status: 'INVALID', message: data.message || 'Key không hợp lệ' };
      }
      return { status: 'VALID', data };
      
    } catch (e: any) {
      return { status: 'NETWORK_ERROR' }; 
    }
  };

  // 2. Kiểm tra Offline (Fallback)
  const verifyKeyOffline = (keyString: string) => {
    try {
      const simpleHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; 
        }
        return Math.abs(hash).toString(16);
      };

      const parts = keyString.split('-');
      if (parts.length !== 4 || parts[0] !== 'SK') return { valid: false, message: 'Sai định dạng.' };
      const [prefix, expHex, typeCode, signature] = parts;
      const expectedSig = simpleHash(expHex + '-' + typeCode + APP_SECRET).toUpperCase();
      
      if (signature !== expectedSig) return { valid: false, message: 'Key không hợp lệ.' };
      
      if (expHex !== 'LIFETIME') {
        const expiresAt = parseInt(expHex, 16);
        if (Date.now() > expiresAt) return { valid: false, message: 'Key đã hết hạn.' };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, message: 'Lỗi xác thực offline.' };
    }
  };

  // 3. Helper hiển thị thời gian
  const getKeyDisplayInfo = () => {
    const key = localStorage.getItem('my_app_license_online');
    if (!key) return null;
    
    try {
      const parts = key.split('-');
      if (parts.length < 2) return null;
      const expHex = parts[1];
      if (expHex === 'LIFETIME') return 'Vĩnh viễn';
      const expTimestamp = parseInt(expHex, 16);
      if (isNaN(expTimestamp)) return 'Không xác định';

      const now = Date.now();
      const diff = expTimestamp - now;
      if (diff <= 0) return 'Đã hết hạn';
      
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days > 365) return `${Math.floor(days/365)} năm`;
      if (days > 30) return `${Math.floor(days/30)} tháng`;
      return `${days} ngày`;
    } catch(e) { return null; }
  };

  // --- REAL-TIME EXPIRY CHECK (NEW) ---
  useEffect(() => {
    if (!isUnlocked) return;

    const checkExpiryNow = () => {
       const key = localStorage.getItem('my_app_license_online');
       if (!key) return;

       try {
          const parts = key.split('-');
          const expHex = parts[1];
          if (expHex !== 'LIFETIME') {
            const expTimestamp = parseInt(expHex, 16);
            if (!isNaN(expTimestamp) && Date.now() > expTimestamp) {
               alert('Thời hạn sử dụng Key đã kết thúc. Vui lòng liên hệ Admin để gia hạn.');
               handleLogout();
            }
          }
       } catch (e) {
          console.error("Lỗi check hạn:", e);
       }
    };

    const interval = setInterval(checkExpiryNow, 60000);
    return () => clearInterval(interval);
  }, [isUnlocked]);

  useEffect(() => {
    const checkSavedKey = async () => {
      const savedKey = localStorage.getItem('my_app_license_online');
      if (savedKey) {
        const onlineRes = await verifyKeyOnline(savedKey);

        if (onlineRes.status === 'VALID') {
           setIsUnlocked(true);
        } else if (onlineRes.status === 'INVALID') {
           localStorage.removeItem('my_app_license_online');
        } else {
           const offlineRes = verifyKeyOffline(savedKey);
           if (offlineRes.valid) setIsUnlocked(true);
        }
      }
      setIsLoading(false);
    };
    checkSavedKey();
  }, []);

  const handleUnlock = async () => {
    const inputClean = keyInput.trim().toUpperCase();
    if (!inputClean) return;
    
    setIsLoading(true);
    setError('');
    
    const onlineRes = await verifyKeyOnline(inputClean);

    if (onlineRes.status === 'VALID') {
      localStorage.setItem('my_app_license_online', inputClean);
      setIsUnlocked(true);
    } 
    else if (onlineRes.status === 'INVALID') {
      setError(onlineRes.message);
    } 
    else {
      const offlineRes = verifyKeyOffline(inputClean);
      if (offlineRes.valid) {
        localStorage.setItem('my_app_license_online', inputClean);
        setIsUnlocked(true);
      } else {
        setError(offlineRes.message);
      }
    }
    setIsLoading(false);
  };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-800 p-4 font-medium animate-pulse">Đang kiểm tra bản quyền...</div>;

  if (isUnlocked) return (
    <>
      <div className="fixed top-4 right-4 z-[9999] flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md text-gray-800 px-4 py-2 rounded-full border border-gray-200 shadow-lg text-sm font-medium">
           <span className="text-gray-500">Hạn dùng:</span>
           <span className="font-bold text-indigo-600">{getKeyDisplayInfo()}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-red-500/30 transition-all transform hover:scale-105 active:scale-95"
        >
          Đổi Key
        </button>
      </div>

      {children}
    </>
  );

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center p-4 z-50 font-sans">
      <div className="bg-white p-10 rounded-3xl w-full max-w-md text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-30"></div>
        
        <h2 className="text-3xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight relative z-10">
            Kích Hoạt Ứng Dụng
        </h2>
        <p className="text-gray-500 mb-8 text-base relative z-10">Nhập mã bản quyền để bắt đầu sáng tạo.</p>
        
        <div className="relative mb-6 z-10">
            <input 
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
            className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-mono uppercase text-gray-900 text-lg bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-inner"
            placeholder="SK-XXXX-XXXX-XXXX"
            />
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm font-bold border border-red-100 animate-pulse relative z-10">{error}</div>}
        
        <button 
          onClick={handleUnlock} 
          disabled={isLoading}
          className="w-full relative z-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/30"
        >
          {isLoading ? 'Đang xác thực...' : 'Mở Khóa Ngay'}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-purple-100 selection:text-purple-900">
         <MainScreen />
      </div>
    </AuthGuard>
  );
}