import _getGlobals from './globals.js'; var globals = _getGlobals();
globals.window = window;
globals.document = document;

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import { SecretStore } from './secret_store.js';
import { Flasher } from './flash.js';
import copyToClipboard from './copy_to_clipboard.js';
import EncryptedMessage from './encrypted_message.js';
import { parseQuery } from './query.js';

var decryptedJ = null;

var flasher;

function obliterate(x) {
  if (Array.isArray(x)) {
    while (x.length > 0) {
      obliterate(x[x.length-1]);
      x.pop();
    }
  } else if (typeof x === 'object') {
    Object.entries(x).forEach(([k,v]) => {
      obliterate(v);
      delete x[k];
    });
  }
}

function only(xs) {
  if (xs.length !== 1) {
    throw `expected 1 thing, got ${xs.length}: ${JSON.stringify(xs)}`
  }
  return xs[0];
}

function updateView() {
  var [accountRE, fieldRE] = ['account', 'field'].map(f => parseQuery(document.getElementById(`copy-field--${f}`).value));
  document.getElementById('view-holder').innerHTML = '';
  document.getElementById('view-holder').appendChild(j.filter(accountRE, fieldRE).buildView());
}

var j = new SecretStore({});
var decryptedJFingerprint = null;


function thereAreUnsavedChanges() {
  return (j.nAccounts() > 0) && (decryptedJFingerprint !== j.fingerprint());
}
async function decrypt() {

  var em = EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText);
  var plaintext;
  try {
    plaintext = await em.decrypt(document.getElementById('password').value);
  } catch (err) {
    flasher.flash(document.getElementById('password'), 'red', `
      Tried to decrypt the ciphertext in this HTML file, but password was incorrect.
      (error: ${err})
    `);
    document.getElementById('password').focus();
    return;
  }
  var decryptedJ = new SecretStore(JSON.parse(plaintext));
  decryptedJFingerprint = decryptedJ.fingerprint();
  j.foldIn(decryptedJ);
  updateView();
  document.getElementById('copy-field--account').focus();
  flasher.flash(document.getElementById('decrypt-button'), 'lightgreen', `
    Decrypted the ciphertext embedded in this HTML file, and merged it into working memory.
  `);
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(j.data, null, 2));
  flasher.flash(document.getElementById('copy-plaintext-button'), 'lightgreen', `
    Copied entire working memory to clipboard, as JSON.
  `);
}
function copyCiphertext() {
  copyToClipboard(JSON.stringify(EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText).toJSONFriendlyObject()));
}
async function save() {
  var password = document.getElementById('password').value;
  var shouldContinue = true;
  var oldJ;
  try {
    oldJ = JSON.parse(await EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText).decrypt(password));
  } catch (err) {
    if (err.name !== 'OperationError') {
      flasher.flash(document.getElementById('save-button'), 'red', `
        Something REAL WEIRD happened while checking whether the password you entered matched the one for this file.
        This should never happen.
      `);
      throw err;
    }
    shouldContinue = confirm("You are about to download a passman file with a different password than the original one! Is that what you want?");
  }
  if (!shouldContinue) {
    flasher.flash(document.getElementById('save-button'), 'red', 'Would have saved, but you aborted.');
    return;
  }

  if (password.length < 6) {
    shouldContinue = confirm(`You password is only ${password.length} characters long. I won't stop you, but please, MAKE REAL SURE THIS IS INTENTIONAL before saving.`);
  }
  if (!shouldContinue) {
    flasher.flash(document.getElementById('save-button'), 'red', 'Would have saved, but you aborted.');
    return;
  }

  var em = await EncryptedMessage.create(password, JSON.stringify(j.data));
  downloadThisPageWithNewEncryptedMessage(em);
  flasher.flash(document.getElementById('save-button'), 'lightgreen', `
    Downloaded a clone of this HTML file, except the ciphertext encodes this page's current working memory.
  `);
}

