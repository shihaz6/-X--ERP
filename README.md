# 業務管理システム（ERP）

受注管理、顧客管理、プロジェクト管理、請求・入金、定期契約、勤怠（タイムシート）、休暇申請、文書管理、レポートをまとめて扱う業務システムです。

## 構成

- `backend-nest/` — API（NestJS / TypeScript / PostgreSQL）。詳細は [backend-nest/README.ja.md](./backend-nest/README.ja.md) を参照。
- `frontend/` — Web アプリ（React 19 / Vite / Tailwind）。静的ファイルとしてビルド。
- `mobile/` — Android アプリ（Capacitor で Web アプリを包んだもの）。

## ローカルで起動する

プロジェクトのルートで次のコマンドを実行すると、API と Web アプリが同時に起動します。

```bash
npm start
```

- API の設定は `backend-nest/.env`（`backend-nest/.env.example` を参考に作成）。
- Web アプリの API の向き先は `frontend/.env.local` の `VITE_API_URL` で指定します。
- API の `CORS_ALLOWED_ORIGINS` に、Web アプリのオリジン（例：`http://localhost:8443`）を含めてください。

## 本番環境へのデプロイ

- API：Vercel（`backend-nest/vercel.json`）。定期ジョブは Vercel Cron で実行します。
- Web アプリ：Vercel の静的サイト（`frontend/`）。
- データベース：PostgreSQL（Neon）。

環境変数の一覧は `backend-nest/.env.example` を参照してください。秘密情報（接続文字列、パスワード、Cron の共有シークレット）はリポジトリに含めず、ホスティング先の環境変数に設定してください。

## CI

`.github/workflows/ci.yml` は `main` への push と Pull Request ごとに、API の型チェック・テスト・ビルド・Docker イメージ作成と、Web アプリの型チェック・ビルド・Docker イメージ作成を実行します。
