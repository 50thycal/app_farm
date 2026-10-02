/**
 * Store assets:
 *  - icon:        store/icon.svg → 1024² opaque PNG + all app icon/splash/favicon variants
 *  - screenshots: raw captures (native simulator if present, else web build) → framed marketing PNGs
 *  - preview:     15–30 s App Preview video (886×1920 H.264 + AAC) recorded from the app
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { appPaths, ensureDir, log, run, which } from '../lib/util.ts';
import { validateFile } from '../lib/state.ts';
import { DEVICES, PREVIEW, type DeviceId } from '../lib/apple.ts';
import { exportWeb, launch, phoneContext, runSteps, serveStatic } from '../lib/web.ts';
import type { Listing, Shots } from '../schemas/index.ts';

// ---------------------------------------------------------------- icon
export async function makeIcons(slug: string) {
  const P = appPaths(slug);
  if (!existsSync(P.iconSvg)) throw new Error(`missing ${P.iconSvg} (the listing stage designs it)`);
  const spec = validateFile('spec', P.spec);
  const bg = spec.ok ? spec.data.design.backgroundColor : '#ffffff';
  const svg = readFileSync(P.iconSvg);
  const svgWidth = (await sharp(svg).metadata()).width || 1024;
  // Rasterize at 2× the largest output so edges stay crisp, then downscale.
  const density = Math.ceil((72 * 2048) / svgWidth);
  const render = (size: number) => sharp(svg, { density, limitInputPixels: false }).resize(size, size, { fit: 'cover' });

  // App Store icon: 1024×1024, no alpha, no rounded corners (Apple masks it).
  await render(1024).flatten({ background: bg }).removeAlpha().png().toFile(P.iconPng);
  const img = path.join(P.app, 'assets', 'images');
  ensureDir(img);
  copyFileSync(P.iconPng, path.join(img, 'icon.png'));
  await render(1024).png().toFile(path.join(img, 'splash-icon.png'));
  await render(1024).png().toFile(path.join(img, 'android-icon-foreground.png'));
  await render(1024).grayscale().png().toFile(path.join(img, 'android-icon-monochrome.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: bg } }).png().toFile(path.join(img, 'android-icon-background.png'));
  await render(48).png().toFile(path.join(img, 'favicon.png'));
  log.ok(`icons → ${path.relative(process.cwd(), P.iconPng)} (+ app/assets/images)`);
}

// ---------------------------------------------------------------- screenshots
async function edgeColor(buf: Buffer, edge: 'top' | 'bottom'): Promise<string> {
  const m = await sharp(buf).metadata();
  const h = 6;
  const { channels } = await sharp(buf).extract({ left: 0, top: edge === 'top' ? 0 : m.height! - h, width: m.width!, height: h }).stats();
  const hex = channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, '0')).join('');
  return `#${hex}`;
}
function isDark(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}
const escHtml = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function frameHtml(o: {
  device: DeviceId; rawDataUri: string; synthetic: boolean; topColor: string; bottomColor: string;
  caption: string; subcaption?: string; brand: Listing['brand'];
}) {
  const d = DEVICES[o.device];
  const [W, H] = d.out;
  const f = d.frame;
  const screenW = f.deviceW - 2 * f.bezel;
  const scale = screenW / W;
  const screenH = H * scale;
  const statusH = d.statusPt * d.dpr * scale;
  const homeH = d.homePt * d.dpr * scale;
  const fg = isDark(o.topColor) ? '#fff' : '#000';
  const capSize = Math.round(W * 0.079);
  const bgEnd = o.brand.backgroundEnd ?? o.brand.background;
  const icons = `<svg width="${86 * scale * 3}" height="${14 * scale * 3}" viewBox="0 0 86 14" fill="${fg}"><rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="10" y="3.5" width="3" height="9.5" rx="1"/><rect x="15" y="1" width="3" height="12" rx="1"/><path d="M33 3.2c2.6 0 5 1 6.8 2.7l1.3-1.3A11.3 11.3 0 0 0 33 1.3c-3.1 0-5.9 1.2-8 3.3l1.3 1.3A9.5 9.5 0 0 1 33 3.2zm0 3.7c1.6 0 3 .6 4.1 1.6l1.3-1.3a7.6 7.6 0 0 0-10.8 0l1.3 1.3c1.1-1 2.5-1.6 4.1-1.6zm0 3.7c-.6 0-1.1.2-1.5.6L33 12.7l1.5-1.5c-.4-.4-.9-.6-1.5-.6z"/><rect x="52" y="1.5" width="27" height="11" rx="3.5" fill="none" stroke="${fg}" stroke-opacity=".4"/><rect x="54" y="3.5" width="23" height="7" rx="2"/><rect x="80.5" y="5" width="1.5" height="4" rx=".75" fill-opacity=".4"/></svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:linear-gradient(170deg, ${o.brand.background} 0%, ${bgEnd} 100%);font-family:${o.brand.font};color:${o.brand.text};-webkit-font-smoothing:antialiased}
  .cap{position:absolute;top:${Math.round(H * 0.06)}px;left:${Math.round(W * 0.08)}px;right:${Math.round(W * 0.08)}px;text-align:center}
  h1{font-size:${capSize}px;line-height:1.06;font-weight:800;letter-spacing:-0.02em}
  h1 em{font-style:normal;color:${o.brand.accent}}
  p{margin-top:${Math.round(capSize * 0.32)}px;font-size:${Math.round(capSize * 0.46)}px;font-weight:500;opacity:.78;line-height:1.25}
  .device{position:absolute;left:${(W - f.deviceW) / 2}px;top:${f.top}px;width:${f.deviceW}px;padding:${f.bezel}px;border-radius:${f.radius}px;background:#0b0b0f;box-shadow:0 40px 120px rgba(0,0,0,.35), inset 0 0 0 4px #2a2a30}
  .screen{position:relative;width:${screenW}px;height:${screenH}px;border-radius:${f.radius - f.bezel}px;overflow:hidden;background:${o.topColor}}
  .status{height:${statusH}px;background:${o.topColor};color:${fg};display:flex;align-items:center;justify-content:space-between;padding:0 ${statusH * 0.55}px 0 ${statusH * 0.75}px;font:600 ${statusH * 0.3}px/1 -apple-system,"SF Pro Text",Inter,sans-serif}
  .island{position:absolute;top:${statusH * 0.2}px;left:50%;transform:translateX(-50%);width:${screenW * 0.3}px;height:${statusH * 0.5}px;border-radius:999px;background:#000}
  .content{display:block;width:100%}
  .home{height:${homeH}px;background:${o.bottomColor};display:flex;align-items:center;justify-content:center}
  .home i{display:block;width:${screenW * 0.36}px;height:${Math.max(6, homeH * 0.13)}px;border-radius:99px;background:${isDark(o.bottomColor) ? '#fff' : '#000'}}
  .full{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  </style></head><body>
  <div class="cap"><h1>${escHtml(o.caption).replace(/\*(.+?)\*/g, '<em>$1</em>')}</h1>${o.subcaption ? `<p>${escHtml(o.subcaption)}</p>` : ''}</div>
  <div class="device"><div class="screen">${o.synthetic
    ? `<div class="status"><span>9:41</span>${icons}</div><div class="island"></div><img class="content" src="${o.rawDataUri}"><div class="home"><i></i></div>`
    : `<img class="full" src="${o.rawDataUri}">`}</div></div>
  </body></html>`;
}

/** Capture raw screens from the web build. Content viewport excludes status bar + home indicator (drawn by the frame). */
export async function captureWebRaw(slug: string, shots: Shots, devices: DeviceId[], baseUrl: string) {
  const P = appPaths(slug);
  const browser = await launch();
  try {
    for (const dev of devices) {
      const d = DEVICES[dev];
      const dir = ensureDir(path.join(P.rawWeb, dev));
      for (const scene of shots.scenes) {
        const ctx = await phoneContext(browser, baseUrl, {
          width: d.viewport[0], height: d.viewport[1] - d.statusPt - d.homePt, dpr: d.dpr,
        });
        const page = await ctx.newPage();
        try {
          await runSteps(page, baseUrl, scene.steps, { demo: scene.demo, stepDelayMs: 400 });
          await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(dir, `${scene.id}.png`) });
          log.ok(`raw ${dev}/${scene.id}`);
        } catch (e) {
          throw new Error(`scene "${scene.id}" (${dev}) failed: ${(e as Error).message}`);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

export async function composeScreenshots(slug: string, shots: Shots, listing: Listing, devices: DeviceId[]) {
  const P = appPaths(slug);
  const browser = await launch();
  try {
    for (const dev of devices) {
      const d = DEVICES[dev];
      const outDir = path.join(P.screenshots, dev);
      rmSync(outDir, { recursive: true, force: true });
      ensureDir(outDir);
      const ctx = await browser.newContext({ viewport: { width: d.out[0], height: d.out[1] }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      for (const [i, scene] of shots.scenes.entries()) {
        const native = path.join(P.rawNative, dev, `${scene.id}.png`);
        const nativeFlat = path.join(P.rawNative, `${scene.id}.png`);
        const src = [native, ...(dev === 'iphone-6.9' ? [nativeFlat] : []), path.join(P.rawWeb, dev, `${scene.id}.png`)].find(existsSync);
        if (!src) throw new Error(`no raw capture for ${dev}/${scene.id}`);
        const raw = readFileSync(src);
        const synthetic = src.includes(`${path.sep}web${path.sep}`);
        const html = frameHtml({
          device: dev, synthetic, caption: scene.caption, subcaption: scene.subcaption, brand: listing.brand,
          rawDataUri: `data:image/png;base64,${raw.toString('base64')}`,
          topColor: await edgeColor(raw, 'top'), bottomColor: await edgeColor(raw, 'bottom'),
        });
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const png = await page.screenshot({ type: 'png' });
        const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${scene.id}.png`);
        // Apple rejects screenshots with alpha channels.
        await sharp(png).flatten({ background: listing.brand.background }).removeAlpha().png().toFile(file);
        log.ok(`${dev} ${path.basename(file)} (${synthetic ? 'web' : 'native'} source)`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- preview video
export async function recordWebPreview(slug: string, shots: Shots, baseUrl: string, dev: DeviceId = 'iphone-6.9') {
  const P = appPaths(slug);
  if (!which('ffmpeg')) throw new Error('ffmpeg not found (brew install ffmpeg / apt install ffmpeg)');
  const d = DEVICES[dev];
  const [vw, vh] = d.preview;
  const vidDir = ensureDir(path.join(P.rawWeb, '_video'));
  for (const f of readdirSync(vidDir)) rmSync(path.join(vidDir, f), { force: true });

  const browser = await launch();
  const t0 = Date.now();
  let t1 = 0;
  try {
    const ctx = await phoneContext(browser, baseUrl, { width: vw / 2, height: vh / 2, dpr: 2, video: { dir: vidDir, size: { width: vw, height: vh } } });
    const page = await ctx.newPage();
    const [first, ...rest] = shots.preview.steps;
    await runSteps(page, baseUrl, [first], { demo: true, stepDelayMs: 0 });
    t1 = Date.now();
    await runSteps(page, baseUrl, rest, { demo: false, stepDelayMs: shots.preview.stepDelayMs, smooth: true });
    await page.waitForTimeout(1200);
    await ctx.close(); // flushes the video
  } finally {
    await browser.close();
  }
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error('no video recorded');
  const trim = Math.max(0, (t1 - t0) / 1000 - 0.1);
  const recorded = (Date.now() - t1) / 1000;
  const dur = Math.min(PREVIEW.maxSec - 0.5, Math.max(PREVIEW.minSec + 0.5, recorded));
  const outDir = ensureDir(path.join(P.previews, dev));
  const out = path.join(outDir, 'preview.mp4');
  const r = await run('ffmpeg', [
    '-y', '-ss', trim.toFixed(2), '-i', path.join(vidDir, webm),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', `scale=${vw}:${vh}:flags=lanczos,fps=${PREVIEW.fps},format=yuv420p,tpad=stop_mode=clone:stop_duration=${PREVIEW.maxSec}`,
    '-map', '0:v', '-map', '1:a', '-t', dur.toFixed(2),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'slow', '-crf', '17', '-r', String(PREVIEW.fps),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-movflags', '+faststart', out,
  ], { quiet: true });
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-1500)}`);
  // Poster frame for review
  await run('ffmpeg', ['-y', '-ss', '3', '-i', out, '-frames:v', '1', path.join(outDir, 'poster.png')], { quiet: true });
  log.ok(`preview → ${path.relative(process.cwd(), out)} (${dur.toFixed(1)}s${recorded < PREVIEW.minSec ? ', padded — add more preview steps' : ''})`);
}

/** Re-encode a native simulator recording (simctl recordVideo .mov) into an App Preview. */
export async function encodeNativePreview(slug: string, input: string, dev: DeviceId = 'iphone-6.9') {
  const P = appPaths(slug);
  const [vw, vh] = DEVICES[dev].preview;
  const out = path.join(ensureDir(path.join(P.previews, dev)), 'preview.mp4');
  const r = await run('ffmpeg', [
    '-y', '-ss', '1', '-i', input, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', `scale=${vw}:${vh}:force_original_aspect_ratio=decrease,pad=${vw}:${vh}:(ow-iw)/2:(oh-ih)/2,fps=${PREVIEW.fps},format=yuv420p,tpad=stop_mode=clone:stop_duration=${PREVIEW.maxSec}`,
    '-map', '0:v', '-map', '1:a', '-t', String(PREVIEW.maxSec - 1),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-crf', '17', '-r', String(PREVIEW.fps),
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out,
  ], { quiet: true });
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-1500)}`);
  log.ok(`native preview → ${out}`);
}

