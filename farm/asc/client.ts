/**
 * Minimal App Store Connect API client (https://developer.apple.com/documentation/appstoreconnectapi).
 * Auth: ES256 JWT from an API key (.p8). Env:
 *   ASC_KEY_ID, ASC_ISSUER_ID, and ASC_PRIVATE_KEY (PEM contents) or ASC_PRIVATE_KEY_PATH
 * Set FARM_DRY_RUN=1 to print mutating requests instead of sending them.
 */
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { log } from '../lib/util.ts';

const BASE = 'https://api.appstoreconnect.apple.com';
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export class AscError extends Error {
  constructor(public status: number, public body: any, msg: string) { super(msg); }
}

export class Asc {
  private token?: { value: string; exp: number };
  readonly dryRun = process.env.FARM_DRY_RUN === '1';

  constructor(private keyId = process.env.ASC_KEY_ID, private issuer = process.env.ASC_ISSUER_ID,
    private pem = process.env.ASC_PRIVATE_KEY || (process.env.ASC_PRIVATE_KEY_PATH ? readFileSync(process.env.ASC_PRIVATE_KEY_PATH, 'utf8') : undefined)) {
    if (!this.keyId || !this.issuer || !this.pem) throw new Error('App Store Connect API key missing: set ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_PATH (see docs/SETUP.md)');
  }

  private jwt() {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return this.token.value;
    const header = b64url(JSON.stringify({ alg: 'ES256', kid: this.keyId, typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ iss: this.issuer, iat: now, exp: now + 1150, aud: 'appstoreconnect-v1' }));
    const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key: createPrivateKey(this.pem!), dsaEncoding: 'ieee-p1363' });
    this.token = { value: `${header}.${payload}.${b64url(sig)}`, exp: now + 1150 };
    return this.token.value;
  }

  async req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.dryRun && method !== 'GET') {
      log.info(`[dry-run] ${method} ${path} ${body ? JSON.stringify(body).slice(0, 400) : ''}`);
      return { data: { id: `dry-${Math.random().toString(36).slice(2, 8)}`, attributes: {} } } as T;
    }
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(path.startsWith('http') ? path : BASE + path, {
        method,
        headers: { authorization: `Bearer ${this.jwt()}`, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const detail = (json.errors ?? []).map((e: any) => `${e.code}: ${e.detail ?? e.title}${e.source?.pointer ? ` (${e.source.pointer})` : ''}`).join('; ');
        throw new AscError(res.status, json, `${method} ${path} → ${res.status} ${detail}`);
      }
      return json as T;
    }
  }
  get = <T = any>(p: string) => this.req<T>('GET', p);
  post = <T = any>(p: string, b: unknown) => this.req<T>('POST', p, b);
  patch = <T = any>(p: string, b: unknown) => this.req<T>('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);

  /** Asset upload protocol used by screenshots and previews: reserve → PUT parts → commit with MD5. */
  async uploadAsset(kind: 'appScreenshots' | 'appPreviews', setRel: { type: string; id: string }, fileName: string, data: Buffer, extra: Record<string, unknown> = {}) {
    const relName = kind === 'appScreenshots' ? 'appScreenshotSet' : 'appPreviewSet';
    const reserved = await this.post(`/v1/${kind}`, {
      data: { type: kind, attributes: { fileName, fileSize: data.length, ...extra }, relationships: { [relName]: { data: setRel } } },
    });
    const id = reserved.data.id;
    if (!this.dryRun) {
      for (const op of reserved.data.attributes.uploadOperations ?? []) {
        const headers: Record<string, string> = {};
        for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
        const res = await fetch(op.url, { method: op.method, headers, body: new Uint8Array(data.subarray(op.offset, op.offset + op.length)) });
        if (!res.ok) throw new Error(`upload part failed for ${fileName}: ${res.status}`);
      }
    }
    const md5 = createHash('md5').update(data).digest('hex');
    await this.patch(`/v1/${kind}/${id}`, { data: { type: kind, id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
    return id as string;
  }
}
