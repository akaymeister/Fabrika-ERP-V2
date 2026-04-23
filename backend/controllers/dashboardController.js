const { getKpis, getRecentMovements } = require('../services/dashboardService');
const { jsonOk } = require('../utils/apiResponse');

async function getSummary(req, res) {
  const kpis = await getKpis();
  return res.json(jsonOk({ ...kpis }));
}

async function getActivity(req, res) {
  const limit = req.query?.limit;
  const movements = await getRecentMovements(limit);
  return res.json(jsonOk({ movements }));
}

module.exports = { getSummary, getActivity };
