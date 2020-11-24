module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: ['airbnb-base', 'prettier', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
  },
}
