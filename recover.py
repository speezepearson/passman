import hashlib
import json
import getpass
import argparse
import sys
import pprint

# To get Cryptodome:
#     pip install cryptodomex
# PyCrypto _almost_ works, but doesn't support GCM.
from Cryptodome.Protocol.KDF import PBKDF2
from Cryptodome.Cipher import AES
from Cryptodome.Random import get_random_bytes

def recover(password, j):
  key = hashlib.pbkdf2_hmac(
    'sha256',
    hashlib.sha256(password.encode('utf8')).digest(),
    salt=bytes(j['keyDerivationAlgorithm']['salt']),
    iterations=j['keyDerivationAlgorithm']['iterations'])
  iv = bytes(j['encryptionAlgorithm']['iv'])
  ciphertext_and_tag = bytes(j['ciphertext'])
  ciphertext, tag = ciphertext_and_tag[:-16], ciphertext_and_tag[-16:]

  cipher = AES.new(key, AES.MODE_GCM, iv)
  return cipher.decrypt_and_verify(ciphertext, tag)

if __name__ == '__main__':

  parser = argparse.ArgumentParser()
  subparsers = parser.add_subparsers()
  parser.add_argument('-p', '--pretty', action='store_true')
  parser.set_defaults(get_j=(lambda: parser.parse_args(['-h'])))

  def get_j_for_json():
    return json.load(sys.stdin)
  json_parser = subparsers.add_parser('json')
  json_parser.set_defaults(get_j=get_j_for_json)

  def get_j_for_html():
    import bs4
    return json.loads(bs4.BeautifulSoup(sys.stdin, 'html.parser').find(id=args.id).text)
  html_parser = subparsers.add_parser('html')
  html_parser.add_argument('--id', default='encrypted-message')
  html_parser.set_defaults(get_j=get_j_for_html)

  args = parser.parse_args()

  j = args.get_j()

  password = getpass.getpass()

  plaintext = recover(password, j).decode('utf8')
  print(json.dumps(json.loads(plaintext), indent=(2 if args.pretty else None)))
