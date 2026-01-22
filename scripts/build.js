import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.YT_API_KEY;
const CHANNEL_ID = "UCLh7D6zXWhTrE_ELl0k55bQ";

const API_URL =
  `https://youtube.googleapis.com/youtube/v3/search` +
  `?part=snippet&channelId=${CHANNEL_ID}` +
  `&maxResults=16&order=date&key=${API_KEY}`;

async function build() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error("YouTube API failed");

  const data = await res.json();

  const items = data.items
    .filter(v => v.id.videoId)
    .map(v => `
      <div class="gallery-item">
        <a href="https://www.youtube.com/watch?v=${v.id.videoId}" target="_blank">
          <img src="${v.snippet.thumbnails.medium.url}" alt="${v.snippet.title}">
          <p>${v.snippet.title}</p>
        </a>
      </div>
    `)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sermon Recordings</title>
<style>
body { margin:0; font-family:Arial; background:#f4f4f4; }
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
}
.gallery-item img { width:100%; display:block; }
.gallery-item p {
  margin:0;
  padding:10px;
  color:white;
}
</style>
</head>
<body>
<div class="gallery">
${items}
</div>
</body>
</html>`;

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/index.html", html);
}

build();
