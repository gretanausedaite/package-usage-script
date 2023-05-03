# package-usage-script

Copied from and inspired by [bentleyvk package-usage script](https://github.com/bentleyvk/package-usage).

This script generates a `csv` file with a list of apps using your packages and which version of app their are using.

## Usage

- Firstly you need to run:
```
npm install
```

- Update `packages` array in script file with a list of package names you want to find usage for. Should be in a format of `[organization]/[package-name]`.
- Get ADO PAT token with read access to code.
- Run:
```
node package-usage-ADO.js companyName azureToken
```

`companyName` - name of your company, you can just copy it from the URL `https://dev.azure.com/companyName/`.

`azureToken` - Azure token that you got in previous step.
