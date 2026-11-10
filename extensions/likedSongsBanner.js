// Biekdafreak - Purple Drank: Liked Songs banner
//
// Replaces the Liked Songs header art with a wide strip of album covers from the
// artists you've liked the most songs by. Each cover fades out at its edges and
// overlaps its neighbours, so the strip reads as one continuous banner.
//
// The header layout (full width, 300px tall, black behind the strip) lives in the
// theme's user.css; this file only draws the covers. That layout applies only
// while the header carries data-pd-banner, so Spotify's own header shows when
// this script isn't running or has no covers to draw.

(function purpleDrankLikedSongsBanner() {
  const COVER_COUNT = 6;
  const MAX_TRACKS = 2000;
  const PAGE_SIZE = 500;
  const MARKER = "pd-liked-banner";

  const ready = () =>
    typeof Spicetify !== "undefined" && Spicetify.Platform?.LibraryAPI && document.body;
  if (!ready()) {
    setTimeout(purpleDrankLikedSongsBanner, 300);
    return;
  }

  // ---- Styles ---------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    .${MARKER} {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .${MARKER} img {
      position: absolute;
      top: 0;
      height: 100%;
      object-fit: cover;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 40%, #000 60%, transparent);
      mask-image: linear-gradient(90deg, transparent, #000 40%, #000 60%, transparent);
    }
  `;
  document.head.appendChild(style);

  // ---- Data -----------------------------------------------------------------
  const coverUrl = (url) =>
    typeof url === "string" && url.startsWith("spotify:image:")
      ? `https://i.scdn.co/image/${url.split(":").pop()}`
      : url;

  const bestCover = (album) => {
    const images = album?.images ?? [];
    const byLabel = (label) => images.find((image) => image.label === label);
    return coverUrl((byLabel("large") ?? byLabel("xlarge") ?? images[0])?.url);
  };

  async function likedTracks() {
    const library = Spicetify.Platform.LibraryAPI;
    const tracks = [];
    while (tracks.length < MAX_TRACKS) {
      const page = await library.getTracks({
        uri: library._likedSongsUri,
        offset: tracks.length,
        limit: Math.min(PAGE_SIZE, MAX_TRACKS - tracks.length),
      });
      const items = page?.items ?? [];
      tracks.push(...items);
      if (items.length === 0 || tracks.length >= (page?.totalLength ?? Infinity)) break;
    }
    return tracks;
  }

  let coversPromise = null;
  function topArtistCovers() {
    coversPromise ??= likedTracks()
      .then((tracks) => {
        // artist uri -> { songs, cover } — cover is the first liked album seen for them
        const tally = {};
        for (const track of tracks) {
          const artist = track?.artists?.[0]?.uri;
          if (!artist) continue;
          tally[artist] ??= { songs: 0, cover: null };
          tally[artist].songs += 1;
          tally[artist].cover ??= bestCover(track.album);
        }
        return Object.values(tally)
          .filter((artist) => artist.cover)
          .sort((a, b) => b.songs - a.songs)
          .slice(0, COVER_COUNT)
          .map((artist) => artist.cover);
      })
      .catch(() => []);
    return coversPromise;
  }

  // ---- Drawing --------------------------------------------------------------
  function likedSongsHeader() {
    const art = document.querySelector('img.main-entityHeader-image[src*="liked-songs"]');
    return art
      ?.closest("section")
      ?.querySelector(".main-entityHeader-backgroundColor:not(.main-entityHeader-overlay)");
  }

  async function draw() {
    const header = likedSongsHeader();
    if (!header || header.dataset.pdBanner) return;
    header.dataset.pdBanner = "pending";

    const covers = await topArtistCovers();
    if (!covers.length || !header.isConnected) {
      delete header.dataset.pdBanner;
      return;
    }

    const strip = document.createElement("div");
    strip.className = MARKER;
    const slot = 100 / covers.length;
    const width = slot * 2.1; // wider than its slot, so neighbours overlap
    covers.forEach((src, index) => {
      const cover = document.createElement("img");
      cover.src = src;
      cover.alt = "";
      cover.style.left = `${index * slot + slot / 2 - width / 2}%`;
      cover.style.width = `${width}%`;
      strip.appendChild(cover);
    });

    header.style.setProperty("position", "relative", "important");
    header.prepend(strip);
    header.dataset.pdBanner = "done";
  }

  // Spotify rebuilds pages on navigation; re-check at most once per frame.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  }).observe(document.body, { childList: true, subtree: true });

  draw();
})();
