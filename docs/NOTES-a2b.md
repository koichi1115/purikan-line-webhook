# A2B 対策メモ（2026-10-13）

根拠: A2B 注意喚起対応点検レポート（P1〜P8、A1/A2）。

## このブランチでのサーバ側修正
| 指摘 | 対応 |
|---|---|
| P1/P2 | `GET` / `DELETE /api/reminder` を削除（405） |
| P3 | `POST /api/reminder` を端末トークン（Bearer）認証に。LINE userId はトークンから引き、本文の `lineUserId` は無視。入力検証（型・長さ・日付範囲・type・daysBefore・driveFileId 形式）、レート制限（IP 30回/分、ユーザー 100回/日、Upstash の INCR） |
| P4 | cron は `Authorization: Bearer ${CRON_SECRET}` を定数時間比較。未設定なら 401（fail-closed） |
| P5 | webhook で生 body の HMAC-SHA256 を `x-line-signature` と定数時間比較。失敗・シークレット未設定は 401 |
| P6 | `/api/link` の `id` は `^U[0-9a-f]{32}$`、`t` は base64url 43 文字のみ許可。HTML/JS 双方でエスケープ、CSP・no-store |
| P7 | 500 応答は固定文 `internal_error` |
| P8 | cron ログから userId を削除（件数のみ） |

### 端末トークンの仕組み
1. ユーザーが LINE で友だち追加 or「連携」と送る → 署名検証済みイベントでのみ、サーバが 32 バイト乱数トークンを発行（Redis には SHA-256 ハッシュのみ保存、TTL 400 日、再発行で旧トークン失効）。
2. 連携リンク `/api/link?id=U...&t=<token>` → deep link `otayori-ai://link-line?id=U...&token=<token>`。
3. アプリは token を保存し、`POST /api/reminder` に `Authorization: Bearer <token>` を付ける。

**アプリ側の必要変更（このPRには含まない、otayori-ai 側）**
- `app/link-line.tsx`: `token` パラメータを受け取り保存（SecureStore 推奨）。
- `src/services/reminder.ts`: `Authorization: Bearer` を付与。`lineUserId` は送らなくてよい（送っても無視）。
- 設定画面の LINE userId 手入力欄（`app/(tabs)/settings.tsx:196`）はトークンが取れないため、手入力運用は廃止して「LINE で『連携』と送る」導線に。

**既存クライアントへの影響**: 現行公開版アプリはトークンを送らないため、デプロイ後は `POST /api/reminder` が 401 になり LINE リマインダー登録が止まる（アプリ側は best-effort で握りつぶすのでクラッシュはしない）。アプリ更新＋再連携（「連携」と送り直し）が必要。登録済みのリマインダーは引き続き送信される。

## 未対応（設計メモのみ）: A1 Anthropic キー / A2 LINE チャネルアクセストークンのアプリ埋め込み

### 現状
- A1: `app.config.js:6` で `CLAUDE_API_KEY` を `extra.claudeApiKey` としてバンドルに埋め込み、`src/services/llm.ts:105,238` から端末が直接 `api.anthropic.com` を呼ぶ。設定画面でユーザー自身のキーも入力可（`src/db/settings.ts`）。
- A2: `src/services/line-notify.ts` が端末設定の `lineChannelAccessToken` で LINE push API を直接呼ぶ（`scan.tsx:126`、`drive-sync.ts:140`）。

### 方針
- **A1**: サーバに `POST /api/llm`（仮）を設け、Anthropic キーはサーバの環境変数のみに置く。認証は上記の端末トークン流用では LINE 未連携ユーザーが使えないため、別途「端末登録＋端末秘密」（cheap-media-archive と同方式）か App Attest / Play Integrity を推奨。モデル・max_tokens・入力サイズをサーバで固定/上限、ユーザー/日のレート制限と Anthropic 側の月額上限設定が必須。プロンプト本体（`llm.ts`）は画像（おたより写真）を送るため、Vercel の body 上限（4.5MB）に注意。ストリーミング有無も要確認。
- **A2**: 端末からの LINE push を廃止し、サーバ `POST /api/notify`（端末トークン認証、送信先はトークン由来 userId に固定、本文長上限、レート制限）に置き換え。アプリ設定から `lineChannelAccessToken` を削除。

### 影響範囲（アプリ側）
`app.config.js`、`app.json`、`src/config.ts`、`src/services/llm.ts`（全 LLM 呼び出し）、`src/services/line-notify.ts`、`src/db/settings.ts`、`src/types/index.ts`、`app/(tabs)/settings.tsx`、`.env.example`、テスト（`__tests__`）。ストア再審査が必要。

### 止めた理由
LLM プロキシは課金・認証方式・画像サイズ・ストリーミングの設計判断を含み、新規依存なしで「小さく安全に」直せる範囲を超える。旧アプリが直接 Anthropic を呼ぶ限りキー漏えいリスクは残るため、**キーのローテーションと Anthropic 側の利用上限設定を先行**するのが現実的。
