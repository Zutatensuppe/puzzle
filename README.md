![ci](https://github.com/Zutatensuppe/puzzle/actions/workflows/ci.yml/badge.svg)
[![StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)

# Puzzle

This is a multiplayer puzzle game running in the browser.
See a live version at [jigsaw.hyottoko.club].
You can also join the [jigsaw.hyottoko.club discord](https://discord.gg/uFGXRdUXxU).

# Get Started

Note: node `^20.5.0` and npm `^9.8.0` are required. You can try with
lower versions, but it may not work.

## Development

Install the dependencies and prepare a config.json:

```shell
npm run setup
```

Start the dev database (postgres) via:

```shell
docker-compose up
```

For development it makes sense to run both the dev server and dev frontend
in separate shells.

```shell
cd server
npm start
```

```shell
cd frontend
npm start
```

The frontend script will output something like:

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

## Build

Build the app for production:

```shell
npm run build:app
```

Then start the app using the built files with:

```shell
node build/server/main.js
```

## Scripts

There are other `run` scripts:

command                | explanation
-----------------------|----------------------------------------
`npm run build`        | builds the sources
`npm run lint`         | runs lint checks
`npm run test`         | runs tests
`./run ts [...ARGS]`   | run `node`, but with ts files. eg `./run ts scripts/create_user.ts`

[jigsaw.hyottoko.club]: https://jigsaw.hyottoko.club
