# TuDuo

## Auth

Authentication and authorization is handled by Auth0.
Each user needs to have a permission with a group set to whom they belong. The group is used to determine the sqlite database file that the user has access to.

e.g. `group:beto` will have access to the `databases/database-beto.sqlite` file.

## Databases

The sqlite databases are stored in the `databases` directory. Each database file is named after the group that has access to it. The database files are created automatically when a user logs in for the first time.

## Development

Localhost tls certificate generation (needed for Auth0).

```bash
openssl req -x509 -out tls/cert.pem -keyout tls/key.pem \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

Fuck Cors:

```bash
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security

```
