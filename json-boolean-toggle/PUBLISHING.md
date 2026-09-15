# Publishing Guide

## One-Time Setup

1. Create or select a publisher in the Visual Studio Marketplace publisher management portal.
2. Replace `your-publisher-id` in `package.json` with the exact publisher ID.
3. Add the public repository, homepage, and issue tracker URLs to `package.json` after the repository exists.
4. Configure the authentication method currently supported by the Visual Studio Marketplace. Never commit publishing credentials.

## Release Checklist

1. Update the version in `package.json` and `CHANGELOG.md`.
2. Run `npm ci`.
3. Run `npm run check`.
4. Run `npm run package`.
5. Install the generated VSIX in a clean Visual Studio Code profile and verify JSON and JSONC files manually.
6. Inspect the package contents with `npx vsce ls`.
7. Publish with `npm run publish`.

The Marketplace icon is stored at `images/icon.png`. It is a PNG larger than the required 128 by 128 pixels.
