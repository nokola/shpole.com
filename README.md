# Shpole

## Developing

`npm i`, then start a development server:

```sh
npm run dev:full

```

## Deploy
```sh
fly deploy
```

## Building

To create a production version of your app (perhaps for analysis):

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Overwrite database in prod

```sh
flyctl ssh console --app shpole
rm /app/data/shpole.db
exit
flyctl ssh sftp put data/shpole.db  /app/data/shpole.db --app shpole
```

## Copy database from production

```sh
rm data/shpole.db && flyctl ssh sftp get /app/data/shpole.db data/shpole.db --app shpole
```
