function makeGood(e) {
  e.classList.add('good');
  e.classList.remove('bad');
}
function makeBad(e) {
  e.classList.add('bad');
  e.classList.remove('good');
}
function doAndSetGoodness(e, f) {
  var result;
  try {
    result = f();
    makeGood(e);
  } catch (err) {
    makeBad(e);
    e.focus();
    throw err;
  }
  return result;
}

export { makeBad, makeGood, doAndSetGoodness };