export async function makeAssets(slug: string, opts: { skipBuild?: boolean; only?: 'icons' | 'shots' | 'preview' | 'compose' } = {}) {
  const P = appPaths(slug);
  const listing = validateFile('listing', P.listing);
  const shots = validateFile('shots', P.shots);
  const spec = validateFile('spec', P.spec);
  if (!listing.ok) throw new Error(`listing.json invalid:\n  ${listing.errors.join('\n  ')}`);
  if (!shots.ok) throw new Error(`shots.json invalid:\n  ${shots.errors.join('\n  ')}`);
  if (!spec.ok) throw new Error('spec.json invalid');
  const devices: DeviceId[] = spec.data.app.supportsTablet ? ['iphone-6.9', 'ipad-13'] : ['iphone-6.9'];

  if (!opts.only || opts.only === 'icons') await makeIcons(slug);
  if (opts.only === 'icons') return;
  // Re-frame existing raw captures (e.g. native simulator shots) without touching the web build.
  if (opts.only === 'compose') return composeScreenshots(slug, shots.data, listing.data, devices);
  const nativeMov = path.join(P.rawNative, 'preview.mov');
  if (opts.only === 'preview' && existsSync(nativeMov)) return encodeNativePreview(slug, nativeMov);
  const dist = opts.skipBuild ? path.join(P.app, 'dist-web') : await exportWeb(P.app);
  const server = await serveStatic(dist);
  try {
    if (!opts.only || opts.only === 'shots') {
      await captureWebRaw(slug, shots.data, devices, server.url);
      await composeScreenshots(slug, shots.data, listing.data, devices);
    }
    if (!opts.only || opts.only === 'preview') {
      if (existsSync(nativeMov)) await encodeNativePreview(slug, nativeMov);
      else await recordWebPreview(slug, shots.data, server.url);
    }
  } finally {
    await server.close();
  }
}
