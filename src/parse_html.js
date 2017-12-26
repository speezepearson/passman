import _getGlobals from './globals.js'; var globals = _getGlobals();

function parseHTML(html, parentTagName='div') {
  var e = globals.document.createElement(parentTagName);
  e.innerHTML = html.trim();
  if (e.childNodes[0]===undefined) debugger
  return e.childNodes[0];
}

export default parseHTML;
