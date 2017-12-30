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

function updateView() {
  var [accountRE, fieldRE] = ['account', 'field'].map(f => parseQuery(document.getElementById(`copy-field--${f}`).value));
  document.getElementById('view-holder').innerHTML = '';
  document.getElementById('view-holder').appendChild(j.filter(accountRE, fieldRE).buildView());
}

var j = new SecretStore({});

var lastSavedJFingerprint = null;
function thereAreUnsavedChanges() {
  return (j.nAccounts() > 0) && (lastSavedJFingerprint !== j.fingerprint());
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
  lastSavedJFingerprint = decryptedJ.fingerprint();
  j.foldIn(decryptedJ);
  updateView();
  document.getElementById('copy-field--account').focus();
  flasher.flash(document.getElementById('decrypt-button'), 'lightgreen', `
    Decrypted the ciphertext embedded in this HTML file, and merged it into working memory.
  `);
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(j.toJSONFriendlyObject(), null, 2));
  flasher.flash(document.getElementById('copy-plaintext-button'), 'lightgreen', `
    Copied entire working memory to clipboard, as JSON.
  `);
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

  var em = await EncryptedMessage.create(password, JSON.stringify(j.toJSONFriendlyObject()));
  downloadThisPageWithNewEncryptedMessage(em);
  lastSavedJFingerprint = j.fingerprint();
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
      copyToClipboard(j.toJSONFriendlyObject()[account][field]);
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
