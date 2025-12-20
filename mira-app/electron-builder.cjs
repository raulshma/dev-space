/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: <> */
const { normalize, dirname } = require('node:path')
const packageJSON = require('./package.json')

function getDevFolder(path) {
  const [nodeModules, devFolder] = normalize(dirname(path)).split(/\/|\\/g)

  return [nodeModules, devFolder].join('/')
}

const {
  main,
  name,
  version,
  resources,
  description,
  displayName,
  author: _author,
} = packageJSON

const author = _author?.name ?? _author
const currentYear = new Date().getFullYear()
const authorInKebabCase = author.replace(/\s+/g, '-')
const appId = `com.${authorInKebabCase}.${name}`.toLowerCase()

const artifactName = [`${name}-v${version}`, '-${os}.${ext}'].join('')

module.exports = {
  appId,
  productName: displayName,
  copyright: `Copyright © ${currentYear} \u2025 ${author}`,
  cscLink: null,

  directories: {
    app: getDevFolder(main),
    output: `dist/v${version}`,
  },

  mac: {
    artifactName,
    icon: `${resources}/icon.png`,
    category: 'public.app-category.utilities',
    target: ['zip', 'dmg', 'dir'],
  },

  linux: {
    artifactName,
    category: 'Utilities',
    synopsis: description,
    target: ['AppImage', 'deb', 'pacman', 'freebsd', 'rpm'],
  },

  win: {
    artifactName,
    icon: `${resources}/icon.png`,
    target: ['zip', 'portable'],
    forceCodeSigning: false,
    signAndEditExecutable: false,
    cscLink: "",
  },
}
