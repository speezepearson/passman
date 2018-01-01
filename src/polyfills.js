console.log('adding polyfills');
// source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries#Polyfill
if (!Object.entries)
  Object.entries = function( obj ){
    var ownProps = Object.keys( obj ),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];

    return resArray;
  };


// adapted from: https://github.com/es-shims/Object.values/blob/master/implementation.js
if (!Object.values)
  Object.values = function(obj) {
  	var vals = [];
    Object.keys(obj).forEach(key => {
			vals.push(obj[key]);
		});
  	return vals;
  };
