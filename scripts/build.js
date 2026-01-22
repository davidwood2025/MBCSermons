const fs = require("fs");

const API_KEY = process.env.YT_API_KEY;
const CHANNEL_ID = "UCLh7D6zXWhTrE_ELl0k55bQ";

if (!API_KEY) throw new Error("YT_API_KEY is missing");

const DESIRED_COUNT = 24; // 16 + 8 more
const SEARCH_MAX = 50;    // YouTube API maxResults limit for search

// 1) Search latest uploads (videos only)
function searchUrl() {
  return (
    `https://youtube.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${CHANNEL_ID}` +
    `&maxResults=${SEARCH_MAX}&order=date&type=video&key=${API_KEY}`
  );
}

// 2) Get durations for Shorts filtering
function videosUrl(ids) {
  const idParam = encodeURIComponent(ids.join(","));
  return (
    `https://youtube.googleapis.com/youtube/v3/videos` +
    `?part=contentDetails&id=${idParam}&key=${API_KEY}`
  );
}

async function build() {
  const searchRes = await fetch(searchUrl());
  if (!searchRes.ok) throw new Error(`YouTube search API failed: ${searchRes.status}`);

  const searchData = await searchRes.json();

  const candidates = (searchData.items || [])
    .filter(v => v.id && v.id.videoId)
    .map(v => ({
      videoId: v.id.videoId,
      title: v.snippet?.title || "Video",
      // prefer high to reduce “odd sizing” effects
      thumb:
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        v.snippet?.thumbnails?.default?.url ||
        "",
    }));

  if (candidates.length === 0) {
    writeHtml(renderPage([]));
    return;
  }

  // Fetch durations (seconds) for all candidate IDs
  const ids = candidates.map(v => v.videoId);
  const vidsRes = await fetch(videosUrl(ids));
  if (!vidsRes.ok) throw new Error(`YouTube videos API failed: ${vidsRes.status}`);

  const vidsData = await vidsRes.json();

  const secondsById = new Map();
  for (const item of vidsData.items || []) {
    secondsById.set(item.id, isoDurationToSeconds(item.contentDetails?.duration || ""));
  }

  // Strict filter: remove Shorts (<= 60s) and anything hashtagged #shorts
  // Also: if we *can't* determine duration, drop it (prevents Shorts slipping back in)
  const filtered = candidates.filter(v => {
    if (/#shorts/i.test(v.title)) return false;

    const secs = secondsById.get(v.videoId);
    if (typeof secs !== "number" || Number.isNaN(secs)) return false; // strict
    if (secs <= 60) return false;

    return true;
  });

  // Take the newest 24 after filtering
  writeHtml(renderPage(filtered.slice(0, DESIRED_COUNT)));
}

function renderPage(videos) {
  const items = videos
    .map(v => `
      <button class="gallery-item" type="button"
        data-video-id="${v.videoId}"
        data-title="${escapeHtml(v.title)}">
        <div class="thumb">
          <img src="${v.thumb}" alt="${escapeHtml(v.title)}" loading="lazy">
        </div>
        <p>${escapeHtml(v.title)}</p>
      </button>
    `)
    .join("");

  const emptyState = `
    <div class="empty">
      <p>No videos found.</p>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sermon Recordings</title>
<style>
  body { margin:0; font-family:Arial, sans-serif; background:#f4f4f4; }

  .gallery {
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
    gap:20px;
    padding:20px;
  }

  .gallery-item {
    background:#59798E;
    border-radius:8px;
    overflow:hidden;
    box-shadow: 0 4px 8px rgba(0,0,0,0.10);
    transition: transform 0.2s ease, background-color 0.2s ease;
    padding:0;
    border:0;
    cursor:pointer;
    text-align:left;
  }

  .gallery-item:hover { transform: translateY(-3px); background:#ccc; }

  /* Consistent thumbnail area (fixes “random top gaps”) */
  .thumb {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 */
    background: #2d3b44;
  }
  .thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover; /* fills the box; crops if needed */
    display: block;
  }

  .gallery-item p { margin:0; padding:10px; color:white; }
  .gallery-item:hover p { color:#333; }

  .empty { padding: 24px; text-align:center; color:#333; }

  /* Modal */
  .modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.70);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    z-index: 9999;
  }
  .modal.open { display: flex; }

  .modal-card {
    width: min(980px, 100%);
    background: #111;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  }

  .modal-header {
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: #59798E;
    color: #fff;
  }

  .modal-title {
    font-size: 14px;
    line-height: 1.3;
    margin: 0;
    padding: 0;
    flex: 1;
  }

  .btn {
    appearance: none;
    border: 0;
    border-radius: 10px;
    padding: 8px 12px;
    background: #fff;
    color: #59798E;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
  }
  .btn:hover { background: #f1f1f1; }

  .player-wrap {
    position: relative;
    width: 100%;
    padding-top: 56.25%;
    background: #000;
  }

  .player-wrap iframe {
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    border:0;
  }
</style>
</head>
<body>

  <div class="gallery">
    ${videos.length ? items : emptyState}
  </div>

  <div class="modal" id="modal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="Video player">
      <div class="modal-header">
        <p class="modal-title" id="modalTitle">Playing…</p>
        <button class="btn" id="closeBtn" type="button">Close</button>
      </div>
      <div class="player-wrap">
        <iframe
          id="player"
          src=""
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>

<script>
  const modal = document.getElementById("modal");
  const player = document.getElementById("player");
  const modalTitle = document.getElementById("modalTitle");
  const closeBtn = document.getElementById("closeBtn");

  function openVideo(videoId, title) {
    const embed =
      "https://www.youtube-nocookie.com/embed/" + videoId +
      "?autoplay=1&mute=1&rel=0&playsinline=1&vq=hd1080";

    player.src = embed;
    modalTitle.textContent = title || "Playing…";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    player.src = "";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-item[data-video-id]");
    if (!btn) return;
    openVideo(btn.getAttribute("data-video-id"), btn.getAttribute("data-title") || "Video");
  });

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
</script>

</body>
</html>`;
}

function writeHtml(html) {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/index.html", html);
}

function isoDurationToSeconds(iso) {
  if (!iso || typeof iso !== "string") return NaN;
  const match = iso.match(/^PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$/);
  if (!match) return NaN;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  const secs = parseInt(match[3] || "0", 10);
  return hours * 3600 + mins * 60 + secs;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

build();
