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
});
