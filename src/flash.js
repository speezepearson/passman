class Flasher {
  constructor(statusElement) {
    this.statusElement = statusElement;
  }

  flash(color, message, duration=500) {
    this.statusElement.style['background-color'] = color;
    setTimeout(() => {this.statusElement.style['background-color'] = ''}, duration);
    this.statusElement.innerText = message.trim();
  }

  doOrFlashRed(f, message, duration=500) {
    try {
      return f()
    } catch (err) {
      this.flash('pink', message+`\n(error: ${err})`, duration);
      throw err;
    }
  }
}

export { Flasher };
