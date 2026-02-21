import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Download, Check, AlertCircle, Loader2, Tv2, Search, ChevronRight, Github } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[/\\?*:<>"|]/g, '').trim();
}

function buildFilename(seriesTitle, seasonNum, episodeNum, episodeTitle) {
  const clean = episodeTitle.replace(/^T\d+xC\d+\s*[-–]\s*/u, '').trim();
  const safe = sanitizeFilename(
    `${seriesTitle} - S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')} - ${clean}`
  );
  return safe + '.mp4';
}

function formatDuration(str) {
  if (!str) return '';
  const parts = str.split(':').map(Number);
  if (parts.length >= 3) {
    const h = parts[parts.length - 3];
    const m = parts[parts.length - 2];
    const s = parts[parts.length - 1];
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
  return str;
}

function getBestImage(imatges, preferredSize) {
  if (!imatges || !imatges.length) return null;
  const sized = imatges.find(i => i.mida === preferredSize);
  if (sized) return sized.text;
  return imatges[imatges.length - 1]?.text || null;
}

// ─── Episode Card ──────────────────────────────────────────────────────────────

function EpisodeCard({ episode, episodeNum, seasonNum, seriesTitle, onDownload, status }) {
  const rawTitle = episode.titol || `Episodi ${episodeNum}`;
  const cleanTitle = rawTitle.replace(/^T\d+xC\d+\s*[-–]\s*/u, '').trim();
  const thumbnail = getBestImage(episode.imatges, '320x240') || getBestImage(episode.imatges, '200x155');
  const duration = formatDuration(episode.durada);

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
  const btnState = isLoading
    ? 'bg-neutral-300 cursor-wait'
    : isDone
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
          {cleanTitle}
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
          {quality && (
            <span className="text-[0.65rem] font-semibold bg-neutral-800 text-white px-1.5 py-0.5 rounded tracking-wide">
              {quality}
            </span>
          )}
        </div>
      </div>

      {/* Download button */}
      <button
        className={`${btnBase} ${btnState}`}
        onClick={() => onDownload(episode, episodeNum)}
        disabled={isLoading}
        title={isDone ? 'Descarregat' : isError ? 'Error – torna a intentar-ho' : 'Descarregar episodi'}
      >
        {isLoading ? (
          <Loader2 size={15} className="text-white animate-spin" />
        ) : isDone ? (
          <Check size={15} className="text-white" strokeWidth={2.5} />
        ) : isError ? (
          <AlertCircle size={15} className="text-white" strokeWidth={2.5} />
        ) : (
          <Download size={15} className="text-neutral-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}

// ─── Season Panel ──────────────────────────────────────────────────────────────

function SeasonPanel({ season, seriesTitle, programId, downloadStatus, onDownloadEpisode }) {
  const [episodes, setEpisodes]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [queueRunning, setQueueRunning] = useState(false);
  const abortRef = useRef(false);

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

  const handleDownloadAll = async () => {
    if (!episodes || queueRunning) return;
    setQueueRunning(true);
    for (let i = 0; i < episodes.length; i++) {
      if (abortRef.current) break;
      await onDownloadEpisode(episodes[i], i + 1, season.num, seriesTitle);
      await new Promise(r => setTimeout(r, 1800));
    }
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
            onClick={handleDownloadAll}
            disabled={queueRunning}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              transition-all duration-150 border-2
              ${queueRunning
                ? 'bg-neutral-500 border-neutral-500 text-white cursor-wait'
                : 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-700 hover:border-neutral-700'}
              disabled:opacity-60
            `}
          >
            {queueRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Descarregant… ({totalDone}/{episodes.length})
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
              status={downloadStatus[ep.id]}
              onDownload={(ep, epNum) => onDownloadEpisode(ep, epNum, season.num, seriesTitle)}
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
  const [downloadStatus, setDownloadStatus] = useState({});

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

  const handleDownloadEpisode = useCallback(async (episode, episodeNum, seasonNum, seriesTitle) => {
    const id = episode.id;
    setDownloadStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const res  = await fetch(`/api/video-url?id=${id}`);
      const data = await res.json();
      if (!res.ok || !data.best) throw new Error(data.error || 'Vídeo no disponible');

      const filename = buildFilename(seriesTitle, seasonNum, episodeNum, episode.titol || `Episodi ${episodeNum}`);

      try {
        const videoRes = await fetch(data.best.url, { mode: 'cors' });
        if (!videoRes.ok) throw new Error(`CDN ${videoRes.status}`);
        const blob    = await videoRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link    = document.createElement('a');
        link.href     = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch {
        const link  = document.createElement('a');
        link.href   = data.best.url;
        link.target = '_blank';
        link.rel    = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => {
        setDownloadStatus(prev => ({ ...prev, [id]: 'done' }));
      }, 2000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  }, []);

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
              <Github size={20} />
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
                  downloadStatus={downloadStatus}
                  onDownloadEpisode={handleDownloadEpisode}
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
