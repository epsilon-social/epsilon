// Registers the <altcha-widget> Web Component (bundles English strings
// and the PBKDF2/SHA proof-of-work workers as inline blobs)
import 'altcha';
// French strings, auto-selected from <html lang>. The altcha exports map
// declares types for ./i18n/* at dist/external/*.d.ts, which does not exist
// for locale files (upstream packaging bug): the TypeScript resolver cannot
// resolve the subpath, but Vite resolves the runtime file fine.
// eslint-disable-next-line import/no-unresolved, import/extensions
import 'altcha/i18n/fr-fr';
