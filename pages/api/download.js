/**
 * GET /api/download?url=https://...&filename=Episode.mp4
 * Streaming proxy that adds correct Content-Disposition for downloads.
 * Follows redirects server-side so headers are never set prematurely.
 */
import https from 'https';
import http from 'http';

const ALLOWED_DOMAINS = ['3catvideos.cat', 'ccma.cat', 'amazonaws.com'];
const MAX_REDIRECTS = 5;

function isDomainAllowed(url) {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Massa redireccions'));
    }
    if (!isDomainAllowed(url)) {
      return reject(new Error('Domini no permès: ' + url));
    }

    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.3cat.cat/',
        'Accept': '*/*',
        'Accept-Language': 'ca,es;q=0.9',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const location = res.headers['location'];
        res.resume(); // discard body
        if (!location) return reject(new Error('Redirecció sense Location'));
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
        return fetchUrl(nextUrl, redirectCount + 1).then(resolve).catch(reject);
      }
      resolve(res);
    });

    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const { url, filename } = req.query;

  if (!url || !filename) {
    return res.status(400).send('Falten paràmetres: url i filename');
  }

  if (!isDomainAllowed(url)) {
    return res.status(403).send('Domini no permès');
  }

  try {
    const proxyRes = await fetchUrl(url);

    if (proxyRes.statusCode !== 200) {
      return res.status(proxyRes.statusCode).send(`Error del servidor de vídeo: ${proxyRes.statusCode}`);
    }

    const safeFilename = filename.trim();

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');

    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }

    res.status(200);

    proxyRes.pipe(res);

    proxyRes.on('error', (err) => {
      console.error('Proxy stream error:', err);
      if (!res.writableEnded) res.end();
    });

    req.on('close', () => {
      proxyRes.destroy();
    });
  } catch (err) {
    console.error('Download proxy error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Error en la descàrrega: ' + err.message);
    }
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
};
