import * as sdk from 'botpress/sdk'

import en from '../translations/en.json'
import fr from '../translations/fr.json'
import templateCongigJson from './template.config.json'

const botTemplates: sdk.BotTemplate[] = templateCongigJson

const entryPoint: sdk.ModuleEntryPoint = {
  botTemplates,
  translations: { en, fr },
  definition: {
    name: 'builtin',
    menuIcon: 'fiber_smart_record',
    fullName: 'Botpress Builtins',
    homepage: 'https://botpress.com',
    noInterface: true
  }
}

export default entryPoint
