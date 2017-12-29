function escapeRegExp(str) {
  // source: https://stackoverflow.com/a/6969486
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function query(q, obj) {
  var pattern = q.split(' ').map(escapeRegExp).join('.+')
  var regexp = new RegExp('^' + pattern, 'i');
  return Object.keys(obj).sort().filter(s => regexp.test(s));
}

export default query;
