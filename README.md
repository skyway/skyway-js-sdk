# SkyWay JS

## Examples

You can use `/examples` directory for checking your development code.

Follow these steps.

- Modify your key
  - e.g.) `sed -i -e "s/<YOUR_KEY_HERE>/12341234-abcd-1234-abcd-1234567890ab/g" examples/key.js`
  - The key can be obtained from https://webrtc.ecl.ntt.com/en/ .
- Start server on project root
  - e.g.) `python -m SimpleHTTPServer 8000`

## Contributing

### Setting up

Make sure you have nodejs installed. Run `npm install` to get started and to set up dependencies.

```sh
# run eslint
npm run lint

# run all unit tests
npm run test # OR npm test OR npm t

# build the library
npm run build
```

After making changes in `src/`, you run

- `npm run lint` to validate
- `npm test` to run tests

then the `npm run build` and build `skyway(.min).js` which is stored in `dist` directory!
