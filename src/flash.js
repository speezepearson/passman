function flash(e, color, duration=500) {
  var oldColor = e.style['outline'];
  e.style['outline'] = `5px solid ${color}`;
  setTimeout(() => {if (oldColor === undefined) delete e.style['outline']; else e.style['outline'] = oldColor;}, duration);
}

export { flash };
