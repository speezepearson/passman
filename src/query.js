function escapeRegExp(str) {
  // source: https://stackoverflow.com/a/6969486
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function parseQuery(q) {
  var pattern = q.split(' ').map(escapeRegExp).join('.+')
  return new RegExp('^' + pattern, 'i');
}

export { parseQuery };
