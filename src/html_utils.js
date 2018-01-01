function addNewChild(parent, tagName, append=true) {
  var result = document.createElement(tagName);
  if (append) parent.appendChild(result);
  else parent.prepend(result);
  return result;
}

export { addNewChild };
