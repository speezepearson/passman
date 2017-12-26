import _getGlobals from './globals.js'; var globals = _getGlobals();

function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html').childNodes[0];
}

export default parseHTML;
