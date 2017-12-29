class Flasher {
  constructor(statusElement) {
    this.statusElement = statusElement;
  }

  flash(element, color, message, duration=500) {
    var oldColor = element.style['outline'];
    element.style['outline'] = `5px solid ${color}`;
    setTimeout(() => {
      if (oldColor === undefined) delete element.style['outline'];
      else element.style['outline'] = oldColor;
    }, duration);
    this.statusElement.innerText = message.trim();
  }

  doOrFlashRed(f, element, message, duration=500) {
    try {
      return f()
    } catch (err) {
      this.flash(element, 'red', message+`\n(error: ${err})`, duration);
      throw err;
    }
  }

  async awaitOrFlashRed(p, element ,message, duration=500) {
    try {
      return await p;
    } catch (err) {
      this.flash(element, 'red', message+`\n(error: ${err})`, duration);
      throw err;
    }
  }
}

export { Flasher };