function onEnter(element, callback) {
  element.addEventListener('keypress', (event) => {
    if (event.keyCode === 13) {
      callback(event);
    }
  });
}
async function importCiphertext() {
  var file = document.getElementById('import-ciphertext-file').files[0];
  if (file === undefined) {
    flasher.flash(document.getElementById('import-ciphertext-file'), 'red', `
      Tried to merge the ciphertext from another Passman file into working memory,
      but no file was selected.
    `);
    return;
  }
  var html = await new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        resolve(e.target.result);
      } catch (err) {
        $this.fileInput.value = [];
        reject(err);
      }
    }
    reader.readAsText(file);
  });

  var doc = flasher.doOrFlashRed(
    () => {doc = new DOMParser().parseFromString(html, 'text/html')},
    document.getElementById('import-ciphertext-file'),
    "Tried to merge the ciphertext from another Passman file into working memory, but selected file couldn't be parsed as HTML."
  );
  var text = flasher.doOrFlashRed(
    () => {doc.getElementById('encrypted-message').innerText},
    document.getElementById('import-ciphertext-file'),
    "Tried to merge the ciphertext from another Passman file into working memory, but there was no element with id='encrypted-message'."
  );
  var text = flasher.doOrFlashRed(
    () => {EncryptedMessage.deserialize(text)},
    document.getElementById('import-ciphertext-file'),
    "Tried to merge the ciphertext from another Passman file into working memory, but couldn't parse the ciphertext from it (this is extra weird -- maybe I made a non-backwards-compatible change to the encrypted-message format?)."
  );
  var importedPlaintext = flasher.awaitOrFlashRed(
    em.decrypt(document.getElementById('import-ciphertext-password').value),
    document.getElementById('import-ciphertext-password'),
    "Tried to merge the ciphertext from another Passman file into working memory, but password was wrong to decrypt the other file's ciphertext."
  );
  var importedJ = flasher.doOrFlashRed(
    () => {JSON.parse(importedPlaintext);},
    document.getElementById('import-ciphertext-password'),
    "Tried to merge the ciphertext from another Passman file into working memory, but failed to parse the JSON. (This is REALLY WEIRD.)"
  );

  flasher.doOrFlashRed(
    () => j.foldIn(new SecretStore(importedJ)),
    document.getElementById('import-ciphertext-button'),
    "Tried to merge the ciphertext from another Passman file into working memory, but the decrypted JSON object from the other file doesn't have the expected shape. (This is REALLY WEIRD.)"
  );
  updateView();
  flasher.flash(document.getElementById('password'), 'lightgreen', `
    Merged the ciphertext from another Passman file into working memory.
  `);
}

function importPlaintext() {
  var importedJ = flasher.doOrFlashRed(
    () => JSON.parse(document.getElementById('import-plaintext-field').value),
    document.getElementById('import-plaintext-field'),
    "Tried to merge the 'Import JSON' field into working memory, but failed to parse the JSON."
  );
  flasher.doOrFlashRed(
    () => j.foldIn(new SecretStore(importedJ)),
    document.getElementById('import-plaintext-button'),
    `Tried to merge the 'Import JSON' field into working memory, but the JSON object you pasted in doesn't have the expected shape. (It should be an exactly-two-level object whose leaf values are strings, like {"a": {"b": "c"}}, and not like {"a": {"b": ["c"]}} or {"a": {"b": 3}} or {"a": {"b": {}}}.)`
  )
  updateView();
  flasher.flash(document.getElementById('import-plaintext-button'), 'lightgreen', `
    Merged the JSON from the "import plaintext" field into working memory.
  `);
}

function bulkImport() {
  var importedJ = new SecretStore(JSON.parse($('#bulk-import-field').value));
  j.foldIn(importedJ);
}

function setField() {
  var [account, field, value] = ['account', 'field', 'value'].map(f => document.getElementById(`set-field--${f}`).value);
  j.set(account, field, value);
  updateView();
  flasher.flash(document.getElementById('set-field--value'), 'lightgreen', `
    Set ${account}.${field}
  `);
  document.getElementById('set-field--value').value = '';
}

window.addEventListener('load', () => {
  Object.entries({'decrypt-button': decrypt,
                  'save-button': save,
                  'copy-plaintext-button': copyPlaintext,
                  'import-plaintext-button': importPlaintext,
                  'import-ciphertext-button': importCiphertext,
                  'set-field-button': setField})
        .forEach(([id, clickCallback]) => {
          document.getElementById(id).addEventListener('click', clickCallback);
        });


  window.addEventListener('input', (e) => {
    if (e.target.classList.contains('query-field')) {
      updateView();
    }
  });
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-button')) {
      var account = e.target.getAttribute('data-account');
      var field = e.target.getAttribute('data-field');
      copyToClipboard(j.get(account, field));
      flasher.flash(e.target, 'lightgreen', `
        Copied ${field} for ${account} to clipboard.
      `);
    }
  });

  document.getElementById('password').focus();
  onEnter(document.getElementById('password'), () => {document.getElementById('decrypt-button').click();});
  onEnter(document.getElementById('set-field--value'), () => {document.getElementById('set-field-button').click();})

  window.onbeforeunload = () => {
    if (thereAreUnsavedChanges()) {
      return "There are unsaved changes. Consider saving them."
    }
  }

  ['account', 'field'].forEach(f => {
    var el = document.getElementById(`copy-field--${f}`);
    onEnter(el, () => {document.getElementsByClassName('copy-button')[0].click(); el.focus()});
  });
  updateView();

  flasher = new Flasher(document.getElementById('status'));

  if (window.crypto.subtle === undefined) {
    alert("THIS WON'T WORK FOR YOU. Your browser isn't presenting the SubtleCrypto API that all major modern browsers do. (Note: Chrome, and possibly others, don't provide SubtleCrypto to JS loaded over http:// connections, only https://. This might be happening to you.)")
  }
});
