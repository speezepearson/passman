import _getGlobals from './globals.js'; var globals = _getGlobals();

function appendNewChild(parent, tagName) {
  var result = globals.document.createElement(tagName);
  parent.appendChild(result);
  return result;
}

function validate(data) {
  if (typeof data !== 'object') throw 'not an object';
  Object.entries(data).forEach(([k, sub]) => {
    if (typeof sub !== 'object') throw `key ${JSON.stringify(k)} maps to non-object`;
    Object.entries(sub).forEach(([field, value]) => {
      if (typeof value !== 'string') throw `field ${JSON.stringify(k)}.${JSON.stringify(field)} has type ${typeof value}, not string`
    })
  });
}

class SecretStore {
  constructor(data) {
    validate(data);
    this.data = data;
  }

  toJSONFriendlyObject() {
    return this.data;
  }
  static fromJSONFriendlyObject(data) {
    return new SecretStore(data);
  }

  nAccounts() {
    return Object.values(this.data).length;
  }
  nFields() {
    return [].concat.apply([], Object.values(this.data).map(v => Object.keys(v))).length;
  }

  fingerprint() {
    return JSON.stringify(
      Object.entries(this.data)
            .sort()
            .map(([k, v]) => [k, Object.entries(v).sort()])
    );
  }

  allFields() {
    var result = [];
    Object.entries(this.data).sort().forEach(([account, info]) => {
      Object.entries(info).sort().forEach(([field, value]) => {
        result.push([account, field, value]);
      })
    });
    return result;
  }

  filter(accountRE, fieldRE) {
    var result = new SecretStore({});
    this.allFields().filter(([a, f, v]) => (accountRE.test(a) && fieldRE.test(f)))
                    .forEach(([a, f, v]) => result.set(a, f, v));
    return result;
  }

  foldIn(other) {
    other.allFields().forEach(([a, f, v]) => this.set(a, f, v));
  }

  get(account, field) {
    if (this.data[account] === undefined) return undefined;
    return this.data[account][field];
  }
  set(account, field, value) {
    if (value === '') {
      if (this.data[account] === undefined) return;
      delete this.data[account][field];
      if (Object.keys(this.data[account]).length === 0) {
        delete this.data[account];
      }
    } else {
      if (this.data[account] === undefined) this.data[account] = {};
      this.data[account][field] = value;
    }
  }

  buildView() {
    var result = appendNewChild(globals.document.getElementById('view-holder'), 'table');

    var headerRow = appendNewChild(result, 'tr');
    appendNewChild(headerRow, 'th').innerText = `${this.nAccounts()} accounts match`;
    appendNewChild(headerRow, 'th').innerText = `${this.nFields()} fields match`;

    Object.entries(this.data).forEach(([account, info]) => {
      var tr = appendNewChild(result, 'tr');
      appendNewChild(tr, 'td').innerText = account;
      var dataCell = appendNewChild(tr, 'td');
      Object.keys(info).sort().forEach(field => {
        var copyButton = appendNewChild(dataCell, 'button');
        copyButton.classList.add('copy-button');
        copyButton.setAttribute('data-account', account);
        copyButton.setAttribute('data-field', field);
        copyButton.innerText = field;
        appendNewChild(dataCell, 'br');
      });
    });
    return result;
  }
}

export { validate, SecretStore };
