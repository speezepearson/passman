import _getGlobals from './globals.js'; var globals = _getGlobals();

function parseHTML(html, parentTagName='div', wrap=false) {
  var e = globals.document.createElement(parentTagName);
  e.innerHTML = html.trim();
  return wrap ? e : e.childNodes[0];
}

export default parseHTML;
