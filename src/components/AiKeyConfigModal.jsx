import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  getActiveGeminiApiKey,
  setStoredGeminiApiKey,
  testGeminiApiKey,
  isUsingCentralDefaultKey,
} from '../utils/aiVisionScanner';
import { playClickSound, playCashRegisterChime, playErrorBuzz } from '../utils/sound';

export function AiKeyConfigModal({ isOpen, onClose, onKeySaved }) {
  if (!isOpen) return null;

  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [testErrorMsg, setTestErrorMsg] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const existing = getActiveGeminiApiKey();
    setKeyInput(existing);
    setTestStatus('idle');
    setTestErrorMsg('');
    setSavedSuccess(false);
  }, [isOpen]);

  const handleTest = async () => {
    if (!keyInput.trim()) {
      setTestStatus('error');
      setTestErrorMsg('กรุณากรอก API Key ก่อนทดสอบ');
      playErrorBuzz();
      return;
    }

    playClickSound();
    setIsTesting(true);
    setTestStatus('idle');
    setTestErrorMsg('');

    try {
      const res = await testGeminiApiKey(keyInput.trim());
      if (res.success) {
        setTestStatus('success');
        playCashRegisterChime();
      } else {
        setTestStatus('error');
        setTestErrorMsg(res.error || 'การเชื่อมต่อล้มเหลว');
        playErrorBuzz();
      }
    } catch (err) {
      setTestStatus('error');
      setTestErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      playErrorBuzz();
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    playClickSound();
    setStoredGeminiApiKey(keyInput.trim());
    setSavedSuccess(true);
    playCashRegisterChime();

    if (onKeySaved) {
      onKeySaved(keyInput.trim());
    }

    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleRemove = () => {
    playClickSound();
    setStoredGeminiApiKey('');
    setKeyInput('');
    setTestStatus('idle');
    if (onKeySaved) {
      onKeySaved('');
    }
  };

  const hasActiveKey = Boolean(getActiveGeminiApiKey());

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-content animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
            borderBottom: '1px solid #bfdbfe',
            padding: '16px 20px',
          }}
        >
          <div className="header-info flex items-center gap-3">
            <div
              className="brand-logo-wrap flex items-center justify-center rounded-full"
              style={{
                width: 42,
                height: 42,
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="modal-title text-lg font-bold" style={{ color: '#1e3a8a' }}>
                ตั้งค่า Google Gemini AI ผู้ช่วยอัจฉริยะ
              </h3>
              <p className="modal-subtitle text-xs" style={{ color: '#3b82f6' }}>
                ช่วยอ่านฉลาก ตั้งชื่อสินค้า แนะนำหมวดหมู่ และราคาขายอัตโนมัติแม่นยำ 100%
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn close-btn" onClick={onClose} title="ปิด">
            <X size={20} />
          </button>
        </div>

        <div className="modal-form-body p-4" style={{ background: 'var(--bg-surface)' }}>
          {/* Active Status Badge */}
          <div
            className="flex items-center justify-between p-3 mb-3 rounded-xl"
            style={{
              background: hasActiveKey ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${hasActiveKey ? '#bbf7d0' : '#e2e8f0'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: hasActiveKey ? '#22c55e' : '#94a3b8' }}
              />
              <span className="text-xs font-bold text-gray-800">
                สถานะ:{' '}
                {hasActiveKey
                  ? isUsingCentralDefaultKey() && !localStorage.getItem('paruay_gemini_api_key')
                    ? '🟢 AI Gemini พร้อมทำงาน (เชื่อมต่อคีย์กลางอัตโนมัติทุกเครื่อง)'
                    : '🟢 AI Gemini Vision พร้อมทำงานแล้ว'
                  : '⚪ ยังไม่ได้ใส่ API Key'}
              </span>
            </div>
            {hasActiveKey && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-800 flex items-center gap-1">
                <ShieldCheck size={13} />{' '}
                {isUsingCentralDefaultKey() && !localStorage.getItem('paruay_gemini_api_key')
                  ? 'คีย์กลางประจำร้าน'
                  : 'ฟรีและเสถียร'}
              </span>
            )}
          </div>

          {/* Guide Card: How to get FREE Google AI API Key */}
          <div
            className="p-3.5 mb-4 rounded-xl"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <strong className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" /> วิธีขอ Gemini API Key ฟรี (30 วินาที):
              </strong>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-xs font-bold flex items-center gap-1 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                <span>กดรับ API Key ฟรีที่นี่</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <ol className="text-xs text-muted list-decimal list-inside space-y-1 pl-1">
              <li>กดปุ่มสีน้ำเงินด้านบน เพื่อเปิดหน้า <b>Google AI Studio</b></li>
              <li>ล็อกอินด้วยบัญชี Google แล้วกดปุ่ม <b>"Create API key"</b></li>
              <li>คัดลอกรหัสที่ได้ (ขึ้นต้นด้วย <code>AIzaSy...</code>) มาวางในช่องด้านล่าง</li>
            </ol>
          </div>

          {/* Key Input Field */}
          <div className="form-group mb-3">
            <label className="form-label font-bold text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key size={15} /> Google Gemini API Key:
              </span>
              <button
                type="button"
                className="text-xs text-muted hover:text-primary flex items-center gap-1"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showKey ? 'ซ่อนรหัส' : 'แสดงรหัส'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="form-control font-mono text-sm"
                placeholder="วางรหัส AIzaSy... ที่คัดลอกมาที่นี่"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setTestStatus('idle');
                }}
                style={{
                  paddingRight: 95,
                  letterSpacing: showKey ? 'normal' : '0.1em',
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-xs font-bold absolute right-1.5 top-1.5 bottom-1.5 my-auto"
                onClick={handleTest}
                disabled={isTesting || !keyInput.trim()}
              >
                {isTesting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>กำลังทดสอบ...</span>
                  </>
                ) : (
                  <span>ทดสอบคีย์</span>
                )}
              </button>
            </div>
          </div>

          {/* Test Status Feedback */}
          {testStatus === 'success' && (
            <div
              className="p-2.5 mb-3 rounded-lg flex items-center gap-2 text-xs font-bold text-green-800 bg-green-50 border border-green-200 animate-fade-in"
            >
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span>การเชื่อมต่อสมบูรณ์แบบ! AI พร้อมวิเคราะห์ภาพถ่ายสินค้าแล้ว</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div
              className="p-2.5 mb-3 rounded-lg flex items-center gap-2 text-xs font-bold text-red-800 bg-red-50 border border-red-200 animate-fade-in"
            >
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{testErrorMsg || 'API Key ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'}</span>
            </div>
          )}

          {savedSuccess && (
            <div
              className="p-2.5 mb-3 rounded-lg flex items-center gap-2 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 animate-fade-in"
            >
              <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
              <span>บันทึก API Key เรียบร้อยแล้ว!</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div
          className="modal-actions p-3 flex items-center justify-between gap-2"
          style={{
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-surface-elevated, #f8fafc)',
          }}
        >
          {hasActiveKey ? (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm text-xs font-bold"
              onClick={handleRemove}
            >
              ล้างคีย์ออก
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              ไว้ทีหลัง
            </button>
          )}

          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm font-bold flex items-center gap-1.5 shadow-sm"
              onClick={handleSave}
              disabled={!keyInput.trim()}
            >
              <Sparkles size={14} />
              <span>บันทึกและเปิดใช้งาน AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
