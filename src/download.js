function download(filename, text) {
  // source: https://stackoverflow.com/a/18197511/8877656
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

var originalHTML = null;
function takeSnapshot() {
  originalHTML = document.getElementsByTagName('html')[0].outerHTML
}

function downloadThisPageWithNewEncryptedMessage(encryptedMessage) {
  var e = document.createElement('html');
  e.innerHTML = originalHTML;
  e.getElementsByClassName('encrypted-message')[0].innerText = encryptedMessage.serialize();
  download('passman.html', e.outerHTML);
}

export { takeSnapshot, downloadThisPageWithNewEncryptedMessage };
