import _getGlobals from './globals.js'; var globals = _getGlobals();
globals.window = window;
globals.document = document;

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import { Flasher } from './flash.js';
import SecretsView from './secrets_view.js';
import copyToClipboard from './copy_to_clipboard.js';
import EncryptedMessage from './encrypted_message.js';
import query from './query.js';

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

var view;
window.addEventListener('load', () => {
  view = new SecretsView(
    document.getElementById('view-holder'),
    () => j,
    () => document.getElementById('copy-field--account').value,
    () => document.getElementById('copy-field--field').value,
  );
});

function updateView() {
  view.refresh();
}

var j = {};

function normalizeJ(j) {
  return Object.entries(j).sort().map(([k, v]) => [k, Object.entries(v).sort()]);
}
var normalizedDecryptedJ = null;


function thereAreUnsavedChanges() {
  return (Object.keys(j).length > 0) && (JSON.stringify(normalizeJ(j)) != JSON.stringify(normalizedDecryptedJ));
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
  var decryptedJ = JSON.parse(plaintext);
  mergeJs(j, decryptedJ);
  normalizedDecryptedJ = normalizeJ(decryptedJ);
  updateView();
  document.getElementById('copy-field--account').focus();
  flasher.flash(document.getElementById('decrypt-button'), 'lightgreen', `
    Decrypted the ciphertext embedded in this HTML file, and merged it into working memory.
  `);
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(j, null, 2));
  flasher.flash(document.getElementById('copy-plaintext-button'), 'lightgreen', `
    Copied entire working memory to clipboard, as JSON.
  `);
}
function download(filename, text) {
  // adapted from: https://stackoverflow.com/a/18197511/8877656
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

  var em = await EncryptedMessage.create(password, JSON.stringify(j));
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
    () => mergeJs(j, importedJ),
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
    () => mergeJs(j, importedJ),
    document.getElementById('import-plaintext-button'),
    `Tried to merge the 'Import JSON' field into working memory, but the JSON object you pasted in doesn't have the expected shape. (It should be an exactly-two-level object whose leaf values are strings, like {"a": {"b": "c"}}, and not like {"a": {"b": ["c"]}} or {"a": {"b": 3}} or {"a": {"b": {}}}.)`
  )
  updateView();
  flasher.flash(document.getElementById('import-plaintext-button'), 'lightgreen', `
    Merged the JSON from the "import plaintext" field into working memory.
  `);
}

function validJOrThrow(j) {
  if (typeof j !== 'object') throw 'not an object';
  Object.entries(j).forEach(([k, sub]) => {
    if (typeof sub !== 'object') throw `key ${JSON.stringify(k)} maps to non-object`;
    Object.entries(sub).forEach(([field, value]) => {
      if (typeof value !== 'string') throw `field ${JSON.stringify(k)}.${JSON.stringify(field)} has type ${typeof value}, not string`
    })
  });
}
function mergeJs(target, newJ) {
  validJOrThrow(target);
  validJOrThrow(newJ);
  Object.entries(newJ).forEach(([account, info]) => {
    if (target[account] === undefined) {
      target[account] = {};
    }
    Object.assign(target[account], info);
  });
}

function bulkImport() {
  var importedJ = JSON.parse($('#bulk-import-field').value);
  mergeJs(j, importedJ);
}

function setField() {
  var [account, field, value] = ['account', 'field', 'value'].map(f => document.getElementById(`set-field--${f}`).value);

  if (j[account]===undefined) j[account] = {};
  if (value === '') {
    delete j[account][field];
    if (Object.keys(j[account]).length === 0) {
      delete j[account];
    }
  } else {
    j[account][field] = document.getElementById('set-field--value').value;
  }
  updateView();
  flasher.flash(document.getElementById('set-field--value'), 'lightgreen', `
    Set ${account}.${field}
  `);
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
      copyToClipboard(j[account][field]);
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
});
