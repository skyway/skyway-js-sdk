# SkyWayJS

## Setting up

Use `npm install` to set up dependencies.

```sh
# run eslint
npm run lint

# run all unit tests
npm run test # OR npm test OR npm t

# build the library
npm run build
```

## Examples

You can use `/examples` directory for checking your development code.

Follow these steps.

- Put your key
  - e.g.) `echo "window.__SKY_WAY_KEY__ = '<YOUR_KEY_HERE>';" > ./examples/key.js`
- Start server on project root
  - e.g.) `python -m SimpleHTTPServer 8000`

## Contributing

Make sure you have nodejs installed. Run `npm install` to get started.

After making changes in `src/`, you run

- `npm run lint` to validate
- `npm test` to run tests

then the `npm run build` and build `eclwebrtc(.min).js` which is stored in `dist` directory!
