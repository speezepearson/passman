function query(q, obj) {
  var regexp = new RegExp('^' + q.replace(/ /g, '.+'))
  return Object.keys(obj).sort().filter(s => regexp.test(s));
}

export default query;
