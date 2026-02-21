/**
 * GET /api/episodes?programId=201088598&season=1
 * Returns all episodes for a season, sorted by episode number
 */
export default async function handler(req, res) {
  const { programId, season } = req.query;

  if (!programId || !season) {
    return res.status(400).json({ error: 'Falten paràmetres: programId i season' });
  }

  const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' };
  const episodes = [];
  let page = 1;

  try {
    while (true) {
      const url = [
        `https://api.ccma.cat/videos?_format=json`,
        `ordre=capitol`,
        `origen=llistat`,
        `perfil=pc`,
        `programatv_id=${programId}`,
        `tipus_contingut=PPD`,
        `items_pagina=50`,
        `pagina=${page}`,
        `version=2.0`,
        `temporada=PUTEMP_${season}`,
        `https=true`,
      ].join('&').replace('json&', 'json&');

      const r = await fetch(url, { headers });
      if (!r.ok) break;

      const data = await r.json();
      const items = data?.resposta?.items;

      if (!items || parseInt(items.num) === 0) break;

      const batch = Array.isArray(items.item) ? items.item : [items.item];
      episodes.push(...batch);

      const pagination = data?.resposta?.paginacio;
      if (!pagination || page >= parseInt(pagination.total_pagines)) break;
      page++;
    }

    // Sort by capitol (episode number)
    episodes.sort((a, b) => (parseInt(a.capitol) || 0) - (parseInt(b.capitol) || 0));

    return res.json({ episodes, total: episodes.length });
  } catch (err) {
    console.error('episodes error:', err);
    return res.status(500).json({ error: 'Error obtenint els episodis' });
  }
}
