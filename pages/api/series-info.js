/**
 * GET /api/series-info?url=https://www.3cat.cat/3cat/teo/
 * Returns program ID, title, slug and available seasons
 */
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el paràmetre url' });
  }

  // Extract slug: https://www.3cat.cat/3cat/{slug}[/...]
  const slugMatch = url.match(/3cat\.cat\/3cat\/([^/?#]+)/);
  if (!slugMatch) {
    return res.status(400).json({ error: 'URL no vàlida. Exemple: https://www.3cat.cat/3cat/teo/' });
  }
  const slug = slugMatch[1];

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    };

    // Fetch the series page to extract program ID from __NEXT_DATA__
    const pageUrl = `https://www.3cat.cat/3cat/${slug}/capitols/temporada/1/`;
    const pageRes = await fetch(pageUrl, { headers });

    if (!pageRes.ok) {
      return res.status(404).json({ error: `Sèrie "${slug}" no trobada` });
    }

    const html = await pageRes.text();

    // Extract __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      return res.status(500).json({ error: 'No s\'ha pogut extreure les dades de la sèrie' });
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const fullText = JSON.stringify(nextData);

    // Extract program ID from API URLs inside the structure (IDs can be 5-12 digits)
    const programIdMatch = fullText.match(/programatv[_=%5F]{1,6}id[=%5F]{0,3}?(\d{5,12})/i);
    if (!programIdMatch) {
      return res.status(500).json({ error: 'No s\'ha pogut obtenir l\'ID del programa' });
    }
    const programId = programIdMatch[1];

    // Extract series title
    const structure = nextData?.props?.pageProps?.layout?.structure || [];
    const title = structure[0]?.finalProps?.titol || slug;
    const description = structure[0]?.finalProps?.descripcio || '';
    const images = structure[0]?.finalProps?.imatges || [];
    const thumbnail = images.find(i => i.rel_name === 'IMATGE_169' || i.rel_name === 'imatge_169')?.text
      || images.find(i => i.mida === 'MASTER')?.text
      || images[0]?.text
      || null;

    // Check available seasons in parallel (up to 15)
    const apiHeaders = { 'User-Agent': 'Mozilla/5.0' };
    const seasonChecks = Array.from({ length: 15 }, (_, i) => i + 1).map(async (s) => {
      const apiUrl = `https://api.ccma.cat/videos?_format=json&programatv_id=${programId}&tipus_contingut=PPD&items_pagina=1&pagina=1&version=2.0&temporada=PUTEMP_${s}&https=true`;
      try {
        const r = await fetch(apiUrl, { headers: apiHeaders });
        const data = await r.json();
        const total = data?.resposta?.paginacio?.total_items || 0;
        return total > 0 ? { num: s, total, id: `PUTEMP_${s}`, name: `${s}a Temporada` } : null;
      } catch {
        return null;
      }
    });

    const seasonResults = await Promise.all(seasonChecks);
    const seasons = seasonResults.filter(Boolean);

    if (seasons.length === 0) {
      return res.status(404).json({ error: 'No s\'han trobat temporades per a aquesta sèrie' });
    }

    return res.json({ programId, title, description, slug, thumbnail, seasons });
  } catch (err) {
    console.error('series-info error:', err);
    return res.status(500).json({ error: 'Error intern del servidor' });
  }
}
