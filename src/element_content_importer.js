import { flash } from './flash.js';

class ElementContentImporter {
  constructor(target, fileInput, validate=function(){}) {
    this.target = target;
    this.fileInput = fileInput;
    this.validate = validate;

    var $this = this;
    this.fileInput.addEventListener('input', (e) => {
      $this.importFromFile(e.target.files[0]).then(
        () => {flash(e.target, 'green')},
        (err) => {alert('import failed: '+err); flash(e.target, 'red');}
      );
    });
  }

  importFromFile(file) {
    var $this = this;
    return new Promise((resolve, reject) => {
      if (file === undefined) return;
      var reader = new FileReader();
      reader.onload = function(loadEvent) {
        try {
          var html = loadEvent.target.result;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var text = doc.getElementById($this.target.id).innerText;
          $this.validate(text)
          $this.target.innerText = text;
          resolve();
        } catch (err) {
          $this.fileInput.value = [];
          reject(err);
        }
      }
      reader.readAsText(file);
    });
  }
}

export default ElementContentImporter;
