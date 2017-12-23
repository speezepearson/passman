'use strict';

import EncryptedMessage from './encrypted_message.js';
import downloadThisPageWithNewEncryptedMessage from './download.js';
import copyToClipboard from './copy_to_clipboard.js';

async function onDecryptButtonClick() {
  var pw = document.getElementById('password').value;
  var encryptedMessage = EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText);
  try {
    window.plaintext = await encryptedMessage.decrypt(pw);
    document.getElementById('password').classList.remove('wrong');
    document.getElementById('password').classList.add('right');
  } catch (err) {
    console.log(err);
    document.getElementById('password').classList.remove('right');
    document.getElementById('password').classList.add('wrong');
  }
}

async function onEncryptAndDownloadButtonClick() {
  var pw = document.getElementById('password').value;
  var encryptedMessage = await EncryptedMessage.create(pw, window.plaintext);
  window.m = encryptedMessage
  if (window.plaintext === await (EncryptedMessage.deserialize(encryptedMessage.serialize()).decrypt(pw))) {
    downloadThisPageWithNewEncryptedMessage(encryptedMessage);
  } else {
    alert('decrypt(encrypt(message)) was not identical! What the heck?');
  }
}

window.addEventListener('load', () => {

  var originalEncryptedMessage = EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText);

  var $pw = document.getElementById('password');
  $pw.focus();
  document.getElementById('decrypt-button').addEventListener('click', onDecryptButtonClick);
  document.getElementById('download-button').addEventListener('click', onEncryptAndDownloadButtonClick);

  document.getElementById('copy-button').addEventListener('click', () => {
    if (window.plaintext !== undefined) {
      copyToClipboard(window.plaintext);
    } else {
      alert('message is not decrypted');
    }
  });
});
