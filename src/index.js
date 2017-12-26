import _getGlobals from './globals.js'; var globals = _getGlobals();
globals.window = window;
globals.document = document;

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import { flash } from './flash.js';
import ElementContentImporter from './element_content_importer.js';
import SecretsView from './secrets_view.js';
import copyToClipboard from './copy_to_clipboard.js';
import { makeGood, makeBad, doAndSetGoodness } from './goodness.js';
import EncryptedMessage from './encrypted_message.js';
import query from './query.js';

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
    () => window.j,
    () => document.getElementById('account').value,
    () => document.getElementById('field').value,
  );
});

function updateView() {
  view.refresh();
  Object.entries({'unlocked-only': isDecrypted(), 'locked-only': !isDecrypted()})
        .forEach(([className, enabled]) => {
          Array.from(document.getElementsByClassName(className)).forEach(e => {
            e.disabled = !enabled;
          });
        });
}

window.j = null;
function isDecrypted() {
  return window.j !== null;
}
function isQueryPrecise() {
  if (!isDecrypted()) return false;
  var accountQuery = document.getElementById('account').value;
  var accountMatches = query(accountQuery, window.j);
  if (accountMatches.length !== 1) {
    return false;
  }
  var fieldQuery = document.getElementById('field').value;
  var fieldMatches = query(fieldQuery, window.j[accountMatches[0]]);
  return fieldMatches.length === 1;
}

async function unlock() {
  var em = EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText);
  var plaintext;
  try {
    plaintext = await em.decrypt(document.getElementById('password').value);
  } catch (err) {
    makeBad(document.getElementById('password'));
    document.getElementById('password').focus();
    return;
  }
  window.j = JSON.parse(plaintext);
  updateView();
  document.getElementById('account').focus()
  flash(document.getElementById('unlock-button'), 'lightgreen');
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(window.j, null, 2));
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
async function downloadNewPassman() {
  downloadThisPageWithNewEncryptedMessage(EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText));
}
function normalizedJString(j) {
  return JSON.stringify(Object.entries(j).sort().map(([k,v]) => [k, Object.entries(v).sort()]));
}
function jEqual(j1, j2) {
  return normalizedJString(j1) === normalizedJString(j2);
}
async function lock() {
  var password = document.getElementById('password').value;

  var shouldContinue = true;
  var oldJ;
  try {
    oldJ = JSON.parse(await EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText).decrypt(password));
  } catch (err) {
    if (err.name !== 'OperationError') {
      throw err;
    }
    shouldContinue = confirm("You are about to lock the document with a different password than you started with! Make sure that's what you want.");
  }
  if (!shouldContinue) return;
  var em = await EncryptedMessage.create(document.getElementById('password').value, JSON.stringify(window.j));
  document.getElementById('encrypted-message').innerText = em.serialize();

  var changed = !jEqual(window.j, oldJ);

  // Probably a dumb threat model, but:
  // modify objects in-place as much as possible so they're not just
  // floating around easily inspectable until the GC runs.
  Object.entries(window.j).forEach(([account, info]) => {
    Object.keys(info).forEach(k => {delete info[k]});
    delete window.j[account];
  });
  window.j = null;
  Array.from(document.getElementsByTagName('input'))
          .filter(e => e.type==='password')
          .forEach(e => {e.value = ''});
  makeBad(document.getElementById('password'));
  document.getElementById('password').focus()
  updateView();

  if (changed) {
    if (confirm('You changed something; would you like to download your new passwords as a new file?')) {
      downloadNewPassman();
    }
  }
  flash(document.getElementById('lock-button'), 'lightgreen');
}

function onEnter(element, callback) {
  element.addEventListener('keypress', (event) => {
    if (event.keyCode === 13) {
      callback(event);
    }
  });
}

var importedEncryptedMessage;
async function onImportCiphertextFileSelect() {
  var file = document.getElementById('import-ciphertext-file').files[0];
  if (file === undefined) return;
  var ciphertext = await extractElementTextFromFile(file, 'encrypted-message');
  importedEncryptedMessage = EncryptedMessage.deserialize(ciphertext);
}
function importCiphertext() {
  document.getElementById('encrypted-message').innerText = importedEncryptedMessage.serialize();
}

window.addEventListener('load', () => {
  Object.entries({'unlock-button': unlock,
                  'lock-button': lock,
                  'copy-plaintext-button': copyPlaintext,
                  'copy-ciphertext-button': copyCiphertext})
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
      copyToClipboard(window.j[e.target.getAttribute('data-account')][e.target.getAttribute('data-field')]);
      flash(e.target, 'lightgreen')
    }
  });

  document.getElementById('password').focus();
  onEnter(document.getElementById('password'), () => {
    document.getElementById(isDecrypted() ? 'lock-button' : 'unlock-button').click()
  });
  onEnter(document.getElementById('set-value'), () => {
    var account = document.getElementById('account').value;
    var field = document.getElementById('field').value;
    var value = document.getElementById('set-value').value;
    if (window.j[account]===undefined) window.j[account] = {};
    if (value === '') {
      delete window.j[account][field];
      if (Object.keys(window.j[account]).length === 0) {
        delete window.j[account];
      }
    } else {
      window.j[account][field] = document.getElementById('set-value').value;
    }
    updateView();
    flash(document.getElementById('set-value'), 'lightgreen');
  })

  window.onbeforeunload = () => {
  }

  window.ciphertextImporter = new ElementContentImporter(
    document.getElementById('encrypted-message'),
    document.getElementById('import-ciphertext-file'),
    EncryptedMessage.deserialize
  );
  [document.getElementById('field'), document.getElementById('account')].forEach(el => {
    onEnter(el, () => {document.getElementsByClassName('copy-button')[0].click(); el.focus()});
  });
  updateView();
});
