'use strict';

const Subtle = window.crypto.subtle;
window.Subtle = Subtle;

async function pbkdf2(password, keyDerivationAlgorithm, encryptionAlgorithm, forEncryption) {
  var pwUtf8 = new TextEncoder().encode(password);
  var pwHash = await Subtle.digest('SHA-256', pwUtf8);
  return await Subtle.deriveKey(
    keyDerivationAlgorithm,
    await Subtle.importKey('raw', pwHash, keyDerivationAlgorithm, false, ['deriveKey']),
    encryptionAlgorithm,
    false,
    [forEncryption ? 'encrypt' : 'decrypt']
  );
}

const typedAlgorithmFields = {
  'iv': (a => Uint8Array.from(a)),
  'salt': (a => Uint8Array.from(a)),
  'counter': (a => Uint8Array.from(a))
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
  Object.entries(typedAlgorithmFields).forEach(([attr, typify]) => {
    if (algorithm[attr] !== undefined) {
      algorithm[attr] = typify(algorithm[attr]);
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
    keyDerivationAlgorithm.salt = window.crypto.getRandomValues(new Uint8Array(12));
    var key = await pbkdf2(password, keyDerivationAlgorithm, encryptionAlgorithm, true);
    var ptUtf8 = new TextEncoder().encode(plaintext);

    encryptionAlgorithm.iv = window.crypto.getRandomValues(new Uint8Array(12));
    var ciphertext = await Subtle.encrypt(encryptionAlgorithm, key, ptUtf8);

    return new EncryptedMessage(keyDerivationAlgorithm, encryptionAlgorithm, ciphertext)
  }

  async decrypt(password) {
    var key = await pbkdf2(password, this.keyDerivationAlgorithm, this.encryptionAlgorithm, false);
    var ptUtf8 = await Subtle.decrypt(this.encryptionAlgorithm, key, this.ciphertext);
    return new TextDecoder().decode(ptUtf8);
  }
}

export default EncryptedMessage;
