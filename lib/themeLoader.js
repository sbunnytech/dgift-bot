// lib/themeLoader.js

import {
  readdirSync,
  existsSync
} from 'fs'

import {
  join,
  basename,
  dirname
} from 'path'

import {
  fileURLToPath,
  pathToFileURL
} from 'url'

import { validateTheme }
from './themeValidator.js'

const __filename =
  fileURLToPath(import.meta.url)

const __dirname =
  dirname(__filename)

export async function loadThemeFile(
  themeName = 'default'
) {
  try {
    const themesPath = join(
      __dirname,
      '..',
      'themes'
    )

    if (!existsSync(themesPath)) {
      throw new Error(
        'themes folder missing'
      )
    }

    const files = readdirSync(themesPath)
      .filter(v => v.endsWith('.js'))

    if (!files.length) {
      throw new Error(
        'no theme files found'
      )
    }

    let matched = files.find(v => {
      return (
        basename(v, '.js')
          .toLowerCase() ===
        String(themeName)
          .toLowerCase()
      )
    })

    if (!matched) {
      matched = files[0]
    }

    const fullPath = join(
      themesPath,
      matched
    )

    const imported = await import(
      `${pathToFileURL(fullPath).href}?update=${Date.now()}`
    )

    const theme =
      imported.default || imported

    const valid =
      validateTheme(theme)

    if (!valid) {
      throw new Error(
        `invalid theme: ${matched}`
      )
    }

    return {
      name: basename(matched, '.js'),
      path: fullPath,
      theme
    }

  } catch (err) {
    console.log(
      '[THEME LOADER]',
      err.message
    )

    return null
  }
}