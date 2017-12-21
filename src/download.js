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
window.addEventListener('load', () => {originalHTML = document.getElementsByTagName('html')[0].outerHTML});

function downloadThisPageWithNewPayload(serializedPayload) {
  var e = document.createElement('html');
  e.innerHTML = originalHTML;
  e.getElementsByClassName('payload')[0].innerText = serializedPayload;
  download('encryptdecrypt.html', e.innerHTML);
}

export default downloadThisPageWithNewPayload;
