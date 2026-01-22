const fs = require("fs");

const API_KEY = process.env.YT_API_KEY;
const CHANNEL_ID = "UCLh7D6zXWhTrE_ELl0k55bQ";

if (!API_KEY) {
  throw new Error("YT_API_KEY is missing");
}

const API_URL =
  `https://youtube.googleapis.com/youtube/v3/search` +
  `?part=snippet&channelId=${CHANNEL_ID}` +
  `&maxResults=16&order=date&key=${API_KEY}`;

async function build() {
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`YouTube API failed: ${res.status}`);
  }

  const data = await res.json();

  const items = data.items
    .filter(v => v.id && v.id.videoId)
    .map(v => {
      const videoId = v.id.videoId;
      const title = (v.snippet && v.snippet.title) ? v.snippet.title : "Video";
      const thumb = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.high?.url || "";

      // Use privacy-enhanced embed URL. No target="_blank" to avoid GoDaddy iframe pop-up restrictions.
      const href = `https://www.youtube-nocookie.com/embed/${videoId}`;

      return `
        <div class="gallery-item">
          <a href="${href}">
            <img src="${thumb}" alt="${escapeHtml(title)}">
            <p>${escapeHtml(title)}</p>
          </a>
        </div>
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
  .topbar {
    padding: 14px 20px;
    background: #ffffff;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .topbar a {
    text-decoration: none;
    color: #333;
    font-weight: bold;
  }

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
  }
  .gallery-item:hover {
    transform: translateY(-3px);
    background:#ccc;
  }
  .gallery-item img { width:100%; display:block; }
  .gallery-item a {
    display:block;
    text-decoration:none;
    color:white;
  }
  .gallery-item p {
    margin:0;
    padding:10px;
    color: inherit;
  }
  .gallery-item:hover a { color:#333; }
</style>
</head>
<body>

  <div class="topbar">
    <a href="./">← Back to gallery</a>
  </div>

  <div class="gallery">
    ${items}
  </div>

</body>
</html>`;

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/index.html", html);
}

// Simple HTML escape so odd characters in titles don't break markup
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

build();
