# AlchemyX ERP

AlchemyX Global の受注管理、顧客、プロジェクト、請求書、定期契約、タイムシート、レポートを扱う ERP です。

- `backend-nest/` — API。NestJS（TypeScript）、PostgreSQL（Neon）。詳細は [backend-nest/README.ja.md](./backend-nest/README.ja.md) を参照。
- `frontend/` — Web アプリ。React 19 + Vite + Tailwind。静的ファイルとしてビルド。
- `mobile/` — AlchemyX Connect（Android アプリ）。Web アプリを Capacitor で包んだもの。

## ローカルで起動する

プロジェクトのルートで次を実行すると、API（`http://localhost:8100`）と Web アプリ（`http://localhost:8443`）が同時に起動します。

```bash
npm start
```

`Ctrl+C` で両方が停止します。API と Web アプリを個別に起動する場合は、次のとおりです。

```bash
cd backend-nest && npm install && npm run dev     # API
cd frontend && corepack pnpm install && corepack pnpm dev   # Web アプリ
```

- API の設定は `backend-nest/.env`（`.env.example` を参考に作成）。
- Web アプリの API の向き先は `frontend/.env.local` の `VITE_API_URL` で指定します。
- API の `CORS_ALLOWED_ORIGINS` に、Web アプリのオリジン（例：`http://localhost:8443`）を含めてください。

## 無料で公開する（Render + Neon）

構成は 2 つです。

```
Render（Docker）  alchemyx-erp      ──▶ API   /api/**   ──▶ Neon（PostgreSQL）
Render（静的）    alchemyx-erp-web  ──▶ Web アプリ（VITE_API_URL で API を指定）
```

### 1. データベースを作成（Neon）

1. [neon.com](https://neon.com) でサインアップし、プロジェクトを作成します。
2. **プール接続**の接続文字列をコピーします（`postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=verify-full` の形式）。

スキーマは API の起動時に自動で作成されるため、データベースは空でかまいません。

### 2. サービスをデプロイ（Render）

1. このリポジトリを GitHub に push します。
2. Render で **New → Blueprint** を選び、リポジトリを指定します。`render.yaml` を読み込み、API と Web アプリの 2 つのサービスが作成されます。
3. `sync: false` と書かれた値を入力します。
   - API の `DATABASE_URL` に Neon の接続文字列を入れます。
   - `FRONTEND_URL` には Web アプリの URL（例：`https://alchemyx-erp-web.onrender.com`）を、`CORS_ALLOWED_ORIGINS` にも同じ URL を入れます。
   - Web アプリの `VITE_API_URL` には API の URL（例：`https://alchemyx-erp.onrender.com`）を入れます。
   - URL は作成後にしか分からないため、最初は空欄にして、分かったら入力して再デプロイしてください。
4. Web アプリを開き、`BOOTSTRAP_ADMIN_*` のアカウントでサインインします。
5. Render のダッシュボードで **`BOOTSTRAP_ADMIN_PASSWORD` を削除**し、API を再デプロイします。この値は、データベースにメンバーがいないときに最初のスーパー管理者を作成するためだけに使われます。

Docker イメージをローカルでビルドする場合（`backend-nest` フォルダで実行）：

```bash
docker build -t alchemyx-erp-api .
docker run --rm -p 8080:8080 --env-file .env alchemyx-erp-api
```

### 無料枠の制限

| | 無料枠の上限 | 影響 |
|---|---|---|
| Render Web サービス（API） | RAM 512 MB、CPU 0.1、15 分間アクセスがないとスリープ | 最初のリクエストに約 60 秒かかる。スリープ中は定期請求ジョブも止まる |
| Render 静的サイト（Web アプリ） | 無料 | 特になし |
| Neon PostgreSQL | ストレージ 0.5 GB、5 分間アイドルで自動停止 | アイドル後の最初のクエリが遅い |
| 送信メール | Render は SMTP ポート 25/465/587 をブロック | `MAIL_HOST` を空にする（メールはログに出力される）か、HTTP のメール API を使う |

デモや少人数での利用には十分ですが、本番向けの構成ではありません。定期請求（毎日 06:00）と期限超過の通知（毎日 07:00）は、API が常時起動している必要があります。本番で使う場合は、スリープしないホスト（例：Oracle Cloud の VM）に API を置いてください。定期的にデータベースをバックアップ（`pg_dump`）することも忘れずに。

### API の環境変数

| 変数 | 必須 | 用途 |
|---|---|---|
| `DATABASE_URL` | はい | Neon の接続文字列（`?sslmode=verify-full`） |
| `DB_POOL_SIZE` | いいえ | DB 接続プールのサイズ。既定は `5`。無料プランでは `3` を推奨 |
| `FRONTEND_URL` | はい | パスワード再設定リンクで使う Web アプリの URL |
| `CORS_ALLOWED_ORIGINS` | はい | API の呼び出しを許可するオリジン（カンマ区切り） |
| `BOOTSTRAP_ADMIN_*` | 初回起動時 | 最初のスーパー管理者を作成 |
| `APP_TIMEZONE` | いいえ | 業務日付とスケジューラのタイムゾーン。既定は `Asia/Colombo` |
| `SESSION_TTL` | いいえ | セッションの有効期間。既定は `12h` |
| `MAIL_*`, `MAIL_FROM` | いいえ | SMTP での送信。`MAIL_HOST` を空にするとログ出力になる |
| `BILLING_CRON` / `OVERDUE_CRON` | いいえ | 定期請求と期限超過通知のスケジュール |
| `RUN_MIGRATIONS` | いいえ | 起動時にマイグレーションを実行するか。既定は `true` |
| `PORT` | ホストが設定 | サーバーのポート。既定は `8080` |

## 別のホストで運用する場合

Web アプリは `frontend/Dockerfile`（nginx で配信）でも、Cloudflare Pages や Vercel のような静的ホスティングでも公開できます。その場合は、Web アプリをビルドするときに `VITE_API_URL=https://<api-host>` を指定し、API 側の `CORS_ALLOWED_ORIGINS` に `https://<web-host>` を追加してください。

## 携帯アプリ（AlchemyX Connect）

`mobile/` は Capacitor の Android プロジェクトです。アプリは起動時に API のアドレスを尋ねるため、公開した API の URL を入力します。ビルドには Android SDK が必要です。

## CI

`.github/workflows/ci.yml` は、`main` への push と Pull Request のたびに次を実行します。

- API：型チェック、テスト、ビルド、Docker イメージのビルド
- Web アプリ：型チェック、ビルド、Docker イメージのビルド
