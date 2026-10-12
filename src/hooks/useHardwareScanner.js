import { useEffect, useRef } from 'react';

/**
 * Hook to listen for USB / Bluetooth hardware barcode scanner keystrokes
 * Physical scanners type very rapidly (< 50ms per key) followed by Enter key
 * @param {Function} onBarcodeScanned - Callback when full barcode string is captured
 */
export function useHardwareScanner(onBarcodeScanned) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is actively typing in an input or textarea
      const targetTag = e.target?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || e.target?.isContentEditable;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key marks end of barcode
      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        bufferRef.current = '';

        if (scanned.length >= 3) {
          // If typed inside an input, only prevent if it was super fast (scanner)
          if (!isInput || timeDiff < 80) {
            e.preventDefault();
            onBarcodeScanned(scanned);
          }
        }
        return;
      }

      // If time interval between keys is > 100ms, it's normal human typing, reset buffer
      if (timeDiff > 100) {
        bufferRef.current = '';
      }

      // Collect alphanumeric and standard barcode characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBarcodeScanned]);
}
