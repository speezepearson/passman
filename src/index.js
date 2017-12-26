import _getGlobals from './globals.js'; var globals = _getGlobals();
globals.window = window;
globals.document = document;

import { takeSnapshot, downloadThisPageWithNewEncryptedMessage } from './download.js';
window.addEventListener('load', takeSnapshot);

import SecretsView from './secrets_view.js';
import copyToClipboard from './copy_to_clipboard.js';
import { makeGood, makeBad, doAndSetGoodness } from './goodness.js';
import EncryptedMessage from './encrypted_message.js';
import query from './query.js';
import parseHTML from './parse_html.js';

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
}
function copyPlaintext() {
  copyToClipboard(JSON.stringify(window.j, null, 2));
  flashText(document.getElementById('copy-plaintext-button'), 'Copied!');
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
async function lockAndDownload() {
  await lock();
  downloadThisPageWithNewEncryptedMessage(EncryptedMessage.deserialize(document.getElementById('encrypted-message').innerText));
}
async function lock() {
  var em = await EncryptedMessage.create(document.getElementById('password').value, JSON.stringify(window.j));
  document.getElementById('encrypted-message').innerText = em.serialize();

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
}

function flashText(e, t) {
  var originalText = e.innerText;
  e.innerText = t;
  setTimeout(() => {e.innerText = originalText}, 500);
}

function onEnter(element, callback) {
  element.addEventListener('keypress', (event) => {
    if (event.keyCode === 13) {
      callback(event);
    }
  });
}

var importedEncryptedMessage = null;
function onImportCiphertextFileSelect() {
  var file = document.getElementById('import-ciphertext-file').files[0];
  if (file === undefined) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var html = e.target.result;
      var elem = parseHTML(html, 'div', true);
      if (elem.getElementsByClassName === undefined) throw 'unable to parse file as html';
      var ciphertext = elem.getElementsByClassName('encrypted-message')[0].innerText;
      importedEncryptedMessage = EncryptedMessage.deserialize(ciphertext);
    } catch (err) {
      alert('error importing: '+err)
      document.getElementById('import-ciphertext-file').value = [];
    }
  }
  reader.readAsText(file);
}
function importCiphertext() {
  document.getElementById('encrypted-message').innerText = importedEncryptedMessage.serialize();
}

window.addEventListener('load', () => {
  Object.entries({'unlock-button': unlock,
                  'lock-button': lock,
                  'copy-plaintext-button': copyPlaintext,
                  'copy-ciphertext-button': copyCiphertext,
                  'lock-and-download-button': lockAndDownload,
                  'import-ciphertext-button': importCiphertext})
        .forEach(([id, clickCallback]) => {
          document.getElementById(id).addEventListener('click', clickCallback);
        })

  window.addEventListener('input', (e) => {
    if (e.target.classList.contains('query-field')) {
      updateView();
    }
  });
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-button')) {
      copyToClipboard(window.j[e.target.getAttribute('data-account')][e.target.getAttribute('data-field')]);
      flashText(e.target, 'Copied!')
    }
  });

  document.getElementById('password').focus();
  onEnter(document.getElementById('password'), unlock);
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
  })
  document.getElementById('import-ciphertext-file').addEventListener('input', () => {
    onImportCiphertextFileSelect();
  });
  onImportCiphertextFileSelect();
  try {[document.getElementById('field'), document.getElementById('account')].forEach(el => {
    onEnter(el, () => {document.getElementsByClassName('copy-button')[0].click(); el.focus()});
  });} catch (err) {debugger};
  updateView();
});
