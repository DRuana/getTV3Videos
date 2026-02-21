/**
 * GET /api/video-url?id=3233330
 * Returns all available video URLs sorted by quality (highest first)
 */

const URL_REPLACEMENTS = [
  {
    from: 'mp4-high-es.ccma.cat.s3.eu-west-1.amazonaws.com/MP4_ALTA_IPTV_ES',
    to: 'mp4-down-high-es.3catvideos.cat',
  },
  {
    from: 'mp4-high-int.ccma.cat.s3.eu-west-1.amazonaws.com/MP4_ALTA_IPTV_MON',
    to: 'mp4-down-high-int.3catvideos.cat',
  },
  {
    from: 'mp4-medium-es.ccma.cat.s3.eu-west-1.amazonaws.com/MP4_MITJA_WEB_ES',
    to: 'mp4-down-medium-es.3catvideos.cat',
  },
  {
    from: 'mp4-medium-int.ccma.cat.s3.eu-west-1.amazonaws.com/MP4_MITJA_WEB_MON',
    to: 'mp4-down-medium-int.3catvideos.cat',
  },
];

function replaceUrl(url) {
  return URL_REPLACEMENTS.reduce((acc, { from, to }) => acc.replace(from, to), url);
}

function qualityToNumber(label) {
  const match = String(label).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Falta el paràmetre id' });
  }

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' };
    const r = await fetch(
      `https://dinamics.ccma.cat/pvideo/media.jsp?media=video&version=0s&idint=${id}`,
      { headers }
    );

    if (!r.ok) {
      return res.status(404).json({ error: 'Vídeo no trobat' });
    }

    const data = await r.json();

    if (!data?.informacio?.estat?.actiu) {
      return res.json({ videos: [], best: null, available: false });
    }

    const media = data.media;
    const rawUrls = Array.isArray(media.url) ? media.url : [media.url];

    const videos = rawUrls
      .filter(u => u && u.file)
      .map(u => ({
        quality: u.label || '?',
        url: replaceUrl(u.file),
        format: media.format || 'MP4',
        active: u.active !== false,
      }))
      .filter(v => v.active)
      .sort((a, b) => qualityToNumber(b.quality) - qualityToNumber(a.quality));

    return res.json({
      videos,
      best: videos[0] || null,
      available: videos.length > 0,
      title: data.informacio?.titol || '',
      titol_complet: data.informacio?.titol_complet || '',
    });
  } catch (err) {
    console.error('video-url error:', err);
    return res.status(500).json({ error: 'Error obtenint la URL del vídeo' });
  }
}
