# 業務管理 API（NestJS）

業務管理システムの API です（NestJS / TypeScript）。PostgreSQL（本番は Neon）を使い、`/api` の仕様は Web アプリと Android アプリが使うものと同じです。

英語版は [README.md](./README.md) を参照してください。

## 起動方法

`backend-nest` フォルダで次の順に実行します。

```bash
npm install                   # 初回のみ：依存パッケージをインストール
cp .env.example .env          # .env を作成し、DATABASE_URL などを記入（.env は Git に含めない）
npm run build                 # TypeScript をビルド
npm start                     # 起動。先にマイグレーションを実行してから API が待ち受けます（既定は $PORT、未指定なら 8080）
```

- `npm start` は `.env` を自動で読み込みます。
- `npm run dev` はビルドと起動を一度に行います。
- 停止するには、起動したターミナルで `Ctrl+C` を押します。
- 動作確認は `http://localhost:<PORT>/api/health` にアクセスします。`{"status":"ok"}` が返れば起動しています。

### 初回起動（データベースが空の場合）

`members` テーブルが空のとき、`BOOTSTRAP_ADMIN_USERNAME`、`BOOTSTRAP_ADMIN_EMAIL`、`BOOTSTRAP_ADMIN_PASSWORD` の 3 つを設定して起動すると、最初のスーパー管理者が作成されます。作成後は、これらの変数を `.env` から削除してください。

### マイグレーションだけを実行する場合

```bash
npm run migrate
```

`migrations/` にある SQL ファイルは Spring プロジェクトの Flyway ファイルと同じものです。Flyway で適用済みのデータベースは `flyway_schema_history` テーブルから認識され、同じ変更を二重に適用することはありません。

## テスト

```bash
npm test                      # 単体テスト（日付、入力検証、権限、書式、エラー変換、設定の読み込み）
```

起動中の API に対するエンドツーエンドのスモークテスト：

```bash
BASE=http://localhost:8080 node test/e2e/smoke.mjs
```

> **注意：** スモークテストはテストデータを作成します。本番（Neon）のデータベースには絶対に実行しないでください。空の開発用データベースで使用してください。想定している初期アカウントは `test.admin` / `test-password-123` です。

スモークテストでは、サインイン、顧客、プロジェクト、受注、請求書と入金、PDF、定期契約、タイムシート、休暇、ドキュメントとバージョン、設定、分析、ワークスペースの取得、ロールごとのアクセス制限を確認します。

## 環境変数

主な設定は `.env.example` にまとめてあります。

| 変数 | 内容 |
|---|---|
| `DATABASE_URL` | PostgreSQL の接続文字列（Neon の場合は `?sslmode=require` を付ける） |
| `PORT` | 待ち受けポート（既定 8080） |
| `APP_TIMEZONE` | 業務日付の基準タイムゾーン（既定 `Asia/Colombo`） |
| `CORS_ALLOWED_ORIGINS` | API を呼び出せるオリジン（カンマ区切り） |
| `SESSION_TTL` | セッションの有効期間（例：`12h`） |
| `FRONTEND_URL` | パスワード再設定メールのリンクに使う URL |
| `MAIL_*` | SMTP の設定。`MAIL_HOST` を空にすると、メールは送信せずログに出力されます |
| `BILLING_CRON` / `OVERDUE_CRON` | 定期請求（既定 毎日 06:00）と期限超過の通知（既定 毎日 07:00） |
| `RUN_MIGRATIONS` | 起動時にマイグレーションを実行するか（既定 `true`） |

## 旧 Spring 版との互換性（移行時の確認内容）

- 業務 API 57 本について、パス、メソッド、リクエストとレスポンスの形式が Spring 版と一致しています（ヘルスチェック `/api/health` は追加分）。
- エラーの形式（`{"error": "..."}`）とステータスコードも同じです。データベースの制約違反は 409 を返します。
- 権限ルール、業務ルール、監査ログも Spring 版と同じです。
- 請求書番号は `{YYYY}` 付きの接頭辞と連番で、トランザクションごとに採番がロックされます。
- パスワードは BCrypt のため、既存のアカウントはそのまま使えます。セッションは不透明なトークンで、保存時は SHA-256 のハッシュのみを保持します。
- 定期請求（毎日 06:00）と期限超過の通知（毎日 07:00）は、ワークスペースのタイムゾーンで実行されます。

## まだ含まれていないもの

- Web アプリの静的ファイルの配信。Web アプリは別途ホストしてください（ルートの README を参照）。
