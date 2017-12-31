import _getGlobals from './globals.js'; var globals = _getGlobals();

function addNewChild(parent, tagName, append=true) {
  var result = globals.document.createElement(tagName);
  if (append) parent.appendChild(result);
  else parent.prepend(result);
  return result;
}

export { addNewChild };
