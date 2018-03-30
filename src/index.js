import _whatever from './polyfills.js';

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import { choose, shuffle } from './rand.js';
import { addNewChild } from './html_utils.js';
import { SecretStore } from './secret_store.js';
import { Flasher } from './flash.js';
import copyToClipboard from './copy_to_clipboard.js';
import EncryptedMessage from './encrypted_message.js';
import { parseQuery } from './query.js';

var decryptedJ = null;

var flasher;

function filteredJ() {
  var [accountRE, fieldRE] = ['account', 'field'].map(f => parseQuery(elem(`copy-field--${f}`).value));
  return j.filter(accountRE, fieldRE);
}

function updateView() {
  elem('view-holder').innerHTML = '';
  var searchResults = filteredJ();
  var table = searchResults.buildView();

  var headerRow = addNewChild(table, 'tr', false);
  addNewChild(headerRow, 'th').innerText = `${searchResults.nAccounts()}/${j.nAccounts()} accounts match`;
  addNewChild(headerRow, 'th').innerText = `${searchResults.nFields()}/${j.nFields()} fields match`;
  elem('view-holder').appendChild(table);
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

  var em = EncryptedMessage.deserialize(elem('encrypted-message').innerText);
  var plaintext;
  try {
    plaintext = await em.decrypt(elem('decryption-password').value);
  } catch (err) {
    flasher.flash('pink', "Tried to decrypt the ciphertext in this HTML file, but password was incorrect.")
    elem('decryption-password').focus();
    throw err;
  }
  var decryptedJ = flasher.doOrFlashRed(
    () => SecretStore.parse(plaintext),
    "Tried to decrypt the ciphertext in this HTML file, but the JSON was malformed. (This is REALLY WEIRD.)"
  );
  lastSavedJFingerprint = decryptedJ.fingerprint();
  var tally = foldInAndTally(j, decryptedJ);
  updateView();
  elem('copy-field--account').focus();
  flasher.flash('lightgreen', `
    Decrypted the ciphertext embedded in this HTML file, and merged it into working memory.
    (${tally.added} fields added, ${tally.overwritten} modified, ${tally.agreedUpon} agreed-upon)
  `);
}
function copyFilteredPlaintext() {
  copyToClipboard(JSON.stringify(filteredJ().toJSONFriendlyObject(), null, 2));
  flasher.flash('lightgreen', `
    Copied search results from working memory to clipboard, as JSON.
  `);
}
async function save() {
  var password = elem('encryption-password').value;
  var shouldContinue = true;

  var oldPassword = elem('decryption-password').value;
  var oldJ;
  try {
    oldJ = JSON.parse(await EncryptedMessage.deserialize(elem('encrypted-message').innerText).decrypt(password));
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
    () => SecretStore.parse(elem('import-plaintext-field').value),
    "Tried to merge the 'Import JSON' field into working memory, but the JSON was malformed."
  );
  var tally = foldInAndTally(j, importedJ);
  elem('import-plaintext-field').value = '';
  updateView();
  flasher.flash('lightgreen', `
    Merged the JSON from the 'Import JSON' field into working memory.
    (${tally.added} fields added, ${tally.overwritten} modified, ${tally.agreedUpon} agreed-upon)
  `);
}

function setField() {
  var [account, field, value] = ['account', 'field', 'value'].map(f => elem(`set-field--${f}`).value);
  var fieldExists = (j.get(account, field) !== undefined);
  var deleting = (value === '');
  if (deleting && !fieldExists) {
    flasher.flash('pink', `
      Tried to delete ${account}.${field}, but that field didn't exist anyway.
    `);
    return;
  }

  j.set(account, field, value);
  elem('copy-field--account').value = account;
  elem('copy-field--field').value = '';
  updateView();
  flasher.flash('lightgreen', `
    ${deleting ? 'Deleted' : 'Set'} ${account}.${field}.
  `);
  elem('set-field--value').value = '';
}

function generateField() {
  var [account, field, length, charsets] = ['account', 'field', 'length', 'charsets'].map(f => elem(`generate-field--${f}`).value);
  length = parseInt(length);
  charsets = charsets.split(',').map(s => s.trim()).filter(s => (s.length>0));

  if (length < charsets.length) {
    flasher.flash('pink', `Tried to set ${account}.${field} to a random value, but you asked for that value to have ${length} characters drawn from ${charsets.length} character sets. This is impossible.`);
    return;
  }

  var value = '';
  var i;
  for (i=0; i<charsets.length; i++) {
    value += choose(charsets[i]);
  }
  var charset = charsets.join('');
  for (; i<length; i++) {
    value += choose(charset);
  }
  value = shuffle(Array.from(value)).join('')
  j.set(account, field, value);
  copyToClipboard(value);
  elem('copy-field--account').value = account;
  elem('copy-field--field').value = '';
  updateView();
  flasher.flash('lightgreen', `Generated a ${value.length}-character-long random value for ${account}.${field}, and copied it to the clipboard.`);
}

