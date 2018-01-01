function randInt(upperBoundExclusive) {
  // If we can generate a random digit 0-9,
  // and we want a random digit 0-2,
  // then we can just generate digits and map
  //   0123456789
  //   012012012_
  // where we resample if we get 9.
  // The problem with 9 is that
  var greatestMultipleOfUpperBoundNotOver65536 = 65536 - (65536%upperBoundExclusive);
  var result;
  do {
    result = window.crypto.getRandomValues(new Uint16Array(1))[0];
  } while (result >= greatestMultipleOfUpperBoundNotOver65536);
  if (result===undefined) debugger;
  return result % upperBoundExclusive;
}

function randInts(nInts, upperBoundExclusive) {
  var result = new Array(nInts);
  result.forEach((_, i) => {
    result[i] = randInt(upperBoundExclusive);
  });
  return result;
}

function choose(choices) {
  var r = randInt(choices.length);
  if (r===undefined || r<0 || r>=choices.length) debugger;
  return choices[r];
}

function shuffle(xs) {
  // source: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
  for (var i=0; i<xs.length-1; i++) {
    var j = i + randInt(xs.length-i);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export { randInt, randInts, choose, shuffle };
