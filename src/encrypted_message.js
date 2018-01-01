import _getGlobals from './globals.js'; var globals = _getGlobals();

async function pbkdf2(password, keyDerivationAlgorithm, encryptionAlgorithm, forEncryption) {
  var pwUtf8 = new TextEncoder().encode(password);
  var pwHash = await globals.window.crypto.subtle.digest('SHA-256', pwUtf8);
  return await globals.window.crypto.subtle.deriveKey(
    keyDerivationAlgorithm,
    await globals.window.crypto.subtle.importKey('raw', pwHash, keyDerivationAlgorithm, false, ['deriveKey']),
    encryptionAlgorithm,
    false,
    [forEncryption ? 'encrypt' : 'decrypt']
  );
}

const typedAlgorithmFields = {
  'iv': Uint8Array,
  'salt': Uint8Array,
  'counter': Uint8Array
};
function algorithmToJSONFriendlyObject(algorithm) {
  var j = Object.assign({}, algorithm);
  Object.keys(typedAlgorithmFields).forEach(attr => {
    if (j[attr] !== undefined) {
      j[attr] = Array.from(j[attr]);
    }
  });
  return j;
}
function jsonFriendlyObjectToAlgorithm(j) {
  var algorithm = Object.assign({}, j);
  Object.entries(typedAlgorithmFields).forEach(([attr, type]) => {
    if (algorithm[attr] !== undefined) {
      algorithm[attr] = type.from(algorithm[attr]);
    }
  });
  return algorithm;
}

const defaultOptions = {
  keyDerivationAlgorithm: {'name': 'PBKDF2', 'hash': 'SHA-256', 'iterations': 100000},
  encryptionAlgorithm: {'name': 'AES-GCM', 'length': 256}
};

class EncryptedMessage {

  constructor(keyDerivationAlgorithm, encryptionAlgorithm, ciphertext) {
    this.keyDerivationAlgorithm = keyDerivationAlgorithm;
    this.encryptionAlgorithm = encryptionAlgorithm;
    this.ciphertext = ciphertext;
  }

  toJSONFriendlyObject() {
    return {
      keyDerivationAlgorithm: algorithmToJSONFriendlyObject(this.keyDerivationAlgorithm),
      encryptionAlgorithm: algorithmToJSONFriendlyObject(this.encryptionAlgorithm),
      ciphertext: Array.from(new Uint8Array(this.ciphertext))
    };
  }
  static fromJSONFriendlyObject(j) {
    var {keyDerivationAlgorithm, encryptionAlgorithm, ciphertext} = j;
    if (keyDerivationAlgorithm === undefined || encryptionAlgorithm === undefined || ciphertext === undefined) {
      alert('malformed JSON-ized encrypted message')
    }
    keyDerivationAlgorithm = jsonFriendlyObjectToAlgorithm(keyDerivationAlgorithm);
    encryptionAlgorithm = jsonFriendlyObjectToAlgorithm(encryptionAlgorithm);
    ciphertext = new Uint8Array(ciphertext).buffer;
    return new EncryptedMessage(keyDerivationAlgorithm, encryptionAlgorithm, ciphertext);
  }

  serialize() {
    return JSON.stringify(this.toJSONFriendlyObject());
  }
  static deserialize(s) {
    return EncryptedMessage.fromJSONFriendlyObject(JSON.parse(s));
  }

  static async create(password, plaintext, options) {
    options = Object.assign({}, defaultOptions, options);
    var {keyDerivationAlgorithm, encryptionAlgorithm} = options
    keyDerivationAlgorithm.salt = globals.window.crypto.getRandomValues(new Uint8Array(12));
    var key = await pbkdf2(password, keyDerivationAlgorithm, encryptionAlgorithm, true);
    var ptUtf8 = new TextEncoder().encode(plaintext);

    encryptionAlgorithm.iv = globals.window.crypto.getRandomValues(new Uint8Array(12));
    var ciphertext = await globals.window.crypto.subtle.encrypt(encryptionAlgorithm, key, ptUtf8);

    return new EncryptedMessage(keyDerivationAlgorithm, encryptionAlgorithm, ciphertext)
  }

  async decrypt(password) {
    var key = await pbkdf2(password, this.keyDerivationAlgorithm, this.encryptionAlgorithm, false);
    var ptUtf8 = await globals.window.crypto.subtle.decrypt(this.encryptionAlgorithm, key, this.ciphertext);
    return new TextDecoder().decode(ptUtf8);
  }
}

export default EncryptedMessage;
