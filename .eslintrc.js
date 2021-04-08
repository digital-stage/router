module.exports = {
    extends: [
        'airbnb-typescript/base',
        "plugin:prettier/recommended",
        "plugin:promise/recommended"
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
    },
    parserOptions: {
        project: './tsconfig.json'
    }
};
