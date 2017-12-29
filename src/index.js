import _getGlobals from './globals.js'; var globals = _getGlobals();
globals.window = window;
globals.document = document;

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import { flash } from './flash.js';
import SecretsView from './secrets_view.js';
import copyToClipboard from './copy_to_clipboard.js';
import EncryptedMessage from './encrypted_message.js';
import query from './query.js';

var decryptedJ = null;

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
    flash(document.getElementById('password'), 'red');
    document.getElementById('password').focus();
    return;
  }
  mergeJs(j, JSON.parse(plaintext));
  updateView();
  document.getElementById('copy-field--account').focus();
  flash(document.getElementById('decrypt-button'), 'lightgreen');
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(j, null, 2));
  flash(document.getElementById('copy-plaintext-button'), 'lightgreen');
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
    debugger
    if (err.name !== 'OperationError') {
      throw err;
    }
    shouldContinue = confirm("You are about to download a passman file with a different password than the original one! Is that what you want?");
  }
  if (!shouldContinue) return;

  if (password.length < 6) {
    shouldContinue = confirm(`You password is only ${password.length} characters long. I won't stop you, but please, MAKE REAL SURE THIS IS INTENTIONAL before saving.`);
  }
  if (!shouldContinue) return;

  var em = await EncryptedMessage.create(password, JSON.stringify(j));
  downloadThisPageWithNewEncryptedMessage(em);
  flash(document.getElementById('save-button'), 'lightgreen');
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
    flash(document.getElementById('import-ciphertext-file'), 'red');
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

  var doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (err) {
    flash(document.getElementById('import-ciphertext-file'), 'red');
    throw err;
  }

  var text;
  try {
    text = doc.getElementById('encrypted-message').innerText;
  } catch (err) {
    flash(document.getElementById('import-ciphertext-file'), 'red');
    throw err;
  }

  var em;
  try {
    em = EncryptedMessage.deserialize(text);
  } catch (err) {
    flash(document.getElementById('import-ciphertext-file'), 'red');
    throw err;
  }

  var importedJ;
  try {
    importedJ = JSON.parse(await em.decrypt(document.getElementById('password').value));
  } catch (err) {
    flash(document.getElementById('password'), 'red');
    throw err;
  }

  mergeJs(j, importedJ);
  updateView();
}

function importPlaintext() {
  mergeJs(j, JSON.parse(document.getElementById('import-plaintext-field').value)) // todo validate
  updateView();
}

function clear() {
  if (j === null) {
    j = {};
  } else {
    obliterate(j);
  }
  updateView();
}

function mergeJs(target, newJ) {
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
  flash(document.getElementById('set-field--value'), 'lightgreen');
}

window.addEventListener('load', () => {
  Object.entries({'decrypt-button': decrypt,
                  'save-button': save,
                  'copy-plaintext-button': copyPlaintext,
                  'clear-button': clear,
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
      copyToClipboard(j[e.target.getAttribute('data-account')][e.target.getAttribute('data-field')]);
      flash(e.target, 'lightgreen')
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
});
