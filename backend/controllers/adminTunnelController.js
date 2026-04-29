const { jsonOk, jsonError } = require('../utils/apiResponse');
const { readStatus, startTunnel, stopTunnel } = require('../services/adminTunnelService');

async function getTunnelStatus(_req, res) {
  return res.json(jsonOk({ tunnel: readStatus() }));
}

async function postTunnelStart(req, res) {
  const hours = Number(req.body?.hours);
  try {
    const tunnel = await startTunnel(hours);
    return res.json(jsonOk({ tunnel }));
  } catch (e) {
    if (e?.code === 'INVALID_DURATION') {
      return res.status(400).json(jsonError('VALIDATION', 'Gecersiz sure', null, 'api.admin.tunnel_invalid_duration'));
    }
    if (e?.code === 'CLOUDFLARED_NOT_FOUND') {
      return res.status(400).json(
        jsonError(
          'VALIDATION',
          'Cloudflare Tunnel aracı bulunamadı. Lütfen cloudflared kurulumunu kontrol edin.',
          null,
          'api.admin.tunnel_tool_missing'
        )
      );
    }
    return res.status(500).json(jsonError('UNKNOWN', 'Tunnel baslatilamadi', null, 'api.admin.tunnel_start_failed'));
  }
}

async function postTunnelStop(_req, res) {
  const tunnel = await stopTunnel();
  return res.json(jsonOk({ tunnel }));
}

module.exports = {
  getTunnelStatus,
  postTunnelStart,
  postTunnelStop,
};
