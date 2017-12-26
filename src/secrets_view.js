import parseHTML from './parse_html.js';
import query from './query.js';
import _getGlobals from './globals.js'; var globals = _getGlobals();

function appendNewChild(parent, html) {
  var result = parseHTML(html, parent.tagName);
  parent.appendChild(result);
  return result;
}

function filterJ(j, q1, q2) {
  if (j === null) return [];
  var result = {};
  query(q1, j).forEach(k => {
    result[k] = {}
    query(q2, j[k]).forEach(k2 => {
      result[k][k2] = j[k][k2];
    });
  });
  return result;
}


class SecretsView {
  constructor(element, getData, getAccountQ, getFieldQ) {
    this.element = element;
    this.getData = getData;
    this.getAccountQ = getAccountQ;
    this.getFieldQ = getFieldQ;
  }

  refresh() {
    this.element.innerHTML = '';
    var j = filterJ(this.getData(), this.getAccountQ(), this.getFieldQ());
    if (j === null || Object.keys(j).length === 0) return;

    var tbody = appendNewChild(globals.document.getElementById('view-holder'), `
      <table>
        <tr>
          <th>Account</th>
          <th>Copy</th>
        </tr>
      </table>`).getElementsByTagName('tbody')[0];
    Object.entries(j).forEach(([account, info]) => {
      var tr = appendNewChild(tbody, '<tr />');
      appendNewChild(tr, '<td />').innerText = account;
      var dataCell = appendNewChild(tr, '<td />');
      Object.keys(info).sort().forEach(field => {
        var copyButton = appendNewChild(dataCell, '<button class="copy-button"></button>');
        copyButton.setAttribute('data-account', account);
        copyButton.setAttribute('data-field', field);
        copyButton.innerText = field;
        appendNewChild(dataCell, '<br />');
      });
    });
  }
}

export default SecretsView;
