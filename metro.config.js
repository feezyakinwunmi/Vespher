// Metro (mobile bundler) config. web/ (vendor/admin dashboard) and video/ (promo
// videos) are separate projects with their own node_modules, so Metro must not crawl them.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = ['web', 'video'].map(
  (dir) => new RegExp(`^${escapeRegExp(path.resolve(__dirname, dir))}[\\\\/].*`)
);

module.exports = config;
