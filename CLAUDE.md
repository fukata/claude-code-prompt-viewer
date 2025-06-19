# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Claude Code Prompt Viewerは、Claude Codeで入力したプロンプトとレスポンスをブラウザで閲覧するためのNode.js製ツールです。完全オフラインで動作し、外部への情報送信は一切行いません。

## 開発コマンド

### サーバー起動
```bash
# デフォルトポート(3000)で起動
npm start

# 環境変数でカスタマイズ
PORT=8080 npm start
CLAUDE_DIR=/custom/path npm start
CLAUDE_DIR=/custom/path PORT=8080 npm start
```

### 依存関係インストール
```bash
npm install
```

## アーキテクチャ

### ディレクトリ構造
- `src/server.js` - Express.jsサーバー。Claude設定ディレクトリ(~/.claude)からJSONLファイルを読み込むAPI
- `public/` - フロントエンド静的ファイル
  - `index.html` - メインHTML
  - `app.js` - フロントエンドロジック（プロジェクト/セッション管理、メッセージ表示、検索、テーマ切り替え）
  - `styles.css` - CSS変数ベースのテーマシステム（ライト/ダークモード対応）

### データフロー
1. サーバーは`CLAUDE_DIR`（デフォルト: ~/.claude）の`projects/`ディレクトリを読み込む
2. プロジェクトごとにJSONLファイル（セッション）が格納されている
3. 各JSONLファイルには、Claude Codeの会話履歴が行単位のJSONで記録されている
4. フロントエンドは以下のAPIエンドポイントを使用:
   - `GET /api/projects` - プロジェクト一覧取得
   - `GET /api/project/:projectId/sessions` - セッション一覧取得
   - `GET /api/project/:projectId/session/:sessionId` - メッセージ取得

### 主要機能の実装箇所

**URL状態管理** (`app.js`)
- `updateURL()` - プロジェクト/セッション選択時にURLパラメータを更新
- `loadProjects()` - 初期ロード時にURLパラメータから状態を復元

**検索・フィルタリング** (`app.js`)
- `filterAndDisplayMessages()` - キーワード検索とツールメッセージフィルタリング
- `getMessageText()` - メッセージから検索対象テキストを抽出

**永続化** (`app.js`)
- テーマ設定: `localStorage.theme`
- フィルター設定: `localStorage.hideToolMessages`

**テーマシステム** (`styles.css`)
- CSS変数で色を定義（`:root`と`[data-theme="dark"]`）
- `app.js`の`toggleTheme()`で切り替え

## 環境変数

- `PORT` - サーバーポート番号（デフォルト: 3000）
- `CLAUDE_DIR` - Claude設定ディレクトリパス（デフォルト: ~/.claude）

## メッセージタイプ

JSONLファイル内のメッセージは以下のタイプがある:
- `type: "user"` - ユーザーからのメッセージ
- `type: "assistant"` - アシスタントからのメッセージ
- `toolUseResult` - ツール実行結果

各メッセージには`timestamp`、`uuid`、`sessionId`などのメタデータが含まれる。