'use strict';

/* ========================================================
            ENCRYPTION / DECRYPTION
   ======================================================== */

const Subtle = window.crypto.subtle;
async function pbkdf2(password, salt, forEncryption) {
  var pwUtf8 = new TextEncoder().encode(password);
  var pwHash = await Subtle.digest('SHA-256', pwUtf8);
  return await Subtle.deriveKey(
    {'name': 'PBKDF2', 'salt': salt, 'iterations': 100000, 'hash': 'SHA-256'},
    await Subtle.importKey('raw', pwHash, {'name': 'PBKDF2'}, false, ['deriveKey']),
    {'name': 'AES-GCM', 'length': 256},
    false,
    [forEncryption ? 'encrypt' : 'decrypt']
  );
}
async function encrypt(password, plaintext) {
  var salt = window.crypto.getRandomValues(new Uint8Array(12));
  var key = await pbkdf2(password, salt, true);

  var ptUtf8 = new TextEncoder().encode(plaintext);
  var iv = window.crypto.getRandomValues(new Uint8Array(12));
  var ciphertext = await Subtle.encrypt({'name': 'AES-GCM', 'iv': iv}, key, ptUtf8);

  return [salt, iv, ciphertext];
}
async function decrypt(password, salt, iv, ciphertext) {
  var key = await pbkdf2(password, salt, false);

  var ptUtf8 = await Subtle.decrypt({'name': 'AES-GCM', 'iv': iv}, key, ciphertext);

  return new TextDecoder().decode(ptUtf8);
}


/* ========================================================
            DOWNLOADING A MODIFIED VERSION OF THIS PAGE
   ======================================================== */

function download(filename, text) {
  // source: https://stackoverflow.com/a/18197511/8877656
  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  pom.setAttribute('download', filename);

  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  }
  else {
    pom.click();
  }
}

function downloadThisPageWithNewPayload(salt, iv, ciphertext) {
  var $salt       = document.getElementById('payload-salt');
  var $iv         = document.getElementById('payload-iv');
  var $ciphertext = document.getElementById('payload-ciphertext');
  var $plaintext  = document.getElementById('plaintext');
  var $password   = document.getElementById('password');

  var oldSalt       = $salt        .innerText;
  var oldIV         = $iv          .innerText;
  var oldCiphertext = $ciphertext  .innerText;
  var oldPlaintext  = $plaintext   .value;
  var oldPassword   = $password    .value;

  $salt      .innerText = JSON.stringify(Array.from(salt));
  $iv        .innerText = JSON.stringify(Array.from(iv));
  $ciphertext.innerText = JSON.stringify(Array.from(new Uint8Array(ciphertext)));
  $plaintext .innerText = ''; $plaintext.value = '';
  $password  .innerText = ''; $password.value = '';

  var html = document.getElementsByTagName('html')[0].outerHTML;

  download('encryptdecrypt.html', html);

  $salt      .innerText = oldSalt;
  $iv        .innerText = oldIV;
  $ciphertext.innerText = oldCiphertext;
  $plaintext .value     = oldPlaintext;
  $password  .value     = oldPassword;
}

async function tryDecrypt() {
  var salt       = new Uint8Array(JSON.parse(document.getElementById('payload-salt')      .innerText));
  var iv         = new Uint8Array(JSON.parse(document.getElementById('payload-iv')        .innerText));
  var ciphertext = new Uint8Array(JSON.parse(document.getElementById('payload-ciphertext').innerText)).buffer;
  // debugger
  if (document.getElementById('plaintext').value !== '') {
    alert('refusing to overwrite text present in plaintext area; delete it if you really want to');
    return;
  }
  var pw = document.getElementById('password').value;
  try {
    var plaintext = await decrypt(pw, salt, iv, ciphertext);
    document.getElementById('plaintext').value = plaintext;
    document.getElementById('password').classList.remove('wrong');
    document.getElementById('password').classList.add('right');
  } catch (reason) {
    document.getElementById('password').classList.remove('right');
    document.getElementById('password').classList.add('wrong');
  }
}

async function onEncryptAndDownloadButtonClick() {
  var pw = document.getElementById('password').value;
  var plaintext = document.getElementById('plaintext').value;
  var salt, iv, ciphertext;
  [salt, iv, ciphertext] = await encrypt(pw, plaintext);

  try {
    var decrypted = await decrypt(pw, salt, iv, ciphertext)
    if (decrypted === plaintext) {
      downloadThisPageWithNewPayload(salt, iv, ciphertext);
    } else {
      alert('decrypt(encrypt(message)) was not identical! What the heck?');
    }
  } catch (reason) {
    alert('decryption failed: ' + reason);
  };
}

window.addEventListener('load', () => {
  var $pw = document.getElementById('password')
  document.getElementById('password').addEventListener('input', (e) => {
    if (document.getElementById('plaintext').value === '') {
      tryDecrypt();
    }
  });
  document.getElementById('download-button').addEventListener('click', () => {
    onEncryptAndDownloadButtonClick();
  });
});
