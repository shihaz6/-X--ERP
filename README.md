# AlchemyX ERP

AlchemyX Global の受注管理、顧客、プロジェクト、請求書、定期契約、タイムシート、レポートを扱う ERP です。

- `backend/` — Spring Boot 3.5 / Java 21。PostgreSQL（Flyway マイグレーション）を使用し、`$PORT` に対応。
- `backend-nest/` — 同じ API を NestJS（TypeScript）で作り直したバックエンド。詳細は [backend-nest/README.ja.md](./backend-nest/README.ja.md) を参照。
- `frontend/` — React 19 + Vite + Tailwind。静的ファイルとしてビルド。

## 無料でホストする（推奨：コンテナ 1 つ）

フロントエンドは静的な SPA なので、Spring Boot の jar（`src/main/resources/static`）に組み込まれます。
これにより、**URL は 1 つ、サービスも 1 つ、CORS の設定も不要**になります。

```
Render 無料 Web サービス（Docker） ──提供──▶  /          React アプリ
        │                                      /api/**     Spring Boot
        └──▶ Neon 無料 PostgreSQL（外部）
```

### 1. データベースを作成（Neon）

1. [neon.com](https://neon.com) でサインアップし、プロジェクトを作成します。
2. **プール接続**の接続文字列をコピーし、JDBC 形式に変換します。

   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
      ↓
   DB_URL = jdbc:postgresql://ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

初回起動時に Flyway がスキーマを作成するため、データベースは空でかまいません。

### 2. サービスをデプロイ（Render）

1. このリポジトリを GitHub に push します。
2. Render で **New → Blueprint** を選び、リポジトリを指定します。`render.yaml` が自動で検出され、ルートの `Dockerfile` から無料の Docker Web サービスが作成されます。
3. `sync: false` と書かれた値を入力します。`FRONTEND_URL` と `CORS_ALLOWED_ORIGINS` はサービス作成後にしか分からないため、最初は空欄のままにします。サービスが作成されたら、サービスの URL（`https://alchemyx-erp.onrender.com`）を設定して再デプロイしてください。`FRONTEND_URL` はパスワード再設定メールのリンクに使われます。
4. アプリを開き、`BOOTSTRAP_ADMIN_*` のアカウントでサインインします。
5. Render のダッシュボードで **`BOOTSTRAP_ADMIN_PASSWORD` を削除**し、再デプロイします。この値は、データベースにメンバーがいないときに最初のスーパー管理者を作成するためだけに使われます。

ローカルで Render と同じ方法でイメージをビルドする場合：

```bash
docker build -t alchemyx-erp .
docker run --rm -p 8080:8080 \
  -e DB_URL=jdbc:postgresql://host/db?sslmode=require \
  -e DB_USERNAME=... -e DB_PASSWORD=... \
  alchemyx-erp
```

### 無料枠の制限

| | 無料枠の上限 | 影響 |
|---|---|---|
| Render Web サービス | RAM 512 MB、CPU 0.1、15 分間アクセスがないとスリープ | 最初のリクエストに約 60 秒かかる |
| Neon PostgreSQL | ストレージ 0.5 GB、5 分間アイドルで自動停止 | アイドル後の最初のクエリが遅い |
| 送信メール | Render は SMTP ポート 25/465/587 をブロック | `MAIL_HOST` を空にする（メールはログに出力される）か、HTTP のメール API を使う |

デモや少人数での利用には十分ですが、本番向けの構成ではありません。CPU 0.1 では動作が遅く感じられ、無料枠は取り上げられることもあります。実際の業務データを保存する前に、定期的にデータベースをバックアップ（`pg_dump`）し、有料プランに移行してください。同じイメージがそのままデプロイできます。

### 環境変数

| 変数 | 必須 | 用途 |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | はい | Neon PostgreSQL（`jdbc:postgresql://…?sslmode=require`） |
| `DB_POOL_SIZE` | いいえ | Hikari のプールサイズ。既定は `5`。無料プランでは `3` を推奨 |
| `FRONTEND_URL` | はい | パスワード再設定リンクで使う基準 URL |
| `CORS_ALLOWED_ORIGINS` | いいえ | フロントエンドが別オリジンにある場合のみ必要 |
| `BOOTSTRAP_ADMIN_*` | 初回起動時 | 最初のスーパー管理者を作成 |
| `APP_TIMEZONE` | いいえ | スケジューラのタイムゾーン。既定は `Asia/Colombo` |
| `MAIL_*`, `MAIL_FROM` | いいえ | SMTP での送信。`MAIL_HOST` を空にするとログ出力になる |
| `JAVA_TOOL_OPTIONS` | いいえ | `-XX:MaxRAMPercentage=60 -XX:+UseSerialGC` で 512 MB 環境での OOM 強制終了を防ぐ |
| `PORT` | ホストが設定 | サーバーのポート。既定は `8080` |

## ローカル開発

バックエンド（Java 21、Maven、PostgreSQL が必要）：

```bash
cd backend
export DB_URL='jdbc:postgresql://localhost:5432/postgres'
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
mvn spring-boot:run          # http://localhost:8080
```

PowerShell では `export` の代わりに `$env:DB_URL='...'` を使います。

フロントエンド（Node 22 + pnpm 10.34.3 が必要）：

```bash
cd frontend
pnpm install
pnpm dev                     # http://localhost:8443。localhost:8080 の API を使用
```

開発中のアプリを別の API ホストに向けるには、`frontend/.env.local` の `VITE_API_URL` を設定します。空の値は「同じオリジン」を意味します。

## NestJS バックエンド（backend-nest）

`backend-nest/` には、同じ API を NestJS で作り直したバックエンドがあります。同じ PostgreSQL スキーマを使い、Web アプリと AlchemyX Connect（スマートフォンアプリ）はそのまま動作します。起動方法、テスト、環境変数の詳細は [backend-nest/README.ja.md](./backend-nest/README.ja.md) を参照してください。

```bash
cd backend-nest
npm install
npm run build
npm start                    # .env を読み込み、既定ポートは 8080
```

## 別ホストで運用する場合

ホスト別の Dockerfile（`backend/Dockerfile`、`frontend/Dockerfile` と `nginx.conf`）は、UI を静的ホスティング（例：Cloudflare Pages）に置き、API を別のサービスとして動かす場合にも使えます。その場合は、フロントエンドを `VITE_API_URL=https://<api-host>` でビルドし、バックエンドに `CORS_ALLOWED_ORIGINS=https://<ui-host>` を設定してください。

## CI

`.github/workflows/ci.yml` は、`main` への push のたびに、バックエンドのテスト、フロントエンドの型チェックとビルドを実行し、統合 Docker イメージをビルドします。
