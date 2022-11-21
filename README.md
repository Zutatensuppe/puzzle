![ci](https://github.com/Zutatensuppe/puzzle/actions/workflows/ci.yml/badge.svg)
[![StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)

# Puzzle

This is a multiplayer puzzle game running in the browser.
See a live version at [jigsaw.hyottoko.club].

# Get Started

Note: node `^17.4.0` and npm `^8.1.0` are required. You can try with
lower versions, but it may not work.

## Quick start

1. Install dependencies:

    ```shell
    npm ci
    ```

2. Prepare config file:

    ```shell
    cp config.example.json config.json
    # or on windows:
    Copy-Item config.example.json config.json
    ```

    Adjust the config as needed. For development no adjustments are required.

3. Launch the app in dev mode:

    ```shell
    npm run dev-services
    npm run dev-server
    npm run dev-frontend
    ```

A database has to be setup and running separately. By default
the script will connect via `postgresql://hyottoko:hyottoko@localhost:5434/hyottoko`.
This can be adjusted in the `config.json`.

## Manual start

There are other `run` scripts:

command                | explanation
-----------------------|----------------------------------------
`npm run build`        | builds the sources
`npm run server`       | runs the server with built files
`npm run test`         | runs tests
`npm run dev-services` | runs the dev services (eg. database)
`npm run dev-server`   | runs the dev server (from unbuilt files)
`npm run dev-frontend` | runs the dev frontend (with hmr and such)
`./run ts [...ARGS]`   | run `node`, but with ts files. eg `./run ts scripts/import_images.ts`

## Build

Build the app:

```shell
npm run build
```

Then start the app using the built files with:

```shell
npm run server
```

## Dev

Start the dev database (postgres) via:

```shell
npm run dev-services
```

For development it makes sense to run both `dev-server` and `dev-frontend`
in separate shells.

```shell
npm run dev-server
npm run dev-frontend
```

The dev-frontend script will output something like:

```shell
  vite v2.3.3 dev server running at:

  > Local: http://localhost:3000/
  > Network: use `--host` to expose

  ready in 465ms.
```

Try opening the url that is output.
The frontend will proxy the following to the dev server:

- api
- image serving
- image uploading

The frontend on its own will have hot module reload (HMR) available
in this mode. Try changing a file inside `src/frontend` and see it
update without running an extra command.

The server will restart when a change is made on the server code.

Then open the url output by the dev-frontend command, eg. `http://localhost:3000`.

[jigsaw.hyottoko.club]: https://jigsaw.hyottoko.club
