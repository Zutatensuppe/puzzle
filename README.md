![ci](https://github.com/Zutatensuppe/puzzle/actions/workflows/ci.yml/badge.svg)
[![StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)

# Puzzle

This is a multiplayer puzzle game running in the browser.
See a live version at [jigsaw.hyottoko.club].

# Get Started

Note: node `^17.4.0` and npm `^8.1.0` are required. You can try with
lower versions, but it may not work.

## Quick start

This will install the dependencies, execute build and start the server.

```sh
./run start
```

A database has to be setup and running separately. By default
the script will connect via `postgresql://hyottoko:hyottoko@localhost:5434/hyottoko`.
This can be adjusted in the `config.json`.

## Manual start

There are other `run` scripts:

command              | explanation
---------------------|----------------------------------------
`./run install`      | installs dependencies and sets up a config if none exists
`./run build`        | builds the sources
`./run server`       | runs the server with built files
`./run tests`        | runs tests
`./run start`        | combination of `install`, `build` and `server`
`./run dev-services` | runs the dev services (eg. database)
`./run dev-server`   | runs the dev server (from unbuilt files)
`./run dev-frontend` | runs the dev frontend (with hmr and such)
`./run ts [...ARGS]` | run `node`, but with ts files. eg `./run ts scripts/import_images.ts`

## Dev

Start the dev database (postgres) via:

```sh
./run dev-services
```

For development it makes sense to run both `dev-server` and `dev-frontend`
in separate shells.

```sh
./run dev-server
./run dev-frontend
```

The dev-frontend script will output something like:

```sh
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
