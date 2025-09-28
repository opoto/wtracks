/*
 * Simple lib to encrypt / decrypt a text with a password. Encrypted form is base64 encoded.
 * Requires WebCrypto API, TextEncoder/TextDecoder and Promise (>= ES6)
 */


/**
 * Check if required dependencies are available
 */
export function isCryptoSupported() {
  let supported = false;
  try {
    supported = crypto && crypto.subtle && crypto.subtle.importKey && crypto.subtle.digest &&
      crypto.getRandomValues && crypto.subtle.encrypt && crypto.subtle.decrypt &&
      TextEncoder && TextDecoder && Promise && atob && btoa &&
      Array && Array.from && Array.prototype.map && Uint8Array && String &&
      String.fromCharCode && Math && Math.random ? true : false;
  } catch (err) {
    console.error(err);
  }
  return supported;
}

 /**
  * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
  * based on: https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
  * (c) Chris Veness MIT Licence
  *
  * @param   {String} plaintext - Plaintext to be encrypted.
  * @param   {String} password - Password to use to encrypt plaintext.
  * @returns {Object}  { iv, ciphertext }
  *
  * @example
  *   var ciphertext = await aesGcmEncrypt('my secret text', 'pw');
  *   aesGcmEncrypt('my secret text', 'pw').then(function(ciphertext) { console.log(ciphertext); });
  */
export function aesGcmEncrypt(plaintext, password) {
  return new Promise(function (resolve, reject) {
    const pwUtf8 = new TextEncoder().encode(password);                                 // encode password as UTF-8
    let alg = { name: 'AES-GCM' };

    return crypto.subtle.digest('SHA-256', pwUtf8)                                     // hash the password
    .then( function(pwHash) {

      const iv = crypto.getRandomValues(new Uint8Array(12));                           // get 96-bit random iv

      alg.iv = iv;                                                                     // specify algorithm to use

      return crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']);          // generate key from pw

    })
    .then( function(key) {

      const ptUint8 = new TextEncoder().encode(plaintext);                             // encode plaintext as UTF-8
      return crypto.subtle.encrypt(alg, key, ptUint8);                                 // encrypt plaintext using key

    })
    .then( function(ctBuffer) {

      const ctArray = Array.from(new Uint8Array(ctBuffer));                            // ciphertext as byte array
      const ctStr = ctArray.map(function(byte) { return String.fromCharCode(byte); } ).join('');           // ciphertext as string
      const ctBase64 = btoa(ctStr);                                                    // encode ciphertext as base64

      const ivHex = Array.from(alg.iv).map(function(b) { return ('00' + b.toString(16)).slice(-2); } ).join(''); // iv as hex string

      resolve({ iv:ivHex, ciphertext:ctBase64 });                                      // return {iv,ciphertext}

    });
  });
}


 /**
  * Decrypts ciphertext encrypted with aesGcmEncrypt() using supplied password.
  * based on: https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
  * (c) Chris Veness MIT Licence
  *
  * @param   {String} ciphertext - Ciphertext to be decrypted.
  * @param   {String} password - Password to use to decrypt ciphertext.
  * @returns {String} Decrypted plaintext.
  *
  * @example
  *   let plaintext = await aesGcmDecrypt(ciphertext, 'pw');
  *   aesGcmDecrypt(ciphertext, 'pw').then(function(plaintext) { console.log(plaintext); });
  */
export function aesGcmDecrypt(ciphertext, iv, password) {
  return new Promise(function (resolve, reject) {
    // encode password as UTF-8
    const pwUtf8 = new TextEncoder().encode(password);
    let alg = { name: 'AES-GCM' };
    // hash the password
    return crypto.subtle.digest('SHA-256', pwUtf8)
    .then(function(pwHash){

      // convert iv to bytes
      iv = iv.match(/.{2}/g).map(function(byte) { return parseInt(byte, 16); });

      // specify algorithm to use
      alg.iv = new Uint8Array(iv);

              // use pw to generate key
      return crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']);

    })
    .then(function(key){
      // decode base64 ciphertext
      const ctStr = atob(ciphertext);
      // ciphertext as Uint8Array
      const ctUint8 = new Uint8Array(ctStr.match(/[\s\S]/g).map(function(ch) { return ch.charCodeAt(0); } ));

      // decrypt ciphertext using key
      return crypto.subtle.decrypt(alg, key, ctUint8);
    })
    .then(function(plainBuffer){
      // decode password from UTF-8
      const plaintext = new TextDecoder().decode(plainBuffer);

      // return the plaintext
      resolve(plaintext);
    });
  });
}
