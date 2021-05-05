/**
 * Also install:
 * yarn add -D eslint eslint-config-airbnb-typescript eslint-config-prettier eslint-plugin-prettier eslint-plugin-promise
 *
 */

module.exports = {
    extends: [
        'airbnb-typescript/base',
        "plugin:promise/recommended",
        "plugin:prettier/recommended"
    ],
    rules: {
        "no-underscore-dangle": 0,
        "@typescript-eslint/naming-convention": [
            0,
            {
                "format": ["camelCase"],
                "leadingUnderscore": "allow"
            },
        ],
        "prettier/prettier": [
            "error",
            {
                "endOfLine": "auto"
            },
        ],
    },
    parserOptions: {
        project: './tsconfig.json'
    }
};
