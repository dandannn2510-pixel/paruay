/**
 * remoteScannerService.js
 * Real-time peer-to-peer bridge connecting a smartphone (Handheld Scanner Gun)
 * to an iPad / POS terminal (Host Screen) using Supabase Realtime Broadcast.
 *
 * Latency: ~30-60ms over standard 4G/5G/WiFi.
 * Works across completely different networks without needing local network permissions.
 */

import { getSupabaseClient } from '../utils/supabase';

const PAIR_CODE_STORAGE_KEY = 'paruay_pos_pair_code';

/**
 * Generate or get stable 4-digit pairing PIN for this POS terminal
 */
export function getOrCreatePairCode() {
  let code = localStorage.getItem(PAIR_CODE_STORAGE_KEY);
  if (!code || code.length !== 4) {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem(PAIR_CODE_STORAGE_KEY, code);
  }
  return code;
}

export function generateNewPairCode() {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  localStorage.setItem(PAIR_CODE_STORAGE_KEY, code);
  return code;
}

/**
 * HOST (iPad / Cashier Terminal) Channel Controller
 * Listens for incoming barcode scans from the phone and sends back receipt confirmations.
 */
export function createScannerHost({
  pairCode,
  onClientStatusChange,
  onBarcodeReceived,
}) {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[RemoteScanner Host] Supabase client not available');
    return null;
  }

  const channelName = `pos_scanner_room_${pairCode}`;
  let isConnected = false;
  let activeClients = new Map(); // clientId -> { name, lastSeen }

  const channel = client.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'client_join' }, ({ payload }) => {
      console.log('[RemoteScanner Host] Client joined:', payload);
      activeClients.set(payload.clientId || 'default', {
        name: payload.deviceName || 'สมาร์ทโฟน',
        lastSeen: Date.now(),
      });
      if (onClientStatusChange) {
        onClientStatusChange({
          connected: true,
          deviceName: payload.deviceName || 'สมาร์ทโฟน',
          count: activeClients.size,
        });
      }
      // Send welcome / host presence pong
      channel.send({
        type: 'broadcast',
        event: 'host_presence',
        payload: { hostName: 'เครื่องแคชเชียร์ (iPad)', timestamp: Date.now() },
      }).catch(() => {});
    })
    .on('broadcast', { event: 'client_heartbeat' }, ({ payload }) => {
      activeClients.set(payload.clientId || 'default', {
        name: payload.deviceName || 'สมาร์ทโฟน',
        lastSeen: Date.now(),
      });
      if (onClientStatusChange) {
        onClientStatusChange({
          connected: true,
          deviceName: payload.deviceName || 'สมาร์ทโฟน',
          count: activeClients.size,
        });
      }
    })
    .on('broadcast', { event: 'scan_barcode' }, ({ payload }) => {
      console.log('[RemoteScanner Host] Barcode received from phone:', payload);
      if (payload && payload.barcode && onBarcodeReceived) {
        const feedback = onBarcodeReceived(payload.barcode, payload);
        // Reply with acknowledgment back to phone
        channel.send({
          type: 'broadcast',
          event: 'scan_ack',
          payload: {
            scanId: payload.scanId,
            barcode: payload.barcode,
            success: true,
            productName: feedback?.productName || '',
            price: feedback?.price || 0,
            cartCount: feedback?.cartCount || 0,
            timestamp: Date.now(),
          },
        }).catch(() => {});
      }
    })
    .on('broadcast', { event: 'client_leave' }, ({ payload }) => {
      activeClients.delete(payload?.clientId || 'default');
      if (onClientStatusChange) {
        onClientStatusChange({
          connected: activeClients.size > 0,
          deviceName: '',
          count: activeClients.size,
        });
      }
    });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isConnected = true;
      console.log(`[RemoteScanner Host] Subscribed to room: ${channelName}`);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      isConnected = false;
      if (onClientStatusChange) {
        onClientStatusChange({ connected: false, count: 0 });
      }
    }
  });

  return {
    sendAck: (ackPayload) => {
      if (isConnected) {
        channel.send({
          type: 'broadcast',
          event: 'scan_ack',
          payload: ackPayload,
        }).catch(() => {});
      }
    },
    destroy: () => {
      try {
        channel.send({
          type: 'broadcast',
          event: 'host_closed',
          payload: { timestamp: Date.now() },
        }).catch(() => {});
        client.removeChannel(channel);
      } catch (err) {
        console.warn('[RemoteScanner Host] Error closing channel:', err);
      }
    },
  };
}

/**
 * CLIENT (Phone Scanner Gun) Channel Controller
 * Sends scanned barcodes to iPad and receives instant feedback
 */
export function createScannerClient({
  pairCode,
  deviceName = 'มือถือของฉัน',
  onHostStatusChange,
  onScanAck,
}) {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[RemoteScanner Client] Supabase client not available');
    return null;
  }

  const clientId = 'phone_' + Math.random().toString(36).substring(2, 9);
  const channelName = `pos_scanner_room_${pairCode}`;
  let isConnected = false;
  let heartbeatTimer = null;

  const channel = client.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'host_presence' }, ({ payload }) => {
      console.log('[RemoteScanner Client] Host presence received:', payload);
      if (onHostStatusChange) {
        onHostStatusChange({ connected: true, hostName: payload.hostName || 'iPad แคชเชียร์' });
      }
    })
    .on('broadcast', { event: 'scan_ack' }, ({ payload }) => {
      console.log('[RemoteScanner Client] Scan ack received:', payload);
      if (onScanAck) {
        onScanAck(payload);
      }
    })
    .on('broadcast', { event: 'host_closed' }, () => {
      if (onHostStatusChange) {
        onHostStatusChange({ connected: false });
      }
    });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isConnected = true;
      console.log(`[RemoteScanner Client] Subscribed to room: ${channelName}`);
      // Announce arrival to host
      channel.send({
        type: 'broadcast',
        event: 'client_join',
        payload: { clientId, deviceName, timestamp: Date.now() },
      }).catch(() => {});

      if (onHostStatusChange) {
        onHostStatusChange({ connected: true, hostName: 'ห้อง ' + pairCode });
      }

      // Heartbeat every 10s
      heartbeatTimer = setInterval(() => {
        channel.send({
          type: 'broadcast',
          event: 'client_heartbeat',
          payload: { clientId, deviceName, timestamp: Date.now() },
        }).catch(() => {});
      }, 10000);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      isConnected = false;
      if (onHostStatusChange) {
        onHostStatusChange({ connected: false });
      }
    }
  });

  return {
    sendScan: (barcode) => {
      const scanId = 'scan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      if (!isConnected) {
        console.warn('[RemoteScanner Client] Cannot send scan: not connected');
      }
      return channel.send({
        type: 'broadcast',
        event: 'scan_barcode',
        payload: {
          clientId,
          scanId,
          barcode: String(barcode).trim(),
          timestamp: Date.now(),
        },
      });
    },
    destroy: () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try {
        channel.send({
          type: 'broadcast',
          event: 'client_leave',
          payload: { clientId, timestamp: Date.now() },
        }).catch(() => {});
        client.removeChannel(channel);
      } catch (err) {
        console.warn('[RemoteScanner Client] Error closing channel:', err);
      }
    },
  };
}
