# what-the-tile

See where are tiles for each zoom level.

![image](https://user-images.githubusercontent.com/11202803/88530320-7e41af00-d001-11ea-9c9d-f78c76a96a1f.png)

## インストール
npm install

## ローカルで確認する場合
npm run dev
http://192.168.150.44:9966/?auth_debug

## ビルド
npm run build

## デプロイ
このリポジトリは `GitHub Pages` ではなく `Netlify` へデプロイする前提です。

- `GitHub` に push
- `Netlify` がリポジトリ更新を検知
- `npm run build` を実行
- `docs/` を公開

`Netlify` 側ではこのリポジトリを接続したうえで、`netlify.toml` の設定を使ってデプロイしてください。

GitHub 側の `Pages` 設定や `docs/CNAME` には依存しません。独自ドメインを使う場合は `Netlify` 側で設定します。
