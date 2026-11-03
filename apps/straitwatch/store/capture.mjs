// Capture hooks for Straitwatch (farm web captures only: playtest journeys, screenshots, preview).
// They PLAY the real game through real input — clicks on threats, weapon pickups and draft cards — so the
// screenshots show a genuine run. The game's test hook (window.__v3: game(), toClient()) is only READ, to know
// where to tap; it is never used to change game state. Without the hook (a build that drops it) the player
// taps across the water and takes the first draft card, which still plays, less well.

const pick = (arr, n) => arr.slice(0, n);

async function look(page) {
  return page.evaluate(() => {
    const v = window.__v3;
    const g = v?.game?.();
    if (!g) return { hook: !!v, phase: null };
    const vw = window.innerWidth;
    const shot = (o) => ({ ...v.toClient(o.x, o.y), id: o.id });
    // Only points on the playfield canvas: a threat under a rail or a HUD button must not be clicked through
    // (an early capture paused the game that way).
    const onField = (p) => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS';
    // The most urgent threats first: those furthest east-to-west along their run are nearest a ship.
    const threats = g.phase === 'wave'
      ? g.threats.filter((t) => !g.interceptors.some((i) => i.target === t.id)).map(shot).filter((p) => p.x > 0 && p.x < vw && onField(p))
      : [];
    const pickups = g.phase === 'wave' ? g.pickups.map(shot).filter((p) => p.x > 0 && p.x < vw && onField(p)) : [];
    return { hook: true, phase: g.phase, wave: g.wave, threats, pickups, loaded: !!g.weapon };
  });
}

async function draft(page, prefer = []) {
  const cards = page.locator('[data-screen="draft"] .v2-card:not([disabled])');
  if (!(await cards.count())) return false;
  await page.waitForTimeout(900); // the deal animation ignores early taps
  for (const id of prefer) {
    const c = page.locator(`[data-screen="draft"] .v2-card[data-upgrade="${id}"]:not([disabled])`);
    if (await c.count()) { await c.first().click(); return true; }
  }
  await cards.first().click();
  return true;
}

export const hooks = {
  /** Play for `ms`: intercept threats, grab weapon pickups, draft (args.draft = preferred weapon ids). */
  async play(page, step) {
    const until = Date.now() + (step.ms ?? 8000);
    const prefer = step.args?.draft ?? [];
    const taps = step.args?.taps ?? 3;
    while (Date.now() < until) {
      if (await page.locator('[data-screen="draft"]').count()) {
        if (step.args?.noDraft) return;
        await draft(page, prefer);
        await page.waitForTimeout(400);
        continue;
      }
      const resume = page.locator('.v2-pause-panel button', { hasText: 'Resume' });
      if (await resume.count()) { await resume.first().click(); continue; }
      const s = await look(page);
      if (s.phase === 'won' || s.phase === 'lost') break;
      if (!s.hook) {
        const vp = page.viewportSize();
        await page.mouse.click(vp.width * (0.25 + Math.random() * 0.5), vp.height * (0.3 + Math.random() * 0.4));
      } else {
        if (s.pickups.length && (step.args?.pickups ?? true)) await page.mouse.click(s.pickups[0].x, s.pickups[0].y);
        for (const t of pick(s.threats, taps)) await page.mouse.click(t.x, t.y);
      }
      await page.waitForTimeout(160);
    }
  },
  /** Play until the given wave is running (and args.minMs into it). */
  async playToWave(page, step) {
    const wave = step.args?.wave ?? 2;
    const deadline = Date.now() + (step.ms ?? 120000);
    while (Date.now() < deadline) {
      const s = await look(page);
      if (!s.hook || (s.phase === 'wave' && s.wave >= wave)) break;
      await hooks.play(page, { hook: 'play', ms: 1500, args: step.args });
    }
  },
  /** Play until the draft opens after the current wave (and leave it open). */
  async playToDraft(page, step) {
    const deadline = Date.now() + (step.ms ?? 90000);
    while (Date.now() < deadline && !(await page.locator('[data-screen="draft"]').count())) {
      const s = await look(page);
      if (s.phase === 'won' || s.phase === 'lost') break;
      await hooks.play(page, { hook: 'play', ms: 600, args: { ...(step.args ?? {}), noDraft: true } });
    }
  },
  /** Play until a weapon drops, grab it, and fire it at the nearest threats (the shot lands mid-burst). */
  async fireWeapon(page, step) {
    const deadline = Date.now() + (step.ms ?? 30000);
    while (Date.now() < deadline) {
      const s = await look(page);
      if (!s.hook) return;
      if (s.phase === 'wave' && s.pickups.length && s.threats.length >= 2) {
        await page.mouse.click(s.pickups[0].x, s.pickups[0].y);
        await page.waitForTimeout(100);
        const t = await look(page);
        for (const p of t.threats.slice(0, step.args?.shots ?? 2)) await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(step.args?.settle ?? 180);
        return;
      }
      await hooks.play(page, { hook: 'play', ms: 300, args: { ...(step.args ?? {}), pickups: false } });
    }
  },
  /** Play until the sky is busy (args.minThreats in view), then fire at two of them: a capture right after
   *  shows threats inbound and interceptors in flight. */
  async action(page, step) {
    const deadline = Date.now() + (step.ms ?? 30000);
    const min = step.args?.minThreats ?? 5;
    while (Date.now() < deadline) {
      const s = await look(page);
      if (!s.hook) return;
      if (s.phase === 'wave' && s.threats.length >= min) {
        for (const p of s.threats.slice(0, 2)) await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(step.args?.settle ?? 220);
        return;
      }
      await hooks.play(page, { hook: 'play', ms: 250, args: { ...(step.args ?? {}), taps: 1 } });
    }
  },
  /** Play only until a weapon pickup is on the water, then leave it there (for a shot that shows one). */
  async waitForPickup(page, step) {
    const deadline = Date.now() + (step.ms ?? 30000);
    while (Date.now() < deadline) {
      const s = await look(page);
      if (!s.hook || s.pickups.length) break;
      await hooks.play(page, { hook: 'play', ms: 400, args: { ...(step.args ?? {}), pickups: false } });
    }
  },
};
