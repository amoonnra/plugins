# Publishing Guide

## Before Publishing

1. Replace `your-publisher-id` in `package.json` with the exact Marketplace publisher ID.
2. Add repository, homepage, and issue tracker metadata.
3. Clearly retain the unsupported patch warning in the Marketplace description.
4. Verify install and restore operations on Windows, macOS, and Linux.
5. Never commit publishing credentials.

## Release Checklist

```bash
npm ci
npm run check
npm run package
npx vsce ls
```

Install the generated VSIX in a clean profile, explicitly run the install command, verify JSON and JSONC toggling, restore the original workbench, and only then publish.
