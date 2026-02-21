import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Download, Check, AlertCircle, Loader2, Tv2, Search, ChevronRight, X } from 'lucide-react';

function GitHubIcon({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 98 96" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[/\\?*:<>"|]/g, '').trim();
}

/**
 * Formats disponibles per al nom del fitxer:
 *  'sxxexx'      → SeriesTitle - S01E01 - Títol episodi  (per defecte)
 *  'txcx'        → SeriesTitle - T1xC54 - Títol episodi
 *  'titol_complet' → SeriesTitle - [valor brut de titol_complet]
 */
function buildFilename(seriesTitle, seasonNum, episodeNum, episode, titleFormat = 'sxxexx') {
  const rawTitle = typeof episode === 'string' ? episode : (episode.titol || `Episodi ${episodeNum}`);
  const clean = rawTitle.replace(/^T\d+xC\d+\s*[-–]\s*/u, '').trim();

  if (titleFormat === 'titol_complet') {
    const full = (typeof episode === 'object' && episode.titol_complet)
      ? episode.titol_complet
      : `${seriesTitle} - ${rawTitle}`;
    return sanitizeFilename(full) + '.mp4';
  }

  let episodePart;
  if (titleFormat === 'txcx') {
    const cap = (typeof episode === 'object' && episode.capitol) ? episode.capitol : episodeNum;
    episodePart = `T${seasonNum}xC${cap}`;
  } else {
    episodePart = `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
  }

  return sanitizeFilename(`${seriesTitle} - ${episodePart} - ${clean}`) + '.mp4';
}

function formatDuration(str) {
  if (!str) return '';
  const parts = str.split(':').map(Number);

  let totalSeconds = 0;
  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    // MM:SS
    totalSeconds = parts[0] * 60 + parts[1];
  } else {
    // 3 parts: pot ser HH:MM:SS o MM:SS:frames
    // Si el primer valor és > 23 no pot ser hores → tractem com MM:SS:frames
    if (parts[0] > 23) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 0) return '';
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${Math.round(bytesPerSec / 1024)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

function getBestImage(imatges, preferredSize) {
  if (!imatges || !imatges.length) return null;
  const sized = imatges.find(i => i.mida === preferredSize);
  if (sized) return sized.text;
  return imatges[imatges.length - 1]?.text || null;
}

// ─── Episode Card ──────────────────────────────────────────────────────────────

function EpisodeCard({ episode, episodeNum, seasonNum, seriesTitle, titleFormat, onDownload, onAbort, status, progress, speed, totalBytes }) {
  const rawTitle = episode.titol || `Episodi ${episodeNum}`;
  const cleanTitle = rawTitle.replace(/^T\d+xC\d+\s*[-–]\s*/u, '').trim();
  const thumbnail = getBestImage(episode.imatges, '320x240') || getBestImage(episode.imatges, '200x155');
  const duration = formatDuration(episode.durada);

  // Label visible a la card segons el format seleccionat
  let episodeLabel = null;
  let displayTitle = cleanTitle;
  if (titleFormat === 'titol_complet') {
    displayTitle = episode.titol_complet || cleanTitle;
  } else if (titleFormat === 'txcx') {
    const cap = episode.capitol || episodeNum;
    episodeLabel = `T${seasonNum}xC${cap}`;
  } else {
    episodeLabel = `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
  }

  const [quality, setQuality] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const delay = (episodeNum - 1) * 80;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/video-url?id=${episode.id}`);
        const d = await r.json();
        if (!cancelled && d.best?.quality) setQuality(d.best.quality);
      } catch { /* silent */ }
    }, delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, [episode.id, episodeNum]);

  const description = episode.entradeta || episode.descripcio || '';

  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const isError   = status === 'error';

  const cardBase  = 'group flex items-start gap-3 p-3 rounded-xl border bg-white transition-all duration-150';
  const cardState = isDone
    ? 'border-emerald-200 bg-emerald-50/60'
    : isError
    ? 'border-red-200 bg-red-50/60'
    : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm';

  const btnBase  = 'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 mt-0.5';
  const btnState = isDone
    ? 'bg-emerald-500'
    : isError
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-neutral-200 hover:bg-neutral-900 group-hover:bg-neutral-900';

  return (
    <div className={`${cardBase} ${cardState}`}>
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-24 h-[68px] sm:w-[100px] sm:h-[75px] rounded-lg overflow-hidden bg-neutral-900">
        {thumbnail
          ? <img src={thumbnail} alt={cleanTitle} loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-neutral-800" />
        }
        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded">
          E{String(episodeNum).padStart(2, '0')}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 leading-snug">
          {episodeLabel && (
            <span className="inline-block mr-1.5 mb-0.5 text-[0.6rem] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded align-middle tracking-wide">
              {episodeLabel}
            </span>
          )}
          {displayTitle}
        </p>
        {description && (
          <p className="text-xs text-neutral-500 leading-relaxed mt-1 line-clamp-3">
            {description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          {duration && (
            <span className="text-xs text-neutral-400">{duration}</span>
          )}
          {totalBytes && (
            <span className="text-xs text-neutral-400">{formatFileSize(totalBytes)}</span>
          )}
          {quality && (
            <span className="text-[0.65rem] font-semibold bg-neutral-800 text-white px-1.5 py-0.5 rounded tracking-wide">
              {quality}
            </span>
          )}
          {isLoading && progress !== undefined && (
            <span className="text-[0.65rem] font-semibold text-neutral-500 tabular-nums">
              {progress}%{speed ? ` · ${formatSpeed(speed)}` : ''}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {isLoading && progress !== undefined && (
          <div className="mt-2 h-1 w-full bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-800 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Download / cancel button */}
      {isLoading ? (
        <button
          onClick={onAbort}
          title="Cancel·lar descàrrega"
          className="relative flex-shrink-0 w-10 h-10 mt-0.5 cursor-pointer"
        >
          {/* Spinning ring */}
          <span className="absolute inset-0 rounded-full border-2 border-neutral-200 border-t-neutral-500 animate-spin" />
          {/* X always visible, red on hover */}
          <span className="absolute inset-0 flex items-center justify-center">
            <X size={14} className="text-red-500" strokeWidth={2.5} />
          </span>
        </button>
      ) : (
        <button
          className={`${btnBase} ${btnState}`}
          onClick={() => onDownload(episode, episodeNum)}
          title={isDone ? 'Descarregat' : isError ? 'Error – torna a intentar-ho' : 'Descarregar episodi'}
        >
          {isDone ? (
            <Check size={15} className="text-white" strokeWidth={2.5} />
          ) : isError ? (
            <AlertCircle size={15} className="text-white" strokeWidth={2.5} />
          ) : (
            <Download size={15} className="text-neutral-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
          )}
        </button>
      )}
    </div>
  );
}

// ─── Season Panel ──────────────────────────────────────────────────────────────

function SeasonPanel({ season, seriesTitle, programId, titleFormat, downloadStatus, downloadProgress, downloadSpeed, downloadTotalBytes, onDownloadEpisode, onAbortDownload }) {
  const [episodes, setEpisodes]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [queueRunning, setQueueRunning] = useState(false);
  const abortRef      = useRef(false); // cancel episode-list fetch on unmount
  const queueStopRef  = useRef(false); // cancel the download queue
  const currentEpRef  = useRef(null);  // id of the episode currently downloading

  useEffect(() => {
    abortRef.current = false;
    setEpisodes(null);
    setLoading(true);
    setError('');

    fetch(`/api/episodes?programId=${programId}&season=${season.num}`)
      .then(r => r.json())
      .then(data => {
        if (!abortRef.current) setEpisodes(data.episodes || []);
      })
      .catch(() => {
        if (!abortRef.current) setError('Error carregant els episodis');
      })
      .finally(() => {
        if (!abortRef.current) setLoading(false);
      });

    return () => { abortRef.current = true; };
  }, [season.num, programId]);

  const handleStopQueue = () => {
    queueStopRef.current = true;
    if (currentEpRef.current) onAbortDownload(currentEpRef.current);
    setQueueRunning(false);
  };

  const handleDownloadAll = async () => {
    if (!episodes || queueRunning) return;
    queueStopRef.current = false;
    setQueueRunning(true);
    for (let i = 0; i < episodes.length; i++) {
      if (abortRef.current || queueStopRef.current) break;
      currentEpRef.current = episodes[i].id;
      await onDownloadEpisode(episodes[i], i + 1, season.num, seriesTitle);
      currentEpRef.current = null;
      if (abortRef.current || queueStopRef.current) break;
      await new Promise(r => setTimeout(r, 1800));
    }
    currentEpRef.current = null;
    setQueueRunning(false);
  };

  const totalDone = episodes
    ? episodes.filter(ep => downloadStatus[ep.id] === 'done').length
    : 0;

  return (
    <div className="mt-2">
      {/* Season header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-neutral-100">
        <div className="text-sm text-neutral-500">
          {loading && <span className="text-neutral-400">Carregant episodis…</span>}
          {!loading && episodes && (
            <span>
              <span className="font-semibold text-neutral-700">{episodes.length}</span> episodis
              {totalDone > 0 && (
                <span className="ml-2 text-emerald-600 font-medium">
                  · {totalDone} descarregat{totalDone > 1 ? 's' : ''}
                </span>
              )}
            </span>
          )}
          {error && <span className="text-red-500">{error}</span>}
        </div>

        {episodes && episodes.length > 0 && (
          <button
            onClick={queueRunning ? handleStopQueue : handleDownloadAll}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              transition-all duration-150 border-2
              ${queueRunning
                ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700'
                : 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-700 hover:border-neutral-700'}
            `}
          >
            {queueRunning ? (
              <>
                <X size={14} strokeWidth={2.5} />
                Aturar ({totalDone}/{episodes.length})
              </>
            ) : (
              <>
                <Download size={14} />
                Descarregar temporada {season.num}
              </>
            )}
          </button>
        )}
      </div>

      {/* Skeleton loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[95px] rounded-xl skeleton-shimmer" />
          ))}
        </div>
      )}

      {/* Episodes grid */}
      {episodes && (
        <div className="grid grid-cols-1 gap-2">
          {episodes.map((ep, idx) => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              episodeNum={idx + 1}
              seasonNum={season.num}
              seriesTitle={seriesTitle}
              titleFormat={titleFormat}
              status={downloadStatus[ep.id]}
              progress={downloadProgress[ep.id]}
              speed={downloadSpeed[ep.id]}
              totalBytes={downloadTotalBytes[ep.id]}
              onDownload={(ep, epNum) => onDownloadEpisode(ep, epNum, season.num, seriesTitle)}
              onAbort={() => onAbortDownload(ep.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [inputUrl, setInputUrl]             = useState('');
  const [searching, setSearching]           = useState(false);
  const [searchError, setSearchError]       = useState('');
  const [seriesInfo, setSeriesInfo]         = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [titleFormat, setTitleFormat]       = useState('txcx');
  const [downloadStatus, setDownloadStatus] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadSpeed, setDownloadSpeed] = useState({});
  const [downloadTotalBytes, setDownloadTotalBytes] = useState({});
  const abortControllersRef = useRef({});

  // Core search logic — accepts an explicit URL and optional season override
  const doSearch = useCallback(async (targetUrl, initialSeason = null) => {
    const url = targetUrl.trim();
    if (!url) return;
    setSearching(true);
    setSearchError('');
    setSeriesInfo(null);
    setSelectedSeason(null);
    setDownloadStatus({});
    try {
      const res  = await fetch(`/api/series-info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconegut');
      setSeriesInfo(data);
      const season = initialSeason && data.seasons.find(s => s.num === initialSeason)
        ? initialSeason
        : data.seasons[0]?.num || 1;
      setSelectedSeason(season);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, []);

  // Triggered by the search button / Enter key
  const handleSearch = useCallback(() => {
    const url = inputUrl.trim();
    if (!url) return;
    router.replace({ query: { url } }, undefined, { shallow: true });
    doSearch(url);
  }, [inputUrl, router, doSearch]);

  // Restore state from URL on load (router.isReady ensures query params are available)
  useEffect(() => {
    if (!router.isReady) return;
    const { url: qUrl, t: qSeason } = router.query;
    if (qUrl && typeof qUrl === 'string') {
      setInputUrl(qUrl);
      doSearch(qUrl, qSeason ? parseInt(qSeason, 10) : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const handleAbortDownload = useCallback((id) => {
    abortControllersRef.current[id]?.abort();
  }, []);

  const handleDownloadEpisode = useCallback(async (episode, episodeNum, seasonNum, seriesTitle) => {
    const id = episode.id;

    // Si ja s'està descarregant, avortem
    if (abortControllersRef.current[id]) {
      abortControllersRef.current[id].abort();
      return;
    }

    const controller = new AbortController();
    abortControllersRef.current[id] = controller;
    const { signal } = controller;

    setDownloadStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const res  = await fetch(`/api/video-url?id=${id}`, { signal });
      const data = await res.json();
      if (!res.ok || !data.best) throw new Error(data.error || 'Vídeo no disponible');

      // Enriquim l'episodi amb titol_complet de l'API de detall (no present al llistat)
      const enrichedEpisode = data.titol_complet
        ? { ...episode, titol_complet: data.titol_complet }
        : episode;
      const filename = buildFilename(seriesTitle, seasonNum, episodeNum, enrichedEpisode, titleFormat);

      try {
        const videoRes = await fetch(data.best.url, { mode: 'cors', signal });
        if (!videoRes.ok) throw new Error(`CDN ${videoRes.status}`);

        // Stream en chunks per mostrar el progrés
        const contentLength = videoRes.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : null;
        const reader = videoRes.body.getReader();
        const chunks = [];
        let received = 0;

        setDownloadProgress(prev => ({ ...prev, [id]: 0 }));
        if (total) setDownloadTotalBytes(prev => ({ ...prev, [id]: total }));

        let lastSpeedTime = Date.now();
        let lastSpeedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            const pct = Math.min(Math.round((received / total) * 100), 99);
            setDownloadProgress(prev => ({ ...prev, [id]: pct }));
          }
          // Actualitzar velocitat cada 500ms
          const now = Date.now();
          const elapsed = (now - lastSpeedTime) / 1000;
          if (elapsed >= 0.5) {
            const bps = (received - lastSpeedBytes) / elapsed;
            setDownloadSpeed(prev => ({ ...prev, [id]: bps }));
            lastSpeedTime = now;
            lastSpeedBytes = received;
          }
        }

        const blob    = new Blob(chunks, { type: videoRes.headers.get('content-type') || 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);
        const link    = document.createElement('a');
        link.href     = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (innerErr) {
        if (innerErr.name === 'AbortError') throw innerErr;
        const link  = document.createElement('a');
        link.href   = data.best.url;
        link.target = '_blank';
        link.rel    = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setDownloadProgress(prev => ({ ...prev, [id]: 100 }));
      setDownloadSpeed(prev => { const next = { ...prev }; delete next[id]; return next; });
      setTimeout(() => {
        setDownloadStatus(prev => ({ ...prev, [id]: 'done' }));
        setDownloadProgress(prev => { const next = { ...prev }; delete next[id]; return next; });
      }, 1500);
    } catch (err) {
      const cleanExtra = prev => { const next = { ...prev }; delete next[id]; return next; };
      if (err.name === 'AbortError') {
        setDownloadStatus(cleanExtra);
        setDownloadProgress(cleanExtra);
        setDownloadSpeed(cleanExtra);
        setDownloadTotalBytes(cleanExtra);
      } else {
        console.error('Download error:', err);
        setDownloadStatus(prev => ({ ...prev, [id]: 'error' }));
        setDownloadProgress(cleanExtra);
        setDownloadSpeed(cleanExtra);
        setDownloadTotalBytes(cleanExtra);
      }
    } finally {
      delete abortControllersRef.current[id];
    }
  }, [titleFormat]);

  const currentSeason = seriesInfo?.seasons?.find(s => s.num === selectedSeason);

  return (
    <>
      <Head>
        <title>3Cat Downloader</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Descarrega episodis de sèries de 3Cat en màxima qualitat" />
      </Head>

      <div className="min-h-screen flex flex-col bg-neutral-50">

        {/* ── Header ── */}
        <header className="bg-neutral-900 text-white sticky top-0 z-50 shadow-lg">
          <div className="max-w-5xl mx-auto h-14 px-4 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-base font-bold tracking-tight">
                3Cat <span className="text-neutral-400 font-normal">Downloader</span>
              </span>
            </div>
            <a
              href="https://github.com/DRuana/3CatDownloader"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="text-neutral-500 hover:text-neutral-200 transition-colors"
            >
              <GitHubIcon size={20} />
            </a>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="max-w-5xl mx-auto w-full px-4 pt-8 pb-16 flex-1">

          {/* Search */}
          <div className="mb-8">
            <p className="text-sm font-medium text-neutral-500 mb-2 tracking-wide uppercase">
              Enganxa l'URL d'una sèrie de 3Cat
            </p>
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="https://www.3cat.cat/3cat/nom-de-la-serie/"
                  disabled={searching}
                  spellCheck={false}
                  className="
                    w-full h-11 pl-9 pr-4 rounded-xl border border-neutral-200 bg-white
                    text-sm text-neutral-900 placeholder-neutral-400
                    focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10
                    disabled:bg-neutral-100 disabled:cursor-not-allowed
                    transition-all duration-150
                  "
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !inputUrl.trim()}
                className="
                  h-11 px-6 rounded-xl bg-neutral-900 text-white text-sm font-semibold
                  flex items-center justify-center gap-2 whitespace-nowrap
                  hover:bg-neutral-700 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-150
                "
              >
                {searching ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Cercant…
                  </>
                ) : (
                  'Cercar sèrie'
                )}
              </button>
            </div>

            {/* Format del títol */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <label htmlFor="titleFormat" className="text-xs text-neutral-500 font-medium whitespace-nowrap">
                Format del títol:
              </label>
              <select
                id="titleFormat"
                value={titleFormat}
                onChange={e => setTitleFormat(e.target.value)}
                className="
                  text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5
                  bg-white text-neutral-700
                  focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10
                  transition-all duration-150 cursor-pointer
                "
              >
                <option value="sxxexx">S01E01 – Format clàssic</option>
                <option value="txcx">T1xC1 – Format 3Cat</option>
                <option value="titol_complet">Títol complet (titol_complet)</option>
              </select>
              <span className="text-xs text-neutral-400 hidden sm:inline">
                {titleFormat === 'sxxexx' && '· ex: Nom de la sèrie - S01E01 - Títol'}
                {titleFormat === 'txcx'   && '· ex: Nom de la sèrie - T1xC1 - Títol'}
                {titleFormat === 'titol_complet' && '· ex: Títol complet de l\'API'}
              </span>
            </div>

            {/* Error */}
            {searchError && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <AlertCircle size={15} className="flex-shrink-0" />
                {searchError}
              </div>
            )}
          </div>

          {/* Series info */}
          {seriesInfo && (
            <div>
              {/* Series card */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm mb-5 flex flex-col sm:flex-row">
                {seriesInfo.thumbnail && (
                  <div className="sm:w-44 h-44 sm:h-auto flex-shrink-0 bg-neutral-900">
                    <img
                      src={seriesInfo.thumbnail}
                      alt={seriesInfo.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-col justify-center">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight leading-tight mb-1">
                    {seriesInfo.title}
                  </h2>
                  {seriesInfo.description && (
                    <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2 mb-3">
                      {seriesInfo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
                    <span className="bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full">
                      {seriesInfo.seasons.length} temporada{seriesInfo.seasons.length !== 1 ? 'des' : ''}
                    </span>
                    <span className="bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full">
                      {seriesInfo.seasons.reduce((acc, s) => acc + s.total, 0)} episodis
                    </span>
                  </div>
                </div>
              </div>

              {/* Season tabs */}
              <div className="flex gap-1.5 flex-wrap mb-5">
                {seriesInfo.seasons.map(s => (
                  <button
                    key={s.num}
                    onClick={() => {
                      setSelectedSeason(s.num);
                      router.replace({ query: { url: inputUrl, t: s.num } }, undefined, { shallow: true });
                    }}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                      border transition-all duration-150
                      ${selectedSeason === s.num
                        ? 'bg-neutral-900 border-neutral-900 text-white'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'}
                    `}
                  >
                    T{s.num}
                    <span className={`
                      text-xs px-1.5 py-0.5 rounded-full font-semibold
                      ${selectedSeason === s.num
                        ? 'bg-white/20 text-neutral-200'
                        : 'bg-neutral-100 text-neutral-500'}
                    `}>
                      {s.total}
                    </span>
                  </button>
                ))}
              </div>

              {/* Episodes */}
              {currentSeason && (
                <SeasonPanel
                  key={currentSeason.num}
                  season={currentSeason}
                  seriesTitle={seriesInfo.title}
                  programId={seriesInfo.programId}
                  titleFormat={titleFormat}
                  downloadStatus={downloadStatus}
                  downloadProgress={downloadProgress}
                  downloadSpeed={downloadSpeed}
                  downloadTotalBytes={downloadTotalBytes}
                  onDownloadEpisode={handleDownloadEpisode}
                  onAbortDownload={handleAbortDownload}
                />
              )}
            </div>
          )}

          {/* Empty state */}
          {!seriesInfo && !searching && !searchError && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                <Tv2 size={28} className="text-neutral-300" />
              </div>
              <p className="text-neutral-400 text-sm max-w-xs leading-relaxed">
                Introduïu l'URL d'una sèrie de 3Cat per veure els episodis disponibles i descarregar-los
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-neutral-300">
                <ChevronRight size={13} />
                <span>p. ex. https://www.3cat.cat/3cat/nom-de-la-serie/</span>
              </div>
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-neutral-100 py-5 text-center text-xs text-neutral-400">
          Descarregador de vídeos de 3Cat ·{' '}
          <a href="https://github.com/DRuana/3CatDownloader" target="_blank" rel="noreferrer" className="hover:text-neutral-600 transition-colors">
            3CatDownloader
          </a>
          {' '}per{' '}
          <a href="https://github.com/DRuana" target="_blank" rel="noreferrer" className="hover:text-neutral-600 transition-colors">
            @DRuana
          </a>
        </footer>
      </div>
    </>
  );
}
