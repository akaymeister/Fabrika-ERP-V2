const { spawn } = require('child_process');

const LOCAL_PORT = Number(process.env.PORT) || 3000;
const URL_REGEX = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;
const ALLOWED_HOURS = new Set([1, 4, 8]);
const CLOUDFLARED_CANDIDATES = [
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
  'cloudflared',
];

const state = {
  proc: null,
  publicUrl: null,
  startedAt: null,
  expiresAt: null,
  autoStopTimer: null,
  lastError: null,
};

function clearAutoStopTimer() {
  if (state.autoStopTimer) {
    clearTimeout(state.autoStopTimer);
    state.autoStopTimer = null;
  }
}

function readStatus() {
  const now = Date.now();
  const isOpen = !!(state.proc && state.expiresAt && state.expiresAt > now);
  const remainingMs = isOpen ? Math.max(0, state.expiresAt - now) : 0;
  return {
    isOpen,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    startedAt: state.startedAt,
    expiresAt: state.expiresAt,
    publicUrl: state.publicUrl,
    lastError: state.lastError,
  };
}

async function stopTunnel() {
  clearAutoStopTimer();
  if (state.proc) {
    try {
      state.proc.kill();
    } catch (_) {
      /* ignore */
    }
  }
  state.proc = null;
  state.publicUrl = null;
  state.startedAt = null;
  state.expiresAt = null;
  return readStatus();
}

function scheduleAutoStop() {
  clearAutoStopTimer();
  if (!state.expiresAt) return;
  const delay = Math.max(0, state.expiresAt - Date.now());
  state.autoStopTimer = setTimeout(() => {
    stopTunnel().catch(() => {});
  }, delay);
}

function parseTryCloudflareUrl(chunk) {
  const m = String(chunk || '').match(URL_REGEX);
  return m ? m[1] : null;
}

async function startTunnel(hoursRaw) {
  const hours = Number(hoursRaw);
  if (!ALLOWED_HOURS.has(hours)) {
    const e = new Error('INVALID_DURATION');
    e.code = 'INVALID_DURATION';
    throw e;
  }

  await stopTunnel();
  state.lastError = null;

  return new Promise((resolve, reject) => {
    let settled = false;
    const attempted = [];

    const fail = (err) => {
      if (settled) return;
      settled = true;
      state.lastError = err && err.message ? String(err.message) : 'TUNNEL_START_FAILED';
      // eslint-disable-next-line no-console
      console.error('[adminTunnel] baslatma basarisiz. Denenen adaylar:', attempted.join(' | ') || '-');
      stopTunnel().catch(() => {});
      reject(err);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(readStatus());
    };

    const tryStartWith = (idx) => {
      const cmd = CLOUDFLARED_CANDIDATES[idx];
      if (!cmd) {
        const e = new Error('CLOUDFLARED_NOT_FOUND');
        e.code = 'CLOUDFLARED_NOT_FOUND';
        fail(e);
        return;
      }
      attempted.push(cmd);

      const proc = spawn(cmd, ['tunnel', '--url', `http://localhost:${LOCAL_PORT}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      state.proc = proc;

      const onData = (chunk) => {
        const text = String(chunk || '');
        if (text.includes('Cannot determine default origin certificate path')) {
          // quick tunnel için fatal degil; sadece log olarak gec.
        }
        const url = parseTryCloudflareUrl(chunk);
        if (url && !state.publicUrl) {
          state.publicUrl = url;
          state.startedAt = Date.now();
          state.expiresAt = Date.now() + hours * 60 * 60 * 1000;
          scheduleAutoStop();
          succeed();
        }
      };

      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);
      proc.on('error', (err) => {
        if (err && err.code === 'ENOENT') {
          tryStartWith(idx + 1);
          return;
        }
        fail(err);
      });
      proc.on('exit', () => {
        if (!settled && !state.publicUrl) {
          const e = new Error('TUNNEL_START_FAILED');
          e.code = 'TUNNEL_START_FAILED';
          fail(e);
        } else if (!settled) {
          succeed();
        }
      });
    };

    tryStartWith(0);
  });
}

module.exports = {
  readStatus,
  startTunnel,
  stopTunnel,
};
