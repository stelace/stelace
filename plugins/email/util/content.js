const _ = require('lodash')
const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')

const noSpaceChars = {
  after: [
    '('
  ],
  before: [
    ',',
    '.',
    ')'
  ]
}
let indexedNoSpaceChars

const initNoSpaceChars = () => {
  if (indexedNoSpaceChars) return indexedNoSpaceChars

  indexedNoSpaceChars = {
    after: _.keyBy(noSpaceChars.after),
    before: _.keyBy(noSpaceChars.before)
  }

  return indexedNoSpaceChars
}

function minifyHtml (str) {
  if (typeof str !== 'string') return str

  return str.split('\n').reduce((memo, line) => {
    const trimmed = line.trim()
    if (!trimmed) return memo
    if (!memo) return trimmed

    return memo + (_shouldAddSpace(memo, trimmed) ? ' ' : '') + trimmed
  })
}

function _shouldAddSpace (str1, str2) {
  const indexedNoSpaceChars = initNoSpaceChars()
  return !indexedNoSpaceChars.after[_.last(str1)] && !indexedNoSpaceChars.before[_.first(str2)]
}

function generateText (html, selectors) {
  const $ = cheerio.load(html)

  let text = ''

  selectors.forEach(selector => {
    const $el = $(selector)
    if ($el.length) {
      const elText = $el.text()
      if (elText) {
        const trimmed = elText.trim()
        text += removeSpaceBetweenLines(trimmed) + '\n'
      }
    }
  })

  text = text.trim()
  text = text.replace(/(\n)+/gi, '\n')
  return text
}

function removeSpaceBetweenLines (text) {
  if (!text) return ''

  let generatedText = ''
  const lines = text.split('\n')

  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed) {
      generatedText += trimmed + '\n'
    }
  })

  return generatedText
}

function getLocalEmailFilename (name) {
  const fileFolder = path.join(__dirname, '../build')
  const filename = new Date().toISOString() + (name ? '_' + name : '') + '.html'
  return path.join(fileFolder, filename)
}

function generateLocalEmailFile (content, name) {
  const filename = getLocalEmailFilename(name)
  fs.writeFileSync(filename, content)
  return filename
}

module.exports = {
  minifyHtml,
  generateText,
  removeSpaceBetweenLines,
  getLocalEmailFilename,
  generateLocalEmailFile
}
