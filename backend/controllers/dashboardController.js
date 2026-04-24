const { getKpis, getRecentMovements } = require('../services/dashboardService');
const { jsonOk } = require('../utils/apiResponse');

async function getSummary(req, res) {
  const kpis = await getKpis();
  return res.json(jsonOk({ ...kpis }));
}

async function getActivity(req, res) {
  const raw = parseInt(String(req.query?.limit ?? ''), 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 10) : 10;
  const movements = await getRecentMovements(limit);
  return res.json(jsonOk({ movements }));
}

module.exports = { getSummary, getActivity };
