This password manager is a standalone HTML file that contains some encrypted data, as well as tools for querying it, manipulating it, and saving the manipulated data.

This approach has some pluses and minuses. On the plus side:

- It's super-portable; on any computer with a modern browser, this will work out of the box, without installing anything or using any tools you're unfamiliar with, or depending on any other files at all. (Contrast with: GPG.)
- It's super-simple. Your passwords are stored as a simple JSON object, serialized and encrypted with a standard, widely-supported stream cipher (specifically, AES-256 in GCM mode, the key computed by PBKDF2-ing the SHA-256 of your master password). You can trivially export all your data as JSON; and if this page "just stops working" somehow, you can easily recover your data using a text editor and a Python script (see "I can't recover my passwords!" below). (Contrast with: everything that's not GPG.)

And on the minus side:

- It's kinda ugly, as you see. Good UIs require require big ol' libraries and lots of elbow grease; I prefer minimalism.
- You can't "save a file," per se, only download a copy of this file with the new passwords embedded (encrypted) in it. This is an unavoidable consequence of JavaScript sandboxing, and it makes version control kinda a hassle.


## Conceptual Model

You have many accounts, and many secrets for each account. This password manager stores this as a two-level JSON object, like

```json
    {
      "amazon": {
        "email": "potato.king@gmail.com",
        "password": "pw-for-amazon",
        "username": "potato.king@gmail.com"
      },
      "facebook": {
        "email": "yet.another.alias@gmail.com",
        "password": "pw-for-facebook",
        "username": "yet.another.alias@gmail.com"
      },
      "github": {
        "password": "pw-for-github",
        "username": "leethacker"
      },
      "more...": {"...": "..."}
    }
```

It's _a little bad_ if bad guys get ahold of the account/field names (e.g. `github` or `username`); it's __disastrous__ if they get ahold of the values (e.g. `pw-for-amazon`). This password manager is designed to _somewhat_ protect the account/field names (they're stored encrypted on disk, but still displayed on the screen), and __energetically__ protect the field values ("secrets") (they are encrypted on disk, _never_ displayed on the screen, and they only _ever_ leave the JavaScript interpreter's memory in plaintext by being copied to the clipboard when you ask for them to be).

At any given time, this password manager has one of these two-level objects, in plaintext, stored in "working memory." This is the object that you query and modify. It starts out empty; you can add/modify values, and "save" it by embedding an encrypted copy in a _copy_ of the Passman file (remember, JavaScript can't just write to disk; it can only download new files).

There is such an encrypted message embedded in every Passman file. You can decrypt that encrypted object and merge it into working memory by typing the decryption password into the top-left password field, then hitting "Decrypt". (Go on, try it! The default password is "master".)



## Tutorial

Here is a typical session I have with this file:

1. Open the file in my browser.

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/1.png)

2. Type in my decryption key, and hit Enter.

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/2.png)

3. Go about my life.

4. I need to log into Facebook. I type in queries to specify my "password" for "facebook", and hit Enter.

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/3.png)

5. I successfully log into Facebook. Heartened by my success, I decide to add my Expedia account to my password manager: I go the the "Modify Working Memory" pane, specify that I want to set "expedia"'s "username" to something, and hit Enter:

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/4.png)

    I do the same for my Expedia password.

6. Eventually, I close the page-- oops--

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/5.png)

    That's right! I haven't saved my Expedia password. I hit "Stay on Page".

7. I type in my password to encrypt the file-- oops--

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/6.png)

    I must've typoed my password. I type it again:

    ![screenshot](https://github.com/speezepearson/passman/raw/master/readme-images/7.png)

8. Before I forget -- I hate this step, but I don't yet know a way around it -- I move the _newly downloaded_ password file to replace the old one, so that when I open it next time, I'll be sure to open the version that contains my Expedia password.

9. _Now_ I close the page.


## I can't recover my passwords!

Don't worry! If the Passman page somehow stops working for you, you can use [this Python script](https://github.com/speezepearson/passman/blob/master/recover.py) to recover your passwords: in a terminal, just run `pip install cryptodomex bs4 && python recover.py html < /path/to/passman.html`.

If even _that_ doesn't work for whatever reason, you'll have to roll up your sleeves and code a little. What you need to know:

- There's a JSON object inside the HTML element with `id="encrypted-message"`. It specifies a `keyDerivationAlgorithm`, an `encryptionAlgorithm`, and some `ciphertext`. All the arrays of numbers from 0 to 255 represent bytestrings.
- The `keyDerivationAlgorithm` describes how to turn the decryption password into a cryptogaphic key: for the foreseeable future, it uses the PBKDF2 of the SHA-256 of the password, with the `keyDerivationAlgorithm` JSON object specifying the `salt` and number of `iterations`.
- The `encryptionAlgorithm` describes the cipher used to encrypt your passwords. At time of writing, it uses AES-256 run in Galois/Counter Mode (GCM), with the `encryptionAlgorithm` JSON object specifying the IV (`iv`).
- The `ciphertext` contains the encrypted message, _and_ the GCM authentication tag. The tag is the last 16 bytes, and may have to be separated from the ciphertext depending on your crypto library's convention.

So, to decrypt:

- UTF8-encode the decryption password, SHA-256 it, and run that through PBKDF2, with the salt / number of iterations specified by the `keyDerivationAlgorithm`
- Take the `ciphertext`, and decrypt it with that key, using the algorithm/IV defined by `encryptionAlgorithm`. (You may have to slice off the last 16 bytes if the cipher is in Galois/Counter mode.)
- You're done! That's the UTF8-encoded JSON string containing your passwords.
