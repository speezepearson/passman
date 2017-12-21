'use strict';

import Payload from './payload.js';
import downloadThisPageWithNewPayload from './download.js';

async function tryDecrypt(payload) {
  if (document.getElementById('plaintext').value !== '') {
    alert('refusing to overwrite text present in plaintext area; delete it if you really want to');
    return;
  }
  var pw = document.getElementById('password').value;
  try {
    var plaintext = await payload.decrypt(pw);
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
  var payload = await Payload.create({'name': 'AES-GCM', 'length': 256}, pw, plaintext);
  var serializedPayload = payload.serialize();

  try {
    var decrypted = await Payload.deserialize(serializedPayload).decrypt(pw);
    if (decrypted === plaintext) {
      downloadThisPageWithNewPayload(serializedPayload);
    } else {
      alert('decrypt(encrypt(message)) was not identical! What the heck?');
    }
  } catch (reason) {
    alert('decryption failed: ' + reason);
  };
}

window.addEventListener('load', () => {

  var originalPayload = Payload.deserialize(document.getElementById('payload').innerText);

  var $pw = document.getElementById('password')
  $pw.focus();
  document.getElementById('password').addEventListener('input', (e) => {
    if (document.getElementById('plaintext').value === '') {
      tryDecrypt(originalPayload);
    }
  });
  document.getElementById('download-button').addEventListener('click', () => {
    onEncryptAndDownloadButtonClick();
  });
});
