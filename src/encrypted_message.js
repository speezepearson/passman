'use strict';

const Subtle = window.crypto.subtle;
window.Subtle = Subtle;

async function pbkdf2(password, salt, encryptionAlgorithm, forEncryption) {
  var pwUtf8 = new TextEncoder().encode(password);
  var pwHash = await Subtle.digest('SHA-256', pwUtf8);
  return await Subtle.deriveKey(
    {'name': 'PBKDF2', 'salt': salt, 'iterations': 100000, 'hash': 'SHA-256'},
    await Subtle.importKey('raw', pwHash, {'name': 'PBKDF2'}, false, ['deriveKey']),
    encryptionAlgorithm,
    false,
    [forEncryption ? 'encrypt' : 'decrypt']
  );
}

class EncryptedMessage {
  constructor(salt, encryptionAlgorithm, ciphertext) {
    this.salt = salt;
    this.encryptionAlgorithm = encryptionAlgorithm;
    this.ciphertext = ciphertext;
  }

  toJSONFriendlyObject() {
    var j = {
      salt: Array.from(this.salt),
      encryptionAlgorithm: Object.assign({}, this.encryptionAlgorithm),
      ciphertext: Array.from(new Uint8Array(this.ciphertext))
    };
    if (j.encryptionAlgorithm.iv !== undefined) {
      j.encryptionAlgorithm.iv = Array.from(j.encryptionAlgorithm.iv);
    }
    return j;
  }
  static fromJSONFriendlyObject(j) {
    var {salt, encryptionAlgorithm, ciphertext} = j;
    if (salt === undefined || encryptionAlgorithm === undefined || ciphertext === undefined) {
      alert('malformed JSON-ized encrypted message')
    }
    salt = new Uint8Array(salt);
    if (encryptionAlgorithm.iv !== undefined) {
      encryptionAlgorithm.iv = new Uint8Array(encryptionAlgorithm.iv);
    }
    ciphertext = new Uint8Array(ciphertext).buffer;
    return new EncryptedMessage(salt, encryptionAlgorithm, ciphertext);
  }

  serialize() {
    return encodeURIComponent(JSON.stringify(this.toJSONFriendlyObject()));
  }
  static deserialize(s) {
    return EncryptedMessage.fromJSONFriendlyObject(JSON.parse(decodeURIComponent(s)));
  }

  static async create(encryptionAlgorithm, password, plaintext) {
    var salt = window.crypto.getRandomValues(new Uint8Array(12));
    var key = await pbkdf2(password, salt, encryptionAlgorithm, true);
    var ptUtf8 = new TextEncoder().encode(plaintext);

    if (encryptionAlgorithm.name === 'AES-GCM') {
      encryptionAlgorithm.iv = window.crypto.getRandomValues(new Uint8Array(12));
    } else {
      throw 'unknown algorithm; TODO'
    }

    var ciphertext = await Subtle.encrypt(encryptionAlgorithm, key, ptUtf8);

    return new EncryptedMessage(salt, encryptionAlgorithm, ciphertext)
  }

  async decrypt(password) {
    var salt = new Uint8Array(this.salt);
    var encryptionAlgorithm = this.encryptionAlgorithm;
    ['iv', 'counter'].forEach((attr) => {
      if (encryptionAlgorithm[attr] !== undefined) {
        encryptionAlgorithm[attr] = new Uint8Array(encryptionAlgorithm[attr]);
      }
    });
    var ciphertext = new Uint8Array(this.ciphertext).buffer;
    var key = await pbkdf2(password, salt, this.encryptionAlgorithm, false);
    var ptUtf8 = await Subtle.decrypt(encryptionAlgorithm, key, ciphertext);
    return new TextDecoder().decode(ptUtf8);
  }
}

export default EncryptedMessage;
