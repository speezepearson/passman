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
function foldInAndTally(j, j2) {
  var oldNFields = j.allFields().length;
  var nOverwrittenFields = j2.allFields()
                             .filter(([a,f,v]) => (j.get(a,f) !== undefined && v !== j.get(a,f)))
                             .length;
  j.foldIn(j2);
  var newNFields = j.allFields().length;
  var nAddedFields = newNFields - oldNFields;
  var nAgreedUponFields = j2.allFields().length - nAddedFields - nOverwrittenFields;
  return {
    overwritten: nOverwrittenFields,
    agreedUpon: nAgreedUponFields,
    added: nAddedFields
  }
}

async function decrypt() {

  var em = EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText);
  var plaintext;
  try {
    plaintext = await flasher.awaitOrFlashRed(
      em.decrypt(document.getElementById('decryption-password').value),
      "Tried to decrypt the ciphertext in this HTML file, but password was incorrect."
    );
  } catch (err) {
    document.getElementById('decryption-password').focus();
    throw err;
  }
  var decryptedJ = flasher.doOrFlashRed(
    () => SecretStore.parse(plaintext),
    "Tried to decrypt the ciphertext in this HTML file, but the JSON was malformed. (This is REALLY WEIRD.)"
  );
  lastSavedJFingerprint = decryptedJ.fingerprint();
  var tally = foldInAndTally(j, decryptedJ);
  updateView();
  document.getElementById('copy-field--account').focus();
  flasher.flash('lightgreen', `
    Decrypted the ciphertext embedded in this HTML file, and merged it into working memory.
    (${tally.added} fields added, ${tally.overwritten} modified, ${tally.agreedUpon} agreed-upon)
  `);
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(j.toJSONFriendlyObject(), null, 2));
  flasher.flash('lightgreen', `
    Copied entire working memory to clipboard, as JSON.
  `);
}
async function save() {
  var password = document.getElementById('encryption-password').value;
  var shouldContinue = true;

  var oldPassword = document.getElementById('decryption-password').value;
  var oldJ;
  try {
    oldJ = JSON.parse(await EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText).decrypt(password));
  } catch (err) {
    if (err.name !== 'OperationError') {
      flasher.flash('pink', `
        Something REAL WEIRD happened while checking whether the password you entered matched the one for this file.
        This should never happen.
      `);
      throw err;
    }
    shouldContinue = confirm("You are about to download a passman file with a different password than the original one! Is that what you want?");
  }
  if (!shouldContinue) {
    flasher.flash('pink', 'Would have saved, but you aborted.');
    return;
  }

  if (password.length < 6) {
    shouldContinue = confirm(`You password is only ${password.length} characters long. I won't stop you, but please, MAKE REAL SURE THIS IS INTENTIONAL before saving.`);
  }
  if (!shouldContinue) {
    flasher.flash('pink', 'Would have saved, but you aborted.');
    return;
  }

  var em = await EncryptedMessage.create(password, j.stringify());
  downloadThisPageWithNewEncryptedMessage(em);
  lastSavedJFingerprint = j.fingerprint();
  flasher.flash('lightgreen', `
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
    () => SecretStore.parse(document.getElementById('import-plaintext-field').value),
    "Tried to merge the 'Import JSON' field into working memory, but the JSON was malformed."
  );
  var tally = foldInAndTally(j, importedJ);
  document.getElementById('import-plaintext-field').value = '';
  updateView();
  flasher.flash('lightgreen', `
    Merged the JSON from the 'Import JSON' field into working memory.
    (${tally.added} fields added, ${tally.overwritten} modified, ${tally.agreedUpon} agreed-upon)
  `);
}

function setField() {
  var [account, field, value] = ['account', 'field', 'value'].map(f => document.getElementById(`set-field--${f}`).value);
  var fieldExists = (j.get(account, field) !== undefined);
  var deleting = (value === '');
  if (deleting && !fieldExists) {
    flasher.flash('pink', `
      Tried to delete ${account}.${field}, but that field didn't exist anyway.
    `);
    return;
  }

  j.set(account, field, value);
  updateView();
  flasher.flash('lightgreen', `
    ${deleting ? 'Deleted' : 'Set'} ${account}.${field}.
  `);
  document.getElementById('set-field--value').value = '';
}

function failCatastrophically(reason) {
  document.body.innerText = `THIS WON'T WORK FOR YOU. ${reason}`;
  throw 'failed catastrophically';
}

const CHECK_COPY_OR_FAIL_EVENT_TYPES = ['keypress', 'click'];
var checkCopyOrFail = (function() {
  function listener() {
    console.log('checking copyability')
    CHECK_COPY_OR_FAIL_EVENT_TYPES.forEach(et => window.removeEventListener(et, listener));
    try {
      copyToClipboard('');
    } catch (err) {
      failCatastrophically("Your browser doesn't support JavaScript copy-to-clipboard. Sorry!");
    }
  }
  return listener;
})();
CHECK_COPY_OR_FAIL_EVENT_TYPES.forEach(et => window.addEventListener(et, checkCopyOrFail));

window.addEventListener('load', () => {

  var reasonForCatastrophicFailure = null;
  if (window.crypto.subtle === undefined) {
    failCatastrophically("Your browser isn't presenting the SubtleCrypto API that all major modern browsers do. (Note: Chrome, and possibly others, don't provide SubtleCrypto to JS loaded over http:// connections, only https://. This might be happening to you.)");
  }

  if (reasonForCatastrophicFailure) {
    document.body.innerText = `THIS WON'T WORK FOR YOU. ${reasonForCatastrophicFailure}`;
    return;
  }

  flasher = new Flasher(document.getElementById('status'));

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
      flasher.flash('lightgreen', `
        Copied ${field} for ${account} to clipboard.
      `);
    }
  });

  document.getElementById('decryption-password').focus();

  onEnter(document.getElementById('decryption-password'), () => {document.getElementById('decrypt-button').click();});
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


});
