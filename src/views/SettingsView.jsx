import {
  Settings,
  Store,
  QrCode,
  Shield,
  Volume2,
  Database,
  CheckCircle2,
  Save,
  RotateCcw,
  Upload,
  Image,
  Cloud,
  Sparkles,
  Key,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  getActiveGeminiApiKey,
  setStoredGeminiApiKey,
  testGeminiApiKey,
} from '../utils/aiVisionScanner';
import { playClickSound, playCashRegisterChime, playErrorBuzz } from '../utils/sound';

export function SettingsView() {
  const {
    settings,
    setSettings,
    isCloudConnected,
    connectSupabase,
    disconnectSupabase,
  } = useStore();

  const [shopName, setShopName] = useState(settings.shopName || 'พารวย');
  const [shopTagline, setShopTagline] = useState(settings.shopTagline || 'ร้านนี้ดี ค้าขาย ร่ำรวย');
  const [shopPhone, setShopPhone] = useState(settings.shopPhone || '081-987-6543');
  const [permanentQrImage, setPermanentQrImage] = useState(settings.permanentQrImage || '/qr-promptpay.png');
  const [adminPin, setAdminPin] = useState(settings.adminPin || '1234');
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled ?? true);

  // Gemini AI Vision State
  const [geminiKey, setGeminiKey] = useState(() => getActiveGeminiApiKey());
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [geminiTestMsg, setGeminiTestMsg] = useState('');

  // Cloud Supabase State
  const [cloudUrl, setCloudUrl] = useState(localStorage.getItem('paruay_supabase_url') || '');
  const [cloudKey, setCloudKey] = useState(localStorage.getItem('paruay_supabase_anon_key') || '');
  const [cloudError, setCloudError] = useState('');
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);

  const handleConnectCloud = async () => {
    if (!cloudUrl.trim() || !cloudKey.trim()) {
      setCloudError('กรุณากรอกทั้ง Project URL และ Anon Key');
      return;
    }
    setCloudError('');
    setIsConnectingCloud(true);
    const res = await connectSupabase(cloudUrl.trim(), cloudKey.trim());
    setIsConnectingCloud(false);
    if (!res.success) {
      setCloudError('เชื่อมต่อไม่สำเร็จ: ' + res.message);
    }
  };

  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        if (base64) {
          setPermanentQrImage(base64);
          playClickSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    playClickSound();

    setSettings({
      ...settings,
      shopName: shopName.trim(),
      shopTagline: shopTagline.trim(),
      shopPhone: shopPhone.trim(),
      permanentQrImage,
      adminPin: adminPin.trim(),
      soundEnabled,
    });

    setStoredGeminiApiKey(geminiKey.trim());

    playCashRegisterChime();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus('error');
      setGeminiTestMsg('กรุณากรอก API Key ก่อนทดสอบ');
      playErrorBuzz();
      return;
    }
    playClickSound();
    setIsTestingGemini(true);
    setGeminiTestStatus('idle');
    setGeminiTestMsg('');
    try {
      const res = await testGeminiApiKey(geminiKey.trim());
      if (res.success) {
        setGeminiTestStatus('success');
        playCashRegisterChime();
      } else {
        setGeminiTestStatus('error');
        setGeminiTestMsg(res.error || 'การเชื่อมต่อล้มเหลว');
        playErrorBuzz();
      }
    } catch (err) {
      setGeminiTestStatus('error');
      setGeminiTestMsg(err.message || 'เกิดข้อผิดพลาด');
      playErrorBuzz();
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลสินค้าและประวัติกลับเป็นข้อมูลตัวอย่างตั้งต้นใช่หรือไม่?')) {
      playClickSound();
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="settings-layout animate-fade-in">
      <div className="section-header">
        <div>
          <h2>⚙️ ตั้งค่าระบบร้านค้า (Settings)</h2>
          <p className="section-subtitle">
            จัดการข้อมูลร้าน, ป้ายคิวอาร์โค้ดถาวรสำหรับรับเงิน, และรหัส PIN
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="alert-banner alert-success animate-slide-up mb-4">
          <CheckCircle2 size={20} />
          <span>บันทึกการตั้งค่าเรียบร้อยแล้ว!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-cards-grid">
        {/* Card 1: Shop Profile */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Store size={20} className="text-primary" />
            <span>ข้อมูลร้านค้าและโลโก้</span>
          </h3>

          <div className="flex items-center gap-3 mb-4 p-3 bg-card rounded">
            <img src="/logo.png" alt="โลโก้ร้าน" className="w-16 h-16 rounded-full border-2 border-red-500 shadow" />
            <div>
              <strong className="block text-base">โลโก้ร้านพารวย</strong>
              <span className="text-xs text-muted">ตราสัญลักษณ์ร้านค้า "ร้านนี้ดี ค้าขาย ร่ำรวย"</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ชื่อร้านค้า *:</label>
            <input
              type="text"
              className="form-control"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">สโลแกน / คำขวัญร้าน:</label>
            <input
              type="text"
              className="form-control"
              value={shopTagline}
              onChange={(e) => setShopTagline(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">เบอร์โทรศัพท์ร้าน:</label>
            <input
              type="text"
              className="form-control"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Card 2: Permanent QR Code */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <QrCode size={20} className="text-accent" />
            <span>ป้าย QR Code ถาวรของร้าน (สแกนจ่ายเงิน)</span>
          </h3>

          <div className="flex flex-col items-center justify-center p-3 bg-card rounded mb-3">
            <div className="permanent-qr-preview-box">
              <img
                src={permanentQrImage}
                alt="ป้าย QR โค้ดของร้าน"
                className="w-48 h-48 object-contain bg-white rounded p-2 shadow"
                onError={(e) => {
                  e.currentTarget.src = '/qr-promptpay.png';
                }}
              />
            </div>
            <span className="text-xs text-muted mt-2">
              รูปภาพป้าย QR Code ที่แสดงให้ลูกค้าสแกนตอนคิดเงิน
            </span>
          </div>

          <div className="form-group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn btn-outline-primary w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              <span>เลือกไฟล์รูปภาพป้าย QR จากเครื่อง</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">หรือใส่ลิงก์รูปภาพ QR (URL):</label>
            <input
              type="text"
              className="form-control text-xs"
              placeholder="/qr-promptpay.png หรือ https://..."
              value={permanentQrImage}
              onChange={(e) => setPermanentQrImage(e.target.value)}
            />
          </div>
        </div>

        {/* Card 3: Security & Audio Preferences */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Shield size={20} className="text-warning" />
            <span>รหัส PIN & ระบบเสียง</span>
          </h3>

          <div className="form-group">
            <label className="form-label">รหัส PIN เจ้าของร้าน (4 หลัก) *:</label>
            <input
              type="password"
              maxLength="4"
              className="form-control font-mono font-bold text-center w-36"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              required
            />
            <p className="text-xs text-muted mt-1">
              ใช้สำหรับอนุมัติการให้ส่วนลดท้ายบิล หรือปลดล็อกโหมดแคชเชียร์ (ค่าเริ่มต้น 1234)
            </p>
          </div>

          <div className="form-group mt-4">
            <label className="toggle-switch-label">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text flex items-center gap-2">
                <Volume2 size={18} />
                <span>เปิดเสียงเอฟเฟกต์ (เสียงปี๊บสแกน และเสียงคิดเงิน)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Card 4: Google Gemini AI Vision Assistant */}
        <div className="pos-card-box">
          <div className="flex items-center justify-between mb-2">
            <h3 className="card-box-title mb-0">
              <Sparkles size={20} className="text-primary" />
              <span>AI ผู้ช่วยอัจฉริยะ (Google Gemini AI Vision)</span>
            </h3>
            {geminiKey ? (
              <span className="status-pill status-normal">🟢 เปิดใช้งาน AI แล้ว</span>
            ) : (
              <span className="status-pill status-low">⚪ ยังไม่ได้ใส่ API Key</span>
            )}
          </div>

          <p className="text-xs text-muted mb-3">
            ใช้พลังของ <strong>Google Gemini AI Multimodal Vision</strong>{' '}
            อ่านรูปฉลากสินค้า ตั้งชื่อภาษาไทยถูกต้อง 100% จัดหมวดหมู่อัตโนมัติ และประเมินราคาขายทันที
          </p>

          <div className="p-3 mb-3 rounded-lg bg-blue-50 border border-blue-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-blue-900 font-bold">วิธีขอ API Key ฟรีจาก Google:</strong>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold flex items-center gap-1 hover:underline"
              >
                <span>เปิด Google AI Studio</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-blue-800 m-0">
              เข้า Google AI Studio แล้วกด <b>Create API key</b> นำรหัสมาวางด้านล่าง (ฟรี ไม่มีค่าบริการ)
            </p>
          </div>

          <div className="form-group mb-2">
            <label className="form-label font-bold text-xs flex items-center gap-1">
              <Key size={14} /> Google Gemini API Key:
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="form-control font-mono text-xs flex-1"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setGeminiTestStatus('idle');
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm font-bold shrink-0"
                onClick={handleTestGemini}
                disabled={isTestingGemini || !geminiKey.trim()}
              >
                {isTestingGemini ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
              </button>
            </div>
          </div>

          {geminiTestStatus === 'success' && (
            <div className="text-success text-xs font-bold mb-2">
              ✓ การเชื่อมต่อสำเร็จ! AI พร้อมทำงานวิเคราะห์รูปภาพสินค้า
            </div>
          )}
          {geminiTestStatus === 'error' && (
            <div className="text-danger text-xs font-bold mb-2">
              ✗ {geminiTestMsg || 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบ API Key'}
            </div>
          )}
        </div>

        {/* Card 5: Supabase Multi-Device Cloud Database */}
        <div className="pos-card-box">
          <div className="flex items-center justify-between mb-2">
            <h3 className="card-box-title mb-0">
              <Cloud size={20} className="text-accent" />
              <span>เชื่อมต่อฐานข้อมูลคลาวด์ (ใช้งานหลายเครื่อง)</span>
            </h3>
            {isCloudConnected ? (
              <span className="status-pill status-normal">🟢 เชื่อมต่อคลาวด์แล้ว</span>
            ) : (
              <span className="status-pill status-low">⚪ ใช้งานแบบเครื่องเดียว</span>
            )}
          </div>

          <p className="text-xs text-muted mb-3">
            เชื่อมต่อกับ <strong>Supabase</strong> เพื่อให้โทรศัพท์ทุกเครื่องในร้านตัดสต็อกและบันทึกยอดขายพร้อมกันแบบ Real-time
          </p>

          <div className="form-group">
            <label className="form-label">Project URL (Supabase):</label>
            <input
              type="text"
              className="form-control font-mono text-xs"
              placeholder="https://your-project.supabase.co"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Anon Public API Key:</label>
            <input
              type="password"
              className="form-control font-mono text-xs"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={cloudKey}
              onChange={(e) => setCloudKey(e.target.value)}
            />
          </div>

          {cloudError && <div className="text-danger text-xs mb-2">{cloudError}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1 btn-sm font-bold"
              disabled={isConnectingCloud}
              onClick={handleConnectCloud}
            >
              {isConnectingCloud ? 'กำลังตรวจสอบ...' : isCloudConnected ? 'อัปเดตการเชื่อมต่อ' : 'ทดสอบและเชื่อมต่อคลาวด์'}
            </button>
            {isCloudConnected && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={disconnectSupabase}
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            )}
          </div>

          <div className="mt-3 p-2 bg-card rounded text-xs text-muted">
            📄 มีไฟล์ตารางฐานข้อมูล <strong>supabase_schema.sql</strong> เตรียมไว้ให้ในโปรเจกต์ นำไปรันใน Supabase SQL Editor ได้ทันที
          </div>
        </div>

        {/* Card 5: Reset & Local Storage */}
        <div className="pos-card-box">
          <h3 className="card-box-title">
            <Database size={20} className="text-info" />
            <span>จัดการข้อมูลในเครื่อง</span>
          </h3>

          <p className="text-sm text-muted mb-4">
            ข้อมูลทั้งหมดถูกบันทึกสำรองในอุปกรณ์นี้แบบ Local-first สามารถขายต่อได้แม้ออฟไลน์
          </p>

          <button
            type="button"
            className="btn btn-outline-danger w-full"
            onClick={handleResetData}
          >
            <RotateCcw size={16} />
            <span>รีเซ็ตข้อมูลเริ่มต้น (โหลดสินค้าตัวอย่างใหม่)</span>
          </button>
        </div>

        {/* Save button footer */}
        <div className="settings-footer-actions">
          <button type="submit" className="btn btn-primary btn-large font-bold px-8">
            <Save size={20} />
            <span>บันทึกการตั้งค่าทั้งหมด</span>
          </button>
        </div>
      </form>
    </div>
  );
}
