// @ts-check

/**
 * Where the app finds its server and which Google sign-in client it is. Both are public by
 * nature: the server refuses every request without a listed user's Google sign-in. Set at setup (README).
 */
export const CONFIG = Object.freeze({
  /** The Apps Script API deployment's URL, ending /exec. */
  apiUrl: 'https://script.google.com/macros/s/AKfycbzeR2qbD14RQVSA0vVUcfKs-nm1JxwGqk183eKyso1DBCbD5RxkqwNuRVDZ6Q6mCEQeMw/exec',
  /** The OAuth client ID from Google Cloud, ending .apps.googleusercontent.com. */
  clientId: '558653473092-ltcjl3vevvo8is49of49hovo7tcsshho.apps.googleusercontent.com',
  /** Prefix of this app's localStorage keys: the three apps share one origin (github.io). */
  storage: 'ha',
  /**
   * What kind each action is (app-kit's api.js). `reads` only read: they give up after 20 seconds, and
   * the saved copy stays on screen. `slow` take long by nature: one try of three minutes. Everything
   * else is a save: an id, 12 seconds, then one automatic retry with the same id (ADR-017).
   */
  waits: Object.freeze({ reads: Object.freeze(['sync.pull', 'system.check']), slow: Object.freeze(['backup.import']) }),
});