async function importCiphertext() {
  var file = elem('import-ciphertext-file').files[0];
  if (file === undefined) {
    flasher.flash('pink', `
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
    () => new DOMParser().parseFromString(html, 'text/html'),
    "Tried to merge the ciphertext from another Passman file into working memory, but selected file couldn't be parsed as HTML."
  );
  var text = flasher.doOrFlashRed(
    () => doc.getElementById('encrypted-message').innerText,
    "Tried to merge the ciphertext from another Passman file into working memory, but there was no element with id='encrypted-message'."
  );
  var em = flasher.doOrFlashRed(
    () => EncryptedMessage.deserialize(text),
    "Tried to merge the ciphertext from another Passman file into working memory, but couldn't parse the ciphertext from it (this is extra weird -- maybe I made a non-backwards-compatible change to the encrypted-message format?)."
  );
  var importedPlaintext = await flasher.doOrFlashRed(
    async function() {return await em.decrypt(elem('import-ciphertext-password').value);},
    "Tried to merge the ciphertext from another Passman file into working memory, but password was wrong to decrypt the other file's ciphertext."
  );
  var importedJ = flasher.doOrFlashRed(
    () => JSON.parse(importedPlaintext),
    "Tried to merge the ciphertext from another Passman file into working memory, but failed to parse the JSON. (This is REALLY WEIRD.)"
  );

  flasher.doOrFlashRed(
    () => j.foldIn(new SecretStore(importedJ)),
    "Tried to merge the ciphertext from another Passman file into working memory, but the decrypted JSON object from the other file doesn't have the expected shape. (This is REALLY WEIRD.)"
  );
  updateView();
  flasher.flash('lightgreen', `
    Merged the ciphertext from another Passman file into working memory.
  `);
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

function elem(id) {
  var result = document.getElementById(id);
  if (result === undefined) {
    throw `no element exists with id ${JSON.stringify(id)}`;
  }
  return result;
}

window.addEventListener('load', () => {

  var reasonForCatastrophicFailure = null;
  if (window.crypto.subtle === undefined) {
    failCatastrophically("Your browser isn't presenting the SubtleCrypto API that all major modern browsers do. (Note: Chrome, and possibly others, don't provide SubtleCrypto to JS loaded over http:// connections, only https://. This might be happening to you.)");
  }

  if (reasonForCatastrophicFailure) {
    document.body.innerText = `THIS WON'T WORK FOR YOU. ${reasonForCatastrophicFailure}`;
    return;
  }

  flasher = new Flasher(elem('status'));

  Object.entries({'decrypt-button': decrypt,
                  'save-button': save,
                  'copy-filtered-plaintext-button': copyFilteredPlaintext,
                  'import-plaintext-button': importPlaintext,
                  'generate-field-button': generateField,
                  'set-field-button': setField,
                  'import-ciphertext-button': importCiphertext,
                })
        .forEach(([id, clickCallback]) => {
          elem(id).addEventListener('click', clickCallback);
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

  elem('decryption-password').focus();

  onEnter(elem('decryption-password'), () => {elem('decrypt-button').click();});
  onEnter(elem('encryption-password'), () => {elem('save-button').click();});
  onEnter(elem('set-field--value'), () => {elem('set-field-button').click();})

  window.onbeforeunload = () => {
    if (thereAreUnsavedChanges()) {
      return "There are unsaved changes. Consider saving them."
    }
  }

  ['account', 'field'].forEach(f => {
    var el = elem(`copy-field--${f}`);
    onEnter(el, () => {
      var topCopyButton = document.getElementsByClassName('copy-button')[0];
      if (topCopyButton === undefined) {
        flasher.flash('pink', "Tried to copy top search result, but there are none.");
        return;
      }
      document.getElementsByClassName('copy-button')[0].click();
      elem('copy-field--field').value = '';
      updateView();
      elem('copy-field--field').focus();
    });
  });
  updateView();

  // Hack to make the page load faster; the window's "load" event doesn't fire before the images load, which can take a while.
  Array.from(document.getElementsByTagName('img')).forEach(img => {
    if (img.src === '') {
      img.src = img.getAttribute('data-src');
    }
  })

});

window.addEventListener('keypress', (e) => {
  // adapted from: https://stackoverflow.com/a/93836
  if (!(e.which == 115 && e.ctrlKey) && !(e.which == 19)) return true;
  save();
  e.preventDefault();
  return false;
})
