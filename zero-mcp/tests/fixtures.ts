// Fake credentials assembled at runtime so no token-shaped literal exists in the repo.
export const FAKE = {
  github: 'gh' + 'p_' + 'A1b2C3d4'.repeat(5),
  anthropic: 'sk-' + 'ant-' + 'api03-' + 'x'.repeat(40),
  aws: 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP',
  stripe: 'sk_' + 'live_' + '0'.repeat(24),
  privateKey: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
};
