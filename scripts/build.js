const fs = require("fs");

const API_KEY = process.env.YT_API_KEY;
const CHANNEL_ID = "UCLh7D6zXWhTrE_ELl0k55bQ";

if (!API_KEY) throw new Error("YT_API_KEY is missing");

const API_URL =
  `https://youtube.googleapis.com/youtube/v3/search` +
  `?part=snippet&channelId=${CHANNEL_ID}` +
  `&maxResults=16&order=date&key=${API_KEY}`;

async function build() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`YouTube API failed: ${res.status}`);

  const data = await res.json();

  const items = data.items
    .filter(v => v.id && v.id.videoId)
    .map(v => {
      const videoId = v.id.videoId;
      const title = v.snippet?.title || "Video";
      const thumb = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.high?.url || "";
      return `
        <button class="gallery-item" type="button" data-video-id="${videoId}" data-title="${escapeHtml(title)}">
          <img src="${thumb}" alt="${escapeHtml(title)}">
          <p>${escapeHtml(title)}</p>
        </button>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
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
  .gallery-item img { width:100%; display:block; }
  .gallery-item p { margin:0; padding:10px; color:white; }
  .gallery-item:hover p { color:#333; }

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
    background: #0b0b0b;
    color: #fff;
  }
  .modal-title {
    font-size: 14px;
    line-height: 1.3;
    margin: 0;
    padding: 0;
    flex: 1;
  }
  .modal-actions {
    display:flex;
    gap: 8px;
    align-items:center;
  }
  .btn {
    appearance: none;
    border: 0;
    border-radius: 10px;
    padding: 8px 10px;
    background: #2b2b2b;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    text-decoration: none;
    display:inline-flex;
    align-items:center;
    gap: 6px;
  }
  .btn:hover { background: #3a3a3a; }

  .player-wrap {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 */
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
    ${items}
  </div>

  <div class="modal" id="modal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="Video player">
      <div class="modal-header">
        <p class="modal-title" id="modalTitle">Playing…</p>
        <div class="modal-actions">
          <a class="btn" id="openNewTab" href="#" target="_blank" rel="noopener">Open in new tab</a>
          <button class="btn" id="closeBtn" type="button">Close</button>
        </div>
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
  const openNewTab = document.getElementById("openNewTab");

  function openVideo(videoId, title) {
    // Autoplay is far more reliable when muted.
    // User can unmute once it starts.
    const embed = "https://www.youtube-nocookie.com/embed/" + videoId +
      "?autoplay=1&mute=1&rel=0";

    player.src = embed;
    modalTitle.textContent = title || "Playing…";

    // New tab option (may still be blocked by GoDaddy in some cases, but often works)
    openNewTab.href = "https://www.youtube.com/watch?v=" + videoId;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    // Stop playback
    player.src = "";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-item[data-video-id]");
    if (!btn) return;
    const videoId = btn.getAttribute("data-video-id");
    const title = btn.getAttribute("data-title") || "Video";
    openVideo(videoId, title);
  });

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    // click outside the card closes
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
</script>

</body>
</html>`;

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/index.html", html);
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
